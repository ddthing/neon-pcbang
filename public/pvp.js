// Seat-to-Seat Real-Time Multiplayer Arena (Omok 15x15 & Alkkagi Physics + Cat Clerk AI)
import { mountLeaderboardBox, submitArcadeScore } from "./arcade-leaderboard.js";
import { chooseAlkkagiAiShot, chooseOmokAiMove, hasFiveInARow } from "./pvp-ai.mjs";

function stepLocalAlkkagi(stonesInput, stoneId, rawVx, rawVy) {
  const R = 4.2;
  const stones = stonesInput.map((s) => ({ ...s, vx: 0, vy: 0 }));
  const shooter = stones.find((s) => s.id === stoneId && s.alive);
  if (!shooter) return null;
  const speed = Math.min(3.8, Math.hypot(rawVx, rawVy));
  const len = Math.hypot(rawVx, rawVy) || 1;
  shooter.vx = (rawVx / len) * speed;
  shooter.vy = (rawVy / len) * speed;
  const frames = [];
  for (let tick = 0; tick < 160; tick++) {
    let moving = false;
    for (const s of stones) {
      if (!s.alive) continue;
      if (Math.hypot(s.vx, s.vy) > 0.03) {
        moving = true;
        s.x += s.vx; s.y += s.vy;
        s.vx *= 0.962; s.vy *= 0.962;
        if (s.x < 3 || s.x > 97 || s.y < 3 || s.y > 97) { s.alive = false; s.vx = s.vy = 0; }
      } else s.vx = s.vy = 0;
    }
    for (let i = 0; i < stones.length; i++) {
      const a = stones[i]; if (!a.alive) continue;
      for (let j = i + 1; j < stones.length; j++) {
        const b = stones[j]; if (!b.alive) continue;
        const dx = b.x - a.x, dy = b.y - a.y, dist = Math.hypot(dx, dy);
        if (dist > 0 && dist < R * 2) {
          const nx = dx / dist, ny = dy / dist, overlap = (R * 2 - dist) * 0.52;
          a.x -= nx * overlap; a.y -= ny * overlap; b.x += nx * overlap; b.y += ny * overlap;
          const rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
          if (rel > 0) {
            const imp = rel * 0.94;
            a.vx -= imp * nx; a.vy -= imp * ny; b.vx += imp * nx; b.vy += imp * ny;
            moving = true;
          }
        }
      }
    }
    if (tick % 2 === 0) frames.push(stones.map((s) => ({ ...s })));
    if (!moving) break;
  }
  const hostAlive = stones.filter((s) => s.owner === "host" && s.alive).length;
  const guestAlive = stones.filter((s) => s.owner === "guest" && s.alive).length;
  const winner = !hostAlive && !guestAlive ? "draw" : !guestAlive ? "host" : !hostAlive ? "guest" : null;
  return { stones, frames, winner };
}

