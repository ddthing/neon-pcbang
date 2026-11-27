import "./app.js";
import { deliveryRoutePoint, routeForDelivery } from "./world.js";
import { setFoodPixel } from "./food-pixels.js";
import { createClerkSprite } from "./avatar-sprites.js";
import { WORLD, seatFor, toPercent } from "./cafe-map.mjs";

const scene = document.querySelector(".scene");
const clerk = document.getElementById("cafe-delivery-clerk");
const clerkBody = clerk.querySelector(".cafe-clerk-body");
const trayLayer = document.getElementById("cafe-delivery-trays");
const motion = matchMedia("(prefers-reduced-motion: reduce)");
const seating = window.cafeSeating;
const paintedTrays = new Map();
const clearingOrders = new Set();
const carryTray = document.createElement("div");
carryTray.className = "cafe-carry-tray";
carryTray.hidden = true;
carryTray.setAttribute("aria-hidden", "true");
trayLayer.append(carryTray);
let requestedArrival = null;
let confirmedArrival = null;
let biteTimer = 0;

let trip = null;
let route = null;
let trays = [];
let seenTrays;
let clockOffset = 0;
let elapsed = 0;
let frame = 0;
let wake = 0;

function currentSpace() {
  return scene.dataset.space === "lobby" ? "hall" : scene.dataset.space;
}

function servicePosition(key) {
  const seat = seatFor(key);
  return seat && toPercent(seat.stand);
}

function fillCarryTray(foods = []) {
  carryTray.replaceChildren(...foods.slice(0, 3).map(id => {
    const sprite = document.createElement("i");
    sprite.className = "pixel-snack-icon";
    setFoodPixel(sprite, id);
    return sprite;
  }));
}

function placeCarryTray(point, key, reach = 0, handHeight = 14) {
  if (!trip || trip.canServe === false) return;
  const world = window.cafeArt;
  const target = reach && seating.trayPosition(key);
  const x = point.x - (point.facing || 1) * (8 / WORLD.width * 100);
  const y = point.y - (handHeight / WORLD.height * 100);
  const position = target ? { x: x + (target.x - x) * reach, y: y + (target.y - y) * reach } : { x, y };
  const snapped = world?.place(position) ?? position;
  carryTray.style.left = snapped.x + "%";
  carryTray.style.top = snapped.y + "%";
  carryTray.hidden = false;
}

function createTray(entry, point, arriving) {
  const isMine = !seating.phase() && seating.current() === entry.seat;
  const node = document.createElement(isMine ? "button" : "div");
  if (isMine) node.type = "button";
  node.className = "cafe-world-tray" + (isMine ? " is-mine" : "") + (entry.giftFrom ? " is-gift" : "");
  node.classList.toggle("is-arriving", arriving);
  const summary = entry.items.map(({ name, count }) => `${name} ${count}개`).join(", ");
  node.setAttribute("aria-label", (isMine ? "클릭해서 먹기: " : "쟁반에 도착한 음식: ") + summary);
  if (isMine) {
    node.title = (entry.giftFrom ? `🎁 ${entry.giftFrom}님의 선물! ` : "") + `${summary} · 클릭해서 맛있게 먹기!`;
  }
  node.style.setProperty("--tray-x", point.x + "%");
  node.style.setProperty("--tray-y", point.y + "%");
  node.style.setProperty("--food-columns", Math.min(3, entry.items.length));

  if (entry.giftFrom) {
    const ribbon = document.createElement("em");
    ribbon.className = "tray-gift-tag";
    ribbon.textContent = "🎁";
    node.append(ribbon);
  }

  for (const item of entry.items.slice(0, 6)) {
    const cell = document.createElement("span");
    const sprite = document.createElement("i");
    sprite.className = "pixel-snack-icon";
    setFoodPixel(sprite, item.id);
    cell.append(sprite);
    if (item.count > 1) {
      const count = document.createElement("small");
      count.setAttribute("aria-hidden", "true");
      count.textContent = "×" + item.count;
      cell.append(count);
    }
    node.append(cell);
  }

  if (isMine) {
    let bitesLeft = Math.min(3, Math.max(2, entry.items.reduce((s, i) => s + i.count, 0)));
    node.addEventListener("click", async (event) => {
      event.stopPropagation();
      bitesLeft--;
      window.cafeAudioPlay?.("eat");
      window.cafeWorld?.setActivity("eat");
      clearTimeout(biteTimer);
      biteTimer = setTimeout(() => window.cafeWorld?.clearActivity("eat"), 1000);
      node.classList.remove("is-biting");
      void node.offsetWidth;
      node.classList.add("is-biting");
      if (bitesLeft > 0) {
        document.querySelector(".u070")?.dispatchEvent(new CustomEvent("pcbang-notice", {
          detail: { message: `냠냠! 맛있게 먹는 중… (${bitesLeft}입 남음)`, kind: "info" },
        }));
        return;
      }
      // Finished eating! Claim +15G and clear tray
      node.disabled = true;
      clearingOrders.add(entry.key);
      const eaten = entry.id && await window.cafeEatOrder?.(entry.id);
      if (eaten) {
        node.remove();
        paintedTrays.delete(entry.key);
        trays = trays.filter((t) => t.key !== entry.key);
        window.cafeWorld?.syncNow();
      } else {
        clearingOrders.delete(entry.key);
        bitesLeft = 1;
        node.disabled = false;
        renderTrays();
      }
    });
  }
  return node;
}

