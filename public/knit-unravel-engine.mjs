// Pure Knit Unravel Puzzle Engine:
// Top: pixel-art knit tapestry unraveling bottom-up
// Middle: active spool dock (6 base slots, expandable to 8)
// Bottom: 7x7 spool grid with BFS exit-row reachability, mystery(?), ice, rope pairs, dispensers & 3 boosters

export const KNIT_STAGE_COUNT = 10;
export const DOCK_BASE_SLOTS = 6;
export const DOCK_MAX_SLOTS = 8;
export const TRAY_ROWS = 7;
export const TRAY_COLS = 7;

export const YARN_PALETTE = Object.freeze({
  y: { id: "y", name: "버터 옐로우", fill: "#f2c64b", hi: "#ffec94", sh: "#bd8928" },
  g: { id: "g", name: "올리브 그린", fill: "#72bf52", hi: "#a8e67e", sh: "#488535" },
  l: { id: "l", name: "라임 민트", fill: "#b2d95b", hi: "#dbf590", sh: "#7a9e33" },
  o: { id: "o", name: "탠저린 오렌지", fill: "#e87a38", hi: "#ffad70", sh: "#ad4d1c" },
  c: { id: "c", name: "스카이 아쿠아", fill: "#3ec4e0", hi: "#8ee8fa", sh: "#24869e" },
  p: { id: "p", name: "베리 핑크", fill: "#eb7aa4", hi: "#ffb3d0", sh: "#ad476e" },
  k: { id: "k", name: "차콜 다크", fill: "#4a4f5e", hi: "#737a8f", sh: "#2c303d" },
  w: { id: "w", name: "크림 아이보리", fill: "#f7ebd4", hi: "#ffffff", sh: "#cbb89a" },
});

