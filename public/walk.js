import "./app.js";
import { clearSegmentInSpace, entrance, kiosk, pathTo, routeToSeat, roomPortals, relaxPortals, relaxZones } from "./world.js";
import { LANDMARKS, SEATS, center, toPercent } from "./cafe-map.mjs";
import { createCafeCamera } from "./camera.js";
import { AVATAR_WARDROBE, encodeAvatarCode, getAvatarSheetUrl, normalizeAvatarCode, renderAvatarPortrait, renderAvatarPreview } from "./avatar-sprites.js";

const scene = document.querySelector(".scene");
const joystick = document.getElementById("cafe-joystick");
const avatars = document.getElementById("cafe-avatars");
const status = document.getElementById("cafe-connection");
const guests = document.getElementById("cafe-guests");
const nameInput = document.getElementById("cafe-name");
const hudPortrait = document.getElementById("hud-avatar-portrait");
const hudPlayerName = document.getElementById("hud-player-name");
const hudProfileBtn = document.getElementById("hud-profile-btn");
const proximityPrompt = document.getElementById("proximity-prompt");
const snackCounterCoords = toPercent({ x: 526, y: 473 });
const boardCoords = toPercent(center(LANDMARKS.board));
const seating = window.cafeSeating;
const camera = createCafeCamera(scene);
const walkSpeed = 9.2;
const seatJourneyDuration = 4.0;
const directions = new Map([
  ["ArrowLeft", [-1, 0]], ["KeyA", [-1, 0]], ["ArrowRight", [1, 0]], ["KeyD", [1, 0]],
  ["ArrowUp", [0, -1]], ["KeyW", [0, -1]], ["ArrowDown", [0, 1]], ["KeyS", [0, 1]],
]);
const activityBadges = {
  smoke: "🚬 한 모금",
  coffee: "☕ 밀크커피",
  candy: "🍭 사탕",
  eat: "😋 식사 중",
  focus: "⏱️ 집중 중",
  "game:pvp": "⚔️ 대국 중",
  "game:tetris": "🧱 테트리스",
  "game:bungeoppang": "🐟 붕어빵",
  "game:tycoon": "🐱 매점러시",
  "game:acidrain": "🌧️ 산성비",
  "game:mines": "💣 지뢰찾기",
  "game:arcade": "🕹️ 벽돌깨기",
  "game:merge": "🔢 2048",
  "game:sudoku": "✏️ 스도쿠",
  "game:solitaire": "🃏 솔리테어",
  "game:knit": "🧶 실풀기",
};

const pressed = new Set();
const remoteJourneys = new Map();
let joystickPointer = null;
let joystickOrigin;
let joystickX = 0;
let joystickY = 0;
const visitors = new Map();
const AI_REGULARS = [
  { id: "npc:0", name: "민지", avatar: "010110", preferSeat: "hall:1", lines: ["오늘 게임 잘 풀리네~", "창가 자리 햇살 좋다!"] },
  { id: "npc:1", name: "현우", avatar: "141201", preferSeat: "hall:5", lines: ["짜계치 하나 시킬까?", "오목 한 판 하실 분!"] },
  { id: "npc:2", name: "서연", avatar: "323723", preferSeat: "hall:10", lines: ["키보드 타건감 좋다~", "얼박사 국룰이지!"] },
  { id: "npc:3", name: "도윤", avatar: "200412", preferSeat: "hall:14", lines: ["승급전 드디어 2연승!", "비 오는 날엔 PC방이지"] },
  { id: "npc:4", name: "하은", avatar: "164534", preferSeat: "hall:20", lines: ["뜨개 실풀기 은근 중독돼", "집중 모드 25분 완주!"] },
  { id: "npc:5", name: "지훈", avatar: "042600", preferSeat: "hall:25", lines: ["여기 PC방 자리 넓어서 편하다", "아샷추 얼음 가득!"] },
  { id: "npc:6", name: "유진", avatar: "312141", preferSeat: "hall:31", lines: ["고양이 알바생 너무 귀여워", "붕어빵 슈크림 최고"] },
  { id: "npc:7", name: "시우", avatar: "635310", preferSeat: "hall:38", lines: ["벽돌깨기 신기록 도전!", "2층 야외 테라스 뷰 좋네요"] },
  { id: "npc:8", name: "수빈", avatar: "021521", preferSeat: "solo:1", lines: ["1인석 아늑하고 집중 잘 돼요", "스도쿠 어려움 클리어!"] },
  { id: "npc:9", name: "태양", avatar: "553402", preferSeat: "duo:0", lines: ["2인룸 완전 편해요", "솔리테어 3장 뽑기 도전!"] },
  { id: "npc:10", name: "예린", avatar: "134730", preferSeat: "team:2", lines: ["5인룸 스크림 대기 중~", "매점 알바냥 대박 바쁘네"] },
];
const npcBubbles = new Map();
let activeNpcList = [];

function showLocalBubble(spriteNode, text, ms = 3200) {
  if (!spriteNode) return;
  let bubble = spriteNode.querySelector(".cafe-speech-bubble");
  if (!bubble) {
    bubble = document.createElement("div");
    bubble.className = "cafe-speech-bubble is-arriving";
    spriteNode.append(bubble);
  }
  bubble.textContent = text;
  clearTimeout(spriteNode._bubbleTimer);
  spriteNode._bubbleTimer = setTimeout(() => bubble.remove(), ms);
}

