import { canWalk, entrance, kiosk, pathTo, routeToSeat, roomPortals } from "./world.js";
import { createCafeCamera } from "./camera.js";

const scene = document.querySelector(".scene");
const joystick = document.getElementById("cafe-joystick");
const avatars = document.getElementById("cafe-avatars");
const status = document.getElementById("cafe-connection");
const guests = document.getElementById("cafe-guests");
const nameInput = document.getElementById("cafe-name");
const seating = window.cafeSeating;
const camera = createCafeCamera(scene);
const palettes = ["#a6bdac", "#c3b0cc", "#ccb99c", "#9eb4c5"];
const directions = new Map([
  ["ArrowLeft", [-1, 0]], ["KeyA", [-1, 0]], ["ArrowRight", [1, 0]], ["KeyD", [1, 0]],
  ["ArrowUp", [0, -1]], ["KeyW", [0, -1]], ["ArrowDown", [0, 1]], ["KeyS", [0, 1]],
]);
const pressed = new Set();
let joystickPointer = null;
let joystickOrigin;
let joystickX = 0;
let joystickY = 0;
const visitors = new Map();

function read(storage, key) {
  try { return window[storage].getItem(key); } catch { return null; }
}
function save(storage, key, value) {
  try { window[storage].setItem(key, value); } catch { /* private browsing can disable storage */ }
}

const tokenKey = "neon-cafe-visitor";
const nameKey = "neon-cafe-nickname";
const token = read("sessionStorage", tokenKey) || crypto.randomUUID();
save("sessionStorage", tokenKey, token);
const arrival = parseInt(token.slice(1, 3), 16) % 8 || 0;
const spawn = { x: entrance.x - 8 + (arrival % 4) * 5.5, y: entrance.y + (arrival >= 4 ? 1.6 : 0) };
const location = { ...spawn };
const color = parseInt(token[0], 16) % palettes.length || 0;
let name = read("localStorage", nameKey) || "";
nameInput.value = name;
let facing = 1;
let path = [];
let waveUntil = 0;
let lastWave = 0;
let lastSeat = seating.current();
let peers = [];
let queue = Promise.resolve();
let connected = false;
let pendingSeatChanges = 0;
let pulseTimer;
let pulsing = false;
let journey;
let firstMove = true;
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

function displayedSpace() {
  return scene.dataset.space === "lobby" ? "hall" : scene.dataset.space;
}

function makeVisitor(key) {
  const node = document.createElement("div");
  node.className = "cafe-visitor";
  node.classList.toggle("mine", key === "mine");
  node.innerHTML = `<span class="cafe-wave" hidden>👋</span><span class="cafe-nickname"></span>
    <svg viewBox="0 0 16 22" aria-hidden="true" shape-rendering="crispEdges">
      <path fill="#302b2b" d="M5 0h6v1h2v2h1v7h-2v2h2v2h1v4h-2v3h-5v-2h-1v2H2v-3H1v-4h1v-2h2v-2H2V3h1V1h2z"/>
      <path fill="#615046" d="M5 1h6v1h2v5h-2V5H8v2H3V3h2z"/>
      <path fill="#e8c5a5" d="M4 7h4V5h3v2h2v3h-2v2H6v-1H4zM2 15h2v2H2zm10 0h2v2h-2z"/>
      <path fill="#3d3534" d="M9 7h1v2H9zm3 0h1v2h-1z"/>
      <path fill="var(--shirt)" d="M4 12h2v1h5v-1h2v2h1v1h-2v3H4v-3H2v-1h2z"/>
      <path fill="#5a5252" d="M4 18h3v2H3v-1h1zm5 0h3v1h1v1H9z"/>
    </svg>`;
  avatars.append(node);
  const visitor = { node, label: node.querySelector(".cafe-nickname"), wave: node.querySelector(".cafe-wave") };
  visitors.set(key, visitor);
  return visitor;
}

