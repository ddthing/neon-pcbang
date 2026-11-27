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

// slides: 화면에서 미끄러지는 모션을 그리기 위한 기록. { from, to, value } (from === to 인 제자리 타일은 넣지 않는다)
function moveLine(board, nextBoard, indices, merged, slides) {
  const sources = indices.filter((index) => board[index] !== 0);
  const tiles = sources.map((index) => board[index]);
  const shifted = [];
  let score = 0;

  for (let index = 0; index < tiles.length; index += 1) {
    const value = tiles[index];
    const to = indices[shifted.length];

    if (value === tiles[index + 1]) {
      const mergedValue = value * 2;
      shifted.push(mergedValue);
      score += mergedValue;
      merged.push(to);
      if (sources[index] !== to) slides.push({ from: sources[index], to, value });
      slides.push({ from: sources[index + 1], to, value });
      index += 1;
    } else {
      shifted.push(value);
      if (sources[index] !== to) slides.push({ from: sources[index], to, value });
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
  const slides = [];
  let score = 0;

  for (let line = 0; line < BOARD_SIZE; line += 1) {
    score += moveLine(board, nextBoard, getLine(direction, line), merged, slides);
  }

  const changed = nextBoard.some((value, index) => value !== board[index]);
  const spawned = changed ? spawnTile(nextBoard, random) : null;

  return { board: nextBoard, changed, score, merged, spawned, slides };
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
