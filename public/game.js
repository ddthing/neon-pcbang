"use strict";

{
  const arcade = document.getElementById("arcade");
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const action = document.getElementById("game-action");
  const status = document.getElementById("game-status");
  const width = canvas.width;
  const height = canvas.height;
  const paddle = { x: width / 2, y: height - 23, width: 82, height: 8 };
  const ball = { x: 0, y: 0, vx: 0, vy: 0, r: 4 };
  const palette = ["#c7b8cf", "#ada7ba", "#9eafb9", "#b4c5ad"];
  const keys = new Set();
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const scoreKey = "neon-pcbang-arcade-best";
  const hud = Object.fromEntries(["score", "lives", "game-round", "game-best", "game-combo"]
    .map((id) => [id, document.getElementById(id)]));
  let best = 0;
  try { best = Number(localStorage.getItem(scoreKey)) || 0; } catch {}
  let bricks, score, lives, round, combo;
  let sparks = [];
  let state = "idle";
  let frame = 0;
  let previousTime = 0;

  function setState(next, label, message) {
    state = next;
    action.textContent = label;
    status.textContent = message;
  }

  function resetBall() {
    ball.x = paddle.x;
    ball.y = paddle.y - 11;
    ball.vx = 112 + Math.min(round - 1, 9) * 3;
    ball.vy = -147 - Math.min(round - 1, 9) * 8;
  }

  function updateHud() {
    hud.score.textContent = String(score).padStart(3, "0");
    hud.lives.textContent = lives;
    hud["game-round"].textContent = String(round).padStart(2, "0");
    hud["game-best"].textContent = String(best).padStart(3, "0");
    hud["game-combo"].textContent = combo;
  }

  function resetBoard() {
    bricks = palette.flatMap((_, row) => Array.from({ length: 8 }, (_, col) => ({
      x: 16 + col * 57, y: 24 + row * 21, width: 49, height: 13,
      color: palette[(row + round - 1) % palette.length]
    })));
    sparks = [];
    combo = 0;
    paddle.x = width / 2;
    resetBall();
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
    gradient.addColorStop(0, "#27282a");
    gradient.addColorStop(1, "#1a1e1c");
    grid.fillStyle = gradient;
    grid.fillRect(0, 0, width, height);
    grid.strokeStyle = "#d0bc9c18";
    grid.beginPath();
    for (let x = 0; x <= width; x += 16) {
      grid.moveTo(x, 0);
      grid.lineTo(x, height);
    }
    for (let y = 0; y <= height; y += 16) {
      grid.moveTo(0, y);
      grid.lineTo(width, y);
    }
    grid.stroke();
  }

  function draw() {
    ctx.drawImage(background, 0, 0);
    for (const brick of bricks) {
      ctx.fillStyle = brick.color;
      ctx.fillRect(brick.x, brick.y, brick.width, brick.height);
      ctx.fillStyle = "#ffffff55";
      ctx.fillRect(brick.x + 2, brick.y + 2, brick.width - 4, 2);
      ctx.fillStyle = "#25202744";
      ctx.fillRect(brick.x, brick.y + brick.height - 3, brick.width, 3);
    }
    ctx.fillStyle = "#bfd0bb";
    ctx.fillRect(paddle.x - paddle.width / 2, paddle.y, paddle.width, paddle.height);
    ctx.fillStyle = "#edf0d9";
    ctx.fillRect(paddle.x - paddle.width / 2 + 3, paddle.y + 1, paddle.width - 6, 2);
    for (const spark of sparks) {
      ctx.globalAlpha = spark.life / .44;
      ctx.fillStyle = spark.color;
      ctx.fillRect(Math.round(spark.x), Math.round(spark.y), spark.size, spark.size);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#f3ece2";
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, 2 * Math.PI);
    ctx.fill();
  }

  function movePaddle(x) {
    paddle.x = Math.max(paddle.width / 2, Math.min(width - paddle.width / 2, x));
    if (state === "ready" || state === "idle") ball.x = paddle.x;
  }

  function update(dt) {
    for (const spark of sparks) {
      spark.life -= dt;
      spark.x += spark.vx * dt;
      spark.y += spark.vy * dt;
      spark.vy += 72 * dt;
    }
    if (sparks.length) sparks = sparks.filter((spark) => spark.life > 0);
    const direction = Number(keys.has("ArrowRight")) - Number(keys.has("ArrowLeft"));
    if (direction) movePaddle(paddle.x + direction * 360 * dt);

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
      bricks.splice(hit, 1);
      combo++;
      score += 10 + Math.min(combo - 1, 9) * 2;
      if (score > best) {
        best = score;
        try { localStorage.setItem(scoreKey, String(best)); } catch {}
      }
      if (!reducedMotion.matches) {
        sparks.splice(0, Math.max(0, sparks.length - 56));
        for (let index = 0; index < 12; index++) {
          sparks.push({
            x: ball.x, y: ball.y, vx: (Math.random() - .5) * 150,
            vy: (Math.random() - .68) * 105, size: index % 3 + 2, life: .44, color: brick.color,
          });
        }
      }
      updateHud();
      if (!bricks.length) {
        window.recordCafeStamp("game");
        setState("next", "다음 라운드", "라운드 클리어! 다음 라운드는 공이 더 빨라요.");
        action.focus();
      }
    }

    if (ball.vy > 0 && lastY + ball.r <= paddle.y && ball.y + ball.r >= paddle.y
        && Math.abs(ball.x - paddle.x) <= paddle.width / 2 + ball.r) {
      const offset = Math.max(-1, Math.min(1, (ball.x - paddle.x) / (paddle.width / 2)));
      const speed = Math.min(265, Math.hypot(ball.vx, ball.vy) + 6);
      ball.vx = speed * Math.sin(offset * 1.02);
      ball.vy = -speed * Math.cos(offset * 1.02);
      ball.y = paddle.y - ball.r;
    }
    if (ball.y - ball.r > height) {
      lives--;
      combo = 0;
      updateHud();
      if (lives === 0) {
        window.recordCafeStamp("game");
        setState("finished", "다시 도전", "게임 끝! 한 판 더 해볼까요?");
      } else {
        resetBall();
        setState("ready", "다음 공", "공을 놓쳤어요. 다음 공을 시작해요.");
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

  function pause() {
    if (state !== "playing") return;
    cancelAnimationFrame(frame);
    keys.clear();
    setState("paused", "이어서 하기", "잠깐 멈췄어요.");
  }

  action.addEventListener("click", () => {
    if (state === "playing") {
      pause();
      return;
    }
    if (state === "finished" || state === "idle") resetGame();
    if (state === "next") {
      round++;
      lives = Math.min(3, lives + 1);
      resetBoard();
    }
    previousTime = 0;
    setState("playing", "일시 정지", "플레이 중");
    canvas.focus();
    frame = requestAnimationFrame(animate);
  });
  arcade.addEventListener("close", pause);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) pause();
  });
  window.addEventListener("blur", () => keys.clear());

  arcade.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    keys.add(event.key);
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
  });

  resetGame();
  draw();
}

