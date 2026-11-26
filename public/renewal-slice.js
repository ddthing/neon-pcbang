import {
  AISLES,
  CHARACTER_SPEC,
  DOORS,
  FURNITURE,
  SEAT_LIST,
  SEATS,
  WORLD_SPEC,
  ZONES,
  buildSeatMapModel,
  findPath,
  getFootBox,
  getZoneAt,
  isFootWalkable,
  planSeatApproach,
} from "./renewal-layout.mjs";

const { width: W, height: H, palette: C } = WORLD_SPEC;

const canvas = document.getElementById("slice-canvas");
const ctx = canvas.getContext("2d", { alpha: false });
ctx.imageSmoothingEnabled = false;

const hudInfo = document.getElementById("hud-info");
const hudZone = document.getElementById("hud-zone");
const hudScale = document.getElementById("hud-scale");
const hudStatus = document.getElementById("hud-status");
const qaDock = document.getElementById("qa-dock");
const btnCollapse = document.getElementById("btn-hud-collapse");
const btnStand = document.getElementById("btn-stand-up");
const btnTray = document.getElementById("btn-toggle-tray");
const btnOverlay = document.getElementById("btn-toggle-overlay");
const toastEl = document.getElementById("slice-toast");

const seatmapBackdrop = document.getElementById("seatmap-backdrop");
const seatmapBoard = document.getElementById("seatmap-board");
const seatmapSelection = document.getElementById("seatmap-selection");
const seatmapConfirm = document.getElementById("seatmap-confirm");
const seatmapClose = document.getElementById("seatmap-close");
const seatmapSimConflict = document.getElementById("seatmap-sim-conflict");

const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

const state = {
  player: {
    x: DOORS[0].approachPoint.x,
    y: DOORS[0].approachPoint.y,
    facing: "up",
    mode: "idle", // "idle" | "walk" | "sit-down" | "typing" | "stand-up"
    walkDistance: 0,
    sitProgress: 0, // 0 standing .. 1 seated
    typingClock: 0,
    seatKey: null,
    targetSeatKey: null,
    pendingPlan: null,
    path: [],
  },
  seatsRuntime: Object.fromEntries(
    SEAT_LIST.map((seat) => [
      seat.key,
      { bootStage: "off", bootTimer: 0, occupiedBy: null },
    ]),
  ),
  doorOpen: Object.fromEntries(DOORS.map((d) => [d.id, 0])),
  kioskMode: "idle", // "idle" | "selecting" | "confirmed"
  showOverlay: false,
  showTray: false,
  hudCollapsed: false,
  clickFeedback: null, // { x, y, ok, timer }
  modal: {
    open: false,
    selectedSeatKey: null,
    lastFocusedEl: null,
  },
  keysDown: new Set(),
  lastScale: 1,
};

let toastTimer = null;
function showToast(text, tone = "info") {
  toastEl.textContent = text;
  toastEl.dataset.tone = tone;
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.hidden = true;
  }, 2200);
}

// ---------- Integer Viewport Scaling ----------
function updateCanvasScale() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const dpr = window.devicePixelRatio || 1;
  const maxScaleX = (vw * dpr) / W;
  const maxScaleY = (vh * dpr) / H;
  const intScale = Math.max(1, Math.floor(Math.min(maxScaleX, maxScaleY)));
  state.lastScale = intScale;
  canvas.style.width = `${(W * intScale) / dpr}px`;
  canvas.style.height = `${(H * intScale) / dpr}px`;
  hudScale.textContent = `${W}×${H} · ${intScale}× (${vw}×${vh})`;
}

window.addEventListener("resize", updateCanvasScale);
updateCanvasScale();

// ---------- Pixel Primitives ----------
function px(x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

function framedRect(x, y, w, h, fill, border = C.ink) {
  px(x, y, w, h, border);
  px(x + 1, y + 1, w - 2, h - 2, fill);
}

function drawFloorPlanks(x, y, w, h, swatches) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  px(x, y, w, h, C.darkWood);
  const plankW = 40;
  const plankH = 12;
  for (let row = 0; row * plankH < h + plankH; row++) {
    const offset = (row % 3) * 14;
    for (let col = -1; col * plankW < w + plankW; col++) {
      const hash = Math.abs(col * 37 + row * 53);
      const lx = x + col * plankW + offset;
      const ty = y + row * plankH;
      px(lx, ty, plankW - 1, plankH - 1, swatches[hash % swatches.length]);
      px(lx + 1, ty + 1, plankW - 4, 1, C.lightWood);
      if (hash % 3 === 0) {
        px(lx + 6 + (hash % 12), ty + 5, 9, 1, "#986267");
      }
      if (hash % 5 === 0) {
        px(lx + 14, ty + 8, 6, 1, C.lightWood);
      }
    }
  }
  ctx.restore();
}

function drawSlateTiles(x, y, w, h) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  px(x, y, w, h, C.shade);
  const tile = 16;
  const tones = [C.slate, "#586886", "#495875", "#5f6e8a"];
  for (let row = 0; row * tile < h + tile; row++) {
    for (let col = 0; col * tile < w + tile; col++) {
      const tx = x + col * tile;
      const ty = y + row * tile;
      const tone = tones[(row * 7 + col * 3) % tones.length];
      px(tx, ty, tile - 1, tile - 1, tone);
      px(tx + 1, ty + 1, 9, 1, "#6f809f");
    }
  }
  ctx.restore();
}

function drawRug(x, y, w, h, bodyColor, trimColor) {
  px(x + 2, y + 2, w, h, "rgba(41, 36, 53, 0.38)");
  framedRect(x, y, w, h, bodyColor, C.ink);
  framedRect(x + 2, y + 2, w - 4, h - 4, bodyColor, trimColor);
  for (let dx = 5; dx < w - 4; dx += 5) {
    px(x + dx, y + 1, 2, 1, C.paper);
    px(x + dx, y + h - 2, 2, 1, C.paper);
  }
}

function drawWindowScene(x, y, w, h, timeSec) {
  framedRect(x, y, w, h, C.glass, C.ink);
  px(x + 2, y + 2, w - 4, h - 4, C.slate);
  // Distant building silhouettes
  px(x + 4, y + 10, 12, h - 12, "#35455e");
  px(x + 18, y + 6, 16, h - 8, "#2d3c52");
  px(x + 36, y + 11, 12, h - 13, "#384863");
  px(x + 50, y + 8, 12, h - 10, "#2f3e55");
  // Distant lit windows
  px(x + 7, y + 13, 2, 2, C.gold);
  px(x + 21, y + 9, 2, 3, C.milk);
  px(x + 26, y + 13, 2, 2, C.gold);
  px(x + 40, y + 14, 2, 2, C.aqua);
  // Diagonal rain streaks inside glass
  const drift = reducedMotionQuery.matches ? 0 : Math.floor(timeSec * 22) % 14;
  ctx.fillStyle = "rgba(131, 201, 197, 0.35)";
  for (let i = 0; i < 6; i++) {
    const rx = x + 6 + ((i * 11 + drift) % Math.max(8, w - 12));
    const ry = y + 4 + ((i * 7 + drift) % Math.max(6, h - 10));
    ctx.fillRect(rx, ry, 1, 4);
  }
  // Center window mullion
  px(x + Math.floor(w / 2) - 1, y + 1, 2, h - 2, C.ink);
  px(x + Math.floor(w / 2), y + 2, 1, h - 4, C.blue);
  px(x + 2, y + 2, w - 4, 1, C.blue);
}