function resolveNpcRegulars(space) {
  if (space !== "hall") {
    activeNpcList = [];
    window.cafeArt?.setNpcSeats?.(new Set());
    return [];
  }
  const taken = new Set(peers.flatMap((p) => (p.seat ? [p.seat] : [])));
  const mySeat = seating.current();
  if (mySeat) taken.add(mySeat);
  const allKeys = SEATS.map((s) => s.key);
  const assigned = [];
  for (const npc of AI_REGULARS) {
    let targetSeat = npc.preferSeat;
    if (taken.has(targetSeat)) {
      targetSeat = allKeys.find((k) => !taken.has(k) && k !== "hall:0") || "";
    }
    if (!targetSeat) continue;
    taken.add(targetSeat);
    assigned.push({ ...npc, seat: targetSeat });
  }
  activeNpcList = assigned;
  window.cafeArt?.setNpcSeats?.(new Set(assigned.map((n) => n.seat)));
  return assigned;
}

function read(storage, key) {
  try { return window[storage].getItem(key); } catch { return null; }
}
function save(storage, key, value) {
  try { window[storage].setItem(key, value); } catch {}
}

const tokenKey = "neon-cafe-visitor";
const nameKey = "neon-cafe-nickname";
const avatarKey = "neon-cafe-avatar-v2";
const onboardKey = "neon-cafe-onboarded-v2";
const token = read("sessionStorage", tokenKey) || crypto.randomUUID();
save("sessionStorage", tokenKey, token);
const arrival = parseInt(token.slice(1, 3), 16) % 8 || 0;
const spawn = { x: entrance.x - 2.4 + (arrival % 4) * 1.6, y: entrance.y + (arrival >= 4 ? 1.2 : 0) };
const location = { ...spawn };
const color = parseInt(token[0], 16) % 8 || 0;

let avatarConfig = normalizeAvatarCode(read("localStorage", avatarKey), color);
let avatarCode = encodeAvatarCode(avatarConfig);
save("localStorage", avatarKey, avatarCode);

let name = read("localStorage", nameKey) || "";
nameInput.value = name;
let facing = 1;
let dirName = "down";
let activeZone = "hall"; // "hall" | "booth" | "terrace"
let myActivity = ""; // "" | "smoke" | "coffee" | "candy" | "eat" | "focus" | "game:*"
let path = [];
let waveUntil = 0;
let lastWave = 0;
let lastSeat = seating.current();
let stoodFromSeat = null;
let moveMarkerTimer = 0;
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
  const raw = scene.dataset.space;
  return raw === "lobby" ? "hall" : raw;
}

function isOnBreak() {
  return activeZone === "booth" || activeZone === "terrace";
}

function makeVisitor(key) {
  const node = document.createElement("div");
  node.className = "cafe-visitor";
  node.dataset.visitorId = key;
  node.classList.toggle("mine", key === "mine");
  node.innerHTML = `
    <span class="cafe-wave" hidden>👋</span>
    <span class="cafe-vapor" aria-hidden="true" hidden><i></i><i></i><i></i></span>
    <span class="cafe-activity-pill" hidden></span>
    <span class="cafe-nickname"></span>
    <span class="cafe-sprite" aria-hidden="true"></span>`;
  avatars.append(node);
  const visitor = {
    node,
    spriteEl: node.querySelector(".cafe-sprite"),
    label: node.querySelector(".cafe-nickname"),
    wave: node.querySelector(".cafe-wave"),
    vapor: node.querySelector(".cafe-vapor"),
    pill: node.querySelector(".cafe-activity-pill"),
  };
  visitors.set(key, visitor);
  return visitor;
}

function resolveDir(dx, dy, fallback = "down") {
  if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) return fallback;
  if (Math.abs(dy) > Math.abs(dx) * 1.15) return dy < 0 ? "up" : "down";
  return dx < 0 ? "left" : "right";
}

