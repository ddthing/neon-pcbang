// Single-source-of-truth canonical layout, collision, pathfinding, and seat-map spec
// for 길모퉁이PC방 2차 픽셀아트 리뉴얼 Vertical Slice 1 (docs/pixel-art-renewal.md).
// Coordinate unit: logical pixels inside a 640x360 world (+x right, +y down).

export const WORLD_SPEC = Object.freeze({
  width: 640,
  height: 360,
  targetScales: Object.freeze({
    fhd: { width: 1920, height: 1080, scale: 3 },
    qhd: { width: 2560, height: 1440, scale: 4 },
    uhd4k: { width: 3840, height: 2160, scale: 6 },
  }),
  palette: Object.freeze({
    ink: "#292435",
    shade: "#3c3049",
    plum: "#574059",
    violet: "#77617e",
    slate: "#4d5c79",
    blue: "#677fa0",
    aqua: "#83c9c5",
    glass: "#263849",
    gold: "#ecb779",
    milk: "#ffe2ad",
    mint: "#94ac82",
    green: "#586b68",
    rust: "#9e5755",
    peach: "#da8c76",
    wood: "#a56b62",
    darkWood: "#80535c",
    lightWood: "#bd8470",
    paper: "#f9cca5",
  }),
});

export const CHARACTER_SPEC = Object.freeze({
  frameWidth: 32,
  frameHeight: 40,
  standingHeight: 32,
  headWidth: 16,
  footOffset: Object.freeze({ x: 16, y: 38 }),
  // Head and headset are excluded from physical floor collision.
  footBox: Object.freeze({ width: 12, height: 8 }),
  walkSpeedPxPerSec: 84,
  walkFramesPerDirection: 6,
  sitFrames: 5,
  typingFrames: 4,
});

export const ZONES = Object.freeze({
  exterior: Object.freeze({
    id: "exterior",
    name: "매장 앞 복도",
    bounds: Object.freeze({ x: 24, y: 308, width: 592, height: 44 }),
    walkableRects: Object.freeze([
      Object.freeze({ x: 204, y: 312, width: 144, height: 34 }),
    ]),
    spawnPoint: Object.freeze({ x: 276, y: 328 }),
    mapRect: Object.freeze({ x: 24, y: 308, width: 592, height: 44 }),
  }),
  hall: Object.freeze({
    id: "hall",
    name: "메인 홀 (시안)",
    bounds: Object.freeze({ x: 36, y: 40, width: 568, height: 256 }),
    walkableRects: Object.freeze([
      Object.freeze({ x: 212, y: 48, width: 392, height: 248 }),
      Object.freeze({ x: 36, y: 208, width: 176, height: 88 }),
    ]),
    spawnPoint: Object.freeze({ x: 276, y: 282 }),
    mapRect: Object.freeze({ x: 36, y: 40, width: 568, height: 256 }),
  }),
  solo: Object.freeze({
    id: "solo",
    name: "1인룸",
    bounds: Object.freeze({ x: 36, y: 40, width: 176, height: 168 }),
    walkableRects: Object.freeze([
      Object.freeze({ x: 48, y: 56, width: 152, height: 140 }),
    ]),
    spawnPoint: Object.freeze({ x: 124, y: 182 }),
    mapRect: Object.freeze({ x: 36, y: 40, width: 176, height: 168 }),
  }),
});