{
  const grid = document.getElementById("pair-grid");
  const status = document.getElementById("pair-status");
  const moveCount = document.getElementById("pair-moves");
  const matchCount = document.getElementById("pair-count");
  const motifs = [
    ["▦", "컴퓨터"], ["◆", "보석"], ["☾", "달"], ["☕", "머그컵"],
    ["♪", "음표"], ["✦", "별"], ["✿", "꽃"], ["♠", "잎사귀"]
  ];
  let first = null;
  let flipBack;
  let moves = 0;
  let matches = 0;

  function show(card, revealed) {
    card.button.textContent = revealed ? card.motif[0] : "·";
    card.button.classList.toggle("revealed", revealed);
    card.button.setAttribute("aria-label", card.position + "번 카드" + (revealed ? ", " + card.motif[1] : ", 뒤집혀 있음"));
  }

  function flip(card) {
    if (flipBack || first === card || card.matched) return;
    show(card, true);
    if (!first) {
      first = card;
      status.textContent = "다른 카드를 한 장 골라주세요.";
      return;
    }

    moveCount.textContent = ++moves;
    const other = first;
    first = null;
    if (other.motif === card.motif) {
      for (const match of [other, card]) {
        match.matched = true;
        match.button.classList.add("matched");
        match.button.setAttribute("aria-disabled", "true");
        match.button.setAttribute("aria-label", match.position + "번 카드, " + match.motif[1] + ", 짝 찾음");
      }
      matchCount.textContent = ++matches + " / " + motifs.length;
      status.textContent = matches === motifs.length ? moves + "번 만에 모든 짝을 찾았어요!" : "한 쌍을 찾았어요.";
      if (matches === motifs.length) window.recordCafeStamp("game");
    } else {
      status.textContent = "서로 다른 그림이에요.";
      flipBack = setTimeout(() => {
        show(other, false);
        show(card, false);
        flipBack = null;
        status.textContent = "카드를 한 장 골라주세요.";
      }, 650);
    }
  }

  function reset() {
    clearTimeout(flipBack);
    first = null;
    flipBack = null;
    moves = 0;
    matches = 0;
    moveCount.textContent = "0";
    matchCount.textContent = "0 / " + motifs.length;
    status.textContent = "카드를 한 장 골라주세요.";
    const deck = [...motifs, ...motifs];
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    grid.replaceChildren(...deck.map((motif, index) => {
      const button = document.createElement("button");
      const card = { button, motif, position: index + 1, matched: false };
      button.type = "button";
      button.className = "pair-card";
      show(card, false);
      button.addEventListener("click", () => flip(card));
      return button;
    }));
  }

  document.getElementById("pair-reset").addEventListener("click", () => {
    reset();
    grid.firstElementChild.focus();
  });
  reset();
}

