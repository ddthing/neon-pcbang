import { makeSudoku, sudokuPeers } from "./sudoku-board.js";

const dialog = document.getElementById("sudoku");
const board = document.getElementById("sudoku-board");
const keypad = document.getElementById("sudoku-keys");
const level = document.getElementById("sudoku-level");
const status = document.getElementById("sudoku-status");
const notesToggle = document.getElementById("sudoku-notes");
const erase = document.getElementById("sudoku-erase");
const arrows = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] };
let givens, values, notes, active, pencil = false, finished = false;

const cells = Array.from({ length: 81 }, (_, index) => {
  const cell = document.createElement("button");
  cell.type = "button";
  cell.className = "sudoku-cell";
  cell.dataset.index = index;
  cell.tabIndex = -1;
  return cell;
});
board.append(...cells);

for (let digit = 1; digit <= 9; digit++) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "walk-button";
  button.textContent = digit;
  button.addEventListener("click", () => enter(digit));
  keypad.append(button);
}

function render() {
  let empty = 0, hasConflict = false;
  for (const [index, cell] of cells.entries()) {
    const number = values[index];
    const conflict = number !== 0 && sudokuPeers[index].some((peer) => values[peer] === number);
    hasConflict ||= conflict;
    if (!number) empty++;
    cell.toggleAttribute("data-given", Boolean(givens[index]));
    cell.toggleAttribute("data-conflict", conflict);
    cell.toggleAttribute("data-related", sudokuPeers[active].includes(index));
    cell.setAttribute("aria-pressed", String(index === active));
    cell.tabIndex = index === active ? 0 : -1;
    const memo = [...notes[index]].sort();
    const label = number ? String(number) + (givens[index] ? ", 고정 숫자" : "") :
      memo.length ? "메모 " + memo.join(", ") : "빈칸";
    cell.setAttribute("aria-label", `${Math.floor(index / 9) + 1}행 ${index % 9 + 1}열, ${label}${conflict ? ", 중복" : ""}`);
    if (!number && memo.length) {
      const grid = document.createElement("span");
      grid.className = "sudoku-pencil";
      grid.setAttribute("aria-hidden", "true");
      for (const digit of memo) {
        const mark = document.createElement("span");
        mark.textContent = digit;
        mark.style.gridArea = `${Math.floor((digit - 1) / 3) + 1} / ${(digit - 1) % 3 + 1}`;
        grid.append(mark);
      }
      cell.replaceChildren(grid);
    } else {
      cell.textContent = number || "";
    }
  }
  if (!empty && !hasConflict && !finished) {
    finished = true;
    window.recordCafeStamp("game");
  }
  status.textContent = finished ? "완성! 모든 구역을 올바르게 채웠어요." :
    hasConflict ? "같은 줄이나 구역에 겹치는 숫자가 있어요." : `남은 칸 ${empty}개`;
  const locked = finished || Boolean(givens[active]);
  for (const key of keypad.children) key.disabled = locked;
  erase.disabled = locked;
  notesToggle.disabled = finished;
  notesToggle.setAttribute("aria-pressed", String(pencil));
}

function start(moveFocus = false) {
  givens = makeSudoku(Number(level.value));
  values = givens.slice();
  notes = cells.map(() => new Set());
  active = values.indexOf(0);
  pencil = finished = false;
  render();
  if (moveFocus) cells[active].focus();
}

function select(index, moveFocus = false) {
  active = index;
  render();
  if (moveFocus) cells[index].focus();
}

function enter(digit) {
  if (finished || givens[active]) return;
  const memo = notes[active];
  if (digit && pencil) {
    if (values[active]) {
      status.textContent = "숫자를 지운 뒤 메모를 적어 주세요.";
      return;
    }
    if (memo.has(digit)) memo.delete(digit);
    else memo.add(digit);
  } else {
    values[active] = digit;
    memo.clear();
  }
  render();
}

board.addEventListener("click", (event) => {
  const cell = event.target.closest(".sudoku-cell");
  if (cell) select(Number(cell.dataset.index));
});
board.addEventListener("keydown", (event) => {
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  const direction = arrows[event.key];
  if (direction) {
    const row = Math.floor(active / 9) + direction[0], col = active % 9 + direction[1];
    if (row >= 0 && row < 9 && col >= 0 && col < 9) select(row * 9 + col, true);
  } else if (/^[1-9]$/.test(event.key)) {
    enter(Number(event.key));
  } else if (event.key === "Backspace" || event.key === "Delete") {
    enter(0);
  } else return;
  event.preventDefault();
});
notesToggle.addEventListener("click", () => {
  pencil = !pencil;
  notesToggle.setAttribute("aria-pressed", String(pencil));
});
erase.addEventListener("click", () => enter(0));
document.getElementById("sudoku-new").addEventListener("click", () => start(true));
new MutationObserver(() => {
  if (dialog.open && !givens) start();
}).observe(dialog, { attributes: true, attributeFilter: ["open"] });
if (dialog.open) start();
