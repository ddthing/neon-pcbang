// 작업보드 버그 접수 2건(스도쿠 메모, 솔리테어 1장 뽑기 표시)의 회귀 테스트
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { wasteFanCount } from "../public/solitaire-engine.mjs";
import { clearSudokuPeerNotes, restoreSudokuPeerNotes } from "../public/sudoku-board.js";

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
  const source = readFileSync(new URL("../public/solitaire.js", import.meta.url), "utf8");
  assert.match(source, /wasteFanCount\(drawCount\)/);
});
