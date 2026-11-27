import assert from "node:assert/strict";
import test from "node:test";
import { canWalk, clearSegmentInSpace, deliveryRoutePoint, routeForDelivery } from "../lib/cafe-world.mjs";
import { COUNTER_EXIT, SEATS, seatFor, toPercent } from "../lib/cafe-map.mjs";

const stop = (key) => {
  const seat = seatFor(key);
  return seat && toPercent(seat.stand);
};

test("the attendant starts at the counter and stops beside each of the 67 chairs", () => {
  for (const { key } of SEATS) {
    const route = routeForDelivery(key, stop);
    assert.ok(route, key);
    const start = deliveryRoutePoint(route, 0);
    const end = deliveryRoutePoint(route, 1);
    assert.equal(start.space, "hall");
    assert.ok(canWalk(start.x, start.y), "the attendant emerges onto a walkable point");
    assert.deepEqual({ x: start.x, y: start.y }, toPercent(COUNTER_EXIT));
    assert.equal(end.space, "hall");
    const destination = stop(key);
    assert.ok(Math.hypot(end.x - destination.x, end.y - destination.y) < 1e-8, key);
    for (const { from, to, space } of route.segments) {
      assert.equal(clearSegmentInSpace(from, to, space), true, key);
    }
  }
  assert.equal(routeForDelivery("unknown", stop), null);
});

test("return follows the same room entrance and hall waypoints in reverse", () => {
  const route = routeForDelivery("duo:1", stop);
  assert.deepEqual([...new Set(route.segments.map(({ space }) => space))], ["hall"]);
  for (const progress of [0, .14, .35, .61, .83, 1]) {
    const outward = deliveryRoutePoint(route, 1 - progress);
    const returning = deliveryRoutePoint(route, progress, true);
    assert.deepEqual(returning, { ...outward, facing: -outward.facing });
  }
});