export const KNIT_PATTERNS = Object.freeze([
  {
    name: "무지개 초원 기린",
    rows: [
      "p p o o y y y y y y y y y c c c c c",
      "o o y y g g c c y y y c c w w c c c",
      "y y g g c c w w y o y y c c c c c c",
      "g g c c w c c c y y y y y y c c w w",
      "c c c c c c c c y k y y w w p p w c",
      "p c c c w c c c y y y y w p w w c c",
      "o y c c c c c c y y o y y c c c c c",
      "y g c c y y o y y y y c c c l c c c",
      "g c c y y y y o y y c c c g c g c c",
      "c c k k y o y y y y c c l c l o c c",
      "l l k c y y y y y c c c g g o g g l",
      "g g l l y y g y y g g l g g g g l g",
      "g g o g y y g g y g g g o g g l g g",
      "g g g g g g g g g g g g g g g g g g",
    ],
  },
  {
    name: "꽃밭 판다",
    rows: [
      "g g g p p k k c c k k p p g g l l g",
      "l g p p k k w w w w k k p p l g p g",
      "l l g g k w k w w k w k g g g p y p",
      "p l g k w p w w w w p w k g l g p g",
      "g g l k k w w p p w w k k l g g l g",
      "g l g g k k w w w w k k g g g g g l",
      "g g g k k w w w w w w k k g g p g g",
      "g p g k k w w w w w w k k g p y p g",
      "g g g k k w w w w w w k k g g p g g",
      "l g g g k k k k k k k k p p l g g g",
      "g g l g p p g g g g p p g l g l p g",
      "g g g g g l l g g l l g g g g p y p",
      "g l g g g g g l l g g g p g g g p g",
      "g g g p g g g g g g g p y p g g g g",
    ],
  },
  {
    name: "해변 치즈냥",
    rows: [
      "c c w w c c c c c c c c c w w w c c",
      "c w w w w c c c c c c c w w w w w c",
      "c c w w c c c y c y c c c w w c c c",
      "c c c c c c c y o y y c c c c c c c",
      "c c c c c c y y y y y y c c c c c c",
      "w w c w w y y k y y k y y w w c w w",
      "c c c c y y y w y y w y y c c c c c",
      "c c c c c y o y y o y y c c c c c c",
      "c c w c y y y y o y y y y c w c c c",
      "w c c c y o y y y y o y y c c c c w",
      "c w w y y y y y y y y y w w c w w c",
      "y y y y o o y y y y y o y y y y y y",
      "y o y y y y y y o y y y y o y y y o",
      "y y y o y y y y y y y o y y y o y y",
    ],
  },
  {
    name: "길모퉁이 붕어빵",
    rows: [
      "c c c c p p c c c c c c c w w c c c",
      "c c c p w w p c c y y y y c c c c c",
      "c c c c p p c c y o y o y y c c c c",
      "c c w c c c y y o y y y y o y c c c",
      "c w w w c y o y y k y y o y y o c c",
      "c c c y y y y y y y y y y y y o o c",
      "c c y y o y y y y o y o y y o y c c",
      "c c c y y y y o y y y y y y c c c c",
      "c c c c y y y o y o y y o c c c c c",
      "c c c c c y y y y y y c c w w c c c",
      "c w w c c c c y y c c c w w w w c c",
      "o o o o o o o o o o o o o o o o o o",
      "y y o y o y y o o y y o y y o y o y",
      "o y y y o y y o o y o y y y o y y o",
    ],
  },
  {
    name: "김 모락 라면",
    rows: [
      "p p c c w w c c w w c c w w c c p p",
      "p c c c c w w c c w w c c w w c c p",
      "c c c c w w c c w w c c c c c c c c",
      "c c c y y y y o o o w w w g g c c c",
      "c c y o y y o w y w o g k k g c c c",
      "c k k k k k k k k k k k k k k k k c",
      "c k o o o o o o o o o o o o o o k c",
      "c k r o p p o o w w o p p o o o k c".replace(/r/g, "y"),
      "c c k o o o o p p p p o o o o k c c",
      "c c c k o o o o o o o o o o k c c c",
      "c c c c k k o o o o o o k k c c c c",
      "c c c c k k k k k k k k k k c c c c",
      "w w w w w w w w w w w w w w w w w w",
      "p w p w w p w p w w p w p w w p w p",
    ],
  },
  {
    name: "레트로 게임기",
    rows: [
      "p p p c c k k k k k k k k k k c c p p p",
      "p c c c k w w w w w w w w w w k c c p p",
      "c c w k w w k k k k k k k k w w k c c c",
      "c c c k w k c c l l l l c c k w k c y c",
      "c y c k w k c l w l l y l c k w k c c c",
      "c c c k w k c c c c c c c c k w k w c c",
      "c c c k w w k k k k k k k k w w k c c c",
      "c w c k w w w w w w w w w w w w k c p c",
      "c c c k w k w w w w w w p w p w k c c c",
      "c p c k k k k w w w w p w w w w k c c c",
      "c c c k w k w w w w w w w w w w k c y c",
      "c c c k w w w w k k w w w k k w k c c c",
      "g g g c k w w w w w w w w w w k c g g g",
      "g l g g c k k k k k k k k k k c g g l g",
    ],
  },
  {
    name: "무지개 하트",
    rows: [
      "p p p p p p p p p p p p p p p p p p p p",
      "o o o o o o p p o o o o p p o o o o o o",
      "y y y y y o o o o o o o o o o y y y y y",
      "l l l l y y p p p p p p p p y y l l l l",
      "g g g l l p p w w p p p p p p l l g g g",
      "c c c g p p w p p p p p p p p p c c c c",
      "c c c c p p p p p p p p p p p p c c w c",
      "c w c c p p p p p p p p p p p p c c c c",
      "c c c c c p p p p p p p p p p c c c w c",
      "c c c c c c p p p p p p p p c c c c c c",
      "g g c c c c c p p p p p p c c c c g g g",
      "l l g g c c c c p p p p c c c g g l l l",
      "y y l l g g c c c p p c c g g l l y y y",
      "o o y y l l g g c c c g g l l y y o o o",
    ],
  },
  {
    name: "별빛 컵케이크",
    rows: [
      "k k k y k k k p p k k k k y k k k k k k",
      "k k y y y k p o p p k k k k k k k y k k",
      "k k k y k k p p p p w w w k k k k k k k",
      "k k k k k p w w p w p p w p k k y k k k",
      "k k c k p p p p w p p p p p p k k k k k",
      "k k k p w p p p p p w p p p w p k k c k",
      "k k w p p p w p p p p p w p p w w k k k",
      "k y k o y o o y o o y o o y o o y k k k",
      "k k k o o y o o y o o y o o y o o k y k",
      "k k k k o y o y o o y o y o y o k k k k",
      "k k c k o o y o o y o o y o o o k k k k",
      "k k k k k o y o o y o o y o k k k k c k",
      "k y k k k k k k k k k k k k k k y k k k",
      "p p p p p p p p p p p p p p p p p p p p",
    ],
  },
  {
    name: "밤하늘 초승달",
    rows: [
      "k k y k k k y y y y k k k k k y k k k k",
      "k k k k k y y w w y y k k c k k k k y k",
      "k c k k y y w w k k k k k k k k k k k k",
      "k k k k y y w k k k k y k k k k c k k k",
      "k k k y y w w k k k k k k k k k k k k k",
      "k k k y y w w k k k k k c k k y k k k k",
      "k y k y y w w k k k k k k k k k k k c k",
      "k k k k y y w k k k k k k k k k k k k k",
      "k k c k y y w w k k k y k k k k k y k k",
      "k k k k k y y w w y y k k k c k k k k k",
      "c c c c c c c y y y c c c c c c c c c c",
      "k c c c w w c c c c w c c c k c w c c k",
      "k k c k c k k c c k k k c k k k c k k k",
      "g g g g g k k g g g g g g k k g g g g g",
    ],
  },
  {
    name: "무지개 알바냥",
    rows: [
      "p p o o y y l l g g c c k k c c g g l l",
      "p o o y w w y l g c k k c c k k g l y y",
      "o y y w w p w c g c k w k k w k c l y o",
      "y y l w p w w w k k w w w w w w k l y y",
      "y l g k w w w w w k w o w w o w w k o p",
      "l g c k w w k w w k w w w w w w w k p o",
      "g c c c k w w p w k w p w w p w k c o y",
      "c c w c c k w w w w w w w w w k c c y l",
      "c w w c g g k k g g g g k k c c w c l g",
      "c c c g g w w w g g g g w w w g c c g c",
      "p o y g g w k w g g y g w k w g l g c p",
      "o y l g g w w w g g g g w w w g l c p o",
      "y l g g g g g g g g g g g g g g g p o y",
      "l g g c c k k w w k k k k w w k k o y l",
      "g c c p o o k k k c c k k k y y c c l g",
      "c c p p o y y l l g g c c p p o y y l g",
    ],
  },
]);

