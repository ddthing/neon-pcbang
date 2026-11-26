import {
  DOORS,
  SEATS,
  WORLD_SPEC,
  ZONES,
  getFootBox,
  rectContains,
  rectsOverlap,
} from "./renewal-layout.mjs";

const { palette: C } = WORLD_SPEC;

function expandRect(r, pad) {
  return {
    x: r.x - pad,
    y: r.y - pad,
    width: r.width + pad * 2,
    height: r.height + pad * 2,
  };
}

export const SLICE_WINDOWS = Object.freeze([
  Object.freeze({
    id: "solo-window",
    zone: "solo",
    frameRect: Object.freeze({ x: 56, y: 18, width: 64, height: 24 }),
    mullionX: 87,
    glassPanes: Object.freeze([
      Object.freeze({ x: 58, y: 20, width: 29, height: 20 }),
      Object.freeze({ x: 89, y: 20, width: 29, height: 20 }),
    ]),
    floorSpillRect: Object.freeze({ x: 58, y: 56, width: 60, height: 18 }),
  }),
  Object.freeze({
    id: "hall-window-1",
    zone: "hall",
    frameRect: Object.freeze({ x: 248, y: 18, width: 68, height: 24 }),
    mullionX: 281,
    glassPanes: Object.freeze([
      Object.freeze({ x: 250, y: 20, width: 31, height: 20 }),
      Object.freeze({ x: 283, y: 20, width: 31, height: 20 }),
    ]),
    floorSpillRect: Object.freeze({ x: 250, y: 48, width: 64, height: 22 }),
  }),
  Object.freeze({
    id: "hall-window-2",
    zone: "hall",
    frameRect: Object.freeze({ x: 398, y: 18, width: 68, height: 24 }),
    mullionX: 431,
    glassPanes: Object.freeze([
      Object.freeze({ x: 400, y: 20, width: 31, height: 20 }),
      Object.freeze({ x: 433, y: 20, width: 31, height: 20 }),
    ]),
    floorSpillRect: Object.freeze({ x: 400, y: 48, width: 64, height: 22 }),
  }),
]);

export const SLICE_LAMPS = Object.freeze([
  Object.freeze({
    id: "sconce-solo",
    zone: "solo",
    bulbRect: Object.freeze({ x: 159, y: 22, width: 10, height: 12 }),
    floorPoolRect: Object.freeze({ x: 144, y: 34, width: 40, height: 30 }),
  }),
  Object.freeze({
    id: "sconce-hall-1",
    zone: "hall",
    bulbRect: Object.freeze({ x: 343, y: 22, width: 10, height: 12 }),
    floorPoolRect: Object.freeze({ x: 328, y: 34, width: 40, height: 32 }),
  }),
  Object.freeze({
    id: "sconce-hall-2",
    zone: "hall",
    bulbRect: Object.freeze({ x: 515, y: 22, width: 10, height: 12 }),
    floorPoolRect: Object.freeze({ x: 500, y: 34, width: 40, height: 32 }),
  }),
  Object.freeze({
    id: "bay-desk-lamp",
    zone: "hall",
    bulbRect: Object.freeze({ x: 446, y: 94, width: 8, height: 8 }),
    floorPoolRect: Object.freeze({ x: 422, y: 100, width: 56, height: 22 }),
  }),
]);

export const EXTERIOR_SPLASH_ZONE = Object.freeze({
  bounds: ZONES.exterior.bounds,
  doorExclusionRect: Object.freeze(expandRect(DOORS[0].threshold, 4)),
});

