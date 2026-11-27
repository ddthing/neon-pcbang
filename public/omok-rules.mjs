export const OMOK_SIZE = 15;
export const OMOK_DIRECTIONS = [[0, 1], [1, 0], [1, 1], [1, -1]];

function indexAt(row, col) {
  return row >= 0 && row < OMOK_SIZE && col >= 0 && col < OMOK_SIZE ? row * OMOK_SIZE + col : -1;
}

function lineLength(board, index, stone, dr, dc) {
  const row = Math.floor(index / OMOK_SIZE), col = index % OMOK_SIZE;
  let count = 1;
  for (const sign of [-1, 1]) {
    for (let distance = sign; board[indexAt(row + dr * distance, col + dc * distance)] === stone; distance += sign) {
      count++;
    }
  }
  return count;
}

function lineLengths(board, index, stone) {
  return OMOK_DIRECTIONS.map(([dr, dc]) => lineLength(board, index, stone, dr, dc));
}

function hasOpenThree(board, index, stone, dr, dc) {
  const row = Math.floor(index / OMOK_SIZE), col = index % OMOK_SIZE;
  const at = (distance) => indexAt(row + dr * distance, col + dc * distance);

  for (let start = -3; start <= 0; start++) {
    if (board[at(start - 1)] !== 0 || board[at(start + 4)] !== 0) continue;

    // Both ends of the resulting open four must allow an exact five.
    if (board[at(start - 2)] === stone || board[at(start + 5)] === stone) continue;
    const cells = [0, 1, 2, 3].map(offset => at(start + offset));
    const gaps = cells.filter(cell => cell !== index && board[cell] === 0);
    if (gaps.length !== 1 || cells.filter(cell => cell === index || board[cell] === stone).length !== 3) continue;

    const withMove = board.slice();
    withMove[index] = stone;
    const lengths = lineLengths(withMove, gaps[0], stone);
    if (lengths.every(length => length < 5)) return true;
  }
  return false;
}

export function omokForbiddenMove(board, index, stone, restrictWhite = false) {
  if (stone === 2 && !restrictWhite) return null;
  const lengths = lineLengths(board, index, stone);
  if (lengths.some(length => length > 5)) return "overline";
  if (lengths.includes(5)) return null;

  let threes = 0;
  for (const [dr, dc] of OMOK_DIRECTIONS) {
    if (hasOpenThree(board, index, stone, dr, dc) && ++threes === 2) return "double-three";
  }
  return null;
}

export function hasFiveInARow(board, index, stone, restrictWhite = false) {
  const lengths = lineLengths(board, index, stone);
  return stone === 2 && !restrictWhite
    ? lengths.some(length => length >= 5)
    : lengths.includes(5) && lengths.every(length => length <= 5);
}