// ---------- Plants (3 distinct silhouettes) ----------
function drawPlant(item, timeSec) {
  const { x, y } = item.anchor;
  const sway = reducedMotionQuery.matches ? 0 : Math.round(Math.sin(timeSec * 1.6 + x * 0.05));

  if (item.species === "broadleaf") {
    // Ground shadow
    px(x - 10, y - 2, 21, 5, "rgba(41, 36, 53, 0.35)");
    // Terracotta pot with visible rim and soil
    framedRect(x - 7, y - 12, 14, 12, C.rust, C.ink);
    framedRect(x - 8, y - 14, 16, 4, C.peach, C.ink);
    px(x - 6, y - 12, 12, 2, "#4a3235"); // dark soil
    px(x - 5, y - 8, 3, 6, C.peach);
    // Broad paddle leaves
    px(x - 1, y - 24, 2, 13, C.green);
    px(x - 10 + sway, y - 29, 8, 10, C.ink);
    px(x - 9 + sway, y - 28, 6, 8, C.green);
    px(x - 8 + sway, y - 27, 4, 5, C.mint);
    px(x + 2 - sway, y - 31, 9, 11, C.ink);
    px(x + 3 - sway, y - 30, 7, 9, C.mint);
    px(x + 4 - sway, y - 29, 3, 6, "#b7cea4");
    px(x - 5, y - 35 + Math.abs(sway), 10, 11, C.ink);
    px(x - 4, y - 34 + Math.abs(sway), 8, 9, C.mint);
    px(x - 2, y - 33 + Math.abs(sway), 2, 6, C.milk);
  } else if (item.species === "pothos") {
    // Pot with cascading trailing vines
    px(x - 9, y - 2, 19, 4, "rgba(41, 36, 53, 0.35)");
    framedRect(x - 6, y - 11, 13, 10, C.violet, C.ink);
    framedRect(x - 7, y - 13, 15, 4, "#9d85a6", C.ink);
    px(x - 5, y - 11, 11, 2, "#4a3235");
    // Bushy crown
    px(x - 8, y - 22, 16, 10, C.ink);
    px(x - 7, y - 21, 14, 8, C.green);
    px(x - 5, y - 20, 10, 5, C.mint);
    px(x - 2, y - 24 + sway, 5, 3, C.mint);
    // Cascading trailing vines draping over pot lip
    px(x - 9 + sway, y - 15, 4, 11, C.ink);
    px(x - 8 + sway, y - 14, 3, 9, C.mint);
    px(x + 5 - sway, y - 14, 4, 9, C.ink);
    px(x + 6 - sway, y - 13, 2, 7, C.green);
    px(x - 2, y - 13, 3, 6, C.mint);
  } else {
    // Compact geometric succulent rosette
    px(x - 8, y - 2, 17, 4, "rgba(41, 36, 53, 0.35)");
    framedRect(x - 6, y - 9, 12, 9, C.slate, C.ink);
    framedRect(x - 7, y - 11, 14, 3, C.blue, C.ink);
    px(x - 5, y - 9, 10, 2, "#4a3235");
    // Outer rosette petals
    px(x - 8, y - 16, 16, 6, C.ink);
    px(x - 7, y - 15, 14, 4, C.green);
    px(x - 5, y - 19, 10, 7, C.ink);
    px(x - 4, y - 18, 8, 5, C.mint);
    px(x - 2, y - 20, 4, 4, "#b8d2a7");
    px(x - 1, y - 19 + (sway > 0 ? 1 : 0), 2, 2, C.milk);
  }
}

// ---------- Kiosk ----------
function drawKiosk(item, timeSec) {
  const { x, y, width, height } = item.visualRect;
  px(x + 2, y + height - 3, width - 2, 5, "rgba(41, 36, 53, 0.4)");
  // Pedestal base
  framedRect(x + 4, y + 26, width - 8, 15, C.slate, C.ink);
  px(x + 6, y + 28, width - 12, 10, C.blue);
  // Display head housing
  framedRect(x + 1, y, width - 2, 28, C.plum, C.ink);
  framedRect(x + 4, y + 4, width - 8, 18, C.glass, C.ink);
  // Kiosk screen state mirrors modal / seat selection
  if (state.kioskMode === "confirmed") {
    px(x + 6, y + 6, width - 12, 14, "#3b5954");
    px(x + 8, y + 8, 12, 3, C.mint);
    px(x + 9, y + 13, 10, 4, C.milk);
  } else if (state.kioskMode === "selecting") {
    px(x + 6, y + 6, width - 12, 14, C.slate);
    px(x + 8, y + 8, 4, 4, C.gold);
    px(x + 14, y + 8, 4, 4, C.aqua);
    px(x + 8, y + 14, 10, 3, C.milk);
  } else {
    px(x + 6, y + 6, width - 12, 14, C.glass);
    const pulse = Math.floor(timeSec * 2) % 2 === 0;
    px(x + 8, y + 8, 5, 5, C.mint);
    px(x + 15, y + 8, 5, 5, pulse ? C.aqua : C.blue);
    px(x + 8, y + 15, 12, 3, C.gold);
  }
  // Card reader slot & indicator LED
  px(x + 6, y + 23, 8, 2, C.gold);
  px(x + 18, y + 23, 3, 2, C.aqua);
}

// ---------- Doors (threshold + sliding leaf + foreground lintel occlusion) ----------
function drawDoorFloorAndLeaves(door) {
  const open = state.doorOpen[door.id] || 0;
  const th = door.threshold;
  // Threshold mat
  framedRect(th.x, th.y, th.width, th.height, C.plum, C.ink);
  px(th.x + 2, th.y + 2, th.width - 4, th.height - 4, C.darkWood);
  px(th.x + 4, th.y + 4, th.width - 8, 2, C.gold);
  px(th.x + 4, th.y + th.height - 5, th.width - 8, 1, C.paper);

  // Side jamb posts (lower half)
  const fr = door.frameRect;
  const leafBottom = fr.y + fr.height - 4;
  const leafTop = fr.y + door.lintelOcclusionHeight;
  const leafH = leafBottom - leafTop;
  framedRect(fr.x, leafTop, 5, leafH, C.darkWood, C.ink);
  framedRect(fr.x + fr.width - 5, leafTop, 5, leafH, C.darkWood, C.ink);

  // Sliding glass panels
  const halfSpan = Math.floor(door.clearWidth / 2);
  const slideOffset = Math.round(open * (halfSpan - 3));
  const leftX = th.x + 1 - slideOffset;
  const rightX = th.x + halfSpan + slideOffset;
  const panelW = Math.max(4, halfSpan - 1);

  ctx.save();
  ctx.beginPath();
  ctx.rect(th.x, leafTop, door.clearWidth, leafH);
  ctx.clip();

  // Left door panel
  framedRect(leftX, leafTop, panelW, leafH, C.glass, C.ink);
  px(leftX + 2, leafTop + 2, panelW - 4, leafH - 6, "#4d6d89");
  px(leftX + panelW - 4, leafTop + Math.floor(leafH / 2), 2, 5, C.gold);

  // Right door panel
  framedRect(rightX, leafTop, panelW, leafH, C.glass, C.ink);
  px(rightX + 2, leafTop + 2, panelW - 4, leafH - 6, "#4d6d89");
  px(rightX + 2, leafTop + Math.floor(leafH / 2), 2, 5, C.gold);
  ctx.restore();
}

function drawDoorLintelOcclusion(door) {
  const fr = door.frameRect;
  const lh = door.lintelOcclusionHeight;
  // Upper jamb caps + overhead lintel beam that passes over player head when crossing threshold
  framedRect(fr.x, fr.y, fr.width, lh, C.wood, C.ink);
  px(fr.x + 2, fr.y + 2, fr.width - 4, 3, C.lightWood);
  px(fr.x + 2, fr.y + lh - 4, fr.width - 4, 2, C.darkWood);
  // Warm transom glow / sign accent on entrance door
  if (door.id === "entrance") {
    framedRect(fr.x + 7, fr.y + 4, fr.width - 14, 7, C.shade, C.ink);
    px(fr.x + 9, fr.y + 6, fr.width - 18, 3, C.gold);
    px(fr.x + 11, fr.y + 7, fr.width - 22, 1, C.milk);
  } else {
    framedRect(fr.x + 11, fr.y + 5, fr.width - 22, 5, C.slate, C.ink);
    px(fr.x + 13, fr.y + 7, fr.width - 26, 2, C.milk);
  }
}

