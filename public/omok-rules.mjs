export const OMOK_SIZE = 15;
export const OMOK_DIRECTIONS = [[0, 1], [1, 0], [1, 1], [1, -1]];
export const OMOK_RESTRICTED_STONES = Object.freeze([1]);

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

/**
 * Check Omok move legality and win outcome under optional stone restriction list.
 * Default restricts black only (`OMOK_RESTRICTED_STONES = [1]`); white restriction is optional.
 */
export function omokMoveVerdict(board, index, stone, restricted = OMOK_RESTRICTED_STONES) {
  if (!Number.isInteger(index) || index < 0 || index >= OMOK_SIZE * OMOK_SIZE || board[index] !== 0) {
    return { ok: false, win: false, reason: "occupied" };
  }
  const limited = restricted.includes(stone);
  const lengths = lineLengths(board, index, stone);
  if (lengths.includes(5) && (!limited || lengths.every((len) => len <= 5))) {
    return { ok: true, win: true, reason: "" };
  }
  if (lengths.some((len) => len > 5)) {
    return limited ? { ok: false, win: false, reason: "overline" } : { ok: true, win: true, reason: "" };
  }
  if (limited) {
    let threes = 0;
    for (const [dr, dc] of OMOK_DIRECTIONS) {
      if (hasOpenThree(board, index, stone, dr, dc) && ++threes === 2) {
        return { ok: false, win: false, reason: "double-three" };
      }
    }
  }
  return { ok: true, win: false, reason: "" };
}

export function omokForbiddenMessage(reason) {
  if (reason === "double-three") return "쌍삼(3-3) 자리라 둘 수 없어요. 다른 곳에 두세요.";
  if (reason === "overline") return "육목(6개 이상)이 되는 자리라 둘 수 없어요.";
  return "둘 수 없는 자리예요.";
}
