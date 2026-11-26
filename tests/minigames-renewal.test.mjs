import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { arcadeLeaderboard } from "../lib/cafe-arcade.mjs";
import {
  canAutoComplete,
  canMoveToFoundation,
  canMoveToTableau,
  createSolitaireGame,
  drawFromStock,
  findSolitaireHint,
  isSolitaireWon,
  moveCards,
  stepAutoComplete,
  undoSolitaire,
} from "../public/solitaire-engine.mjs";
import {
  DOCK_BASE_SLOTS,
  KNIT_STAGE_COUNT,
  TRAY_COLS,
  TRAY_ROWS,
  createKnitStage,
  findKnitHint,
  isCellReachable,
  isKnitWon,
  pickKnitCell,
  stepKnitUnravel,
  undoKnit,
  useKnitBooster,
} from "../public/knit-unravel-engine.mjs";

function makeArcadeDb() {
  const sqlite = new DatabaseSync(":memory:");
  for (const file of [
    "0000_strange_moira_mactaggert.sql",
    "0009_arcade_and_pvp.sql",
  ]) {
    const raw = readFileSync(new URL(`../drizzle/${file}`, import.meta.url), "utf8");
    for (const stmt of raw.split("--> statement-breakpoint")) {
      if (stmt.trim()) sqlite.exec(stmt);
    }
  }
  let queue = Promise.resolve();
  return {
    sqlite,
    db: {
      prepare(sql) {
        return {
          bind(...values) {
            const bound = sqlite.prepare(sql);
            const isReader = /^\s*(SELECT|PRAGMA|WITH)/i.test(sql);
            return {
              sql,
              values,
              async first() { return bound.get(...values) ?? null; },
              async all() { return { results: isReader ? bound.all(...values) : [] }; },
              async run() {
                const info = bound.run(...values);
                return { success: true, meta: { changes: Number(info.changes) } };
              },
            };
          },
        };
      },
      async batch(statements) {
        const op = queue.then(async () => {
          sqlite.exec("BEGIN");
          try {
            const out = [];
            for (const st of statements) {
              if (/^\s*(SELECT|PRAGMA|WITH)/i.test(st.sql)) {
                out.push({ results: (await st.all()).results, meta: { changes: 0 }, success: true });
              } else {
                const runRes = await st.run();
                out.push({ results: [], meta: runRes.meta, success: true });
              }
            }
            sqlite.exec("COMMIT");
            return out;
          } catch (err) {
            sqlite.exec("ROLLBACK");
            throw err;
          }
        });
        queue = op.catch(() => {});
        return op;
      },
    },
  };
}