// ---------- Seats: Desk, Monitor, Chair Base, Foreground Chair Backrest, Delivery Tray ----------
function drawMonitorScreen(sx, sy, sw, sh, runtime, timeSec) {
  if (runtime.bootStage === "off") {
    px(sx, sy, sw, sh, "#1e2736");
    px(sx + sw - 3, sy + sh - 2, 2, 1, C.rust);
  } else if (runtime.bootStage === "booting") {
    px(sx, sy, sw, sh, "#263849");
    px(sx + 2, sy + 2, Math.max(4, sw - 5), 2, C.aqua);
    const bar = Math.max(2, Math.floor((sw - 4) * Math.min(1, runtime.bootTimer / 1.0)));
    px(sx + 2, sy + Math.floor(sh / 2), bar, 2, C.milk);
    px(sx + sw - 3, sy + sh - 2, 2, 1, C.mint);
  } else {
    px(sx, sy, sw, sh, "#35536b");
    px(sx + 1, sy + 1, sw - 2, Math.max(2, sh - 4), C.aqua);
    const wave = Math.floor(timeSec * 4) % 2;
    px(sx + 2, sy + 3, Math.max(3, Math.floor(sw * 0.45)), 2, C.milk);
    px(sx + 2 + wave, sy + 6, Math.max(2, Math.floor(sw * 0.35)), 2, C.gold);
    px(sx + sw - 3, sy + sh - 2, 2, 1, C.mint);
  }
}

function drawSeatDeskAndChairBase(seat, runtime, timeSec) {
  const d = seat.deskRect;
  const m = seat.monitorRect;
  const ch = seat.chairRect;
  const kb = seat.keyboardAnchor;

  // Floor shadows
  px(d.x + 2, d.y + d.height - 1, d.width, 4, "rgba(41, 36, 53, 0.35)");
  px(ch.x + 2, ch.y + ch.height - 2, ch.width - 2, 4, "rgba(41, 36, 53, 0.35)");

  // Chair star base + cushion (Layer behind seated character)
  px(ch.x + Math.floor(ch.width / 2) - 4, ch.y + ch.height - 3, 8, 3, C.ink);
  framedRect(ch.x + 2, ch.y + 3, ch.width - 4, ch.height - 6, C.slate, C.ink);
  px(ch.x + 4, ch.y + 5, ch.width - 8, ch.height - 10, C.blue);

  // Desk tabletop & beveled front lip
  framedRect(d.x, d.y, d.width, d.height, C.wood, C.ink);
  px(d.x + 2, d.y + 2, d.width - 4, 2, C.lightWood);
  px(d.x + 1, d.y + d.height - 4, d.width - 2, 3, C.darkWood);

  if (seat.facing === "up") {
    // Solo room front-facing setup
    // Tower PC on desk right-back corner
    framedRect(d.x + d.width - 13, d.y + 2, 9, 13, C.shade, C.ink);
    px(d.x + d.width - 10, d.y + 4, 3, 1, runtime.bootStage === "on" ? C.aqua : C.gold);
    // Monitor stand + wide frame (26x19)
    px(m.x + 9, m.y + m.height - 2, 8, 5, C.ink);
    px(m.x + 6, d.y + 4, 14, 2, C.shade);
    framedRect(m.x, m.y, m.width, m.height - 3, C.shade, C.ink);
    drawMonitorScreen(m.x + 2, m.y + 2, m.width - 4, m.height - 7, runtime, timeSec);
    // Keyboard & mouse pad aligned to keyboardAnchor
    framedRect(kb.x - 9, kb.y - 3, 18, 6, C.shade, C.ink);
    px(kb.x - 7, kb.y - 1, 14, 1, C.paper);
    px(kb.x - 7, kb.y + 1, 11, 1, C.blue);
    // Mouse + pad
    px(kb.x + 11, kb.y - 4, 8, 8, C.plum);
    framedRect(kb.x + 13, kb.y - 2, 5, 5, C.milk, C.ink);
    // Soft monitor light spill on desk
    if (runtime.bootStage === "on") {
      ctx.fillStyle = "rgba(131, 201, 197, 0.22)";
      ctx.fillRect(kb.x - 10, kb.y - 7, 24, 10);
    }
  } else {
    // Hall side-facing setup (hall:0 faces right, hall:1 faces left)
    const dir = seat.facing === "right" ? 1 : -1;
    // Tower PC tucked at outer top corner of desk
    const pcX = dir === 1 ? d.x + d.width - 10 : d.x + 2;
    framedRect(pcX, d.y + 3, 8, 12, C.shade, C.ink);
    px(pcX + 2, d.y + 5, 3, 2, runtime.bootStage === "on" ? C.aqua : C.gold);

    // Angled 3/4 side monitor profile matching chassis
    framedRect(m.x, m.y, m.width, m.height, C.shade, C.ink);
    const screenX = dir === 1 ? m.x + 2 : m.x + m.width - 6;
    drawMonitorScreen(screenX, m.y + 3, 4, m.height - 6, runtime, timeSec);

    // Keyboard & mouse aligned cleanly to keyboardAnchor
    framedRect(kb.x - 2, kb.y - 7, 6, 14, C.shade, C.ink);
    px(kb.x, kb.y - 5, 2, 10, C.paper);
    framedRect(kb.x - 2, kb.y + 9, 5, 4, C.milk, C.ink);

    if (runtime.bootStage === "on") {
      ctx.fillStyle = "rgba(131, 201, 197, 0.2)";
      ctx.fillRect(d.x + 2, m.y, d.width - 4, m.height);
    }
  }
}

function drawSeatBackrestOcclusion(seat) {
  const ch = seat.chairRect;
  if (seat.facing === "up") {
    // Backrest wraps up over seated character's lower back & hips
    framedRect(ch.x + 2, ch.y + 6, ch.width - 4, 11, C.plum, C.ink);
    px(ch.x + 4, ch.y + 8, ch.width - 8, 4, C.violet);
    // Side armrests
    framedRect(ch.x, ch.y + 5, 3, 8, C.shade, C.ink);
    framedRect(ch.x + ch.width - 3, ch.y + 5, 3, 8, C.shade, C.ink);
  } else if (seat.facing === "right") {
    // Left-edge outer backrest wing occludes seated character's back
    framedRect(ch.x, ch.y + 2, 6, ch.height - 4, C.plum, C.ink);
    px(ch.x + 1, ch.y + 4, 3, ch.height - 8, C.violet);
    px(ch.x + 5, ch.y + ch.height - 6, 8, 3, C.ink);
  } else {
    // Right-edge outer backrest wing occludes hall:1 character's back
    framedRect(ch.x + ch.width - 6, ch.y + 2, 6, ch.height - 4, C.plum, C.ink);
    px(ch.x + ch.width - 4, ch.y + 4, 3, ch.height - 8, C.violet);
    px(ch.x + ch.width - 13, ch.y + ch.height - 6, 8, 3, C.ink);
  }
}

function drawDeliveryTray(seat) {
  const t = seat.trayAnchor;
  framedRect(t.x, t.y, t.width, t.height, C.lightWood, C.ink);
  px(t.x + 1, t.y + 1, t.width - 2, t.height - 2, C.wood);
  // Ramen bowl + iced coffee cup inside tray
  framedRect(t.x + 2, t.y + 2, 5, 5, C.milk, C.ink);
  px(t.x + 3, t.y + 3, 3, 3, C.peach);
  framedRect(t.x + t.width - 5, t.y + 2, 3, 5, C.aqua, C.ink);
}