function seededRng(seed) {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function parseTapestry(pattern) {
  return pattern.rows.map((r) => r.trim().split(/\s+/));
}

function buildSpoolsFromTapestry(tapestry, rand) {
  const counts = new Map();
  const heightByColor = new Map();
  const rows = tapestry.length;
  const cols = tapestry[0].length;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const col = tapestry[r][c];
      if (!col || !YARN_PALETTE[col]) continue;
      counts.set(col, (counts.get(col) || 0) + 1);
      // Higher r = closer to bottom frontier (unravels earlier!)
      heightByColor.set(col, Math.max(heightByColor.get(col) || 0, r));
    }
  }

  const spools = [];
  let seq = 1;
  for (const [color, total] of counts.entries()) {
    let rem = total;
    while (rem > 0) {
      let chunk = rem <= 18 ? rem : 10 + Math.floor(rand() * 8);
      if (rem - chunk > 0 && rem - chunk < 6) chunk = rem;
      spools.push({
        id: seq++,
        color,
        capacity: chunk,
        remaining: chunk,
        priority: heightByColor.get(color) || 0,
      });
      rem -= chunk;
    }
  }
  return spools;
}

export function isSingleReachable(tray, r, c, { ignoreIce = false } = {}) {
  const cell = tray[r]?.[c];
  if (!cell || cell.type !== "spool" || (!ignoreIce && cell.ice > 0)) return false;
  if (r === 0) return true;
  const visited = Array.from({ length: TRAY_ROWS }, () => new Uint8Array(TRAY_COLS));
  const queue = [];
  for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
    const nr = r + dr;
    const nc = c + dc;
    if (nr >= 0 && nr < TRAY_ROWS && nc >= 0 && nc < TRAY_COLS && tray[nr][nc] === null) {
      if (nr === 0) return true;
      visited[nr][nc] = 1;
      queue.push([nr, nc]);
    }
  }
  while (queue.length) {
    const [cr, cc] = queue.shift();
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const nr = cr + dr;
      const nc = cc + dc;
      if (nr >= 0 && nr < TRAY_ROWS && nc >= 0 && nc < TRAY_COLS && !visited[nr][nc] && tray[nr][nc] === null) {
        if (nr === 0) return true;
        visited[nr][nc] = 1;
        queue.push([nr, nc]);
      }
    }
  }
  return false;
}

