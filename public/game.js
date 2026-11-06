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
  let bricks, score, lives;
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
    ball.vx = 112;
    ball.vy = -147;
  }

  function updateHud() {
    document.getElementById("score").textContent = String(score).padStart(3, "0");
    document.getElementById("lives").textContent = lives;
  }

  function resetGame() {
    bricks = palette.flatMap((color, row) => Array.from({ length: 8 }, (_, col) => ({
      x: 16 + col * 57, y: 24 + row * 21, width: 49, height: 13, color
    })));
    score = 0;
    lives = 3;
    paddle.x = width / 2;
    resetBall();
    updateHud();
  }

  function draw() {
    ctx.fillStyle = "#292827";
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = "#3d3936";
    ctx.beginPath();
    for (let x = 0; x <= width; x += 16) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    for (let y = 0; y <= height; y += 16) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();

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
      score += 10;
      updateHud();
      if (!bricks.length) setState("finished", "한 판 더", "모든 벽돌을 깼어요!");
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
      updateHud();
      if (lives === 0) {
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