function paint(key, data, point, walking) {
  const sprite = visitors.get(key) || makeVisitor(key);
  const { node, label, wave } = sprite;
  const moved = point.x !== sprite.x || point.y !== sprite.y;
  if (key !== "mine" && moved && sprite.x !== undefined && !data.seat) {
    node.classList.add("walking");
    clearTimeout(sprite.stopWalking);
    sprite.stopWalking = setTimeout(() => node.classList.remove("walking"), 850);
  }
  if (moved) {
    sprite.x = point.x;
    sprite.y = point.y;
    node.style.left = point.x + "%";
    node.style.top = point.y + "%";
    node.style.zIndex = String(Math.round(point.y));
  }
  if (sprite.color !== data.color) node.style.setProperty("--shirt", palettes[data.color] || palettes[0]);
  if (sprite.facing !== data.facing) node.style.setProperty("--facing", data.facing);
  sprite.color = data.color;
  sprite.facing = data.facing;
  if (key === "mine" || data.seat) node.classList.toggle("walking", walking);
  node.classList.toggle("seated", Boolean(data.seat));
  const regular = key === "mine" && window.cafeIsRegular();
  if (sprite.name !== data.name || sprite.regular !== regular) {
    sprite.name = data.name;
    sprite.regular = regular;
    label.textContent = data.name;
    if (regular) {
      const star = document.createElement("span");
      star.className = "regular-star";
      star.textContent = " ★";
      label.append(star);
    }
  }
  if (sprite.waveUntil !== data.waveUntil) {
    clearTimeout(sprite.hideWave);
    sprite.waveUntil = data.waveUntil;
    const remaining = data.waveUntil - Date.now();
    wave.hidden = remaining <= 0;
    if (!wave.hidden) sprite.hideWave = setTimeout(() => { wave.hidden = true; }, remaining);
  }
  return sprite;
}

function drawSelf(walking = false) {
  const mine = seating.current();
  const phase = seating.phase();
  const seat = phase === "walking" ? null : mine;
  const point = seat ? seating.position(seat) : location;
  if (point) {
    const sprite = paint("mine", { name: name || "나", color, facing, waveUntil, seat }, point, walking);
    sprite.node.classList.toggle("sitting", phase === "sitting");
  }
  camera.follow(point, phase ? null : mine);
}

function draw() {
  drawSelf(wasWalking);
  const visible = new Set(["mine"]);
  for (const peer of peers) {
    const space = peer.seat?.split(":")[0] || "hall";
    if (space !== displayedSpace()) continue;
    const target = peer.seat ? seating.position(peer.seat) : peer;
    if (!target) continue;
    paint(peer.id, peer, target, false);
    visible.add(peer.id);
  }
  for (const [id, sprite] of visitors) {
    if (visible.has(id)) continue;
    clearTimeout(sprite.stopWalking);
    clearTimeout(sprite.hideWave);
    sprite.node.remove();
    visitors.delete(id);
  }
}

function setStatus(text) {
  if (status.textContent !== text) status.textContent = text;
}

function receive(result) {
  connected = true;
  const receivedAt = Date.now();
  peers = result.visitors.filter((visitor) => visitor.id !== result.id).map((visitor) => {
    const remaining = visitor.wave + 3200 - result.now;
    return { ...visitor, waveUntil: remaining > 0 ? receivedAt + remaining : 0 };
  });
  setStatus("접속 " + result.visitors.length + "명");
  const roster = peers.length ? "함께 있는 손님 · " + peers.map((peer) => peer.name).join(", ") : "";
  guests.hidden = !roster;
  if (guests.textContent !== roster) guests.textContent = roster;
  seating.refresh(peers.flatMap((peer) => peer.seat ? [peer.seat] : []));
  draw();
}

function disconnected() {
  connected = false;
  setStatus("다시 연결 중");
  if (peers.length) {
    peers = [];
    guests.hidden = true;
    seating.refresh([]);
    draw();
  }
}

function send(action, seat) {
  const request = queue.catch(() => {}).then(async () => {
    const response = await fetch("./api/presence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, name, color, facing, x: location.x, y: location.y, action, seat }),
      signal: AbortSignal.timeout(7000),
    });
    if (!response.ok && response.status !== 409) throw new Error("Presence unavailable");
    const result = await response.json();
    receive(result);
    return result;
  });
  queue = request;
  return request;
}

async function changeSeat(action, seat) {
  pendingSeatChanges++;
  try {
    return await send(action, seat);
  } catch (error) {
    disconnected();
    throw error;
  } finally {
    pendingSeatChanges--;
  }
}