// ---------- High-Craft Chibi Character (32x40 frame, 32px standing height, 16px head) ----------
function drawCharacter(p) {
  const seat = p.seatKey ? SEATS[p.seatKey] : null;
  const isSeated = p.mode === "typing" || p.mode === "sit-down" || p.mode === "stand-up";

  // Anchor smoothly between standPoint/approachPoint and cushionAnchor during sit-down / stand-up
  let drawX = p.x;
  let drawY = p.y;
  if (seat && isSeated) {
    drawX = seat.cushionAnchor.x;
    drawY = seat.cushionAnchor.y + Math.round(p.sitProgress * 2);
  }

  const footX = Math.round(drawX);
  const footY = Math.round(drawY);

  // Subtle floor shadow when standing/walking
  if (!isSeated || p.sitProgress < 0.5) {
    px(footX - 6, footY - 2, 12, 4, "rgba(41, 36, 53, 0.36)");
  }

  const walkPhase = Math.floor(p.walkDistance / 5) % 6;
  const bob = p.mode === "walk" ? (walkPhase % 3 === 1 ? -1 : 0) : 0;
  const sitDrop = Math.round(p.sitProgress * 4);
  const topY = footY - 30 + bob + sitDrop; // Standing silhouette ~32px high (topY to footY+2)

  // --- Seated Back View (solo:0 facing "up") ---
  if (isSeated && p.facing === "up") {
    const kb = seat.keyboardAnchor;
    const typeStep = Math.floor(p.typingClock * 7) % 4;
    // Left/Right sleeves + hands extending forward onto keyboardAnchor
    const lhY = Math.round(kb.y + (typeStep === 0 ? -1 : 1));
    const rhY = Math.round(kb.y + (typeStep === 2 ? -1 : 1));
    framedRect(footX - 7, lhY, 4, 9, C.green, C.ink);
    px(footX - 6, lhY - 1, 3, 3, "#fbe3d3");
    framedRect(footX + 3, rhY, 4, 9, C.green, C.ink);
    px(footX + 4, rhY - 1, 3, 3, "#fbe3d3");

    // Torso (hoodie + hood fold from back)
    framedRect(footX - 6, topY + 14, 12, 11, C.green, C.ink);
    px(footX - 4, topY + 15, 8, 5, C.mint);
    // Head & Hair (16px wide)
    framedRect(footX - 8, topY, 16, 15, "#6b473d", C.ink);
    px(footX - 6, topY + 2, 12, 5, "#8e6255");
    px(footX - 7, topY + 7, 14, 6, "#54362e");
    // Mint gaming headset visible cleanly on crown
    px(footX - 8, topY + 2, 16, 2, C.aqua);
    framedRect(footX - 9, topY + 5, 3, 6, C.aqua, C.ink);
    framedRect(footX + 6, topY + 5, 3, 6, C.aqua, C.ink);
    return;
  }

  // --- Seated Side Profile View (hall:0 facing "right", hall:1 facing "left") ---
  if (isSeated && (p.facing === "right" || p.facing === "left")) {
    const dir = p.facing === "right" ? 1 : -1;
    const typeStep = Math.floor(p.typingClock * 7) % 4;
    const handShift = typeStep % 2 === 0 ? 1 : 0;

    // Legs bent forward on cushion toward desk underside
    framedRect(footX + (dir === 1 ? 0 : -8), footY - 8, 8, 5, C.slate, C.ink);
    framedRect(footX + (dir === 1 ? 5 : -9), footY - 5, 4, 6, C.milk, C.ink);

    // Torso
    framedRect(footX - 5, topY + 14, 10, 11, C.green, C.ink);
    px(footX - 3, topY + 15, 6, 6, C.mint);

    // Head (16px wide side/3-quarter silhouette)
    framedRect(footX - 8, topY, 16, 15, "#fbe3d3", C.ink);
    // Hair back + bangs
    if (dir === 1) {
      px(footX - 7, topY + 1, 9, 12, "#6b473d");
      px(footX - 6, topY + 1, 11, 4, "#8e6255");
      px(footX + 4, topY + 7, 2, 3, C.ink); // eye facing monitor
      px(footX + 3, topY + 10, 2, 2, C.peach); // cheek
    } else {
      px(footX - 2, topY + 1, 9, 12, "#6b473d");
      px(footX - 5, topY + 1, 11, 4, "#8e6255");
      px(footX - 6, topY + 7, 2, 3, C.ink);
      px(footX - 5, topY + 10, 2, 2, C.peach);
    }
    // Headset band & earcup
    px(footX - 6, topY, 12, 2, C.aqua);
    framedRect(footX - 2, topY + 5, 4, 6, C.aqua, C.ink);

    // Forearm + typing hand reaching cleanly to keyboardAnchor
    const kbX = seat.keyboardAnchor.x;
    const reachX = dir === 1 ? Math.max(footX + 3, kbX - 8 + handShift) : Math.min(footX - 3, kbX + 8 - handShift);
    const armStartX = dir === 1 ? footX + 1 : reachX;
    const armW = Math.max(6, Math.abs(reachX - footX) + 3);
    framedRect(armStartX, topY + 17, armW, 4, C.mint, C.ink);
    px(dir === 1 ? reachX : reachX - 2, topY + 17, 3, 3, "#fbe3d3");
    return;
  }

  // --- Standing / Walking Character (Down, Up, Left, Right; 6-frame leg/arm stride) ---
  const strideTable = [
    [-1, 1],
    [-2, 2],
    [-1, 1],
    [1, -1],
    [2, -2],
    [1, -1],
  ];
  const [lSwing, rSwing] = p.mode === "walk" ? strideTable[walkPhase] : [0, 0];

  if (p.facing === "down" || p.facing === "up") {
    // Legs + Sneakers
    framedRect(footX - 5, footY - 8 + lSwing, 4, 7, C.slate, C.ink);
    px(footX - 5, footY - 3 + lSwing, 4, 2, C.milk);
    framedRect(footX + 1, footY - 8 + rSwing, 4, 7, C.slate, C.ink);
    px(footX + 1, footY - 3 + rSwing, 4, 2, C.milk);

    // Arms
    framedRect(footX - 8, topY + 15 + Math.round(rSwing * 0.5), 3, 8, C.green, C.ink);
    framedRect(footX + 5, topY + 15 + Math.round(lSwing * 0.5), 3, 8, C.green, C.ink);

    // Torso (Sage hoodie + cream collar)
    framedRect(footX - 5, topY + 14, 10, 11, C.green, C.ink);
    px(footX - 3, topY + 16, 6, 7, C.mint);
    if (p.facing === "down") px(footX - 2, topY + 15, 4, 2, C.milk);

    // Head (16px wide, warm plum ink)
    framedRect(footX - 8, topY, 16, 15, "#fbe3d3", C.ink);
    if (p.facing === "down") {
      // Hair crown + bangs
      px(footX - 7, topY + 1, 14, 5, "#6b473d");
      px(footX - 6, topY + 1, 12, 2, "#8e6255");
      px(footX - 7, topY + 5, 3, 3, "#6b473d");
      px(footX + 4, topY + 5, 3, 3, "#6b473d");
      // Eyes & rosy cheeks
      px(footX - 4, topY + 8, 2, 3, C.ink);
      px(footX + 2, topY + 8, 2, 3, C.ink);
      px(footX - 6, topY + 10, 2, 2, C.peach);
      px(footX + 4, topY + 10, 2, 2, C.peach);
    } else {
      // Hair full back
      px(footX - 7, topY + 1, 14, 13, "#6b473d");
      px(footX - 5, topY + 2, 10, 4, "#8e6255");
    }
    // Headset band stays inside 16px silhouette
    px(footX - 7, topY + 1, 14, 2, C.aqua);
    px(footX - 8, topY + 5, 2, 5, C.aqua);
    px(footX + 6, topY + 5, 2, 5, C.aqua);
  } else {
    // Side walking (left/right)
    const dir = p.facing === "right" ? 1 : -1;
    // Back leg
    framedRect(footX - 2 - lSwing, footY - 8, 4, 7, "#39465e", C.ink);
    // Front leg
    framedRect(footX - 2 + rSwing, footY - 8, 4, 7, C.slate, C.ink);
    px(footX - 2 + rSwing, footY - 3, 4, 2, C.milk);
    // Torso
    framedRect(footX - 5, topY + 14, 10, 11, C.green, C.ink);
    px(footX - 3, topY + 15, 6, 6, C.mint);
    // Swinging arm
    framedRect(footX - 2 - lSwing, topY + 15, 4, 8, C.mint, C.ink);
    px(footX - 1 - lSwing, topY + 21, 3, 2, "#fbe3d3");
    // Head (16px wide)
    framedRect(footX - 8, topY, 16, 15, "#fbe3d3", C.ink);
    if (dir === 1) {
      px(footX - 7, topY + 1, 9, 12, "#6b473d");
      px(footX - 6, topY + 1, 11, 4, "#8e6255");
      px(footX + 4, topY + 8, 2, 3, C.ink);
      px(footX + 3, topY + 11, 2, 1, C.peach);
    } else {
      px(footX - 2, topY + 1, 9, 12, "#6b473d");
      px(footX - 5, topY + 1, 11, 4, "#8e6255");
      px(footX - 6, topY + 8, 2, 3, C.ink);
      px(footX - 5, topY + 11, 2, 1, C.peach);
    }
    px(footX - 6, topY + 1, 12, 2, C.aqua);
    framedRect(footX - 2, topY + 5, 4, 6, C.aqua, C.ink);
  }
}

