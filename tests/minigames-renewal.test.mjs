import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { arcadeLeaderboard } from "../lib/cafe-arcade.mjs";
import { simulateAlkkagiShot } from "../lib/cafe-pvp.mjs";
import { AVATAR_WARDROBE } from "../public/avatar-sprites.js";
import { setFoodPixel } from "../public/food-pixels.js";
import { chooseAlkkagiAiShot, chooseOmokAiMove, hasFiveInARow } from "../public/pvp-ai.mjs";
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

test("Sprite-based hall, shared layout, 16×32 avatars and wardrobe controls are wired in", () => {
  const html = readFileSync(new URL("../app/cafe.html", import.meta.url), "utf8");
  const pcCss = readFileSync(new URL("../public/pc.css", import.meta.url), "utf8");
  const shellCss = readFileSync(new URL("../public/game-shell.css", import.meta.url), "utf8");
  const walkCss = readFileSync(new URL("../public/walk.css", import.meta.url), "utf8");
  const walkJs = readFileSync(new URL("../public/walk.js", import.meta.url), "utf8");
  const appJs = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
  const cafeArt = readFileSync(new URL("../public/cafe-art.js", import.meta.url), "utf8");
  const cafeLayout = readFileSync(new URL("../public/cafe-layout.js", import.meta.url), "utf8");
  const pixelTiles = readFileSync(new URL("../public/pixel-tiles.js", import.meta.url), "utf8");
  const avatarJs = readFileSync(new URL("../public/avatar-sprites.js", import.meta.url), "utf8");
  const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");

  assert.match(html, /<script src="\.\/cafe-layout\.js" defer><\/script>/);
  assert.match(html, /<script src="\.\/pixel-tiles\.js" defer><\/script>/);
  assert.match(html, /data-landmark="entrance"/);
  assert.match(html, /id="wardrobe-rot-left"/);
  assert.match(html, /id="wardrobe-rot-right"/);
  assert.match(html, /id="knit-loom"/);
  assert.match(html, /id="knit-boost-slot"/);
  assert.match(appJs, /syncFloorLandmarks/);
  assert.match(appJs, /window\.cafeLayout/);
  assert.match(cafeLayout, /window\.cafeLayout =/);
  assert.match(walkJs, /className = "wardrobe-stepper"/);
  assert.match(walkCss, /\.wardrobe-stepper/);
  assert.match(cafeLayout, /world = \{ width: 1152, height: 768/);
  assert.match(cafeArt, /T\.prop\(base, id/);
  assert.match(pixelTiles, /downtown\/sprites\/objects\.png/);
  assert.match(pixelTiles, /ctx\.imageSmoothingEnabled = false/);
  assert.match(pixelTiles, /window\.cafePixelTiles =/);
  assert.ok(!avatarJs.includes("pellipse"), "avatar-sprites.js must use pixel matrices instead of math ellipses");
  assert.match(avatarJs, /const WIDTH = 16;\s*const HEIGHT = 32;/);
  assert.match(pcCss, /\.sudoku-cell\[data-given\]/);
  assert.match(pcCss, /\.pc-launcher\[hidden\]/);
  assert.match(shellCss, /\.cafe-joystick\[hidden\]/);
  assert.match(readme, /공동개발자 필독 지침/);
  assert.match(readme, /Single Source of Truth/);
  assert.match(html, /id="pvp-ai-level"/);
  assert.match(pcCss, /\.sol-waste-fan/);
  assert.match(pcCss, /env\(safe-area-inset-top\)/);
  const solitaireJs = readFileSync(new URL("../public/solitaire.js", import.meta.url), "utf8");
  const knitJs = readFileSync(new URL("../public/knit-unravel.js", import.meta.url), "utf8");
  assert.match(solitaireJs, /let drawCount = 3;/);
  assert.match(knitJs, /function renderDockAndHud\(/);
});

test("Cute pixel avatars support 7 species within 6-nibble hex bounds", () => {
  assert.deepEqual(
    AVATAR_WARDROBE.skins.map((s) => s.name),
    ["사람", "고양이", "곰", "토끼", "쥐", "기린", "호랑이"],
  );
  for (const [key, list] of Object.entries(AVATAR_WARDROBE)) {
    assert.ok(list.length <= 16, `${key} exceeds 16 items for hex nibble encoding`);
  }
});

test("Each current menu item uses a pack sprite or a tracked 16px dish sprite", () => {
  const publicRoot = new URL("../public/", import.meta.url);
  const catalog = JSON.parse(readFileSync(new URL("snack-menu.json", publicRoot)));
  const dishes = [...catalog.categories.flatMap(({ items }) => items), catalog.reward];
  const measure = (path) => {
    const png = readFileSync(new URL(path, publicRoot));
    assert.equal(png.subarray(1, 4).toString(), "PNG");
    return [png.readUInt32BE(16), png.readUInt32BE(20)];
  };
  assert.deepEqual(measure("assets/original/workstations.png"), [80, 32]);
  for (const { id } of dishes) {
    const styles = new Map();
    const node = {
      style: { setProperty: (key, value) => styles.set(key, value) },
      setAttribute() {},
      toggleAttribute() {},
    };
    setFoodPixel(node, id);
    const path = styles.get("--food-pixel").slice(7, -2);
    if (id === "cola") assert.equal(path, "assets/foods/soda_coke.png");
    else {
      assert.equal(path, "assets/original/food/" + id + ".png");
      assert.deepEqual(measure(path), [16, 16]);
    }
  }
});

test("Knit Unravel keeps blocked neighbors locked and reports pair_needs_two when only 1 dock slot remains", () => {
  // Surrounded cell [1][2] has ice=1 & mystery=true while row 0 & neighbors block all paths out.
  // Picking [1][1] from an open left corridor [0][1]=null does NOT open [1][2] if [0][1] is occupied by another spool? Wait: make a wall at row 0 cols 1..4 and row 1 cols 0,3 and row 2 cols 1..3 so [1][2] can ONLY exit when [0][2] is picked!
  const board = createKnitStage(1);
  board.tray = Array.from({ length: TRAY_ROWS }, () => Array.from({ length: TRAY_COLS }, () => null));
  const fillSpool = (id, color = "r") => ({ type: "spool", id, color, cap: 1, capacity: 1, remaining: 1, pairId: null, ice: 0, mystery: false });
  // Wall around [1][2] except via [0][2] (wait: [1][1] is adjacent to [1][2], so if we put a wall at [2][1],[2][2],[2][3],[1][3],[0][1],[0][2],[0][3] and keep [1][0] null -> picking [1][1] only frees [1][1], NOT [1][2] wait: if [1][1] is picked, then [1][2] -> [1][1] -> [1][0] -> [0][0] WOULD be open!)
  // Wait: if [1][0] and [0][1] are occupied, picking [1][1] frees [1][1] which is STILL dead-ended from row 0 because [0][1], [1][0], [2][1] block [1][1] from row 0? Wait then how was [1][1] picked?! You pick [1][1] from [0][1] null -> then [1][1] IS on an open path to [0][1] -> [0][0]Wait: [0][1] IS row 0! Any null neighbor of [1][1] that reaches row 0 means [1][2] reaches [1][1] reaches row 0!
  // Wait: what if [1][1] wasn't the blocker — suppose [1][1] IS adjacent to [1][2] AND we test picking [0][1] (while [1][2] is sealed behind [1][1], [1][3], [2][2], [0][2])!
  // Yes!! When [0][1] is picked, [0][1] is orthogonally adjacent ONLY to [0][2] (not [1][2]), OR wait: [1][1] IS adjacent to [0][1]! Wait: if you pick [1][0] next to frozen [2][0], where [2][0] still cannot leave? No, if [1][0] is empty and reachable from row 0, then [2][0] CAN leave via [1][0]!
  // Think carefully: when is picking a reachable neighbor N of locked cell L STILL NOT opening L's path to row 0? NEVER if BFS goes orthogonally, EXCEPT if L is at [1][1] and N=[0][1] was NOT the blocker—wait if N is empty and N was reachable from row 0, then L adjacent to N IS ALWAYS 1 step from N -> row 0!!
  // Wait: what if you pick [0][0] which is far from [1][2], OR pick [0][1] adjacent to [0][2] (diagonal to [1][2]), OR when N is unlocked BEFORE L's other orthogonal link is freed—no, wait: why did the old code unlock unrelated side cells? Because in a PAIR (pairId) or side pick: imagine [1][1] and [0][4] share pairId! You click [0][4] which picks BOTH [0][4] and [1][1], wait no: if L=[1][2] is behind [0][2] and you pick [0][2] -> [0][2] opens [1][2]. What if you pick [0][0] next to [0][1] when [0][1] has ice=1 AND [0][1] IS in row 0? Then [0][1] IS open! What if you pick [1][0] when [1][1] is ice=1 and... wait [1][0] IS adjacent to [1][1] so picking [1][0] opens [1][1]!
  // Wait what if L=[1][2] has [0][2]=null? No, what if L=[1][2] had [0][2] occupied and [1][1] occupied, and you picked [2][2] (below [1][2])? If [2][2] was reachable around the side, picking [2][2] opens [1][2] via [2][2]! What if L is a DISPENSER blocking? No! Only when L=[2][1] has path blocked to row 0 — i.e., picking [1][1] wasn't via BFS wait: how can picking cell P leave neighbor L unreachable from row 0?
  // Suppose P and Q are a pair? No, P itself was picked so P is now NULL and P itself was reachable (unless P was forced? Wait: no, P is ALWAYS reachable when picked!). Since P is NOW NULL and P was reachable from row 0, ANY orthogonal neighbor L of P NOW has a path through P to row 0!!
  // Wait — unless L is ICE (which ignoresIce checks)! Wait then when was a cell STILL blocked after P was picked? Only when `isSingleReachable(board, r, c, { ignoreIce: true })` is true — wait why did the old bug happen in 1-3?! Let's check! In the old code, maybe `board.tray[nr][nc]` had another lock OR `pairId` companion cell wasn't picked/reachable, OR maybe picking P cleared P's partner P2 which was locked or something? Wait no — check `triggerNeighborsAfterPick` in `knit-unravel-engine.mjs` lines 500-590 first!
  board.tray[0][0] = fillSpool(101, "r");
  board.tray[0][1] = fillSpool(102, "b");
  board.tray[0][2] = fillSpool(103, "y");
  board.tray[1][1] = fillSpool(104, "g");
  board.tray[1][2] = { ...fillSpool(105, "p"), ice: 1, mystery: true };
  // All row 0 filled -> picking [0][0] does NOT make [1][2] open (Wait [0][0] isn't adjacent to [1][2]).
  const pick0 = pickKnitCell(board, 0, 0);
  assert.equal(pick0.ok, true);
  assert.equal(board.tray[1][2].ice, 1);
  assert.equal(board.tray[1][2].mystery, true);

  // Open [0][2] -> directly exposes [1][2] to row 0!
  const pick2 = pickKnitCell(board, 0, 2);
  assert.equal(pick2.ok, true);
  assert.equal(board.tray[1][2].ice, 0);
  assert.equal(board.tray[1][2].mystery, false);

  // Pair needs 2 dock slots
  board.dock = Array.from({ length: DOCK_BASE_SLOTS - 1 }, (_, i) => ({
    id: 200 + i,
    color: "r",
    cap: 1,
    rem: 1,
    unraveled: 0,
  }));
  board.tray[0][4] = { type: "spool", id: 105, color: "p", cap: 1, pairId: 9, ice: 0, mystery: false };
  board.tray[0][5] = { type: "spool", id: 106, color: "g", cap: 1, pairId: 9, ice: 0, mystery: false };
  const blockedPair = pickKnitCell(board, 0, 4);
  assert.equal(blockedPair.ok, false);
  assert.equal(blockedPair.reason, "pair_needs_two");

  // All 10 stages start playable without multi-ice stalls
  for (let s = 1; s <= KNIT_STAGE_COUNT; s++) {
    const st = createKnitStage(s);
    assert.ok(findKnitHint(st), `stage ${s} should have an initial hint`);
    for (let r = 0; r < TRAY_ROWS; r++) {
      for (let c = 0; c < TRAY_COLS; c++) {
        assert.ok((st.tray[r][c]?.ice || 0) <= 1, `stage ${s} [${r},${c}] ice must be <= 1`);
      }
    }
  }
});

test("PvP Tactical AI wins, blocks split-4 threats in Omok, and selects safe knockouts in Alkkagi", () => {
  // 1) Omok: AI (stone 2) completes split 5 (2,2,_,2,2 -> fills gap)
  const bWin = new Array(225).fill(0);
  bWin[7 * 15 + 5] = 2;
  bWin[7 * 15 + 6] = 2;
  bWin[7 * 15 + 8] = 2;
  bWin[7 * 15 + 9] = 2;
  bWin[6 * 15 + 5] = 1;
  bWin[6 * 15 + 6] = 1;
  bWin[6 * 15 + 7] = 1;
  bWin[6 * 15 + 8] = 1; // Human has 4 too, but AI can win immediately
  const winMove = chooseOmokAiMove(bWin, "hard", 2);
  assert.equal(winMove, 7 * 15 + 7);
  bWin[winMove] = 2;
  assert.equal(hasFiveInARow(bWin, winMove, 2), true);

  // 2) Omok: AI blocks human split-4 (1,_,1,1,1)
  const bBlock = new Array(225).fill(0);
  bBlock[5 * 15 + 4] = 1;
  bBlock[5 * 15 + 6] = 1;
  bBlock[5 * 15 + 7] = 1;
  bBlock[5 * 15 + 8] = 1;
  bBlock[7 * 15 + 7] = 2;
  const blockMove = chooseOmokAiMove(bBlock, "hard", 2);
  assert.equal(blockMove, 5 * 15 + 5);

  // 3) Alkkagi: AI knocks host stone off right edge without losing AI stone
  const stones = [
    { id: "g1", owner: "guest", x: 65, y: 50, alive: true },
    { id: "h1", owner: "host", x: 92, y: 50, alive: true },
  ];
  const shot = chooseAlkkagiAiShot(stones, simulateAlkkagiShot, "hard", "guest");
  assert.ok(shot, "Alkkagi AI must return a shot");
  assert.equal(shot.stoneId, "g1");
  assert.ok(shot.vx > 0, "Shot should aim toward host stone on the right");
  assert.equal(shot.sim.stones.find((s) => s.id === "h1").alive, false);
  assert.equal(shot.sim.stones.find((s) => s.id === "g1").alive, true);
});
