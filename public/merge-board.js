export const BOARD_SIZE = 4;

const CELL_COUNT = BOARD_SIZE * BOARD_SIZE;
const DIRECTIONS = new Set(["left", "right", "up", "down"]);

function spawnTile(board, random) {
  const emptyCells = [];

  board.forEach((value, index) => {
    if (value === 0) emptyCells.push(index);
  });

  if (emptyCells.length === 0) return null;

  const randomIndex = Math.min(Math.floor(random() * emptyCells.length), emptyCells.length - 1);
  const index = emptyCells[randomIndex];
  board[index] = random() < 0.9 ? 2 : 4;
  return index;
}

export function createMergeBoard(random = Math.random) {
  const board = Array(CELL_COUNT).fill(0);
  spawnTile(board, random);
  spawnTile(board, random);
  return board;
}

function getLine(direction, line) {
  return Array.from({ length: BOARD_SIZE }, (_, offset) => {
    switch (direction) {
      case "left":
        return line * BOARD_SIZE + offset;
      case "right":
        return line * BOARD_SIZE + BOARD_SIZE - 1 - offset;
      case "up":
        return offset * BOARD_SIZE + line;
      case "down":
        return (BOARD_SIZE - 1 - offset) * BOARD_SIZE + line;
    }
  });
}

function moveLine(board, nextBoard, indices, merged) {
  const tiles = indices.map((index) => board[index]).filter((value) => value !== 0);
  const shifted = [];
  let score = 0;

  for (let index = 0; index < tiles.length; index += 1) {
    const value = tiles[index];

    if (value === tiles[index + 1]) {
      const mergedValue = value * 2;
      shifted.push(mergedValue);
      score += mergedValue;
      merged.push(indices[shifted.length - 1]);
      index += 1;
    } else {
      shifted.push(value);
    }
  }

  indices.forEach((boardIndex, offset) => {
    nextBoard[boardIndex] = shifted[offset] ?? 0;
  });

  return score;
}

export function moveMergeBoard(board, direction, random = Math.random) {
  if (!Array.isArray(board) || board.length !== CELL_COUNT) {
    throw new TypeError(`The merge board must contain exactly ${CELL_COUNT} cells.`);
  }
  if (!DIRECTIONS.has(direction)) {
    throw new TypeError(`Unknown merge direction: ${direction}`);
  }

  const nextBoard = Array(CELL_COUNT).fill(0);
  const merged = [];
  let score = 0;

  for (let line = 0; line < BOARD_SIZE; line += 1) {
    score += moveLine(board, nextBoard, getLine(direction, line), merged);
  }

  const changed = nextBoard.some((value, index) => value !== board[index]);
  const spawned = changed ? spawnTile(nextBoard, random) : null;

  return { board: nextBoard, changed, score, merged, spawned };
}

export function canMoveMergeBoard(board) {
  if (!Array.isArray(board) || board.length !== CELL_COUNT) return false;

  for (let index = 0; index < CELL_COUNT; index += 1) {
    const value = board[index];
    if (value === 0) return true;

    const column = index % BOARD_SIZE;
    const row = Math.floor(index / BOARD_SIZE);
    if (column < BOARD_SIZE - 1 && value === board[index + 1]) return true;
    if (row < BOARD_SIZE - 1 && value === board[index + BOARD_SIZE]) return true;
  }

  return false;
}
