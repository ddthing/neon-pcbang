// Neon Block Drop (Authentic 7-Bag SRS Tetris with Hold, Next 3, Ghost Piece, Combo & Hall Leaderboard)
import { mountLeaderboardBox, submitArcadeScore } from "./arcade-leaderboard.js";
import { showCafeGameResult } from "./cafe-game-result.js";

const COLS = 10;
const ROWS = 20;
const CELL = 22;
const SHAPES = {
  I: { color: "#89c4e1", hi: "#dcf2fc", cells: [[0,1],[1,1],[2,1],[3,1]], size: 4 },
  O: { color: "#f6cf73", hi: "#fff2c2", cells: [[1,0],[2,0],[1,1],[2,1]], size: 4 },
  T: { color: "#c7aeb3", hi: "#f5ebed", cells: [[1,0],[0,1],[1,1],[2,1]], size: 3 },
  S: { color: "#99bc9b", hi: "#d9ebd5", cells: [[1,0],[2,0],[0,1],[1,1]], size: 3 },
  Z: { color: "#e18fa5", hi: "#fcc7d3", cells: [[0,0],[1,0],[1,1],[2,1]], size: 3 },
  J: { color: "#a999cd", hi: "#d8caee", cells: [[0,0],[0,1],[1,1],[2,1]], size: 3 },
  L: { color: "#dc9666", hi: "#fbe3d3", cells: [[2,0],[0,1],[1,1],[2,1]], size: 3 },
};
const TYPES = Object.keys(SHAPES);

