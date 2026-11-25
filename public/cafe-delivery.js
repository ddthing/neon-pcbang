import { deliveryRoutePoint, routeForDelivery } from "./world.js";

const scene = document.querySelector(".scene");
const clerk = document.getElementById("cafe-delivery-clerk");
const clerkBody = clerk.querySelector(".cafe-clerk-body");
const trayLayer = document.getElementById("cafe-delivery-trays");
const motion = matchMedia("(prefers-reduced-motion: reduce)");
const seating = window.cafeSeating;
const paintedTrays = new Map();

// Exact sprite indices in snacks-atlas.png (6 cols x 4 rows of 24x24)
export const SNACK_SPRITE_INDEX = {
  jjagyechi: 0, rabokki: 1, spammayo: 2, chickenmayo: 3, ramyeon: 4, rice: 5,
  dumplings: 6, curry: 7, skewer: 8, hotdog: 9, tornado: 10, cheeseball: 11,
  menbosha: 12, fries: 13, toast: 14, bungeoppang: 15, eolbaksa: 16, ashatchu: 17,
  tea: 18, cola: 19, misutgaru: 20, beads: 21, coffee: 22, "corner-ade": 23,
};

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

function setSnackSpritePos(el, itemId) {
  const idx = SNACK_SPRITE_INDEX[itemId] ?? 4;
  const col = idx % 6;
  const row = Math.floor(idx / 6);
  el.style.setProperty("--snack-x", (col * 20) + "%");
  el.style.setProperty("--snack-y", (row * 33.3333) + "%");
}

function createTray(entry, point, arriving) {
  const isMine = seating.current() === entry.seat;
  const node = document.createElement(isMine ? "button" : "div");
  if (isMine) node.type = "button";
  node.className = "cafe-world-tray" + (isMine ? " is-mine" : "") + (entry.giftFrom ? " is-gift" : "");
  node.classList.toggle("is-arriving", arriving);
  const summary = entry.items.map(({ name, count }) => `${name} ${count}개`).join(", ");
  node.setAttribute("aria-label", (isMine ? "클릭해서 먹기: " : "쟁반에 도착한 음식: ") + summary);
  if (isMine) {
    node.title = (entry.giftFrom ? `🎁 ${entry.giftFrom}님의 선물! ` : "") + `${summary} · 클릭해서 맛있게 먹기!`;
  }
  const [space, index] = entry.seat.split(":");
  const offset = space === "hall" ? (Number(index) % 2 ? -3.2 : 3.2) : 1;
  node.style.setProperty("--tray-x", (point.x + offset) + "%");
  node.style.setProperty("--tray-y", (point.y - 3.6) + "%");
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
    setSnackSpritePos(sprite, item.id);
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
    node.addEventListener("click", (event) => {
      event.stopPropagation();
      bitesLeft--;
      window.cafeAudioPlay?.("eat");
      window.cafeWorld?.setActivity("eat");
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
      setTimeout(() => window.cafeWorld?.setActivity(""), 1800);
      if (entry.id) {
        window.cafeEatOrder?.(entry.id);
      }
      node.remove();
      paintedTrays.delete(entry.key);
      trays = trays.filter((t) => t.key !== entry.key);
    });
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

// Live sprite-sheet Cat Clerk stands behind the counter (idle / cooking) or walks out with a tray
function renderStationedClerk(mode = "idle") {
  const inHall = currentSpace() === "hall";
  clerk.hidden = !inHall;
  if (!inHall) return;
  clerk.dataset.mode = mode; // "idle" | "cook"
  clerk.removeAttribute("data-carrying");
  clerk.style.setProperty("--clerk-x", "11.9%");
  clerk.style.setProperty("--clerk-y", "73.2%");
  clerk.style.setProperty("--clerk-facing", "1");
  clerk.style.setProperty("--clerk-opacity", "1");
  clerk.style.zIndex = "1";
}

function paintTrip() {
  frame = wake = 0;
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
    // Open-Kitchen Cooking Phase right before departure!
    renderStationedClerk("cook");
    wake = setTimeout(paintTrip, Math.min(250, trip.startAt - time));
    return;
  }
  if (motion.matches) {
    renderStationedClerk("idle");
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
    clerk.dataset.mode = returning ? "walk-return" : "walk-tray";
    clerk.style.setProperty("--clerk-x", point.x + "%");
    clerk.style.setProperty("--clerk-y", point.y + "%");
    clerk.style.setProperty("--clerk-facing", String(point.facing || 1));
    clerk.style.setProperty("--clerk-opacity", String(Math.min(1, elapsed / 180, (trip.returnAt - time) / 180)));
    clerk.style.zIndex = String(Math.max(2, Math.round(point.y)));
    clerk.toggleAttribute("data-carrying", !returning);
  }
  frame = requestAnimationFrame(paintTrip);
}

function refreshPlayback() {
  stopPlayback();
  paintTrip();
}

// Upgrade clerk markup to use our 4x4 pixel sprite sheet
clerkBody.innerHTML = `<span class="cafe-clerk-sprite" aria-hidden="true"></span>`;

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
  if (arrivals.size) {
    for (const entry of trays) {
      if (arrivals.has(entry.key) && entry.seat === seating.current() && entry.giftFrom) {
        window.cafeAudioPlay?.("chime");
        document.querySelector(".u070")?.dispatchEvent(new CustomEvent("pcbang-notice", {
          detail: {
            message: `🎁 ${entry.giftFrom}님이 [${entry.items.map((i) => i.name).join(", ")}] 선물을 보냈어요!${entry.giftNote ? ` "${entry.giftNote}"` : ""}`,
            kind: "ok",
          },
        }));
      }
    }
  }
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
