// 작업보드 접수 5건(스도쿠 메모, 솔리테어 1장 뽑기, 2048 슬라이딩, 오목 금수, 실풀기 규칙·표시)의 테스트
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { pvpArena } from "../lib/cafe-pvp.mjs";
import {
  createKnitStage,
  isCellReachable,
  isKnitWon,
  pickKnitCell,
  stepKnitUnravel,
  undoKnit,
  TRAY_COLS,
  TRAY_ROWS,
} from "../public/knit-unravel-engine.mjs";
import { moveMergeBoard } from "../public/merge-board.js";
import { omokMoveVerdict } from "../public/omok-rules.mjs";
import { chooseOmokAiMove } from "../public/pvp-ai.mjs";
import { wasteFanCount } from "../public/solitaire-engine.mjs";
import { clearSudokuPeerNotes, restoreSudokuPeerNotes } from "../public/sudoku-board.js";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");


function makeDb(...migrations) {
  const sqlite = new DatabaseSync(":memory:");
  for (const file of migrations) {
    for (const stmt of read(`../drizzle/${file}`).split("--> statement-breakpoint")) {
      if (stmt.trim()) sqlite.exec(stmt);
    }
  }
  const reader = /^\s*(SELECT|PRAGMA|WITH)/i;
  const db = {
    prepare(sql) {
      return {
        bind(...values) {
          const bound = sqlite.prepare(sql);
          return {
            sql,
            async first() { return bound.get(...values) ?? null; },
            async all() { return { results: reader.test(sql) ? bound.all(...values) : [] }; },
            async run() { return { success: true, meta: { changes: Number(bound.run(...values).changes) } }; },
          };
        },
      };
    },
    async batch(statements) {
      const out = [];
      for (const st of statements) {
        if (reader.test(st.sql)) out.push({ results: (await st.all()).results, meta: { changes: 0 } });
        else out.push({ results: [], meta: (await st.run()).meta });
      }
      return out;
    },
  };
  return { sqlite, db };
}

const postJson = (url, body) => new Request(url, {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
});
const at = (row, col) => row * 15 + col;
const emptyOmok = () => new Array(225).fill(0);

test("sudoku: real entries tidy peer memos, skip duplicates, and erasing restores them", () => {
  const values = new Array(81).fill(0);
  const notes = Array.from({ length: 81 }, () => new Set());
  notes[1].add(5); // 같은 행
  notes[9].add(5); // 같은 열·구역
  notes[80].add(5); // 관계없는 칸
  const cleared = clearSudokuPeerNotes(values, notes, 0, 5);
  values[0] = 5;
  assert.deepEqual(cleared.sort((a, b) => a - b), [1, 9]);
  assert.ok(notes[80].has(5), "unrelated cells keep their memo");

  values[0] = 0;
  restoreSudokuPeerNotes(values, notes, cleared, 5);
  assert.ok(notes[1].has(5) && notes[9].has(5), "erasing the entry brings the memos back");

  // 이미 같은 줄에 5가 있으면(중복 오입력) 메모를 건드리지 않는다.
  values[8] = 5;
  assert.deepEqual(clearSudokuPeerNotes(values, notes, 0, 5), []);
  assert.ok(notes[1].has(5));
});

test("solitaire: 1-card draw shows one waste card, 3-card draw shows three", () => {
  assert.equal(wasteFanCount(1), 1);
  assert.equal(wasteFanCount(3), 3);
  assert.match(read("../public/solitaire.js"), /wasteFanCount\(drawCount\)/);
});