export function initTetris() {
  const dialog = document.getElementById("tetris");
  const canvas = document.getElementById("tetris-canvas");
  const holdCanvas = document.getElementById("tetris-hold");
  const nextCanvas = document.getElementById("tetris-next");
  const scoreEl = document.getElementById("tetris-score");
  const bestEl = document.getElementById("tetris-best");
  const linesEl = document.getElementById("tetris-lines");
  const levelEl = document.getElementById("tetris-level");
  const statusEl = document.getElementById("tetris-status");
  const actionBtn = document.getElementById("tetris-action");
  const ctx = canvas.getContext("2d");
  const holdCtx = holdCanvas.getContext("2d");
  const nextCtx = nextCanvas.getContext("2d");
  const bestKey = "neon-pcbang-tetris-best";

  mountLeaderboardBox(dialog, "tetris", () => "standard", (s, m) => `${s.toLocaleString()}점${m ? ` (${m})` : ""}`);

  let best = 0;
  try { best = Number(localStorage.getItem(bestKey)) || 0; } catch {}

  let grid, bag, queue, active, holdType, canHold;
  let score = 0, lines = 0, level = 1, combo = -1;
  let state = "idle"; // idle | playing | paused | over
  let dropTimer = 0, lastTime = 0, raf = 0;
  let flashRows = [], flashTime = 0;

  function refillBag() {
    const next = TYPES.slice();
    for (let i = next.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [next[i], next[j]] = [next[j], next[i]];
    }
    bag.push(...next);
  }

  function pullType() {
    if (bag.length < 4) refillBag();
    return bag.shift();
  }

  function makePiece(type) {
    const def = SHAPES[type];
    return {
      type,
      x: 3,
      y: 0,
      cells: def.cells.map(([x, y]) => [x, y]),
      size: def.size,
    };
  }

  function collides(piece, ox = piece.x, oy = piece.y, cells = piece.cells) {
    for (const [cx, cy] of cells) {
      const nx = ox + cx;
      const ny = oy + cy;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && grid[ny][nx]) return true;
    }
    return false;
  }

  function spawnNext() {
    while (queue.length < 4) queue.push(pullType());
    const type = queue.shift();
    queue.push(pullType());
    active = makePiece(type);
    canHold = true;
    if (collides(active)) {
      finishGame();
    }
    drawSidePanels();
  }

  function rotatePiece(dir = 1) {
    if (!active || active.type === "O") return;
    const N = active.size;
    const rotated = active.cells.map(([x, y]) => dir > 0 ? [N - 1 - y, x] : [y, N - 1 - x]);
    const kicks = [[0, 0], [-1, 0], [1, 0], [0, -1], [-2, 0], [2, 0]];
    for (const [kx, ky] of kicks) {
      if (!collides(active, active.x + kx, active.y + ky, rotated)) {
        active.x += kx;
        active.y += ky;
        active.cells = rotated;
        window.cafeAudioPlay?.("tick");
        return;
      }
    }
  }

  function holdPiece() {
    if (!active || !canHold) return;
    window.cafeAudioPlay?.("tick");
    const currentType = active.type;
    if (!holdType) {
      holdType = currentType;
      spawnNext();
    } else {
      const swap = holdType;
      holdType = currentType;
      active = makePiece(swap);
    }
    canHold = false;
    drawSidePanels();
  }

  function ghostY() {
    if (!active) return 0;
    let gy = active.y;
    while (!collides(active, active.x, gy + 1)) gy++;
    return gy;
  }

  function lockPiece() {
    for (const [cx, cy] of active.cells) {
      const gx = active.x + cx;
      const gy = active.y + cy;
      if (gy >= 0 && gy < ROWS) grid[gy][gx] = active.type;
    }
    const cleared = [];
    for (let r = ROWS - 1; r >= 0; r--) {
      if (grid[r].every(Boolean)) cleared.push(r);
    }
    if (cleared.length) {
      flashRows = cleared.slice();
      flashTime = 0.16;
      for (const r of cleared.sort((a, b) => a - b)) {
        grid.splice(r, 1);
        grid.unshift(new Array(COLS).fill(null));
      }
      combo++;
      const basePts = [0, 100, 300, 500, 800][cleared.length] * level;
      const comboPts = combo > 0 ? combo * 50 * level : 0;
      score += basePts + comboPts;
      lines += cleared.length;
      level = Math.min(15, 1 + Math.floor(lines / 10));
      window.cafeAudioPlay?.(cleared.length === 4 ? "chime" : "pop");
      statusEl.textContent = cleared.length === 4
        ? `⚡ TETRIS!! +${basePts + comboPts}점!`
        : `${cleared.length}줄 클리어!${combo > 0 ? ` (${combo} 콤보!)` : ""}`;
    } else {
      combo = -1;
      window.cafeAudioPlay?.("thud");
    }
    syncHud();
    spawnNext();
  }

  function hardDrop() {
    if (!active || state !== "playing") return;
    const gy = ghostY();
    score += (gy - active.y) * 2;
    active.y = gy;
    lockPiece();
    draw();
  }

  function moveHorizontal(dx) {
    if (!active || state !== "playing") return;
    if (!collides(active, active.x + dx, active.y)) {
      active.x += dx;
      window.cafeAudioPlay?.("tick");
      draw();
    }
  }

  function softDrop() {
    if (!active || state !== "playing") return;
    if (!collides(active, active.x, active.y + 1)) {
      active.y++;
      score += 1;
      dropTimer = 0;
      syncHud();
      draw();
    } else {
      lockPiece();
      draw();
    }
  }

  function syncHud() {
    if (score > best) {
      best = score;
      try { localStorage.setItem(bestKey, String(best)); } catch {}
    }
    scoreEl.textContent = score.toLocaleString();
    bestEl.textContent = best.toLocaleString();
    linesEl.textContent = String(lines);
    levelEl.textContent = String(level);
  }

  function finishGame() {
    state = "over";
    cancelAnimationFrame(raf);
    actionBtn.textContent = "다시 시작";
    const reward = window.cafeRewardGameEnd?.("tetris", score, { label: "테트리스 플레이" });
    const gText = reward ? ` · +${reward.awarded} G${reward.hasBuff ? " (버프)" : ""}` : "";
    statusEl.textContent = `게임 오버! 최종 ${score.toLocaleString()}점 (${lines}줄)${gText}`;
    const record = submitArcadeScore("tetris", score, { metric: `${lines}줄 · Lv.${level}` });
    showCafeGameResult(dialog, { title: "블록 드롭 종료", metric: `${score.toLocaleString()}점 · ${lines}줄`, record: score > 0 ? record : null, action: actionBtn });
  }

  function drawBlock(targetCtx, px, py, size, type, alpha = 1) {
    const def = SHAPES[type];
    targetCtx.globalAlpha = alpha;
    targetCtx.fillStyle = "#5c4742";
    targetCtx.fillRect(px + 1, py + 1, size - 2, size - 2);
    targetCtx.fillStyle = def.color;
    targetCtx.fillRect(px + 2, py + 2, size - 4, size - 4);
    targetCtx.fillStyle = def.hi;
    targetCtx.fillRect(px + 2, py + 2, size - 5, 3);
    targetCtx.fillRect(px + 2, py + 2, 3, size - 5);
    targetCtx.fillStyle = "#5c474244";
    targetCtx.fillRect(px + 2, py + size - 4, size - 4, 2);
    targetCtx.globalAlpha = 1;
  }

  function drawMiniPiece(targetCtx, w, h, type, offsetY = 0) {
    if (!type) return;
    const def = SHAPES[type];
    const s = 13;
    const ox = Math.floor((w - def.size * s) / 2);
    for (const [cx, cy] of def.cells) {
      drawBlock(targetCtx, ox + cx * s, offsetY + 6 + cy * s, s, type);
    }
  }

  function drawSidePanels() {
    holdCtx.fillStyle = "#eee4f5";
    holdCtx.fillRect(0, 0, holdCanvas.width, holdCanvas.height);
    drawMiniPiece(holdCtx, holdCanvas.width, holdCanvas.height, holdType, 4);

    nextCtx.fillStyle = "#eee4f5";
    nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
    queue.slice(0, 3).forEach((t, i) => drawMiniPiece(nextCtx, nextCanvas.width, 46, t, i * 44));
  }

  function draw() {
    ctx.fillStyle = "#eee4f5";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#d0bfd9";
    ctx.lineWidth = 1;
    for (let x = 0; x <= COLS; x++) {
      ctx.beginPath(); ctx.moveTo(x * CELL, 0); ctx.lineTo(x * CELL, ROWS * CELL); ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
      ctx.beginPath(); ctx.moveTo(0, y * CELL); ctx.lineTo(COLS * CELL, y * CELL); ctx.stroke();
    }

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (grid[r][c]) drawBlock(ctx, c * CELL, r * CELL, CELL, grid[r][c]);
      }
    }

    if (active && state !== "over") {
      const gy = ghostY();
      ctx.save();
      ctx.setLineDash([2, 2]);
      for (const [cx, cy] of active.cells) {
        ctx.strokeStyle = "#77558c";
        ctx.strokeRect((active.x + cx) * CELL + 2, (gy + cy) * CELL + 2, CELL - 4, CELL - 4);
      }
      ctx.restore();
      for (const [cx, cy] of active.cells) {
        if (active.y + cy >= 0) drawBlock(ctx, (active.x + cx) * CELL, (active.y + cy) * CELL, CELL, active.type);
      }
    }

    if (flashTime > 0 && flashRows.length) {
      ctx.fillStyle = "#f7efe5aa";
      for (const r of flashRows) ctx.fillRect(0, r * CELL, COLS * CELL, CELL);
    }
  }

  function resetGame() {
    grid = Array.from({ length: ROWS }, () => new Array(COLS).fill(null));
    bag = [];
    queue = [];
    holdType = null;
    canHold = true;
    score = 0;
    lines = 0;
    level = 1;
    combo = -1;
    flashRows = [];
    flashTime = 0;
    syncHud();
    spawnNext();
    draw();
  }

  function stepInterval() {
    return Math.max(0.085, 0.82 - (level - 1) * 0.052);
  }

  function loop(now) {
    if (state !== "playing") return;
    const dt = lastTime ? Math.min(0.05, (now - lastTime) / 1000) : 0;
    lastTime = now;
    if (flashTime > 0) flashTime = Math.max(0, flashTime - dt);
    dropTimer += dt;
    if (dropTimer >= stepInterval()) {
      dropTimer = 0;
      if (!collides(active, active.x, active.y + 1)) {
        active.y++;
      } else {
        lockPiece();
      }
    }
    draw();
    if (state === "playing") raf = requestAnimationFrame(loop);
  }

  function pauseGame() {
    if (state !== "playing") return;
    state = "paused";
    cancelAnimationFrame(raf);
    actionBtn.textContent = "이어하기";
    statusEl.textContent = "일시 정지됨";
  }

  actionBtn.addEventListener("click", () => {
    if (state === "playing") {
      pauseGame();
      return;
    }
    if (state === "idle" || state === "over") resetGame();
    state = "playing";
    lastTime = 0;
    dropTimer = 0;
    actionBtn.textContent = "일시 정지";
    statusEl.textContent = "← → 이동 · ↑ 회전 · Space 하드드롭 · C 홀드";
    window.cafeWorld?.setActivity("game:tetris");
    canvas.focus({ preventScroll: true });
    raf = requestAnimationFrame(loop);
  });

  dialog.addEventListener("keydown", (e) => {
    if (state !== "playing" || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.code === "ArrowLeft") { e.preventDefault(); moveHorizontal(-1); }
    else if (e.code === "ArrowRight") { e.preventDefault(); moveHorizontal(1); }
    else if (e.code === "ArrowDown") { e.preventDefault(); softDrop(); }
    else if (e.code === "ArrowUp" || e.code === "KeyX") { e.preventDefault(); rotatePiece(1); draw(); }
    else if (e.code === "KeyZ") { e.preventDefault(); rotatePiece(-1); draw(); }
    else if (e.code === "Space") { e.preventDefault(); hardDrop(); }
    else if (e.code === "KeyC" || e.code === "ShiftLeft") { e.preventDefault(); holdPiece(); draw(); }
  });

  dialog.querySelectorAll("[data-tetris-cmd]").forEach((btn) => {
    const runCmd = () => {
      if (state !== "playing") return;
      const cmd = btn.dataset.tetrisCmd;
      if (cmd === "left") moveHorizontal(-1);
      else if (cmd === "right") moveHorizontal(1);
      else if (cmd === "rotate") { rotatePiece(1); draw(); }
      else if (cmd === "down") softDrop();
      else if (cmd === "drop") hardDrop();
      else if (cmd === "hold") { holdPiece(); draw(); }
    };
    let touched = false;
    btn.addEventListener("pointerdown", (e) => {
      if (e.pointerType !== "mouse") {
        e.preventDefault();
        touched = true;
        runCmd();
      }
    });
    btn.addEventListener("click", () => {
      if (touched) { touched = false; return; }
      runCmd();
    });
  });

  dialog.addEventListener("close", () => {
    pauseGame();
    window.cafeWorld?.setActivity("");
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden || !dialog.open) pauseGame();
  });

  resetGame();
}
