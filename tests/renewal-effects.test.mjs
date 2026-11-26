import assert from "node:assert/strict";
import test from "node:test";
import { DOORS, SEATS, getFootBox, rectContains, rectsOverlap } from "../lib/renewal-layout.mjs";
import {
  EXTERIOR_SPLASH_ZONE,
  SLICE_WINDOWS,
  computeExteriorSplashes,
  computeLightingPalette,
  computeSteamParticles,
  computeWindowWeatherParticles,
} from "../lib/renewal-effects.mjs";

test("indoor rain and snow particles stay strictly inside glassPanes without leaking onto frames or mullions", () => {
  for (const weather of ["rain", "snow"]) {
    for (const timeSec of [0.1, 1.4, 3.7]) {
      const particles = computeWindowWeatherParticles({
        weather,
        timeSec,
        reducedMotion: false,
        effectsEnabled: true,
      });
      assert.ok(particles.length > 0, `expected ${weather} particles`);
      for (const p of particles) {
        const win = SLICE_WINDOWS.find((w) => w.id === p.windowId);
        assert.ok(win);
        const pane = win.glassPanes[p.paneIndex];
        assert.equal(rectContains(pane, p), true, `${weather} particle leaked outside pane ${win.id}:${p.paneIndex}`);
        assert.equal(p.x < win.mullionX || p.x >= win.mullionX + 2, true, "must not draw on mullion");
      }
    }
  }
  assert.deepEqual(
    computeWindowWeatherParticles({ weather: "clear", timeSec: 1, effectsEnabled: true }),
    [],
  );
});

test("exterior rain splashes stay in exterior bounds and avoid door threshold and player feet", () => {
  const playerPos = { x: 240, y: 328 };
  const playerFoot = getFootBox(playerPos.x, playerPos.y);
  for (const timeSec of [0, 0.2, 0.5, 0.9]) {
    const splashes = computeExteriorSplashes({
      weather: "rain",
      timeSec,
      reducedMotion: false,
      effectsEnabled: true,
      playerPos,
    });
    for (const s of splashes) {
      assert.equal(rectContains(EXTERIOR_SPLASH_ZONE.bounds, s), true);
      assert.equal(rectsOverlap(s, DOORS[0].threshold), false, "must avoid entrance threshold");
      assert.equal(rectsOverlap(s, playerFoot), false, "must avoid player feet");
    }
  }
});

test("steam particles stop when idle and rise strictly above active tray anchors", () => {
  assert.deepEqual(
    computeSteamParticles({ cooking: false, activeTraySeats: [], timeSec: 2, effectsEnabled: true }),
    [],
  );

  const traySteams = computeSteamParticles({
    cooking: false,
    activeTraySeats: ["hall:0", "solo:0"],
    timeSec: 1.5,
    reducedMotion: false,
    effectsEnabled: true,
  });
  assert.equal(traySteams.length, 4);
  for (const p of traySteams) {
    assert.equal(p.source, "tray");
    const tray = SEATS[p.seatKey].trayAnchor;
    assert.equal(p.x >= tray.x && p.x + p.width <= tray.x + tray.width, true);
    assert.equal(p.y < tray.y, true);
  }
});

test("effectsEnabled=false suppresses particles while reducedMotion produces static deterministic output", () => {
  assert.deepEqual(
    computeWindowWeatherParticles({ weather: "rain", timeSec: 2, effectsEnabled: false }),
    [],
  );
  assert.deepEqual(
    computeExteriorSplashes({ weather: "rain", timeSec: 0.2, effectsEnabled: false }),
    [],
  );
  assert.deepEqual(
    computeSteamParticles({ cooking: true, cookingAnchor: { x: 100, y: 200 }, activeTraySeats: ["hall:0"], timeSec: 1, effectsEnabled: false }),
    [],
  );

  const r1 = computeWindowWeatherParticles({ weather: "rain", timeSec: 0.5, reducedMotion: true, effectsEnabled: true });
  const r2 = computeWindowWeatherParticles({ weather: "rain", timeSec: 9.2, reducedMotion: true, effectsEnabled: true });
  assert.deepEqual(r1, r2);

  const s1 = computeSteamParticles({ cooking: true, cookingAnchor: { x: 100, y: 200 }, activeTraySeats: ["solo:0"], timeSec: 0.5, reducedMotion: true, effectsEnabled: true });
  const s2 = computeSteamParticles({ cooking: true, cookingAnchor: { x: 100, y: 200 }, activeTraySeats: ["solo:0"], timeSec: 7.8, reducedMotion: true, effectsEnabled: true });
  assert.deepEqual(s1, s2);
});

test("day and night lighting palettes maintain safe bounded ambient alpha and contrast", () => {
  const day = computeLightingPalette({ lightPhase: "day", effectsEnabled: true });
  const night = computeLightingPalette({ lightPhase: "night", effectsEnabled: true });
  assert.equal(day.ambientAlpha, 0);
  assert.ok(night.ambientAlpha > 0 && night.ambientAlpha <= 0.2);
  assert.ok(day.windowSpillAlpha > 0 && night.lampPoolAlpha > day.lampPoolAlpha);
});