function paint(key, data, point, walking, awayAtDesk = false) {
  const sprite = visitors.get(key) || makeVisitor(key);
  const { node, spriteEl, label, wave, vapor, pill } = sprite;
  const prevX = sprite.x;
  const prevY = sprite.y;
  const moved = point.x !== prevX || point.y !== prevY;

  if (key !== "mine" && moved && prevX !== undefined && !data.seat) {
    sprite.dir = resolveDir(point.x - prevX, point.y - prevY, sprite.dir || "down");
    if (data.walking !== undefined) {
      clearTimeout(sprite.stopWalking);
      node.classList.toggle("walking", data.walking);
    } else {
      node.classList.add("walking");
      clearTimeout(sprite.stopWalking);
      sprite.stopWalking = setTimeout(() => node.classList.remove("walking"), 850);
    }
  }
  if (key === "mine") sprite.dir = dirName;
  else if (!sprite.dir) sprite.dir = data.facing === -1 ? "left" : "down";

  if (moved) {
    const jumped = key !== "mine" && prevX !== undefined && Math.hypot(point.x - prevX, point.y - prevY) > 15;
    if (jumped) node.classList.add("instant-move");
    sprite.x = point.x;
    sprite.y = point.y;
    const placement = window.cafeArt?.place(point) ?? point;
    node.style.left = placement.x + "%";
    node.style.top = placement.y + "%";
    if (window.cafeArt && walking && (key === "mine" || data.walking === true) && prevX !== undefined && !jumped) {
      const start = window.cafeArt.pixel({ x: prevX, y: prevY });
      const end = window.cafeArt.pixel(point);
      sprite.strideDistance = (sprite.strideDistance ?? 0) + Math.hypot(end.x - start.x, end.y - start.y);
      node.style.setProperty("--stride-frame", 1 + Math.floor(sprite.strideDistance / 6) % 6);
      node.dataset.stride = "";
    } else {
      sprite.strideDistance = 0;
      delete node.dataset.stride;
    }
    if (jumped) requestAnimationFrame(() => node.classList.remove("instant-move"));
  }

  const code = data.avatar || encodeAvatarCode(normalizeAvatarCode("", data.color ?? 0));
  if (sprite.avatarCode !== code) {
    sprite.avatarCode = code;
    spriteEl.style.backgroundImage = `url("${getAvatarSheetUrl(code, data.color ?? 0)}")`;
  }

  node.classList.toggle("away-desk", awayAtDesk);
  if (key === "mine" || data.seat || data.walking !== undefined) node.classList.toggle("walking", walking);
  node.classList.toggle("remote-path", data.walking !== undefined);
  const seatedHere = Boolean(data.seat || data.loungeDirection) && !awayAtDesk && data.zone !== "booth" && data.zone !== "terrace";
  node.classList.toggle("seated", seatedHere);
  const furniture = seatedHere && seating.chair(data.seat);
  if (furniture && !window.cafeArt) {
    node.style.setProperty("--seated-size", furniture.size + "cqw");
    node.style.setProperty("--seat-lift", (furniture.y - furniture.top) * .18 + "%");
    node.style.zIndex = String(furniture.depth - 1);
  } else {
    node.style.removeProperty("--seated-size");
    node.style.removeProperty("--seat-lift");
    const placement = window.cafeArt?.place(point) ?? point;
    node.style.zIndex = String(Math.round(placement.y * 10));
  }

  // Determine directional seated / break sprite row & column cleanly
  const act = awayAtDesk ? "away" : (data.activity || "");
  let row = { down: 0, up: 1, right: 2, left: 3 }[sprite.dir] ?? 0;
  let breakCol = -1;
  let seatDir = "";
  if (seatedHere) {
    seatDir = data.loungeDirection ?? seating.chair(data.seat)?.direction ?? "up";
    row = { up: 4, right: 5, left: 6, down: 11 }[seatDir];
    if (act === "eat") row += seatDir === "down" ? 1 : 4;
  } else if (!walking && (act === "smoke" || act === "coffee" || act === "candy")) {
    row = 7;
    breakCol = { coffee: 0, candy: 2, smoke: 4 }[act];
  }
  node.style.setProperty("--sprite-row", String(row));
  if (seatDir) node.dataset.seatDir = seatDir;
  else delete node.dataset.seatDir;
  if (breakCol >= 0) {
    node.dataset.pose = act;
    node.style.setProperty("--sprite-col", String(breakCol));
  } else {
    delete node.dataset.pose;
    node.style.removeProperty("--sprite-col");
  }

  // Vapor / Smoke / Warm Breath particles in booth or terrace!
  const emitVapor = !awayAtDesk && (act === "smoke" || act === "coffee" || displayedSpace() === "terrace");
  vapor.hidden = !emitVapor;
  if (emitVapor) vapor.dataset.kind = act === "smoke" ? "smoke" : "steam";

  // Activity pill badge
  const badgeText = awayAtDesk ? "🌙 휴식 외출 중" : (activityBadges[act] || "");
  pill.hidden = !badgeText;
  if (pill.textContent !== badgeText) pill.textContent = badgeText;

  const regular = key === "mine" && window.cafeIsRegular?.();
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

function syncHudProfile() {
  if (hudPortrait) renderAvatarPortrait(hudPortrait, avatarCode);
  if (hudPlayerName) {
    const regular = Boolean(window.cafeIsRegular?.());
    hudPlayerName.textContent = (name || "손님") + (regular ? " ★" : "");
  }
}

function getProximityTarget() {
  if (!canMove()) return null;
  if (isOnBreak()) {
    const door = relaxZones[activeZone]?.door;
    if (door && Math.hypot(location.x - door.x, location.y - door.y) < 8) {
      return { id: "exit", label: "[E] 홀로 돌아가기", run: () => exitRelaxZone() };
    }
    return null;
  }
  if (Math.hypot(location.x - kiosk.x, location.y - kiosk.y) < 7) {
    return { id: "kiosk", label: "[E] 자리 선택기 열기", run: () => document.getElementById("kiosk-pin").click() };
  }
  if (Math.hypot(location.x - snackCounterCoords.x, location.y - snackCounterCoords.y) < 7.5) {
    return { id: "snacks", label: "[E] 매점 · 오픈키친 열기", run: () => document.querySelector(".snack-counter")?.click() };
  }
  if (Math.hypot(location.x - boardCoords.x, location.y - boardCoords.y) < 4) {
    return { id: "board", label: "[E] 게시판 열기", run: () => document.getElementById("cafe-board-pin").click() };
  }
  if (Math.hypot(location.x - relaxPortals.booth.x, location.y - relaxPortals.booth.y) < 7) {
    return { id: "booth", label: "[E] 실내 흡연구역 입장", run: () => enterRelaxZone("booth") };
  }
  if (Math.hypot(location.x - relaxPortals.terrace.x, location.y - relaxPortals.terrace.y) < 7) {
    return { id: "terrace", label: "[E] 야외 흡연구역 입장", run: () => enterRelaxZone("terrace") };
  }
  return null;
}

let activeProximity = null;
function updateProximityPrompt() {
  const next = getProximityTarget();
  activeProximity = next;
  if (!proximityPrompt) return;
  proximityPrompt.hidden = !next;
  if (next && proximityPrompt.textContent !== next.label) {
    proximityPrompt.textContent = next.label;
  }
}
proximityPrompt?.addEventListener("click", () => activeProximity?.run());

function syncMobileJoystickVisibility() {
  if (!joystick) return;
  const movable = canMove();
  joystick.hidden = !movable;
  if (!movable) stopJoystick();
}

function drawSelf(walking = false) {
  syncMobileJoystickVisibility();
  const mine = seating.current();
  const phase = seating.phase();
  const space = displayedSpace();

  if (isOnBreak()) {
    // In booth or terrace!
    const sprite = paint("mine", {
      name: name || "나", color, avatar: avatarCode, facing, waveUntil,
      seat: null, zone: activeZone, activity: myActivity,
    }, location, walking, false);
    sprite.node.classList.remove("sitting");
    camera.follow(location, mine);
    updateProximityPrompt();
    return;
  }

  const seat = phase === "walking" ? null : mine;
  const lounge = !seat && window.cafeArt?.loungeSeat(myActivity);
  const point = seat ? seating.position(seat) : lounge?.point ?? location;
  if (point && space === "hall") {
    const sprite = paint("mine", {
      name: name || "나", color, avatar: avatarCode, facing, waveUntil,
      seat, zone: activeZone, activity: myActivity, loungeDirection: lounge?.direction,
    }, point, walking, false);
    sprite.node.classList.toggle("sitting", phase === "sitting");
  }
  const chair = seat && seating.chair(seat);
  // Frame the back of the chair and the display together in the private rooms.
  const focus = chair && !window.cafeArt ? { x: point.x, y: (chair.top + point.y) / 2 - 5 } : point;
  camera.follow(focus, phase ? null : mine);
  updateProximityPrompt();
}

function draw() {
  const space = displayedSpace();
  const visible = new Set();

  // Draw self if in displayedSpace
  const mySeat = seating.current();
  if ((isOnBreak() && space === activeZone) || (!isOnBreak() && space === "hall") || seating.phase()) {
    drawSelf(wasWalking);
    visible.add("mine");
  } else if (isOnBreak() && mySeat && space === "hall") {
    // Show "away on break" marker at my own desk if viewing seat space
    const deskPoint = seating.position(mySeat);
    if (deskPoint) {
      paint("mine", { name: name || "나", color, avatar: avatarCode, facing: 1, waveUntil: 0, seat: mySeat }, deskPoint, false, true);
      visible.add("mine");
    }
  }

  for (const peer of peers) {
    const remoteJourney = remoteJourneys.get(peer.id);
    if (remoteJourney) {
      remoteJourney.visitor = peer;
      if (remoteJourney.leg?.space !== space || !remoteJourney.point) continue;
      paint(peer.id, { ...peer, seat: null, walking: true }, remoteJourney.point, true, false);
      visible.add(peer.id);
      continue;
    }
    const peerBreak = peer.zone === "booth" || peer.zone === "terrace";
    if (peerBreak && peer.zone === space) {
      paint(peer.id, { ...peer, seat: null }, peer, false, false);
      visible.add(peer.id);
      continue;
    }
    if (space !== "hall") continue;
    const lounge = !peer.seat && window.cafeArt?.loungeSeat(peer.activity);
    const target = peer.seat ? seating.position(peer.seat) : lounge?.point ?? peer;
    if (!target) continue;
    paint(peer.id, { ...peer, loungeDirection: lounge?.direction }, target, false, peerBreak && Boolean(peer.seat));
    visible.add(peer.id);
  }

  for (const npc of resolveNpcRegulars(space)) {
    const pos = seating.position(npc.seat);
    if (!pos) continue;
    const sprite = paint(npc.id, {
      name: npc.name, avatar: npc.avatar, seat: npc.seat, facing: 1, waveUntil: 0, zone: "hall",
    }, pos, false, false);
    sprite.node.classList.add("npc-regular");
    const msg = npcBubbles.get(npc.id);
    if (msg && msg.until > Date.now()) {
      showLocalBubble(sprite.node, msg.text, msg.until - Date.now());
    }
    visible.add(npc.id);
  }

  for (const [id, sprite] of visitors) {
    if (visible.has(id)) continue;
    clearTimeout(sprite.stopWalking);
    clearTimeout(sprite.hideWave);
    window.cafeChatRemoveVisitor?.(id);
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
  const incoming = result.visitors.filter((visitor) => visitor.id !== result.id).map((visitor) => {
    const remaining = visitor.wave + 3200 - result.now;
    return { ...visitor, waveUntil: remaining > 0 ? receivedAt + remaining : 0 };
  });
  const previous = new Map(peers.map((peer) => [peer.id, peer]));
  const received = new Set();
  for (const peer of incoming) {
    received.add(peer.id);
    const oldPeer = previous.get(peer.id);
    const oldSeat = oldPeer?.seat ?? null;
    const remoteJourney = remoteJourneys.get(peer.id);
    if (remoteJourney && peer.seat === remoteJourney.seat) {
      remoteJourney.visitor = peer;
      continue;
    }
    if (remoteJourney) remoteJourneys.delete(peer.id);
    if (!oldPeer || !peer.seat || peer.seat === oldSeat || reducedMotion.matches) continue;

    const target = seating.position(peer.seat);
    const origin = oldSeat ? seating.position(oldSeat) : { x: peer.x, y: peer.y };
    if (!target || !origin) continue;
    const route = routeToSeat(origin, oldSeat, peer.seat, seating.position);
    if (!route.length) continue;
    const nextJourney = { seat: peer.seat, visitor: peer, legs: route, leg: null, point: null, speed: 0 };
    if (startRemoteLeg(nextJourney)) remoteJourneys.set(peer.id, nextJourney);
  }
  for (const id of remoteJourneys.keys()) {
    if (!received.has(id)) remoteJourneys.delete(id);
  }
  peers = incoming;
  const zoneCounts = {
    booth: result.visitors.filter((v) => v.zone === "booth").length,
    terrace: result.visitors.filter((v) => v.zone === "terrace").length,
  };
  document.dispatchEvent(new CustomEvent("cafe-zone-counts", { detail: { counts: zoneCounts, visitors: result.visitors, selfId: result.id } }));
  setStatus("접속 " + result.visitors.length + "명");
  const roster = peers.length ? "함께 있는 손님 · " + peers.map((peer) => {
    const tag = peer.zone === "booth" ? "(실내 흡연구역)" : peer.zone === "terrace" ? "(야외 흡연구역)" : peer.seat ? `(${seating.label(peer.seat) || "착석"})` : "";
    return peer.name + tag;
  }).join(", ") : "";
  guests.hidden = !roster;
  if (guests.textContent !== roster) guests.textContent = roster;
  seating.refresh(peers.flatMap((peer) => peer.seat ? [peer.seat] : []), peers);
  draw();
  if (Array.isArray(result.chat)) {
    document.dispatchEvent(new CustomEvent("cafe-chat-sync", {
      detail: {
        now: result.now,
        visitorId: result.id,
        space: displayedSpace(),
        messages: result.chat,
        visitors: result.visitors,
      },
    }));
  }
  if (Object.hasOwn(result, "delivery") || Object.hasOwn(result, "trays")) {
    document.dispatchEvent(new CustomEvent("cafe-delivery-sync", {
      detail: { now: result.now, delivery: result.delivery ?? null, trays: result.trays ?? [] },
    }));
  }
  if (remoteJourneys.size) requestFrame();
}

function disconnected() {
  connected = false;
  setStatus("다시 연결 중");
  if (peers.length || remoteJourneys.size) {
    peers = [];
    remoteJourneys.clear();
    guests.hidden = true;
    seating.refresh([], []);
    draw();
  }
}

function send(action, seat, extra = {}) {
  const request = queue.catch(() => {}).then(async () => {
    const response = await fetch("./api/presence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token, name, color, avatar: avatarCode, activity: myActivity,
        zone: activeZone, facing, x: location.x, y: location.y, action, seat, ...extra,
      }),
      signal: AbortSignal.timeout(7000),
    });
    const result = await response.json();
    if (action === "say" && response.status >= 400 && response.status < 500) {
      if (result && Array.isArray(result.visitors)) receive(result);
      return result;
    }
    if (!response.ok && response.status !== 409) throw new Error("Presence unavailable");
    receive(result);
    return result;
  });
  queue = request;
  return request;
}