export const DOORS = Object.freeze([
  Object.freeze({
    id: "entrance",
    label: "PC방 출입문",
    fromZone: "exterior",
    toZone: "hall",
    orientation: "horizontal",
    clearWidth: 32,
    doorHeight: 46,
    threshold: Object.freeze({ x: 260, y: 299, width: 32, height: 14, cx: 276, cy: 306 }),
    passRect: Object.freeze({ x: 260, y: 294, width: 32, height: 22 }),
    frameRect: Object.freeze({ x: 256, y: 262, width: 40, height: 50 }),
    lintelOcclusionHeight: 16,
    approachPoint: Object.freeze({ x: 276, y: 328 }),
    landingPoint: Object.freeze({ x: 276, y: 282 }),
    openRadius: 34,
  }),
  Object.freeze({
    id: "solo-door",
    label: "1인룸 출입문",
    fromZone: "hall",
    toZone: "solo",
    orientation: "horizontal",
    clearWidth: 30,
    doorHeight: 44,
    threshold: Object.freeze({ x: 109, y: 197, width: 30, height: 14, cx: 124, cy: 204 }),
    passRect: Object.freeze({ x: 109, y: 194, width: 30, height: 16 }),
    frameRect: Object.freeze({ x: 105, y: 162, width: 38, height: 48 }),
    lintelOcclusionHeight: 15,
    approachPoint: Object.freeze({ x: 124, y: 224 }),
    landingPoint: Object.freeze({ x: 124, y: 182 }),
    openRadius: 32,
  }),
]);

export const AISLES = Object.freeze([
  Object.freeze({
    id: "main-lobby",
    label: "입구·키오스크 메인 통로",
    zone: "hall",
    orientation: "horizontal",
    clearWidth: 56,
    rect: Object.freeze({ x: 218, y: 220, width: 128, height: 56 }),
  }),
  Object.freeze({
    id: "main-spine",
    label: "1인룸–일반석 중앙 통로",
    zone: "hall",
    orientation: "vertical",
    clearWidth: 56,
    rect: Object.freeze({ x: 218, y: 92, width: 128, height: 128 }),
  }),
  Object.freeze({
    id: "hall-aisle-left",
    label: "일반석 1번 좌석 통로",
    zone: "hall",
    orientation: "vertical",
    clearWidth: 36,
    rect: Object.freeze({ x: 356, y: 92, width: 36, height: 124 }),
  }),
  Object.freeze({
    id: "hall-aisle-right",
    label: "일반석 2번 좌석 통로",
    zone: "hall",
    orientation: "vertical",
    clearWidth: 36,
    rect: Object.freeze({ x: 508, y: 92, width: 36, height: 124 }),
  }),
]);

export const FURNITURE = Object.freeze([
  Object.freeze({
    id: "kiosk",
    kind: "kiosk",
    label: "자리 선택 키오스크",
    zone: "hall",
    anchor: Object.freeze({ x: 190, y: 262 }),
    visualRect: Object.freeze({ x: 176, y: 222, width: 28, height: 42 }),
    collisionRect: Object.freeze({ x: 178, y: 250, width: 24, height: 14 }),
    interactPoint: Object.freeze({ x: 190, y: 274 }),
  }),
  Object.freeze({
    id: "hall-bay-spine",
    kind: "divider",
    label: "일반석 중앙 파티션",
    zone: "hall",
    anchor: Object.freeze({ x: 450, y: 204 }),
    visualRect: Object.freeze({ x: 446, y: 92, width: 8, height: 112 }),
    collisionRect: Object.freeze({ x: 446, y: 96, width: 8, height: 108 }),
  }),
  Object.freeze({
    id: "plant-broadleaf",
    kind: "plant",
    species: "broadleaf",
    label: "넓은잎 관엽 (극락조)",
    zone: "hall",
    anchor: Object.freeze({ x: 324, y: 286 }),
    visualRect: Object.freeze({ x: 311, y: 248, width: 26, height: 40 }),
    collisionRect: Object.freeze({ x: 316, y: 278, width: 16, height: 10 }),
  }),
  Object.freeze({
    id: "plant-pothos",
    kind: "plant",
    species: "pothos",
    label: "덩굴 포토스",
    zone: "solo",
    anchor: Object.freeze({ x: 68, y: 84 }),
    visualRect: Object.freeze({ x: 56, y: 52, width: 24, height: 34 }),
    collisionRect: Object.freeze({ x: 61, y: 77, width: 14, height: 9 }),
  }),
  Object.freeze({
    id: "plant-succulent",
    kind: "plant",
    species: "succulent",
    label: "로제트 다육 화분",
    zone: "hall",
    anchor: Object.freeze({ x: 450, y: 222 }),
    visualRect: Object.freeze({ x: 440, y: 200, width: 20, height: 24 }),
    collisionRect: Object.freeze({ x: 443, y: 215, width: 14, height: 9 }),
  }),
]);

