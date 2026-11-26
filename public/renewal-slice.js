import { createSliceArt } from "./renewal-slice-art.mjs";
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
  isSegmentWalkable,
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

const art = createSliceArt(ctx, px);

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
    const offset = (row * 19 + (row % 3) * 7) % plankW;
    for (let col = -1; col * plankW < w + plankW; col++) {
      const hash = Math.abs(Math.imul(col + 103, 0x45d9f3b) ^ Math.imul(row + 13, 0x27d4eb2d));
      const lx = x + col * plankW + offset;
      const ty = y + row * plankH;
      px(lx, ty, plankW - 1, plankH - 1, swatches[hash % swatches.length]);
      px(lx + 2, ty + 1, plankW - 5, 1, "#ad786c");
      if (hash % 3 === 0) {
        px(lx + 6 + (hash % 12), ty + 5, 5 + (hash % 5), 1, "#9d6965");
      }
      if (hash % 5 === 0) {
        px(lx + 20, ty + 8, 3, 1, "#b58272");
        px(lx + 21, ty + 9, 6, 1, "#996663");
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
      px(tx + 2, ty + 1, 7 + (row + col * 3) % 5, 1, "#61728e");
    }
  }
  ctx.restore();
}

function drawRug(x, y, w, h, bodyColor, trimColor) {
  px(x + 2, y + 2, w, h, "rgba(41, 36, 53, 0.38)");
  framedRect(x, y, w, h, bodyColor, C.ink);
  framedRect(x + 2, y + 2, w - 4, h - 4, bodyColor, trimColor);
  framedRect(x + 5, y + 5, w - 10, h - 10, bodyColor, "rgba(255, 215, 180, 0.16)");
  for (let dx = 8; dx < w - 7; dx += 5) {
    px(x + dx, y + 1, 2, 1, trimColor);
    px(x + dx, y + h - 2, 2, 1, trimColor);
  }
  for (const dx of [7, w - 16]) {
    for (const dy of [7, h - 16]) {
      px(x + dx, y + dy + 3, 9, 3, trimColor);
      px(x + dx + 3, y + dy, 3, 9, trimColor);
      px(x + dx + 4, y + dy + 4, 1, 1, C.paper);
    }
  }
}

function drawWindowScene(x, y, w, h, timeSec) {
  px(x - 2, y + h - 1, w + 4, 4, C.shade);
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
  px(x - 2, y + h, w + 4, 1, "#b08085");
  px(x + 4, y + h + 1, w - 8, 1, C.plum);
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
  px(fr.x + 1, leafTop, 1, leafH - 2, C.lightWood);
  px(fr.x + fr.width - 3, leafTop, 1, leafH - 2, "#a77674");
  px(th.x, leafBottom - 2, door.clearWidth, 1, C.shade);
  px(th.x, leafBottom - 1, door.clearWidth, 1, "#a38c95");

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
  for (const panelX of [leftX, rightX]) {
    px(panelX + 2, leafTop + 2, panelW - 4, 1, "#7d9bac");
    px(panelX + 2, leafBottom - 5, panelW - 4, 1, C.slate);
    for (let step = 0; step < 6; step++) {
      px(panelX + 3 + step, leafTop + 12 - step, 2, 1, "#678ba1");
    }
  }
  ctx.restore();
}