function drawOverlayTag(text, x, y, color) {
  const tw = Math.ceil(ctx.measureText(text).width);
  ctx.fillStyle = "rgba(24, 19, 32, 0.86)";
  ctx.fillRect(Math.round(x - 2), Math.round(y - 1), tw + 4, 10);
  ctx.fillStyle = color;
  ctx.fillText(text, Math.round(x), Math.round(y));
}

// ---------- Canonical Spec Overlay (문턱·통로·좌판·키보드·배달 쟁반·발박스) ----------
function drawSpecOverlay() {
  if (!state.showOverlay) return;
  ctx.save();
  ctx.font = "bold 8px sans-serif";
  ctx.textBaseline = "top";

  // Aisles
  for (const aisle of AISLES) {
    ctx.fillStyle = "rgba(131, 201, 197, 0.14)";
    ctx.fillRect(aisle.rect.x, aisle.rect.y, aisle.rect.width, aisle.rect.height);
    ctx.strokeStyle = C.aqua;
    ctx.lineWidth = 1;
    ctx.strokeRect(aisle.rect.x + 0.5, aisle.rect.y + 0.5, aisle.rect.width - 1, aisle.rect.height - 1);
    drawOverlayTag(`통로 ${aisle.clearWidth}px`, aisle.rect.x + 3, aisle.rect.y + 3, C.aqua);
  }

  // Doors / Thresholds
  for (const door of DOORS) {
    const t = door.threshold;
    ctx.fillStyle = "rgba(236, 183, 121, 0.35)";
    ctx.fillRect(t.x, t.y, t.width, t.height);
    ctx.strokeStyle = C.gold;
    ctx.strokeRect(t.x + 0.5, t.y + 0.5, t.width - 1, t.height - 1);
    drawOverlayTag(`문턱 ${door.clearWidth}×${door.doorHeight}`, t.x - 10, t.y + t.height + 2, C.milk);
  }

  // Seats: Cushion, Keyboard, Tray, DeliveryStop, Approach
  for (const seat of SEAT_LIST) {
    // Approach point
    ctx.fillStyle = C.mint;
    ctx.fillRect(seat.approachPoint.x - 2, seat.approachPoint.y - 2, 4, 4);

    // Cushion anchor
    ctx.strokeStyle = "#ffe2ad";
    ctx.strokeRect(seat.cushionAnchor.x - 4.5, seat.cushionAnchor.y - 4.5, 9, 9);
    drawOverlayTag("좌판", seat.cushionAnchor.x - 8, seat.cushionAnchor.y + 6, "#ffe2ad");

    // Keyboard anchor
    ctx.strokeStyle = "#83c9c5";
    ctx.strokeRect(seat.keyboardAnchor.x - 3.5, seat.keyboardAnchor.y - 3.5, 7, 7);
    drawOverlayTag("키", seat.keyboardAnchor.x - 5, seat.keyboardAnchor.y - 12, "#83c9c5");

    // Tray anchor
    ctx.strokeStyle = "#f9cca5";
    ctx.strokeRect(seat.trayAnchor.x + 0.5, seat.trayAnchor.y + 0.5, seat.trayAnchor.width - 1, seat.trayAnchor.height - 1);
    drawOverlayTag("쟁반", seat.trayAnchor.x - 2, seat.trayAnchor.y + seat.trayAnchor.height + 2, "#f9cca5");
  }

  // Player footBox
  const fb = getFootBox(state.player.x, state.player.y);
  ctx.strokeStyle = "#ff8585";
  ctx.strokeRect(fb.x + 0.5, fb.y + 0.5, fb.width - 1, fb.height - 1);

  ctx.restore();
}

// ---------- Scene Render ----------
function renderScene(timeSec) {
  // Base background ink
  px(0, 0, W, H, C.ink);

  // Exterior corridor floor & street curb
  drawSlateTiles(ZONES.exterior.bounds.x, ZONES.exterior.bounds.y, ZONES.exterior.bounds.width, ZONES.exterior.bounds.height);
  // Sidewalk curb accent
  px(ZONES.exterior.bounds.x, ZONES.exterior.bounds.y + 42, ZONES.exterior.bounds.width, 3, C.glass);
  // Warm interior light spill out the open entrance onto sidewalk
  const entranceOpen = state.doorOpen.entrance || 0;
  ctx.fillStyle = `rgba(255, 226, 173, ${0.14 + entranceOpen * 0.14})`;
  ctx.fillRect(256, 308, 40, 26);

  // Hall & Solo wood floor
  const woodSwatches = [C.wood, "#a16b66", "#ae7468", "#9f6865"];
  drawFloorPlanks(36, 48, 568, 248, woodSwatches);
  drawFloorPlanks(48, 56, 152, 140, [C.wood, "#ab7368", "#9c6763"]);

  // Subtle floor runners / cozy area rugs
  drawRug(66, 62, 114, 92, C.slate, "#a48697");
  drawRug(362, 102, 176, 84, "#5d465f", "#c99f94");

  // Outer Perimeter & Interior Architectural Walls (from ZONES coordinates)
  // North wall (y: 12..48 across full store)
  framedRect(24, 12, 592, 38, C.plum, C.ink);
  px(26, 14, 588, 20, C.violet);
  px(26, 34, 588, 14, C.darkWood);
  // Solo room north window looking at rainy city skyline
  drawWindowScene(56, 18, 64, 24, timeSec);
  // Hall north cozy windows
  drawWindowScene(248, 18, 68, 24, timeSec);
  drawWindowScene(398, 18, 68, 24, timeSec);
  // Warm wall sconces (apricot lighting)
  for (const sx of [164, 348, 520]) {
    framedRect(sx - 5, 22, 10, 12, C.gold, C.ink);
    px(sx - 3, 24, 6, 8, C.milk);
    ctx.fillStyle = "rgba(236, 183, 121, 0.14)";
    ctx.fillRect(sx - 20, 34, 40, 28);
  }

  // West & East outer store walls
  framedRect(24, 12, 12, 296, C.plum, C.ink);
  px(27, 14, 6, 292, C.violet);
  framedRect(604, 12, 12, 296, C.plum, C.ink);
  px(607, 14, 6, 292, C.violet);

  // Solo room east partition wall (x: 200..212, y: 48..208) with frosted glass slit
  framedRect(200, 48, 12, 160, C.darkWood, C.ink);
  px(202, 52, 8, 152, C.wood);
  framedRect(202, 88, 8, 56, C.slate, C.ink);

  // Solo room south partition wall (y: 192..208) interrupted by solo-door (109..139)
  framedRect(36, 192, 73, 16, C.darkWood, C.ink);
  px(38, 194, 69, 8, C.slate);
  framedRect(139, 192, 65, 16, C.darkWood, C.ink);
  px(141, 194, 61, 8, C.slate);

  // South storefront wall (y: 292..308) interrupted by entrance (260..292)
  framedRect(24, 292, 236, 16, C.plum, C.ink);
  px(26, 294, 232, 8, C.blue);
  framedRect(292, 292, 324, 16, C.plum, C.ink);
  px(294, 294, 320, 8, C.blue);

  // Central divider spine in general seat bay
  const spine = FURNITURE.find((f) => f.id === "hall-bay-spine");
  framedRect(spine.visualRect.x, spine.visualRect.y, spine.visualRect.width, spine.visualRect.height, C.darkWood, C.ink);
  px(spine.visualRect.x + 2, spine.visualRect.y + 4, 4, spine.visualRect.height - 8, C.wood);
  // Small ambient desk lamp on top of spine
  framedRect(446, 94, 8, 8, C.gold, C.ink);
  px(448, 96, 4, 4, C.milk);

  // Zone floor labels in subtle ink
  ctx.save();
  ctx.font = "bold 8px sans-serif";
  ctx.fillStyle = "rgba(255, 226, 173, 0.55)";
  ctx.fillText("1인룸", 164, 68);
  ctx.fillText("일반석 시안 구역", 412, 84);
  ctx.fillText("매장 앞 복도", 204, 340);
  ctx.restore();

  // Floor-level door mats and door glass leaves
  for (const door of DOORS) {
    drawDoorFloorAndLeaves(door);
  }

  // Draw furniture, seats (with depth-sorted seated/standing character) and plants
  const player = state.player;
  const isPlayerSeated = player.mode === "typing" || player.mode === "sit-down" || player.mode === "stand-up";

  // Static seat desks + chair cushions
  for (const seat of SEAT_LIST) {
    drawSeatDeskAndChairBase(seat, state.seatsRuntime[seat.key], timeSec);
  }

  // Kiosk & Plants (behind or depth sorted cleanly with standing character)
  const kioskItem = FURNITURE.find((f) => f.id === "kiosk");
  const plantItems = FURNITURE.filter((f) => f.kind === "plant");

  const depthList = [
    { y: kioskItem.anchor.y, draw: () => drawKiosk(kioskItem, timeSec) },
    ...plantItems.map((pl) => ({ y: pl.anchor.y, draw: () => drawPlant(pl, timeSec) })),
  ];
  if (!isPlayerSeated) {
    depthList.push({ y: player.y, draw: () => drawCharacter(player) });
  }
  depthList.sort((a, b) => a.y - b.y);
  for (const entry of depthList) entry.draw();

  // Seated character layered neatly between chair cushion and foreground backrest occlusion
  if (isPlayerSeated && player.seatKey && SEATS[player.seatKey]) {
    drawCharacter(player);
  }

  // Foreground chair backrests (always occlude seated player's back/hip)
  for (const seat of SEAT_LIST) {
    drawSeatBackrestOcclusion(seat);
  }

  // Optional delivery trays on desks
  if (state.showTray) {
    for (const seat of SEAT_LIST) {
      drawDeliveryTray(seat);
    }
  }

  // Foreground door lintels (always span over character's head when passing doorway)
  for (const door of DOORS) {
    drawDoorLintelOcclusion(door);
  }

  // Click destination / unreachable visual feedback
  if (state.clickFeedback) {
    const cf = state.clickFeedback;
    ctx.save();
    ctx.strokeStyle = cf.ok ? C.aqua : "#ff8585";
    ctx.lineWidth = 1;
    const r = 4 + Math.round((1 - cf.timer / 0.6) * 4);
    ctx.strokeRect(Math.round(cf.x - r) + 0.5, Math.round(cf.y - r) + 0.5, r * 2, r * 2);
    if (!cf.ok) {
      ctx.font = "bold 8px sans-serif";
      ctx.fillStyle = "#ffd7d6";
      ctx.fillText("이동 불가", Math.round(cf.x - 16), Math.round(cf.y - 14));
    }
    ctx.restore();
  }

  // Active path breadcrumb while auto-walking
  if (player.mode === "walk" && player.path.length > 0) {
    const dest = player.path.at(-1);
    ctx.fillStyle = C.aqua;
    ctx.fillRect(Math.round(dest.x - 2), Math.round(dest.y - 2), 4, 4);
  }

  drawSpecOverlay();
}