export function initPvp() {
  const dialog = document.getElementById("pvp");
  const canvas = document.getElementById("pvp-canvas");
  const ctx = canvas.getContext("2d");
  const statusEl = document.getElementById("pvp-status");
  const roomsList = document.getElementById("pvp-rooms");
  const modeSelect = document.getElementById("pvp-game-type");
  const aiLevelSelect = document.getElementById("pvp-ai-level");
  const seatInviteSelect = document.getElementById("pvp-invite-seat");
  const createBtn = document.getElementById("pvp-create");
  const aiBtn = document.getElementById("pvp-vs-ai");
  const leaveBtn = document.getElementById("pvp-leave");
  const winsKey = "neon-pcbang-pvp-wins";

  mountLeaderboardBox(dialog, "pvp", () => modeSelect.value, (s) => `${s}승`);

  let wins = 0;
  try { wins = Number(localStorage.getItem(winsKey)) || 0; } catch {}

  let mode = "lobby"; // "lobby" | "online" | "ai"
  let activeMatch = null;
  let matchId = "";
  let pollTimer = 0;
  let dragShot = null;
  let animFrames = null;
  let hoverCell = -1;

  function profile() {
    return window.cafeWorld?.getProfile?.() || { name: "손님", token: crypto.randomUUID() };
  }

  async function api(action, extra = {}) {
    const prof = profile();
    const seat = window.cafeSeating?.current?.() || "";
    const res = await fetch("./api/pvp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: prof.token, name: prof.name, seat, action, ...extra }),
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) throw new Error("pvp");
    return res.json();
  }

  function populateSeatInvite() {
    const peers = (window.cafeWorld?.getPeers?.() || []).filter((p) => p.seat);
    seatInviteSelect.replaceChildren();
    const allOpt = document.createElement("option");
    allOpt.value = "";
    allOpt.textContent = "매장 전체 공개 대국방";
    seatInviteSelect.append(allOpt);
    for (const p of peers) {
      const opt = document.createElement("option");
      opt.value = p.seat;
      opt.textContent = `${window.cafeSeating?.label?.(p.seat) || p.seat} · ${p.name}님 초대`;
      seatInviteSelect.append(opt);
    }
  }

  function recordWin(gameName) {
    wins++;
    try { localStorage.setItem(winsKey, String(wins)); } catch {}
    window.recordCafeStamp?.("game");
    window.cafeEarnPoints?.(35, "대국 승리 보너스");
    submitArcadeScore("pvp", wins, { mode: gameName, metric: `누적 ${wins}승` });
  }

  function startAiMatch() {
    const game = modeSelect.value;
    mode = "ai";
    matchId = "";
    leaveBtn.hidden = false;
    activeMatch = {
      game,
      status: "playing",
      hostName: profile().name || "나",
      guestName: "고양이 알바 AI 🐱",
      role: "host",
      turn: "host",
      winner: null,
      state: game === "alkkagi"
        ? {
          stones: [
            ...[18, 34, 50, 66, 82].map((x, i) => ({ id: "h" + i, owner: "host", x, y: i % 2 ? 78 : 82, alive: true })),
            ...[18, 34, 50, 66, 82].map((x, i) => ({ id: "g" + i, owner: "guest", x, y: i % 2 ? 22 : 18, alive: true })),
          ],
        }
        : { size: 15, board: new Array(225).fill(0), lastMove: -1, moveCount: 0 },
    };
    window.cafeWorld?.setActivity("game:pvp");
    statusEl.textContent = game === "alkkagi"
      ? "내 차례(흑돌●)! 내 돌을 드래그해서 튕기세요."
      : "내 차례(흑돌●)! 바둑판 교차점을 클릭해 두세요.";
    drawBoard();
  }

  function runAiTurn() {
    if (mode !== "ai" || !activeMatch || activeMatch.status !== "playing" || activeMatch.turn !== "guest") return;
    const difficulty = aiLevelSelect?.value || "hard";
    setTimeout(() => {
      if (mode !== "ai" || !activeMatch || activeMatch.status !== "playing") return;
      if (activeMatch.game === "omok") {
        const idx = chooseOmokAiMove(activeMatch.state.board, difficulty, 2);
        activeMatch.state.board[idx] = 2;
        activeMatch.state.lastMove = idx;
        activeMatch.state.moveCount++;
        window.cafeAudioPlay?.("tick");
        if (hasFiveInARow(activeMatch.state.board, idx, 2)) {
          activeMatch.status = "finished";
          activeMatch.winner = "guest";
          statusEl.textContent = "고양이 알바 AI 승리! 🐱 '냐하하 한 수 배웠냥!'";
        } else {
          activeMatch.turn = "host";
          statusEl.textContent = "내 차례(흑돌●)! 빈 교차점에 착수하세요.";
        }
        drawBoard();
      } else {
        const best = chooseAlkkagiAiShot(activeMatch.state.stones, stepLocalAlkkagi, difficulty, "guest");
        const sim = best?.sim;
        if (!sim) return;
        playAlkkagiAnimation(sim, () => {
          activeMatch.state.stones = sim.stones;
          if (sim.winner) {
            activeMatch.status = "finished";
            activeMatch.winner = sim.winner;
            if (sim.winner === "host") {
              statusEl.textContent = "🎉 승리! 알바냥의 돌을 모두 밀어냈어요!";
              recordWin("alkkagi");
            } else {
              statusEl.textContent = sim.winner === "draw" ? "동시 장외 무승부!" : "고양이 알바 AI 승리! 다시 도전해 보세요.";
            }
          } else {
            activeMatch.turn = "host";
            statusEl.textContent = "내 차례(흑돌●)! 돌을 당겼다 놓아 튕기세요.";
          }
          drawBoard();
        });
      }
    }, 420);
  }

  function playAlkkagiAnimation(sim, onDone) {
    if (!sim?.frames?.length) { onDone(); return; }
    window.cafeAudioPlay?.("pop");
    animFrames = sim.frames.slice();
    function stepAnim() {
      if (!animFrames?.length) {
        animFrames = null;
        onDone();
        return;
      }
      drawBoard(animFrames.shift());
      requestAnimationFrame(stepAnim);
    }
    requestAnimationFrame(stepAnim);
  }

  function drawStone(px, py, r, isBlack, highlight = false) {
    ctx.fillStyle = "#1a130d55";
    ctx.beginPath(); ctx.arc(px + 1.5, py + 2, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = isBlack ? "#22252a" : "#f5f1e6";
    ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = isBlack ? "#101214" : "#b8ae99";
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.fillStyle = isBlack ? "#687382" : "#ffffff";
    ctx.fillRect(px - r * 0.45, py - r * 0.45, Math.max(2, r * 0.32), Math.max(2, r * 0.32));
    if (highlight) {
      ctx.strokeStyle = "#f6cf73";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(px, py, r + 2.5, 0, Math.PI * 2); ctx.stroke();
    }
  }

  function drawBoard(overrideStones = null) {
    const W = canvas.width, H = canvas.height;
    // Crisp warm kaya-wood goban
    ctx.fillStyle = "#d8a668";
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "#5c3f20";
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, W - 4, H - 4);

    if (!activeMatch) {
      ctx.fillStyle = "#2b1f14cc";
      ctx.fillRect(28, H / 2 - 34, W - 56, 68);
      ctx.fillStyle = "#fff3dc";
      ctx.font = "bold 14px Pretendard, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("위에서 공개 대국방을 만들거나", W / 2, H / 2 - 6);
      ctx.fillText("고양이 알바 AI와 즉시 한 판 두어 보세요!", W / 2, H / 2 + 18);
      return;
    }

    if (activeMatch.game === "omok") {
      const pad = 20;
      const step = (W - pad * 2) / 14;
      ctx.strokeStyle = "#6e4c26";
      ctx.lineWidth = 1;
      for (let i = 0; i < 15; i++) {
        const pos = Math.round(pad + i * step) + 0.5;
        ctx.beginPath(); ctx.moveTo(pad, pos); ctx.lineTo(W - pad, pos); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(pos, pad); ctx.lineTo(pos, H - pad); ctx.stroke();
      }
      for (const [sr, sc] of [[3,3],[3,11],[7,7],[11,3],[11,11]]) {
        ctx.fillStyle = "#593b1b";
        ctx.fillRect(pad + sc * step - 2.5, pad + sr * step - 2.5, 5, 5);
      }
      if (hoverCell >= 0 && activeMatch.status === "playing" && activeMatch.turn === activeMatch.role && activeMatch.state.board[hoverCell] === 0) {
        const hr = Math.floor(hoverCell / 15), hc = hoverCell % 15;
        ctx.globalAlpha = 0.42;
        drawStone(pad + hc * step, pad + hr * step, step * 0.43, activeMatch.role === "host");
        ctx.globalAlpha = 1;
      }
      activeMatch.state.board.forEach((cell, idx) => {
        if (!cell) return;
        const r = Math.floor(idx / 15), c = idx % 15;
        drawStone(pad + c * step, pad + r * step, step * 0.44, cell === 1, idx === activeMatch.state.lastMove);
      });
    } else {
      // Alkkagi arena grid + stones
      ctx.strokeStyle = "#8a623655";
      ctx.lineWidth = 1;
      for (let i = 1; i < 8; i++) {
        const p = (W / 8) * i;
        ctx.beginPath(); ctx.moveTo(p, 10); ctx.lineTo(p, H - 10); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(10, p); ctx.lineTo(W - 10, p); ctx.stroke();
      }
      const stones = overrideStones || activeMatch.state.stones;
      for (const s of stones) {
        if (!s.alive) continue;
        const px = (s.x / 100) * W;
        const py = (s.y / 100) * H;
        const isMine = s.owner === activeMatch.role && activeMatch.turn === activeMatch.role && activeMatch.status === "playing";
        drawStone(px, py, W * 0.042, s.owner === "host", isMine);
      }
      if (dragShot) {
        const { stone, curX, curY } = dragShot;
        const sx = (stone.x / 100) * W;
        const sy = (stone.y / 100) * H;
        const vx = sx - curX;
        const vy = sy - curY;
        ctx.strokeStyle = "#f6cf73";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + vx * 1.35, sy + vy * 1.35);
        ctx.stroke();
      }
    }
  }

  function renderLobbyRooms(rooms = []) {
    const mySeat = window.cafeSeating?.current?.() || "";
    if (!rooms.length) {
      roomsList.innerHTML = `<p class="pvp-empty">열려 있는 방이 없어요. 새 대국방을 만들거나 AI와 대국해 보세요!</p>`;
      return;
    }
    roomsList.replaceChildren(...rooms.map((r) => {
      const row = document.createElement("div");
      row.className = "pvp-room-row";
      const gameLabel = r.game === "alkkagi" ? "🎯 알까기" : "⚫ 오목";
      const inviteBadge = r.invitedSeat && r.invitedSeat === mySeat ? " · 💌 내 좌석 초대!" : "";
      const info = document.createElement("span");
      info.innerHTML = `<strong>${gameLabel} · ${r.hostName}</strong><small>${r.status === "waiting" ? "대기 중" : `대국 중 (${r.guestName})`}${inviteBadge}</small>`;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "walk-button";
      btn.textContent = r.isMine ? "내 대국 보기" : r.status === "waiting" ? "참가하기" : "관전";
      btn.addEventListener("click", async () => {
        try {
          mode = "online";
          if (r.status === "waiting" && !r.isMine) {
            const res = await api("join", { matchId: r.id });
            activeMatch = res.match;
          } else {
            const res = await api("lobby", { matchId: r.id });
            activeMatch = res.match;
          }
          matchId = r.id;
          leaveBtn.hidden = false;
          window.cafeWorld?.setActivity("game:pvp");
          syncMatchUi();
        } catch {
          statusEl.textContent = "방에 입장하지 못했어요.";
        }
      });
      row.append(info, btn);
      return row;
    }));
  }

  let rewardedMatchId = "";
  function syncMatchUi() {
    if (!activeMatch) { drawBoard(); return; }
    const gName = activeMatch.game === "alkkagi" ? "알까기" : "오목";
    if (activeMatch.status === "waiting") {
      statusEl.textContent = `[${gName}] 상대 손님 입장을 기다리는 중... (${activeMatch.hostName})`;
    } else if (activeMatch.status === "finished") {
      if (activeMatch.winner === "draw") {
        statusEl.textContent = "무승부! 명승부였어요.";
      } else if (activeMatch.winner === activeMatch.role) {
        statusEl.textContent = `🎉 대국 승리! (${activeMatch.hostName} vs ${activeMatch.guestName})`;
        if (rewardedMatchId !== activeMatch.id) {
          rewardedMatchId = activeMatch.id;
          recordWin(activeMatch.game);
        }
      } else {
        const winName = activeMatch.winner === "host" ? activeMatch.hostName : activeMatch.guestName;
        statusEl.textContent = `${winName}님 승리! 한 판 더 도전해 보세요.`;
      }
    } else {
      const myTurn = activeMatch.turn === activeMatch.role;
      const roleStone = activeMatch.role === "host" ? "흑돌●" : activeMatch.role === "guest" ? "백돌○" : "관전 모드";
      statusEl.textContent = activeMatch.role === "spectator"
        ? `관전 중: ${activeMatch.hostName}(●) vs ${activeMatch.guestName}(○)`
        : myTurn
          ? `내 차례(${roleStone})! ${activeMatch.game === "alkkagi" ? "돌을 당겨서 튕기세요." : "교차점을 눌러 착수하세요."}`
          : `상대 차례를 기다리는 중... (${activeMatch.turn === "host" ? activeMatch.hostName : activeMatch.guestName})`;
    }
    drawBoard();
  }

  async function pollLobby() {
    clearTimeout(pollTimer);
    if (!dialog.open || document.hidden) return;
    if (mode !== "ai") {
      try {
        const res = await api("lobby", matchId ? { matchId } : {});
        renderLobbyRooms(res.rooms || []);
        if (matchId && res.match) {
          activeMatch = res.match;
          syncMatchUi();
        }
      } catch {}
    }
    pollTimer = setTimeout(pollLobby, matchId ? 1300 : 3200);
  }

  createBtn.addEventListener("click", async () => {
    try {
      const res = await api("create", { game: modeSelect.value, targetSeat: seatInviteSelect.value });
      mode = "online";
      activeMatch = res.match;
      matchId = res.match.id;
      leaveBtn.hidden = false;
      window.cafeWorld?.setActivity("game:pvp");
      syncMatchUi();
      pollLobby();
    } catch {
      statusEl.textContent = "대국방을 열지 못했어요. 잠시 후 다시 눌러주세요.";
    }
  });

  aiBtn.addEventListener("click", startAiMatch);

  leaveBtn.addEventListener("click", async () => {
    if (mode === "online" && matchId) {
      api("leave", { matchId }).catch(() => {});
    }
    mode = "lobby";
    matchId = "";
    activeMatch = null;
    leaveBtn.hidden = true;
    statusEl.textContent = "대국 모드를 고르고 상대를 초대하거나 AI와 대국하세요.";
    drawBoard();
    pollLobby();
  });

  function canvasCoords(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * canvas.width / rect.width,
      y: (e.clientY - rect.top) * canvas.height / rect.height,
    };
  }

  canvas.addEventListener("pointermove", (e) => {
    if (!activeMatch || activeMatch.status !== "playing") return;
    const { x, y } = canvasCoords(e);
    if (activeMatch.game === "omok") {
      const pad = 20, step = (canvas.width - 40) / 14;
      const c = Math.round((x - pad) / step), r = Math.round((y - pad) / step);
      const nextHover = (r >= 0 && r < 15 && c >= 0 && c < 15) ? r * 15 + c : -1;
      if (nextHover !== hoverCell) { hoverCell = nextHover; drawBoard(); }
    } else if (dragShot) {
      dragShot.curX = x;
      dragShot.curY = y;
      drawBoard();
    }
  });

  canvas.addEventListener("pointerdown", async (e) => {
    if (!activeMatch || activeMatch.status !== "playing" || animFrames) return;
    if (activeMatch.turn !== activeMatch.role) return;
    const { x, y } = canvasCoords(e);

    if (activeMatch.game === "omok") {
      const pad = 20, step = (canvas.width - 40) / 14;
      const c = Math.round((x - pad) / step), r = Math.round((y - pad) / step);
      if (r < 0 || r >= 15 || c < 0 || c >= 15) return;
      const index = r * 15 + c;
      if (activeMatch.state.board[index] !== 0) return;

      if (mode === "ai") {
        activeMatch.state.board[index] = 1;
        activeMatch.state.lastMove = index;
        activeMatch.state.moveCount++;
        window.cafeAudioPlay?.("tick");
        if (hasFiveInARow(activeMatch.state.board, index, 1)) {
          activeMatch.status = "finished";
          activeMatch.winner = "host";
          statusEl.textContent = "🎉 오목 승리! 알바냥을 이겼어요!";
          recordWin("omok");
        } else {
          activeMatch.turn = "guest";
          statusEl.textContent = "고양이 알바 AI가 수를 고민하고 있어요...";
          runAiTurn();
        }
        drawBoard();
      } else {
        try {
          const res = await api("move", { matchId, index });
          window.cafeAudioPlay?.("tick");
          activeMatch = res.match;
          syncMatchUi();
        } catch {}
      }
    } else {
      // Alkkagi drag aim
      const myStones = activeMatch.state.stones.filter((s) => s.owner === activeMatch.role && s.alive);
      const picked = myStones.find((s) => Math.hypot((s.x / 100) * canvas.width - x, (s.y / 100) * canvas.height - y) <= canvas.width * 0.065);
      if (!picked) return;
      canvas.setPointerCapture(e.pointerId);
      dragShot = { id: e.pointerId, stone: picked, curX: x, curY: y };
      drawBoard();
    }
  });

  canvas.addEventListener("pointerup", async (e) => {
    if (!dragShot || dragShot.id !== e.pointerId) return;
    const { stone, curX, curY } = dragShot;
    dragShot = null;
    const sx = (stone.x / 100) * canvas.width;
    const sy = (stone.y / 100) * canvas.height;
    const vx = (sx - curX) * 0.055;
    const vy = (sy - curY) * 0.055;
    if (Math.hypot(vx, vy) < 0.25) { drawBoard(); return; }

    if (mode === "ai") {
      const sim = stepLocalAlkkagi(activeMatch.state.stones, stone.id, vx, vy);
      if (!sim) return;
      playAlkkagiAnimation(sim, () => {
        activeMatch.state.stones = sim.stones;
        if (sim.winner) {
          activeMatch.status = "finished";
          activeMatch.winner = sim.winner;
          if (sim.winner === "host") {
            statusEl.textContent = "🎉 알까기 승리! 완벽한 샷이었어요!";
            recordWin("alkkagi");
          } else {
            statusEl.textContent = sim.winner === "draw" ? "동시 장외 무승부!" : "아쉽게 내 돌이 나갔어요!";
          }
        } else {
          activeMatch.turn = "guest";
          statusEl.textContent = "고양이 알바 AI가 조준 중...";
          runAiTurn();
        }
        drawBoard();
      });
    } else {
      try {
        const res = await api("move", { matchId, stoneId: stone.id, vx, vy });
        window.cafeAudioPlay?.("pop");
        activeMatch = res.match;
        syncMatchUi();
      } catch {
        drawBoard();
      }
    }
  });

  new MutationObserver(() => {
    if (dialog.open) {
      populateSeatInvite();
      drawBoard();
      pollLobby();
    } else {
      clearTimeout(pollTimer);
      window.cafeWorld?.setActivity("");
    }
  }).observe(dialog, { attributes: true, attributeFilter: ["open"] });

  drawBoard();
}
