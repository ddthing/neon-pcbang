// Dual Tycoon Suite:
// 1. initBungeoppang() - 길모퉁이 붕어빵 포차 (6-mold cast-iron pastry tycoon)
// 2. initSnackTycoon() - 알바냥의 매점 러시 (Korean PC Bang open-kitchen recipe tycoon)
import { mountLeaderboardBox, submitArcadeScore } from "./arcade-leaderboard.js";
import { showCafeGameResult } from "./cafe-game-result.js";
import { setFoodPixel } from "./food-pixels.js";

function foodIcon(id) {
  const icon = document.createElement("span");
  icon.className = "game-food-pixel";
  setFoodPixel(icon, id);
  return icon;
}

// ============================================================================
// 1. BUNGEOPPANG TYCOON (길모퉁이 붕어빵 포차)
// ============================================================================
export function initBungeoppang() {
  const dialog = document.getElementById("bungeoppang");
  const moldsRoot = document.getElementById("bungeo-molds");
  const orderEl = document.getElementById("bungeo-order");
  const scoreEl = document.getElementById("bungeo-score");
  const timeEl = document.getElementById("bungeo-time");
  const comboEl = document.getElementById("bungeo-combo");
  const bagEl = document.getElementById("bungeo-bag");
  const statusEl = document.getElementById("bungeo-status");
  const startBtn = document.getElementById("bungeo-start");
  const serveBtn = document.getElementById("bungeo-serve");
  const trashBtn = document.getElementById("bungeo-trash");

  mountLeaderboardBox(dialog, "bungeoppang", () => "standard", (s, m) => `${s.toLocaleString()}점${m ? ` (${m})` : ""}`);

  const FILLINGS = {
    pat: { name: "통팥", color: "#6e2c2b", badge: "🫘 통팥" },
    cream: { name: "슈크림", color: "#f7d469", badge: "🍮 슈크림" },
    pizza: { name: "피자치즈", color: "#e85d3f", badge: "🧀 피자" },
  };

  let tool = "batter"; // batter | pat | cream | pizza | flip
  let molds = [];
  let bag = { pat: 0, cream: 0, pizza: 0 };
  let customer = null;
  let score = 0, combo = 0, servedCount = 0, remaining = 75;
  let running = false, paused = false, timer = 0;

  function resetMolds() {
    molds = Array.from({ length: 6 }, (_, idx) => ({
      idx,
      stage: "empty", // empty | batter | filled | flipped | golden | burnt
      filling: null,
      heat: 0,
    }));
  }

  function nextCustomer() {
    const types = ["pat", "cream", "pizza"];
    const req = { pat: 0, cream: 0, pizza: 0 };
    const total = 2 + Math.floor(Math.random() * 3); // 2~4 fishes
    for (let i = 0; i < total; i++) {
      req[types[Math.floor(Math.random() * types.length)]]++;
    }
    const guests = ["A03석 밤샘러", "2인석 커플 손님", "테라스 단골", "5인룸 정글러", "고양이 알바 친구"];
    customer = {
      who: guests[Math.floor(Math.random() * guests.length)],
      req,
    };
    renderUi();
  }

  function selectTool(nextTool) {
    tool = nextTool;
    dialog.querySelectorAll("[data-bungeo-tool]").forEach((btn) => {
      btn.setAttribute("aria-pressed", String(btn.dataset.bungeoTool === tool));
    });
  }

  function clickMold(m) {
    if (!running) {
      statusEl.textContent = "먼저 [장사 시작] 버튼을 눌러 불판을 달궈 주세요!";
      return;
    }
    if (m.stage === "burnt") {
      m.stage = "empty"; m.filling = null; m.heat = 0;
      window.cafeAudioPlay?.("thud");
      statusEl.textContent = "탄 붕어빵을 치웠어요. 불 조절에 주의하세요!";
      renderMolds();
      return;
    }
    if (m.stage === "golden") {
      bag[m.filling]++;
      m.stage = "empty"; m.filling = null; m.heat = 0;
      window.cafeAudioPlay?.("pop");
      statusEl.textContent = `✨ 바삭한 황금 붕어빵을 봉투에 담았어요!`;
      renderUi();
      return;
    }
    if (tool === "batter" && m.stage === "empty") {
      m.stage = "batter"; m.heat = 0;
      window.cafeAudioPlay?.("tick");
      statusEl.textContent = "반죽을 부었어요! 이제 앙금(통팥/슈크림/피자)을 넣어 주세요.";
    } else if ((tool === "pat" || tool === "cream" || tool === "pizza") && m.stage === "batter") {
      m.stage = "filled"; m.filling = tool; m.heat = 0;
      window.cafeAudioPlay?.("tick");
      statusEl.textContent = `${FILLINGS[tool].name} 소를 넣었어요! 아랫면이 익으면 [뒤집기] 해 주세요.`;
    } else if (tool === "flip" && m.stage === "filled") {
      if (m.heat < 2.2) {
        statusEl.textContent = "아직 반죽이 덜 굳었어요! 조금만 더 익혀서 뒤집으세요.";
        return;
      }
      m.stage = "flipped"; m.heat = 0;
      window.cafeAudioPlay?.("pop");
      statusEl.textContent = "착! 예쁘게 뒤집었어요. 노릇해지면 클릭해 꺼내세요!";
    } else {
      // Smart one-click assist: if clicking filled ready-to-flip mold, flip it automatically!
      if (m.stage === "filled" && m.heat >= 2.2) {
        m.stage = "flipped"; m.heat = 0;
        window.cafeAudioPlay?.("pop");
        statusEl.textContent = "착! 뒤집기 성공! 황금빛이 되면 꺼내세요.";
      }
    }
    renderMolds();
  }

  const moldSlots = Array.from({ length: 6 }, (_, idx) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "bungeo-mold";
    const fish = document.createElement("span");
    fish.className = "bungeo-fish";
    const label = document.createElement("small");
    btn.append(fish, label);
    btn.addEventListener("click", () => clickMold(molds[idx]));
    return { btn, fish, label };
  });
  moldsRoot.replaceChildren(...moldSlots.map((s) => s.btn));

  function renderMolds() {
    for (let i = 0; i < molds.length; i++) {
      const m = molds[i];
      const slot = moldSlots[i];
      const fillBadge = m.filling ? FILLINGS[m.filling].badge : "";
      const stageLabel = {
        empty: "빈 철판 (반죽 붓기)",
        batter: "반죽됨 (앙금 넣기)",
        filled: m.heat >= 2.2 ? `🔥 뒤집기! (${fillBadge})` : `익는 중… (${fillBadge})`,
        flipped: "노릇하게 굽는 중…",
        golden: `✨ 황금 완성! 담기 (${fillBadge})`,
        burnt: "💨 탔어요 (클릭 폐기)",
      }[m.stage];
      if (slot.btn.dataset.stage !== m.stage) slot.btn.dataset.stage = m.stage;
      const fillVal = m.filling || "";
      if (slot.fish.dataset.fill !== fillVal) slot.fish.dataset.fill = fillVal;
      if (slot.label.textContent !== stageLabel) slot.label.textContent = stageLabel;
    }
  }

  function renderUi() {
    scoreEl.textContent = score.toLocaleString();
    timeEl.textContent = remaining + "초";
    comboEl.textContent = combo + "콤보";
    bagEl.textContent = `봉투: 🫘통팥 ${bag.pat} · 🍮슈크림 ${bag.cream} · 🧀피자 ${bag.pizza}`;
    if (customer) {
      const parts = Object.entries(customer.req).filter(([, n]) => n > 0).map(([k, n]) => `${FILLINGS[k].badge} ×${n}`);
      orderEl.innerHTML = `<strong>${customer.who}</strong><span>주문: ${parts.join(" + ")}</span>`;
      orderEl.firstElementChild.prepend(foodIcon("pastry"), " ");
      const exact = Object.keys(FILLINGS).every((k) => bag[k] >= customer.req[k]);
      serveBtn.disabled = !running || !exact;
    } else {
      orderEl.innerHTML = `<strong>손님 대기 중</strong><span>장사를 시작하면 손님이 찾아와요!</span>`;
      serveBtn.disabled = true;
    }
    renderMolds();
  }

  serveBtn.addEventListener("click", () => {
    if (!running || !customer) return;
    for (const k of Object.keys(FILLINGS)) {
      if (bag[k] < customer.req[k]) return;
    }
    let count = 0;
    for (const k of Object.keys(FILLINGS)) {
      bag[k] -= customer.req[k];
      count += customer.req[k];
    }
    combo++;
    servedCount++;
    const pts = count * 120 + combo * 40;
    score += pts;
    window.cafeAudioPlay?.("chime");
    statusEl.textContent = `🎉 "${customer.who}님 감사합니다!" +${pts}점 (${combo}콤보!)`;
    nextCustomer();
  });

  trashBtn.addEventListener("click", () => {
    bag = { pat: 0, cream: 0, pizza: 0 };
    combo = 0;
    renderUi();
  });

  dialog.querySelectorAll("[data-bungeo-tool]").forEach((btn) => {
    btn.addEventListener("click", () => selectTool(btn.dataset.bungeoTool));
  });

  function stopGame(finished = false, pauseOnly = false) {
    running = false;
    clearInterval(timer);
    if (pauseOnly) {
      paused = true;
      startBtn.textContent = "이어서 장사";
      statusEl.textContent = "잠깐 불을 줄여뒀어요. [이어서 장사]를 누르면 이어서 구워요!";
      renderUi();
      return;
    }
    paused = false;
    startBtn.textContent = "다시 장사 시작";
    if (finished) {
      const reward = window.cafeRewardGameEnd?.("bungeoppang", score, { label: "붕어빵 포차 알바" });
      const gText = reward ? ` · +${reward.awarded} G` : "";
      statusEl.textContent = `영업 종료! 총 ${servedCount}명 서빙 · ${score.toLocaleString()}점 달성!${gText}`;
      const record = submitArcadeScore("bungeoppang", score, { metric: `${servedCount}봉투 완판` });
      showCafeGameResult(dialog, { title: "포차 영업 종료", metric: `${score.toLocaleString()}점 · ${servedCount}명 서빙`, record: score > 0 ? record : null, action: startBtn });
    }
    renderUi();
  }

  function startLoop() {
    clearInterval(timer);
    timer = setInterval(() => {
      if (!running || document.hidden) return;
      remaining -= 0.5;
      for (const m of molds) {
        if (m.stage === "filled") {
          m.heat += 0.5;
          if (m.heat >= 9.0) { m.stage = "burnt"; combo = 0; }
        } else if (m.stage === "flipped") {
          m.heat += 0.5;
          if (m.heat >= 3.0) { m.stage = "golden"; m.heat = 0; }
        } else if (m.stage === "golden") {
          m.heat += 0.5;
          if (m.heat >= 6.5) { m.stage = "burnt"; combo = 0; }
        }
      }
      if (remaining <= 0) {
        remaining = 0;
        stopGame(true);
      } else {
        timeEl.textContent = Math.ceil(remaining) + "초";
        renderMolds();
      }
    }, 500);
  }

  startBtn.addEventListener("click", () => {
    if (paused && remaining > 0) {
      paused = false;
      running = true;
      startBtn.textContent = "영업 중 (재시작)";
      window.cafeWorld?.setActivity("game:bungeoppang");
      statusEl.textContent = "이어서 영업 중! 황금빛일 때 꺼내 서빙하세요!";
      renderUi();
      startLoop();
      return;
    }
    resetMolds();
    bag = { pat: 0, cream: 0, pizza: 0 };
    score = 0; combo = 0; servedCount = 0; remaining = 75;
    running = true;
    paused = false;
    startBtn.textContent = "영업 중 (재시작)";
    selectTool("batter");
    window.cafeWorld?.setActivity("game:bungeoppang");
    nextCustomer();
    statusEl.textContent = "1. 반죽 붓기 → 2. 앙금 넣기 → 3. 뒤집기 → 4. 황금빛일 때 꺼내 서빙!";
    startLoop();
  });

  dialog.addEventListener("close", () => {
    if (running && remaining > 0) stopGame(false, true);
    else stopGame(false, false);
    window.cafeWorld?.setActivity("");
  });

  resetMolds();
  selectTool("batter");
  renderUi();
}

