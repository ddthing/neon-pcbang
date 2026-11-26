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
  BOBBIN_CAPACITY,
  KNIT_STAGE_COUNT,
  TRAY_CAPACITY,
  createKnitStage,
  findKnitHint,
  isKnitStuck,
  isKnitWon,
  isStrandFree,
  pickKnitStrand,
  undoKnit,
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
  assert.equal(game.waste[0].faceUp, true);
  assert.equal(undoSolitaire(game), true);
  assert.equal(game.waste.length, 0);
  assert.equal(game.stock.length, 24);

  const g3 = createSolitaireGame({ drawCount: 3, seed: 99 });
  assert.equal(drawFromStock(g3), true);
  assert.equal(g3.waste.length, 3);

  // Foundation & tableau move validation + auto-complete win flow
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
  assert.equal(manual.tableau[1].length, 3);
  assert.ok(findSolitaireHint(manual));
  assert.equal(undoSolitaire(manual), true);
  assert.equal(manual.tableau[1].length, 2);

  // Auto-complete full deck from tableau -> 4 completed foundations
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
  while (stepAutoComplete(ready)) { /* step */ }
  assert.equal(isSolitaireWon(ready), true);
});

test("Knit Unravel blocks covered strands, flushes waiting tray to matching bobbins, undoes cleanly, and initializes all 10 stages", () => {
  for (let stage = 1; stage <= KNIT_STAGE_COUNT; stage++) {
    const game = createKnitStage(stage);
    assert.equal(game.stage, stage);
    assert.equal(game.totalBobbins, game.activeBobbins.length + game.bobbinQueue.length);
    assert.equal(game.strands.length, game.totalBobbins * BOBBIN_CAPACITY);
    assert.ok(game.strands.some((s) => isStrandFree(game, s.id)), `Stage ${stage} must start with at least one unblocked strand`);
  }

  const g = createKnitStage(1);
  const blocked = g.strands.find((s) => !isStrandFree(g, s.id));
  if (blocked) {
    assert.deepEqual(pickKnitStrand(g, blocked.id), { ok: false, reason: "locked" });
  }

  // Deterministic manual tray flush + win test
  const synth = {
    stage: 1,
    strands: [
      { id: 1, color: "sage", layer: 3, x: 10, y: 10, w: 20, h: 12 },
      { id: 2, color: "berry", layer: 2, x: 40, y: 10, w: 20, h: 12 },
      { id: 3, color: "berry", layer: 1, x: 10, y: 40, w: 20, h: 12 },
      { id: 4, color: "berry", layer: 0, x: 40, y: 40, w: 20, h: 12 },
      { id: 5, color: "sage", layer: 4, x: 70, y: 10, w: 12, h: 20 },
      { id: 6, color: "sage", layer: 5, x: 70, y: 40, w: 12, h: 20 },
    ],
    activeBobbins: [{ color: "berry", count: 0, max: 3 }],
    bobbinQueue: [{ color: "sage", count: 0, max: 3 }],
    totalBobbins: 2,
    completedBobbins: 0,
    tray: [],
    score: 0,
    moves: 0,
    history: [],
  };

  // Pick sage strands while only berry bobbin is active -> buffered in tray (up to TRAY_CAPACITY=5)
  assert.equal(TRAY_CAPACITY, 5);
  assert.deepEqual(pickKnitStrand(synth, 1), { ok: true, woundDirectly: false });
  assert.deepEqual(synth.tray, ["sage"]);
  assert.equal(undoKnit(synth), true);
  assert.deepEqual(synth.tray, []);

  assert.equal(pickKnitStrand(synth, 1).ok, true);
  assert.equal(pickKnitStrand(synth, 5).ok, true);
  assert.equal(pickKnitStrand(synth, 6).ok, true);
  assert.equal(synth.tray.length, 3);
  assert.equal(isKnitStuck(synth), false);
  assert.ok(findKnitHint(synth));

  // Complete berry bobbin -> automatically advances to sage bobbin and flushes all 3 tray strands to win!
  assert.equal(pickKnitStrand(synth, 2).woundDirectly, true);
  assert.equal(pickKnitStrand(synth, 3).woundDirectly, true);
  assert.equal(pickKnitStrand(synth, 4).woundDirectly, true);
  assert.equal(isKnitWon(synth), true);
  assert.equal(synth.completedBobbins, 2);
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
      action: "submit", game: "knit", mode: "stage3", member, nickname: "뜨개장인", score: 1350, metric: "3탄 클리어",
    }), db, 1800000000010)).json();
    assert.equal(knit.entries[0].nickname, "뜨개장인");
  } finally {
    sqlite.close();
  }
});

test("Launcher stays closed by default, Sudoku exposes given/user distinction & Undo, and Mobile HUD controls are present", () => {
  const html = readFileSync(new URL("../app/cafe.html", import.meta.url), "utf8");
  const pcCss = readFileSync(new URL("../public/pc.css", import.meta.url), "utf8");
  const shellCss = readFileSync(new URL("../public/game-shell.css", import.meta.url), "utf8");
  const appJs = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");

  assert.match(html, /<section\s+class="pc-launcher"\s+id="pc-launcher"[^>]*\bhidden>/);
  assert.match(html, /id="pc-launcher-close"/);
  assert.match(html, /data-launcher\b/);
  assert.match(html, /id="sudoku-undo"/);
  assert.match(html, /class="sudoku-legend"/);
  assert.match(html, /<dialog\s+id="solitaire"/);
  assert.match(html, /<dialog\s+id="knit"/);

  assert.match(pcCss, /\.sudoku-cell\[data-given\]/);
  assert.match(pcCss, /\.sudoku-cell\[data-user\]/);
  assert.match(pcCss, /\.pc-launcher\[hidden\]/);
  assert.match(shellCss, /\.cafe-joystick\[hidden\]/);
  assert.match(appJs, /solitaire:\s*\(\)\s*=>\s*import\("\.\/solitaire\.js"\)/);
  assert.match(appJs, /knit:\s*\(\)\s*=>\s*import\("\.\/knit-unravel\.js"\)/);
});