// ---------- Simulation & State Transitions ----------
function startWalkTo(targetPoint, targetSeatKey = null) {
  const p = state.player;
  if (p.seatKey) {
    const curSeat = SEATS[p.seatKey];
    const walkPoints = findPath(curSeat.standPoint, targetPoint);
    if (!walkPoints.length) return false;
    state.seatsRuntime[p.seatKey].bootStage = "off";
    state.seatsRuntime[p.seatKey].bootTimer = 0;
    p.mode = "stand-up";
    p.targetSeatKey = targetSeatKey;
    p.pendingPlan = { walkPoints, targetSeatKey };
    return true;
  }
  const route = findPath({ x: p.x, y: p.y }, targetPoint);
  if (!route.length) return false;
  p.path = route;
  p.targetSeatKey = targetSeatKey;
  p.pendingPlan = null;
  p.mode = "walk";
  return true;
}

function selectSeat(seatKey) {
  const seat = SEATS[seatKey];
  if (!seat) return false;
  const p = state.player;
  if (p.seatKey === seatKey && p.mode === "typing") {
    showToast(`${seat.label}에 이미 착석 중입니다.`);
    return true;
  }
  const plan = planSeatApproach({ x: p.x, y: p.y }, p.seatKey, seatKey);
  if (!plan) {
    showToast("좌석 경로를 찾을 수 없습니다.", "error");
    return false;
  }
  if (plan.standFirst && p.seatKey) {
    state.seatsRuntime[p.seatKey].bootStage = "off";
    state.seatsRuntime[p.seatKey].bootTimer = 0;
    p.mode = "stand-up";
    p.targetSeatKey = seatKey;
    p.pendingPlan = plan;
  } else {
    p.path = plan.walkPoints;
    p.targetSeatKey = seatKey;
    p.pendingPlan = null;
    p.mode = "walk";
  }
  state.kioskMode = "confirmed";
  return true;
}

function standUp() {
  const p = state.player;
  if (!p.seatKey || p.mode === "stand-up") return false;
  state.seatsRuntime[p.seatKey].bootStage = "off";
  state.seatsRuntime[p.seatKey].bootTimer = 0;
  p.mode = "stand-up";
  p.targetSeatKey = null;
  p.pendingPlan = null;
  return true;
}

function updateSimulation(dt) {
  const p = state.player;

  if (state.clickFeedback) {
    state.clickFeedback.timer -= dt;
    if (state.clickFeedback.timer <= 0) state.clickFeedback = null;
  }

  // Update doors open ratio when character approaches
  for (const door of DOORS) {
    const dist = Math.hypot(p.x - door.threshold.cx, p.y - door.threshold.cy);
    const targetOpen = dist <= door.openRadius ? 1 : 0;
    const rate = 6 * dt;
    const cur = state.doorOpen[door.id];
    if (cur < targetOpen) state.doorOpen[door.id] = Math.min(1, cur + rate);
    else if (cur > targetOpen) state.doorOpen[door.id] = Math.max(0, cur - rate);
  }

  // Update PC boot states
  for (const seat of SEAT_LIST) {
    const rt = state.seatsRuntime[seat.key];
    if (rt.bootStage === "booting") {
      rt.bootTimer += dt;
      if (rt.bootTimer >= 1.0) {
        rt.bootStage = "on";
      }
    }
  }

  // Manual keyboard movement
  let dx = 0;
  let dy = 0;
  if (!state.modal.open) {
    if (state.keysDown.has("ArrowLeft") || state.keysDown.has("KeyA")) dx -= 1;
    if (state.keysDown.has("ArrowRight") || state.keysDown.has("KeyD")) dx += 1;
    if (state.keysDown.has("ArrowUp") || state.keysDown.has("KeyW")) dy -= 1;
    if (state.keysDown.has("ArrowDown") || state.keysDown.has("KeyS")) dy += 1;
  }

  if ((dx !== 0 || dy !== 0) && (p.mode === "idle" || p.mode === "walk")) {
    p.path = [];
    p.targetSeatKey = null;
    p.mode = "walk";
    const len = Math.hypot(dx, dy);
    const step = CHARACTER_SPEC.walkSpeedPxPerSec * dt;
    const vx = (dx / len) * step;
    const vy = (dy / len) * step;
    let moved = false;
    if (vx !== 0 && isFootWalkable(p.x + vx, p.y)) {
      p.x += vx;
      moved = true;
    }
    if (vy !== 0 && isFootWalkable(p.x, p.y + vy)) {
      p.y += vy;
      moved = true;
    }
    if (Math.abs(dx) >= Math.abs(dy)) p.facing = dx > 0 ? "right" : "left";
    else p.facing = dy > 0 ? "down" : "up";
    if (moved) p.walkDistance += step;
  } else if (p.mode === "walk") {
    if (p.path.length > 0) {
      const target = p.path[0];
      const ddx = target.x - p.x;
      const ddy = target.y - p.y;
      const dist = Math.hypot(ddx, ddy);
      const step = CHARACTER_SPEC.walkSpeedPxPerSec * dt;
      if (Math.abs(ddx) >= Math.abs(ddy)) p.facing = ddx >= 0 ? "right" : "left";
      else p.facing = ddy >= 0 ? "down" : "up";

      if (dist <= step) {
        p.x = target.x;
        p.y = target.y;
        p.walkDistance += dist;
        p.path.shift();
        if (p.path.length === 0) {
          if (p.targetSeatKey && SEATS[p.targetSeatKey]) {
            const seat = SEATS[p.targetSeatKey];
            p.seatKey = seat.key;
            p.facing = seat.facing;
            p.sitProgress = 0;
            p.mode = "sit-down";
          } else {
            p.mode = "idle";
          }
        }
      } else {
        p.x += (ddx / dist) * step;
        p.y += (ddy / dist) * step;
        p.walkDistance += step;
      }
    } else {
      p.mode = "idle";
    }
  } else if (p.mode === "sit-down") {
    p.sitProgress = Math.min(1, p.sitProgress + dt * 2.8);
    if (p.sitProgress >= 1 && p.seatKey) {
      p.mode = "typing";
      p.typingClock = 0;
      const rt = state.seatsRuntime[p.seatKey];
      rt.bootStage = "booting";
      rt.bootTimer = 0;
    }
  } else if (p.mode === "typing") {
    p.typingClock += dt;
  } else if (p.mode === "stand-up") {
    p.sitProgress = Math.max(0, p.sitProgress - dt * 3.0);
    if (p.sitProgress <= 0) {
      const curSeat = p.seatKey ? SEATS[p.seatKey] : null;
      if (curSeat) {
        p.x = curSeat.standPoint.x;
        p.y = curSeat.standPoint.y;
      }
      p.seatKey = null;
      if (p.pendingPlan && p.pendingPlan.walkPoints.length) {
        p.path = p.pendingPlan.walkPoints;
        p.targetSeatKey = p.pendingPlan.targetSeatKey;
        p.pendingPlan = null;
        p.mode = "walk";
      } else {
        p.mode = "idle";
      }
    }
  }

  // Update HUD text
  const zoneId = getZoneAt(p.x, p.y);
  const zoneName = zoneId ? ZONES[zoneId].name : "문턱 통과 중";
  hudZone.textContent = zoneName;
  btnStand.disabled = !p.seatKey || p.mode === "stand-up";

  if (p.mode === "typing" && p.seatKey) {
    const rt = state.seatsRuntime[p.seatKey];
    hudStatus.textContent = `${SEATS[p.seatKey].label} 착석·타이핑 중 (모니터 ${rt.bootStage === "on" ? "활성" : "부팅 중"}) · ( ${Math.round(p.x)}, ${Math.round(p.y)} )`;
  } else if (p.mode === "sit-down") {
    hudStatus.textContent = `${SEATS[p.seatKey]?.label ?? "좌석"} 착석 중...`;
  } else if (p.mode === "stand-up") {
    hudStatus.textContent = "자리에서 통로로 일어나는 중...";
  } else {
    hudStatus.textContent = `${p.mode === "walk" ? "이동 중" : "대기"} · (${Math.round(p.x)}, ${Math.round(p.y)}) · 방향 ${p.facing}`;
  }
}

