const positions = Array.from({ length: 81 }, (_, index) => index);
const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const group = [0, 1, 2];
const allDigits = 0b1111111110;
const row = (index) => Math.floor(index / 9);
const col = (index) => index % 9;
const box = (index) => Math.floor(row(index) / 3) * 3 + Math.floor(col(index) / 3);
export const sudokuPeers = positions.map((index) => positions.filter((other) => other !== index &&
  (row(other) === row(index) || col(other) === col(index) || box(other) === box(index))));

// 숫자를 실제로 입력했을 때 같은 줄·칸·구역(피어)의 메모에서 그 숫자를 정리한다.
// 이미 피어에 같은 숫자가 있는 "중복 입력"이면 메모를 건드리지 않는다(오입력 한 번에 메모가 사라지지 않게).
// 지워진 칸 목록을 돌려주므로, 그 숫자를 지우거나 바꿀 때 restoreSudokuPeerNotes로 되살릴 수 있다.
export function clearSudokuPeerNotes(values, notes, index, digit) {
  if (!digit || sudokuPeers[index].some((peer) => values[peer] === digit)) return [];
  const cleared = [];
  for (const peer of sudokuPeers[index]) {
    if (notes[peer].delete(digit)) cleared.push(peer);
  }
  return cleared;
}

export function restoreSudokuPeerNotes(values, notes, cleared, digit) {
  if (!digit || !cleared) return;
  for (const peer of cleared) {
    // 그 사이 숫자가 채워졌거나, 다른 확정 숫자 때문에 더는 후보가 아닌 칸은 되살리지 않는다.
    if (values[peer] || sudokuPeers[peer].some((other) => values[other] === digit)) continue;
    notes[peer].add(digit);
  }
}

function shuffle(values) {
  const copy = [...values];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function countSudokuSolutions(puzzle) {
  const board = puzzle.slice();
  const rows = Array(9).fill(0), cols = Array(9).fill(0), boxes = Array(9).fill(0);
  for (const index of positions) {
    if (!board[index]) continue;
    const bit = 1 << board[index];
    if ((rows[row(index)] | cols[col(index)] | boxes[box(index)]) & bit) return 0;
    rows[row(index)] |= bit;
    cols[col(index)] |= bit;
    boxes[box(index)] |= bit;
  }

  // Try the most constrained empty square first and stop after finding two solutions.
  function solve() {
    let next = -1, options = 0, best = 10;
    for (const index of positions) {
      if (board[index]) continue;
      const available = allDigits & ~(rows[row(index)] | cols[col(index)] | boxes[box(index)]);
      if (!available) return 0;
      let count = 0;
      for (let bits = available; bits; bits &= bits - 1) count++;
      if (count < best) {
        next = index;
        options = available;
        best = count;
        if (count === 1) break;
      }
    }
    if (next === -1) return 1;
    const r = row(next), c = col(next), b = box(next);
    let total = 0;
    for (let bits = options; bits && total < 2; bits &= bits - 1) {
      const bit = bits & -bits;
      board[next] = 31 - Math.clz32(bit);
      rows[r] |= bit;
      cols[c] |= bit;
      boxes[b] |= bit;
      total += solve();
      rows[r] ^= bit;
      cols[c] ^= bit;
      boxes[b] ^= bit;
    }
    board[next] = 0;
    return Math.min(total, 2);
  }
  return solve();
}

export function makeSudoku(clues) {
  const order = () => shuffle(group).flatMap((band) => shuffle(group).map((index) => band * 3 + index));
  const rows = order(), cols = order(), numbers = shuffle(digits);
  const board = positions.map((index) => {
    const r = rows[row(index)];
    return numbers[(r * 3 + Math.floor(r / 3) + cols[col(index)]) % 9];
  });
  let remaining = board.length;
  for (const index of shuffle(positions)) {
    if (remaining <= clues) break;
    const digit = board[index];
    board[index] = 0;
    if (countSudokuSolutions(board) === 1) remaining--;
    else board[index] = digit;
  }
  return board;
}