function renderTrays(arrivals = new Set()) {
  const space = currentSpace();
  const bySeat = new Map();
  for (const entry of trays) {
    if (space !== "hall" || !seatFor(entry.seat) || !entry.items.length || clearingOrders.has(entry.key)) continue;
    const previous = bySeat.get(entry.seat);
    if (!previous || entry.readyAt > previous.readyAt) bySeat.set(entry.seat, entry);
  }
  const keys = new Set([...bySeat.values()].map(({ key }) => key));
  for (const [key, node] of paintedTrays) {
    if (keys.has(key)) continue;
    node.remove();
    paintedTrays.delete(key);
  }
  for (const entry of bySeat.values()) {
    if (paintedTrays.has(entry.key)) continue;
    const point = seating.trayPosition(entry.seat);
    if (!point) continue;
    const node = createTray(entry, point, arrivals.has(entry.key));
    paintedTrays.set(entry.key, node);
    trayLayer.append(node);
    if (arrivals.has(entry.key) && entry.giftFrom && !seating.phase() && seating.current() === entry.seat) {
      window.cafeAudioPlay?.("chime");
      const note = entry.giftNote ? ` "${entry.giftNote}"` : "";
      document.querySelector(".u070")?.dispatchEvent(new CustomEvent("pcbang-notice", {
        detail: { message: `🎁 ${entry.giftFrom}님이 간식을 쐈어요!${note} (책상 쟁반을 눌러 먹기)`, kind: "ok" },
      }));
    }
  }
}

function stopPlayback() {
  cancelAnimationFrame(frame);
  clearTimeout(wake);
  frame = wake = 0;
}

// Live sprite-sheet Cat Clerk stands behind the counter (idle / cooking) or walks out with a tray
function renderStationedClerk(mode = "idle") {
  const inHall = currentSpace() === "hall";
  clerk.hidden = !inHall;
  if (!inHall) return;
  clerk.dataset.mode = mode;
  clerk.removeAttribute("data-carrying");
  const point = window.cafeArt?.kitchenClerk ?? { x: 11.9, y: 73.2 };
  clerk.style.setProperty("--clerk-x", point.x + "%");
  clerk.style.setProperty("--clerk-y", point.y + "%");
  clerk.style.setProperty("--clerk-facing", "1");
  clerk.style.setProperty("--clerk-opacity", "1");
  clerk.style.zIndex = window.cafeArt ? String(Math.round(point.y * 10)) : "1";
}

