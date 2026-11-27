import { makeSudoku, sudokuPeers } from "./sudoku-board.js";
import { mountLeaderboardBox, submitArcadeScore } from "./arcade-leaderboard.js";

export function initSudoku() {
  const dialog = document.getElementById("sudoku");
  const board = document.getElementById("sudoku-board");
  const keypad = document.getElementById("sudoku-keys");
  const level = document.getElementById("sudoku-level");
  const status = document.getElementById("sudoku-status");
  const notesToggle = document.getElementById("sudoku-notes");
  const erase = document.getElementById("sudoku-erase");
  const undoBtn = document.getElementById("sudoku-undo");
  const arrows = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] };
  let givens, values, notes, active, pencil = false, finished = false, startedAt = 0;
  let history = [];

  mountLeaderboardBox(dialog, "sudoku", () => level.value, (s, m) => m || `${s}점`);

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
    button.dataset.digit = String(digit);
    button.innerHTML = `<span class="sudoku-key-num">${digit}</span><small class="sudoku-key-rem">9</small>`;
    button.addEventListener("click", () => enter(digit));
    keypad.append(button);
  }

  function render() {
    let empty = 0, hasConflict = false;
    const activeVal = values[active];
    const digitCounts = new Int8Array(10);

    for (const [index, cell] of cells.entries()) {
      const number = values[index];
      const isGiven = Boolean(givens[index]);
      const isUser = Boolean(!isGiven && number);
      if (number) digitCounts[number]++;
      else empty++;

      const conflict = number !== 0 && sudokuPeers[index].some((peer) => values[peer] === number);
      hasConflict ||= conflict;

      cell.toggleAttribute("data-given", isGiven);
      cell.toggleAttribute("data-user", isUser);
      cell.toggleAttribute("data-conflict", conflict);
      cell.toggleAttribute("data-related", sudokuPeers[active].includes(index));
      cell.toggleAttribute("data-same", Boolean(activeVal && number === activeVal && index !== active));
      cell.setAttribute("aria-pressed", String(index === active));
      cell.tabIndex = index === active ? 0 : -1;

      const memo = [...notes[index]].sort();
      const label = number
        ? `${number}${isGiven ? ", 기존 고정 숫자" : ", 내가 입력한 숫자"}`
        : memo.length ? `메모 ${memo.join(", ")}` : "빈칸";
      cell.setAttribute("aria-label", `${Math.floor(index / 9) + 1}행 ${index % 9 + 1}열, ${label}${conflict ? ", 중복" : ""}`);

      if (!number && memo.length) {
        const noteKey = memo.join(",");
        if (cell.dataset.noteKey !== noteKey) {
          cell.dataset.noteKey = noteKey;
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
        }
      } else {
        delete cell.dataset.noteKey;
        const nextText = number ? String(number) : "";
        if (cell.textContent !== nextText || cell.firstElementChild) {
          cell.textContent = nextText;
        }
      }
    }

    if (!empty && !hasConflict && !finished) {
      finished = true;
      window.cafeAudioPlay?.("chime");
      const sec = Math.max(10, Math.floor((performance.now() - startedAt) / 1000));
      const pts = Math.max(100, (55 - Number(level.value)) * 80 - sec);
      window.cafeEarnPoints?.(35, "스도쿠 퍼즐 완성");
      submitArcadeScore("sudoku", pts, { mode: level.value, metric: `${Math.floor(sec / 60)}분 ${sec % 60}초` });
    }

    status.textContent = finished
      ? "🎉 퍼즐 완성! 모든 구역을 완벽하게 채웠어요."
      : hasConflict
        ? "⚠️ 같은 줄이나 구역에 겹치는 숫자가 있어요."
        : `남은 빈칸 ${empty}개 · 진한 먹색=고정 / 파란색=내 입력`;

    const locked = finished || Boolean(givens[active]);
    for (const key of keypad.children) {
      const d = Number(key.dataset.digit);
      const rem = Math.max(0, 9 - digitCounts[d]);
      const remEl = key.querySelector(".sudoku-key-rem");
      if (remEl) remEl.textContent = rem > 0 ? String(rem) : "✓";
      key.dataset.done = String(rem === 0);
      key.disabled = locked;
    }
    erase.disabled = locked || (!values[active] && notes[active].size === 0);
    if (undoBtn) undoBtn.disabled = finished || history.length === 0;
    notesToggle.disabled = finished;
    notesToggle.setAttribute("aria-pressed", String(pencil));
  }

  function start(moveFocus = false) {
    givens = makeSudoku(Number(level.value));
    values = givens.slice();
    notes = cells.map(() => new Set());
    history = [];
    active = values.indexOf(0);
    pencil = finished = false;
    startedAt = performance.now();
    window.cafeWorld?.setActivity("game:sudoku");
    render();
    if (moveFocus && cells[active]) cells[active].focus();
  }

  function select(index, moveFocus = false) {
    active = index;
    render();
    if (moveFocus) cells[index].focus();
  }

  function enter(digit) {
    if (finished || givens[active]) return;
    window.cafeAudioPlay?.("tick");
    const memo = notes[active];
    const snapNotes = notes.map((s) => new Set(s));

    if (digit && pencil) {
      if (values[active]) {
        status.textContent = "숫자를 지운 뒤 메모를 적어 주세요.";
        return;
      }
      history.push({ index: active, prevVal: values[active], prevNotes: snapNotes });
      if (memo.has(digit)) memo.delete(digit);
      else memo.add(digit);
    } else {
      if (values[active] === digit && memo.size === 0) return;
      history.push({ index: active, prevVal: values[active], prevNotes: snapNotes });
      values[active] = digit;
      memo.clear();
      if (digit) {
        for (const peer of sudokuPeers[active]) notes[peer].delete(digit);
      }
    }
    render();
  }

  function undo() {
    if (finished || !history.length) return;
    const prev = history.pop();
    values[prev.index] = prev.prevVal;
    notes = prev.prevNotes;
    active = prev.index;
    window.cafeAudioPlay?.("tick");
    render();
  }

  board.addEventListener("click", (event) => {
    const cell = event.target.closest(".sudoku-cell");
    if (cell) select(Number(cell.dataset.index));
  });
  board.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
      event.preventDefault();
      undo();
      return;
    }
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
  undoBtn?.addEventListener("click", undo);
  level.addEventListener("change", () => start(true));
  document.getElementById("sudoku-new").addEventListener("click", () => start(true));
  dialog.addEventListener("close", () => window.cafeWorld?.setActivity(""));
  start();
}
