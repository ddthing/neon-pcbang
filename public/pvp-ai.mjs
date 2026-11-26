// Pure Tactical AI Engine for Omok (15x15 Split-Pattern + 2-Ply Alpha-Beta) & Alkkagi (Physics Lookahead)
import { omokMoveVerdict } from "./omok-rules.mjs";

const SIZE = 15;
const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];

export function hasFiveInARow(board, index, stone) {
  const r0 = Math.floor(index / SIZE);
  const c0 = index % SIZE;
  for (const [dr, dc] of DIRS) {
    let count = 1;
    for (const s of [-1, 1]) {
      let r = r0 + dr * s;
      let c = c0 + dc * s;
      while (r >= 0 && r < SIZE && c >= 0 && c < SIZE && board[r * SIZE + c] === stone) {
        count++;
        r += dr * s;
        c += dc * s;
      }
    }
    if (count >= 5) return true;
  }
  return false;
}

function lineSignature(board, r0, c0, dr, dc, stone) {
  // Scan window [-4..+4] centered at (r0, c0) assuming board[r0, c0] = stone
  let mask = "";
  for (let d = -4; d <= 4; d++) {
    if (d === 0) {
      mask += "1";
      continue;
    }
    const r = r0 + dr * d;
    const c = c0 + dc * d;
    if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) {
      mask += "x";
    } else {
      const v = board[r * SIZE + c];
      mask += v === stone ? "1" : v === 0 ? "0" : "x";
    }
  }
  // Exact Five
  if (mask.includes("11111")) return { score: 1_000_000, isFour: true, isOpenThree: false };
  // Open Four (unstoppable next turn)
  if (mask.includes("011110")) return { score: 120_000, isFour: true, isOpenThree: false };
  // Closed/Split Four
  if (
    mask.includes("01111") || mask.includes("11110") ||
    mask.includes("10111") || mask.includes("11101") || mask.includes("11011")
  ) {
    return { score: 18_000, isFour: true, isOpenThree: false };
  }
  // Open Three (continuous 01110 or split 010110 / 011010)
  if (mask.includes("01110") || mask.includes("010110") || mask.includes("011010")) {
    return { score: 8_500, isFour: false, isOpenThree: true };
  }
  // Closed Three
  if (mask.includes("00111") || mask.includes("11100") || mask.includes("01011") || mask.includes("11010")) {
    return { score: 1_100, isFour: false, isOpenThree: false };
  }
  // Open Two
  if (mask.includes("001100") || mask.includes("01100") || mask.includes("00110") || mask.includes("01010")) {
    return { score: 340, isFour: false, isOpenThree: false };
  }
  return { score: 18, isFour: false, isOpenThree: false };
}

function evaluateCell(board, idx, stone) {
  const r0 = Math.floor(idx / SIZE);
  const c0 = idx % SIZE;
  let total = 0;
  let fours = 0;
  let openThrees = 0;
  for (const [dr, dc] of DIRS) {
    const sig = lineSignature(board, r0, c0, dr, dc, stone);
    total += sig.score;
    if (sig.isFour) fours++;
    if (sig.isOpenThree) openThrees++;
  }
  // Double threats (4-3, Double-3) create unstoppable forks
  if (fours >= 2 || (fours >= 1 && openThrees >= 1)) total += 95_000;
  else if (openThrees >= 2) total += 38_000;
  return total;
}

function getCandidateCells(board) {
  const seen = new Uint8Array(225);
  let hasStones = false;
  for (let i = 0; i < 225; i++) {
    if (board[i] === 0) continue;
    hasStones = true;
    const r0 = Math.floor(i / SIZE);
    const c0 = i % SIZE;
    for (let dr = -2; dr <= 2; dr++) {
      for (let dc = -2; dc <= 2; dc++) {
        const r = r0 + dr;
        const c = c0 + dc;
        if (r >= 0 && r < SIZE && c >= 0 && c < SIZE && board[r * SIZE + c] === 0) {
          seen[r * SIZE + c] = 1;
        }
      }
    }
  }
  if (!hasStones) return [112]; // tengen center
  const out = [];
  for (let i = 0; i < 225; i++) {
    if (seen[i]) out.push(i);
  }
  return out;
}

