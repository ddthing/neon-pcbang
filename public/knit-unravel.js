import {
  KNIT_STAGE_COUNT,
  TRAY_CAPACITY,
  YARN_COLORS,
  createKnitStage,
  findKnitHint,
  isKnitStuck,
  isKnitWon,
  isStrandFree,
  pickKnitStrand,
  undoKnit,
} from "./knit-unravel-engine.mjs";
import { mountLeaderboardBox, submitArcadeScore } from "./arcade-leaderboard.js";

const COLOR_MAP = Object.fromEntries(YARN_COLORS.map((c) => [c.id, c]));

export function initKnitUnravel() {
  const dialog = document.getElementById("knit");
  const selectEl = document.getElementById("knit-select");
  const stageEl = document.getElementById("knit-stage");
  const spoolsEl = document.getElementById("knit-spools");
  const scoreEl = document.getElementById("knit-score");
  const bobbinsEl = document.getElementById("knit-bobbins");
  const boardEl = document.getElementById("knit-board");
  const trayEl = document.getElementById("knit-tray");
  const statusEl = document.getElementById("knit-status");
  const undoBtn = document.getElementById("knit-undo");
  const hintBtn = document.getElementById("knit-hint");
  const resetBtn = document.getElementById("knit-reset");

  mountLeaderboardBox(dialog, "knit", () => `stage-${currentStage}`, (s, m) => m || `${s}점`);

  for (let s = 1; s <= KNIT_STAGE_COUNT; s++) {
    const opt = document.createElement("option");
    opt.value = String(s);
    opt.textContent = `${s}단계`;
    selectEl.append(opt);
  }

  let currentStage = 1;
  let game = createKnitStage(currentStage);
  let hintId = null;
  let wonHandled = false;

  function render() {
    stageEl.textContent = `${game.stage} / ${KNIT_STAGE_COUNT}`;
    spoolsEl.textContent = `${game.completedBobbins} / ${game.totalBobbins}`;
    scoreEl.textContent = game.score.toLocaleString();
    undoBtn.disabled = game.history.length === 0 || wonHandled;

    // Bobbins
    bobbinsEl.replaceChildren(...game.activeBobbins.map((b) => {
      const meta = COLOR_MAP[b.color];
      const box = document.createElement("div");
      box.className = "knit-bobbin";
      const spool = document.createElement("span");
      spool.className = "knit-spool";
      spool.style.background = meta.fill;
      const info = document.createElement("div");
      info.className = "knit-bobbin-meta";
      info.innerHTML = `<strong>${meta.name} (${b.count}/${b.max})</strong>`;
      const pips = document.createElement("div");
      pips.className = "knit-pips";
      for (let i = 0; i < b.max; i++) {
        const pip = document.createElement("i");
        if (i < b.count) pip.className = "filled";
        pips.append(pip);
      }
      info.append(pips);
      box.append(spool, info);
      return box;
    }));

    // Overlapping strands sorted back-to-front by layer
    const sorted = game.strands.slice().sort((a, b) => a.layer - b.layer);
    boardEl.replaceChildren(...sorted.map((st) => {
      const free = isStrandFree(game, st.id);
      const meta = COLOR_MAP[st.color];
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "knit-strand " + (free ? "is-free" : "is-locked");
      btn.dataset.strandId = String(st.id);
      btn.dataset.hint = String(hintId === st.id);
      btn.style.left = st.x + "%";
      btn.style.top = st.y + "%";
      btn.style.width = st.w + "%";
      btn.style.height = st.h + "%";
      btn.style.zIndex = String(st.layer + 1);
      btn.style.background = meta.fill;
      btn.setAttribute("aria-label", `${meta.name} 실 ${free ? "풀 수 있음" : "다른 실에 덮여 있음"}`);
      btn.textContent = free ? "●" : "🔒";
      btn.addEventListener("click", () => {
        hintId = null;
        const res = pickKnitStrand(game, st.id);
        if (!res.ok) {
          window.cafeAudioPlay?.("thud");
          statusEl.textContent = res.reason === "locked"
            ? "위에 덮인 다른 실을 먼저 풀어주세요!"
            : "대기 실칸(5칸)이 꽉 찼어요! 되돌리거나 다시 시작하세요.";
          return;
        }
        window.cafeAudioPlay?.(res.woundDirectly ? "pop" : "tick");
        render();
      });
      return btn;
    }));

    // 5-slot waiting tray
    const slots = [];
    for (let i = 0; i < TRAY_CAPACITY; i++) {
      const colId = game.tray[i];
      const slot = document.createElement("div");
      slot.className = "knit-tray-slot" + (colId ? " filled" : "");
      if (colId) {
        const meta = COLOR_MAP[colId];
        slot.style.background = meta.fill;
        slot.textContent = meta.name.split(" ")[0];
      } else {
        slot.textContent = "빈 칸";
      }
      slots.push(slot);
    }
    trayEl.replaceChildren(...slots);

    if (isKnitWon(game) && !wonHandled) {
      wonHandled = true;
      window.cafeAudioPlay?.("chime");
      window.recordCafeStamp?.("game");
      const pts = game.score + currentStage * 80;
      window.cafeEarnPoints?.(40, `뜨개 실풀기 ${currentStage}단계 완성`);
      submitArcadeScore("knit", pts, { mode: `stage-${currentStage}`, metric: `${game.moves}수 클리어` });
      statusEl.textContent = `🎉 ${currentStage}단계 실타래 정리 완료! 다음 단계에 도전해 보세요!`;
    } else if (isKnitStuck(game)) {
      statusEl.textContent = "앗! 대기 실칸이 가득 차서 풀 수 있는 색실이 없어요. [되돌리기]를 눌러보세요.";
    }
  }

  function loadStage(stage) {
    currentStage = stage;
    selectEl.value = String(stage);
    game = createKnitStage(stage);
    hintId = null;
    wonHandled = false;
    window.cafeWorld?.setActivity("game:knit");
    statusEl.textContent = "위에 다른 실이 덮여있지 않은 색실을 눌러 실타래를 완성하세요.";
    render();
  }

  selectEl.addEventListener("change", () => loadStage(Number(selectEl.value)));
  resetBtn.addEventListener("click", () => loadStage(currentStage));
  undoBtn.addEventListener("click", () => {
    if (undoKnit(game)) {
      hintId = null;
      window.cafeAudioPlay?.("tick");
      statusEl.textContent = "직전 수를 되돌렸어요.";
      render();
    }
  });
  hintBtn.addEventListener("click", () => {
    hintId = findKnitHint(game);
    statusEl.textContent = hintId ? "💡 반짝이는 색실을 먼저 풀어보세요!" : "풀 수 있는 실이 남아있지 않아요.";
    render();
  });

  dialog.addEventListener("close", () => window.cafeWorld?.setActivity(""));
  loadStage(1);
}