export function computeLightingPalette({ lightPhase = "night", effectsEnabled = true } = {}) {
  const isNight = lightPhase !== "day";
  if (!effectsEnabled) {
    return Object.freeze({
      lightPhase: isNight ? "night" : "day",
      effectsEnabled: false,
      skyBase: isNight ? "#2f4158" : "#6c8eb3",
      buildingFar: isNight ? "#243347" : "#4b698a",
      buildingNear: isNight ? "#1c2838" : "#3b5675",
      litWindowColor: isNight ? C.gold : "#d9ecf5",
      ambientColor: C.ink,
      ambientAlpha: isNight ? 0.10 : 0,
      windowSpillColor: isNight ? "#7ba3cc" : "#fff1cf",
      windowSpillAlpha: 0,
      lampPoolAlpha: 0,
      monitorPoolAlpha: 0,
      exteriorSheenAlpha: 0,
    });
  }

  return Object.freeze({
    lightPhase: isNight ? "night" : "day",
    effectsEnabled: true,
    skyBase: isNight ? "#334763" : "#7fa4cc",
    buildingFar: isNight ? "#273850" : "#5b799c",
    buildingNear: isNight ? "#1e2c40" : "#496485",
    litWindowColor: isNight ? C.gold : "#d7e8f5",
    ambientColor: C.ink,
    // Bounded tint keeps walls, furniture silhouettes, and floor aisles readable at both 3x and 6x.
    ambientAlpha: isNight ? 0.16 : 0.0,
    windowSpillColor: isNight ? "#83b0db" : "#ffeec9",
    windowSpillAlpha: isNight ? 0.11 : 0.16,
    lampPoolAlpha: isNight ? 0.22 : 0.08,
    monitorPoolAlpha: isNight ? 0.24 : 0.14,
    exteriorSheenAlpha: isNight ? 0.15 : 0.08,
  });
}

export function computeWindowWeatherParticles({
  weather = "clear",
  timeSec = 0,
  reducedMotion = false,
  effectsEnabled = true,
} = {}) {
  if (!effectsEnabled || (weather !== "rain" && weather !== "snow")) return [];
  const particles = [];
  const stepTick = reducedMotion ? 0 : Math.floor(timeSec * (weather === "snow" ? 6 : 24));
  const pH = weather === "snow" ? 1 : 4;
  const pW = 1;

  for (const win of SLICE_WINDOWS) {
    win.glassPanes.forEach((pane, paneIdx) => {
      const count = weather === "snow" ? 4 : 5;
      const maxX = Math.max(1, pane.width - pW);
      const maxY = Math.max(1, pane.height - pH);
      for (let i = 0; i < count; i++) {
        const seed = (win.mullionX * 7 + paneIdx * 13 + i * 19);
        const speedX = weather === "snow" ? ((i % 2 === 0 ? 1 : -1) * Math.floor(stepTick / 3)) : Math.floor(stepTick * 0.45);
        const speedY = weather === "snow" ? Math.floor(stepTick * 0.6) : stepTick;
        const x = pane.x + (((seed + speedX) % maxX) + maxX) % maxX;
        const y = pane.y + (((seed * 3 + speedY) % maxY) + maxY) % maxY;
        const box = { x, y, width: pW, height: pH };
        if (rectContains(pane, box)) {
          particles.push({
            windowId: win.id,
            paneIndex: paneIdx,
            x,
            y,
            width: pW,
            height: pH,
            kind: weather,
          });
        }
      }
    });
  }
  return particles;
}

export function computeExteriorSplashes({
  weather = "clear",
  timeSec = 0,
  reducedMotion = false,
  effectsEnabled = true,
  playerPos = null,
} = {}) {
  if (!effectsEnabled || weather !== "rain" || reducedMotion) return [];
  const { bounds, doorExclusionRect } = EXTERIOR_SPLASH_ZONE;
  const playerBox = playerPos ? expandRect(getFootBox(playerPos.x, playerPos.y), 2) : null;
  const tick = Math.floor(timeSec * 10);
  const splashes = [];

  for (let i = 0; i < 18; i++) {
    const phase = (tick + i * 3) % 8;
    if (phase >= 3) continue;
    const width = 1 + phase * 2;
    const height = 1;
    const x = bounds.x + 8 + ((i * 71 + Math.floor(i / 3) * 19) % Math.max(1, bounds.width - 20));
    const y = bounds.y + 4 + ((i * 37) % Math.max(1, bounds.height - 8));
    const rect = { x, y, width, height };
    if (!rectContains(bounds, rect)) continue;
    if (rectsOverlap(rect, doorExclusionRect)) continue;
    if (playerBox && rectsOverlap(rect, playerBox)) continue;
    splashes.push({ x, y, width, height, frame: phase });
  }
  return splashes;
}