window.cafeChatSay = (text) => !seating.phase()
  ? send("say", undefined, {
    text,
    space: isOnBreak() ? activeZone : (seating.current()?.split(":")[0] ?? "hall"),
  })
  : Promise.resolve({ error: "chat_room_changed" });

async function changeSeat(action, seat) {
  pendingSeatChanges++;
  try {
    if (action === "reserve") {
      activeZone = "hall";
      if (myActivity.startsWith("lounge:")) myActivity = "";
    }
    return await send(action, seat);
  } catch (error) {
    disconnected();
    throw error;
  } finally {
    pendingSeatChanges--;
  }
}

// Enter or leave Smoking Booth / 2F Night Terrace (supports Seated Break Mode!)
function enterRelaxZone(zoneId, initialMode = "") {
  if (!relaxZones[zoneId] || seating.phase()) return;
  const desktop = document.getElementById("pc-desktop");
  if (desktop?.open) desktop.close();
  pressed.clear();
  stopJoystick();
  path = [];
  activeZone = zoneId;
  const cfg = relaxZones[zoneId];
  location.x = cfg.door.x + (Math.random() * 6 - 3);
  location.y = cfg.door.y - 3;
  dirName = "up";
  myActivity = initialMode || (zoneId === "terrace" ? "coffee" : "smoke");
  window.cafeShowZone?.(zoneId);
  window.cafeAudioSetZone?.(zoneId);
  draw();
  send("sync").catch(disconnected);
}

