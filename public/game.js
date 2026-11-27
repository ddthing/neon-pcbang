import { mountLeaderboardBox, submitArcadeScore } from "./arcade-leaderboard.js";

export function initArcade() {
  const arcade = document.getElementById("arcade");
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const action = document.getElementById("game-action");
  const status = document.getElementById("game-status");
  const width = canvas.width;
  const height = canvas.height;
  const paddle = { x: width / 2, y: height - 23, width: 84, baseWidth: 84, height: 8, wideUntil: 0 };
  const palette = ["#e8748c", "#c7aeb3", "#89c4e1", "#f6cf73", "#8ea147"];
  const keys = new Set();
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const scoreKey = "neon-pcbang-arcade-best";
  const hud = Object.fromEntries(["score", "lives", "game-round", "game-best", "game-combo"]
    .map((id) => [id, document.getElementById(id)]));

  mountLeaderboardBox(arcade, "arcade", () => "standard", (s, m) => `${s.toLocaleString()}점${m ? ` (${m})` : ""}`);

  let best = 0;
  try { best = Number(localStorage.getItem(scoreKey)) || 0; } catch {}
  let bricks, balls, capsules, score, lives, round, combo;
  let sparks = [];
  let state = "idle";
  let frame = 0;
  let previousTime = 0;

  function setState(next, label, message) {
    state = next;
    action.textContent = label;
    status.textContent = message;
  }

  function makeBall(x = paddle.x, y = paddle.y - 11, angleOffset = 0) {
    const speed = 185 + Math.min(round - 1, 9) * 9;
    const ang = 0.62 + angleOffset;
    return { x, y, vx: speed * Math.sin(ang), vy: -speed * Math.cos(ang), r: 4 };
  }

  function resetBalls() {
    balls = [makeBall()];
  }

  function updateHud() {
    hud.score.textContent = String(score).padStart(3, "0");
    hud.lives.textContent = lives;
    hud["game-round"].textContent = String(round).padStart(2, "0");
    hud["game-best"].textContent = String(best).padStart(3, "0");
    hud["game-combo"].textContent = combo;
  }

  function resetBoard() {
    const rowsCount = Math.min(6, 4 + Math.floor((round - 1) / 2));
    bricks = Array.from({ length: rowsCount }, (_, row) => Array.from({ length: 8 }, (_, col) => ({
      x: 16 + col * 57, y: 22 + row * 19, width: 49, height: 12,
      hp: row === 0 && round >= 2 ? 2 : 1,
      color: palette[(row + round - 1) % palette.length],
    }))).flat();
    sparks = [];
    capsules = [];
    combo = 0;
    paddle.width = paddle.baseWidth;
    paddle.wideUntil = 0;
    paddle.x = width / 2;
    resetBalls();
    updateHud();
  }

  function resetGame() {
    score = 0;
    lives = 3;
    round = 1;
    resetBoard();
  }

  const background = document.createElement("canvas");
  background.width = width;
  background.height = height;
  {
    const grid = background.getContext("2d");
    const gradient = grid.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, "#1c1f29");
    gradient.addColorStop(1, "#14181f");
    grid.fillStyle = gradient;
    grid.fillRect(0, 0, width, height);
    grid.strokeStyle = "#70f0d614";
    grid.beginPath();
    for (let x = 0; x <= width; x += 16) { grid.moveTo(x, 0); grid.lineTo(x, height); }
    for (let y = 0; y <= height; y += 16) { grid.moveTo(0, y); grid.lineTo(width, y); }
    grid.stroke();
  }

  function draw() {
    ctx.drawImage(background, 0, 0);
    for (const brick of bricks) {
      ctx.fillStyle = brick.color;
      ctx.fillRect(brick.x, brick.y, brick.width, brick.height);
      ctx.fillStyle = brick.hp > 1 ? "#ffffffaa" : "#ffffff55";
      ctx.fillRect(brick.x + 2, brick.y + 2, brick.width - 4, 2);
      ctx.fillStyle = "#14101866";
      ctx.fillRect(brick.x, brick.y + brick.height - 3, brick.width, 3);
    }
    for (const cap of capsules) {
      ctx.fillStyle = cap.kind === "multi" ? "#70f0d6" : cap.kind === "wide" ? "#ffd166" : "#ff85a1";
      ctx.fillRect(cap.x - 9, cap.y - 4, 18, 8);
      ctx.fillStyle = "#191c24";
      ctx.font = "bold 7px monospace";
      ctx.fillText(cap.kind === "multi" ? "M" : cap.kind === "wide" ? "W" : "+", cap.x - 3, cap.y + 3);
    }
    ctx.fillStyle = paddle.wideUntil > performance.now() ? "#70f0d6" : "#c5dec2";
    ctx.fillRect(paddle.x - paddle.width / 2, paddle.y, paddle.width, paddle.height);
    ctx.fillStyle = "#ffffffaa";
    ctx.fillRect(paddle.x - paddle.width / 2 + 3, paddle.y + 1, paddle.width - 6, 2);
    for (const spark of sparks) {
      ctx.globalAlpha = spark.life / .44;
      ctx.fillStyle = spark.color;
      ctx.fillRect(Math.round(spark.x), Math.round(spark.y), spark.size, spark.size);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#fff8eb";
    for (const ball of balls) {
      ctx.fillRect(Math.round(ball.x - ball.r), Math.round(ball.y - ball.r), ball.r * 2, ball.r * 2);
    }
  }

  function movePaddle(x) {
    paddle.x = Math.max(paddle.width / 2, Math.min(width - paddle.width / 2, x));
    if (state === "aiming" || state === "ready" || state === "idle") {
      balls.forEach((b) => { b.x = paddle.x; });
    }
  }

  function update(dt) {
    if (paddle.wideUntil && performance.now() > paddle.wideUntil) {
      paddle.wideUntil = 0;
      paddle.width = paddle.baseWidth;
    }
    for (const spark of sparks) {
      spark.life -= dt;
      spark.x += spark.vx * dt;
      spark.y += spark.vy * dt;
      spark.vy += 72 * dt;
    }
    if (sparks.length) sparks = sparks.filter((spark) => spark.life > 0);
    const direction = Number(keys.has("ArrowRight")) - Number(keys.has("ArrowLeft"));
    if (direction) movePaddle(paddle.x + direction * 380 * dt);

    // Powerup capsules
    for (let i = capsules.length - 1; i >= 0; i--) {
      const cap = capsules[i];
      cap.y += 95 * dt;
      if (cap.y >= paddle.y - 4 && cap.y <= paddle.y + paddle.height + 4 && Math.abs(cap.x - paddle.x) <= paddle.width / 2 + 8) {
        capsules.splice(i, 1);
        window.cafeAudioPlay?.("chime");
        if (cap.kind === "wide") {
          paddle.width = 122;
          paddle.wideUntil = performance.now() + 12000;
          status.textContent = "↔ 와이드 패들 아이템 발동!";
        } else if (cap.kind === "multi" && balls.length < 4) {
          const src = balls[0] || { x: paddle.x, y: paddle.y - 12 };
          balls.push(makeBall(src.x, src.y, -0.4), makeBall(src.x, src.y, 0.4));
          status.textContent = "⚡ 멀티볼 아이템 발동!";
        } else if (cap.kind === "life") {
          lives = Math.min(5, lives + 1);
          updateHud();
          status.textContent = "♥ 보너스 공 +1!";
        }
      } else if (cap.y > height + 10) {
        capsules.splice(i, 1);
      }
    }

    for (let bi = balls.length - 1; bi >= 0; bi--) {
      const ball = balls[bi];
      const lastY = ball.y;
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;
      if (ball.x <= ball.r || ball.x >= width - ball.r) {
        ball.x = Math.max(ball.r, Math.min(width - ball.r, ball.x));
        ball.vx *= -1;
      }
      if (ball.y <= ball.r) {
        ball.y = ball.r;
        ball.vy = Math.abs(ball.vy);
      }

      const hit = bricks.findIndex((b) => ball.x + ball.r >= b.x && ball.x - ball.r <= b.x + b.width
        && ball.y + ball.r >= b.y && ball.y - ball.r <= b.y + b.height);
      if (hit >= 0) {
        const brick = bricks[hit];
        if (lastY + ball.r <= brick.y || lastY - ball.r >= brick.y + brick.height) ball.vy *= -1;
        else ball.vx *= -1;
        brick.hp--;
        window.cafeAudioPlay?.("pop");
        if (brick.hp <= 0) {
          bricks.splice(hit, 1);
          if (Math.random() < 0.18) {
            const kinds = ["wide", "multi", "life"];
            capsules.push({ x: brick.x + brick.width / 2, y: brick.y + 6, kind: kinds[Math.floor(Math.random() * kinds.length)] });
          }
        }
        combo++;
        score += 10 + Math.min(combo - 1, 12) * 3;
        if (score > best) {
          best = score;
          try { localStorage.setItem(scoreKey, String(best)); } catch {}
        }
        if (!reducedMotion.matches) {
          sparks.splice(0, Math.max(0, sparks.length - 56));
          for (let index = 0; index < 10; index++) {
            sparks.push({
              x: ball.x, y: ball.y, vx: (Math.random() - .5) * 150,
              vy: (Math.random() - .68) * 105, size: index % 3 + 2, life: .44, color: brick.color,
            });
          }
        }
        updateHud();
        if (!bricks.length) {
          const reward = window.cafeRewardGameEnd?.("arcade", score, { winBonus: true, label: `벽돌깨기 라운드 ${round} 클리어` });
          submitArcadeScore("arcade", score, { metric: `R${round}` });
          setState("next", "다음 라운드", `라운드 클리어!${reward ? ` (+${reward.awarded} G)` : ""} 다음 스테이지로 가요.`);
          action.focus();
          return;
        }
      }

      if (ball.vy > 0 && lastY + ball.r <= paddle.y && ball.y + ball.r >= paddle.y
          && Math.abs(ball.x - paddle.x) <= paddle.width / 2 + ball.r) {
        const offset = Math.max(-1, Math.min(1, (ball.x - paddle.x) / (paddle.width / 2)));
        const speed = Math.min(285, Math.hypot(ball.vx, ball.vy) + 5);
        ball.vx = speed * Math.sin(offset * 1.04);
        ball.vy = -speed * Math.cos(offset * 1.04);
        ball.y = paddle.y - ball.r;
        window.cafeAudioPlay?.("tick");
      }
      if (ball.y - ball.r > height) {
        balls.splice(bi, 1);
      }
    }

    if (!balls.length) {
      lives--;
      combo = 0;
      updateHud();
      if (lives === 0) {
        if (score >= 120) submitArcadeScore("arcade", score, { metric: `R${round}` });
        const reward = window.cafeRewardGameEnd?.("arcade", score, { label: "벽돌깨기 플레이" });
        setState("finished", "다시 도전", `게임 끝! 최종 ${score}점${reward ? ` · +${reward.awarded} G` : ""}`);
      } else {
        resetBalls();
        setState("aiming", "공 발사", "←→ / 마우스로 조준 후 클릭 또는 Space로 공을 발사하세요!");
      }
      action.focus();
    }
  }

  function animate(time) {
    const dt = previousTime ? Math.min((time - previousTime) / 1000, 0.025) : 0;
    previousTime = time;
    update(dt);
    draw();
    if (state === "playing") frame = requestAnimationFrame(animate);
  }

  function launchAimedBall() {
    if (state !== "aiming" && state !== "ready") return;
    previousTime = 0;
    setState("playing", "일시 정지", "아이템 캡슐(W 와이드 · M 멀티볼 · + 보너스)을 받아보세요!");
    window.cafeWorld?.setActivity("game:arcade");
    canvas.focus();
    frame = requestAnimationFrame(animate);
  }

  function pause() {
    if (state !== "playing") return;
    cancelAnimationFrame(frame);
    keys.clear();
    setState("paused", "이어서 하기", "잠깐 멈췄어요. 이어서 하기를 누르면 진행 상태가 유지돼요.");
  }

  action.addEventListener("click", () => {
    if (state === "playing") { pause(); return; }
    if (state === "aiming" || state === "ready") { launchAimedBall(); return; }
    if (state === "paused") {
      previousTime = 0;
      setState("playing", "일시 정지", "이어서 플레이 중!");
      window.cafeWorld?.setActivity("game:arcade");
      canvas.focus();
      frame = requestAnimationFrame(animate);
      return;
    }
    if (state === "finished" || state === "idle") resetGame();
    if (state === "next") {
      round++;
      lives = Math.min(5, lives + 1);
      resetBoard();
    }
    setState("aiming", "공 발사", "←→ / 마우스로 패들 위치를 맞춘 뒤 화면 클릭 또는 Space로 발사하세요!");
    draw();
    canvas.focus();
  });
  arcade.addEventListener("close", () => { pause(); window.cafeWorld?.setActivity(""); });
  document.addEventListener("visibilitychange", () => { if (document.hidden) pause(); });
  window.addEventListener("blur", () => keys.clear());

  arcade.addEventListener("keydown", (event) => {
    if (event.code === "Space" && (state === "aiming" || state === "ready")) {
      event.preventDefault();
      launchAimedBall();
      return;
    }
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    keys.add(event.key);
    if (state === "aiming") {
      const dir = event.key === "ArrowRight" ? 1 : -1;
      movePaddle(paddle.x + dir * 18);
      draw();
    }
  });
  document.addEventListener("keyup", (event) => keys.delete(event.key));

  function pointAtPaddle(event) {
    const rect = canvas.getBoundingClientRect();
    movePaddle((event.clientX - rect.left) * width / rect.width);
    if (state !== "playing") draw();
  }
  canvas.addEventListener("pointermove", pointAtPaddle);
  canvas.addEventListener("pointerdown", (event) => {
    canvas.setPointerCapture(event.pointerId);
    pointAtPaddle(event);
    if (state === "aiming" || state === "ready") launchAimedBall();
  });

  resetGame();
  draw();
}