export const SEATS = Object.freeze({
  "hall:0": Object.freeze({
    key: "hall:0",
    displayNumber: "1",
    label: "일반석 1번",
    zone: "hall",
    group: "hall-row-1",
    facing: "right",
    deskRect: Object.freeze({ x: 418, y: 118, width: 28, height: 48 }),
    deskCollisionRect: Object.freeze({ x: 418, y: 118, width: 28, height: 48 }),
    monitorRect: Object.freeze({ x: 428, y: 128, width: 16, height: 22 }),
    chairRect: Object.freeze({ x: 394, y: 132, width: 20, height: 20 }),
    chairCollisionRect: Object.freeze({ x: 396, y: 136, width: 16, height: 12 }),
    cushionAnchor: Object.freeze({ x: 404, y: 144 }),
    keyboardAnchor: Object.freeze({ x: 421, y: 141 }),
    approachPoint: Object.freeze({ x: 374, y: 144 }),
    standPoint: Object.freeze({ x: 374, y: 144 }),
    deliveryStop: Object.freeze({ x: 404, y: 162 }),
    trayAnchor: Object.freeze({ x: 429, y: 154, width: 12, height: 10 }),
  }),
  "hall:1": Object.freeze({
    key: "hall:1",
    displayNumber: "2",
    label: "일반석 2번",
    zone: "hall",
    group: "hall-row-1",
    facing: "left",
    deskRect: Object.freeze({ x: 454, y: 118, width: 28, height: 48 }),
    deskCollisionRect: Object.freeze({ x: 454, y: 118, width: 28, height: 48 }),
    monitorRect: Object.freeze({ x: 456, y: 128, width: 16, height: 22 }),
    chairRect: Object.freeze({ x: 486, y: 132, width: 20, height: 20 }),
    chairCollisionRect: Object.freeze({ x: 488, y: 136, width: 16, height: 12 }),
    cushionAnchor: Object.freeze({ x: 496, y: 144 }),
    keyboardAnchor: Object.freeze({ x: 479, y: 141 }),
    approachPoint: Object.freeze({ x: 526, y: 144 }),
    standPoint: Object.freeze({ x: 526, y: 144 }),
    deliveryStop: Object.freeze({ x: 496, y: 162 }),
    trayAnchor: Object.freeze({ x: 459, y: 154, width: 12, height: 10 }),
  }),
  "solo:0": Object.freeze({
    key: "solo:0",
    displayNumber: "1인-1",
    label: "1인석 1번",
    zone: "solo",
    group: "solo",
    facing: "up",
    deskRect: Object.freeze({ x: 96, y: 72, width: 56, height: 24 }),
    deskCollisionRect: Object.freeze({ x: 96, y: 72, width: 56, height: 24 }),
    monitorRect: Object.freeze({ x: 107, y: 56, width: 26, height: 19 }),
    chairRect: Object.freeze({ x: 114, y: 100, width: 20, height: 18 }),
    chairCollisionRect: Object.freeze({ x: 116, y: 104, width: 16, height: 12 }),
    cushionAnchor: Object.freeze({ x: 124, y: 108 }),
    keyboardAnchor: Object.freeze({ x: 116, y: 89 }),
    approachPoint: Object.freeze({ x: 124, y: 132 }),
    standPoint: Object.freeze({ x: 124, y: 132 }),
    deliveryStop: Object.freeze({ x: 164, y: 114 }),
    trayAnchor: Object.freeze({ x: 136, y: 83, width: 14, height: 10 }),
  }),
});

