import assert from "node:assert/strict";
import test from "node:test";
import { canWalk, deliveryRoutePoint, routeForDelivery } from "../lib/cafe-world.mjs";

const seats = {
  "hall:0": { x: 25.864583333333332, y: 21.740625 },
  "hall:87": { x: 79.86458333333333, y: 68.51796875 },
  "solo:0": { x: 53.1, y: 74 },
  "duo:1": { x: 65.2, y: 70 },
  "team:4": { x: 84.6, y: 68 },
  "squad:0": { x: 32.8, y: 33 },
};
const chair = (seat) => seats[seat];

test("a delivery starts beside the counter and ends exactly at the requested chair", () => {
  for (const [seat, destination] of Object.entries(seats)) {
    const route = routeForDelivery(seat, chair);
    assert.ok(route, seat);
    const start = deliveryRoutePoint(route, 0);
    const end = deliveryRoutePoint(route, 1);
    assert.equal(start.space, "hall");
    assert.ok(canWalk(start.x, start.y), "the attendant emerges onto a walkable hall point");
    assert.equal(end.space, seat.split(":")[0]);
    assert.ok(Math.abs(end.x - destination.x) < 1e-8);
    assert.ok(Math.abs(end.y - destination.y) < 1e-8);
  }
  assert.equal(routeForDelivery("unknown", chair), null);
});

test("return follows the same room entrance and hall waypoints in reverse", () => {
  const route = routeForDelivery("duo:1", chair);
  assert.deepEqual([...new Set(route.segments.map(({ space }) => space))], ["hall", "duo"]);
  for (const progress of [0, .14, .35, .61, .83, 1]) {
    const outward = deliveryRoutePoint(route, 1 - progress);
    const returning = deliveryRoutePoint(route, progress, true);
    assert.deepEqual(returning, { ...outward, facing: -outward.facing });
  }
});