function exitRelaxZone() {
  if (!isOnBreak()) return;
  const prevZone = activeZone;
  activeZone = "hall";
  if (myActivity === "smoke" || myActivity === "coffee" || myActivity === "candy") myActivity = "";
  pressed.clear();
  stopJoystick();
  path = [];
  const mySeat = seating.current();
  if (!mySeat) {
    const portal = relaxPortals[prevZone] || entrance;
    location.x = portal.x;
    location.y = portal.y + 2.2;
    dirName = "down";
  } else {
    dirName = "up";
  }
  window.cafeShowZone?.(null);
  window.cafeAudioSetZone?.(mySeat ? mySeat.split(":")[0] : "hall");
  draw();
  send("sync").catch(disconnected);
}

function setActivity(nextActivity) {
  if (myActivity === nextActivity) return;
  myActivity = nextActivity;
  if (isOnBreak() && ["smoke", "coffee", "candy"].includes(nextActivity)) {
    const firstBuff = !window.cafeRelaxBuffUntil || window.cafeRelaxBuffUntil < Date.now();
    window.cafeRelaxBuffUntil = Date.now() + 180_000;
    if (firstBuff) {
      document.querySelector(".u070")?.dispatchEvent(new CustomEvent("pcbang-notice", {
        detail: { message: "☕ 3분간 머리 식힘 버프 발동! (미니게임 G +15%)", kind: "ok" },
      }));
    }
  }
  draw();
  send("sync").catch(disconnected);
}

