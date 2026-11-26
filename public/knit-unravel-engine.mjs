// Pure Knit Unravel Puzzle Engine: peel unblocked overlapping yarn strands into active 3-strand bobbins
export const YARN_COLORS = Object.freeze([
  { id: "berry", name: "베리 로즈", fill: "#d9647a" },
  { id: "sage", name: "세이지 민트", fill: "#6aa887" },
  { id: "butter", name: "버터 골드", fill: "#e6b85c" },
  { id: "sky", name: "포근 하늘", fill: "#6d98c4" },
  { id: "plum", name: "모브 플럼", fill: "#95719c" },
]);

export const KNIT_STAGE_COUNT = 10;
export const TRAY_CAPACITY = 5;
export const BOBBIN_CAPACITY = 3;

function seededRng(seed) {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function rectsTouch(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function createKnitStage(stageNumber = 1) {
  const stage = Math.max(1, Math.min(KNIT_STAGE_COUNT, Math.floor(stageNumber)));
  const rand = seededRng(9107 + stage * 491);
  const colorCount = Math.min(YARN_COLORS.length, 3 + Math.floor((stage - 1) / 3));
  const palette = YARN_COLORS.slice(0, colorCount);
  const spoolsPerColor = stage >= 7 ? 2 : 1;
  const bobbinQueue = [];

  for (let round = 0; round < spoolsPerColor; round++) {
    for (const c of palette) {
      bobbinQueue.push({ color: c.id, count: 0, max: BOBBIN_CAPACITY });
    }
  }
  for (let i = bobbinQueue.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [bobbinQueue[i], bobbinQueue[j]] = [bobbinQueue[j], bobbinQueue[i]];
  }

  // Every bobbin requires exactly 3 strands of its color, guaranteeing 100% solvability.
  const colorPool = [];
  for (const b of bobbinQueue) {
    for (let k = 0; k < BOBBIN_CAPACITY; k++) colorPool.push(b.color);
  }
  for (let i = colorPool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [colorPool[i], colorPool[j]] = [colorPool[j], colorPool[i]];
  }

  const strands = colorPool.map((color, idx) => {
    const horizontal = idx % 2 === 0;
    const layer = Math.floor(idx / 2);
    const w = horizontal ? 26 + (idx % 3) * 4 : 11;
    const h = horizontal ? 12 : 28 + (idx % 3) * 4;
    const col = idx % 4;
    const row = Math.floor(idx / 4) % 3;
    const jitterX = Math.round((rand() - 0.5) * 10);
    const jitterY = Math.round((rand() - 0.5) * 10);
    const x = Math.max(6, Math.min(94 - w, 14 + col * 18 + jitterX));
    const y = Math.max(8, Math.min(92 - h, 16 + row * 22 + jitterY));
    return { id: idx + 1, color, layer, x, y, w, h, orientation: horizontal ? "h" : "v" };
  });

  const activeBobbins = [bobbinQueue.shift(), bobbinQueue.shift()].filter(Boolean);
  return {
    stage,
    strands,
    activeBobbins,
    bobbinQueue,
    totalBobbins: activeBobbins.length + bobbinQueue.length,
    completedBobbins: 0,
    tray: [],
    score: 0,
    moves: 0,
    history: [],
  };
}

export function isStrandFree(game, strandId) {
  const target = game.strands.find((s) => s.id === strandId);
  if (!target) return false;
  return !game.strands.some((other) => other.id !== target.id && other.layer > target.layer && rectsTouch(other, target));
}

function flushTrayToBobbins(game) {
  let progressed = true;
  while (progressed) {
    progressed = false;
    for (let bi = 0; bi < game.activeBobbins.length; bi++) {
      const bob = game.activeBobbins[bi];
      const idx = game.tray.findIndex((c) => c === bob.color);
      if (idx >= 0) {
        game.tray.splice(idx, 1);
        bob.count++;
        game.score += 30;
        progressed = true;
        if (bob.count >= bob.max) {
          game.completedBobbins++;
          game.score += 100;
          if (game.bobbinQueue.length) game.activeBobbins[bi] = game.bobbinQueue.shift();
          else game.activeBobbins.splice(bi, 1);
        }
        break;
      }
    }
  }
}

export function pickKnitStrand(game, strandId) {
  if (!isStrandFree(game, strandId)) return { ok: false, reason: "locked" };
  const idx = game.strands.findIndex((s) => s.id === strandId);
  const strand = game.strands[idx];

  // Snapshot before mutating
  game.history.push({
    strands: game.strands.map((s) => ({ ...s })),
    activeBobbins: game.activeBobbins.map((b) => ({ ...b })),
    bobbinQueue: game.bobbinQueue.map((b) => ({ ...b })),
    completedBobbins: game.completedBobbins,
    tray: [...game.tray],
    score: game.score,
    moves: game.moves,
  });

  const matchingBobbinIdx = game.activeBobbins.findIndex((b) => b.color === strand.color);
  if (matchingBobbinIdx >= 0) {
    game.strands.splice(idx, 1);
    const bob = game.activeBobbins[matchingBobbinIdx];
    bob.count++;
    game.score += 40;
    game.moves++;
    if (bob.count >= bob.max) {
      game.completedBobbins++;
      game.score += 100;
      if (game.bobbinQueue.length) game.activeBobbins[matchingBobbinIdx] = game.bobbinQueue.shift();
      else game.activeBobbins.splice(matchingBobbinIdx, 1);
    }
    flushTrayToBobbins(game);
    return { ok: true, woundDirectly: true };
  }

  if (game.tray.length >= TRAY_CAPACITY) {
    game.history.pop();
    return { ok: false, reason: "tray_full" };
  }

  game.strands.splice(idx, 1);
  game.tray.push(strand.color);
  game.moves++;
  game.score += 10;
  flushTrayToBobbins(game);
  return { ok: true, woundDirectly: false };
}

export function undoKnit(game) {
  if (!game.history.length) return false;
  const prev = game.history.pop();
  game.strands = prev.strands;
  game.activeBobbins = prev.activeBobbins;
  game.bobbinQueue = prev.bobbinQueue;
  game.completedBobbins = prev.completedBobbins;
  game.tray = prev.tray;
  game.score = prev.score;
  game.moves = prev.moves;
  return true;
}

export function isKnitWon(game) {
  return game.strands.length === 0 && game.tray.length === 0 && game.activeBobbins.length === 0;
}

export function isKnitStuck(game) {
  if (isKnitWon(game) || game.tray.length < TRAY_CAPACITY) return false;
  const activeColors = new Set(game.activeBobbins.map((b) => b.color));
  return !game.strands.some((s) => isStrandFree(game, s.id) && activeColors.has(s.color));
}

export function findKnitHint(game) {
  const free = game.strands.filter((s) => isStrandFree(game, s.id));
  if (!free.length) return null;
  const activeColors = new Set(game.activeBobbins.map((b) => b.color));
  const match = free.find((s) => activeColors.has(s.color));
  return match ? match.id : free[0].id;
}
