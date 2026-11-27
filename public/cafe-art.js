import { FLOOR, LANDMARKS, ROOMS, WORLD, center, roomPartitions, toPercent, toPixels } from "./cafe-map.mjs";

const T = window.cafePixelTiles;
const { PAL } = T;
const scene = document.querySelector(".scene");
const viewport = scene.parentElement;
const avatars = document.getElementById("cafe-avatars");
const clerk = document.getElementById("cafe-delivery-clerk");
const motion = matchMedia("(prefers-reduced-motion: reduce)");
const { width: WIDTH, height: HEIGHT } = WORLD;
const pixel = (point) => {
  const { x, y } = toPixels(point);
  return { x: Math.round(x), y: Math.round(y) };
};
const xPct = (x) => x / WIDTH * 100;
const yPct = (y) => y / HEIGHT * 100;

function makeCanvas(className, width = WIDTH, height = HEIGHT) {
  const canvas = document.createElement("canvas");
  canvas.className = className;
  canvas.width = width;
  canvas.height = height;
  canvas.setAttribute("aria-hidden", "true");
  canvas.getContext("2d").imageSmoothingEnabled = false;
  return canvas;
}

const backdrop = makeCanvas("cafe-art-base");
const effects = makeCanvas("cafe-art-effects");
const base = backdrop.getContext("2d");
const overlay = effects.getContext("2d");
scene.prepend(backdrop, effects);
scene.dataset.canvasWorld = "";

let ready = false;
let area = "";
let layout = [];
let glass = [];
let screens = new Map();
let occupied = new Set();
let away = new Set();
let activeSeat = null;
let bootAt = 0;
let lastPhase;
let doorAt = -Infinity;
let relaxZones;

function placeTarget(element, anchor) {
  const point = center(anchor);
  element.style.setProperty("--x", xPct(point.x) + "%");
  element.style.setProperty("--y", yPct(point.y) + "%");
  element.style.left = xPct(point.x) + "%";
  element.style.top = yPct(point.y) + "%";
}
placeTarget(document.getElementById("kiosk-pin"), LANDMARKS.kiosk);
placeTarget(document.querySelector(".snack-counter"), { x: 512, y: 448, w: 32, h: 16 });
placeTarget(document.getElementById("cafe-board-pin"), LANDMARKS.board);

function rect(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.max(0, Math.round(w)), Math.max(0, Math.round(h)));
}

function foreground(layer, x, y, depth) {
  Object.assign(layer.style, {
    left: xPct(x) + "%", top: yPct(y) + "%",
    width: xPct(layer.width) + "%", height: yPct(layer.height) + "%",
    zIndex: String(Math.round(yPct(depth) * 10) + 1),
  });
  avatars.append(layer);
}

const displayRows = [
  ["soda_coke", "soda_pepsi", "soda_fanta", "soda_sprite", "boba_taro", "boba_strawberry", "boba_matcha"],
  ["cake_strawberry", "cake_matcha", "cake_cheese", "cake_chocolate", "pastry_bread", "pastry_croissant", "pastry_brioche"],
  ["onigiri_1", "onigiri_3", "onigiri_5", "coffee_foam", "fruit_strawberry", "jam_peach", "pastry_pretzel"],
];

function paintShop() {
  const { x, y, w, h } = LANDMARKS.counter;
  T.floor(base, x, y, w, h, true);
  T.prop(base, "menu_board_S", x + 16, y - 32, "lavender");
  T.prop(base, "shelf_wall_S", x + 64, y - 32, "wood");
  T.prop(base, "fridge_drinks_S", x + 112, y - 16, "mint");
  T.prop(base, "prep_table_S", x + 16, y + 16, "wood");
  T.prop(base, "sink_double_S", x + 80, y + 16, "cream");
  T.prop(base, "stove_S", x + 48, y + 16, "lavender");
  T.prop(base, "espresso_S", x + 112, y + 16, "rose");
  const front = makeCanvas("cafe-art-prop-front", w, 32);
  const ctx = front.getContext("2d");
  for (let col = 0; col < w; col += 16) T.prop(ctx, "counter_S", col, 0, "wood");
  displayRows[2].forEach((id, index) => T.food(ctx, id, index * 16 + 16, 0));
  foreground(front, x, y + 48, y + 70);
  for (const [row, items] of displayRows.slice(0, 2).entries()) {
    items.forEach((id, index) => T.food(base, id, x + 16 + index * 16, y + row * 16 - 8));
  }
}