{
  const dialog = document.getElementById("mines");
  const board = document.getElementById("mine-board");
  const status = document.getElementById("mine-status");
  const flagCount = document.getElementById("mine-flags");
  const clock = document.getElementById("mine-time");
  const toggle = document.getElementById("mine-toggle");
  const size = 9;
  const mineCount = 10;
  const safeCount = size * size - mineCount;
  const initialMessage = "첫 칸은 어디를 골라도 안전해요.";
  let state, flagMode, flags, opened, detonated, focusIndex;
  let elapsed = 0;
  let clockStart = null;
  let tick;

  const cells = Array.from({ length: size * size }, (_, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "mine-cell";
    button.dataset.index = index;
    const row = Math.floor(index / size);
    const col = index % size;
    const neighbors = [];
    for (let y = Math.max(0, row - 1); y <= Math.min(size - 1, row + 1); y++) {
      for (let x = Math.max(0, col - 1); x <= Math.min(size - 1, col + 1); x++) {
        if (y !== row || x !== col) neighbors.push(y * size + x);
      }
    }
    return { button, row, col, neighbors, index };
  });
  board.append(...cells.map(({ button }) => button));

  function drawTime() {
    const seconds = Math.floor((elapsed + (clockStart === null ? 0 : performance.now() - clockStart)) / 1000);
    clock.textContent = [Math.floor(seconds / 60), seconds % 60]
      .map((value) => String(value).padStart(2, "0")).join(":");
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

  function draw() {
    flagCount.textContent = mineCount - flags;
    toggle.setAttribute("aria-pressed", String(flagMode));
    toggle.disabled = state === "lost" || state === "won";
    board.dataset.state = state;
    for (const cell of cells) {
      const { button, row, col, count } = cell;
      let visual = "closed";
      let label = "닫힌 칸";
      let marker = "";
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
    if (focusIndex !== undefined) cells[focusIndex].button.tabIndex = -1;
    focusIndex = index;
    cells[index].button.tabIndex = 0;
    if (moveFocus) cells[index].button.focus();
  }

  function plantMines(first) {
    // The first click opens an empty patch, even when it lands on an edge.
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
    state = next;
    status.textContent = message;
    syncClock();
    window.recordCafeStamp("game");
  }

  function play(cell, mark) {
    if (cell.open || state === "won" || state === "lost") return;
    if (mark) {
      if (!cell.flag && flags === mineCount) {
        status.textContent = "깃발 10개를 모두 썼어요. 표시한 칸을 다시 누르면 깃발을 뺄 수 있어요.";
        return;
      }
      cell.flag = !cell.flag;
      flags += cell.flag ? 1 : -1;
      status.textContent = cell.flag ? "깃발을 꽂았어요." : "깃발을 뺐어요.";
    } else if (cell.flag) {
      status.textContent = "깃발이 있는 칸이에요. 먼저 깃발을 빼 주세요.";
      return;
    } else {
      if (state === "ready") {
        plantMines(cell);
        state = "playing";
        status.textContent = "주변 숫자를 단서로 안전한 칸을 찾아보세요.";
        syncClock();
      }
      if (cell.mine) {
        detonated = cell.index;
        finish("lost", "지뢰를 밟았어요. 새 게임으로 다시 도전해 보세요.");
      } else {
        const pending = [cell.index];
        while (pending.length) {
          const current = cells[pending.pop()];
          if (current.open || current.flag || current.mine) continue;
          current.open = true;
          opened++;
          if (current.count === 0) pending.push(...current.neighbors);
        }
        if (opened === safeCount) {
          flags = mineCount;
          finish("won", "성공! 안전한 칸 71개를 모두 열었어요.");
        } else {
          status.textContent = "안전한 칸 " + opened + " / " + safeCount + "개를 열었어요.";
        }
      }
    }
    draw();
  }

  function reset() {
    state = "ready";
    syncClock();
    elapsed = 0;
    flagMode = false;
    flags = 0;
    opened = 0;
    detonated = null;
    for (const cell of cells) {
      cell.button.tabIndex = -1;
      cell.mine = cell.open = cell.flag = false;
      cell.count = 0;
    }
    status.textContent = initialMessage;
    focusCell(0, false);
    drawTime();
    draw();
  }

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
    if (row >= 0 && row < size && col >= 0 && col < size) focusCell(row * size + col, true);
  });
  toggle.addEventListener("click", () => {
    flagMode = !flagMode;
    toggle.setAttribute("aria-pressed", String(flagMode));
    status.textContent = flagMode ? "깃발 모드예요. 칸을 누르면 깃발을 꽂거나 빼요." : "열기 모드예요. 칸을 누르면 열려요.";
  });
  document.getElementById("mine-reset").addEventListener("click", () => {
    reset();
    focusCell(0, true);
  });
  new MutationObserver(syncClock).observe(dialog, { attributes: true, attributeFilter: ["open"] });
  document.addEventListener("visibilitychange", syncClock);
  reset();
}
