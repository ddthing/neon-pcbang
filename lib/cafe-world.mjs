import { CHARACTER_SPEC } from "./renewal-layout.mjs";

import { LANDMARKS, ROOMS, ENTRANCE, COUNTER_EXIT, WORLD, canWalkInCafe, center, seatFor, toPercent, toPixels } from "./cafe-map.mjs";

export const MOVEMENT_SPEC = Object.freeze({
  world: WORLD,
  footBox: CHARACTER_SPEC.footBox,
  walkSpeedPxPerSec: CHARACTER_SPEC.walkSpeedPxPerSec,
  legacyPixels: WORLD,
});

export function percentToLegacyPx(point) {
  return {
    x: point.x * MOVEMENT_SPEC.legacyPixels.width / 100,
    y: point.y * MOVEMENT_SPEC.legacyPixels.height / 100,
  };
}

export function legacyPxToPercent(point) {
  return {
    x: point.x * 100 / MOVEMENT_SPEC.legacyPixels.width,
    y: point.y * 100 / MOVEMENT_SPEC.legacyPixels.height,
  };
}

export const entrance = toPercent(ENTRANCE);
export const entranceThreshold = Object.freeze({
  xMin: 23 / 48 * 100,
  xMax: 25 / 48 * 100,
  yMin: 30 / 32 * 100,
  yMax: 31 / 32 * 100,
  center: toPercent({ x: 384, y: 480 }),
});
export const kiosk = toPercent(center(LANDMARKS.kiosk));

export const relaxPortals = {
  booth: { ...toPercent({ x: 344, y: 455 }), label: "실내 흡연구역", sub: "유리 부스" },
  terrace: { ...toPercent(center(LANDMARKS.terrace)), label: "야외 흡연구역", sub: "2F 테라스·자판기" },
};

// Entry/exit doors and interactive props inside the two new relaxation zones
export const relaxZones = {
  booth: {
    id: "booth",
    label: "실내 흡연구역",
    door: { x: 60.5, y: 66.5 },
    bounds: [11, 47, 88.5, 67.5],
    obstacles: [
      [43.5, 45, 48, 50.5],
      [76, 45, 80.5, 50.5],
      [81.5, 44, 92, 54],
      [88, 61, 94, 68],
    ],
    spots: [
      { id: "window", x: 31.5, y: 49.2, label: "창가 기대기", mode: "smoke" },
      { id: "ashtray-left", x: 45.8, y: 52.5, label: "재떨이 앞", mode: "smoke" },
      { id: "ashtray-right", x: 78.2, y: 52.5, label: "환풍구 아래", mode: "smoke" },
      { id: "vending", x: 83.5, y: 56.5, label: "캔디·온음료기", mode: "candy" },
    ],
  },
  terrace: {
    id: "terrace",
    label: "야외 흡연구역",
    door: { x: 49.2, y: 72.5 },
    bounds: [18, 54, 83.5, 73.5],
    obstacles: [
      [55.5, 52, 74, 57.5],
      [74.5, 52, 86, 60.5],
      [82.5, 60, 92, 74],
    ],
    spots: [
      { id: "coffee-machine", x: 21.0, y: 67.5, label: "밀크커피 자판기 (무료)", mode: "coffee" },
      { id: "railing", x: 41.5, y: 55.5, label: "서울 야경 난간", mode: "smoke" },
      { id: "terrace-ashtray", x: 70.2, y: 59.5, label: "테라스 스툴 & 재떨이", mode: "smoke" },
    ],
  },
};

export function canWalk(x, y) {
  const point = toPixels({ x, y });
  return canWalkInCafe(point.x, point.y);
}

export function canWalkInSpace(x, y, space = "hall") {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  if (space === "booth" || space === "terrace") {
    const cfg = relaxZones[space];
    const [minX, minY, maxX, maxY] = cfg.bounds;
    return x >= minX && x <= maxX && y >= minY && y <= maxY &&
      !cfg.obstacles.some(([l, t, r, b]) => x >= l && x <= r && y >= t && y <= b);
  }
  return canWalk(x, y);
}