export function computeSteamParticles({
  cooking = false,
  cookingAnchor = null,
  activeTraySeats = [],
  timeSec = 0,
  reducedMotion = false,
  effectsEnabled = true,
} = {}) {
  if (!effectsEnabled) return [];
  const step = reducedMotion ? 0 : Math.floor(timeSec * 6);
  const particles = [];

  if (cooking && cookingAnchor) {
    for (let i = 0; i < 2; i++) {
      const rise = reducedMotion ? i * 2 : (step + i * 3) % 6;
      particles.push({
        source: "cook",
        seatKey: null,
        x: Math.round(cookingAnchor.x + i * 4 + (rise % 2)),
        y: Math.round(cookingAnchor.y - 2 - rise),
        width: 1,
        height: 2,
      });
    }
  }

  for (const key of activeTraySeats) {
    const seat = SEATS[key];
    if (!seat) continue;
    const t = seat.trayAnchor;
    for (let i = 0; i < 2; i++) {
      const rise = reducedMotion ? 1 + i * 2 : (step + i * 2 + key.length) % 6;
      const sx = t.x + 3 + ((i * 3 + (reducedMotion ? 0 : rise % 2)) % Math.max(2, t.width - 5));
      const sy = t.y - 1 - rise;
      particles.push({
        source: "tray",
        seatKey: key,
        x: sx,
        y: sy,
        width: 1,
        height: 2,
      });
    }
  }

  return particles;
}

