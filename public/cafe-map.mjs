export const TILE = 16;
export const WORLD = { width: 48 * TILE, height: 32 * TILE };
const px = (tiles) => tiles * TILE;
const box = (x, y, w, h) => ({ x: px(x), y: px(y), w: px(w), h: px(h) });
const point = (x, y) => ({ x: px(x), y: px(y) });
export const toPercent = ({ x, y }) => ({ x: x / WORLD.width * 100, y: y / WORLD.height * 100 });
export const toPixels = ({ x, y }) => ({ x: x / 100 * WORLD.width, y: y / 100 * WORLD.height });
export const center = ({ x, y, w, h }) => ({ x: x + w / 2, y: y + h / 2 });

export const FLOOR = box(1, 2, 46, 29);
export const ENTRANCE = point(24, 29);
export const LANDMARKS = {
  entrance: { ...box(23, 30, 2, 2), label: "입구" },
  kiosk: { ...box(26, 27, 1, 2), label: "자리 선택기" },
  lounge: { ...box(14, 26, 7, 4), label: "대기 라운지" },
  counter: { ...box(29, 25, 9, 5), label: "매점 · 오픈키친" },
  booth: { ...box(20, 26, 3, 4), label: "실내 흡연구역" },
  terrace: { ...box(39, 29, 2, 2), label: "야외 흡연구역" },
  board: { ...box(27, 25, 2, 2), label: "게시판" },
};
export const ROOM_LABELS = { hall: "일반석", solo: "1인석", duo: "2인룸", team: "5인룸", squad: "6인룸" };

export const ROOMS = [
  { id: "solo-1", space: "solo", rect: box(1, 4, 7, 6), side: "south", label: "1인석 1" },
  { id: "solo-2", space: "solo", rect: box(7, 4, 6, 6), side: "east", label: "1인석 2" },
  { id: "solo-3", space: "solo", rect: box(1, 11, 7, 6), side: "south", label: "1인석 3" },
  { id: "solo-4", space: "solo", rect: box(7, 11, 6, 6), side: "east", label: "1인석 4" },
  { id: "squad-1", space: "squad", rect: box(1, 18, 12, 12), side: "east", label: "6인룸" },
  { id: "duo-1", space: "duo", rect: box(39, 4, 8, 6), side: "west", label: "2인룸 1" },
  { id: "duo-2", space: "duo", rect: box(39, 11, 8, 6), side: "west", label: "2인룸 2" },
  { id: "team-1", space: "team", rect: box(39, 18, 8, 11), side: "west", label: "5인룸" },
].map((room) => ({
  ...room,
  door: {
    x: room.rect.x + (room.side === "south" ? 2 * TILE : room.side === "east" ? room.rect.w - TILE : 0),
    y: room.rect.y + (room.side === "south" ? room.rect.h - TILE : Math.floor(room.rect.h / TILE / 2) * TILE),
  },
}));

// Authentic Korean PC방 Back-to-Back Desk Banks:
// 3 vertical blocks × 2 horizontal bays (4 connected 2-tile desks each) = 48 hall seats
const hallBays = [
  [16, 18, 20, 22], // Left Bay (x = 16..24, 3 tiles from solo rooms & 3 tiles center aisle)
  [27, 29, 31, 33], // Right Bay (x = 27..35, 4 tiles from duo/team rooms)
];
const hallBlocks = [
  [5, 7],   // Block 1: North row facing down + South row facing up
  [12, 14], // Block 2: North row facing down + South row facing up
  [19, 21], // Block 3: North row facing down + South row facing up
];
export const HALL_BANKS = hallBlocks.flatMap(([northY, southY], blockIndex) =>
  hallBays.map((cols, bayIndex) => ({
    id: `bank-${blockIndex}-${bayIndex}`,
    x: px(cols[0]),
    y: px(northY),
    w: px(cols.length * 2),
    seamY: px(southY),
    cols,
    northY,
    southY,
  })),
);
export const HALL_TABLES = HALL_BANKS.flatMap(({ cols, northY, southY }) => [
  ...cols.map((x) => ({ ...box(x, northY, 2, 2), direction: "down", blockTop: northY === 5 })),
  ...cols.map((x) => ({ ...box(x, southY, 2, 2), direction: "up", blockTop: false })),
]);

export const SEAT_TIERS = {
  window: { label: "창가석", perk: "집중 보너스 +10%" },
  hall: { label: "일반석", perk: "쾌적한 48석 홀" },
  solo: { label: "1인 프라이빗", perk: "개인 칸막이 룸" },
  duo: { label: "2인 커플룸", perk: "파티 보너스 +20%" },
  team: { label: "5인 팀룸", perk: "파티 보너스 +20%" },
  squad: { label: "6인 풀파티룸", perk: "파티 보너스 +20%" },
};