window.cafeWorld = {
  async reserve(seat) { return (await changeSeat("reserve", seat)).mine === seat; },
  release() { changeSeat("release").catch(() => {}); },
  walkToSeat(seat, previous, showSpace) {
    if (reducedMotion.matches) return Promise.resolve();
    const legs = routeToSeat(location, previous, seat, seating.position);
    if (!legs.length) return Promise.resolve();
    pressed.clear();
    stopJoystick();
    path = [];
    camera.track();
    return new Promise((resolve) => {
      journey = { legs, showSpace, resolve, leg: null };
      startLeg();
      requestFrame();
    });
  },
  cancelWalk() {
    if (!journey) return;
    const { resolve } = journey;
    journey = null;
    resolve();
  },
};

function startLeg() {
  const leg = journey.legs.shift();
  if (!leg) {
    window.cafeWorld.cancelWalk();
    return;
  }
  let total = 0;
  let last = leg.start;
  for (const point of leg.points) {
    total += Math.hypot(point.x - last.x, (point.y - last.y) * .67);
    last = point;
  }
  journey.leg = leg;
  journey.speed = Math.max(29, total / 2.8);
  Object.assign(location, leg.start);
  journey.showSpace(leg.space);
  draw();
}

function advanceJourney(dt) {
  let remaining = journey.speed * dt;
  const points = journey.leg.points;
  while (remaining > 0 && points.length) {
    const point = points[0];
    const dx = point.x - location.x;
    const dy = point.y - location.y;
    const length = Math.hypot(dx, dy * .67);
    if (Math.abs(dx) > .02) facing = dx < 0 ? -1 : 1;
    if (length > remaining) {
      location.x += dx * remaining / length;
      location.y += dy * remaining / length;
      break;
    }
    Object.assign(location, point);
    points.shift();
    remaining -= length;
  }
  if (!points.length) startLeg();
}

async function pulse() {
  if (pulsing) return;
  pulsing = true;
  try {
    const wanted = seating.current();
    const result = await send("sync");
    if (!pendingSeatChanges && wanted === seating.current() && wanted !== result.mine) {
      if (!wanted) await send("release");
      else if ((await send("reserve", wanted)).mine !== wanted) seating.lose(wanted);
    }
  } catch {
    disconnected();
  } finally {
    pulsing = false;
    pulseTimer = setTimeout(pulse, document.hidden ? 8500 : !connected ? 3200 : peers.length ? 1150 : 2600);
  }
}

function wave() {
  if (Date.now() - lastWave < 1100) return;
  lastWave = Date.now();
  waveUntil = lastWave + 3200;
  draw();
  send("wave").catch(disconnected);
}

document.getElementById("cafe-wave").addEventListener("click", wave);
document.getElementById("cafe-name-form").addEventListener("submit", (event) => {
  event.preventDefault();
  name = nameInput.value.trim().slice(0, 12);
  save("localStorage", nameKey, name);
  draw();
  send("sync").catch(disconnected);
});

function canMove() {
  return !seating.current() && !seating.phase() && !document.querySelector("dialog[open]");
}

function startMovement() {
  if (firstMove) {
    firstMove = false;
    if (!reducedMotion.matches) camera.track();
  }
  requestFrame();
}

scene.addEventListener("click", (event) => {
  if (event.target.closest("button") || !canMove()) return;
  scene.focus({ preventScroll: true });
  const box = scene.getBoundingClientRect();
  const target = { x: (event.clientX - box.left) * 100 / box.width, y: (event.clientY - box.top) * 100 / box.height };
  path = pathTo(location, target);
  if (path.length) startMovement();
});

document.addEventListener("keydown", (event) => {
  if (event.altKey || event.metaKey || event.ctrlKey || !canMove() ||
      event.target.closest("input, textarea, select, button, a, summary, [contenteditable]")) return;
  if (event.code === "KeyE" && Math.hypot(location.x - kiosk.x, location.y - kiosk.y) < 6) {
    document.getElementById("kiosk-pin").click();
    return;
  }
  if (!directions.has(event.code)) return;
  if (event.code.startsWith("Arrow") && event.target !== scene && event.target !== document.body) return;
  event.preventDefault();
  pressed.add(event.code);
  path = [];
  startMovement();
});
document.addEventListener("keyup", (event) => pressed.delete(event.code));
function moveJoystick(event) {
  const { x, y, radius, travel } = joystickOrigin;
  const dx = event.clientX - x;
  const dy = event.clientY - y;
  const distance = Math.hypot(dx, dy);
  const visual = Math.min(1, travel / (distance || 1));
  joystick.style.setProperty("--stick-x", dx * visual + "px");
  joystick.style.setProperty("--stick-y", dy * visual + "px");

  const deadZone = .16;
  const pull = Math.max(0, (Math.min(1, distance / radius) - deadZone) / (1 - deadZone));
  const strength = pull * (.3 + .7 * pull);
  joystickX = dx / (distance || 1) * strength;
  joystickY = dy / (distance || 1) * strength;
  if (strength) startMovement();
}

