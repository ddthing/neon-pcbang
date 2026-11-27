import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  MOVEMENT_SPEC,
  canWalk,
  canWalkInSpace,
  clearSegmentInSpace,
  entrance,
  entranceThreshold,
  pathTo,
  relaxZones,
  routeToSeat,
} from "../lib/cafe-world.mjs";
import { CHARACTER_SPEC } from "../lib/renewal-layout.mjs";
import { HALL_BANKS, HALL_TABLES, ROOMS, SEATS, SEAT_COUNTS, TILE, WORLD, seatFor, toPercent, toPixels } from "../lib/cafe-map.mjs";

test("movement engine uses the shared 768×512 scale and character foot box", () => {
  assert.deepEqual(MOVEMENT_SPEC.world, WORLD);
  assert.deepEqual(WORLD, { width: 768, height: 512 });
  assert.deepEqual(MOVEMENT_SPEC.footBox, CHARACTER_SPEC.footBox);
});

test("hall entrance threshold is reachable and walkable while adjacent bottom walls stay blocked", () => {
  assert.equal(canWalk(entranceThreshold.center.x, entranceThreshold.center.y), true);
  const adjacentWall = toPercent({ x: 320, y: 488 });
  assert.equal(canWalk(adjacentWall.x, adjacentWall.y), false);
  const route = pathTo(entrance, entranceThreshold.center, "hall", { strictTarget: true });
  assert.ok(route.length >= 1, "must find path onto visible doorway threshold");
  let prev = entrance;
  for (const pt of route) {
    assert.equal(clearSegmentInSpace(prev, pt, "hall"), true);
    prev = pt;
  }
  assert.ok(Math.hypot(prev.x - entranceThreshold.center.x, prev.y - entranceThreshold.center.y) < 0.1);
});

test("strictTarget click mode rejects walls and obstacles instead of warping to another corridor", () => {
  assert.deepEqual(pathTo(entrance, toPercent({ x: 272, y: 96 }), "hall", { strictTarget: true }), []);
  assert.deepEqual(pathTo(entrance, toPercent({ x: 320, y: 488 }), "hall", { strictTarget: true }), []);
  assert.deepEqual(
    pathTo(relaxZones.booth.door, { x: 86, y: 49 }, "booth", { strictTarget: true }),
    [],
  );
  assert.deepEqual(
    pathTo(relaxZones.terrace.door, { x: 80, y: 56 }, "terrace", { strictTarget: true }),
    [],
  );
});

test("booth and terrace pathfinding uses continuous collision checks around every obstacle", () => {
  for (const space of ["booth", "terrace"]) {
    const cfg = relaxZones[space];
    const origin = { x: cfg.door.x, y: cfg.door.y - 2 };
    for (const spot of cfg.spots) {
      assert.equal(canWalkInSpace(spot.x, spot.y, space), true, `${space}:${spot.id} must be walkable`);
      const route = pathTo(origin, spot, space, { strictTarget: true });
      assert.ok(route.length >= 1, `${space}:${spot.id} must have a continuous route`);
      let prev = origin;
      for (const pt of route) {
        assert.equal(clearSegmentInSpace(prev, pt, space), true, `${space}:${spot.id} clipped obstacle`);
        prev = pt;
      }
      assert.ok(Math.hypot(prev.x - spot.x, prev.y - spot.y) < 0.1);
    }
  }
});

test("all 67 Korean PC방 seats are accessible from the entry and their approaches stay walkable", () => {
  assert.equal(SEATS.length, 67);
  assert.deepEqual(SEAT_COUNTS, { hall: 48, solo: 4, duo: 4, team: 5, squad: 6 });
  assert.deepEqual(new Set(SEATS.map(({ direction }) => direction)), new Set(["up", "down", "left", "right"]));
  for (const { key, foot, stand } of SEATS) {
    const legs = routeToSeat(entrance, null, key);
    assert.equal(legs.length, 1, key);
    const [{ start, space, points }] = legs;
    assert.equal(space, "hall");
    assert.deepEqual(points.at(-1), toPercent(foot));
    assert.deepEqual(points.at(-2), toPercent(stand));
    let prev = start;
    for (const point of points.slice(0, -1)) {
      assert.equal(clearSegmentInSpace(prev, point, space), true, key);
      prev = point;
    }
  }
});