const seatCounts = {};
function createSeat(space, room, desk, direction = "up", tier = space) {
  const index = seatCounts[space] ?? 0;
  seatCounts[space] = index + 1;
  const center = desk.x + desk.w / 2;
  const y = desk.y + desk.h;
  const foot = direction === "right" ? { x: desk.x - 9, y: desk.y + 25 }
    : direction === "left" ? { x: desk.x + desk.w + 9, y: desk.y + 25 }
    : direction === "down" ? { x: center, y: desk.y - 5 }
    : { x: center, y: y + 8 };
  const stand = direction === "right" ? { x: foot.x - 8, y: foot.y + 9 }
    : direction === "left" ? { x: foot.x + 8, y: foot.y + 9 }
    : direction === "down" ? { x: foot.x, y: foot.y - 9 }
    : { x: foot.x, y: foot.y + 11 };
  return { key: space + ":" + index, index, space, room, desk, direction, foot, stand, tier };
}

const hallSeats = HALL_TABLES.map(({ x, y, w, h, direction, blockTop }) =>
  createSeat("hall", null, { x, y, w, h }, direction, blockTop ? "window" : "hall"),
);
const sideDesk = (room, x, y, direction) => createSeat("solo", room, box(x, y, 1, 3), direction, "solo");
const soloSeats = [
  sideDesk("solo-1", 4, 5, "right"), sideDesk("solo-2", 9, 5, "left"),
  sideDesk("solo-3", 4, 12, "right"), sideDesk("solo-4", 9, 12, "left"),
];
const row = (space, room, y, columns) => columns.map((x) => createSeat(space, room, box(x, y, 2, 2), "up", space));
const duoSeats = [...row("duo", "duo-1", 5, [40, 44]), ...row("duo", "duo-2", 12, [40, 44])];
const teamSeats = [...row("team", "team-1", 19, [40, 42, 44]), ...row("team", "team-1", 24, [41, 44])];
const squadSeats = [...row("squad", "squad-1", 19, [2, 6, 10]), ...row("squad", "squad-1", 24, [2, 6, 10])];
export const SEATS = [...hallSeats, ...soloSeats, ...duoSeats, ...teamSeats, ...squadSeats];
export const SEAT_COUNTS = Object.freeze(seatCounts);
const byKey = new Map(SEATS.map((seat) => [seat.key, seat]));
export const seatFor = (key) => byKey.get(key);
export const seatCode = ({ space, index }) => (space === "hall" ? "A" : "") + String(index + 1).padStart(2, "0");

export function roomPartitions(room) {
  const { x, y, w, h } = room.rect;
  const top = { x, y, w, h: TILE };
  const left = { x, y: y + TILE, w: TILE, h: h - TILE };
  const right = { ...left, x: x + w - TILE };
  if (room.side === "south") {
    const edge = { x, y: y + h - TILE, w: 2 * TILE, h: TILE };
    return [top, left, right, edge, { ...edge, x: x + w - edge.w }];
  }
  const entrance = room.side === "east" ? right : left;
  const before = { ...entrance, h: room.door.y - entrance.y };
  const after = { ...entrance, y: room.door.y + 2 * TILE, h: y + h - room.door.y - 2 * TILE };
  return [top, room.side === "east" ? left : right, before, after].filter(({ h }) => h > 0);
}

const obstacles = [
  ...ROOMS.flatMap(roomPartitions),
  ...SEATS.map(({ desk }) => ({ x: desk.x + 2, y: desk.y + 10, w: desk.w - 4, h: desk.h - 15 })),
  ...SEATS.map(({ foot }) => ({ x: foot.x - 6, y: foot.y - 4, w: 12, h: 7 })),
  box(15, 27, 2, 1),
  box(17, 28, 2, 1),
  box(26, 27, 1, 1),
  box(29, 25, 9, 4),
  box(20, 26, 3, 2),
];

export const COUNTER_EXIT = point(28, 29);
export const QUICK_VIEWS = {
  hall: point(24, 14),
  counter: point(33, 27),
  rooms: point(40, 13),
  booth: point(21, 28),
};
export function canWalkInCafe(x, y) {
  const { x: l, y: t, w, h } = FLOOR;
  if (x < l + 4 || x > l + w - 4 || y < t + 3 || y > t + h - 3) return false;
  const door = LANDMARKS.entrance;
  if (y > door.y && (x < door.x + 4 || x > door.x + door.w - 4)) return false;
  return !obstacles.some((box) =>
    x + 4 > box.x && x - 4 < box.x + box.w && y + 3 > box.y && y - 3 < box.y + box.h);
}