// ============================================================================
// 2. CAT SNACK BAR TYCOON (알바냥의 매점 러시)
// ============================================================================
export function initSnackTycoon() {
  const dialog = document.getElementById("snack-tycoon");
  const ticketsEl = document.getElementById("tycoon-tickets");
  const trayEl = document.getElementById("tycoon-tray");
  const stationsEl = document.getElementById("tycoon-stations");
  const scoreEl = document.getElementById("tycoon-score");
  const timeEl = document.getElementById("tycoon-time");
  const comboEl = document.getElementById("tycoon-combo");
  const statusEl = document.getElementById("tycoon-status");
  const startBtn = document.getElementById("tycoon-start");
  const serveBtn = document.getElementById("tycoon-serve");
  const clearBtn = document.getElementById("tycoon-clear");

  mountLeaderboardBox(dialog, "tycoon", () => "standard", (s, m) => `${s.toLocaleString()}점${m ? ` (${m})` : ""}`);

  const INGREDIENTS = [
    { id: "jjajang", label: "🍜 짜장면" },
    { id: "tteok", label: "🌶️ 떡볶이" },
    { id: "skewer", label: "🍢 소떡꼬치" },
    { id: "cheese", label: "🧀 치즈" },
    { id: "egg", label: "🍳 반숙계란" },
    { id: "ice", label: "🧊 얼음컵" },
    { id: "bacchus", label: "⚡ 박카스" },
    { id: "cider", label: "🫧 사이다" },
    { id: "peachtea", label: "🍑 복숭아티" },
    { id: "shot", label: "☕ 샷추가" },
  ];

  const RECIPES = [
    { id: "jjagyechi", name: "짜계치", steps: ["jjajang", "cheese", "egg"], hint: "짜장면 + 치즈 + 반숙계란" },
    { id: "eolbaksa", name: "얼박사", steps: ["ice", "bacchus", "cider"], hint: "얼음컵 + 박카스 + 사이다" },
    { id: "ashatchu", name: "아샷추", steps: ["ice", "peachtea", "shot"], hint: "얼음컵 + 복숭아티 + 샷추가" },
    { id: "rabokki", name: "치즈떡볶이", steps: ["tteok", "cheese", "egg"], hint: "떡볶이 + 치즈 + 반숙계란" },
    { id: "cheeseskewer", name: "치즈소떡", steps: ["skewer", "cheese"], hint: "소떡꼬치 + 치즈" },
  ];

  let tickets = [];
  let tray = [];
  let score = 0, combo = 0, delivered = 0, remaining = 70;
  let running = false, paused = false, timer = 0;

  const seatsPool = ["A01", "A14", "A27", "A42", "1인석 1", "2인룸 1", "2인룸 2", "5인룸", "6인룸"];

  function spawnTicket() {
    const recipe = RECIPES[Math.floor(Math.random() * RECIPES.length)];
    const seat = seatsPool[Math.floor(Math.random() * seatsPool.length)];
    tickets.push({ id: crypto.randomUUID(), seat, recipe });
  }

  stationsEl.replaceChildren(...INGREDIENTS.map((ing) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "walk-button tycoon-ing";
    const sprite = { skewer: "skewer", cheese: "cheese", cider: "cider", peachtea: "peach", shot: "coffee" }[ing.id];
    if (sprite) btn.append(foodIcon(sprite));
    btn.append(sprite ? ing.label.split(" ").slice(1).join(" ") : ing.label);
    btn.addEventListener("click", () => {
      if (!running) {
        statusEl.textContent = "[알바 시작] 버튼을 눌러 오픈키친을 가동하세요!";
        return;
      }
      if (tray.length >= 4) return;
      tray.push(ing);
      window.cafeAudioPlay?.("tick");
      render();
    });
    return btn;
  }));

  function render() {
    scoreEl.textContent = score.toLocaleString();
    timeEl.textContent = remaining + "초";
    comboEl.textContent = combo + "콤보";

    ticketsEl.replaceChildren(...tickets.map((t, idx) => {
      const card = document.createElement("div");
      card.className = "tycoon-ticket" + (idx === 0 ? " is-next" : "");
      card.innerHTML = `<span class="mono">${t.seat}</span><strong>${t.recipe.name}</strong><small>${t.recipe.hint}</small>`;
      card.querySelector("strong").prepend(foodIcon(t.recipe.id === "cheeseskewer" ? "skewer" : t.recipe.id), " ");
      return card;
    }));

    trayEl.textContent = tray.length
      ? "현재 조리대: " + tray.map((i) => i.label).join(" → ")
      : "조리대가 비어 있어요. 재료를 순서에 상관없이 골라 담아 완성하세요!";

    serveBtn.disabled = !running || tray.length === 0;
  }

  serveBtn.addEventListener("click", () => {
    if (!running || !tray.length) return;
    const pickedIds = tray.map((i) => i.id).sort().join(",");
    const matchIndex = tickets.findIndex((t) => t.recipe.steps.slice().sort().join(",") === pickedIds);
    if (matchIndex >= 0) {
      const done = tickets.splice(matchIndex, 1)[0];
      tray = [];
      combo++;
      delivered++;
      const pts = 130 + combo * 35;
      score += pts;
      window.cafeAudioPlay?.("chime");
      statusEl.textContent = `🛎️ ${done.seat} [${done.recipe.name}] 조리 완료! +${pts}점!`;
      while (tickets.length < 3) spawnTicket();
    } else {
      combo = 0;
      tray = [];
      window.cafeAudioPlay?.("thud");
      statusEl.textContent = "앗, 주문서 레시피와 재료가 달라요! 조리대를 비웠어요.";
    }
    render();
  });

  clearBtn.addEventListener("click", () => {
    tray = [];
    render();
  });

  function stopTycoon(finished = false, pauseOnly = false) {
    running = false;
    clearInterval(timer);
    if (pauseOnly) {
      paused = true;
      startBtn.textContent = "이어서 알바";
      statusEl.textContent = "잠시 쉬는 중! [이어서 알바]를 누르면 이어서 배달해요.";
      render();
      return;
    }
    paused = false;
    startBtn.textContent = "알바 다시 시작";
    if (finished) {
      const reward = window.cafeRewardGameEnd?.("tycoon", score, { label: "알바냥 매점 러시" });
      const gText = reward ? ` · +${reward.awarded} G` : "";
      statusEl.textContent = `교대 시간! 총 ${delivered}건 배달 · ${score.toLocaleString()}점 달성!${gText}`;
      const record = submitArcadeScore("tycoon", score, { metric: `${delivered}건 조리` });
      showCafeGameResult(dialog, { title: "매점 교대 시간", metric: `${score.toLocaleString()}점 · ${delivered}건 배달`, record: score > 0 ? record : null, action: startBtn });
    }
    render();
  }

  function startTycoonLoop() {
    clearInterval(timer);
    timer = setInterval(() => {
      if (!running || document.hidden) return;
      remaining--;
      if (remaining <= 0) {
        remaining = 0;
        stopTycoon(true);
      } else {
        timeEl.textContent = remaining + "초";
      }
    }, 1000);
  }

  startBtn.addEventListener("click", () => {
    if (paused && remaining > 0) {
      paused = false;
      running = true;
      startBtn.textContent = "근무 중 (재시작)";
      window.cafeWorld?.setActivity("game:tycoon");
      statusEl.textContent = "이어서 배달 중! 주문서 레시피를 조합하세요!";
      render();
      startTycoonLoop();
      return;
    }
    tickets = [];
    tray = [];
    score = 0; combo = 0; delivered = 0; remaining = 70;
    running = true;
    paused = false;
    for (let i = 0; i < 3; i++) spawnTicket();
    startBtn.textContent = "근무 중 (재시작)";
    window.cafeWorld?.setActivity("game:tycoon");
    statusEl.textContent = "주문서 힌트를 보고 재료를 담은 뒤 [배달 출발!]을 누르세요!";
    render();
    startTycoonLoop();
  });

  dialog.addEventListener("close", () => {
    if (running && remaining > 0) stopTycoon(false, true);
    else stopTycoon(false, false);
    window.cafeWorld?.setActivity("");
  });

  render();
}