function postJson(url, body) {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("Klondike Solitaire initializes 52 cards, draws 1/3, validates rules, undoes, and auto-completes", () => {
  const game = createSolitaireGame({ drawCount: 1, seed: 42 });
  assert.equal(game.stock.length, 24);
  assert.equal(game.waste.length, 0);
  assert.deepEqual(game.tableau.map((p) => p.length), [1, 2, 3, 4, 5, 6, 7]);
  assert.ok(game.tableau.every((p) => p[p.length - 1].faceUp && p.slice(0, -1).every((c) => !c.faceUp)));

  assert.equal(drawFromStock(game), true);
  assert.equal(game.waste.length, 1);
  assert.equal(undoSolitaire(game), true);
  assert.equal(game.waste.length, 0);

  const g3 = createSolitaireGame({ drawCount: 3, seed: 99 });
  assert.equal(drawFromStock(g3), true);
  assert.equal(g3.waste.length, 3);

  const manual = {
    drawCount: 1,
    stock: [],
    waste: [{ id: "spades-1", suit: "spades", rank: 1, faceUp: true }],
    foundations: [[], [], [], []],
    tableau: [
      [{ id: "hearts-1", suit: "hearts", rank: 1, faceUp: true }],
      [{ id: "clubs-13", suit: "clubs", rank: 13, faceUp: true }, { id: "diamonds-12", suit: "diamonds", rank: 12, faceUp: true }],
      [{ id: "spades-11", suit: "spades", rank: 11, faceUp: true }],
      [], [], [], [],
    ],
    moves: 0,
    score: 0,
    history: [],
  };

  assert.equal(canMoveToFoundation(manual.waste[0], manual.foundations[0]), true);
  assert.equal(canMoveToTableau(manual.tableau[2][0], manual.tableau[1]), true);
  assert.equal(moveCards(manual, { kind: "tableau", index: 2, cardIndex: 0 }, { kind: "tableau", index: 1 }), true);
  assert.ok(findSolitaireHint(manual));
  assert.equal(undoSolitaire(manual), true);

  const suits = ["spades", "hearts", "clubs", "diamonds"];
  const ready = {
    drawCount: 1,
    stock: [],
    waste: [],
    foundations: [[], [], [], []],
    tableau: [
      ...suits.map((s) => Array.from({ length: 13 }, (_, idx) => ({ id: `${s}-${13 - idx}`, suit: s, rank: 13 - idx, faceUp: true }))),
      [], [], [],
    ],
    moves: 0,
    score: 0,
    history: [],
  };
  assert.equal(canAutoComplete(ready), true);
  while (stepAutoComplete(ready)) { /* auto */ }
  assert.equal(isSolitaireWon(ready), true);
});

test("Knit Unravel 10 stages strictly conserve color stitch counts and support BFS exit, mechanics, boosters & unraveling", () => {
  for (let stage = 1; stage <= KNIT_STAGE_COUNT; stage++) {
    const game = createKnitStage(stage);
    assert.equal(game.stage, stage);
    assert.equal(game.tray.length, TRAY_ROWS);
    assert.equal(game.tray[0].length, TRAY_COLS);

    const tapestryCounts = new Map();
    for (const row of game.tapestry) {
      for (const cid of row) {
        if (cid) tapestryCounts.set(cid, (tapestryCounts.get(cid) || 0) + 1);
      }
    }
    const spoolCounts = new Map();
    let totalSpoolCheck = 0;
    for (const row of game.tray) {
      for (const cell of row) {
        if (!cell) continue;
        if (cell.type === "spool") {
          spoolCounts.set(cell.color, (spoolCounts.get(cell.color) || 0) + cell.capacity);
          totalSpoolCheck++;
        } else if (cell.type === "dispenser") {
          for (const q of cell.queue) {
            spoolCounts.set(q.color, (spoolCounts.get(q.color) || 0) + q.capacity);
            totalSpoolCheck++;
          }
        }
      }
    }
    assert.equal(totalSpoolCheck, game.totalSpools);
    assert.deepEqual(Object.fromEntries([...spoolCounts.entries()].sort()), Object.fromEntries([...tapestryCounts.entries()].sort()));
    assert.ok(findKnitHint(game), `Stage ${stage} must have an initial reachable move`);
  }

  // Deterministic mechanics verification (BFS reachability, mystery reveal, ice melt, pair pickup, dispenser emit, unravel + win)
  const makeSpool = (id, color, cap, extra = {}) => ({
    type: "spool", id, color, capacity: cap, remaining: cap, mystery: false, ice: 0, pairId: null, ...extra,
  });
  const synth = {
    stage: 1,
    patternName: "테스트",
    tapestry: [
      ["g", "y"],
      ["y", "g"],
    ],
    rows: 2,
    cols: 2,
    totalStitches: 4,
    remainingStitches: 4,
    totalSpools: 3,
    completedSpools: 0,
    dockCapacity: DOCK_BASE_SLOTS,
    dock: Array(8).fill(null),
    tray: Array.from({ length: TRAY_ROWS }, () => Array(TRAY_COLS).fill(null)),
    activeThreads: [],
    boosters: { slot: 1, glove: 1, scissors: 1 },
    armedBooster: null,
    score: 0,
    moves: 0,
    history: [],
  };
  synth.tray[0][0] = makeSpool(1, "y", 2, { pairId: 1 });
  synth.tray[0][1] = makeSpool(2, "g", 1, { pairId: 1 });
  synth.tray[1][0] = makeSpool(3, "g", 1, { ice: 1, mystery: true });
  synth.tray[2][0] = { type: "dispenser", id: 9, queue: [] };

  // Frozen cell is not reachable yet
  assert.equal(isCellReachable(synth, 1, 0), false);
  assert.equal(isCellReachable(synth, 0, 0), true);

  // Pick paired spools (moves both into dock and clears mystery + melts ice on [1][0])
  const pickRes = pickKnitCell(synth, 0, 0);
  assert.equal(pickRes.ok, true);
  assert.equal(pickRes.count, 2);
  assert.equal(synth.tray[1][0].mystery, false);
  assert.equal(synth.tray[1][0].ice, 0);
  assert.equal(undoKnit(synth), true);
  assert.equal(synth.tray[1][0].ice, 1);

  assert.equal(pickKnitCell(synth, 0, 0).ok, true);
  assert.equal(useKnitBooster(synth, "slot").ok, true);
  assert.equal(synth.dockCapacity, DOCK_BASE_SLOTS + 1);
  assert.equal(useKnitBooster(synth, "glove", { r: 1, c: 0 }).ok, true);

  while (stepKnitUnravel(synth, 1).length) { /* unravel */ }
  assert.equal(isKnitWon(synth), true);
});

test("Arcade Leaderboard supports solitaire and knit games", async () => {
  const { db, sqlite } = makeArcadeDb();
  try {
    const member = randomUUID();
    const sol = await (await arcadeLeaderboard(postJson("https://pcbang.test/api/arcade", {
      action: "submit", game: "solitaire", mode: "draw1", member, nickname: "카드장인", score: 880, metric: "28수",
    }), db, 1800000000000)).json();
    assert.equal(sol.entries[0].nickname, "카드장인");

    const knit = await (await arcadeLeaderboard(postJson("https://pcbang.test/api/arcade", {
      action: "submit", game: "knit", mode: "stage3", member, nickname: "뜨개장인", score: 1350, metric: "3탄 100%",
    }), db, 1800000000010)).json();
    assert.equal(knit.entries[0].nickname, "뜨개장인");
  } finally {
    sqlite.close();
  }
});

test("Pure-pixel hall tiles, pure-pixel avatar matrices, and arrow-stepper wardrobe are active with zero math blobs", () => {
  const html = readFileSync(new URL("../app/cafe.html", import.meta.url), "utf8");
  const pcCss = readFileSync(new URL("../public/pc.css", import.meta.url), "utf8");
  const shellCss = readFileSync(new URL("../public/game-shell.css", import.meta.url), "utf8");
  const walkCss = readFileSync(new URL("../public/walk.css", import.meta.url), "utf8");
  const walkJs = readFileSync(new URL("../public/walk.js", import.meta.url), "utf8");
  const cafeArt = readFileSync(new URL("../public/cafe-art.js", import.meta.url), "utf8");
  const pixelTiles = readFileSync(new URL("../public/pixel-tiles.js", import.meta.url), "utf8");
  const avatarJs = readFileSync(new URL("../public/avatar-sprites.js", import.meta.url), "utf8");

  assert.match(html, /<script src="\.\/pixel-tiles\.js" defer><\/script>/);
  assert.match(html, /id="wardrobe-rot-left"/);
  assert.match(html, /id="wardrobe-rot-right"/);
  assert.match(html, /id="knit-loom"/);
  assert.match(html, /id="knit-boost-slot"/);
  assert.match(walkJs, /className = "wardrobe-stepper"/);
  assert.match(walkCss, /\.wardrobe-stepper/);
  assert.match(cafeArt, /const WIDTH = 1152;\s*\r?\n\s*const HEIGHT = 768;/);
  assert.match(pixelTiles, /window\.cafePixelTiles =/);
  assert.ok(!avatarJs.includes("pellipse"), "avatar-sprites.js must use pixel matrices instead of math ellipses");
  assert.match(pcCss, /\.sudoku-cell\[data-given\]/);
  assert.match(pcCss, /\.pc-launcher\[hidden\]/);
  assert.match(shellCss, /\.cafe-joystick\[hidden\]/);
});