function fill(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

export function renderClippedWindow(ctx, win, envState, timeSec) {
  const { frameRect: fr, mullionX, glassPanes } = win;
  const pal = computeLightingPalette(envState);

  // Outer window casing border
  fill(ctx, fr.x, fr.y, fr.width, fr.height, C.ink);
  fill(ctx, fr.x + 1, fr.y + 1, fr.width - 2, fr.height - 2, C.blue);

  // Sky & skyline inside each glass pane
  for (const pane of glassPanes) {
    fill(ctx, pane.x, pane.y, pane.width, pane.height, pal.skyBase);
    fill(ctx, pane.x + 2, pane.y + 7, 10, pane.height - 7, pal.buildingFar);
    fill(ctx, pane.x + 13, pane.y + 4, 12, pane.height - 4, pal.buildingNear);
    if (pane.width > 24) {
      fill(ctx, pane.x + 26, pane.y + 9, pane.width - 26, pane.height - 9, pal.buildingFar);
    }
    fill(ctx, pane.x + 5, pane.y + 10, 2, 2, pal.litWindowColor);
    fill(ctx, pane.x + 16, pane.y + 7, 2, 3, C.milk);
    fill(ctx, pane.x + 20, pane.y + 12, 2, 2, C.aqua);
  }

  // Strictly clipped weather streaks/flakes per glass pane
  const weatherParticles = computeWindowWeatherParticles({
    weather: envState.weather,
    timeSec,
    reducedMotion: envState.reducedMotion,
    effectsEnabled: envState.effectsEnabled,
  }).filter((p) => p.windowId === win.id);

  for (let idx = 0; idx < glassPanes.length; idx++) {
    const pane = glassPanes[idx];
    const items = weatherParticles.filter((p) => p.paneIndex === idx);
    if (!items.length) continue;
    ctx.save();
    ctx.beginPath();
    ctx.rect(pane.x, pane.y, pane.width, pane.height);
    ctx.clip();
    const tint = envState.weather === "snow" ? "#eef6ff" : "#9bd4d8";
    for (const item of items) {
      fill(ctx, item.x, item.y, item.width, item.height, tint);
    }
    ctx.restore();
  }

  // Foreground window mullion & top reflection strip (occludes weather cleanly)
  fill(ctx, mullionX, fr.y + 1, 2, fr.height - 2, C.ink);
  fill(ctx, mullionX + 1, fr.y + 2, 1, fr.height - 4, C.blue);
  fill(ctx, fr.x + 2, fr.y + 1, fr.width - 4, 1, C.blue);
}

export function renderFloorLightingAndSplashes(ctx, envState, timeSec, {
  doors = DOORS,
  doorOpen = {},
  seatsRuntime = {},
  playerPos = null,
} = {}) {
  const pal = computeLightingPalette(envState);

  // Subtle day/night indoor glaze
  if (pal.ambientAlpha > 0) {
    ctx.save();
    ctx.globalAlpha = pal.ambientAlpha;
    fill(ctx, 36, 48, 568, 248, pal.ambientColor);
    ctx.restore();
  }

  // Window floor daylight / moonlight spill
  if (pal.windowSpillAlpha > 0) {
    ctx.save();
    ctx.globalAlpha = pal.windowSpillAlpha;
    for (const win of SLICE_WINDOWS) {
      const sp = win.floorSpillRect;
      fill(ctx, sp.x, sp.y, sp.width, sp.height, pal.windowSpillColor);
    }
    ctx.restore();
  }

  // Sconce and desk lamp warm floor pools
  if (pal.lampPoolAlpha > 0) {
    ctx.save();
    ctx.globalAlpha = pal.lampPoolAlpha;
    for (const lamp of SLICE_LAMPS) {
      const lp = lamp.floorPoolRect;
      fill(ctx, lp.x, lp.y, lp.width, lp.height, C.gold);
    }
    ctx.restore();
  }

  // Active monitor floor reflection beneath active desks
  if (pal.monitorPoolAlpha > 0) {
    ctx.save();
    ctx.globalAlpha = pal.monitorPoolAlpha;
    for (const seat of Object.values(SEATS)) {
      if (seatsRuntime[seat.key]?.bootStage === "on") {
        fill(ctx, seat.deskRect.x - 4, seat.deskRect.y + seat.deskRect.height - 2, seat.deskRect.width + 8, 8, C.aqua);
      }
    }
    ctx.restore();
  }

  // Entrance warm interior spill onto exterior corridor tiles
  const entranceOpen = doorOpen[doors[0]?.id] || 0;
  ctx.save();
  ctx.globalAlpha = pal.lightPhase === "night" ? 0.14 + entranceOpen * 0.14 : 0.08 + entranceOpen * 0.08;
  fill(ctx, 256, 308, 40, 26, C.milk);
  ctx.restore();

  // Exterior corridor puddle sheen & non-overlapping rain splashes
  if (pal.exteriorSheenAlpha > 0 && (envState.weather === "rain" || envState.weather === "snow")) {
    ctx.save();
    ctx.globalAlpha = pal.exteriorSheenAlpha;
    fill(ctx, 64, 326, 72, 10, C.aqua);
    fill(ctx, 344, 330, 88, 12, C.gold);
    ctx.restore();
  }

  const splashes = computeExteriorSplashes({
    weather: envState.weather,
    timeSec,
    reducedMotion: envState.reducedMotion,
    effectsEnabled: envState.effectsEnabled,
    playerPos,
  });
  for (const s of splashes) {
    fill(ctx, s.x, s.y, s.width, s.height, "#a9cbe0");
  }
}

export function renderTraySteamAndSeatHighlight(ctx, envState, timeSec, {
  activeSeatKey = null,
  showTray = false,
  cooking = false,
  cookingAnchor = null,
} = {}) {
  // Highlight selected/my seat subtly even in reduced motion
  if (activeSeatKey && SEATS[activeSeatKey]) {
    const c = SEATS[activeSeatKey].cushionAnchor;
    ctx.save();
    ctx.globalAlpha = envState.reducedMotion ? 0.35 : 0.25 + 0.12 * Math.sin(timeSec * 3);
    ctx.strokeStyle = C.aqua;
    ctx.strokeRect(c.x - 10 + 0.5, c.y - 9 + 0.5, 19, 17);
    ctx.restore();
  }

  const activeTraySeats = showTray ? Object.keys(SEATS) : [];
  const steams = computeSteamParticles({
    cooking,
    cookingAnchor,
    activeTraySeats,
    timeSec,
    reducedMotion: envState.reducedMotion,
    effectsEnabled: envState.effectsEnabled,
  });

  if (!steams.length) return;
  ctx.save();
  ctx.globalAlpha = envState.reducedMotion ? 0.5 : 0.72;
  for (const p of steams) {
    fill(ctx, p.x, p.y, p.width, p.height, "#fff2e2");
  }
  ctx.restore();
}