export function findPairPartner(tray, r, c) {
  const cell = tray[r]?.[c];
  if (!cell?.pairId) return null;
  for (let rr = 0; rr < TRAY_ROWS; rr++) {
    for (let cc = 0; cc < TRAY_COLS; cc++) {
      if ((rr !== r || cc !== c) && tray[rr][cc]?.pairId === cell.pairId) {
        return { r: rr, c: cc, cell: tray[rr][cc] };
      }
    }
  }
  return null;
}

export function isCellReachable(game, r, c) {
  const cell = game.tray[r]?.[c];
  if (!cell || cell.type !== "spool" || cell.ice > 0) return false;
  if (!cell.pairId) return isSingleReachable(game.tray, r, c);
  const partner = findPairPartner(game.tray, r, c);
  if (!partner) return isSingleReachable(game.tray, r, c);
  if (partner.cell.ice > 0) return false;
  const r1 = isSingleReachable(game.tray, r, c);
  const r2 = isSingleReachable(game.tray, partner.r, partner.c);
  if (r1 && r2) return true;
  // Adjacent stacked pair: if front piece clears, partner directly behind becomes reachable!
  const adjacent = Math.abs(r - partner.r) + Math.abs(c - partner.c) === 1;
  return adjacent && (r1 || r2);
}

export function getExposedFrontier(tapestry) {
  const rows = tapestry.length;
  const cols = tapestry[0].length;
  const exposed = [];
  for (let c = 0; c < cols; c++) {
    for (let r = rows - 1; r >= 0; r--) {
      if (tapestry[r][c] !== null) {
        exposed.push({ row: r, col: c, color: tapestry[r][c] });
        break;
      }
    }
  }
  return exposed;
}

export function stepKnitUnravel(game, maxStitches = 1) {
  const pulled = [];
  for (let step = 0; step < maxStitches; step++) {
    const exposed = getExposedFrontier(game.tapestry);
    if (!exposed.length) break;
    let moved = false;
    for (let di = 0; di < game.dockCapacity; di++) {
      const slot = game.dock[di];
      if (!slot || slot.remaining <= 0) continue;
      // Prefer bottom-most exposed stitch matching this spool's color
      const targets = exposed.filter((e) => e.color === slot.color).sort((a, b) => b.row - a.row);
      if (!targets.length) continue;
      const hit = targets[0];
      game.tapestry[hit.row][hit.col] = null;
      game.remainingStitches--;
      slot.remaining--;
      game.score += 10;
      pulled.push({ col: hit.col, row: hit.row, dockIndex: di, color: slot.color });
      if (slot.remaining <= 0) {
        game.dock[di] = null;
        game.completedSpools++;
        game.score += 60;
      }
      moved = true;
      break;
    }
    if (!moved) break;
  }
  game.activeThreads = pulled;
  return pulled;
}

