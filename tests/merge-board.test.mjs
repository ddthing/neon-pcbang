import assert from "node:assert/strict";
import test from "node:test";

import {
  canMoveMergeBoard,
  createMergeBoard,
  moveMergeBoard,
} from "../public/merge-board.js";

function fixedRandom(value = 0) {
  return () => value;
}

function spawnLastTileAsTwo() {
  let calls = 0;
  return () => {
    calls += 1;
    return calls % 2 === 1 ? 0.999 : 0;
  };
}

test("new boards spawn two tiles without changing any other cell", () => {
  const board = createMergeBoard(fixedRandom());

  assert.equal(board.length, 16);
  assert.equal(board.filter(Boolean).length, 2);
  assert.ok(board.every((value) => value === 0 || value === 2));
});

test("a high spawn roll creates a four tile", () => {
  let calls = 0;
  const board = createMergeBoard(() => {
    calls += 1;
    return calls === 2 ? 0.95 : 0;
  });

  assert.equal(board.filter((value) => value === 4).length, 1);
  assert.equal(board.filter((value) => value === 2).length, 1);
});

test("left moves compact tiles, merge each pair once, and report the score", () => {
  const board = [2, 2, 2, 2, 4, 0, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const result = moveMergeBoard(board, "left", spawnLastTileAsTwo());

  assert.deepEqual(result.board.slice(0, 4), [4, 4, 0, 0]);
  assert.deepEqual(result.board.slice(4, 8), [8, 0, 0, 0]);
  assert.equal(result.score, 16);
  assert.deepEqual(result.merged, [0, 1, 4]);
  assert.equal(result.spawned, 15);
  assert.equal(result.changed, true);
  assert.deepEqual(board, [2, 2, 2, 2, 4, 0, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
});

test("each directional move merges toward the leading edge", () => {
  const leftBoard = Array(16).fill(0);
  leftBoard[12] = 2;
  leftBoard[13] = 2;

  const rightBoard = Array(16).fill(0);
  rightBoard[12] = 2;
  rightBoard[14] = 2;

  const upBoard = Array(16).fill(0);
  upBoard[4] = 4;
  upBoard[8] = 4;

  const downBoard = Array(16).fill(0);
  downBoard[1] = 4;
  downBoard[9] = 4;

  assert.equal(moveMergeBoard(leftBoard, "left").board[12], 4);
  assert.equal(moveMergeBoard(rightBoard, "right").board[15], 4);
  assert.equal(moveMergeBoard(upBoard, "up").board[0], 8);
  assert.equal(moveMergeBoard(downBoard, "down").board[13], 8);
});

test("unchanged moves neither spawn a tile nor award points", () => {
  const board = [2, 4, 8, 16, 4, 8, 16, 2, 8, 16, 2, 4, 16, 2, 4, 8];
  const result = moveMergeBoard(board, "left", () => {
    assert.fail("an unchanged move must not request random values");
  });

  assert.deepEqual(result.board, board);
  assert.equal(result.changed, false);
  assert.equal(result.score, 0);
  assert.deepEqual(result.merged, []);
  assert.equal(result.spawned, null);
});

test("a full board that contains an adjacent pair is still movable", () => {
  assert.equal(canMoveMergeBoard([2, 2, 4, 8, 16, 32, 64, 128, 2, 4, 8, 16, 32, 64, 128, 256]), true);
});

test("a full board without equal neighbors is game over", () => {
  assert.equal(canMoveMergeBoard([2, 4, 8, 16, 32, 64, 128, 256, 4, 8, 16, 32, 64, 128, 256, 2]), false);
});

test("random values at the upper boundary still spawn inside the board", () => {
  const board = createMergeBoard(() => 1);

  assert.equal(board.filter((value) => value === 4).length, 2);
  assert.equal(board.filter(Boolean).length, 2);
});
