import { deliveryRoutePoint, routeForDelivery } from "./world.js";

const scene = document.querySelector(".scene");
const emptyCounter = document.getElementById("cafe-empty-counter");
const clerk = document.getElementById("cafe-delivery-clerk");
const sprite = clerk.querySelector("img");
const trayLayer = document.getElementById("cafe-delivery-trays");
const motion = matchMedia("(prefers-reduced-motion: reduce)");
const seating = window.cafeSeating;
const paintedTrays = new Map();
const food = {
  ramyeon: ["컵라면", '<path fill="#bb654e" d="M3 12h18l-2 9H5z"/><path fill="#f4d59a" d="M5 11h14v3H5zM6 8h2v3H6zm4-1h2v4h-2zm4 1h2v3h-2zm4-2h2v5h-2z"/>'],
  rice: ["김치볶음밥", '<path fill="#778f72" d="M2 14h20v3H2zm3 3h14v3H5z"/><path fill="#eee3c8" d="M5 8h14v4h2v3H3v-3h2z"/><path fill="#bb6b56" d="M9 9h2v2H9zm4-2h3v2h-3zm2 4h3v2h-3z"/>'],
  dumplings: ["군만두", '<path fill="#d6a060" d="M3 17h2v-4h2v-3h3V8h5v2h3v3h2v4h2v3H2v-3z"/><path fill="#f4d9a5" d="M6 14h3v2H6zm6-4h3v2h-3zm4 5h3v2h-3z"/>'],
  skewer: ["소떡소떡", '<path fill="#f1d8ad" d="M11 3h2v18h-2z"/><path fill="#c46c54" d="M7 7h10v3H7zm-1 5h12v3H6zm1 5h10v3H7z"/><path fill="#dfa35e" d="M7 12h10v2H7z"/>'],
  fries: ["감자튀김", '<path fill="#b8644a" d="M4 9h16l-2 13H6z"/><path fill="#f0c15d" d="M6 3h3v9H6zm5-2h3v11h-3zm5 3h3v8h-3z"/>'],
  toast: ["버터 토스트", '<path fill="#ce9353" d="M5 5h3V3h8v2h3v15H5z"/><path fill="#f2d499" d="M8 7h8v10H8z"/><path fill="#fff0cc" d="M10 8h4v2h-4z"/>'],
  cola: ["캔콜라", '<path fill="#bb6551" d="M8 2h8v2h2v16h-2v2H8v-2H6V4h2z"/><path fill="#f1ddb2" d="M8 9h8v6H8z"/>'],
  tea: ["아이스티", '<path fill="#8b715e" d="M7 2h10v2h2v16h-2v2H7v-2H5V4h2z"/><path fill="#e6be70" d="M7 8h10v8H7z"/><path fill="#d8e3cb" d="M9 10h2v2H9zm5 3h2v2h-2z"/>'],
  coffee: ["아메리카노", '<path fill="#ded0ad" d="M5 5h13v2h3v8h-3v3H5z"/><path fill="#8d5d49" d="M7 8h9v5H7z"/><path fill="#ded0ad" d="M18 9h1v4h-1zm3 2h1v4h-1zm-7 8h3v2h-3z"/>'],
  "corner-ade": ["단골 복숭아 에이드", '<path fill="#f0d69c" d="M7 5h10v2h2v13h-2v2H7v-2H5V7h2z"/><path fill="#e8a87c" d="M7 11h10v7H7z"/><path fill="#95aa87" d="M14 2h2v5h-2z"/>'],
};
const foodByName = new Map(Object.values(food));
const fallbackFood = '<path fill="#b4c2a7" d="M4 9h16v3H4zm2 3h12v7H6zm4-7h4v4h-4z"/>';
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