function paintTrip() {
  frame = wake = 0;
  carryTray.hidden = true;
  if (document.hidden) return;
  const inHall = currentSpace() === "hall";

  if (!trip || !route) {
    renderStationedClerk("idle");
    return;
  }
  const now = Date.now() + clockOffset;
  elapsed = Math.max(elapsed, now - trip.startAt);
  const time = trip.startAt + elapsed;
  if (time >= trip.returnAt) {
    renderStationedClerk("idle");
    return;
  }
  if (time < trip.startAt) {
    const remaining = trip.startAt - time;
    const mode = remaining > 720 || motion.matches ? "cook" : remaining > 300 ? "plate" : "lift";
    renderStationedClerk(mode);
    if (inHall && mode !== "cook") {
      const point = window.cafeArt?.kitchenClerk ?? { x: 11.9, y: 73.2 };
      placeCarryTray(point, trip.seat, 0, mode === "lift" ? 16 : 14);
    }
    wake = setTimeout(paintTrip, Math.min(80, remaining));
    return;
  }
  const returning = time >= trip.readyAt;
  if (returning && trip.canServe !== false && confirmedArrival !== trip.key) {
    const destination = deliveryRoutePoint(route, 1);
    if (destination.space === currentSpace()) placeCarryTray(destination, trip.seat, 1);
    if (requestedArrival !== trip.key) {
      requestedArrival = trip.key;
      window.cafeWorld?.syncNow();
    }
  }
  if (motion.matches) {
    renderStationedClerk("idle");
    wake = setTimeout(paintTrip, (returning ? trip.returnAt : trip.readyAt) - time);
    return;
  }
  const serveMs = Math.min(480, (trip.readyAt - trip.startAt) / 3);
  const serving = !returning && trip.readyAt - time <= serveMs && trip.canServe !== false;
  const progress = returning
    ? (time - trip.readyAt) / (trip.returnAt - trip.readyAt)
    : elapsed / (trip.readyAt - trip.startAt - (trip.canServe === false ? 0 : serveMs));
  let point = deliveryRoutePoint(route, progress, returning);
  const kitchen = window.cafeArt?.kitchenClerk;
  if (kitchen && !returning && elapsed < 650 && point.space === "hall") {
    const lift = elapsed / 650;
    // Leave the open right end of the counter before joining the aisle.
    point = { ...point, x: kitchen.x + (point.x - kitchen.x) * Math.min(1, lift * 1.8),
      y: kitchen.y + (point.y - kitchen.y) * Math.max(0, lift * 2 - 1) };
  }
  if (serving) {
    const target = seating.trayPosition(trip.seat);
    if (target) point.facing = target.x < point.x ? 1 : -1;
  }
  clerk.hidden = point.space !== currentSpace();
  if (!clerk.hidden) {
    clerk.dataset.mode = returning ? "walk-return" : serving ? "serve" : "walk-tray";
    const placement = window.cafeArt?.place(point) ?? point;
    clerk.style.setProperty("--clerk-x", placement.x + "%");
    clerk.style.setProperty("--clerk-y", placement.y + "%");
    clerk.style.setProperty("--clerk-facing", String(point.facing || 1));
    clerk.style.setProperty("--clerk-opacity", String(Math.min(1, (trip.returnAt - time) / 180)));
    clerk.style.zIndex = String(Math.max(2, Math.round(point.y * (window.cafeArt ? 10 : 1))));
    clerk.toggleAttribute("data-carrying", !returning);
    if (!returning) {
      const reach = serving ? Math.max(0, Math.min(1, Math.floor((1 - (trip.readyAt - time) / serveMs) * 5) / 4)) : 0;
      placeCarryTray(point, trip.seat, reach);
    }
  }
  frame = requestAnimationFrame(paintTrip);
}

function refreshPlayback() {
  stopPlayback();
  paintTrip();
}

clerkBody.append(createClerkSprite());
if (window.cafeArt) document.getElementById("cafe-avatars").append(clerk);

document.addEventListener("cafe-delivery-sync", ({ detail }) => {
  const next = detail.delivery;
  clockOffset = detail.now - Date.now();
  if (next?.key !== trip?.key) {
    route = next ? routeForDelivery(next.seat, servicePosition) : null;
    elapsed = -Infinity;
    requestedArrival = null;
    fillCarryTray(next?.foods);
  }
  trip = next;
  trays = detail.trays;
  for (const key of clearingOrders) {
    if (!trays.some(entry => entry.key === key)) clearingOrders.delete(key);
  }
  if (trip && trays.some(entry => entry.key === trip.key)) confirmedArrival = trip.key;
  const arrivals = new Set(trays.filter(({ key, readyAt }) =>
    seenTrays && !seenTrays.has(key) && detail.now - readyAt < 3200).map(({ key }) => key));
  seenTrays = new Set(trays.map(({ key }) => key));
  renderTrays(arrivals);
  refreshPlayback();
});
document.addEventListener("cafe-seat-phase", () => {
  paintedTrays.forEach((node) => node.remove());
  paintedTrays.clear();
  renderTrays();
  refreshPlayback();
});
document.addEventListener("visibilitychange", refreshPlayback);
motion.addEventListener("change", refreshPlayback);
refreshPlayback();
