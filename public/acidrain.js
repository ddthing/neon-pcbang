// Seoul Midnight Neon Acid Rain Typing Defense (with Mechanical Switch Audio: Blue / Brown / Red)
import { mountLeaderboardBox, submitArcadeScore } from "./arcade-leaderboard.js";
import { showCafeGameResult } from "./cafe-game-result.js";

const WORDS = [
  "길모퉁이", "얼박사", "짜계치", "아샷추", "소떡소떡", "우리동네", "코지카페", "비오는날",
  "기계식키보드", "청축타건음", "승급전", "붕어빵", "슈크림", "단골쿠폰", "고양이알바", "빗소리",
  "야외테라스", "밀크커피", "김치볶음밥", "치킨마요", "구슬아이스크림", "회오리감자", "하이스코어",
  "따뜻한우드", "오후햇살", "골목길", "새벽감성", "집중모드", "오목한판", "알까기명인",
  "헤드셋", "모니터", "프로게이머", "역전승", "퍼펙트", "만두추가", "치즈라볶이", "살얼음",
];
const SPECIALS = [
  { word: "백신가동", kind: "clear", color: "#f6cf73", label: "⚡ 전체 정화" },
  { word: "시간감속", kind: "slow", color: "#89c4e1", label: "⏳ 슬로우" },
  { word: "실드복구", kind: "heal", color: "#e8748c", label: "💚 실드+1" },
];