export function createKnitStage(stageNumber = 1) {
  const stage = Math.max(1, Math.min(KNIT_STAGE_COUNT, Math.floor(stageNumber)));
  const pattern = KNIT_PATTERNS[(stage - 1) % KNIT_PATTERNS.length];
  const tapestry = parseTapestry(pattern);
  const rand = seededRng(7013 + stage * 547);
  const allSpools = buildSpoolsFromTapestry(tapestry, rand);
  const totalStitches = allSpools.reduce((sum, s) => sum + s.capacity, 0);

  // Sort high-priority (bottom frontier colors) toward top exit rows while keeping variety
  allSpools.sort((a, b) => (b.priority - a.priority) + (rand() - 0.5) * 4);

  const tray = Array.from({ length: TRAY_ROWS }, () => Array(TRAY_COLS).fill(null));
  const totalSpools = allSpools.length;

  // Reserve a dispenser box in deeper rows when totalSpools > 40 or stage >= 4 with plenty of spools
  const dispenserCapacity = stage >= 4 && totalSpools > 34 ? Math.min(totalSpools - 28, 8) : Math.max(0, totalSpools - 48);
  const gridSpools = allSpools.slice(0, totalSpools - dispenserCapacity);
  const overflowSpools = allSpools.slice(totalSpools - dispenserCapacity);

  // Distribute grid spools top-down so top exit always opens smoothly
  let cursor = 0;
  for (let r = 0; r < TRAY_ROWS && cursor < gridSpools.length; r++) {
    const colOrder = [0, 1, 2, 3, 4, 5, 6].sort(() => rand() - 0.5);
    for (const c of colOrder) {
      if (cursor >= gridSpools.length) break;
      const sp = gridSpools[cursor++];
      tray[r][c] = {
        type: "spool",
        id: sp.id,
        color: sp.color,
        capacity: sp.capacity,
        remaining: sp.remaining,
        mystery: false,
        ice: 0,
        pairId: null,
      };
    }
  }

  // Place dispenser at bottom row if overflow exists
  if (overflowSpools.length) {
    let placedDisp = false;
    for (let r = TRAY_ROWS - 1; r >= 2 && !placedDisp; r--) {
      for (const c of [3, 2, 4, 1, 5]) {
        if (!tray[r][c] && tray[r - 1][c] !== undefined) {
          tray[r][c] = {
            type: "dispenser",
            id: 9000 + stage,
            queue: overflowSpools.map((sp) => ({
              type: "spool",
              id: sp.id,
              color: sp.color,
              capacity: sp.capacity,
              remaining: sp.remaining,
              mystery: false,
              ice: 0,
              pairId: null,
            })),
          };
          placedDisp = true;
          break;
        }
      }
    }
    if (!placedDisp) {
      // Fallback: place directly into any open cell
      for (let r = 0; r < TRAY_ROWS && overflowSpools.length; r++) {
        for (let c = 0; c < TRAY_COLS && overflowSpools.length; c++) {
          if (!tray[r][c]) {
            const sp = overflowSpools.shift();
            tray[r][c] = { type: "spool", id: sp.id, color: sp.color, capacity: sp.capacity, remaining: sp.remaining, mystery: false, ice: 0, pairId: null };
          }
        }
      }
    }
  }

  // Progressive puzzle mechanics on inner rows (rows 2..5) so top rows always start playable
  if (stage >= 2) {
    let mysteryTarget = Math.min(4, stage);
    for (let r = 2; r < TRAY_ROWS && mysteryTarget > 0; r++) {
      for (let c = 1; c < TRAY_COLS - 1 && mysteryTarget > 0; c++) {
        const cell = tray[r][c];
        if (cell?.type === "spool" && rand() < 0.35) {
          cell.mystery = true;
          mysteryTarget--;
        }
      }
    }
  }
  if (stage >= 3) {
    let iceTarget = Math.min(3, Math.floor(stage / 2));
    for (let r = 2; r < TRAY_ROWS && iceTarget > 0; r++) {
      for (let c = 1; c < TRAY_COLS - 1 && iceTarget > 0; c++) {
        const cell = tray[r][c];
        if (cell?.type === "spool" && !cell.mystery && rand() < 0.25) {
          cell.ice = 1;
          iceTarget--;
        }
      }
    }
  }
  if (stage >= 5) {
    let pairSeq = 1;
    let pairsTarget = Math.min(2, Math.floor((stage - 3) / 2));
    for (let r = 1; r < TRAY_ROWS - 1 && pairsTarget > 0; r++) {
      for (let c = 1; c < TRAY_COLS - 2 && pairsTarget > 0; c++) {
        const a = tray[r][c];
        const b = tray[r][c + 1];
        if (a?.type === "spool" && b?.type === "spool" && !a.pairId && !b.pairId && !a.ice && !b.ice && !a.mystery && !b.mystery) {
          a.pairId = pairSeq;
          b.pairId = pairSeq;
          pairSeq++;
          pairsTarget--;
        }
      }
    }
  }

  return {
    stage,
    patternName: pattern.name,
    tapestry,
    rows: tapestry.length,
    cols: tapestry[0].length,
    totalStitches,
    remainingStitches: totalStitches,
    totalSpools,
    completedSpools: 0,
    dockCapacity: DOCK_BASE_SLOTS,
    dock: Array(DOCK_MAX_SLOTS).fill(null),
    tray,
    activeThreads: [],
    boosters: { slot: 1, glove: 2, scissors: 2 },
    armedBooster: null,
    score: 0,
    moves: 0,
    history: [],
  };
}