function stopJoystick() {
  const pointer = joystickPointer;
  if (pointer === null) return;
  joystickPointer = null;
  joystickX = joystickY = 0;
  joystick.removeAttribute("data-active");
  joystick.style.removeProperty("--stick-x");
  joystick.style.removeProperty("--stick-y");
  if (joystick.hasPointerCapture(pointer)) joystick.releasePointerCapture(pointer);
}

joystick.addEventListener("pointerdown", (event) => {
  if (joystickPointer !== null || event.button !== 0 || !canMove()) return;
  event.preventDefault();
  const box = joystick.getBoundingClientRect();
  joystickOrigin = {
    x: box.left + box.width / 2, y: box.top + box.height / 2,
    radius: box.width * .36, travel: box.width * .25,
  };
  joystickPointer = event.pointerId;
  joystick.setPointerCapture(joystickPointer);
  joystick.setAttribute("data-active", "");
  path = [];
  moveJoystick(event);
});
joystick.addEventListener("pointermove", (event) => {
  if (event.pointerId === joystickPointer) moveJoystick(event);
});
for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) {
  joystick.addEventListener(type, (event) => {
    if (event.pointerId === joystickPointer) stopJoystick();
  });
}
window.addEventListener("blur", () => { pressed.clear(); stopJoystick(); });
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    pressed.clear();
    stopJoystick();
    cancelAnimationFrame(frameId);
    frameId = 0;
    lastFrame = 0;
  } else {
    requestFrame();
    if (!pulsing) { clearTimeout(pulseTimer); pulse(); }
  }
});

let frameId = 0;
let lastFrame = 0;
let wasWalking = false;
let lastPhase = seating.phase();
function requestFrame() {
  if (!frameId && !document.hidden) frameId = requestAnimationFrame(animate);
}
function animate(time) {
  frameId = 0;
  const dt = lastFrame ? Math.min((time - lastFrame) / 1000, .04) : 0;
  lastFrame = time;
  const seat = seating.current();
  if (lastSeat && !seat) Object.assign(location, spawn);
  if (seat !== lastSeat) path = [];
  const free = canMove();
  if (!free) stopJoystick();

  let walking = false;
  if (journey) {
    advanceJourney(dt);
    walking = Boolean(journey);
  } else if (free) {
    let dx = pressed.size ? 0 : joystickX;
    let dy = pressed.size ? 0 : joystickY;
    for (const key of pressed) {
      const [x, y] = directions.get(key);
      dx += x;
      dy += y;
    }
    if (!dx && !dy && path.length) {
      dx = path[0].x - location.x;
      dy = (path[0].y - location.y) * .67;
    }
    const length = Math.hypot(dx, dy);
    if (length > 0) {
      const step = path.length ? Math.min(length, 20 * dt) : Math.min(length, 1) * 20 * dt;
      const x = location.x + dx / length * step;
      const y = location.y + dy / length * step / .67;
      if (canWalk(x, location.y)) { walking ||= x !== location.x; location.x = x; }
      if (canWalk(location.x, y)) { walking ||= y !== location.y; location.y = y; }
      if (dx) facing = dx < 0 ? -1 : 1;
    }
    if (path.length && Math.hypot(path[0].x - location.x, path[0].y - location.y) < .06) path.shift();
    else if (path.length && dt && !walking) path = [];
  }
  const phase = seating.phase();
  const changed = seat !== lastSeat || phase !== lastPhase;
  const motionChanged = walking !== wasWalking;
  wasWalking = walking;
  if (changed) draw();
  else if (walking || motionChanged) drawSelf(walking);
  lastPhase = phase;
  lastSeat = seat;
  if (journey || (free && (pressed.size || joystickX || joystickY || path.length))) requestFrame();
  else lastFrame = 0;
}

document.addEventListener("cafe-seat-phase", requestFrame);
document.addEventListener("cafe-regular", () => drawSelf(wasWalking));
seating.placeRoomDoors(roomPortals);
draw();
document.dispatchEvent(new Event("cafe-ready"));
pulse();

