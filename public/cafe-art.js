import { FLOOR, HALL_BANKS, LANDMARKS, ROOMS, WORLD, center, roomPartitions, toPercent, toPixels } from "./cafe-map.mjs";

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
const shade = document.createElement("div");
shade.className = "cafe-art-shade";
shade.setAttribute("aria-hidden", "true");
shade.hidden = true;
scene.prepend(backdrop);
clerk.after(shade, effects);
avatars.append(clerk);
scene.dataset.canvasWorld = "";

let ready = false;
let area = "";
let layout = [];
let glass = [];
let screens = new Map();
const loungeSeats = new Map();
const loungeTargets = document.createElement("div");
loungeTargets.className = "world-seat-targets";
scene.append(loungeTargets);
let occupied = new Set();
let npcSeats = new Set();
let away = new Set();
let activeSeat = null;
let equippedProps = [];
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

function paintLoungeSeat(name, x, y, tone, label) {
  T.prop(base, name, x, y, tone);
  const { w, h, seats } = T.seatObject(name, x, y);
  const front = makeCanvas("cafe-art-prop-front", w, h);
  T.furnitureFront(front.getContext("2d"), name, tone);
  foreground(front, x, y, Math.max(...seats.map(seat => seat.y)));
  for (const seat of seats) {
    const key = "lounge:" + loungeSeats.size;
    const point = toPercent(seat);
    const stand = toPercent({ x: seat.x, y: seat.y + 14 });
    loungeSeats.set(key, { point, stand, direction: seat.direction });
    const button = document.createElement("button");
    button.type = "button";
    button.className = "world-target";
    button.dataset.tip = label;
    button.setAttribute("aria-label", label + " " + (loungeSeats.size));
    button.style.left = point.x + "%";
    button.style.top = point.y + "%";
    button.addEventListener("click", () => window.cafeWorld?.toggleLoungeSeat(key));
    loungeTargets.append(button);
  }
}

function paintHall() {
  T.floor(base, FLOOR.x, FLOOR.y, FLOOR.w, FLOOR.h);
  T.wall(base, 0, 0, WIDTH, 16, "cream", false, true);
  T.wall(base, 0, 496, 368, 16, "cream", false, true);
  T.wall(base, 400, 496, 368, 16, "cream", false, true);
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
    for (const part of roomPartitions(room)) {
      const useWood = part.h === 16 || room.space === "squad" || room.space === "team";
      T.partition(base, part, useWood);
    }
    if (room.side === "south") T.prop(base, "mat_S", room.door.x, room.door.y, accents[room.space]);
    if (room.space !== "solo") {
      T.prop(base, "picture_S", x + Math.floor(w / 2 / 16) * 16, y - 16, accents[room.space]);
    }
  }
  // Cozy room decor between desks & corners (keeps doorways and seat approaches open)
  T.prop(base, "plant_small_S", 42 * 16, 5 * 16, "mint");     // duo-1 between desks
  T.prop(base, "plant_small_S", 42 * 16, 12 * 16, "mint");    // duo-2 between desks
  T.prop(base, "plant_small_S", 40 * 16, 27 * 16, "mint");    // team-1 lower-left corner
  T.prop(base, "side_table_S", 4 * 16, 19 * 16, "wood");      // squad-1 between top desks
  T.prop(base, "side_table_S", 8 * 16, 19 * 16, "wood");      // squad-1 between top desks
  T.prop(base, "plant_small_S", 4 * 16, 24 * 16, "mint");     // squad-1 between bottom desks
  T.prop(base, "lamp_floor_S", 8 * 16, 24 * 16, "cream");     // squad-1 warm lamp between bottom desks

  const lounge = LANDMARKS.lounge;
  T.rug(base, lounge.x, lounge.y, lounge.w - 16, lounge.h, "lavender");
  paintLoungeSeat("sofa2_S", lounge.x + 16, lounge.y, "rose", "라운지 소파");
  T.prop(base, "table_round_S", lounge.x + 48, lounge.y + 16, "wood");
  paintLoungeSeat("armchair_E", lounge.x + 64, lounge.y + 16, "mint", "라운지 안락의자");
  T.prop(base, "plant_small_S", lounge.x, lounge.y + 32, "mint");
  paintShop();

  const booth = LANDMARKS.booth;
  T.rug(base, booth.x, booth.y, booth.w, booth.h, "mint");
  T.partition(base, { x: booth.x, y: booth.y, w: booth.w, h: 16 });
  T.partition(base, { x: booth.x, y: booth.y + 16, w: 16, h: 32 });
  T.prop(base, "hood_S", booth.x + 16, booth.y - 16, "cream");
  T.prop(base, "mat_S", booth.x + 16, booth.y + 32, "mint");
  T.jamb(base, booth.x + 16, booth.y + 48, 16);
  T.workstation(base, "ashtray", booth.x + 16, booth.y + 16, 1);

  const { kiosk, board, entrance, terrace } = LANDMARKS;
  T.workstation(base, "kiosk", kiosk.x, kiosk.y, 1);
  T.prop(base, "menu_board_S", board.x, board.y - 16, "rose");
  T.prop(base, "mat_S", entrance.x, entrance.y - 16, "rose");
  T.jamb(base, entrance.x, entrance.y, 16);
  T.prop(base, "mat_S", terrace.x, terrace.y, "mint");
  T.prop(base, "plant_tall_S", 704, 432, "mint");
  T.prop(base, "plant_small_S", 208, 368, "mint");
  T.prop(base, "plant_tall_S", 80, 432, "mint");
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
  for (const bank of HALL_BANKS) {
    T.deskDivider(base, bank.x, bank.seamY, bank.w);
  }
}

