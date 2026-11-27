import {
  DOCK_MAX_SLOTS,
  KNIT_PATTERNS,
  KNIT_STAGE_COUNT,
  TRAY_COLS,
  TRAY_ROWS,
  YARN_PALETTE,
  createKnitStage,
  findKnitHint,
  findPairPartner,
  isCellReachable,
  isKnitStuck,
  isKnitWon,
  pickKnitCell,
  stepKnitUnravel,
  undoKnit,
  useKnitBooster,
} from "./knit-unravel-engine.mjs";
import { mountLeaderboardBox, submitArcadeScore } from "./arcade-leaderboard.js";
import { clearCafeGameResult, showCafeGameResult } from "./cafe-game-result.js";

export function initKnitUnravel() {
  const dialog = document.getElementById("knit");
  const loomCanvas = document.getElementById("knit-loom");
  const dockEl = document.getElementById("knit-dock");
  const trayEl = document.getElementById("knit-tray");
  const selectEl = document.getElementById("knit-select");
  const spoolsEl = document.getElementById("knit-spools");
  const scoreEl = document.getElementById("knit-score");
  const progressFillEl = document.getElementById("knit-progress-fill");
  const captionEl = document.getElementById("knit-pattern-caption");
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

  // 선택 규칙: "path"(기본, 빈 칸 길이 열린 실) / "column"(맨 위 실만 + 아래 실타래가 위로 올라옴)
  const ruleBtn = document.getElementById("knit-rule");
  const ruleKey = "neon-pcbang-knit-rule";
  let rule = "path";
  try { if (localStorage.getItem(ruleKey) === "column") rule = "column"; } catch {}
  const rankMode = () => `stage${currentStage}${rule === "column" ? "-col" : ""}`;

  mountLeaderboardBox(dialog, "knit", rankMode, (s, m) => m || `${s}점`);

  for (let i = 1; i <= KNIT_STAGE_COUNT; i++) {
    const opt = document.createElement("option");
    opt.value = String(i);
    opt.textContent = `${i}단계 · ${KNIT_PATTERNS[i - 1].name}`;
    selectEl.append(opt);
  }

  let currentStage = 1;
  let game = createKnitStage(1, { rule });
  let hintCell = null;
  let wonHandled = false;
  let lastPullAt = 0;
  let rafId = 0;
  // Smooth 60fps interpolated yarn threads & flying knit stitches
  let flyingBeads = [];
  let sparks = [];

  function loomMetrics() {
    const W = loomCanvas.width;
    const H = loomCanvas.height;
    const frameX = 16;
    const frameY = 14;
    const frameW = W - 32;
    const frameH = H - 30;
    const cellW = Math.floor((frameW - 8) / game.cols);
    const cellH = Math.floor((frameH - 6) / game.rows);
    const padX = frameX + Math.floor((frameW - cellW * game.cols) / 2);
    const padY = frameY + Math.floor((frameH - cellH * game.rows) / 2);
    return { W, H, frameX, frameY, frameW, frameH, cellW, cellH, padX, padY };
  }

  function drawLoom(now = performance.now()) {
    const { W, H, frameX, frameY, frameW, frameH, cellW, cellH, padX, padY } = loomMetrics();
    lctx.clearRect(0, 0, W, H);

    // Soft backdrop & wooden knit frame
    lctx.fillStyle = "#2b2434";
    lctx.fillRect(0, 0, W, H);
    lctx.fillStyle = "#362d42";
    lctx.fillRect(4, 4, W - 8, H - 8);

    for (const wx of [frameX - 7, frameX + frameW]) {
      lctx.fillStyle = "#261c29";
      lctx.fillRect(wx, frameY - 7, 7, frameH + 14);
      lctx.fillStyle = "#a86c5e";
      lctx.fillRect(wx + 1, frameY - 6, 5, frameH + 12);
      lctx.fillStyle = "#dfb08f";
      lctx.fillRect(wx + 1, frameY - 6, 2, frameH + 11);
    }
    // Top & bottom horizontal wooden bars
    for (const wy of [frameY - 7, frameY + frameH]) {
      const h = wy < frameY ? 7 : 8;
      lctx.fillStyle = "#261c29";
      lctx.fillRect(frameX - 7, wy, frameW + 14, h);
      lctx.fillStyle = "#85524f";
      lctx.fillRect(frameX - 6, wy + 1, frameW + 12, h - 2);
      lctx.fillStyle = "#c48870";
      lctx.fillRect(frameX - 5, wy + 1, frameW + 10, 2);
    }

    lctx.fillStyle = "#1c1722";
    lctx.fillRect(frameX, frameY, frameW, frameH);

    // Pixel V-stitch knit tapestry
    for (let r = 0; r < game.rows; r++) {
      for (let c = 0; c < game.cols; c++) {
        const cid = game.tapestry[r][c];
        if (!cid) continue;
        const pal = YARN_PALETTE[cid];
        if (!pal) continue;
        const x = padX + c * cellW;
        const y = padY + r * cellH;
        lctx.fillStyle = pal.sh;
        lctx.fillRect(x, y, cellW, cellH - 1);
        const arm = Math.max(2, Math.floor(cellW * 0.42));
        lctx.fillStyle = pal.fill;
        lctx.fillRect(x + 1, y + 1, arm, cellH - 3);
        lctx.fillRect(x + cellW - 1 - arm, y + 1, arm, cellH - 3);
        lctx.fillStyle = pal.hi;
        lctx.fillRect(x + 1, y + 1, Math.max(1, arm - 1), Math.max(2, Math.floor(cellH * 0.35)));
      }
    }

    // Smooth curved Bezier yarn threads + traveling stitch beads
    const dockStep = W / Math.max(1, game.dockCapacity);
    flyingBeads = flyingBeads.filter((b) => now - b.start < b.duration);
    for (const b of flyingBeads) {
      const pal = YARN_PALETTE[b.color];
      if (!pal) continue;
      const p = Math.min(1, (now - b.start) / b.duration);
      const ease = 1 - Math.pow(1 - p, 2);
      const sx = padX + b.col * cellW + Math.floor(cellW / 2);
      const sy = padY + b.row * cellH + Math.floor(cellH * 0.7);
      const dx = Math.round(dockStep * (b.dockIndex + 0.5));
      const dy = H + 2;
      const swayX = Math.sin(p * Math.PI * 2 + b.phase) * 9 * (1 - p);
      const cx = (sx + dx) * 0.5 + swayX;
      const cy = Math.max(sy, dy) - 18;

      // Crisp quadratic Bezier yarn cord (smooth continuous curve)
      lctx.save();
      lctx.lineCap = "round";
      lctx.lineWidth = 3.5;
      lctx.strokeStyle = "#5c4742";
      lctx.beginPath();
      lctx.moveTo(sx, sy);
      lctx.quadraticCurveTo(cx, cy, dx, dy);
      lctx.stroke();

      lctx.lineWidth = 2;
      lctx.strokeStyle = pal.hi;
      lctx.beginPath();
      lctx.moveTo(sx, sy);
      lctx.quadraticCurveTo(cx, cy, dx, dy);
      lctx.stroke();

      // Traveling yarn bead interpolating smoothly from stitch -> spool
      const u = 1 - ease;
      const bx = u * u * sx + 2 * u * ease * cx + ease * ease * dx;
      const by = u * u * sy + 2 * u * ease * cy + ease * ease * dy;
      lctx.fillStyle = "#fff7ed";
      lctx.fillRect(Math.round(bx) - 2, Math.round(by) - 2, 4, 4);
      lctx.fillStyle = pal.fill;
      lctx.fillRect(Math.round(bx) - 1, Math.round(by) - 1, 2, 2);
      lctx.restore();
    }

    // Soft pop sparkles when stitches detach
    sparks = sparks.filter((s) => now - s.start < 260);
    for (const s of sparks) {
      const p = (now - s.start) / 260;
      lctx.save();
      lctx.globalAlpha = Math.max(0, 1 - p);
      lctx.fillStyle = s.col;
      const px = Math.round(s.x + s.vx * p * 12);
      const py = Math.round(s.y + s.vy * p * 12);
      lctx.fillRect(px, py, 2, 2);
      lctx.restore();
    }
  }

  function renderDockAndHud() {
    const doneRatio = game.totalStitches
      ? Math.round(((game.totalStitches - game.remainingStitches) / game.totalStitches) * 100)
      : 100;
    if (captionEl) captionEl.textContent = `${game.stage}탄 도안 · ${game.patternName}`;
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
              statusEl.textContent = "가위로 도크 실타래 1개를 정리했어요!";
              renderDockAndHud();
              renderTray();
              drawLoom();
            }
          }
        });
      } else {
        btn.disabled = true;
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
          renderDockAndHud();
          renderTray();
        }
      });
      slots.push(addSlot);
    }
    dockEl.replaceChildren(...slots);

    if (isKnitWon(game) && !wonHandled) {
      wonHandled = true;
      window.cafeAudioPlay?.("chime");
      const reward = window.cafeRewardGameEnd?.("knit", game.score, { winBonus: true, label: "뜨개 실풀기 완성" });
      const gText = reward ? ` · +${reward.awarded} G` : "";
      statusEl.textContent = `🎉 ${game.stage}단계 「${game.patternName}」 완성! (+${game.score}점${gText})`;
      const record = submitArcadeScore("knit", game.score, { mode: rankMode(), metric: `${game.stage}탄 ${doneRatio}%` });
      showCafeGameResult(dialog, { title: `${game.stage}단계 실풀기 완성`, metric: `${game.patternName} · ${game.score.toLocaleString()}점`, win: true, record: game.score > 0 ? record : null, action: resetBtn });
    } else if (!wonHandled && isKnitStuck(game)) {
      statusEl.textContent = "⚠️ 도크가 막혔어요! 되돌리기, +1 슬롯 또는 가위 도우미를 사용해 보세요.";
    }
  }

  // Only called on discrete tray changes (NEVER during the 60fps unravel loop!) so rapid clicks never drop!
  function renderTray() {
    let lastUsedRow = -1;
    for (let r = 0; r < TRAY_ROWS; r++) {
      for (let c = 0; c < TRAY_COLS; c++) {
        if (game.tray[r][c]) lastUsedRow = r;
      }
    }
    const visibleRows = Math.min(TRAY_ROWS, Math.max(3, lastUsedRow + 2));
    const frag = [];
    for (let r = 0; r < visibleRows; r++) {
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
          if (cell.pairId) {
            btn.classList.add("paired");
            // 짝이 바로 옆/위아래에 붙어 있으면 두 칸을 잇는 밧줄 띠를 그린다(색이 아닌 모양으로 구분).
            const partner = findPairPartner(game.tray, r, c);
            if (partner && Math.abs(partner.r - r) + Math.abs(partner.c - c) === 1) {
              btn.dataset.link = partner.c > c ? "right" : partner.c < c ? "left" : partner.r > r ? "down" : "up";
            }
          }
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

          if (cell.pairId) {
            // 매듭 뱃지: 같은 번호끼리 한 쌍
            const knot = document.createElement("span");
            knot.className = "knit-knot";
            knot.setAttribute("aria-hidden", "true");
            knot.textContent = String(cell.pairId);
            btn.append(knot);
          }
          if (!reach && !canGlove) {
            // 자물쇠 표시: 아직 꺼낼 수 없는 실타래
            const lock = document.createElement("span");
            lock.className = "knit-lock";
            lock.setAttribute("aria-hidden", "true");
            btn.append(lock);
          }

          btn.setAttribute(
            "aria-label",
            `${cell.mystery ? "미스터리" : pal.name} 실타래 (${cell.remaining}코)` +
              `${cell.pairId ? `, ${cell.pairId}번 매듭으로 묶인 한 쌍` : ""}${cell.ice > 0 ? ", 얼음" : ""}` +
              `${reach ? ", 이동 가능" : ", 막혀 있음"}`
          );

          btn.addEventListener("click", () => {
            hintCell = null;
            if (game.armedBooster === "glove") {
              const gRes = useKnitBooster(game, "glove", { r, c });
              if (gRes.ok) {
                window.cafeAudioPlay?.("pop");
                statusEl.textContent = "만능 손으로 막혀 있던 실타래를 바로 꺼냈어요!";
                renderDockAndHud();
                renderTray();
                drawLoom();
                startLoop();
              } else {
                statusEl.textContent = "위쪽 도크에 빈칸이 부족해요!";
              }
              return;
            }

            const res = pickKnitCell(game, r, c);
            if (!res.ok) {
              window.cafeAudioPlay?.("tick");
              if (res.reason === "frozen") statusEl.textContent = "얼음 실타래예요! 통로가 먼저 열린 뒤 녹일 수 있어요.";
              else if (res.reason === "pair_needs_two") statusEl.textContent = "끈으로 묶인 2개의 실타래는 도크 빈칸이 2개 필요해요!";
              else if (res.reason === "dock_full") statusEl.textContent = "위쪽 실타래 도크가 꽉 찼어요! 가위나 +1 슬롯을 써보세요.";
              else if (rule === "column") statusEl.textContent = "각 줄의 맨 위 실타래만 꺼낼 수 있어요. 위를 꺼내면 아래가 올라와요!";
              else statusEl.textContent = "위쪽 출구 행까지 빈 칸 길이 열려 있어야 꺼낼 수 있어요!";
              return;
            }
            window.cafeAudioPlay?.("pop");
            renderDockAndHud();
            renderTray();
            drawLoom();
            startLoop();
          });
        }
        frag.push(btn);
      }
    }
    trayEl.replaceChildren(...frag);
  }

  function tickLoop(now) {
    if (!dialog.open || document.hidden) {
      rafId = 0;
      return;
    }
    const { padX, padY, cellW, cellH } = loomMetrics();
    if (!wonHandled && now - lastPullAt >= 55) {
      lastPullAt = now;
      const pulled = stepKnitUnravel(game, 1);
      if (pulled.length) {
        window.cafeAudioPlay?.("tick");
        for (const p of pulled) {
          flyingBeads.push({ ...p, start: now, duration: 220, phase: Math.random() * 6 });
          const pal = YARN_PALETTE[p.color];
          if (pal) {
            for (let k = 0; k < 2; k++) {
              sparks.push({
                x: padX + p.col * cellW + cellW * 0.5,
                y: padY + p.row * cellH + cellH * 0.5,
                vx: (Math.random() - 0.5) * 1.4,
                vy: -0.5 - Math.random(),
                col: pal.hi,
                start: now,
              });
            }
          }
        }
        // Only update HUD & Dock (NEVER destroy tray buttons while unraveling!)
        renderDockAndHud();
      }
    }
    drawLoom(now);
    const activeDock = game.dock.some((s, i) => i < game.dockCapacity && s && s.remaining > 0);
    if (flyingBeads.length || sparks.length || (!wonHandled && activeDock)) {
      rafId = requestAnimationFrame(tickLoop);
    } else {
      rafId = 0;
    }
  }

  function startLoop() {
    if (!rafId && dialog.open && !document.hidden) {
      rafId = requestAnimationFrame(tickLoop);
    }
  }

  function loadStage(stage) {
    clearCafeGameResult(dialog);
    currentStage = stage;
    game = createKnitStage(stage, { rule });
    hintCell = null;
    wonHandled = false;
    flyingBeads = [];
    sparks = [];
    if (ruleBtn) {
      ruleBtn.setAttribute("aria-pressed", String(rule === "column"));
      ruleBtn.textContent = rule === "column" ? "줄 세우기 ON" : "줄 세우기 OFF";
    }
    statusEl.textContent = rule === "column"
      ? `🧶 ${game.patternName} — 각 줄의 맨 위 실타래를 눌러 실을 풀어보세요! 아래 실타래가 위로 올라와요.`
      : `🧶 ${game.patternName} — 위쪽 통로와 이어진 실패를 눌러 실을 풀어보세요!`;
    renderDockAndHud();
    renderTray();
    drawLoom();
    startLoop();
  }

  selectEl.addEventListener("change", () => loadStage(Number(selectEl.value) || 1));
  resetBtn.addEventListener("click", () => loadStage(currentStage));
  ruleBtn?.addEventListener("click", () => {
    rule = rule === "column" ? "path" : "column";
    try { localStorage.setItem(ruleKey, rule); } catch {}
    loadStage(currentStage);
    document.dispatchEvent(new CustomEvent("arcade-leaderboard-mode-changed", { detail: { game: "knit" } }));
  });
  undoBtn.addEventListener("click", () => {
    if (undoKnit(game)) {
      hintCell = null;
      flyingBeads = [];
      statusEl.textContent = "한 수 되돌렸어요.";
      renderDockAndHud();
      renderTray();
      drawLoom();
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
      renderDockAndHud();
      renderTray();
    }
  });
  gloveBoostBtn.addEventListener("click", () => {
    game.armedBooster = game.armedBooster === "glove" ? null : "glove";
    statusEl.textContent = game.armedBooster === "glove"
      ? "🧤 아래 그리드에서 원하는 실패 1개를 바로 눌러 꺼내세요!"
      : "만능 손 선택을 취소했어요.";
    renderDockAndHud();
    renderTray();
  });
  scissorsBoostBtn.addEventListener("click", () => {
    if (game.armedBooster === "scissors") {
      game.armedBooster = null;
      statusEl.textContent = "가위 선택을 취소했어요.";
      renderDockAndHud();
      return;
    }
    const firstActive = game.dock.findIndex((s, i) => i < game.dockCapacity && s);
    if (firstActive >= 0 && useKnitBooster(game, "scissors", { dockIndex: firstActive }).ok) {
      window.cafeAudioPlay?.("pop");
      statusEl.textContent = "✂️ 도크의 실타래 1개를 시원하게 잘라 정리했어요!";
      renderDockAndHud();
      drawLoom();
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
      renderDockAndHud();
      renderTray();
      drawLoom();
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