export function chooseOmokAiMove(board, difficulty = "hard", aiStone = 2) {
  const humanStone = aiStone === 2 ? 1 : 2;
  const nearby = getCandidateCells(board);
  if (!nearby.length) return 112;
  if (nearby.length === 1 && board[112] === 0) return 112;

  // 금수(쌍삼·육목) 자리는 AI도 두지 않는다.
  let candidates = nearby.filter((idx) => omokMoveVerdict(board, idx, aiStone).ok);
  if (!candidates.length) {
    candidates = [];
    for (let i = 0; i < 225; i++) {
      if (board[i] === 0 && omokMoveVerdict(board, i, aiStone).ok) candidates.push(i);
    }
    if (!candidates.length) return nearby[0];
  }

  // Immediate forced win / block check (all levels check obvious 5-in-a-row)
  for (const idx of candidates) {
    if (omokMoveVerdict(board, idx, aiStone).win) return idx;
  }
  for (const idx of candidates) {
    if (omokMoveVerdict(board, idx, humanStone).win) return idx;
  }

  // Rank candidates by combined tactical attack + defense value
  const scored = candidates.map((idx) => {
    const r0 = Math.floor(idx / SIZE);
    const c0 = idx % SIZE;
    const atk = evaluateCell(board, idx, aiStone);
    const def = evaluateCell(board, idx, humanStone);
    const centerBias = 14 - Math.hypot(r0 - 7, c0 - 7);
    return { idx, atk, def, score: atk * 1.12 + def * 1.04 + centerBias };
  }).sort((a, b) => b.score - a.score);

  if (difficulty === "easy") {
    const pool = scored.slice(0, Math.min(5, scored.length));
    return pool[Math.floor(Math.random() * pool.length)].idx;
  }

  if (difficulty === "medium" || scored[0].atk >= 95_000 || scored[0].def >= 95_000) {
    return scored[0].idx;
  }

  // Hard tier: 2-ply lookahead minimizing opponent's maximum counter-threat
  const beam = scored.slice(0, Math.min(12, scored.length));
  const simBoard = board.slice();
  let bestMove = beam[0].idx;
  let bestNet = -Infinity;

  for (const cand of beam) {
    simBoard[cand.idx] = aiStone;
    const nextCands = getCandidateCells(simBoard);
    // Opponent's immediate win or highest threat after our move
    let oppMax = 0;
    for (const oIdx of nextCands) {
      if (hasFiveInARow(simBoard, oIdx, humanStone)) {
        oppMax = 1_500_000;
        break;
      }
      const threat = evaluateCell(simBoard, oIdx, humanStone) * 1.02 + evaluateCell(simBoard, oIdx, aiStone) * 0.4;
      if (threat > oppMax) oppMax = threat;
    }
    const net = cand.atk * 1.18 + cand.def * 0.65 - oppMax * 0.92;
    simBoard[cand.idx] = 0;
    if (net > bestNet) {
      bestNet = net;
      bestMove = cand.idx;
    }
  }
  return bestMove;
}

function edgeDanger(stone) {
  return Math.max(Math.abs(stone.x - 50), Math.abs(stone.y - 50));
}

export function chooseAlkkagiAiShot(stones, simulateFn, difficulty = "hard", aiOwner = "guest") {
  const playerOwner = aiOwner === "guest" ? "host" : "guest";
  const aiStones = stones.filter((s) => s.owner === aiOwner && s.alive);
  const playerStones = stones.filter((s) => s.owner === playerOwner && s.alive);
  if (!aiStones.length || !playerStones.length) return null;

  const baseAiCount = aiStones.length;
  const basePlayerCount = playerStones.length;
  const angles = difficulty === "easy" ? [0] : [-0.08, 0, 0.08];
  const powers = difficulty === "easy" ? [2.8] : [2.4, 3.1, 3.8];

  const shots = [];
  for (const shooter of aiStones) {
    for (const target of playerStones) {
      const dx = target.x - shooter.x;
      const dy = target.y - shooter.y;
      const baseAngle = Math.atan2(dy, dx);
      for (const da of angles) {
        const ang = baseAngle + da;
        const ux = Math.cos(ang);
        const uy = Math.sin(ang);
        for (const pwr of powers) {
          const sim = simulateFn(stones, shooter.id, ux * pwr, uy * pwr);
          if (!sim?.stones) continue;
          const nextAi = sim.stones.filter((s) => s.owner === aiOwner && s.alive);
          const nextPlayer = sim.stones.filter((s) => s.owner === playerOwner && s.alive);
          const knockedPlayer = basePlayerCount - nextPlayer.length;
          const lostAi = baseAiCount - nextAi.length;
          const enemyPush = nextPlayer.reduce((acc, s) => acc + edgeDanger(s), 0);
          const aiSafe = nextAi.reduce((acc, s) => acc + (50 - edgeDanger(s)), 0);
          const score =
            knockedPlayer * 160 -
            lostAi * 145 +
            enemyPush * 1.4 +
            aiSafe * 0.35 +
            (sim.winner === aiOwner ? 500 : sim.winner === playerOwner ? -500 : 0);
          shots.push({
            stoneId: shooter.id,
            vx: ux * pwr,
            vy: uy * pwr,
            sim,
            score,
          });
        }
      }
    }
  }

  shots.sort((a, b) => b.score - a.score);
  if (!shots.length) return null;
  if (difficulty === "hard") return shots[0];
  if (difficulty === "medium") {
    const pool = shots.slice(0, Math.min(2, shots.length));
    return pool[Math.floor(Math.random() * pool.length)];
  }
  const pool = shots.slice(0, Math.min(4, shots.length));
  return pool[Math.floor(Math.random() * pool.length)];
}