function paintHall() {
  T.floor(base, FLOOR.x, FLOOR.y, FLOOR.w, FLOOR.h);
  T.wall(base, 16, 16, 736, 32, "cream");
  T.wall(base, 0, 16, 16, 480, "lavender", false, true);
  T.wall(base, 752, 16, 16, 480, "lavender", false, true);
  glass.push(...T.windowPanel(base, 48, 16, 192, 32), ...T.windowPanel(base, 528, 16, 192, 32));
  for (const [x, y] of [[240, 48], [352, 48], [416, 48], [512, 48]]) {
    T.prop(base, "pendant_S", x, y - 32, "cream");
  }

  const accents = { solo: "rose", duo: "mint", team: "lavender", squad: "rose" };
  for (const room of ROOMS) {
    const { x, y, w, h } = room.rect;
    T.rug(base, x + 16, y + 16, w - 32, h - 16, accents[room.space]);
    for (const part of roomPartitions(room)) T.partition(base, part, room.space === "squad" || room.space === "team");
    T.prop(base, "picture_S", room.door.x, room.door.y - 32, "rose");
  }

  const lounge = LANDMARKS.lounge;
  T.rug(base, lounge.x, lounge.y, lounge.w - 16, lounge.h, "lavender");
  T.prop(base, "sofa2_S", lounge.x + 16, lounge.y, "rose");
  T.prop(base, "table_round_S", lounge.x + 48, lounge.y + 16, "wood");
  T.prop(base, "armchair_E", lounge.x + 64, lounge.y + 16, "mint");
  T.prop(base, "plant_small_S", lounge.x, lounge.y + 32, "mint");
  paintShop();

  const booth = LANDMARKS.booth;
  T.rug(base, booth.x, booth.y, booth.w, booth.h, "mint");
  T.partition(base, { x: booth.x, y: booth.y, w: booth.w, h: 16 });
  T.partition(base, { x: booth.x, y: booth.y + 16, w: 16, h: 32 });
  T.prop(base, "bench_S", booth.x + 16, booth.y, "mint");
  T.prop(base, "hood_S", booth.x + 16, booth.y - 16, "cream");

  const { kiosk, board, entrance, terrace } = LANDMARKS;
  T.workstation(base, "kiosk", kiosk.x, kiosk.y, 1);
  T.prop(base, "menu_board_S", board.x, board.y - 16, "rose");
  T.prop(base, "mat_S", entrance.x, entrance.y - 16, "rose");
  T.door(base, entrance.x, entrance.y - 8, entrance.w, 0);
  T.prop(base, "mat_S", terrace.x, terrace.y, "mint");
  T.prop(base, "plant_tall_S", 704, 436, "mint");
  T.prop(base, "plant_small_S", 208, 368, "mint");
  T.prop(base, "plant_tall_S", 80, 434, "mint");
  T.prop(base, "plant_small_S", 656, 432, "mint");

  for (const seat of layout) {
    const panel = T.desk(base, seat);
    screens.set(seat.key, panel);
    const { x, y, w, h } = T.chairPosition(seat);
    const layer = makeCanvas("cafe-art-chair", w, h);
    layer.dataset.seat = seat.key;
    T.chairFront(layer.getContext("2d"), seat);
    foreground(layer, x, y, seat.foot.y);
  }
}

function paintBreakArea() {
  const outside = area === "terrace";
  if (outside) {
    T.skyline(base, 0, 0, WIDTH, 248, lastPhase);
    T.floor(base, 48, 256, 672, 256, true, false, "terracotta");
    T.partition(base, { x: 48, y: 240, w: 672, h: 16 }, true);
    T.prop(base, "bench_S", 384, 280, "mint");
    T.prop(base, "side_table_S", 416, 312, "wood");
    T.prop(base, "plant_tall_S", 624, 288, "mint");
    T.prop(base, "plant_tall_S", 576, 352, "mint");
  } else {
    T.floor(base, 48, 256, 672, 240);
    T.wall(base, 48, 160, 672, 96, "lavender");
    glass.push(...T.windowPanel(base, 112, 176, 544, 48));
    T.rug(base, 176, 256, 224, 96, "rose");
    T.prop(base, "sofa2_S", 192, 256, "rose");
    T.prop(base, "table_round_S", 240, 288, "wood");
    T.prop(base, "plant_tall_S", 592, 224, "mint");
  }
  const config = relaxZones[area];
  const machine = pixel(config.spots.find(({ mode }) => mode === (outside ? "coffee" : "candy")));
  T.workstation(base, "vending", T.snap(machine.x - 16), T.snap(machine.y - 64), 2);
  const door = pixel(config.door);
  T.door(base, T.snap(door.x - 16), T.snap(door.y - 16), 32, 3);
}

