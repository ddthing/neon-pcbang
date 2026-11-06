export const entrance = { x: 33.5, y: 81.5 };
export const kiosk = { x: 26.3, y: 81.5 };

const obstacles = [
  [0, 0, 16, 55],
  [0, 60, 20, 81],
  [16.2, 29, 23.7, 51.6],
  [25, 17.3, 35, 75.8],
  [39.7, 17.3, 49.8, 75.8],
  [55.3, 17.3, 65.5, 75.8],
  [71, 17.3, 81, 75.8],
];

export function canWalk(x, y) {
  return x >= 16 && x <= 85.4 && y >= 15.8 && y <= 83.8 &&
    !obstacles.some(([left, top, right, bottom]) => x >= left && x <= right && y >= top && y <= bottom);
}

// The walkable cells are shared with the server's position validation.
const step = 1.2;
const columns = 59;
const rows = 57;
const cells = Array.from({ length: columns * rows }, (_, index) => ({
  x: 16 + (index % columns) * step,
  y: 16 + Math.floor(index / columns) * step,
}));
const walkable = cells.map(({ x, y }) => canWalk(x, y));
const distance = (a, b) => Math.hypot(a.x - b.x, (a.y - b.y) * .67);

function nearest(point, from) {
  let match = -1;
  let shortest = Infinity;
  for (const [index, cell] of cells.entries()) {
    if (!walkable[index]) continue;
    const length = distance(cell, point);
    if (length < shortest && (!from || clearSegment(from, cell))) {
      match = index;
      shortest = length;
    }
  }
  return match;
}

function clearSegment(a, b) {
  const samples = Math.max(1, Math.ceil(distance(a, b) * 2));
  for (let i = 1; i <= samples; i++) {
    if (!canWalk(a.x + (b.x - a.x) * i / samples, a.y + (b.y - a.y) * i / samples)) return false;
  }
  return true;
}

export function pathTo(from, to) {
  if (clearSegment(from, to)) return [to];
  const start = nearest(from, from);
  const end = nearest(to);
  if (start < 0 || end < 0) return [];
  const parents = new Int16Array(cells.length).fill(-1);
  const queue = [start];
  parents[start] = start;
  for (let cursor = 0; cursor < queue.length && parents[end] === -1; cursor++) {
    const index = queue[cursor];
    const column = index % columns;
    for (const next of [column > 0 ? index - 1 : -1, column < columns - 1 ? index + 1 : -1, index - columns, index + columns]) {
      if (!walkable[next] || parents[next] !== -1 || !clearSegment(cells[index], cells[next])) continue;
      parents[next] = index;
      queue.push(next);
    }
  }
  if (parents[end] === -1) return [];
  const route = [];
  for (let index = end; index !== start; index = parents[index]) route.push(cells[index]);
  route.push(cells[start]);
  route.reverse();
  if (canWalk(to.x, to.y) && clearSegment(route.at(-1), to)) route.push(to);
  return route;
}

export const roomPortals = {
  solo: { x: 16.6, y: 25.2 },
  duo: { x: 16.6, y: 56 },
  team: { x: 84.5, y: 37.5 },
  squad: { x: 84.5, y: 64.8 },
};
const roomDoor = { x: 50, y: 94 };
// Each pair of screens faces out into two different aisles.
const hallAisles = [24.4, 36, 39, 50.6, 54.5, 66.3, 70.3, 82];

function approachSeat(key, chair) {
  const [space, number] = key.split(":");
  const index = Number(number);
  if (space === "hall") {
    const aisle = Math.floor(index / 22) * 2 + index % 2;
    return [{ x: hallAisles[aisle], y: chair.y }, chair];
  }
  if (space === "squad" && index < 3) {
    return [{ x: 17.5, y: 88 }, { x: 17.5, y: chair.y }, chair];
  }
  return [{ x: chair.x, y: 87 }, chair];
}

export function routeToSeat(from, previous, destination, chairPosition) {
  const originSpace = previous?.split(":")[0] ?? "hall";
  const destinationSpace = destination.split(":")[0];
  const chair = chairPosition(destination);
  const approach = approachSeat(destination, chair);
  const start = previous ? chairPosition(previous) : from;
  const exit = previous ? approachSeat(previous, start).slice(0, -1).reverse() : [];
  const legs = [];

  if (originSpace !== "hall") {
    if (originSpace === destinationSpace) {
      return [{ space: originSpace, start, points: [...exit, roomDoor, ...approach] }];
    }
    legs.push({ space: originSpace, start, points: [...exit, roomDoor] });
  }

  const hallStart = originSpace === "hall" ? start : roomPortals[originSpace];
  const hallExit = originSpace === "hall" ? exit : [];
  const hallTarget = destinationSpace === "hall" ? approach[0] : roomPortals[destinationSpace];
  const path = pathTo(hallExit.at(-1) ?? hallStart, hallTarget);
  if (!path.length) return [];
  legs.push({
    space: "hall", start: hallStart,
    points: [...hallExit, ...path, ...(destinationSpace === "hall" ? approach.slice(1) : [])],
  });
  if (destinationSpace !== "hall") {
    legs.push({ space: destinationSpace, start: roomDoor, points: approach });
  }
  return legs;
}