// Precomputed grid for the main hall + lightweight dynamic BFS for booth/terrace
const step = 8;
const columns = WORLD.width / step;
const rows = WORLD.height / step;
const cells = Array.from({ length: columns * rows }, (_, index) => toPercent({
  x: (index % columns) * step + step / 2,
  y: Math.floor(index / columns) * step + step / 2,
}));
const walkable = cells.map(({ x, y }) => canWalk(x, y));
const distance = (a, b) => Math.hypot(a.x - b.x, (a.y - b.y) * .67);

export function clearSegmentInSpace(a, b, space = "hall") {
  const samples = Math.max(1, Math.ceil(distance(a, b) * 2));
  for (let i = 1; i <= samples; i++) {
    if (!canWalkInSpace(a.x + (b.x - a.x) * i / samples, a.y + (b.y - a.y) * i / samples, space)) return false;
  }
  return true;
}

function nearest(point, from) {
  let match = -1;
  let shortest = Infinity;
  for (const [index, cell] of cells.entries()) {
    if (!walkable[index]) continue;
    const length = distance(cell, point);
    if (length < shortest && (!from || clearSegmentInSpace(from, cell, "hall"))) {
      match = index;
      shortest = length;
    }
  }
  return match;
}

function findRelaxPath(from, target, space) {
  const cfg = relaxZones[space];
  const [minX, minY, maxX, maxY] = cfg.bounds;
  if (!canWalkInSpace(target.x, target.y, space)) return [];
  if (canWalkInSpace(from.x, from.y, space) && clearSegmentInSpace(from, target, space)) {
    return [target];
  }
  const relaxStep = 1.5;
  const cols = Math.floor((maxX - minX) / relaxStep) + 1;
  const rRows = Math.floor((maxY - minY) / relaxStep) + 1;
  const nodes = Array.from({ length: cols * rRows }, (_, idx) => ({
    x: minX + (idx % cols) * relaxStep,
    y: minY + Math.floor(idx / cols) * relaxStep,
  }));
  const ok = nodes.map((pt) => canWalkInSpace(pt.x, pt.y, space));
  const pickNearest = (pt, requireClearFromPt) => {
    let best = -1;
    let bestDist = Infinity;
    for (let i = 0; i < nodes.length; i++) {
      if (!ok[i]) continue;
      if (requireClearFromPt && !clearSegmentInSpace(pt, nodes[i], space)) continue;
      const d = distance(nodes[i], pt);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    return best;
  };
  const start = pickNearest(from, true);
  const end = pickNearest(target, true);
  if (start < 0 || end < 0) return [];
  const parents = new Int16Array(nodes.length).fill(-1);
  const queue = [start];
  parents[start] = start;
  for (let cursor = 0; cursor < queue.length && parents[end] === -1; cursor++) {
    const cur = queue[cursor];
    const col = cur % cols;
    for (const next of [col > 0 ? cur - 1 : -1, col < cols - 1 ? cur + 1 : -1, cur - cols, cur + cols]) {
      if (next < 0 || next >= nodes.length || !ok[next] || parents[next] !== -1) continue;
      if (!clearSegmentInSpace(nodes[cur], nodes[next], space)) continue;
      parents[next] = cur;
      queue.push(next);
    }
  }
  if (parents[end] === -1) return [];
  const raw = [];
  for (let idx = end; idx !== start; idx = parents[idx]) raw.push(nodes[idx]);
  raw.push(nodes[start]);
  raw.reverse();
  if (clearSegmentInSpace(raw.at(-1), target, space)) raw.push(target);
  const chain = canWalkInSpace(from.x, from.y, space) ? [from, ...raw] : raw;
  const smoothed = [];
  let anchor = 0;
  while (anchor < chain.length - 1) {
    let furthest = anchor + 1;
    for (let probe = chain.length - 1; probe > anchor + 1; probe--) {
      if (clearSegmentInSpace(chain[anchor], chain[probe], space)) {
        furthest = probe;
        break;
      }
    }
    smoothed.push(chain[furthest]);
    anchor = furthest;
  }
  return smoothed;
}

export function pathTo(from, to, space = "hall", options = {}) {
  if (!from || !to) return [];
  if (options?.strictTarget && !canWalkInSpace(to.x, to.y, space)) return [];
  if (space === "booth" || space === "terrace") {
    const cfg = relaxZones[space];
    const [minX, minY, maxX, maxY] = cfg.bounds;
    const target = options?.strictTarget ? to : {
      x: Math.max(minX + .5, Math.min(maxX - .5, to.x)),
      y: Math.max(minY + .5, Math.min(maxY - .5, to.y)),
    };
    return findRelaxPath(from, target, space);
  }
  const sameCorridor = Math.abs(from.x - to.x) < 2.2 || Math.abs(from.y - to.y) < 2.2;
  if (sameCorridor && clearSegmentInSpace(from, to, "hall")) return [to];
  const start = nearest(from, from);
  const end = nearest(to, options?.strictTarget ? to : null);
  if (start < 0 || end < 0) return [];
  const parents = new Int16Array(cells.length).fill(-1);
  const queue = [start];
  parents[start] = start;
  for (let cursor = 0; cursor < queue.length && parents[end] === -1; cursor++) {
    const index = queue[cursor];
    const column = index % columns;
    for (const next of [column > 0 ? index - 1 : -1, column < columns - 1 ? index + 1 : -1, index - columns, index + columns]) {
      if (next < 0 || next >= cells.length || !walkable[next] || parents[next] !== -1 || !clearSegmentInSpace(cells[index], cells[next], "hall")) continue;
      parents[next] = index;
      queue.push(next);
    }
  }
  if (parents[end] === -1) return [];
  const rawRoute = [];
  for (let index = end; index !== start; index = parents[index]) rawRoute.push(cells[index]);
  rawRoute.push(cells[start]);
  rawRoute.reverse();
  if (canWalk(to.x, to.y) && clearSegmentInSpace(rawRoute.at(-1), to, "hall")) rawRoute.push(to);
  else if (options?.strictTarget) return [];
  // Compact collinear aisle waypoints for crisp grounded orthogonal walking
  const route = [];
  for (const pt of rawRoute) {
    if (route.length >= 2) {
      const a = route[route.length - 2];
      const b = route[route.length - 1];
      if ((Math.abs(a.x - b.x) < 0.05 && Math.abs(b.x - pt.x) < 0.05) ||
          (Math.abs(a.y - b.y) < 0.05 && Math.abs(b.y - pt.y) < 0.05)) {
        route[route.length - 1] = pt;
        continue;
      }
    }
    route.push(pt);
  }
  return route;
}

export const roomPortals = Object.fromEntries(
  ["solo", "duo", "team", "squad"].map((space) => {
    const { door } = ROOMS.find((room) => room.space === space);
    return [space, toPercent({ x: door.x + 8, y: door.y + 16 })];
  }),
);

export function routeToSeat(from, previous, destination, chairPosition) {
  const target = seatFor(destination);
  const origin = seatFor(previous);
  if (!target) return [];
  const chair = chairPosition ? chairPosition(destination) : toPercent(target.foot);
  if (!chair) return [];
  const start = origin ? toPercent(origin.foot) : from;
  if (!start) return [];
  const approach = toPercent(target.stand);
  const exit = origin ? toPercent(origin.stand) : start;
  const route = pathTo(exit, approach, "hall", { strictTarget: true });
  if (!route.length) return [];
  return [{ space: "hall", start, points: [...(origin ? [exit] : []), ...route, chair] }];
}

const counterExit = toPercent(COUNTER_EXIT);

export function routeForDelivery(seat, chairPosition) {
  if (!chairPosition(seat)) return null;
  const legs = routeToSeat(counterExit, null, seat, chairPosition);
  const segments = [];
  let distance = 0;
  let facing = 1;
  for (const { space, start, points } of legs) {
    let from = start;
    for (const to of points) {
      const length = Math.hypot(to.x - from.x, (to.y - from.y) * .67);
      if (length) {
        if (to.x !== from.x) facing = Math.sign(to.x - from.x);
        segments.push({ space, from, to, facing, start: distance, end: distance + length });
        distance += length;
      }
      from = to;
    }
  }
  return distance ? { segments, distance } : null;
}

export function deliveryRoutePoint(route, progress, returning = false) {
  const part = Math.max(0, Math.min(1, progress));
  const distance = route.distance * (returning ? 1 - part : part);
  const segment = route.segments.find(({ end }) => end > distance) ?? route.segments.at(-1);
  const step = (distance - segment.start) / (segment.end - segment.start);
  return {
    space: segment.space,
    x: segment.from.x + (segment.to.x - segment.from.x) * step,
    y: segment.from.y + (segment.to.y - segment.from.y) * step,
    facing: segment.facing * (returning ? -1 : 1),
  };
}