window.cafeWorld = {
  async reserve(seat) { return (await changeSeat("reserve", seat)).mine === seat; },
  release() {
    activeZone = "hall";
    myActivity = "";
    changeSeat("release").catch(() => {});
  },
  enterRelaxZone,
  exitRelaxZone,
  async toggleLoungeSeat(key) {
    if (myActivity === key) {
      setActivity("");
      return;
    }
    if (journey || isOnBreak() || !canMove() || peers.some(peer => peer.activity === key)) return;
    const lounge = window.cafeArt.loungeSeat(key);
    if (!lounge) return;
    const steps = pathTo(location, lounge.stand, "hall", { strictTarget: true });
    if (steps.length) {
      path = [];
      pressed.clear();
      stopJoystick();
      await new Promise(resolve => {
        journey = { legs: [{ start: { ...location }, points: steps, space: "hall" }], showSpace() {}, resolve };
        startLeg();
        requestFrame();
      });
    } else if (Math.hypot(location.x - lounge.stand.x, location.y - lounge.stand.y) > .25) return;
    if (!seating.current() && !isOnBreak()) setActivity(key);
  },
  isOnBreak,
  currentZone: () => activeZone,
  setActivity,
  clearActivity(expected) {
    if (myActivity === expected) setActivity("");
  },
  async standFromSeat() {
    const key = seating.current();
    if (!key || isOnBreak()) return;
    const sprite = visitors.get("mine");
    if (sprite && !reducedMotion.matches) {
      sprite.node.classList.add("standing");
      await new Promise(resolve => setTimeout(resolve, 240));
      sprite.node.classList.remove("standing");
    }
    if (key !== seating.current()) return;
    const chair = seating.chair(key);
    stoodFromSeat = key;
    Object.assign(location, chair?.stand ?? entrance);
    dirName = { up: "down", down: "up", left: "right", right: "left" }[chair?.direction] ?? "down";
  },
  syncNow: () => send("sync").catch(disconnected),
  getProfile: () => ({ name: name || "손님", avatar: avatarCode, token }),
  getPeers: () => peers.slice(),
  getNpcPeers: () => activeNpcList.map(({ id, name: npcName, seat }) => ({ id, name: npcName, seat })),
  thankNpc(seatKey, note, itemLabel) {
    const npc = activeNpcList.find((n) => n.seat === seatKey);
    if (!npc) return;
    const text = note ? `🎁 ${itemLabel} 감동!! "${note}" 😋` : `🎁 ${itemLabel} 진짜 감사해요!! 😋`;
    npcBubbles.set(npc.id, { text, until: Date.now() + 5200 });
    draw();
  },
  walkToSeat(seat, previous, showSpace) {
    activeZone = "hall";
    stoodFromSeat = null;
    if (reducedMotion.matches) return Promise.resolve();
    const legs = routeToSeat(location, previous, seat, seating.position);
    if (!legs.length) return Promise.resolve();
    pressed.clear();
    stopJoystick();
    path = [];
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

function startRemoteLeg(remoteJourney) {
  const leg = remoteJourney.legs.shift();
  if (!leg) return false;
  let total = 0;
  let previous = leg.start;
  for (const point of leg.points) {
    total += Math.hypot(point.x - previous.x, (point.y - previous.y) * .67);
    previous = point;
  }
  remoteJourney.leg = leg;
  remoteJourney.point = { ...leg.start };
  remoteJourney.speed = Math.min(12.5, Math.max(8.5, total / seatJourneyDuration));
  return true;
}

function advanceRemoteJourneys(dt) {
  let changedLeg = false;
  for (const [id, remoteJourney] of remoteJourneys) {
    if (!remoteJourney.leg && !startRemoteLeg(remoteJourney)) {
      remoteJourneys.delete(id);
      continue;
    }
    let remaining = remoteJourney.speed * dt;
    const points = remoteJourney.leg.points;
    while (remaining > 0 && points.length) {
      const next = points[0];
      const dx = next.x - remoteJourney.point.x;
      const dy = next.y - remoteJourney.point.y;
      const length = Math.hypot(dx, dy * .67);
      if (length > remaining) {
        remoteJourney.point.x += dx * remaining / length;
        remoteJourney.point.y += dy * remaining / length;
        remaining = 0;
      } else {
        Object.assign(remoteJourney.point, next);
        points.shift();
        remaining -= length;
      }
    }
    if (!points.length) {
      remoteJourney.leg = null;
      if (!startRemoteLeg(remoteJourney)) remoteJourneys.delete(id);
      changedLeg = true;
    }
  }
  if (changedLeg) draw();
}

function drawRemoteJourneys() {
  for (const [id, remoteJourney] of remoteJourneys) {
    if (remoteJourney.leg?.space !== displayedSpace() || !remoteJourney.point) continue;
    paint(id, { ...remoteJourney.visitor, seat: null, walking: true }, remoteJourney.point, true, false);
  }
}

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
  journey.speed = 10.5;
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
    dirName = resolveDir(dx, dy, dirName);
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
  window.cafeAudioPlay?.("wave");
  draw();
  showLocalBubble(visitors.get("mine")?.node, "👋 안녕하세요!", 2800);
  document.dispatchEvent(new CustomEvent("cafe-mission", { detail: { id: "greet" } }));
  send("wave").catch(disconnected);
}

setInterval(() => {
  if (document.hidden || displayedSpace() !== "hall" || !activeNpcList.length) return;
  const npc = activeNpcList[Math.floor(Math.random() * activeNpcList.length)];
  const line = npc.lines[Math.floor(Math.random() * npc.lines.length)];
  npcBubbles.set(npc.id, { text: line, until: Date.now() + 4500 });
  const sprite = visitors.get(npc.id);
  if (sprite) showLocalBubble(sprite.node, line, 4500);
}, 7500);

document.getElementById("cafe-wave").addEventListener("click", wave);
document.getElementById("cafe-name-form").addEventListener("submit", (event) => {
  event.preventDefault();
  name = nameInput.value.trim().slice(0, 12);
  save("localStorage", nameKey, name);
  syncHudProfile();
  draw();
  send("sync").catch(disconnected);
  window.cafeAudioPlay?.("pop");
});

// Wardrobe Customization UI Setup
function initWardrobe() {
  const modal = document.getElementById("avatar-wardrobe");
  const openBtn = document.getElementById("open-wardrobe");
  if (!modal || !openBtn) return;
  const preview = document.getElementById("wardrobe-preview");
  const controlsRoot = document.getElementById("wardrobe-controls");
  const dirLabel = document.getElementById("wardrobe-dir-label");
  const rotLeft = document.getElementById("wardrobe-rot-left");
  const rotRight = document.getElementById("wardrobe-rot-right");
  const dirs = [
    ["down", "정면"],
    ["right", "오른쪽"],
    ["up", "뒷모습"],
    ["left", "왼쪽"],
  ];
  let draft = { ...avatarConfig };
  let previewAction = "idle";
  let previewDirIdx = 0;
  let previewTick = 0;
  let previewTimer = 0;

  const categories = [
    ["skin", "캐릭터", AVATAR_WARDROBE.skins],
    ["hair", "헤어 스타일", AVATAR_WARDROBE.hairs],
    ["hairColor", "헤어 색상", AVATAR_WARDROBE.hairColors],
    ["outfit", "의상 코디", AVATAR_WARDROBE.outfits],
    ["headset", "모자·헤드셋", AVATAR_WARDROBE.headsets],
    ["accessory", "안경·목도리", AVATAR_WARDROBE.accessories],
  ];

  function currentDir() {
    return dirs[previewDirIdx]?.[0] || "down";
  }

  function repaintPreview() {
    renderAvatarPreview(preview, encodeAvatarCode(draft), previewAction, previewTick % 4, currentDir());
    if (dirLabel) dirLabel.textContent = dirs[previewDirIdx]?.[1] || "정면";
    for (const [key, , list] of categories) {
      const row = controlsRoot.querySelector(`[data-part="${key}"]`);
      if (!row) continue;
      const idx = ((draft[key] ?? 0) % list.length + list.length) % list.length;
      const item = list[idx];
      const dot = row.querySelector(".wardrobe-dot");
      const nameEl = row.querySelector(".wardrobe-name");
      const countEl = row.querySelector(".wardrobe-idx");
      const swatch = item.base || item.body || item.color;
      if (dot) {
        dot.style.background = swatch || "transparent";
        dot.hidden = !swatch;
      }
      if (nameEl) nameEl.textContent = item.name;
      if (countEl) countEl.textContent = `${idx + 1}/${list.length}`;
    }
  }

  controlsRoot.replaceChildren(...categories.map(([key, title, list]) => {
    const group = document.createElement("div");
    group.className = "wardrobe-stepper";
    group.dataset.part = key;

    const label = document.createElement("strong");
    label.textContent = title;

    const prevBtn = document.createElement("button");
    prevBtn.type = "button";
    prevBtn.className = "walk-button wardrobe-arrow";
    prevBtn.textContent = "◀";
    prevBtn.setAttribute("aria-label", `${title} 이전 스타일`);

    const val = document.createElement("div");
    val.className = "wardrobe-val";
    const dot = document.createElement("i");
    dot.className = "wardrobe-dot";
    const nameEl = document.createElement("span");
    nameEl.className = "wardrobe-name";
    const countEl = document.createElement("small");
    countEl.className = "wardrobe-idx mono";
    val.append(dot, nameEl, countEl);

    const nextBtn = document.createElement("button");
    nextBtn.type = "button";
    nextBtn.className = "walk-button wardrobe-arrow";
    nextBtn.textContent = "▶";
    nextBtn.setAttribute("aria-label", `${title} 다음 스타일`);

    const step = (delta) => {
      draft[key] = ((draft[key] ?? 0) + delta + list.length) % list.length;
      window.cafeAudioPlay?.("tick");
      repaintPreview();
    };
    prevBtn.addEventListener("click", () => step(-1));
    nextBtn.addEventListener("click", () => step(1));

    group.append(label, prevBtn, val, nextBtn);
    return group;
  }));

  rotLeft?.addEventListener("click", () => {
    previewDirIdx = (previewDirIdx - 1 + dirs.length) % dirs.length;
    window.cafeAudioPlay?.("tick");
    repaintPreview();
  });
  rotRight?.addEventListener("click", () => {
    previewDirIdx = (previewDirIdx + 1) % dirs.length;
    window.cafeAudioPlay?.("tick");
    repaintPreview();
  });

  modal.querySelectorAll("[data-pose-preview]").forEach((btn) => {
    btn.addEventListener("click", () => {
      previewAction = btn.dataset.posePreview;
      modal.querySelectorAll("[data-pose-preview]").forEach((el) => {
        el.setAttribute("aria-pressed", String(el === btn));
      });
      repaintPreview();
    });
  });

  document.getElementById("wardrobe-random")?.addEventListener("click", () => {
    draft = {
      skin: Math.floor(Math.random() * AVATAR_WARDROBE.skins.length),
      hair: Math.floor(Math.random() * AVATAR_WARDROBE.hairs.length),
      hairColor: Math.floor(Math.random() * AVATAR_WARDROBE.hairColors.length),
      outfit: Math.floor(Math.random() * AVATAR_WARDROBE.outfits.length),
      headset: Math.floor(Math.random() * AVATAR_WARDROBE.headsets.length),
      accessory: Math.floor(Math.random() * AVATAR_WARDROBE.accessories.length),
    };
    window.cafeAudioPlay?.("tick");
    repaintPreview();
  });

  const titleEl = document.getElementById("wardrobe-title");
  const saveBtn = document.getElementById("wardrobe-save");

  document.getElementById("wardrobe-save")?.addEventListener("click", () => {
    const nextName = (nameInput.value.trim() || name || "코지손님").slice(0, 12);
    name = nextName;
    nameInput.value = nextName;
    save("localStorage", nameKey, name);
    save("localStorage", onboardKey, "1");
    avatarConfig = { ...draft };
    avatarCode = encodeAvatarCode(avatarConfig);
    save("localStorage", avatarKey, avatarCode);
    syncHudProfile();
    modal.dataset.mode = "edit";
    window.closeCafeWindow?.(modal) ?? modal.close();
    draw();
    send("sync").catch(disconnected);
    window.cafeAudioPlay?.("pop");
  });

  const openModal = (trigger, entryMode = false) => {
    draft = { ...avatarConfig };
    modal.dataset.mode = entryMode ? "entry" : "edit";
    if (titleEl) titleEl.textContent = entryMode ? "길모퉁이PC방 입장 준비" : "내 캐릭터 옷장";
    if (saveBtn) saveBtn.textContent = entryMode ? "🎮 이 캐릭터로 PC방 입장하기" : "이 스타일로 갈아입기";
    repaintPreview();
    window.openCafeWindow ? window.openCafeWindow(modal, trigger) : modal.showModal();
    if (entryMode) setTimeout(() => nameInput.focus(), 60);
    clearInterval(previewTimer);
    previewTimer = setInterval(() => {
      if (!modal.open) { clearInterval(previewTimer); return; }
      previewTick++;
      renderAvatarPreview(preview, encodeAvatarCode(draft), previewAction, previewTick % 4, currentDir());
    }, 260);
  };
  openBtn.addEventListener("click", () => openModal(openBtn, false));
  hudProfileBtn?.addEventListener("click", () => openModal(hudProfileBtn, false));

  modal.addEventListener("cancel", (event) => {
    if (modal.dataset.mode === "entry") event.preventDefault();
  });

  // Pre-entry customization flow for new visitors or unset nicknames
  if (!read("localStorage", onboardKey) && !seating.current() && !document.querySelector("dialog[open]")) {
    openModal(hudProfileBtn || openBtn, true);
  }
}

function canMove() {
  if (seating.phase() || document.querySelector("dialog[open]")) return false;
  if (isOnBreak()) return true; // Can always walk freely inside Smoking Booth & Night Terrace!
  return !seating.current() && !myActivity.startsWith("lounge:");
}

function startMovement() {
  if (firstMove) {
    firstMove = false;
  }
  requestFrame();
}

function showMoveFeedback(point, ok) {
  let marker = scene.querySelector(".cafe-move-marker");
  if (!marker) {
    marker = document.createElement("div");
    marker.className = "cafe-move-marker";
    marker.setAttribute("aria-hidden", "true");
    scene.append(marker);
  }
  const placement = window.cafeArt?.place(point) ?? point;
  marker.style.left = placement.x + "%";
  marker.style.top = placement.y + "%";
  marker.classList.toggle("blocked", !ok);
  marker.textContent = ok ? "" : "도달 불가";
  marker.hidden = false;
  clearTimeout(moveMarkerTimer);
  moveMarkerTimer = setTimeout(() => { marker.hidden = true; }, ok ? 550 : 900);
}

scene.addEventListener("click", (event) => {
  if (event.target.closest("button, .cafe-move-marker") || !canMove()) return;
  scene.focus({ preventScroll: true });
  const box = scene.getBoundingClientRect();
  const target = { x: (event.clientX - box.left) * 100 / box.width, y: (event.clientY - box.top) * 100 / box.height };
  const route = pathTo(location, target, isOnBreak() ? activeZone : "hall", { strictTarget: true });
  if (route.length) {
    path = route;
    showMoveFeedback(target, true);
    startMovement();
  } else {
    showMoveFeedback(target, false);
  }
});

document.addEventListener("keydown", (event) => {
  if (event.altKey || event.metaKey || event.ctrlKey || !canMove() ||
      event.target.closest("input, textarea, select, button, a, summary, [contenteditable]")) return;
  if (event.code === "KeyE") {
    const prox = getProximityTarget();
    if (prox) {
      prox.run();
      return;
    }
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
let lastMoveSyncAt = 0;
let lastPhase = seating.phase();
function requestFrame() {
  if (!frameId && !document.hidden) frameId = requestAnimationFrame(animate);
}

function animate(time) {
  frameId = 0;
  const dt = lastFrame ? Math.min((time - lastFrame) / 1000, .04) : 0;
  lastFrame = time;
  advanceRemoteJourneys(dt);
  drawRemoteJourneys();
  const seat = seating.current();
  if (lastSeat && !seat && !isOnBreak()) {
    if (stoodFromSeat === lastSeat) stoodFromSeat = null;
    else Object.assign(location, spawn);
  }
  if (seat !== lastSeat) path = [];
  const free = canMove();
  syncMobileJoystickVisibility();

  const walkSpace = isOnBreak() ? activeZone : "hall";
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
      const step = path.length ? Math.min(length, walkSpeed * dt) : Math.min(length, 1) * walkSpeed * dt;
      const x = location.x + dx / length * step;
      const y = location.y + dy / length * step / .67;
      if (x !== location.x && clearSegmentInSpace(location, { x, y: location.y }, walkSpace)) { walking = true; location.x = x; }
      if (y !== location.y && clearSegmentInSpace(location, { x: location.x, y }, walkSpace)) { walking = true; location.y = y; }
      dirName = resolveDir(dx, dy, dirName);
      if (dx) facing = dx < 0 ? -1 : 1;
    }
    if (path.length && Math.hypot(path[0].x - location.x, path[0].y - location.y) < .08) path.shift();
    else if (path.length && dt && !walking) path = [];
  }
  const phase = seating.phase();
  const changed = seat !== lastSeat || phase !== lastPhase;
  const motionChanged = walking !== wasWalking;
  wasWalking = walking;
  if (changed) draw();
  else if (walking || motionChanged) {
    drawSelf(walking);
    if (!journey && connected && (motionChanged || (walking && time - lastMoveSyncAt > 550))) {
      lastMoveSyncAt = time;
      send("sync").catch(disconnected);
    }
  }
  lastPhase = phase;
  lastSeat = seat;
  if (journey || remoteJourneys.size || (free && (pressed.size || joystickX || joystickY || path.length))) requestFrame();
  else lastFrame = 0;
}

document.addEventListener("cafe-seat-phase", () => {
  draw();
  requestFrame();
});
document.addEventListener("cafe-regular", () => {
  syncHudProfile();
  drawSelf(wasWalking);
});
reducedMotion.addEventListener("change", () => {
  if (!reducedMotion.matches || !remoteJourneys.size) return;
  remoteJourneys.clear();
  draw();
});
seating.placeRoomDoors(roomPortals, relaxPortals);
initWardrobe();
syncHudProfile();
draw();
document.dispatchEvent(new Event("cafe-ready"));
pulse();