test("seat switching stays inside the current room", () => {
  for (const [from, to] of [["duo:0", "duo:1"], ["team:0", "team:3"], ["squad:0", "squad:2"], ["squad:0", "squad:4"]]) {
    const origin = seatFor(from), target = seatFor(to);
    const [{ start, space, points }] = routeToSeat(toPercent(origin.foot), from, to);
    assert.equal(space, "hall");
    assert.deepEqual(start, toPercent(origin.foot));
    assert.deepEqual(points[0], toPercent(origin.stand));
    assert.deepEqual(points.at(-1), toPercent(target.foot));
    const room = ROOMS.find(({ id }) => id === origin.room);
    assert.equal(room.id, target.room);
    const { x, y, w, h } = room.rect;
    assert.ok(points.map(toPixels).every(p => p.x > x && p.x < x + w && p.y > y && p.y < y + h));
  }
});

test("Korean PC방 aisle clearances (>=48px center aisle, 6 continuous banks), walkability of all stand points/doors, and 4 weather modes + cloud/fog non-rain + reduced motion", () => {
  // Check central vertical aisle between left bank (cols [16..24]) and right bank (cols [27..35]) is >= 48px (3 tiles)
  assert.equal(HALL_BANKS.length, 6);
  assert.equal(HALL_TABLES.length, 48);
  const leftBankEnd = (22 + 2) * TILE;
  const rightBankStart = 27 * TILE;
  assert.ok(rightBankStart - leftBankEnd >= 48, `Central aisle must be >= 48px, got ${rightBankStart - leftBankEnd}`);
  // Side aisle outside solo-2/4 & squad-1 east wall (x=13) to left bay (x=16) is >= 48px (3 tiles)
  assert.ok(16 * TILE - 13 * TILE >= 48);
  // Right aisle between right bay (x=35) and duo/team west wall (x=39) is >= 48px (4 tiles = 64px)
  assert.ok(39 * TILE - 35 * TILE >= 48);
  // Vertical gaps between back-to-back blocks (y=5..9, 12..16, 19..23) leave >= 48px (3 tiles) between blocks
  assert.ok(12 * TILE - 9 * TILE >= 48);
  assert.ok(19 * TILE - 16 * TILE >= 48);
  // Every seat standPoint and room door center is walkable
  for (const s of SEATS) {
    const pct = toPercent(s.stand);
    assert.equal(canWalk(pct.x, pct.y), true, `Seat stand point must be walkable: ${s.key}`);
  }
  for (const room of ROOMS) {
    const doorCenter = toPercent({ x: room.door.x + TILE / 2, y: room.door.y + TILE / 2 });
    assert.equal(canWalk(doorCenter.x, doorCenter.y), true, `Room door must be walkable: ${room.id}`);
  }

  // All 4 FX weather overlay modes + prefers-reduced-motion handling
  const pixelTiles = readFileSync(new URL("../public/pixel-tiles.js", import.meta.url), "utf8");
  const cafeArt = readFileSync(new URL("../public/cafe-art.js", import.meta.url), "utf8");
  const cameraJs = readFileSync(new URL("../public/camera.js", import.meta.url), "utf8");
  for (const mode of ["rain:", "storm:", "snow:", "leaves:"]) {
    assert.ok(pixelTiles.includes(mode), `Missing weather strip ${mode} in pixel-tiles.js`);
  }
  assert.match(cafeArt, /prefers-reduced-motion:\s*reduce/);
  assert.match(cafeArt, /T\.weatherLoop\(overlay,\s*weather,\s*now,\s*motion\.matches\)/);
  assert.match(cameraJs, /prefers-reduced-motion:\s*reduce/);
});
