import assert from "node:assert/strict";
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
import { CHARACTER_SPEC, WORLD_SPEC } from "../lib/renewal-layout.mjs";

test("movement engine reuses finalized world scale and footBox dimensions from renewal-layout", () => {
  assert.deepEqual(MOVEMENT_SPEC.world, WORLD_SPEC);
  assert.deepEqual(MOVEMENT_SPEC.footBox, CHARACTER_SPEC.footBox);
});

test("hall entrance threshold is reachable and walkable while adjacent bottom walls stay blocked", () => {
  assert.equal(canWalk(entranceThreshold.center.x, entranceThreshold.center.y), true);
  assert.equal(canWalk(50, entranceThreshold.center.y), false);
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
  assert.deepEqual(pathTo(entrance, { x: 30, y: 40 }, "hall", { strictTarget: true }), []);
  assert.deepEqual(pathTo(entrance, { x: 50, y: 89.2 }, "hall", { strictTarget: true }), []);
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

test("same-room seat switching uses internal corridors without visiting roomDoor", () => {
  const roomChairs = {
    "duo:0": { x: 38, y: 70 },
    "duo:1": { x: 65, y: 70 },
    "team:0": { x: 20, y: 68 },
    "team:3": { x: 68, y: 68 },
    "squad:0": { x: 32.8, y: 33 },
    "squad:2": { x: 75.5, y: 33 },
    "squad:4": { x: 55.2, y: 76 },
  };
  const chairPos = (key) => roomChairs[key];
  const hasDoorDetour = (pts) => pts.some((p) => p.x === 50 && p.y === 94);

  const duoRoute = routeToSeat(roomChairs["duo:0"], "duo:0", "duo:1", chairPos);
  assert.equal(duoRoute.length, 1);
  assert.equal(hasDoorDetour(duoRoute[0].points), false);

  const teamRoute = routeToSeat(roomChairs["team:0"], "team:0", "team:3", chairPos);
  assert.equal(teamRoute.length, 1);
  assert.equal(hasDoorDetour(teamRoute[0].points), false);

  const squadFrontRoute = routeToSeat(roomChairs["squad:0"], "squad:0", "squad:2", chairPos);
  assert.equal(squadFrontRoute.length, 1);
  assert.equal(hasDoorDetour(squadFrontRoute[0].points), false);
  assert.equal(squadFrontRoute[0].points.every((p) => p.y <= 40), true, "front-row switch stays in front aisle");

  const squadCrossRoute = routeToSeat(roomChairs["squad:0"], "squad:0", "squad:4", chairPos);
  assert.equal(squadCrossRoute.length, 1);
  assert.equal(hasDoorDetour(squadCrossRoute[0].points), false);
  assert.equal(
    squadCrossRoute[0].points.some((p) => p.x === 17.5),
    true,
    "front-to-back switch in 6-seat room uses internal side aisle",
  );
});