function drawDoorLintelOcclusion(door) {
  const fr = door.frameRect;
  const lh = door.lintelOcclusionHeight;
  // Upper jamb caps + overhead lintel beam that passes over player head when crossing threshold
  framedRect(fr.x, fr.y, fr.width, lh, C.wood, C.ink);
  px(fr.x + 2, fr.y + 2, fr.width - 4, 1, C.lightWood);
  px(fr.x + 2, fr.y + 3, 2, lh - 6, C.lightWood);
  px(fr.x + fr.width - 4, fr.y + 3, 2, lh - 6, C.darkWood);
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
  const exterior = ZONES.exterior.bounds;
  const [entryWalk] = ZONES.exterior.walkableRects;
  drawSlateTiles(exterior.x, exterior.y, exterior.width, exterior.height);
  const rightEdge = entryWalk.x + entryWalk.width;
  px(exterior.x, exterior.y, entryWalk.x - exterior.x, exterior.height, "rgba(37,40,63,0.24)");
  px(rightEdge, exterior.y, exterior.x + exterior.width - rightEdge, exterior.height, "rgba(37,40,63,0.24)");
  for (const edge of [entryWalk.x, rightEdge]) {
    px(edge - 1, entryWalk.y, 1, entryWalk.height, "#72819b");
  }
  // Sidewalk curb accent
  px(ZONES.exterior.bounds.x, ZONES.exterior.bounds.y + 42, ZONES.exterior.bounds.width, 3, C.glass);
  // Warm interior light spill out the open entrance onto sidewalk
  const entranceOpen = state.doorOpen.entrance || 0;
  ctx.fillStyle = `rgba(255, 226, 173, ${0.14 + entranceOpen * 0.14})`;
  ctx.fillRect(256, 308, 40, 26);

  // Hall & Solo wood floor
  const woodSwatches = ["#a3726a", "#a16e68", "#a7766d", "#9e6d66"];
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
  px(26, 14, 588, 1, "#a28394");
  px(26, 32, 588, 2, "#604658");
  for (let x = 34; x < 612; x += 16) {
    px(x, 35, 1, 11, "#704859");
    px(x + 1, 35, 1, 10, "#976166");
  }
  px(26, 46, 588, 1, "#b27c71");
  px(26, 49, 588, 2, "rgba(49,33,53,0.29)");
  // Solo room north window looking at rainy city skyline
  drawWindowScene(56, 18, 64, 24, timeSec);
  // Hall north cozy windows
  drawWindowScene(248, 18, 68, 24, timeSec);
  drawWindowScene(398, 18, 68, 24, timeSec);
  // Warm wall sconces (apricot lighting)
  for (const sx of [164, 348, 520]) {
    px(sx - 12, 23, 24, 28, "rgba(242,179,122,0.07)");
    px(sx - 16, 38, 32, 16, "rgba(242,179,122,0.07)");
    px(sx - 19, 47, 38, 10, "rgba(242,179,122,0.05)");
    framedRect(sx - 5, 22, 10, 12, "#a77478", C.shade);
    px(sx - 3, 24, 6, 7, C.gold);
    px(sx - 2, 24, 4, 6, C.milk);
    px(sx - 2, 34, 4, 2, C.shade);
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

  const player = state.player;
  const activeSeat = player.seatKey ? SEATS[player.seatKey] : null;
  const reduced = reducedMotionQuery.matches;
  const drawSeatTray = (seat) => {
    if (state.showTray) art.drawTray(seat);
  };

  const depthList = FURNITURE.filter((item) => item.kind === "plant" || item.kind === "kiosk")
    .map((item) => ({
      y: item.anchor.y,
      draw: () => item.kind === "plant"
        ? art.drawPlant(item, timeSec, reduced)
        : art.drawKiosk(item, state.kioskMode, timeSec, reduced),
    }));

  for (const seat of SEAT_LIST) {
    depthList.push({
      y: seat.deskRect.y + seat.deskRect.height,
      draw: () => {
        art.drawDesk(seat, state.seatsRuntime[seat.key], timeSec, reduced);
        if (seat !== activeSeat) drawSeatTray(seat);
      },
    });
    depthList.push({
      y: seat.chairRect.y + seat.chairRect.height,
      draw: () => {
        art.drawChairBase(seat);
        if (seat !== activeSeat) art.drawBackrest(seat);
      },
    });
  }

  for (const door of DOORS) {
    depthList.push({ y: door.threshold.cy, draw: () => drawDoorLintelOcclusion(door) });
  }

  if (activeSeat) {
    // Keep the chair behind the approaching character until the last two poses.
    depthList.push({
      y: Math.max(activeSeat.deskRect.y + activeSeat.deskRect.height, activeSeat.chairRect.y + activeSeat.chairRect.height),
      draw: () => {
        const pose = Math.round(player.sitProgress * (CHARACTER_SPEC.sitFrames - 1));
        const hipIsAtChair = pose >= CHARACTER_SPEC.sitFrames - 2;
        if (!hipIsAtChair) art.drawBackrest(activeSeat);
        art.drawCharacter(player, activeSeat);
        if (hipIsAtChair) art.drawBackrest(activeSeat);
        drawSeatTray(activeSeat);
      },
    });
  } else {
    depthList.push({ y: player.y, draw: () => art.drawCharacter(player, null) });
  }
  depthList.sort((a, b) => a.y - b.y);
  for (const entry of depthList) entry.draw();

  // Click destination / unreachable visual feedback
  if (state.clickFeedback) {
    const cf = state.clickFeedback;
    ctx.save();
    ctx.strokeStyle = cf.ok ? C.aqua : "#ff8585";
    ctx.lineWidth = 1;
    const r = reducedMotionQuery.matches ? 5 : 4 + Math.round((1 - cf.timer / 0.6) * 4);
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

  if ((dx !== 0 || dy !== 0) && p.mode === "typing") {
    standUp();
  } else if ((dx !== 0 || dy !== 0) && (p.mode === "idle" || p.mode === "walk")) {
    p.path = [];
    p.targetSeatKey = null;
    p.mode = "walk";
    const len = Math.hypot(dx, dy);
    const step = CHARACTER_SPEC.walkSpeedPxPerSec * dt;
    const vx = (dx / len) * step;
    const vy = (dy / len) * step;
    let moved = false;
    if (vx !== 0 && isSegmentWalkable({ x: p.x, y: p.y }, { x: p.x + vx, y: p.y })) {
      p.x += vx;
      moved = true;
    }
    if (vy !== 0 && isSegmentWalkable({ x: p.x, y: p.y }, { x: p.x, y: p.y + vy })) {
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