// ---------- Shared-Data Seat Map Modal ----------
function renderSeatMap() {
  const occupancy = Object.fromEntries(
    SEAT_LIST.map((s) => [s.key, state.seatsRuntime[s.key].occupiedBy]),
  );
  const model = buildSeatMapModel(occupancy, state.player.seatKey);
  const toPct = (v, max) => `${(v / max) * 100}%`;

  seatmapBoard.innerHTML = "";

  for (const z of model.zones) {
    const el = document.createElement("div");
    el.className = "map-zone";
    el.dataset.zone = z.id;
    el.style.left = toPct(z.rect.x, model.world.width);
    el.style.top = toPct(z.rect.y, model.world.height);
    el.style.width = toPct(z.rect.width, model.world.width);
    el.style.height = toPct(z.rect.height, model.world.height);
    const label = document.createElement("span");
    label.className = "map-zone-label";
    label.textContent = z.name;
    el.appendChild(label);
    seatmapBoard.appendChild(el);
  }

  for (const a of model.aisles) {
    const el = document.createElement("div");
    el.className = "map-aisle";
    el.title = `${a.label} (${a.clearWidth}px)`;
    el.style.left = toPct(a.rect.x, model.world.width);
    el.style.top = toPct(a.rect.y, model.world.height);
    el.style.width = toPct(a.rect.width, model.world.width);
    el.style.height = toPct(a.rect.height, model.world.height);
    seatmapBoard.appendChild(el);
  }

  for (const d of model.doors) {
    const bar = document.createElement("div");
    bar.className = "map-door";
    bar.style.left = toPct(d.threshold.x, model.world.width);
    bar.style.top = toPct(d.threshold.y + 4, model.world.height);
    bar.style.width = toPct(d.threshold.width, model.world.width);
    bar.style.height = "6px";
    seatmapBoard.appendChild(bar);

    const tag = document.createElement("span");
    tag.className = "map-door-tag";
    tag.textContent = d.label;
    tag.style.left = toPct(d.threshold.cx, model.world.width);
    tag.style.top = toPct(d.threshold.y + 3, model.world.height);
    seatmapBoard.appendChild(tag);
  }

  const kioskEl = document.createElement("div");
  kioskEl.className = "map-kiosk";
  kioskEl.style.left = toPct(model.kiosk.rect.x, model.world.width);
  kioskEl.style.top = toPct(model.kiosk.rect.y, model.world.height);
  kioskEl.style.width = toPct(model.kiosk.rect.width, model.world.width);
  kioskEl.style.height = toPct(model.kiosk.rect.height, model.world.height);
  seatmapBoard.appendChild(kioskEl);

  const kioskTag = document.createElement("span");
  kioskTag.className = "map-kiosk-tag";
  kioskTag.textContent = "키오스크";
  kioskTag.style.left = toPct(model.kiosk.rect.x + model.kiosk.rect.width / 2, model.world.width);
  kioskTag.style.top = toPct(model.kiosk.rect.y - 2, model.world.height);
  seatmapBoard.appendChild(kioskTag);

  const dirArrow = { up: "▲ 정면", right: "▶ 우측", left: "◀ 좌측" };
  for (const s of model.seats) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "seat-btn";
    btn.dataset.seatKey = s.key;
    btn.dataset.status = s.status;
    btn.dataset.selected = String(state.modal.selectedSeatKey === s.key);
    btn.style.left = toPct(s.cushionAnchor.x, model.world.width);
    btn.style.top = toPct(s.cushionAnchor.y, model.world.height);
    const statusText = s.status === "occupied" ? "이용 중" : s.status === "mine" ? "내 자리" : dirArrow[s.facing];
    btn.innerHTML = `<span>${s.displayNumber}</span><small>${statusText}</small>`;
    btn.addEventListener("click", () => {
      if (s.status === "occupied") {
        showToast(`${s.label}은(는) 다른 손님이 이용 중입니다.`, "error");
        return;
      }
      state.modal.selectedSeatKey = s.key;
      updateSeatMapSelection();
    });
    seatmapBoard.appendChild(btn);
  }
  updateSeatMapSelection();
}

function updateSeatMapSelection() {
  const buttons = seatmapBoard.querySelectorAll(".seat-btn");
  for (const btn of buttons) {
    btn.dataset.selected = String(btn.dataset.seatKey === state.modal.selectedSeatKey);
  }
  const picked = state.modal.selectedSeatKey ? SEATS[state.modal.selectedSeatKey] : null;
  if (!picked) {
    seatmapSelection.textContent = "자리를 선택하세요 (화살표 이동 · Enter 선택)";
    seatmapConfirm.disabled = true;
  } else {
    seatmapSelection.textContent = `선택: ${picked.label} (${ZONES[picked.zone].name})`;
    seatmapConfirm.disabled = false;
  }
}

function openSeatMap(triggerEl = null) {
  state.modal.open = true;
  state.modal.lastFocusedEl = triggerEl || document.activeElement;
  state.kioskMode = "selecting";
  if (!state.modal.selectedSeatKey) {
    const firstAvail = SEAT_LIST.find((s) => !state.seatsRuntime[s.key].occupiedBy);
    state.modal.selectedSeatKey = firstAvail?.key ?? "hall:0";
  }
  renderSeatMap();
  seatmapBackdrop.hidden = false;
  const firstBtn = seatmapBoard.querySelector(`.seat-btn[data-seat-key="${state.modal.selectedSeatKey}"]`);
  firstBtn?.focus();
}

function closeSeatMap() {
  if (!state.modal.open) return;
  state.modal.open = false;
  seatmapBackdrop.hidden = true;
  if (state.kioskMode === "selecting") state.kioskMode = "idle";
  state.modal.lastFocusedEl?.focus?.();
}