function paintBreakArea() {
  const outside = area === "terrace";
  const config = relaxZones[area];
  const machine = pixel(config.spots.find(({ mode }) => mode === (outside ? "coffee" : "candy")));
  const door = pixel(config.door);
  const doorX = T.snap(door.x - 16);

  if (outside) {
    // 2F Outdoor Rooftop Terrace: open sky/skyline + balustrade + warm wood deck + cozy café cluster
    T.skyline(base, 0, 0, WIDTH, 240, lastPhase);
    T.floor(base, 48, 256, 672, 240, true, false, "tile");
    T.floor(base, 128, 256, 512, 128, false, false, "wood");
    T.rug(base, 256, 288, 240, 80, "mint");
    // Balustrade & perimeter patio borders with bottom doorway at relaxZones.terrace.door
    T.partition(base, { x: 112, y: 240, w: 544, h: 16 }, true);
    T.partition(base, { x: 112, y: 256, w: 16, h: 144 }, true);
    T.partition(base, { x: 640, y: 256, w: 16, h: 144 }, true);
    if (doorX > 128) T.partition(base, { x: 128, y: 384, w: doorX - 128, h: 16 }, true);
    if (doorX + 32 < 640) T.partition(base, { x: doorX + 32, y: 384, w: 640 - (doorX + 32), h: 16 }, true);
    T.jamb(base, doorX, 384, 16);
    T.prop(base, "mat_S", doorX, 368, "mint");
    // Skyline benches, cafe table cluster, lanterns, plants & coffee machine
    T.prop(base, "bench_S", 272, 264, "mint");
    T.prop(base, "bench_S", 432, 264, "lavender");
    T.prop(base, "table_round_S", 192, 320, "wood");
    T.prop(base, "armchair_E", 160, 320, "mint");
    T.prop(base, "side_table_S", 512, 288, "wood");
    T.workstation(base, "ashtray", 528, 280, 1);
    T.prop(base, "plant_tall_S", 128, 336, "mint");
    T.prop(base, "plant_tall_S", 608, 336, "mint");
    T.prop(base, "plant_small_S", 608, 264, "mint");
    for (const lx of [224, 384, 544]) T.prop(base, "pendant_S", lx, 224, "cream");
  } else {
    // Indoor Smoking Booth: enclosed 4 walls + panoramic skyline windows + exhaust hoods + plush lounge
    T.floor(base, 80, 240, 608, 112);
    T.wall(base, 64, 144, 640, 96, "cream");
    glass.push(...T.windowPanel(base, 144, 160, 480, 48));
    for (const hx of [208, 352, 560]) T.prop(base, "hood_S", hx, 160, "cream");
    T.prop(base, "picture_S", 96, 160, "rose");
    T.prop(base, "picture_S", 640, 160, "rose");
    T.partition(base, { x: 64, y: 240, w: 16, h: 128 }, true);
    T.partition(base, { x: 688, y: 240, w: 16, h: 128 }, true);
    if (doorX > 80) T.partition(base, { x: 80, y: 352, w: doorX - 80, h: 16 }, true);
    if (doorX + 32 < 688) T.partition(base, { x: doorX + 32, y: 352, w: 688 - (doorX + 32), h: 16 }, true);
    T.jamb(base, doorX, 352, 16);
    T.prop(base, "mat_S", doorX, 336, "rose");

    T.rug(base, 112, 256, 208, 80, "rose");
    T.prop(base, "sofa2_S", 128, 256, "rose");
    T.prop(base, "table_round_S", 176, 288, "wood");
    T.prop(base, "armchair_E", 224, 288, "mint");
    T.prop(base, "bench_S", 288, 256, "lavender");
    T.prop(base, "bench_S", 496, 256, "mint");
    T.workstation(base, "ashtray", 344, 232, 1);
    T.workstation(base, "ashtray", 592, 232, 1);
    T.prop(base, "plant_tall_S", 96, 304, "mint");
    T.prop(base, "plant_tall_S", 656, 304, "mint");
    T.prop(base, "plant_small_S", 416, 256, "mint");
  }
  T.workstation(base, "vending", T.snap(machine.x - 16), T.snap(machine.y - 64), 2);
}