function snapshotGame(game) {
  return {
    tapestry: game.tapestry.map((r) => [...r]),
    remainingStitches: game.remainingStitches,
    completedSpools: game.completedSpools,
    dockCapacity: game.dockCapacity,
    dock: game.dock.map((d) => (d ? { ...d } : null)),
    tray: game.tray.map((row) =>
      row.map((cell) => {
        if (!cell) return null;
        if (cell.type === "dispenser") return { ...cell, queue: cell.queue.map((q) => ({ ...q })) };
        return { ...cell };
      })
    ),
    boosters: { ...game.boosters },
    score: game.score,
    moves: game.moves,
  };
}

export function undoKnit(game) {
  if (!game.history.length) return false;
  const prev = game.history.pop();
  game.tapestry = prev.tapestry;
  game.remainingStitches = prev.remainingStitches;
  game.completedSpools = prev.completedSpools;
  game.dockCapacity = prev.dockCapacity;
  game.dock = prev.dock;
  game.tray = prev.tray;
  game.boosters = prev.boosters;
  game.score = prev.score;
  game.moves = prev.moves;
  game.activeThreads = [];
  game.armedBooster = null;
  return true;
}

function triggerNeighborsAfterPick(game, coords) {
  // Dispensers push into their empty cell above (r - 1, c) first
  for (let r = 1; r < TRAY_ROWS; r++) {
    for (let c = 0; c < TRAY_COLS; c++) {
      const cell = game.tray[r][c];
      if (cell?.type === "dispenser" && cell.queue.length && game.tray[r - 1][c] === null) {
        game.tray[r - 1][c] = cell.queue.shift();
        if (!cell.queue.length) game.tray[r][c] = null;
      }
    }
  }
  // Only unlock mystery/ice on neighbors whose own exit path to row 0 is now open (prevents unrelated side picks from breaking locks!)
  for (const [r, c] of coords) {
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const nr = r + dr;
      const nc = c + dc;
      const nb = game.tray[nr]?.[nc];
      if (!nb || nb.type !== "spool") continue;
      if (isSingleReachable(game.tray, nr, nc, { ignoreIce: true })) {
        if (nb.mystery) nb.mystery = false;
        if (nb.ice > 0) nb.ice--;
      }
    }
  }
}

function findOpenDockIndices(game) {
  const out = [];
  for (let i = 0; i < game.dockCapacity; i++) {
    if (!game.dock[i]) out.push(i);
  }
  return out;
}

export function pickKnitCell(game, r, c) {
  const cell = game.tray[r]?.[c];
  if (!cell || cell.type !== "spool") return { ok: false, reason: "empty" };
  if (cell.ice > 0) return { ok: false, reason: "frozen" };
  if (!isCellReachable(game, r, c)) return { ok: false, reason: "blocked" };

  const openSlots = findOpenDockIndices(game);
  const partner = cell.pairId ? findPairPartner(game.tray, r, c) : null;
  const needed = partner ? 2 : 1;
  if (openSlots.length < needed) {
    return { ok: false, reason: partner && openSlots.length === 1 ? "pair_needs_two" : "dock_full" };
  }

  game.history.push(snapshotGame(game));

  const pickedCoords = [[r, c]];
  game.dock[openSlots[0]] = {
    id: cell.id,
    color: cell.color,
    capacity: cell.capacity,
    remaining: cell.remaining,
  };
  game.tray[r][c] = null;

  if (partner) {
    pickedCoords.push([partner.r, partner.c]);
    game.dock[openSlots[1]] = {
      id: partner.cell.id,
      color: partner.cell.color,
      capacity: partner.cell.capacity,
      remaining: partner.cell.remaining,
    };
    game.tray[partner.r][partner.c] = null;
  }

  game.moves++;
  game.score += 15 * pickedCoords.length;
  triggerNeighborsAfterPick(game, pickedCoords);
  return { ok: true, count: pickedCoords.length };
}

