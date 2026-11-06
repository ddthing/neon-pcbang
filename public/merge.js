/* Lucian UX/UI Prompt #018 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#018 */
/* Lucian UX/UI Prompt #022 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#022 */
/* Lucian UX/UI Prompt #093 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#093 */
import { BOARD_SIZE, createMergeBoard, moveMergeBoard, canMoveMergeBoard } from "./merge-board.js";

const goal = 2048;
const bestKey = "neon-pcbang-merge-best";
const arrowKeys = new Map([
  ["ArrowLeft", "left"], ["ArrowUp", "up"], ["ArrowDown", "down"], ["ArrowRight", "right"],
]);
const burstColors = [
  [0, "#FF4D6D", "#FFB26B"], [51, "#8B6CFF", "#FF7A93"], [103, "#FFB547", "#22C3A6"],
  [154, "#FF4D6D", "#8B6CFF"], [206, "#22C3A6", "#FFB547"], [257, "#FF7A93", "#3D8BFF"], [309, "#3D8BFF", "#FF4D6D"],
];
const confettiColors = ["#22C3A6", "#10B981", "#FFB547", "#FF6B8B", "#7B61FF", "#3D8BFF"];

export function initMerge() {
  const dialog = document.getElementById("merge");
  const board = document.getElementById("merge-board");
  const status = document.getElementById("merge-status");
  const scoreDisplay = document.getElementById("merge-score");
  const bestDisplay = document.getElementById("merge-best");
  const progress = document.getElementById("merge-progress");
  const progressBar = dialog.querySelector(".u093-bar");
  const reset = document.getElementById("merge-reset");
  const controls = [...dialog.querySelectorAll("[data-direction]")];
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const canvas = document.createElement("canvas");
  canvas.className = "u093-cf";
  canvas.setAttribute("aria-hidden", "true");
  canvas.hidden = true;
  board.append(canvas);

  const cells = [];
  for (let row = 0; row < BOARD_SIZE; row++) {
    const line = document.createElement("div");
    line.className = "merge-row";
    line.setAttribute("role", "row");
    for (let col = 0; col < BOARD_SIZE; col++) {
      const tile = document.createElement("div");
      tile.className = "merge-cell";
      tile.setAttribute("role", "cell");
      const number = document.createElement("span");
      number.className = "merge-number";
      tile.append(number);
      line.append(tile);
      cells.push({ tile, number });
    }
    board.append(line);
  }

  const spokenScore = document.createElement("span");
  spokenScore.className = "u018-sr";
  scoreDisplay.replaceChildren(spokenScore);
  const columns = [];
  let best = readBest();
  let values, score, finished, reachedGoal, swipe;
  let confettiFrame = 0;

  // Lucian #018 rolls a strip of ten digits per place value.
  function showScore() {
    const digits = String(score);
    if (spokenScore.textContent === digits && bestDisplay.textContent === String(best)) return;
    spokenScore.textContent = digits;
    for (let place = 0; place < digits.length; place++) {
      if (!columns[place]) {
        const column = document.createElement("span");
        column.className = "u018-col";
        column.setAttribute("aria-hidden", "true");
        for (let value = 0; value < 10; value++) {
          const digit = document.createElement("span");
          digit.textContent = value;
          column.append(digit);
        }
        spokenScore.after(column);
        columns.push(column);
      }
    }
    columns.forEach((column, place) => {
      column.classList.toggle("is-hide", place >= digits.length);
      column.style.transform = `translateY(${-(Number(digits.at(-place - 1)) || 0) * 34}px)`;
    });
    bestDisplay.textContent = String(best);
  }

  function paint() {
    cells.forEach(({ tile, number }, index) => {
      const value = values[index];
      if (tile.dataset.value === String(value)) return;
      tile.querySelector(".u022")?.remove();
      number.getAnimations().forEach((animation) => animation.cancel());
      tile.dataset.value = value;
      number.textContent = value || "";
      tile.setAttribute("aria-label", value ? String(value) : "빈 칸");
    });
    const highest = Math.max(...values);
    progress.textContent = `${Math.min(highest, goal)} / ${goal}`;
    progressBar.style.setProperty("--p", Math.min(highest / goal, 1));
    showScore();
    controls.forEach((button) => { button.disabled = finished; });
  }

  // Lucian #022 uses the same ring and paired dots for each merged tile.
  function burst(tile) {
    const effect = document.createElement("span");
    effect.className = "u022 is-pop";
    effect.setAttribute("aria-hidden", "true");
    const ring = document.createElement("span");
    ring.className = "u022-ring";
    effect.append(ring);
    burstColors.forEach(([angle, first, second]) => {
      const dots = document.createElement("span");
      dots.className = "u022-dot";
      dots.style.setProperty("--a", angle + "deg");
      dots.style.setProperty("--c", first);
      dots.style.setProperty("--c2", second);
      dots.append(document.createElement("i"), document.createElement("i"));
      effect.append(dots);
    });
    effect.addEventListener("animationend", (event) => {
      if (event.animationName === "u022-fly2") effect.remove();
    });
    tile.append(effect);
  }

  function stopConfetti() {
    cancelAnimationFrame(confettiFrame);
    confettiFrame = 0;
    canvas.hidden = true;
  }

  // Lucian #093 starts the confetti loop once, when the target is reached.
  function celebrate() {
    if (motion.matches || document.hidden) return;
    const dpr = Math.min(2, devicePixelRatio || 1);
    const width = board.offsetWidth;
    const height = board.offsetHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.hidden = false;
    const pieces = Array.from({ length: 90 }, (_, index) => {
      const angle = -Math.PI / 2 + (Math.random() - .5) * 1.9;
      const speed = 380 + Math.random() * 420;
      return {
        x: width / 2 + (Math.random() - .5) * 40, y: 180,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        r: Math.random() * 6, vr: (Math.random() - .5) * 14,
        w: 5 + Math.random() * 5, h: 8 + Math.random() * 6,
        color: confettiColors[index % confettiColors.length], time: 0, life: 1.6 + Math.random() * .9,
      };
    });
    let last = performance.now();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    function draw(now) {
      const dt = Math.min(.033, (now - last) / 1000);
      last = now;
      let alive = 0;
      ctx.clearRect(0, 0, width, height);
      for (const piece of pieces) {
        piece.time += dt;
        if (piece.time > piece.life || piece.y > height + 20) continue;
        alive++;
        piece.vy += 900 * dt;
        piece.vx *= .985;
        piece.vy *= .985;
        piece.x += piece.vx * dt;
        piece.y += piece.vy * dt;
        piece.r += piece.vr * dt;
        ctx.save();
        ctx.translate(piece.x, piece.y);
        ctx.rotate(piece.r);
        ctx.globalAlpha = Math.min(1, (piece.life - piece.time) / .4);
        ctx.scale(1, Math.cos(piece.time * 9 + piece.w));
        ctx.fillStyle = piece.color;
        ctx.fillRect(-piece.w / 2, -piece.h / 2, piece.w, piece.h);
        ctx.restore();
      }
      if (alive) confettiFrame = requestAnimationFrame(draw);
      else stopConfetti();
    }
    confettiFrame = requestAnimationFrame(draw);
  }

  function start() {
    stopConfetti();
    board.querySelectorAll(".u022").forEach((effect) => effect.remove());
    values = createMergeBoard();
    score = 0;
    reachedGoal = finished = false;
    status.textContent = "타일을 한쪽으로 밀어 보세요.";
    paint();
  }

  function move(direction) {
    if (finished) return;
    const result = moveMergeBoard(values, direction);
    if (!result.changed) {
      status.textContent = "이쪽으로는 움직일 수 없어요.";
      return;
    }
    values = result.board;
    score += result.score;
    if (score > best) {
      const saved = readBest();
      best = Math.max(saved, score);
      if (best > saved) {
        try { localStorage.setItem(bestKey, String(best)); } catch {}
      }
    }
    const won = !reachedGoal && values.some((value) => value >= goal);
    finished = !canMoveMergeBoard(values);
    const directionFocused = controls.includes(document.activeElement);
    paint();
    if (!motion.matches) {
      for (const index of result.merged) {
        const { tile, number } = cells[index];
        tile.querySelector(".u022")?.remove();
        number.getAnimations().forEach((animation) => animation.cancel());
        number.animate([
          { transform: "scale(1)", offset: 0 }, { transform: "scale(.72)", offset: .18 },
          { transform: "scale(1.24)", offset: .48 }, { transform: "scale(.94)", offset: .7 },
          { transform: "scale(1)", offset: 1 },
        ], { duration: 700, easing: "cubic-bezier(.2,.8,.2,1)" });
        burst(tile);
      }
      if (result.spawned !== null) {
        cells[result.spawned].number.animate(
          [{ opacity: 0, transform: "scale(.75)" }, { opacity: 1, transform: "none" }],
          { duration: 180, easing: "ease-out" },
        );
      }
    }
    if (won) {
      reachedGoal = true;
      celebrate();
    }
    if (won || finished) window.recordCafeStamp("game");
    if (finished && directionFocused) reset.focus();
    status.textContent = won
      ? (finished ? "2048 달성! 더 움직일 수 없어요." : "2048 달성! 더 큰 타일에도 도전해 보세요.")
      : finished ? "더 움직일 수 없어요. 새 게임으로 다시 도전해 보세요."
        : result.score ? `타일을 합쳤어요. +${result.score}점` : "타일을 밀었어요.";
  }

  dialog.addEventListener("keydown", (event) => {
    const direction = arrowKeys.get(event.key);
    if (!direction || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    event.preventDefault();
    move(direction);
  });
  controls.forEach((button) => button.addEventListener("click", () => move(button.dataset.direction)));
  board.addEventListener("pointerdown", (event) => {
    if (!event.isPrimary || event.button !== 0) return;
    swipe = { id: event.pointerId, x: event.clientX, y: event.clientY };
    board.setPointerCapture(event.pointerId);
  });
  board.addEventListener("pointerup", (event) => {
    if (swipe?.id !== event.pointerId) return;
    const dx = event.clientX - swipe.x;
    const dy = event.clientY - swipe.y;
    swipe = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    move(Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up"));
  });
  board.addEventListener("lostpointercapture", (event) => {
    if (swipe?.id === event.pointerId) swipe = null;
  });
  reset.addEventListener("click", () => {
    start();
    board.focus({ preventScroll: true });
  });
  dialog.addEventListener("close", () => {
    swipe = null;
    stopConfetti();
  });
  motion.addEventListener("change", () => {
    if (!motion.matches) return;
    stopConfetti();
    cells.forEach(({ number }) => number.getAnimations().forEach((animation) => animation.cancel()));
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopConfetti();
  });
  start();
  reset.disabled = false;
}

function readBest() {
  try {
    const saved = Number(localStorage.getItem(bestKey));
    if (Number.isSafeInteger(saved) && saved > 0) return saved;
  } catch {}
  return 0;
}