export const SEAT_LIST = Object.freeze(Object.values(SEATS));

const WALKABLE_SURFACES = Object.freeze([
  ...Object.values(ZONES).flatMap((zone) => zone.walkableRects),
  ...DOORS.map((door) => door.passRect),
]);

function pointInRect(px, py, rect) {
  return px >= rect.x && px <= rect.x + rect.width && py >= rect.y && py <= rect.y + rect.height;
}

export function rectsOverlap(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

export function rectContains(outer, inner) {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  );
}

export function getFootBox(x, y) {
  const halfW = CHARACTER_SPEC.footBox.width / 2;
  const halfH = CHARACTER_SPEC.footBox.height / 2;
  return {
    x: x - halfW,
    y: y - halfH,
    width: CHARACTER_SPEC.footBox.width,
    height: CHARACTER_SPEC.footBox.height,
  };
}

export function getZoneAt(x, y) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  if (ZONES.solo.walkableRects.some((r) => pointInRect(x, y, r))) return "solo";
  if (ZONES.hall.walkableRects.some((r) => pointInRect(x, y, r))) return "hall";
  if (ZONES.exterior.walkableRects.some((r) => pointInRect(x, y, r))) return "exterior";
  for (const door of DOORS) {
    if (pointInRect(x, y, door.passRect)) {
      return y < door.threshold.cy ? door.toZone : door.fromZone;
    }
  }
  return null;
}

function isPointOnWalkableSurface(px, py) {
  return WALKABLE_SURFACES.some((rect) => pointInRect(px, py, rect));
}

export function getObstacles({ ignoreSeatKey = null } = {}) {
  const list = [];
  for (const item of FURNITURE) {
    list.push({ id: item.id, kind: item.kind, rect: item.collisionRect });
  }
  for (const seat of SEAT_LIST) {
    list.push({ id: `${seat.key}:desk`, kind: "desk", rect: seat.deskCollisionRect });
    if (seat.key !== ignoreSeatKey) {
      list.push({ id: `${seat.key}:chair`, kind: "chair", rect: seat.chairCollisionRect });
    }
  }
  return list;
}

export function isFootWalkable(x, y, { ignoreSeatKey = null } = {}) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  const box = getFootBox(x, y);
  const corners = [
    [box.x, box.y],
    [box.x + box.width, box.y],
    [box.x, box.y + box.height],
    [box.x + box.width, box.y + box.height],
    [x, box.y],
    [x, box.y + box.height],
  ];
  for (const [cx, cy] of corners) {
    if (!isPointOnWalkableSurface(cx, cy)) return false;
  }
  for (const obs of getObstacles({ ignoreSeatKey })) {
    if (rectsOverlap(box, obs.rect)) return false;
  }
  return true;
}

export function isSegmentWalkable(a, b, options = {}) {
  const dist = Math.hypot(b.x - a.x, b.y - a.y);
  const steps = Math.max(1, Math.ceil(dist / 2));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = a.x + (b.x - a.x) * t;
    const y = a.y + (b.y - a.y) * t;
    if (!isFootWalkable(x, y, options)) return false;
  }
  return true;
}

const GRID_STEP = 4;
const GRID_COLS = Math.floor(WORLD_SPEC.width / GRID_STEP);
const GRID_ROWS = Math.floor(WORLD_SPEC.height / GRID_STEP);

function snapToGrid(point) {
  return {
    col: Math.max(0, Math.min(GRID_COLS - 1, Math.round(point.x / GRID_STEP))),
    row: Math.max(0, Math.min(GRID_ROWS - 1, Math.round(point.y / GRID_STEP))),
  };
}

function gridCenter(col, row) {
  return { x: col * GRID_STEP, y: row * GRID_STEP };
}