function createTray(entry, point, arriving) {
  const node = document.createElement("div");
  node.className = "cafe-world-tray";
  node.classList.toggle("is-arriving", arriving);
  node.setAttribute("role", "img");
  node.setAttribute("aria-label", "쟁반에 도착한 음식 " + entry.items.map(({ name, count }) => `${name} ${count}개`).join(", "));
  const [space, index] = entry.seat.split(":");
  const offset = space === "hall" ? (Number(index) % 2 ? -3.2 : 3.2) : 1;
  node.style.setProperty("--tray-x", (point.x + offset) + "%");
  node.style.setProperty("--tray-y", (point.y - 3.6) + "%");
  node.style.setProperty("--food-columns", Math.min(3, entry.items.length));
  for (const item of entry.items.slice(0, 6)) {
    const cell = document.createElement("span");
    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    icon.setAttribute("viewBox", "0 0 24 24");
    icon.setAttribute("aria-hidden", "true");
    icon.innerHTML = (Object.hasOwn(food, item.id) ? food[item.id][1] : foodByName.get(item.name)) ?? fallbackFood;
    cell.append(icon);
    if (item.count > 1) {
      const count = document.createElement("small");
      count.setAttribute("aria-hidden", "true");
      count.textContent = "×" + item.count;
      cell.append(count);
    }
    node.append(cell);
  }
  return node;
}

function renderTrays(arrivals = new Set()) {
  const space = currentSpace();
  const bySeat = new Map();
  for (const entry of trays) {
    if (!entry.seat.startsWith(space + ":") || !entry.items.length) continue;
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
    const point = seating.position(entry.seat);
    if (!point) continue;
    const node = createTray(entry, point, arrivals.has(entry.key));
    paintedTrays.set(entry.key, node);
    trayLayer.append(node);
  }
}

function stopPlayback() {
  cancelAnimationFrame(frame);
  clearTimeout(wake);
  frame = wake = 0;
}

function setAway(away) {
  const hidden = !away || currentSpace() !== "hall";
  if (emptyCounter.hidden !== hidden) emptyCounter.hidden = hidden;
  scene.toggleAttribute("data-clerk-away", away);
}

function paintTrip() {
  frame = wake = 0;
  if (document.hidden) return;
  if (!trip || !route || !emptyCounter.naturalWidth || !sprite.naturalWidth) {
    setAway(false);
    clerk.hidden = true;
    return;
  }
  const now = Date.now() + clockOffset;
  elapsed = Math.max(elapsed, now - trip.startAt);
  const time = trip.startAt + elapsed;
  if (time >= trip.returnAt) {
    setAway(false);
    clerk.hidden = true;
    return;
  }
  if (time < trip.startAt) {
    setAway(false);
    clerk.hidden = true;
    wake = setTimeout(paintTrip, trip.startAt - time);
    return;
  }
  setAway(true);
  if (motion.matches) {
    clerk.hidden = true;
    wake = setTimeout(paintTrip, trip.returnAt - time);
    return;
  }
  const returning = time >= trip.readyAt;
  const progress = returning
    ? (time - trip.readyAt) / (trip.returnAt - trip.readyAt)
    : elapsed / (trip.readyAt - trip.startAt);
  const point = deliveryRoutePoint(route, progress, returning);
  clerk.hidden = point.space !== currentSpace();
  if (!clerk.hidden) {
    clerk.style.setProperty("--clerk-x", point.x + "%");
    clerk.style.setProperty("--clerk-y", point.y + "%");
    clerk.style.setProperty("--clerk-facing", point.facing);
    clerk.style.setProperty("--clerk-opacity", Math.min(1, elapsed / 220, (trip.returnAt - time) / 220));
    clerk.toggleAttribute("data-carrying", !returning);
  }
  frame = requestAnimationFrame(paintTrip);
}

function refreshPlayback() {
  stopPlayback();
  paintTrip();
}

document.addEventListener("cafe-delivery-sync", ({ detail }) => {
  const next = detail.delivery;
  clockOffset = detail.now - Date.now();
  if (next?.key !== trip?.key) {
    route = next ? routeForDelivery(next.seat, seating.position) : null;
    elapsed = -Infinity;
  }
  trip = next;
  trays = detail.trays;
  const arrivals = new Set(trays.filter(({ key, readyAt }) =>
    seenTrays && !seenTrays.has(key) && detail.now - readyAt < 3200).map(({ key }) => key));
  seenTrays = new Set(trays.map(({ key }) => key));
  renderTrays(arrivals);
  refreshPlayback();
});
document.addEventListener("cafe-seat-phase", () => {
  renderTrays();
  refreshPlayback();
});
document.addEventListener("visibilitychange", refreshPlayback);
motion.addEventListener("change", refreshPlayback);
emptyCounter.addEventListener("load", refreshPlayback);
sprite.addEventListener("load", refreshPlayback);
