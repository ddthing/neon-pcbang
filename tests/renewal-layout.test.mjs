import assert from "node:assert/strict";
import test from "node:test";
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
  rectContains,
  rectsOverlap,
} from "../lib/renewal-layout.mjs";

test("preserves existing seat keys and defines every required anchor", () => {
  assert.deepEqual(Object.keys(SEATS), ["hall:0", "hall:1", "solo:0"]);
  assert.equal(CHARACTER_SPEC.standingHeight >= 30 && CHARACTER_SPEC.standingHeight <= 34, true);
  assert.equal(CHARACTER_SPEC.headWidth >= 14 && CHARACTER_SPEC.headWidth <= 17, true);
  for (const seat of SEAT_LIST) {
    assert.ok(seat.approachPoint);
    assert.ok(seat.cushionAnchor);
    assert.ok(seat.keyboardAnchor);
    assert.ok(seat.standPoint);
    assert.ok(seat.deliveryStop);
    assert.ok(seat.trayAnchor);
    assert.equal(
      isFootWalkable(seat.approachPoint.x, seat.approachPoint.y),
      true,
      `${seat.key} approachPoint must be walkable`,
    );
    assert.equal(
      isFootWalkable(seat.standPoint.x, seat.standPoint.y),
      true,
      `${seat.key} standPoint must be walkable`,
    );
    assert.equal(
      isFootWalkable(seat.deliveryStop.x, seat.deliveryStop.y),
      true,
      `${seat.key} deliveryStop must be walkable`,
    );
  }
});

test("character footBox passes cleanly through entrance and solo room thresholds", () => {
  for (const door of DOORS) {
    assert.equal(door.clearWidth >= 26 && door.clearWidth <= 32, true, `${door.id} clearWidth`);
    assert.equal(door.doorHeight >= 42 && door.doorHeight <= 48, true, `${door.id} doorHeight`);
    assert.equal(
      isFootWalkable(door.threshold.cx, door.threshold.cy),
      true,
      `${door.id} threshold center must be walkable`,
    );
    assert.equal(
      isSegmentWalkable(door.approachPoint, door.landingPoint),
      true,
      `${door.id} approach -> landing must be continuously walkable`,
    );
  }
  assert.equal(getZoneAt(DOORS[0].approachPoint.x, DOORS[0].approachPoint.y), "exterior");
  assert.equal(getZoneAt(DOORS[0].landingPoint.x, DOORS[0].landingPoint.y), "hall");
  assert.equal(getZoneAt(DOORS[1].landingPoint.x, DOORS[1].landingPoint.y), "solo");
});

test("aisle widths meet draft clearance minimums and hold no colliding obstacles", () => {
  const lobby = AISLES.find((a) => a.id === "main-lobby");
  assert.ok(lobby.clearWidth >= 48);
  for (const aisleId of ["hall-aisle-left", "hall-aisle-right"]) {
    const aisle = AISLES.find((a) => a.id === aisleId);
    assert.ok(aisle.clearWidth >= 32 && aisle.clearWidth <= 40, `${aisleId} width`);
    const midX = aisle.rect.x + aisle.rect.width / 2;
    const midY = aisle.rect.y + aisle.rect.height / 2;
    assert.equal(isFootWalkable(midX, midY), true, `${aisleId} center must be walkable`);
  }
});

test("walls, kiosk, plants, bay spine, desks, and chairs block foot collision", () => {
  const kiosk = FURNITURE.find((f) => f.id === "kiosk");
  assert.equal(isFootWalkable(kiosk.anchor.x, kiosk.anchor.y - 6), false);
  assert.equal(isFootWalkable(kiosk.interactPoint.x, kiosk.interactPoint.y), true);

  // Solid north wall between interior and outer top border blocks walking
  assert.equal(isFootWalkable(300, 12), false);
  // Solo room partition wall (off-door) blocks walking
  assert.equal(isFootWalkable(72, 202), false);

  for (const seat of SEAT_LIST) {
    assert.equal(
      isFootWalkable(seat.deskRect.x + seat.deskRect.width / 2, seat.deskRect.y + seat.deskRect.height / 2),
      false,
      `${seat.key} desk must block feet`,
    );
    assert.equal(
      isFootWalkable(seat.cushionAnchor.x, seat.cushionAnchor.y),
      false,
      `${seat.key} occupied chair must block casual walk-through`,
    );
  }
});

test("pathfinding links exterior -> entrance -> kiosk -> hall seats -> solo room without wall clipping", () => {
  const entrance = DOORS.find((d) => d.id === "entrance");
  const kiosk = FURNITURE.find((f) => f.id === "kiosk");

  const targets = [
    [entrance.approachPoint, entrance.landingPoint, "exterior -> hall"],
    [entrance.landingPoint, kiosk.interactPoint, "hall -> kiosk"],
    [kiosk.interactPoint, SEATS["hall:0"].approachPoint, "kiosk -> hall:0"],
    [SEATS["hall:0"].standPoint, SEATS["hall:1"].approachPoint, "hall:0 -> hall:1"],
    [SEATS["hall:1"].standPoint, SEATS["solo:0"].approachPoint, "hall:1 -> solo:0"],
  ];

  for (const [from, to, label] of targets) {
    const path = findPath(from, to);
    assert.ok(path.length > 0, `expected valid path for ${label}`);
    let prev = from;
    for (const pt of path) {
      assert.equal(isSegmentWalkable(prev, pt), true, `segment clipped collision in ${label}`);
      prev = pt;
    }
    assert.ok(Math.hypot(prev.x - to.x, prev.y - to.y) <= 0.1, `${label} reached goal`);
  }
});

test("planSeatApproach stands up to standPoint before moving to another seat", () => {
  const plan = planSeatApproach(SEATS["hall:0"].cushionAnchor, "hall:0", "solo:0");
  assert.ok(plan);
  assert.equal(plan.standFirst, true);
  assert.deepEqual(plan.standPoint, SEATS["hall:0"].standPoint);
  assert.equal(plan.targetSeatKey, "solo:0");
  assert.equal(plan.facing, "up");
  assert.ok(plan.walkPoints.length >= 2);
});

test("delivery trays stay inside their desk top without overlapping monitor or chair cushion", () => {
  for (const seat of SEAT_LIST) {
    assert.equal(
      rectContains(seat.deskRect, seat.trayAnchor),
      true,
      `${seat.key} trayAnchor must sit inside deskRect`,
    );
    assert.equal(
      rectsOverlap(seat.monitorRect, seat.trayAnchor),
      false,
      `${seat.key} trayAnchor must not overlap monitorRect`,
    );
    const footAtCushion = getFootBox(seat.cushionAnchor.x, seat.cushionAnchor.y);
    assert.equal(
      rectsOverlap(footAtCushion, seat.trayAnchor),
      false,
      `${seat.key} trayAnchor must not overlap seated cushion`,
    );
  }
});

test("seat map model exports exact zones, doors, aisles, and status keys from shared spec", () => {
  const map = buildSeatMapModel({ "hall:1": { name: "손님B" } }, "hall:0");
  assert.equal(map.world.width, WORLD_SPEC.width);
  assert.equal(map.world.height, WORLD_SPEC.height);
  assert.equal(map.zones.length, Object.keys(ZONES).length);
  assert.equal(map.doors.length, DOORS.length);
  assert.equal(map.aisles.length, AISLES.length);
  assert.equal(map.seats.find((s) => s.key === "hall:0")?.status, "mine");
  assert.equal(map.seats.find((s) => s.key === "hall:1")?.status, "occupied");
  assert.equal(map.seats.find((s) => s.key === "solo:0")?.status, "available");
});