function findNearestWalkableNode(point, options) {
  const base = snapToGrid(point);
  const center = gridCenter(base.col, base.row);
  if (isFootWalkable(center.x, center.y, options)) return base;
  let best = null;
  let bestDist = Infinity;
  for (let r = Math.max(0, base.row - 5); r <= Math.min(GRID_ROWS - 1, base.row + 5); r++) {
    for (let c = Math.max(0, base.col - 5); c <= Math.min(GRID_COLS - 1, base.col + 5); c++) {
      const pt = gridCenter(c, r);
      if (!isFootWalkable(pt.x, pt.y, options)) continue;
      const d = Math.hypot(pt.x - point.x, pt.y - point.y);
      if (d < bestDist) {
        bestDist = d;
        best = { col: c, row: r };
      }
    }
  }
  return best;
}

export function findPath(from, to, options = {}) {
  if (!from || !to) return [];
  if (!isFootWalkable(to.x, to.y, options)) return [];
  if (Math.hypot(to.x - from.x, to.y - from.y) < 1) return [{ x: to.x, y: to.y }];
  if (isFootWalkable(from.x, from.y, options) && isSegmentWalkable(from, to, options)) {
    return [{ x: to.x, y: to.y }];
  }

  const startNode = findNearestWalkableNode(from, options);
  const goalNode = findNearestWalkableNode(to, options);
  if (!startNode || !goalNode) return [];

  const total = GRID_COLS * GRID_ROWS;
  const idx = (c, r) => r * GRID_COLS + c;
  const gScore = new Float32Array(total).fill(Infinity);
  const fScore = new Float32Array(total).fill(Infinity);
  const cameFrom = new Int32Array(total).fill(-1);
  const closed = new Uint8Array(total);
  const inOpen = new Uint8Array(total);

  const startIdx = idx(startNode.col, startNode.row);
  const goalIdx = idx(goalNode.col, goalNode.row);
  gScore[startIdx] = 0;
  fScore[startIdx] = Math.hypot(goalNode.col - startNode.col, goalNode.row - startNode.row);

  const open = [startIdx];
  inOpen[startIdx] = 1;

  const dirs = [
    [1, 0, 1],
    [-1, 0, 1],
    [0, 1, 1],
    [0, -1, 1],
    [1, 1, Math.SQRT2],
    [1, -1, Math.SQRT2],
    [-1, 1, Math.SQRT2],
    [-1, -1, Math.SQRT2],
  ];

  while (open.length > 0) {
    let bestPos = 0;
    for (let i = 1; i < open.length; i++) {
      if (fScore[open[i]] < fScore[open[bestPos]]) bestPos = i;
    }
    const current = open[bestPos];
    open[bestPos] = open[open.length - 1];
    open.pop();
    inOpen[current] = 0;

    if (current === goalIdx) {
      const raw = [];
      let cursor = current;
      while (cursor !== -1 && cursor !== startIdx) {
        const c = cursor % GRID_COLS;
        const r = Math.floor(cursor / GRID_COLS);
        raw.push(gridCenter(c, r));
        cursor = cameFrom[cursor];
      }
      raw.reverse();
      if (raw.length === 0 || Math.hypot(raw.at(-1).x - to.x, raw.at(-1).y - to.y) > 0.5) {
        raw.push({ x: to.x, y: to.y });
      }
      const anchorStart = isFootWalkable(from.x, from.y, options) ? from : gridCenter(startNode.col, startNode.row);
      const chain = [anchorStart, ...raw];
      const smoothed = [];
      let anchorIdx = 0;
      while (anchorIdx < chain.length - 1) {
        let furthest = anchorIdx + 1;
        for (let probe = chain.length - 1; probe > anchorIdx + 1; probe--) {
          if (isSegmentWalkable(chain[anchorIdx], chain[probe], options)) {
            furthest = probe;
            break;
          }
        }
        smoothed.push(chain[furthest]);
        anchorIdx = furthest;
      }
      return smoothed;
    }

    closed[current] = 1;
    const cc = current % GRID_COLS;
    const cr = Math.floor(current / GRID_COLS);
    const curPt = gridCenter(cc, cr);

    for (const [dc, dr, stepCost] of dirs) {
      const nc = cc + dc;
      const nr = cr + dr;
      if (nc < 0 || nc >= GRID_COLS || nr < 0 || nr >= GRID_ROWS) continue;
      const nIdx = idx(nc, nr);
      if (closed[nIdx]) continue;
      const nPt = gridCenter(nc, nr);
      if (!isFootWalkable(nPt.x, nPt.y, options)) continue;
      if (dc !== 0 && dr !== 0) {
        const adjA = gridCenter(cc + dc, cr);
        const adjB = gridCenter(cc, cr + dr);
        if (!isFootWalkable(adjA.x, adjA.y, options) || !isFootWalkable(adjB.x, adjB.y, options)) continue;
      }
      if (!isSegmentWalkable(curPt, nPt, options)) continue;
      const tentative = gScore[current] + stepCost;
      if (tentative < gScore[nIdx]) {
        cameFrom[nIdx] = current;
        gScore[nIdx] = tentative;
        fScore[nIdx] = tentative + Math.hypot(goalNode.col - nc, goalNode.row - nr);
        if (!inOpen[nIdx]) {
          open.push(nIdx);
          inOpen[nIdx] = 1;
        }
      }
    }
  }

  return [];
}