function paintBase() {
  screens = new Map();
  glass = [];
  avatars.querySelectorAll(".cafe-art-chair, .cafe-art-prop-front").forEach((node) => node.remove());
  rect(base, 0, 0, WIDTH, HEIGHT, PAL.p2);
  if (area === "hall") paintHall();
  else paintBreakArea();
}

function paintEffects(now) {
  if (!ready || !area || document.hidden) return;
  const phase = document.body.dataset.cafeLight || "night";
  if (phase !== lastPhase) {
    lastPhase = phase;
    paintBase();
  }
  const night = phase === "night" || phase === "dusk";
  const weather = document.body.dataset.cafeWeather || "rain";
  overlay.clearRect(0, 0, WIDTH, HEIGHT);
  for (const { x, y, w } of glass) {
    for (let offset = 0; offset < w; offset += 16) {
      for (let row = 0; row < 3; row++) {
        const tone = night ? "rgba(199,177,225,.12)" : weather === "rain" ? "rgba(155,185,207,.14)" : "rgba(255,219,155,.18)";
        rect(overlay, x + offset + row * 16, y + 16 + row * 16, 16, 16, tone);
      }
    }
  }
  if (night) rect(overlay, 0, 0, WIDTH, HEIGHT, "rgba(87,68,113,.24)");
  for (const [key, { x, y, w, h }] of screens) {
    if (key !== activeSeat && !occupied.has(key)) continue;
    const booting = key === activeSeat && !motion.matches && now - bootAt < 800;
    rect(overlay, x, y, w, h, away.has(key) ? PAL.c1 : PAL.t0);
    if (away.has(key)) rect(overlay, x + w / 2 - 1, y + h / 2 - 1, 3, 3, PAL.y3);
    else if (booting) rect(overlay, x + 1, y + h - 2, (w - 2) * Math.max(0, (now - bootAt) / 800), 1, PAL.g3);
    else rect(overlay, x + 1, y + 1, w - 2, 2, PAL.t3);
  }
  if (area === "hall" && night) T.animation(overlay, "neon_open", 368, 32, Math.floor(now / (motion.matches ? 480 : 160)));
  T.weatherLoop(overlay, weather, now, motion.matches);
  if (area === "hall" && clerk.dataset.mode === "cook" && !clerk.hidden) {
    T.animation(overlay, "stove", LANDMARKS.counter.x + 48, LANDMARKS.counter.y + 16, Math.floor(now / 125));
    T.animation(overlay, "steam", LANDMARKS.counter.x + 48, LANDMARKS.counter.y, Math.floor(now / 125));
  }
  if (area === "hall" && !motion.matches && now - doorAt < 650) {
    const { x, y, w } = LANDMARKS.entrance;
    const age = now - doorAt;
    T.door(overlay, x, y - 8, w, Math.min(3, Math.floor(Math.min(age, 650 - age) / 70)));
  }
}

window.cafeArt = {
  pixel,
  kitchenClerk: toPercent({ x: 544, y: 443 }),
  place: (point) => toPercent(pixel(point)),
  screen(key) {
    const panel = screens.get(key);
    return panel && { ...toPercent(panel), w: xPct(panel.w), h: yPct(panel.h) };
  },
  tray(key) {
    const panel = screens.get(key);
    return panel && toPercent({ x: panel.trayX, y: panel.trayY });
  },
  show(space, seats) {
    if (area === space) return;
    area = space;
    layout = seats;
    lastPhase = "";
    paintEffects(performance.now());
  },
  updateScreens(seat, seats, awaySeats) {
    if (activeSeat !== seat) bootAt = performance.now();
    activeSeat = seat;
    occupied = seats;
    away = awaySeats;
    paintEffects(performance.now());
  },
  openDoor() { doorAt = performance.now(); },
};

Promise.all([T.ready, import("./world.js")]).then(([, world]) => {
  relaxZones = world.relaxZones;
  viewport.style.setProperty("--cafe-margin-tile", `url("${T.marginTile()}")`);
  ready = true;
  paintEffects(performance.now());
  document.dispatchEvent(new Event("cafe-art-ready"));
  setInterval(() => paintEffects(performance.now()), 110);
}).catch((error) => {
  const message = document.createElement("p");
  message.className = "cafe-art-message";
  message.setAttribute("role", "status");
  message.textContent = "픽셀 에셋을 불러오지 못했어요.";
  scene.append(message);
  console.error(error);
});
