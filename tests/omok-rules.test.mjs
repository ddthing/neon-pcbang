import assert from "node:assert/strict";
import test from "node:test";
import { hasFiveInARow, omokForbiddenMove } from "../public/omok-rules.mjs";
import { chooseOmokAiMove } from "../public/pvp-ai.mjs";

const at = (x, y) => 15 * y + x;

function makeBoard(stone, points) {
  const board = Array(225).fill(0);
  for (const [x, y] of points) board[at(x, y)] = stone;
  return board;
}

test("black may not form two open threes while white is unrestricted by default", () => {
  const points = [[6, 7], [8, 7], [7, 6], [7, 9]];
  const index = at(7, 7);
  const black = makeBoard(1, points);
  const white = makeBoard(2, points);
  assert.equal(omokForbiddenMove(black, index, 1), "double-three");
  assert.equal(omokForbiddenMove(white, index, 2), null);
  assert.equal(omokForbiddenMove(white, index, 2, true), "double-three");
  assert.equal(black[index], 0);

  // An opponent's stone closes the vertical three.
  black[at(7, 5)] = 2;
  assert.equal(omokForbiddenMove(black, index, 1), null);
});

test("restricted colors need an exact five and unrestricted white can win with six", () => {
  const points = [[4, 7], [5, 7], [6, 7], [8, 7], [9, 7]];
  const index = at(7, 7);
  const black = makeBoard(1, points);
  const white = makeBoard(2, points);
  assert.equal(omokForbiddenMove(black, index, 1), "overline");
  assert.equal(omokForbiddenMove(white, index, 2, true), "overline");
  assert.equal(hasFiveInARow(black, index, 1), false);
  assert.equal(hasFiveInARow(white, index, 2), true);
  assert.equal(hasFiveInARow(white, index, 2, true), false);
  assert.equal(chooseOmokAiMove(white, "hard", 2), index);
  assert.notEqual(chooseOmokAiMove(white, "hard", 2, true), index);

  black[at(9, 7)] = 0;
  assert.equal(omokForbiddenMove(black, index, 1), null);
  assert.equal(hasFiveInARow(black, index, 1), true);
});