export function planSeatApproach(from, currentSeatKey, targetSeatKey) {
  const target = SEATS[targetSeatKey];
  if (!target) return null;
  const startPoint = currentSeatKey && SEATS[currentSeatKey]
    ? { ...SEATS[currentSeatKey].standPoint }
    : { ...from };
  const walkPoints = findPath(startPoint, target.approachPoint);
  if (!walkPoints.length) return null;
  return {
    standFirst: Boolean(currentSeatKey && SEATS[currentSeatKey]),
    standPoint: currentSeatKey && SEATS[currentSeatKey] ? SEATS[currentSeatKey].standPoint : null,
    walkPoints,
    targetSeatKey,
    cushionAnchor: target.cushionAnchor,
    facing: target.facing,
  };
}

export function buildSeatMapModel(occupancy = {}, mySeatKey = null) {
  return {
    world: { width: WORLD_SPEC.width, height: WORLD_SPEC.height },
    zones: [
      { id: "solo", name: ZONES.solo.name, rect: ZONES.solo.mapRect },
      { id: "hall", name: ZONES.hall.name, rect: ZONES.hall.mapRect },
      { id: "exterior", name: ZONES.exterior.name, rect: ZONES.exterior.mapRect },
    ],
    doors: DOORS.map((door) => ({
      id: door.id,
      label: door.label,
      threshold: door.threshold,
      clearWidth: door.clearWidth,
    })),
    aisles: AISLES.map((aisle) => ({
      id: aisle.id,
      label: aisle.label,
      clearWidth: aisle.clearWidth,
      rect: aisle.rect,
    })),
    kiosk: {
      id: FURNITURE[0].id,
      label: FURNITURE[0].label,
      rect: FURNITURE[0].visualRect,
    },
    seats: SEAT_LIST.map((seat) => {
      const occupant = occupancy[seat.key] ?? null;
      const isMine = mySeatKey === seat.key;
      let status = "available";
      if (isMine) status = "mine";
      else if (occupant) status = "occupied";
      return {
        key: seat.key,
        displayNumber: seat.displayNumber,
        label: seat.label,
        zone: seat.zone,
        group: seat.group,
        facing: seat.facing,
        deskRect: seat.deskRect,
        chairRect: seat.chairRect,
        cushionAnchor: seat.cushionAnchor,
        status,
        occupantName: occupant?.name ?? null,
      };
    }),
  };
}
