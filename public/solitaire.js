import {
  RANK_LABELS,
  SUIT_SYMBOLS,
  autoMoveToFoundation,
  canAutoComplete,
  createSolitaireGame,
  drawFromStock,
  findSolitaireHint,
  isRedSuit,
  isSolitaireWon,
  moveCards,
  stepAutoComplete,
  undoSolitaire,
  wasteFanCount,
} from "./solitaire-engine.mjs";
import { mountLeaderboardBox, submitArcadeScore } from "./arcade-leaderboard.js";
import { clearCafeGameResult, showCafeGameResult } from "./cafe-game-result.js";

export function initSolitaire() {
  const dialog = document.getElementById("solitaire");
  const board = document.getElementById("sol-board");
  const scoreEl = document.getElementById("sol-score");
  const movesEl = document.getElementById("sol-moves");
  const timeEl = document.getElementById("sol-time");
  const statusEl = document.getElementById("sol-status");
  const drawModeBtn = document.getElementById("sol-draw-mode");
  const undoBtn = document.getElementById("sol-undo");
  const hintBtn = document.getElementById("sol-hint");
  const autoBtn = document.getElementById("sol-auto");
  const newBtn = document.getElementById("sol-new");

  mountLeaderboardBox(dialog, "solitaire", () => (drawCount === 3 ? "draw3" : "draw1"), (s, m) => m || `${s}점`);

  let drawCount = 3;
  let game = createSolitaireGame({ drawCount });
  let selected = null;
  let hintPair = null;
  let startedAt = 0;
  let elapsedSec = 0;
  let baseElapsedSec = 0;
  let clockId = 0;
  let autoTimer = 0;
  let wonHandled = false;

  function formatSec(sec) {
    return `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;
  }

  function startClock() {
    clearInterval(clockId);
    startedAt = performance.now();
    clockId = setInterval(() => {
      if (!dialog.open || document.hidden || isSolitaireWon(game)) return;
      elapsedSec = baseElapsedSec + Math.floor((performance.now() - startedAt) / 1000);
      timeEl.textContent = formatSec(elapsedSec);
    }, 500);
  }

  function cardEl(card, source, isSelected, isHint) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "sol-card" + (card.faceUp ? (isRedSuit(card.suit) ? " red" : "") : " down");
    btn.dataset.selected = String(Boolean(isSelected));
    btn.dataset.hint = String(Boolean(isHint));
    if (card.faceUp) {
      const rank = RANK_LABELS[card.rank];
      const sym = SUIT_SYMBOLS[card.suit];
      btn.setAttribute("aria-label", `${rank} ${sym}`);
      btn.innerHTML = `<span class="sol-card-corner"><span>${rank}</span><span>${sym}</span></span><span class="sol-card-suit">${sym}</span>`;
    } else {
      btn.setAttribute("aria-label", "뒤집힌 카드");
    }
    btn.addEventListener("click", () => handleCardClick(source, card));
    btn.addEventListener("dblclick", (e) => {
      e.preventDefault();
      if (!card.faceUp) return;
      if (autoMoveToFoundation(game, source)) {
        selected = null;
        hintPair = null;
        window.cafeAudioPlay?.("pop");
        render();
      }
    });
    return btn;
  }

  function handleCardClick(source, card) {
    hintPair = null;
    if (!startedAt) startClock();
    if (!card.faceUp) return;
    if (selected) {
      const sameSource = selected.kind === source.kind && selected.index === source.index && selected.cardIndex === source.cardIndex;
      if (sameSource) {
        if (autoMoveToFoundation(game, source)) {
          selected = null;
          window.cafeAudioPlay?.("pop");
          render();
          return;
        }
        selected = null;
        render();
        return;
      }
      if (source.kind === "tableau") {
        if (moveCards(game, selected, { kind: "tableau", index: source.index })) {
          selected = null;
          window.cafeAudioPlay?.("tick");
          render();
          return;
        }
      } else if (source.kind === "foundation") {
        if (moveCards(game, selected, { kind: "foundation", index: source.index })) {
          selected = null;
          window.cafeAudioPlay?.("pop");
          render();
          return;
        }
      }
    }
    selected = source;
    window.cafeAudioPlay?.("tick");
    render();
  }

  function handleEmptySlotClick(target) {
    hintPair = null;
    if (!startedAt) startClock();
    if (!selected) return;
    if (moveCards(game, selected, target)) {
      selected = null;
      window.cafeAudioPlay?.("tick");
      render();
    } else {
      selected = null;
      statusEl.textContent = "여기로 옮길 수 없는 카드예요.";
      render();
    }
  }

  function isSelectedSource(kind, index = undefined, cardIndex = undefined) {
    if (!selected || selected.kind !== kind) return false;
    if (kind === "waste") return true;
    if (kind === "foundation") return selected.index === index;
    return selected.index === index && cardIndex >= selected.cardIndex;
  }

  function isHintSource(kind, index = undefined, cardIndex = undefined) {
    if (!hintPair?.source || hintPair.source.kind !== kind) return false;
    if (kind === "waste") return true;
    return hintPair.source.index === index && hintPair.source.cardIndex === cardIndex;
  }

  function render() {
    scoreEl.textContent = game.score.toLocaleString();
    movesEl.textContent = String(game.moves);
    timeEl.textContent = formatSec(elapsedSec);
    undoBtn.disabled = game.history.length === 0 || wonHandled;
    drawModeBtn.textContent = drawCount === 3 ? "3장 뽑기" : "1장 뽑기";
    drawModeBtn.setAttribute("aria-pressed", String(drawCount === 3));
    autoBtn.hidden = !canAutoComplete(game);

    const topRow = document.createElement("div");
    topRow.className = "sol-top-row";

    // Stock
    const stockBtn = document.createElement("button");
    stockBtn.type = "button";
    stockBtn.className = game.stock.length ? "sol-card down" : "sol-slot";
    stockBtn.textContent = game.stock.length ? "" : "↻";
    stockBtn.setAttribute("aria-label", game.stock.length ? `카드 덱 ${game.stock.length}장 뽑기` : "덱 다시 채우기");
    stockBtn.addEventListener("click", () => {
      selected = null;
      hintPair = null;
      if (!startedAt) startClock();
      if (drawFromStock(game)) window.cafeAudioPlay?.("tick");
      render();
    });
    topRow.append(stockBtn);

    // Waste: 3장 뽑기는 위 3장을 부채꼴로, 1장 뽑기는 맨 위 1장만 보여 준다.
    const wasteWrap = document.createElement("div");
    wasteWrap.className = "sol-pile sol-waste-fan";
    if (game.waste.length) {
      const visible = game.waste.slice(-wasteFanCount(drawCount));
      visible.forEach((card, idx) => {
        const isTop = idx === visible.length - 1;
        const el = cardEl(card, { kind: "waste" }, isTop && isSelectedSource("waste"), isTop && isHintSource("waste"));
        el.style.setProperty("--fan-i", String(idx));
        if (!isTop) {
          el.classList.add("is-under");
          el.disabled = true;
          el.tabIndex = -1;
        }
        wasteWrap.append(el);
      });
    } else {
      const empty = document.createElement("div");
      empty.className = "sol-slot";
      empty.setAttribute("aria-hidden", "true");
      wasteWrap.append(empty);
    }
    topRow.append(wasteWrap);

    // 4 Foundations
    for (let fi = 0; fi < 4; fi++) {
      const pile = game.foundations[fi];
      const fWrap = document.createElement("div");
      fWrap.className = "sol-pile";
      if (pile.length) {
        const top = pile[pile.length - 1];
        fWrap.append(cardEl(top, { kind: "foundation", index: fi }, isSelectedSource("foundation", fi), false));
      } else {
        const slot = document.createElement("button");
        slot.type = "button";
        slot.className = "sol-slot";
        slot.textContent = "A";
        slot.setAttribute("aria-label", `완성 칸 ${fi + 1}`);
        slot.addEventListener("click", () => handleEmptySlotClick({ kind: "foundation", index: fi }));
        fWrap.append(slot);
      }
      topRow.append(fWrap);
    }

    const tabRow = document.createElement("div");
    tabRow.className = "sol-tableau";
    for (let ti = 0; ti < 7; ti++) {
      const pile = game.tableau[ti];
      const colEl = document.createElement("div");
      colEl.className = "sol-tableau-pile";
      if (!pile.length) {
        const slot = document.createElement("button");
        slot.type = "button";
        slot.className = "sol-slot";
        slot.textContent = "K";
        slot.setAttribute("aria-label", `빈 줄 ${ti + 1}`);
        slot.addEventListener("click", () => handleEmptySlotClick({ kind: "tableau", index: ti }));
        colEl.append(slot);
      } else {
        pile.forEach((c, ci) => {
          const src = { kind: "tableau", index: ti, cardIndex: ci };
          colEl.append(cardEl(c, src, isSelectedSource("tableau", ti, ci), isHintSource("tableau", ti, ci)));
        });
      }
      tabRow.append(colEl);
    }

    board.replaceChildren(topRow, tabRow);

    if (isSolitaireWon(game) && !wonHandled) {
      wonHandled = true;
      clearInterval(clockId);
      clearInterval(autoTimer);
      window.cafeAudioPlay?.("chime");
      const bonus = Math.max(0, 600 - elapsedSec * 2);
      const total = game.score + bonus;
      const reward = window.cafeRewardGameEnd?.("solitaire", total, { winBonus: true, label: "코지 솔리테어 클리어" });
      const record = submitArcadeScore("solitaire", total, {
        mode: drawCount === 3 ? "draw3" : "draw1",
        metric: `${formatSec(elapsedSec)} · ${game.moves}수`,
      });
      statusEl.textContent = `🎉 솔리테어 완성! 최종 ${total.toLocaleString()}점 (${formatSec(elapsedSec)})${reward ? ` · +${reward.awarded} G` : ""}`;
      showCafeGameResult(dialog, { title: "솔리테어 완성", metric: `${total.toLocaleString()}점 · ${game.moves}수`, win: true, record: total > 0 ? record : null, action: newBtn });
    }
  }

  function reset(nextDraw = drawCount) {
    clearCafeGameResult(dialog);
    drawCount = nextDraw;
    clearInterval(clockId);
    clearInterval(autoTimer);
    game = createSolitaireGame({ drawCount });
    selected = null;
    hintPair = null;
    startedAt = 0;
    elapsedSec = 0;
    baseElapsedSec = 0;
    wonHandled = false;
    window.cafeWorld?.setActivity("game:solitaire");
    statusEl.textContent = "카드를 눌러 선택한 뒤 옮길 칸을 누르세요. 같은 카드를 한 번 더 누르면 자동 올리기!";
    render();
  }

  drawModeBtn.addEventListener("click", () => reset(drawCount === 1 ? 3 : 1));
  newBtn.addEventListener("click", () => reset(drawCount));
  undoBtn.addEventListener("click", () => {
    if (undoSolitaire(game)) {
      selected = null;
      hintPair = null;
      window.cafeAudioPlay?.("tick");
      render();
    }
  });
  hintBtn.addEventListener("click", () => {
    const h = findSolitaireHint(game);
    hintPair = h;
    if (!h) statusEl.textContent = "더 이상 가능한 이동이 없어요.";
    else if (h.action === "draw") statusEl.textContent = "💡 왼쪽 위 카드 덱에서 카드를 뽑아보세요!";
    else statusEl.textContent = "💡 반짝이는 카드를 옮길 수 있어요!";
    render();
  });
  autoBtn.addEventListener("click", () => {
    clearInterval(autoTimer);
    autoTimer = setInterval(() => {
      if (!dialog.open || isSolitaireWon(game) || !stepAutoComplete(game)) {
        clearInterval(autoTimer);
        render();
        return;
      }
      window.cafeAudioPlay?.("pop");
      render();
    }, 90);
  });

  dialog.addEventListener("close", () => {
    if (startedAt) {
      baseElapsedSec += Math.floor((performance.now() - startedAt) / 1000);
      elapsedSec = baseElapsedSec;
      startedAt = 0;
    }
    clearInterval(clockId);
    clearInterval(autoTimer);
    window.cafeWorld?.setActivity("");
  });
  new MutationObserver(() => {
    if (dialog.open && game.moves > 0 && !wonHandled) {
      window.cafeWorld?.setActivity("game:solitaire");
      if (!startedAt) startClock();
    }
  }).observe(dialog, { attributes: true, attributeFilter: ["open"] });

  reset(3);
}