test("2048: move results describe every sliding tile", () => {
  const board = [2, 0, 2, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const result = moveMergeBoard(board, "left", () => 0.99);
  assert.deepEqual(result.board.slice(0, 4), [4, 4, 0, 0]);
  assert.deepEqual(result.slides, [
    { from: 2, to: 0, value: 2 },
    { from: 3, to: 1, value: 4 },
  ]);
  assert.deepEqual(moveMergeBoard([2, 4, 8, 16, ...Array(12).fill(0)], "left").slides, []);
});

test("omok: double-three and overline are forbidden, exact five always wins", () => {
  let board = emptyOmok();
  for (const [r, c] of [[7, 5], [7, 6], [5, 7], [6, 7]]) board[at(r, c)] = 1;
  assert.deepEqual(omokMoveVerdict(board, at(7, 7), 1), { ok: false, win: false, reason: "double-three" });
  assert.equal(omokMoveVerdict(board, at(7, 7), 2).ok, true, "the other colour is not affected by black threes");

  board = emptyOmok();
  for (const c of [3, 4, 5, 7, 8]) board[at(7, c)] = 1;
  assert.equal(omokMoveVerdict(board, at(7, 6), 1).reason, "overline");

  board = emptyOmok();
  for (const c of [3, 4, 5, 6]) board[at(7, c)] = 1;
  assert.deepEqual(omokMoveVerdict(board, at(7, 7), 1), { ok: true, win: true, reason: "" });

  // 한쪽이 막힌 3 + 열린 3 은 쌍삼이 아니다.
  board = emptyOmok();
  for (const [r, c] of [[7, 5], [7, 6], [5, 7], [6, 7]]) board[at(r, c)] = 1;
  board[at(7, 4)] = 2;
  board[at(7, 8)] = 2;
  assert.equal(omokMoveVerdict(board, at(7, 7), 1).ok, true);

  // AI 는 금수 자리를 고르지 않는다.
  board = emptyOmok();
  for (const [r, c] of [[7, 5], [7, 6], [5, 7], [6, 7]]) board[at(r, c)] = 2;
  for (const level of ["easy", "medium", "hard"]) {
    for (let i = 0; i < 10; i++) {
      assert.equal(omokMoveVerdict(board, chooseOmokAiMove(board, level, 2), 2).ok, true);
    }
  }
});

test("omok: the server rejects a forbidden move and keeps the turn", async () => {
  const { db, sqlite } = makeDb("0009_arcade_and_pvp.sql");
  try {
    const host = randomUUID(), guest = randomUUID();
    const url = "https://pcbang.test/api/pvp";
    let now = 1_800_000_000_000;
    const send = async (token, body) => (await pvpArena(postJson(url, { token, name: "손님", ...body }), db, now += 10));
    const matchId = (await (await send(host, { action: "create", game: "omok" })).json()).match.id;
    await send(guest, { action: "join", matchId });
    const hostMoves = [at(7, 5), at(7, 6), at(5, 7), at(6, 7)];
    const guestMoves = [at(0, 0), at(0, 2), at(0, 4), at(0, 6)];
    for (let i = 0; i < 4; i++) {
      assert.equal((await send(host, { action: "move", matchId, index: hostMoves[i] })).status, 200);
      assert.equal((await send(guest, { action: "move", matchId, index: guestMoves[i] })).status, 200);
    }
    const refused = await send(host, { action: "move", matchId, index: at(7, 7) });
    assert.equal(refused.status, 400);
    const body = await refused.json();
    assert.equal(body.error, "forbidden");
    assert.equal(body.reason, "double-three");
    assert.equal(body.match.turn, "host", "the turn stays with the player");
    assert.equal(body.match.state.board[at(7, 7)], 0);
  } finally {
    sqlite.close();
  }
});

test("knit: the optional column rule only activates column tops and slides spools up", () => {
  assert.equal(createKnitStage(1).rule, "path", "default rule is unchanged");
  const game = createKnitStage(5, { rule: "column" });
  for (let c = 0; c < TRAY_COLS; c++) {
    for (let r = 1; r < TRAY_ROWS; r++) {
      const cell = game.tray[r][c];
      if (cell?.type !== "spool" || cell.pairId) continue;
      assert.equal(isCellReachable(game, r, c), false, `row ${r} must wait for the spools above it`);
    }
  }
  const col = [...Array(TRAY_COLS).keys()].find((c) => !game.tray[0][c].pairId && !game.tray[0][c].ice);
  const below = game.tray[1][col];
  assert.equal(pickKnitCell(game, 0, col).ok, true);
  assert.equal(game.tray[0][col]?.id, below.id, "the spool below slides up to the top");
  assert.equal(game.tray[0][col].mystery, false, "a spool that reaches the top is revealed");
  assert.equal(undoKnit(game), true);
  assert.equal(game.tray[1][col].id, below.id);

  // 두 규칙 모두 도우미만으로 끝까지 풀 수 있다.
  for (const rule of ["path", "column"]) {
    const stage = createKnitStage(3, { rule });
    for (let guard = 0; guard < 400 && !isKnitWon(stage); guard++) {
      while (stepKnitUnravel(stage, 1).length);
      const exposed = new Set();
      for (let c = 0; c < stage.cols; c++) {
        for (let r = stage.rows - 1; r >= 0; r--) {
          if (stage.tapestry[r][c] !== null) { exposed.add(stage.tapestry[r][c]); break; }
        }
      }
      const options = [];
      for (let r = 0; r < TRAY_ROWS; r++) {
        for (let c = 0; c < TRAY_COLS; c++) {
          if (isCellReachable(stage, r, c)) options.push([exposed.has(stage.tray[r][c].color) ? 0 : 1, r, c]);
        }
      }
      options.sort((a, b) => a[0] - b[0]);
      if (!options.some(([, r, c]) => pickKnitCell(stage, r, c).ok)) break;
    }
    assert.equal(isKnitWon(stage), true, `${rule} rule clears stage 3`);
  }
});

test("new public files are in the live smoke list", () => {
  const smoke = read("./smoke-live-game.mjs");
  for (const file of ["omok-rules.mjs", "merge.js", "merge-board.js", "sudoku-board.js"]) {
    assert.ok(smoke.includes(`"${file}"`), `${file} is in the live smoke list`);
  }
});