export function initAcidRain() {
  const dialog = document.getElementById("acidrain");
  const canvas = document.getElementById("acid-canvas");
  const ctx = canvas.getContext("2d");
  const form = document.getElementById("acid-form");
  const input = document.getElementById("acid-input");
  const scoreEl = document.getElementById("acid-score");
  const cpmEl = document.getElementById("acid-cpm");
  const hpEl = document.getElementById("acid-hp");
  const waveEl = document.getElementById("acid-wave");
  const switchSelect = document.getElementById("acid-switch");
  const statusEl = document.getElementById("acid-status");
  const startBtn = document.getElementById("acid-start");
  const pauseBtn = document.getElementById("acid-pause");

  mountLeaderboardBox(dialog, "acidrain", () => "standard", (s, m) => `${s.toLocaleString()}점${m ? ` (${m})` : ""}`);

  let drops = [];
  let sparks = [];
  let score = 0, hp = 5, wave = 1, clearedWords = 0, typedChars = 0;
  let elapsedActiveMs = 0, slowUntil = 0, hitInvulnUntil = 0, spawnTimer = 0, lastTime = 0, raf = 0;
  let state = "idle"; // idle | playing | paused | over

  function playSwitchSound() {
    window.cafeAudioKeySwitch?.(switchSelect.value);
  }

  function pickLaneX() {
    const lanes = [58, 144, 230, 316, 402];
    const safeLanes = lanes.filter((lx) => !drops.some((d) => Math.abs(d.x - lx) < 56 && d.y < 105));
    const pool = safeLanes.length ? safeLanes : lanes;
    return pool[Math.floor(Math.random() * pool.length)] + (Math.random() * 14 - 7);
  }

  function spawnDrop() {
    const laneX = pickLaneX();
    const isSpecial = Math.random() < 0.14;
    if (isSpecial) {
      const sp = SPECIALS[Math.floor(Math.random() * SPECIALS.length)];
      drops.push({
        text: sp.word,
        kind: sp.kind,
        color: sp.color,
        x: laneX,
        y: -32,
        speed: 17 + wave * 3.2,
      });
      return;
    }
    const existing = new Set(drops.map((d) => d.text));
    const available = WORDS.filter((w) => !existing.has(w));
    const wordPool = available.length ? available : WORDS;
    const text = wordPool[Math.floor(Math.random() * wordPool.length)];
    drops.push({
      text,
      kind: "normal",
      color: "#fbe3d3",
      x: laneX,
      y: -32,
      speed: 15 + wave * 3.5 + Math.random() * 5,
    });
  }

  function burstAt(x, y, color) {
    for (let i = 0; i < 10; i++) {
      sparks.push({
        x, y,
        vx: (Math.random() - 0.5) * 120,
        vy: (Math.random() - 0.6) * 110,
        color,
        life: 0.4,
      });
    }
  }

  function updateHud() {
    scoreEl.textContent = score.toLocaleString();
    hpEl.textContent = "♥".repeat(Math.max(0, hp)) + "♡".repeat(Math.max(0, 5 - hp));
    waveEl.textContent = "W" + wave;
    const elapsedMin = elapsedActiveMs ? Math.max(0.08, elapsedActiveMs / 60000) : 1;
    const cpm = elapsedActiveMs ? Math.round((typedChars * 2.4) / elapsedMin) : 0;
    cpmEl.textContent = cpm + "타";
  }

  function draw() {
    const W = canvas.width, H = canvas.height;
    // Cozy warm evening town sky + pixel roofs
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#d0bfe4");
    grad.addColorStop(1, "#f4d4df");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "#594148";
    for (let i = 0; i < 12; i++) {
      const bx = i * 42, bh = 38 + (i * 19) % 46;
      ctx.fillRect(bx, H - 22 - bh, 36, bh);
      ctx.fillStyle = "#ffe7a877";
      ctx.fillRect(bx + 6, H - 14 - bh, 4, 4);
      ctx.fillRect(bx + 18, H - 22 - bh + 12, 4, 4);
      ctx.fillStyle = "#594148";
    }

    ctx.fillStyle = hp <= 2 ? "#e8748c" : "#f6cf73";
    ctx.fillRect(0, H - 22, W, 3);
    ctx.fillStyle = "#4c383d";
    ctx.fillRect(0, H - 19, W, 19);

    ctx.font = "bold 13px Pretendard, Malgun Gothic, sans-serif";
    ctx.textAlign = "center";
    const currentInput = input.value.trim();
    for (const d of drops) {
      const matching = currentInput && d.text.startsWith(currentInput);
      const pillW = Math.max(52, d.text.length * 14 + 14);
      ctx.fillStyle = matching ? "#cbe3d4" : "#f7efe5";
      ctx.fillRect(d.x - pillW / 2, d.y - 14, pillW, 20);
      ctx.strokeStyle = matching ? "#4a6d56" : "#5c4742";
      ctx.lineWidth = matching ? 1.8 : 1;
      ctx.strokeRect(d.x - pillW / 2, d.y - 14, pillW, 20);
      ctx.fillStyle = "#493646";
      ctx.fillText(d.text, d.x, d.y);
      if (d.kind !== "normal") {
        ctx.fillStyle = d.color;
        ctx.fillRect(d.x - pillW / 2 + 3, d.y - 11, 4, 14);
      }
    }

    for (const sp of sparks) {
      ctx.globalAlpha = Math.max(0, sp.life / 0.4);
      ctx.fillStyle = sp.color;
      ctx.fillRect(sp.x, sp.y, 3, 3);
    }
    ctx.globalAlpha = 1;
  }

  function finish() {
    state = "over";
    cancelAnimationFrame(raf);
    startBtn.textContent = "다시 도전";
    if (pauseBtn) pauseBtn.hidden = true;
    const cpmText = cpmEl.textContent;
    const reward = window.cafeRewardGameEnd?.("acidrain", score, { label: "네온 산성비 방어" });
    const gText = reward ? ` · +${reward.awarded} G` : "";
    statusEl.textContent = `방화벽 종료! 최종 ${score.toLocaleString()}점 (${cpmText})${gText}`;
    const record = submitArcadeScore("acidrain", score, { metric: `${cpmText} · W${wave}` });
    showCafeGameResult(dialog, { title: "방어 종료", metric: `${score.toLocaleString()}점 · ${cpmText}`, record: score > 0 ? record : null, action: startBtn });
  }

  function pauseGame() {
    if (state !== "playing") return;
    state = "paused";
    cancelAnimationFrame(raf);
    lastTime = 0;
    if (pauseBtn) {
      pauseBtn.hidden = false;
      pauseBtn.textContent = "이어하기";
    }
    statusEl.textContent = "일시 정지 중이에요. [이어하기]를 누르면 이어서 진행해요.";
  }

  function resumeGame() {
    if (state !== "paused") return;
    state = "playing";
    lastTime = 0;
    if (pauseBtn) {
      pauseBtn.hidden = false;
      pauseBtn.textContent = "일시정지";
    }
    statusEl.textContent = "단어를 입력하고 Enter를 치세요!";
    window.cafeWorld?.setActivity("game:acidrain");
    input.focus({ preventScroll: true });
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }

  function loop(now) {
    if (state !== "playing") return;
    const dt = lastTime ? Math.min(0.05, (now - lastTime) / 1000) : 0;
    lastTime = now;
    elapsedActiveMs += dt * 1000;

    const earlyMul = elapsedActiveMs < 15000 ? 0.6 : 1;
    const speedMul = (now < slowUntil ? 0.42 : 1) * earlyMul;
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnDrop();
      spawnTimer = elapsedActiveMs < 15000 ? 2.2 : Math.max(0.65, 1.85 - wave * 0.11);
    }

    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i];
      d.y += d.speed * speedMul * dt;
      if (d.y >= canvas.height - 22) {
        burstAt(d.x, canvas.height - 24, "#ff5c70");
        drops.splice(i, 1);
        if (now >= hitInvulnUntil) {
          hitInvulnUntil = now + 800;
          hp--;
          window.cafeAudioPlay?.("thud");
          updateHud();
          if (hp <= 0) {
            draw();
            finish();
            return;
          }
        }
      }
    }

    for (const sp of sparks) {
      sp.life -= dt;
      sp.x += sp.vx * dt;
      sp.y += sp.vy * dt;
    }
    sparks = sparks.filter((s) => s.life > 0);

    draw();
    raf = requestAnimationFrame(loop);
  }

  input.addEventListener("input", () => {
    if (state === "playing") draw();
  });
  input.addEventListener("keydown", (e) => {
    if (e.key.length === 1 || e.key === "Backspace" || e.key === "Enter") playSwitchSound();
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (state !== "playing") return;
    const typed = input.value.trim();
    input.value = "";
    if (!typed) return;

    // Match lowest (most urgent) matching word first!
    let matchIdx = -1, lowestY = -Infinity;
    drops.forEach((d, idx) => {
      if (d.text === typed && d.y > lowestY) {
        lowestY = d.y;
        matchIdx = idx;
      }
    });

    if (matchIdx >= 0) {
      const hit = drops.splice(matchIdx, 1)[0];
      typedChars += hit.text.length;
      clearedWords++;
      wave = 1 + Math.floor(clearedWords / 8);
      const pts = hit.text.length * 25 + wave * 15;
      score += pts;
      burstAt(hit.x, hit.y, hit.color);

      if (hit.kind === "clear") {
        score += drops.length * 30;
        drops.forEach((d) => burstAt(d.x, d.y, "#5ef2d6"));
        drops = [];
        window.cafeAudioPlay?.("chime");
        statusEl.textContent = "⚡ 백신 가동! 화면의 모든 산성비를 정화했어요!";
      } else if (hit.kind === "slow") {
        slowUntil = performance.now() + 5500;
        window.cafeAudioPlay?.("chime");
        statusEl.textContent = "⏳ 5.5초 동안 산성비 낙하 속도가 느려집니다!";
      } else if (hit.kind === "heal") {
        hp = Math.min(5, hp + 1);
        window.cafeAudioPlay?.("chime");
        statusEl.textContent = "💚 방화벽 실드 1칸 복구!";
      } else {
        window.cafeAudioPlay?.("pop");
        statusEl.textContent = `정확해요! +${pts}점`;
      }
      updateHud();
      draw();
    } else {
      statusEl.textContent = `"${typed}" — 일치하는 단어가 없어요!`;
    }
  });

  startBtn.addEventListener("click", () => {
    drops = [];
    sparks = [];
    score = 0; hp = 5; wave = 1; clearedWords = 0; typedChars = 0;
    elapsedActiveMs = 0;
    slowUntil = 0;
    hitInvulnUntil = 0;
    spawnTimer = -1.5;
    lastTime = 0;
    state = "playing";
    startBtn.textContent = "재시작";
    if (pauseBtn) {
      pauseBtn.hidden = false;
      pauseBtn.textContent = "일시정지";
    }
    statusEl.textContent = "단어를 입력하고 Enter를 치세요! 민트/노란/분홍 단어는 특수 아이템이에요.";
    window.cafeWorld?.setActivity("game:acidrain");
    updateHud();
    input.value = "";
    input.focus({ preventScroll: true });
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  });

  pauseBtn?.addEventListener("click", () => {
    if (state === "playing") pauseGame();
    else if (state === "paused") resumeGame();
  });

  dialog.addEventListener("close", () => {
    pauseGame();
    window.cafeWorld?.setActivity("");
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden || !dialog.open) {
      pauseGame();
    }
  });

  updateHud();
  draw();
}
