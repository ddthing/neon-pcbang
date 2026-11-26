import {
  DOCK_MAX_SLOTS,
  KNIT_PATTERNS,
  KNIT_STAGE_COUNT,
  TRAY_COLS,
  TRAY_ROWS,
  YARN_PALETTE,
  createKnitStage,
  findKnitHint,
  isCellReachable,
  isKnitStuck,
  isKnitWon,
  pickKnitCell,
  stepKnitUnravel,
  undoKnit,
  useKnitBooster,
} from "./knit-unravel-engine.mjs";
import { mountLeaderboardBox, submitArcadeScore } from "./arcade-leaderboard.js";

export function initKnitUnravel() {
  const dialog = document.getElementById("knit");
  const loomCanvas = document.getElementById("knit-loom");
  const dockEl = document.getElementById("knit-dock");
  const trayEl = document.getElementById("knit-tray");
  const selectEl = document.getElementById("knit-select");
  const spoolsEl = document.getElementById("knit-spools");
  const scoreEl = document.getElementById("knit-score");
  const progressFillEl = document.getElementById("knit-progress-fill");
  const statusEl = document.getElementById("knit-status");
  const undoBtn = document.getElementById("knit-undo");
  const hintBtn = document.getElementById("knit-hint");
  const resetBtn = document.getElementById("knit-reset");
  const slotBoostBtn = document.getElementById("knit-boost-slot");
  const gloveBoostBtn = document.getElementById("knit-boost-glove");
  const scissorsBoostBtn = document.getElementById("knit-boost-scissors");
  const slotCountEl = document.getElementById("knit-count-slot");
  const gloveCountEl = document.getElementById("knit-count-glove");
  const scissorsCountEl = document.getElementById("knit-count-scissors");

  const lctx = loomCanvas.getContext("2d");
  lctx.imageSmoothingEnabled = false;

  mountLeaderboardBox(dialog, "knit", () => `stage${currentStage}`, (s, m) => m || `${s}점`);

  for (let i = 1; i <= KNIT_STAGE_COUNT; i++) {
    const opt = document.createElement("option");
    opt.value = String(i);
    opt.textContent = `${i}단계 · ${KNIT_PATTERNS[i - 1].name}`;
    selectEl.append(opt);
  }

  let currentStage = 1;
  let game = createKnitStage(1);
  let hintCell = null;
  let wonHandled = false;
  let lastPullAt = 0;
  let rafId = 0;

  function drawLoom() {
    const W = loomCanvas.width;
    const H = loomCanvas.height;
    lctx.clearRect(0, 0, W, H);

    // Subtle soft lilac-cream knitted frame backing
    lctx.fillStyle = "#2b2434";
    lctx.fillRect(0, 0, W, H);
    lctx.fillStyle = "#362d42";
    lctx.fillRect(4, 4, W - 8, H - 8);

    // Wooden loom side posts & bottom beam
    const frameX = 16;
    const frameY = 10;
    const frameW = W - 32;
    const frameH = H - 28;
    // Left / Right wooden posts
    for (const wx of [frameX - 7, frameX + frameW]) {
      lctx.fillStyle = "#261c29";
      lctx.fillRect(wx, frameY - 2, 7, frameH + 8);
      lctx.fillStyle = "#a86c5e";
      lctx.fillRect(wx + 1, frameY, 5, frameH + 5);
      lctx.fillStyle = "#dfb08f";
      lctx.fillRect(wx + 1, frameY, 2, frameH + 4);
    }
    // Bottom crossbar
    lctx.fillStyle = "#261c29";
    lctx.fillRect(frameX - 7, frameY + frameH, frameW + 14, 8);
    lctx.fillStyle = "#85524f";
    lctx.fillRect(frameX - 6, frameY + frameH + 1, frameW + 12, 6);
    lctx.fillStyle = "#c48870";
    lctx.fillRect(frameX - 5, frameY + frameH + 1, frameW + 10, 2);

    // Dark canvas backing inside the wooden frame
    lctx.fillStyle = "#1c1722";
    lctx.fillRect(frameX, frameY, frameW, frameH);

    // Pixel V-stitch knit cells
    const cellW = Math.floor((frameW - 8) / game.cols);
    const cellH = Math.floor((frameH - 6) / game.rows);
    const padX = frameX + Math.floor((frameW - cellW * game.cols) / 2);
    const padY = frameY + 3;

    for (let r = 0; r < game.rows; r++) {
      for (let c = 0; c < game.cols; c++) {
        const cid = game.tapestry[r][c];
        if (!cid) continue;
        const pal = YARN_PALETTE[cid];
        if (!pal) continue;
        const x = padX + c * cellW;
        const y = padY + r * cellH;
        // Shadow trough
        lctx.fillStyle = pal.sh;
        lctx.fillRect(x, y, cellW, cellH - 1);
        // Knitted V left & right arms
        const arm = Math.max(2, Math.floor(cellW * 0.42));
        lctx.fillStyle = pal.fill;
        lctx.fillRect(x + 1, y + 1, arm, cellH - 3);
        lctx.fillRect(x + cellW - 1 - arm, y + 1, arm, cellH - 3);
        // Highlight tip
        lctx.fillStyle = pal.hi;
        lctx.fillRect(x + 1, y + 1, Math.max(1, arm - 1), Math.max(2, Math.floor(cellH * 0.35)));
      }
    }

    // Active unraveling threads stretching cleanly from stitches down to active dock slots
    if (game.activeThreads?.length) {
      const dockStep = W / Math.max(1, game.dockCapacity);
      for (const link of game.activeThreads) {
        const pal = YARN_PALETTE[link.color];
        if (!pal) continue;
        const sx = padX + link.col * cellW + Math.floor(cellW / 2);
        const sy = padY + link.row * cellH + cellH;
        const dx = Math.round(dockStep * (link.dockIndex + 0.5));
        const dy = H;
        lctx.fillStyle = pal.hi;
        const steps = 18;
        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          const px = Math.round(sx + (dx - sx) * t);
          const py = Math.round(sy + (dy - sy) * t + Math.sin(t * Math.PI) * 5);
          lctx.fillRect(px, py, 2, 2);
        }
      }
    }
  }

  function renderDock() {
    const slots = [];
    for (let i = 0; i < game.dockCapacity; i++) {
      const slot = game.dock[i];
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "knit-dock-slot" + (slot ? " filled" : "");
      if (slot) {
        const pal = YARN_PALETTE[slot.color];
        btn.setAttribute("aria-label", `${pal.name} 실타래 남은 코 ${slot.remaining}개`);
        const spool = document.createElement("span");
        spool.className = "knit-dock-spool";
        spool.style.background = pal.fill;
        const num = document.createElement("span");
        num.className = "knit-dock-rem";
        num.textContent = String(slot.remaining);
        btn.append(spool, num);
        btn.addEventListener("click", () => {
          if (game.armedBooster === "scissors") {
            const res = useKnitBooster(game, "scissors", { dockIndex: i });
            if (res.ok) {
              window.cafeAudioPlay?.("pop");
              statusEl.textContent = "가위로 도크 실타래 1개를 시원하게 정리했어요!";
              renderAll();
            }
          }
        });
      } else {
        btn.disabled = true;
        btn.textContent = "";
      }
      slots.push(btn);
    }

    if (game.dockCapacity < DOCK_MAX_SLOTS) {
      const addSlot = document.createElement("button");
      addSlot.type = "button";
      addSlot.className = "knit-dock-slot locked";
      addSlot.textContent = "+1";
      addSlot.title = "슬롯 추가 (+1)";
      addSlot.disabled = (game.boosters.slot || 0) <= 0;
      addSlot.addEventListener("click", () => {
        if (useKnitBooster(game, "slot").ok) {
          window.cafeAudioPlay?.("pop");
          statusEl.textContent = "상단 실타래 도크가 1칸 넓어졌어요!";
          renderAll();
        }
      });
      slots.push(addSlot);
    }
    dockEl.replaceChildren(...slots);
  }

  function renderTray() {
    const frag = [];
    for (let r = 0; r < TRAY_ROWS; r++) {
      for (let c = 0; c < TRAY_COLS; c++) {
        const cell = game.tray[r][c];
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "knit-cell";

        if (!cell) {
          btn.disabled = true;
          btn.setAttribute("aria-hidden", "true");
        } else if (cell.type === "dispenser") {
          btn.classList.add("dispenser");
          btn.disabled = true;
          btn.textContent = `${cell.queue.length}`;
          btn.setAttribute("aria-label", `남은 실패 배출구 ${cell.queue.length}개`);
        } else {
          const pal = YARN_PALETTE[cell.color];
          const reach = isCellReachable(game, r, c);
          const canGlove = game.armedBooster === "glove";
          btn.classList.add("spool", reach || canGlove ? "reachable" : "blocked");
          if (cell.mystery) btn.classList.add("mystery");
          if (cell.ice > 0) btn.classList.add("frozen");
          if (cell.pairId) btn.classList.add("paired");
          btn.style.background = cell.mystery ? "#6b6375" : pal.fill;
          btn.style.color = !cell.mystery && (cell.color === "w" || cell.color === "y" || cell.color === "l")
            ? "#261c29"
            : "#fff9f2";
          btn.dataset.hint = String(Boolean(hintCell && hintCell.r === r && hintCell.c === c));

          if (cell.ice > 0) {
            btn.textContent = `❄${cell.ice}`;
          } else if (cell.mystery) {
            btn.textContent = "?";
          } else {
            btn.textContent = String(cell.remaining);
          }

          btn.setAttribute(
            "aria-label",
            `${cell.mystery ? "미스터리" : pal.name} 실타래 (${cell.remaining}코)${reach ? ", 이동 가능" : ", 막혀 있음"}`
          );

          btn.addEventListener("click", () => {
            hintCell = null;
            if (game.armedBooster === "glove") {
              const gRes = useKnitBooster(game, "glove", { r, c });
              if (gRes.ok) {
                window.cafeAudioPlay?.("pop");
                statusEl.textContent = "만능 손으로 막혀 있던 실타래를 바로 꺼냈어요!";
                renderAll();
              } else {
                statusEl.textContent = "위쪽 도크에 빈칸이 부족해요!";
              }
              return;
            }

            const res = pickKnitCell(game, r, c);
            if (!res.ok) {
              window.cafeAudioPlay?.("tick");
              if (res.reason === "frozen") statusEl.textContent = "얼음 실타래예요! 주변 실을 빼서 얼음을 녹이세요.";
              else if (res.reason === "dock_full") statusEl.textContent = "위쪽 실타래 도크가 꽉 찼어요! 가위나 +1 슬롯을 써보세요.";
              else statusEl.textContent = "위쪽 출구 행까지 빈 칸 길이 열려 있어야 꺼낼 수 있어요!";
              renderAll();
              return;
            }
            window.cafeAudioPlay?.("pop");
            renderAll();
          });
        }
        frag.push(btn);
      }
    }
    trayEl.replaceChildren(...frag);
  }

  function renderAll() {
    const doneRatio = game.totalStitches
      ? Math.round(((game.totalStitches - game.remainingStitches) / game.totalStitches) * 100)
      : 100;
    spoolsEl.textContent = `${game.completedSpools} / ${game.totalSpools}`;
    scoreEl.textContent = game.score.toLocaleString();
    progressFillEl.style.width = `${doneRatio}%`;
    selectEl.value = String(game.stage);
    undoBtn.disabled = !game.history.length || wonHandled;

    slotCountEl.textContent = String(game.boosters.slot);
    gloveCountEl.textContent = String(game.boosters.glove);
    scissorsCountEl.textContent = String(game.boosters.scissors);
    slotBoostBtn.disabled = game.boosters.slot <= 0 || game.dockCapacity >= DOCK_MAX_SLOTS;
    gloveBoostBtn.disabled = game.boosters.glove <= 0;
    scissorsBoostBtn.disabled = game.boosters.scissors <= 0 || game.dock.every((s) => !s);
    gloveBoostBtn.setAttribute("aria-pressed", String(game.armedBooster === "glove"));
    scissorsBoostBtn.setAttribute("aria-pressed", String(game.armedBooster === "scissors"));

    drawLoom();
    renderDock();
    renderTray();

    if (isKnitWon(game) && !wonHandled) {
      wonHandled = true;
      window.cafeAudioPlay?.("chime");
      window.recordCafeStamp?.("game");
      statusEl.textContent = `🎉 ${game.stage}단계 「${game.patternName}」 완성! (+${game.score}점)`;
      submitArcadeScore("knit", game.score, { mode: `stage${game.stage}`, metric: `${game.stage}탄 ${doneRatio}%` });
    } else if (!wonHandled && isKnitStuck(game)) {
      statusEl.textContent = "⚠️ 도크가 막혔어요! 되돌리기, +1 슬롯 또는 가위 도우미를 사용해 보세요.";
    }
  }

  function tickLoop(now) {
    if (!dialog.open || document.hidden) {
      rafId = 0;
      return;
    }
    if (!wonHandled && now - lastPullAt >= 75) {
      lastPullAt = now;
      const pulled = stepKnitUnravel(game, 1);
      if (pulled.length) {
        window.cafeAudioPlay?.("tick");
        renderAll();
      } else if (game.activeThreads?.length) {
        game.activeThreads = [];
        drawLoom();
      }
    }
    rafId = requestAnimationFrame(tickLoop);
  }

  function startLoop() {
    if (!rafId && dialog.open && !document.hidden) {
      rafId = requestAnimationFrame(tickLoop);
    }
  }

  function loadStage(stage) {
    currentStage = stage;
    game = createKnitStage(stage);
    hintCell = null;
    wonHandled = false;
    statusEl.textContent = `🧶 ${game.patternName} — 위쪽 출구와 이어진 실패를 눌러 실을 풀어보세요!`;
    renderAll();
    startLoop();
  }

  selectEl.addEventListener("change", () => loadStage(Number(selectEl.value) || 1));
  resetBtn.addEventListener("click", () => loadStage(currentStage));
  undoBtn.addEventListener("click", () => {
    if (undoKnit(game)) {
      hintCell = null;
      statusEl.textContent = "한 수 되돌렸어요.";
      renderAll();
    }
  });
  hintBtn.addEventListener("click", () => {
    hintCell = findKnitHint(game);
    if (hintCell) {
      statusEl.textContent = "💡 반짝이는 실패를 누르면 상단 실밥이 바로 풀려요!";
      renderTray();
    } else {
      statusEl.textContent = "지금 당장 꺼낼 수 있는 실패가 없어요. 도우미나 되돌리기를 써보세요.";
    }
  });

  slotBoostBtn.addEventListener("click", () => {
    if (useKnitBooster(game, "slot").ok) {
      window.cafeAudioPlay?.("pop");
      statusEl.textContent = "위쪽 도크가 1칸 넓어졌어요!";
      renderAll();
    }
  });
  gloveBoostBtn.addEventListener("click", () => {
    game.armedBooster = game.armedBooster === "glove" ? null : "glove";
    statusEl.textContent = game.armedBooster === "glove"
      ? "🧤 아래 그리드에서 원하는 실패 1개를 바로 눌러 꺼내세요!"
      : "만능 손 선택을 취소했어요.";
    renderAll();
  });
  scissorsBoostBtn.addEventListener("click", () => {
    if (game.armedBooster === "scissors") {
      game.armedBooster = null;
      statusEl.textContent = "가위 선택을 취소했어요.";
      renderAll();
      return;
    }
    const firstActive = game.dock.findIndex((s, i) => i < game.dockCapacity && s);
    if (firstActive >= 0 && useKnitBooster(game, "scissors", { dockIndex: firstActive }).ok) {
      window.cafeAudioPlay?.("pop");
      statusEl.textContent = "✂️ 도크의 실타래 1개를 시원하게 잘라 정리했어요!";
      renderAll();
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    } else if (!document.hidden && dialog.open) {
      startLoop();
    }
  });

  const observer = new MutationObserver(() => {
    if (dialog.open) {
      window.cafeWorld?.setActivity("game:knit");
      renderAll();
      startLoop();
    } else {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
      window.cafeWorld?.setActivity("");
    }
  });
  observer.observe(dialog, { attributes: true, attributeFilter: ["open"] });

  dialog.addEventListener("close", () => {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
    window.cafeWorld?.setActivity("");
  });

  loadStage(1);
}