export function useKnitBooster(game, kind, target = null) {
  if ((game.boosters[kind] || 0) <= 0) return { ok: false, reason: "empty_booster" };

  if (kind === "slot") {
    if (game.dockCapacity >= DOCK_MAX_SLOTS) return { ok: false, reason: "max_slots" };
    game.history.push(snapshotGame(game));
    game.dockCapacity++;
    game.boosters.slot--;
    game.armedBooster = null;
    return { ok: true };
  }

  if (kind === "glove") {
    if (!target) return { ok: false, reason: "need_target" };
    const { r, c } = target;
    const cell = game.tray[r]?.[c];
    if (!cell || cell.type !== "spool") return { ok: false, reason: "invalid_target" };
    const open = findOpenDockIndices(game);
    const partner = cell.pairId ? findPairPartner(game.tray, r, c) : null;
    if (open.length < (partner ? 2 : 1)) return { ok: false, reason: "dock_full" };
    game.history.push(snapshotGame(game));
    cell.ice = 0;
    cell.mystery = false;
    const picked = [[r, c]];
    game.dock[open[0]] = { id: cell.id, color: cell.color, capacity: cell.capacity, remaining: cell.remaining };
    game.tray[r][c] = null;
    if (partner) {
      picked.push([partner.r, partner.c]);
      game.dock[open[1]] = { id: partner.cell.id, color: partner.cell.color, capacity: partner.cell.capacity, remaining: partner.cell.remaining };
      game.tray[partner.r][partner.c] = null;
    }
    game.boosters.glove--;
    game.armedBooster = null;
    game.moves++;
    triggerNeighborsAfterPick(game, picked);
    return { ok: true };
  }

  if (kind === "scissors") {
    // Scissors clears first active docked spool immediately AND snips its matching stitches so level stays 100% solvable!
    const di = target?.dockIndex ?? game.dock.findIndex((s, idx) => idx < game.dockCapacity && s && s.remaining > 0);
    if (di < 0 || !game.dock[di]) return { ok: false, reason: "no_active_spool" };
    game.history.push(snapshotGame(game));
    const slot = game.dock[di];
    let toRemove = slot.remaining;
    for (let r = game.rows - 1; r >= 0 && toRemove > 0; r--) {
      for (let c = 0; c < game.cols && toRemove > 0; c++) {
        if (game.tapestry[r][c] === slot.color) {
          game.tapestry[r][c] = null;
          game.remainingStitches--;
          toRemove--;
        }
      }
    }
    game.dock[di] = null;
    game.completedSpools++;
    game.score += 50;
    game.boosters.scissors--;
    game.armedBooster = null;
    return { ok: true };
  }

  return { ok: false, reason: "unknown" };
}

export function isKnitWon(game) {
  return game.remainingStitches <= 0 && game.dock.slice(0, game.dockCapacity).every((s) => !s);
}

export function isKnitStuck(game) {
  if (isKnitWon(game)) return false;
  const exposed = new Set(getExposedFrontier(game.tapestry).map((e) => e.color));
  const anyUnraveling = game.dock.slice(0, game.dockCapacity).some((s) => s && exposed.has(s.color));
  if (anyUnraveling) return false;
  const open = findOpenDockIndices(game).length;
  if (open === 0) return true;
  for (let r = 0; r < TRAY_ROWS; r++) {
    for (let c = 0; c < TRAY_COLS; c++) {
      if (isCellReachable(game, r, c)) {
        const needed = game.tray[r][c].pairId ? 2 : 1;
        if (open >= needed) return false;
      }
    }
  }
  return true;
}

export function findKnitHint(game) {
  const open = findOpenDockIndices(game).length;
  if (!open) return null;
  const exposed = new Set(getExposedFrontier(game.tapestry).map((e) => e.color));
  let fallback = null;
  for (let r = 0; r < TRAY_ROWS; r++) {
    for (let c = 0; c < TRAY_COLS; c++) {
      if (!isCellReachable(game, r, c)) continue;
      const cell = game.tray[r][c];
      if (cell.pairId && open < 2) continue;
      if (!cell.mystery && exposed.has(cell.color)) return { r, c };
      if (!fallback) fallback = { r, c };
    }
  }
  return fallback;
}