// ============================================================================
// MINESWEEPER REMASTER (3 Difficulty Tiers: 초급 9x9 / 중급 16x16 / 고급 24x16 + Chord!)
// ============================================================================
export function initMines() {
  const dialog = document.getElementById("mines");
  const board = document.getElementById("mine-board");
  const status = document.getElementById("mine-status");
  const flagCount = document.getElementById("mine-flags");
  const clock = document.getElementById("mine-time");
  const toggle = document.getElementById("mine-toggle");
  const tierButtons = [...dialog.querySelectorAll("[data-mine-tier]")];

  const TIERS = {
    easy: { label: "초급", cols: 9, rows: 9, mines: 10 },
    medium: { label: "중급", cols: 16, rows: 16, mines: 40 },
    hard: { label: "고급", cols: 24, rows: 16, mines: 80 },
  };

  let currentTierKey = "easy";
  let cols = 9, rows = 9, mineCount = 10, safeCount = 71;
  let cells = [];
  let state, flagMode, flags, opened, detonated, focusIndex;
  let elapsed = 0, clockStart = null, tick;

  const rankWidget = mountLeaderboardBox(dialog, "mines", () => currentTierKey, (s, m) => m || `${s}초`);

  function formatSeconds(sec) {
    return [Math.floor(sec / 60), sec % 60].map((v) => String(v).padStart(2, "0")).join(":");
  }

  function currentSeconds() {
    return Math.max(1, Math.floor((elapsed + (clockStart === null ? 0 : performance.now() - clockStart)) / 1000));
  }

  function drawTime() {
    const seconds = Math.floor((elapsed + (clockStart === null ? 0 : performance.now() - clockStart)) / 1000);
    clock.textContent = formatSeconds(seconds);
  }

  function syncClock() {
    if (state === "playing" && dialog.open && !document.hidden) {
      if (clockStart === null) {
        clockStart = performance.now();
        tick = setInterval(drawTime, 250);
      }
    } else if (clockStart !== null) {
      elapsed += performance.now() - clockStart;
      clockStart = null;
      clearInterval(tick);
    }
    drawTime();
  }

  function buildGrid() {
    const tier = TIERS[currentTierKey];
    cols = tier.cols;
    rows = tier.rows;
    mineCount = tier.mines;
    safeCount = cols * rows - mineCount;
    dialog.dataset.tier = currentTierKey;
    board.style.setProperty("--mine-cols", String(cols));
    board.setAttribute("aria-label", `지뢰찾기 ${tier.label} ${rows}행 ${cols}열`);

    cells = Array.from({ length: cols * rows }, (_, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "mine-cell";
      button.dataset.index = String(index);
      const row = Math.floor(index / cols);
      const col = index % cols;
      const neighbors = [];
      for (let y = Math.max(0, row - 1); y <= Math.min(rows - 1, row + 1); y++) {
        for (let x = Math.max(0, col - 1); x <= Math.min(cols - 1, col + 1); x++) {
          if (y !== row || x !== col) neighbors.push(y * cols + x);
        }
      }
      return { button, row, col, neighbors, index, mine: false, open: false, flag: false, count: 0 };
    });
    board.replaceChildren(...cells.map(({ button }) => button));
  }

  function draw() {
    flagCount.textContent = String(mineCount - flags);
    toggle.setAttribute("aria-pressed", String(flagMode));
    toggle.disabled = state === "lost" || state === "won";
    board.dataset.state = state;
    for (const btn of tierButtons) {
      btn.setAttribute("aria-pressed", String(btn.dataset.mineTier === currentTierKey));
    }
    for (const cell of cells) {
      const { button, row, col, count } = cell;
      let visual = "closed", label = "닫힌 칸", marker = "";
      if (cell.index === detonated) {
        visual = "hit"; label = "터진 지뢰"; marker = "✹";
      } else if (cell.flag && state === "lost" && !cell.mine) {
        visual = "wrong"; label = "잘못 꽂은 깃발"; marker = "×";
      } else if (cell.flag || (state === "won" && cell.mine)) {
        visual = "flag"; label = "깃발"; marker = "⚑";
      } else if (state === "lost" && cell.mine) {
        visual = "mine"; label = "지뢰"; marker = "✹";
      } else if (cell.open) {
        visual = "open"; label = count ? "주변 지뢰 " + count + "개" : "빈 칸"; marker = count || "";
      }
      button.dataset.cell = visual;
      button.dataset.number = visual === "open" ? count : "";
      button.textContent = marker;
      button.setAttribute("aria-label", (row + 1) + "행 " + (col + 1) + "열, " + label);
    }
  }

  function focusCell(index, moveFocus) {
    if (focusIndex !== undefined && cells[focusIndex]) cells[focusIndex].button.tabIndex = -1;
    focusIndex = index;
    if (!cells[index]) return;
    cells[index].button.tabIndex = 0;
    if (moveFocus) cells[index].button.focus();
  }

  function plantMines(first) {
    const safe = new Set([first.index, ...first.neighbors]);
    const candidates = cells.filter(({ index }) => !safe.has(index));
    for (let i = 0; i < mineCount; i++) {
      const pick = i + Math.floor(Math.random() * (candidates.length - i));
      [candidates[i], candidates[pick]] = [candidates[pick], candidates[i]];
      candidates[i].mine = true;
    }
    for (const cell of cells) {
      cell.count = cell.neighbors.filter((index) => cells[index].mine).length;
    }
  }

  function finish(next, message) {
    const clearSec = currentSeconds();
    state = next;
    status.textContent = message;
    syncClock();
    if (next === "won") {
      window.cafeAudioPlay?.("chime");
      const tierScore = currentTierKey === "hard" ? 450 : currentTierKey === "medium" ? 250 : 120;
      const reward = window.cafeRewardGameEnd?.("mines", tierScore, { winBonus: true, label: `지뢰찾기 ${TIERS[currentTierKey].label} 클리어` });
      if (reward) status.textContent = `${message} (+${reward.awarded} G)`;
      submitArcadeScore("mines", clearSec, {
        mode: currentTierKey,
        metric: `${TIERS[currentTierKey].label} ${formatSeconds(clearSec)}`,
      });
    } else {
      window.cafeAudioPlay?.("thud");
      const reward = window.cafeRewardGameEnd?.("mines", opened * 10, { label: "지뢰찾기 도전" });
      if (reward) status.textContent = `${message} (+${reward.awarded} G)`;
    }
  }

  function floodOpen(startIndices) {
    const pending = [...startIndices];
    while (pending.length) {
      const current = cells[pending.pop()];
      if (!current || current.open || current.flag) continue;
      if (current.mine) {
        detonated = current.index;
        finish("lost", "지뢰를 밟았어요! 새 게임으로 다시 도전해 보세요.");
        return;
      }
      current.open = true;
      opened++;
      if (current.count === 0) pending.push(...current.neighbors);
    }
    if (opened === safeCount) {
      flags = mineCount;
      finish("won", `🎉 ${TIERS[currentTierKey].label} 클리어! 안전한 칸 ${safeCount}개를 모두 열었어요!`);
    } else {
      status.textContent = `안전한 칸 ${opened} / ${safeCount}개 오픈`;
    }
  }

  function play(cell, mark) {
    if (state === "won" || state === "lost") return;
    // Chord quick-open on already opened number cell!
    if (cell.open) {
      if (cell.count > 0) {
        const flaggedNeighbors = cell.neighbors.filter((idx) => cells[idx].flag).length;
        if (flaggedNeighbors === cell.count) {
          const toOpen = cell.neighbors.filter((idx) => !cells[idx].open && !cells[idx].flag);
          if (toOpen.length) {
            window.cafeAudioPlay?.("tick");
            floodOpen(toOpen);
            draw();
          }
        }
      }
      return;
    }
    if (mark) {
      if (!cell.flag && flags === mineCount) {
        status.textContent = `깃발 ${mineCount}개를 모두 꽂았어요.`;
        return;
      }
      cell.flag = !cell.flag;
      flags += cell.flag ? 1 : -1;
      window.cafeAudioPlay?.("tick");
      status.textContent = cell.flag ? "깃발을 꽂았어요." : "깃발을 뺐어요.";
    } else if (cell.flag) {
      status.textContent = "깃발이 있는 칸이에요. 우클릭(또는 F)으로 깃발을 먼저 빼 주세요.";
      return;
    } else {
      if (state === "ready") {
        plantMines(cell);
        state = "playing";
        window.cafeWorld?.setActivity("game:mines");
        syncClock();
      }
      window.cafeAudioPlay?.("tick");
      floodOpen([cell.index]);
    }
    draw();
  }

  function reset(rebuild = false) {
    state = "ready";
    syncClock();
    elapsed = 0;
    flagMode = false;
    flags = 0;
    opened = 0;
    detonated = null;
    if (rebuild || !cells.length) buildGrid();
    else {
      for (const cell of cells) {
        cell.button.tabIndex = -1;
        cell.mine = cell.open = cell.flag = false;
        cell.count = 0;
      }
    }
    status.textContent = `[${TIERS[currentTierKey].label}] 첫 칸은 어디를 눌러도 안전해요! 열린 숫자를 다시 누르면 주변이 한 번에 열려요.`;
    focusCell(0, false);
    drawTime();
    draw();
    rankWidget.refresh();
  }

  tierButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      if (currentTierKey === btn.dataset.mineTier) return;
      currentTierKey = btn.dataset.mineTier;
      reset(true);
    });
  });

  board.addEventListener("click", (event) => {
    const button = event.target.closest(".mine-cell");
    if (!button) return;
    const index = Number(button.dataset.index);
    focusCell(index, false);
    play(cells[index], flagMode);
  });
  board.addEventListener("contextmenu", (event) => {
    const button = event.target.closest(".mine-cell");
    if (!button) return;
    event.preventDefault();
    const index = Number(button.dataset.index);
    focusCell(index, true);
    play(cells[index], true);
  });
  const directions = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
  board.addEventListener("keydown", (event) => {
    const button = event.target.closest(".mine-cell");
    if (!button || event.ctrlKey || event.metaKey || event.altKey) return;
    const cell = cells[Number(button.dataset.index)];
    if (event.key.toLowerCase() === "f") {
      event.preventDefault();
      if (!event.repeat) play(cell, true);
      return;
    }
    const direction = directions[event.key];
    if (!direction) return;
    event.preventDefault();
    const row = cell.row + direction[0];
    const col = cell.col + direction[1];
    if (row >= 0 && row < rows && col >= 0 && col < cols) focusCell(row * cols + col, true);
  });
  toggle.addEventListener("click", () => {
    flagMode = !flagMode;
    toggle.setAttribute("aria-pressed", String(flagMode));
    status.textContent = flagMode ? "깃발 모드예요." : "열기 모드예요.";
  });
  document.getElementById("mine-reset").addEventListener("click", () => {
    reset(false);
    focusCell(0, true);
  });
  dialog.addEventListener("close", () => {
    syncClock();
    window.cafeWorld?.setActivity("");
  });
  new MutationObserver(syncClock).observe(dialog, { attributes: true, attributeFilter: ["open"] });
  document.addEventListener("visibilitychange", syncClock);
  reset(true);
}