function paintBase() {
  screens = new Map();
  loungeSeats.clear();
  loungeTargets.replaceChildren();
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
  shade.hidden = !night;
  for (const [key, { x, y, w, h }] of screens) {
    if (key !== activeSeat && !occupied.has(key) && !npcSeats.has(key)) continue;
    const booting = key === activeSeat && !motion.matches && now - bootAt < 800;
    rect(overlay, x, y, w, h, away.has(key) ? PAL.c1 : PAL.t0);
    if (away.has(key)) rect(overlay, x + w / 2 - 1, y + h / 2 - 1, 3, 3, PAL.y3);
    else if (booting) rect(overlay, x + 1, y + h - 2, (w - 2) * Math.max(0, (now - bootAt) / 800), 1, PAL.g3);
    else rect(overlay, x + 1, y + 1, w - 2, 2, PAL.t3);
  }
  if (area === "hall" && activeSeat && equippedProps.length) {
    const activePanel = screens.get(activeSeat);
    if (activePanel) {
      const px = Math.round(activePanel.trayX) - 6;
      const py = Math.round(activePanel.trayY) - 6;
      equippedProps.slice(0, 3).forEach((propId, idx) => {
        const dx = px + (idx - 1) * 6;
        if (propId === "cactus") {
          rect(overlay, dx, py + 2, 4, 3, PAL.y2);
          rect(overlay, dx + 1, py - 1, 2, 3, PAL.g2);
        } else if (propId === "cat") {
          rect(overlay, dx, py, 5, 4, PAL.r3);
          rect(overlay, dx, py - 1, 1, 1, PAL.k);
          rect(overlay, dx + 4, py - 1, 1, 1, PAL.k);
        } else if (propId === "mug") {
          rect(overlay, dx, py + 1, 4, 4, PAL.p3);
          rect(overlay, dx + 1, py, 2, 1, PAL.v);
        } else if (propId === "lamp") {
          rect(overlay, dx + 1, py + 2, 2, 3, PAL.k);
          rect(overlay, dx, py - 1, 4, 3, PAL.y3);
        } else if (propId === "headset") {
          rect(overlay, dx, py + 1, 5, 1, PAL.d);
          rect(overlay, dx, py + 2, 1, 2, PAL.r1);
          rect(overlay, dx + 4, py + 2, 1, 2, PAL.r1);
        } else {
          rect(overlay, dx + 1, py, 3, 5, PAL.t3);
        }
      });
    }
  }
  if (area === "hall" && night) T.animation(overlay, "neon_open", 368, 32, Math.floor(now / (motion.matches ? 480 : 160)));
  if (area === "terrace") {
    T.weatherLoop(overlay, weather, now, motion.matches);
    if (weather !== "clear") T.weatherLoop(overlay, "wind", now, motion.matches);
  } else if (glass.length) {
    // Indoor rooms (hall & booth): clip rain/snow/leaves strictly to exterior glass windows
    overlay.save();
    overlay.beginPath();
    for (const pane of glass) overlay.rect(pane.x, pane.y, pane.w, pane.h);
    overlay.clip();
    T.weatherLoop(overlay, weather, now, motion.matches);
    overlay.restore();
  }
  if (area === "hall" && clerk.dataset.mode === "cook" && !clerk.hidden) {
    T.animation(overlay, "stove", LANDMARKS.counter.x + 48, LANDMARKS.counter.y + 16, Math.floor(now / 125));
    T.animation(overlay, "steam", LANDMARKS.counter.x + 48, LANDMARKS.counter.y, Math.floor(now / 125));
  }
  if (area === "hall" && !motion.matches && now - doorAt < 650) {
    const { x, y, w } = LANDMARKS.entrance;
    rect(overlay, x + 3, y, w - 6, 12, "rgba(255, 226, 173, 0.35)");
  }
}

window.cafeArt = {
  pixel,
  loungeSeat: (key) => loungeSeats.get(key),
  chairDirection: (seat) => ready ? T.chairPosition(seat).direction : seat.direction,
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
  setNpcSeats(seats) {
    npcSeats = seats instanceof Set ? seats : new Set(seats || []);
  },
  setDeskProps(list) {
    equippedProps = Array.isArray(list) ? list.slice(0, 3) : [];
  },
  openDoor() { doorAt = performance.now(); },
};

Promise.all([T.ready, import("./world.js")]).then(([, world]) => {
  relaxZones = world.relaxZones;
  viewport.style.setProperty("--cafe-margin-tile", `url("${T.marginTile()}")`);
  ready = true;
  scene.dataset.artReady = "";
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