// ---------- Input Handlers ----------
canvas.addEventListener("click", (ev) => {
  canvas.focus({ preventScroll: true });
  const rect = canvas.getBoundingClientRect();
  const lx = ((ev.clientX - rect.left) / rect.width) * W;
  const ly = ((ev.clientY - rect.top) / rect.height) * H;

  // Clicking near kiosk opens seat map
  const kioskItem = FURNITURE.find((f) => f.id === "kiosk");
  if (
    lx >= kioskItem.visualRect.x - 4 &&
    lx <= kioskItem.visualRect.x + kioskItem.visualRect.width + 4 &&
    ly >= kioskItem.visualRect.y - 4 &&
    ly <= kioskItem.visualRect.y + kioskItem.visualRect.height + 4
  ) {
    startWalkTo(kioskItem.interactPoint);
    openSeatMap(canvas);
    return;
  }

  // Clicking a seat desk or chair navigates and sits there
  for (const seat of SEAT_LIST) {
    const inDesk =
      lx >= seat.deskRect.x - 4 &&
      lx <= seat.deskRect.x + seat.deskRect.width + 4 &&
      ly >= seat.deskRect.y - 12 &&
      ly <= seat.deskRect.y + seat.deskRect.height + 4;
    const inChair =
      lx >= seat.chairRect.x - 4 &&
      lx <= seat.chairRect.x + seat.chairRect.width + 4 &&
      ly >= seat.chairRect.y - 4 &&
      ly <= seat.chairRect.y + seat.chairRect.height + 4;
    if (inDesk || inChair) {
      selectSeat(seat.key);
      return;
    }
  }

  // Floor click
  if (!isFootWalkable(lx, ly)) {
    state.clickFeedback = { x: lx, y: ly, ok: false, timer: 0.6 };
    showToast("벽이나 가구 위로 이동할 수 없습니다.", "error");
    return;
  }
  if (startWalkTo({ x: lx, y: ly })) {
    state.clickFeedback = { x: lx, y: ly, ok: true, timer: 0.45 };
  } else {
    state.clickFeedback = { x: lx, y: ly, ok: false, timer: 0.6 };
    showToast("도달할 수 없는 위치입니다.", "error");
  }
});

window.addEventListener("keydown", (ev) => {
  if (ev.code === "Escape" && state.modal.open) {
    ev.preventDefault();
    closeSeatMap();
    return;
  }
  if (state.modal.open) {
    if (ev.code === "ArrowRight" || ev.code === "ArrowDown" || ev.code === "ArrowLeft" || ev.code === "ArrowUp") {
      ev.preventDefault();
      const order = SEAT_LIST.map((s) => s.key);
      const curIdx = Math.max(0, order.indexOf(state.modal.selectedSeatKey));
      const delta = ev.code === "ArrowRight" || ev.code === "ArrowDown" ? 1 : -1;
      const nextKey = order[(curIdx + delta + order.length) % order.length];
      state.modal.selectedSeatKey = nextKey;
      updateSeatMapSelection();
      seatmapBoard.querySelector(`.seat-btn[data-seat-key="${nextKey}"]`)?.focus();
    }
    return;
  }
  if (ev.code === "KeyM") {
    ev.preventDefault();
    openSeatMap();
    return;
  }
  if (ev.code === "KeyG") {
    ev.preventDefault();
    setOverlay(!state.showOverlay);
    return;
  }
  if (ev.code === "KeyB") {
    ev.preventDefault();
    setTrayVisible(!state.showTray);
    return;
  }
  if (ev.code === "KeyE") {
    ev.preventDefault();
    standUp();
    return;
  }
  state.keysDown.add(ev.code);
});

window.addEventListener("keyup", (ev) => {
  state.keysDown.delete(ev.code);
});

function setOverlay(enabled) {
  state.showOverlay = Boolean(enabled);
  btnOverlay.setAttribute("aria-pressed", String(state.showOverlay));
}

function setTrayVisible(enabled) {
  state.showTray = Boolean(enabled);
  btnTray.setAttribute("aria-pressed", String(state.showTray));
}

function setHudCollapsed(collapsed) {
  state.hudCollapsed = Boolean(collapsed);
  hudInfo.hidden = state.hudCollapsed;
  qaDock.hidden = state.hudCollapsed;
  btnCollapse.setAttribute("aria-expanded", String(!state.hudCollapsed));
  btnCollapse.textContent = state.hudCollapsed ? "패널 펼치기" : "패널 숨기기";
}

// Toolbar buttons
document.getElementById("btn-demo-entrance").addEventListener("click", () => {
  state.player.seatKey = null;
  state.player.mode = "idle";
  state.player.sitProgress = 0;
  state.player.x = DOORS[0].approachPoint.x;
  state.player.y = DOORS[0].approachPoint.y;
  startWalkTo(FURNITURE.find((f) => f.id === "kiosk").interactPoint);
});
document.getElementById("btn-kiosk").addEventListener("click", (ev) => openSeatMap(ev.currentTarget));
document.getElementById("btn-seat-hall-0").addEventListener("click", () => selectSeat("hall:0"));
document.getElementById("btn-seat-hall-1").addEventListener("click", () => selectSeat("hall:1"));
document.getElementById("btn-seat-solo-0").addEventListener("click", () => selectSeat("solo:0"));
btnStand.addEventListener("click", () => standUp());
btnTray.addEventListener("click", () => setTrayVisible(!state.showTray));
btnOverlay.addEventListener("click", () => setOverlay(!state.showOverlay));
btnCollapse.addEventListener("click", () => setHudCollapsed(!state.hudCollapsed));

seatmapClose.addEventListener("click", closeSeatMap);
seatmapBackdrop.addEventListener("click", (ev) => {
  if (ev.target === seatmapBackdrop) closeSeatMap();
});
seatmapConfirm.addEventListener("click", () => {
  const key = state.modal.selectedSeatKey;
  if (!key) return;
  if (state.seatsRuntime[key].occupiedBy) {
    showToast("다른 손님이 먼저 선택한 좌석입니다. 목록만 갱신했습니다.", "error");
    renderSeatMap();
    return;
  }
  closeSeatMap();
  selectSeat(key);
});
seatmapSimConflict.addEventListener("click", () => {
  const targetKey = state.modal.selectedSeatKey || "hall:1";
  const rt = state.seatsRuntime[targetKey];
  rt.occupiedBy = rt.occupiedBy ? null : { name: "먼저 도착한 손님" };
  renderSeatMap();
  showToast(rt.occupiedBy ? `${SEATS[targetKey].label} 동시 예약 충돌 재현 (해당 자리만 갱신)` : "점유 해제 완료");
});

// Expose deterministic QA/verification API for FHD & 4K automated testing
window.__renewalSlice = {
  getState: () => ({
    player: {
      x: Number(state.player.x.toFixed(2)),
      y: Number(state.player.y.toFixed(2)),
      facing: state.player.facing,
      mode: state.player.mode,
      sitProgress: Number(state.player.sitProgress.toFixed(2)),
      seatKey: state.player.seatKey,
      zone: getZoneAt(state.player.x, state.player.y),
    },
    scale: state.lastScale,
    canvasCss: { width: canvas.style.width, height: canvas.style.height },
    showOverlay: state.showOverlay,
    showTray: state.showTray,
    hudCollapsed: state.hudCollapsed,
    modalOpen: state.modal.open,
    doors: { ...state.doorOpen },
    seats: Object.fromEntries(
      SEAT_LIST.map((s) => [s.key, { ...state.seatsRuntime[s.key] }]),
    ),
  }),
  walkTo: (x, y) => startWalkTo({ x, y }),
  selectSeat: (key) => selectSeat(key),
  standUp: () => standUp(),
  openSeatMap: () => openSeatMap(),
  closeSeatMap: () => closeSeatMap(),
  setOverlay,
  setTrayVisible,
  setHudCollapsed,
  resetAtEntrance: () => {
    state.player.seatKey = null;
    state.player.mode = "idle";
    state.player.sitProgress = 0;
    state.player.path = [];
    state.player.x = DOORS[0].approachPoint.x;
    state.player.y = DOORS[0].approachPoint.y;
    state.player.facing = "up";
  },
};

// Main loop
let lastTs = performance.now();
function frame(ts) {
  const dt = Math.min(0.05, Math.max(0.001, (ts - lastTs) / 1000));
  lastTs = ts;
  updateSimulation(dt);
  renderScene(ts / 1000);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
