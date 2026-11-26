"use strict";

const $ = (selector) => document.querySelector(selector);
const seatId = (index) => String(index + 1).padStart(2, "0");
const formatTime = (seconds) => [Math.floor(seconds / 60), seconds % 60]
  .map((value) => String(value).padStart(2, "0")).join(":");
const roomKey = "neon-pcbang-room";
const focusKey = "neon-pcbang-focus";
const defaultFocusMinutes = 25;
const maximumFocusMinutes = 120;

function readState(key, defaults) {
  try {
    const storage = key === roomKey ? sessionStorage : localStorage;
    let saved = storage.getItem(key);
    if (key === roomKey && saved === null) {
      saved = localStorage.getItem(key);
      if (saved !== null) {
        storage.setItem(key, saved);
        localStorage.removeItem(key);
      }
    }
    return { ...defaults, ...JSON.parse(saved) };
  } catch {
    return { ...defaults };
  }
}

function saveState(key, value) {
  try {
    const storage = key === roomKey ? sessionStorage : localStorage;
    storage.setItem(key, JSON.stringify(value));
  } catch {}
}

const layoutSource = window.cafeLayout;
const hallBanks = layoutSource?.hallBanks ?? [
  { letter: "A", x: [428, 491], spineX: 231 },
  { letter: "B", x: [651, 714], spineX: 343 },
  { letter: "C", x: [892, 955], spineX: 463 },
  { letter: "D", x: [1133, 1196], spineX: 584 },
];
const hallRows = layoutSource?.hallRows ?? [196, 244, 291, 338, 386, 434, 481, 529, 577, 626, 675];
const bankSize = layoutSource?.bankSize ?? (hallRows.length * 2);
const spaces = layoutSource?.spaces ?? {
  hall: {
    label: "일반석",
    positions: hallBanks.flatMap(({ x }) => hallRows.flatMap((y) => x.map((column) => [column / 15.36, y / 10.24])))
  },
  solo: {
    label: "1인석",
    alt: "따뜻한 회색 칸막이와 게이밍 PC 한 대가 있는 픽셀 아트 1인석",
    positions: [[53.1, 38.8]]
  },
  duo: {
    label: "2인석",
    alt: "옅은 세이지색 의자와 게이밍 PC 두 대가 나란히 놓인 픽셀 아트 2인석",
    positions: [[36.8, 40.5], [65.2, 40.5]]
  },
  team: {
    label: "5인룸",
    alt: "회보라색 의자와 게이밍 PC 다섯 대가 한 줄로 놓인 픽셀 아트 팀 룸",
    positions: [[22.1, 40.4], [37.8, 40.4], [53.3, 40.4], [69.1, 40.4], [84.6, 40.4]]
  },
  squad: {
    label: "6인룸",
    alt: "회색 의자와 게이밍 PC 여섯 대가 두 줄로 놓인 픽셀 아트 스쿼드 룸",
    positions: [[32.8, 22.7], [53.6, 22.7], [74.7, 22.7], [28.7, 49.4], [53.3, 49.4], [77.8, 49.4]]
  }
};

const room = readState(roomKey, { space: null, seat: null, since: null, snack: "", order: null });
if (room.seat !== null && !room.space) {
  const legacySpace = room.seat === 0 ? "solo" : room.seat < 3 ? "duo" : "team";
  const firstSeat = { solo: 0, duo: 1, team: 3 };
  room.space = legacySpace;
  room.seat -= firstSeat[legacySpace];
  saveState(roomKey, room);
}
let storedFocus = null;
try { storedFocus = JSON.parse(localStorage.getItem(focusKey)); } catch {}
const hasStoredFocus = Boolean(storedFocus && typeof storedFocus === "object");
const focus = readState(focusKey, {
  durationMinutes: null,
  remaining: 0,
  end: null,
  soundEnabled: true,
  completed: false,
  completionPending: false,
  completionAnnounced: false,
  completionEffectsShown: false,
  completionSoundPlayed: false,
});
const expiredWhilePageClosed = typeof focus.end === "number" && focus.end > 0 && focus.end <= Date.now();
let skipFocusCompletionEffects = expiredWhilePageClosed;
if (!Number.isInteger(focus.durationMinutes) || focus.durationMinutes < 1 || focus.durationMinutes > maximumFocusMinutes) {
  focus.durationMinutes = hasStoredFocus && !Object.hasOwn(storedFocus, "durationMinutes") ? defaultFocusMinutes : null;
}
if (!Number.isFinite(focus.remaining) || focus.remaining < 0) {
  focus.remaining = focus.durationMinutes ? focus.durationMinutes * 60_000 : 0;
}
if (typeof focus.end !== "number" || !Number.isFinite(focus.end)) focus.end = null;
if (typeof focus.soundEnabled !== "boolean") focus.soundEnabled = true;
if (typeof focus.completed !== "boolean") focus.completed = false;
if (typeof focus.completionPending !== "boolean") focus.completionPending = false;
if (typeof focus.completionAnnounced !== "boolean") focus.completionAnnounced = false;
if (typeof focus.completionEffectsShown !== "boolean") focus.completionEffectsShown = Boolean(focus.completed);
if (typeof focus.completionSoundPlayed !== "boolean") focus.completionSoundPlayed = false;
if (expiredWhilePageClosed) {
  Object.assign(focus, {
    remaining: 0,
    end: null,
    completed: true,
    completionPending: false,
    completionAnnounced: true,
    completionEffectsShown: true,
    completionSoundPlayed: true,
  });
  saveState(focusKey, focus);
}

const floor = $("#floor-kiosk");
const hub = $("#cafe-menu");
const floorSelect = $("#floor-select");
const floorSeats = new Map();
const floorOptions = [];
const desktop = $("#pc-desktop");
const monitorLayer = $("#monitor-layer");
const roomsArtwork = $("#rooms-art");
const boothArtwork = $("#booth-art");
const terraceArtwork = $("#terrace-art");
const relaxHud = $("#relax-hud");
const journeyProgress = $("#seat-journey");
const journeyLabel = $("#seat-journey-label");
const journeyStatus = $("#seat-journey-status");
const journeySteps = [...journeyProgress.querySelectorAll("[data-phase]")];

let selectedSeat = null;
let poweredMonitor = null;
let desktopReturnFocus;
let occupiedSeats = new Set();
let awaySeats = new Set();
let activeBreakZone = null; // null | "booth" | "terrace"
let bookingSeat = false;
let seatJourney = null;
const reduceSeatMotion = matchMedia("(prefers-reduced-motion: reduce)");

function isSeated() {
  return Boolean(room.space) && (!seatJourney || seatJourney.phase === "booting");
}

function prepareRoomArt() {
  if (!roomsArtwork.hasAttribute("src")) roomsArtwork.src = roomsArtwork.dataset.src;
}
function prepareZoneArt(zoneId) {
  const el = zoneId === "booth" ? boothArtwork : terraceArtwork;
  if (el && !el.hasAttribute("src")) el.src = el.dataset.src;
}

// The 88 computers share a packed sheet. Positions follow the glass calibration.
const hardwareLayer = document.querySelector(".hall-hardware");
for (const [index, polygon] of (window.cafeArt ? [] : cafeScreenShapes.hall).entries()) {
  const x = Math.round(Math.min(...polygon.map(point => point[0])) / 2) - 3;
  const y = Math.round(Math.min(...polygon.map(point => point[1])) / 2) - 2;
  const col = Math.floor(index / 22) * 2 + index % 2;
  const row = Math.floor(index % 22 / 2);
  const hardware = document.createElement("span");
  Object.assign(hardware.style, { left: x / 768 * 100 + "%", top: y / 512 * 100 + "%",
    width: 22 / 768 * 100 + "%", height: 20 / 512 * 100 + "%",
    backgroundSize: "800% 1100%", backgroundPosition: col / 7 * 100 + "% " + row * 10 + "%" });
  hardwareLayer.append(hardware);
}

function renderMonitorPower(spaceId) {
  if (window.cafeArt) {
    const key = isSeated() && room.space === spaceId ? room.space + ":" + room.seat : null;
    const panel = key && window.cafeArt.screen(key);
    const away = new Set(awaySeats);
    if (key && activeBreakZone) away.add(key);
    window.cafeArt.updateScreens(key, occupiedSeats, away);
    if (!panel) {
      poweredMonitor = null;
      monitorLayer.replaceChildren();
      return;
    }
    const anchor = poweredMonitor?.dataset.seat === key ? poweredMonitor : document.createElement("span");
    anchor.className = "pc-screen";
    anchor.dataset.seat = key;
    for (const [name, value] of Object.entries({ x: panel.x, y: panel.y,
      "screen-width": panel.w, "screen-height": panel.h })) {
      anchor.style.setProperty("--" + name, value + "%");
    }
    poweredMonitor = anchor;
    if (anchor.parentElement !== monitorLayer) monitorLayer.replaceChildren(anchor);
    return;
  }
  if (spaceId === "booth" || spaceId === "terrace") {
    monitorLayer.hidden = true;
    return;
  }
  monitorLayer.hidden = false;
  if (monitorLayer.dataset.space !== spaceId) {
    monitorLayer.dataset.space = spaceId;
    const groups = spaceId === "hall"
      ? ["hall", "hall-solo", "hall-duo", "hall-team", "hall-squad"] : [spaceId];
    const scale = spaceId === "hall" ? 1 : 2;
    const panels = groups.flatMap((group) => cafeScreenShapes[group].map((points, index) =>
      [group.replace("hall-", "") + ":" + index, points]));
    monitorLayer.replaceChildren(...panels.map(([key, points]) => {
      const xs = points.map(([x]) => x), ys = points.map(([, y]) => y);
      const x = Math.min(...xs), y = Math.min(...ys);
      const width = Math.max(...xs) - x, height = Math.max(...ys) - y;
      const screen = document.createElement("span");
      screen.className = "pc-screen";
      screen.dataset.seat = key;
      screen.style.setProperty("--x", x * scale / 15.36 + "%");
      screen.style.setProperty("--y", y * scale / 10.24 + "%");
      screen.style.setProperty("--screen-width", width * scale / 15.36 + "%");
      screen.style.setProperty("--screen-height", height * scale / 10.24 + "%");
      screen.style.setProperty("--screen-outline", "polygon(" + points.map(([px, py]) =>
        ((px - x) / width * 100).toFixed(2) + "% " + ((py - y) / height * 100).toFixed(2) + "%").join(",") + ")");
      return screen;
    }));
  }
  poweredMonitor = isSeated() && room.space === spaceId ? monitorLayer.children[room.seat] : null;
  const myAway = Boolean(activeBreakZone) && isSeated();
  for (const screen of monitorLayer.children) {
    const key = screen.dataset.seat;
    const isOn = screen === poweredMonitor || occupiedSeats.has(key);
    const isAway = (screen === poweredMonitor && myAway) || awaySeats.has(key);
    screen.classList.toggle("is-on", isOn);
    screen.classList.toggle("is-away", isAway);
  }
}

function openDesktop(fromSeat = false) {
  if (seatJourney || desktop.open) return;
  if (activeBreakZone) {
    window.cafeWorld?.exitRelaxZone?.();
  }
  if (!poweredMonitor) return;
  if (fromSeat) poweredMonitor.scrollIntoView({ block: "nearest" });
  desktopReturnFocus = fromSeat ? $("#seat-marker") : document.activeElement;
  window.prepareCafeWallpaper?.();
  setLauncherOpen(false);
  openCafeWindow(desktop, poweredMonitor);
  $("#pc-title").focus({ preventScroll: true });
}

function notify(message, kind = "info") {
  $(".u070").dispatchEvent(new CustomEvent("pcbang-notice", { detail: { message, kind } }));
}

function updateSessionTime() {
  if (!room.since) return;
  const elapsed = formatTime(Math.max(0, Math.floor((Date.now() - room.since) / 1000)));
  $("#session-time").textContent = elapsed;
  $("#pc-session-time").textContent = elapsed;
}

function renderSeatJourney() {
  const phase = seatJourney?.phase ?? "";
  if (journeyProgress.dataset.phase === phase) return;
  journeyProgress.dataset.phase = phase;
  const active = journeySteps.findIndex((step) => step.dataset.phase === phase);
  journeyProgress.hidden = active < 0;
  journeyProgress.style.setProperty("--p", Math.max(0, active) / (journeySteps.length - 1));
  journeySteps.forEach((step, index) => {
    step.classList.toggle("cur", index === active);
    step.classList.toggle("done", index < active);
  });
  const label = active === 0 ? seatJourney.seat.code + " 자리로 이동 중"
    : active === 1 ? "자리에 앉는 중" : active === 2 ? "PC 켜는 중" : "";
  journeyLabel.textContent = label;
  journeyStatus.textContent = label;
}

function renderRelaxHud() {
  if (!activeBreakZone) {
    relaxHud.hidden = true;
    return;
  }
  relaxHud.hidden = false;
  const seated = isSeated();
  const options = activeBreakZone === "booth"
    ? [
      { act: "smoke", label: "🚬 담배 한 모금" },
      { act: "candy", label: "🍭 멘솔 사탕 (비흡연)" },
      { switchZone: "terrace", label: "🌿 야외 흡연구역으로 이동" },
    ]
    : [
      { act: "coffee", label: "☕ 자판기 밀크커피 (무료)" },
      { act: "smoke", label: "🚬 바람 쐬며 한 모금" },
      { act: "candy", label: "🍭 막대사탕" },
      { switchZone: "booth", label: "🚬 실내 흡연구역으로" },
    ];

  relaxHud.replaceChildren(...options.map((opt) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "relax-chip";
    btn.textContent = opt.label;
    btn.addEventListener("click", () => {
      window.cafeAudioPlay?.("tick");
      if (opt.switchZone) {
        window.cafeWorld?.enterRelaxZone?.(opt.switchZone);
      } else {
        window.cafeWorld?.setActivity?.(opt.act);
        for (const sibling of relaxHud.querySelectorAll("[data-act]")) {
          sibling.setAttribute("aria-pressed", String(sibling === btn));
        }
      }
    });
    if (opt.act) btn.dataset.act = opt.act;
    return btn;
  }));

  const countChip = document.createElement("span");
  countChip.className = "relax-chip mono";
  countChip.id = "relax-zone-count";
  const zCount = window.cafeZoneCounts?.[activeBreakZone] || 1;
  countChip.textContent = `👥 이 구역 ${zCount}명`;
  relaxHud.prepend(countChip);

  const exitBtn = document.createElement("button");
  exitBtn.type = "button";
  exitBtn.className = "relax-chip relax-exit";
  exitBtn.textContent = seated ? "💻 내 PC 자리로 복귀" : "🚪 매장 홀로 나가기";
  exitBtn.addEventListener("click", () => window.cafeWorld?.exitRelaxZone?.());
  relaxHud.append(exitBtn);
}

document.addEventListener("cafe-zone-counts", ({ detail }) => {
  window.cafeZoneCounts = detail.counts || {};
  const chip = $("#relax-zone-count");
  if (chip && activeBreakZone) {
    const n = window.cafeZoneCounts[activeBreakZone] || 1;
    chip.textContent = `👥 이 구역 ${n}명`;
  }
});

// Each chair has a separate foreground sprite and a seated pose origin.
const roomChairs = {
  solo: [[205, 142, 69, 60]],
  duo: [[141, 143, 62, 58], [258, 143, 62, 58]],
  team: [[77, 136, 47, 43], [141, 136, 47, 43], [205, 136, 47, 43], [269, 136, 47, 43], [333, 136, 47, 43]],
  squad: [[124, 86, 43, 22], [210, 86, 43, 22], [290, 86, 43, 22], [114, 162, 57, 54], [212, 162, 57, 54], [309, 162, 57, 54]]
};
function chairGeometry(key) {
  const [space, index] = key.split(":");
  const chair = roomChairs[space]?.[index];
  if (!chair) return null;
  const [cx, top, width, height] = chair;
  const y = (top + height - 3) / 256 * 100;
  return { x: cx / 384 * 100, y, size: width * 1.22 / 384 * 100,
    depth: Math.round(y * 10), left: (cx - Math.floor(width / 2)) / 384 * 100,
    top: top / 256 * 100, width: width / 384 * 100 };
}

function renderChairFronts(space) {
  const layer = document.getElementById("cafe-avatars");
  if (layer.dataset.furniture === space) return;
  layer.dataset.furniture = space;
  layer.querySelectorAll(".chair-front").forEach(node => node.remove());
  for (const index of (roomChairs[space] ?? []).keys()) {
    const chair = chairGeometry(space + ":" + index);
    const node = document.createElement("img");
    node.className = "chair-front";
    node.alt = "";
    node.src = "./sprites/chair-" + space + "-" + index + ".png";
    Object.assign(node.style, { left: chair.left + "%", top: chair.top + "%",
      width: chair.width + "%", zIndex: String(chair.depth) });
    layer.append(node);
  }
}

function renderRoom() {
  const view = activeBreakZone ?? seatJourney?.space ?? room.space ?? "lobby";
  const space = spaces[view];
  const seated = isSeated();
  const inSubRoom = Boolean(space) && view !== "hall";
  const inBooth = view === "booth";
  const inTerrace = view === "terrace";
  const inSpecial = inSubRoom || inBooth || inTerrace;

  const scene = $(".scene");
  const oldView = scene.dataset.space;
  scene.dataset.space = view;
  if (window.cafeArt) {
    const area = view === "lobby" ? "hall" : view;
    const seats = (spaces[area]?.positions ?? []).map((_, index) => {
      const key = area + ":" + index;
      const point = window.cafeSeating.position(key);
      return { key, point, direction: area === "hall" ? (index % 2 ? "left" : "right") : "up" };
    });
    window.cafeArt.show(area, seats);
    if (oldView !== view) window.cafeArt.openDoor();
  } else {
    renderChairFronts(view);
    const hall = $("#lobby-art");
    if (!inSpecial) hall.src ||= hall.dataset.src;
    hall.hidden = inSpecial;
    if (inSubRoom) prepareRoomArt();
    if (inBooth) prepareZoneArt("booth");
    if (inTerrace) prepareZoneArt("terrace");
    roomsArtwork.hidden = !inSubRoom;
    roomsArtwork.alt = inSubRoom ? space.alt : "";
    boothArtwork.hidden = !inBooth;
    terraceArtwork.hidden = !inTerrace;
  }

  $("#cafe-joystick").hidden = Boolean((room.space && !activeBreakZone) || seatJourney);
  $("#kiosk-pin").hidden = inSpecial;
  $("#room-doors").hidden = inSpecial || Boolean(seatJourney);
  $("#quick-return-seat").hidden = !(activeBreakZone && seated);
  $("#game-view-pc").hidden = !seated || Boolean(activeBreakZone);

  $("#room-title").textContent = inBooth ? "실내 흡연구역"
    : inTerrace ? "야외 흡연구역 (2F 테라스)"
    : (space?.label ?? "PC방 입구");
  $("#room-count").textContent = inBooth ? "환기 가동 중"
    : inTerrace ? "우리 동네 · 밀크커피 자판기"
    : inSubRoom ? "정원 " + space.positions.length + "명" : "102석";
  $("#kiosk-title").textContent = seated ? "자리를 잡았어요!" : "어디에 앉을까요?";
  $("#kiosk-copy").textContent = seated
    ? (activeBreakZone ? "자리는 안전하게 맡아뒀어요. 편히 쉬다 오세요!" : "빗소리 들으며 편히 쉬어가세요.")
    : "전체 좌석도에서 앉고 싶은 자리를 골라요.";
  $("#kiosk-counts").hidden = seated;
  $("#stage-seated").hidden = !seated;
  $("#leave").hidden = !seated;
  $("#open-floor span").textContent = seated ? "좌석도에서 자리 바꾸기" : "전체 좌석도 열기";
  for (const button of document.querySelectorAll("#open-floor, #kiosk-pin, #game-view-floor, #open-monitor, #leave")) {
    button.disabled = Boolean(seatJourney);
  }
  renderSeatJourney();
  renderRelaxHud();
  renderMonitorPower(inBooth || inTerrace ? view : inSubRoom ? view : "hall");

  const marker = $("#seat-marker");
  marker.hidden = !seated || Boolean(seatJourney) || Boolean(activeBreakZone);
  if (seated) {
    const seat = floorSeats.get(room.space + ":" + room.seat);
    const homeRoom = spaces[room.space];
    const panel = window.cafeArt?.screen(seat.key);
    const [x, y] = panel ? [panel.x + panel.w / 2, panel.y - 2] : homeRoom.positions[room.seat];
    marker.toggleAttribute("data-pixel-seat", Boolean(panel));
    marker.style.setProperty("--x", x + "%");
    marker.style.setProperty("--y", y + "%");
    marker.textContent = seat.code;
    marker.setAttribute("aria-label", seat.code + " 내 PC 열기");
    const label = homeRoom.label + " · " + seat.code;
    $("#ticket-seat").textContent = label;
    $("#pc-seat").textContent = label;
    $("#room-hint").textContent = activeBreakZone
      ? `${seat.code} 자리를 비워두고 ${inBooth ? "실내 흡연구역" : "야외 흡연구역"}에서 쉬는 중이에요.`
      : `${seat.code} 자리에 앉았어요.`;
  } else {
    $("#room-hint").textContent = inBooth ? "환풍기가 돌아가는 실내 흡연구역이에요. 바닥을 눌러 이동해 보세요."
      : inTerrace ? "지금 내 위치의 하늘과 바람이 흐르는 야외 흡연구역이에요."
      : "입구 키오스크에서 자리를 고르거나 실내·야외 흡연구역을 둘러보세요.";
  }
  updateSessionTime();
  scheduleClock();
  document.dispatchEvent(new Event("cafe-seat-phase"));
}

window.cafeShowZone = (zoneId) => {
  activeBreakZone = zoneId || null;
  renderRoom();
};

function isMySeat(seat) {
  return seat.space === room.space && seat.index === room.seat;
}

function renderFloorSelection() {
  for (const seat of floorSeats.values()) {
    const mine = isMySeat(seat);
    const occupied = !mine && occupiedSeats.has(seat.key);
    seat.button.classList.toggle("my-seat", mine);
    seat.button.classList.toggle("taken", occupied);
    seat.button.disabled = occupied;
    seat.option.disabled = occupied;
    seat.button.setAttribute("aria-pressed", seat === selectedSeat);
    seat.button.setAttribute("aria-label", seat.label + " " + seat.code + (mine ? ", 내 자리" : occupied ? ", 이용 중" : ""));
  }
  const mine = selectedSeat && isMySeat(selectedSeat);
  const taken = selectedSeat && occupiedSeats.has(selectedSeat.key);
  $("#floor-selection").textContent = selectedSeat?.code ?? "선택 대기";
  $("#floor-detail").textContent = selectedSeat
    ? selectedSeat.label + (mine ? " · 내 자리" : taken ? " · 이용 중" : " · 이용 가능")
    : floor.dataset.room ? "이 룸에서 자리를 눌러주세요." : "일반석 또는 룸 영역을 눌러주세요.";
  $("#enter span").textContent = mine ? "현재 이용 중" : room.space ? "이 자리로 이동" : "이 자리로 입장";
  $("#enter").disabled = bookingSeat || !selectedSeat || mine || taken;
  floor.querySelector("[data-close]").disabled = bookingSeat;
  if (floorSelect.value !== (selectedSeat?.key ?? "")) floorSelect.value = selectedSeat?.key ?? "";
}

function appendSeatGroup(parent, label, spaceId, count, first = 0, letter = "") {
  const group = document.createElement("div");
  group.className = letter ? "floor-bank" : "floor-room";
  group.dataset.space = spaceId;
  const heading = document.createElement("h3");
  heading.textContent = letter ? letter + "열" : label;
  if (letter) {
    const [left, right] = hallBanks[first / bankSize].x;
    group.style.setProperty("--x", (left + right) / 30.72 + "%");
    if (hallRows.length) {
      const topPct = Math.max(4, (hallRows[0] / 10.24) - 5.6);
      const bottomPct = Math.max(8, 100 - ((hallRows[hallRows.length - 1] / 10.24) + 2.5));
      group.style.setProperty("--top", `${topPct.toFixed(1)}%`);
      group.style.setProperty("--bottom", `${bottomPct.toFixed(1)}%`);
    }
  } else {
    heading.className = "pc-sr-only";
  }
  group.append(heading);
  const grid = document.createElement("div");
  grid.className = "floor-seat-grid";
  group.append(grid);
  parent.append(group);

  const options = document.createElement("optgroup");
  options.label = label;
  floorOptions.push({ spaceId, options });
  for (let i = 0; i < count; i++) {
    const index = first + i;
    const code = letter + seatId(i);
    const key = spaceId + ":" + index;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "floor-seat mono";
    if (letter) button.tabIndex = -1;
    button.textContent = code;
    grid.append(button);
    const option = document.createElement("option");
    const seat = { space: spaceId, index, code, key, label, button, option };
    floorSeats.set(key, seat);
    button.addEventListener("click", () => {
      selectedSeat = seat;
      $("#floor-feedback").textContent = "";
      renderFloorSelection();
    });
    option.value = key;
    option.textContent = code + " · " + label;
    options.append(option);
  }
}

for (const [index, bank] of hallBanks.entries()) {
  appendSeatGroup($("#floor-banks"), bank.letter + "열 일반석", "hall", bankSize, index * bankSize, bank.letter);
}
for (const id of ["solo", "duo", "team", "squad"]) {
  appendSeatGroup($("#floor-rooms"), spaces[id].label, id, spaces[id].positions.length);
}
function syncFloorLandmarks() {
  const lm = window.cafeLayout?.landmarks;
  if (!lm) return;
  const setPos = (key, xPct, yPct, label) => {
    const el = document.querySelector(`.hall-seat-map [data-landmark="${key}"]`);
    if (!el) return;
    el.style.setProperty("--x", `${xPct.toFixed(1)}%`);
    el.style.setProperty("--y", `${yPct.toFixed(1)}%`);
    if (label) el.textContent = label;
  };
  const { toPct } = window.cafeLayout;
  const b = toPct(lm.booth.x, lm.booth.y); setPos("booth", b.xPct, b.yPct, lm.booth.label);
  const t = toPct(lm.terrace.x, lm.terrace.y); setPos("terrace", t.xPct, t.yPct, lm.terrace.label);
  const l = toPct(lm.lounge.x + lm.lounge.w / 2, lm.lounge.y + lm.lounge.h / 2); setPos("lounge", l.xPct, l.yPct, lm.lounge.label);
  const c = toPct(lm.counter.x + lm.counter.w / 2, lm.counter.y + lm.counter.h * 0.65); setPos("counter", c.xPct, c.yPct, lm.counter.label);
  const k = toPct(lm.kiosk.x + lm.kiosk.w / 2, lm.kiosk.y + lm.kiosk.h / 2); setPos("kiosk", k.xPct, k.yPct, lm.kiosk.label);
  const e = toPct(lm.entrance.x + lm.entrance.w / 2, lm.entrance.y + lm.entrance.h * 0.5); setPos("entrance", e.xPct, e.yPct, lm.entrance.label);
}
syncFloorLandmarks();

function showFloorView(roomId) {
  const inside = Boolean(roomId);
  floor.dataset.room = roomId ?? "";
  $("#floor-overview").hidden = inside;
  $("#floor-room-view").hidden = !inside;
  for (const panel of $("#floor-rooms").children) panel.hidden = panel.dataset.space !== roomId;
  if (inside) {
    $("#floor-room-title").textContent = spaces[roomId].label;
    $("#floor-room-count").textContent = "좌석 " + spaces[roomId].positions.length + "개";
  }
  $("#floor-instruction").textContent = inside
    ? "이 룸에서 이용할 자리를 골라주세요."
    : "일반석을 고르거나 룸 영역을 눌러 내부 좌석을 보세요.";
  floorSelect.replaceChildren(floorSelect.options[0],
    ...floorOptions.filter(({ spaceId }) => spaceId === (roomId ?? "hall")).map(({ options }) => options));
  selectedSeat = null;
  $("#floor-feedback").textContent = "";
  renderFloorSelection();
  if (floor.open) revealCafeView($(inside ? "#floor-room-view" : "#floor-overview"), inside ? 1 : -1);
}

function openFloor(roomId, origin) {
  if (seatJourney || floor.open) return;
  const source = cafeWindowOrigin(origin);
  if (hub.open) hub.close();
  showFloorView(roomId);
  openCafeWindow(floor, origin, source);
  $(roomId ? "#floor-room-title" : "#floor-title").focus({ preventScroll: true });
}
for (const region of document.querySelectorAll(".floor-room-target")) {
  const openRoom = () => {
    if (bookingSeat) return;
    showFloorView(region.dataset.room);
    $("#floor-room-title").focus({ preventScroll: true });
  };
  region.addEventListener("click", (event) => {
    event.preventDefault();
    openRoom();
  });
  region.addEventListener("keydown", (event) => {
    if (event.key !== " ") return;
    event.preventDefault();
    openRoom();
  });
}
$("#floor-back").addEventListener("click", () => {
  if (bookingSeat) return;
  const previousRoom = floor.dataset.room;
  showFloorView(null);
  $('.floor-room-target[data-room="' + previousRoom + '"]')?.focus();
});
floor.addEventListener("cancel", (event) => {
  if (bookingSeat) event.preventDefault();
});
for (const button of document.querySelectorAll("#kiosk-pin, #open-floor, #game-view-floor")) {
  button.addEventListener("click", () => openFloor(null, button));
}
$("#cafe-menu-open").addEventListener("click", (event) => { if (!hub.open) openCafeWindow(hub, event.currentTarget); });
$("#open-monitor").addEventListener("click", () => openDesktop());
$("#seat-marker").addEventListener("click", () => openDesktop());
$("#quick-booth")?.addEventListener("click", () => window.cafeWorld?.enterRelaxZone?.("booth"));
$("#quick-terrace")?.addEventListener("click", () => window.cafeWorld?.enterRelaxZone?.("terrace"));
$("#quick-return-seat")?.addEventListener("click", () => {
  window.cafeWorld?.exitRelaxZone?.();
  setTimeout(() => openDesktop(true), 120);
});
document.querySelectorAll("[data-pc-break]").forEach((btn) => {
  btn.addEventListener("click", () => window.cafeWorld?.enterRelaxZone?.(btn.dataset.pcBreak));
});

desktop.addEventListener("close", () => desktopReturnFocus?.focus({ preventScroll: true }));
const startMenu = $("#pc-start");
const launcher = $("#pc-launcher");
const launcherClose = $("#pc-launcher-close");
function setLauncherOpen(open, focusTitle = false) {
  if (!launcher) return;
  launcher.hidden = !open;
  document.querySelectorAll("[data-launcher]").forEach((btn) => {
    btn.setAttribute("aria-expanded", String(open));
  });
  if (open && focusTitle) $("#pc-launcher-title")?.focus({ preventScroll: true });
}
desktop.addEventListener("close", () => {
  startMenu.open = false;
  setLauncherOpen(false);
});
desktop.addEventListener("cancel", (event) => {
  if (startMenu.open) {
    event.preventDefault();
    startMenu.open = false;
    startMenu.querySelector("summary").focus();
    return;
  }
  if (launcher && !launcher.hidden) {
    event.preventDefault();
    setLauncherOpen(false);
    document.querySelector(".pc-shortcut[data-launcher]")?.focus();
  }
});
startMenu.addEventListener("click", (event) => {
  if (event.target.closest("button")) startMenu.open = false;
});
document.querySelectorAll("[data-launcher]").forEach((button) => {
  button.setAttribute("aria-expanded", "false");
  button.addEventListener("click", () => {
    const fromStartMenu = Boolean(startMenu.contains(button));
    if (fromStartMenu) startMenu.open = false;
    const nextOpen = fromStartMenu ? true : Boolean(launcher?.hidden);
    setLauncherOpen(nextOpen, nextOpen);
  });
});
launcherClose?.addEventListener("click", () => {
  setLauncherOpen(false);
  document.querySelector(".pc-shortcut[data-launcher]")?.focus();
});
floorSelect.addEventListener("change", () => {
  selectedSeat = floorSeats.get(floorSelect.value) ?? null;
  $("#floor-feedback").textContent = "";
  renderFloorSelection();
});
$("#floor-zoom").addEventListener("click", (event) => {
  const button = event.currentTarget;
  const zoomed = button.getAttribute("aria-pressed") === "false";
  button.setAttribute("aria-pressed", zoomed);
  button.textContent = zoomed ? "− 축소" : "＋ 확대";
  $("#floor-scroll").classList.toggle("zoomed", zoomed);
});
$("#enter").addEventListener("click", async () => {
  if (bookingSeat || !selectedSeat || isMySeat(selectedSeat)) return;
  const seat = selectedSeat;
  const previous = window.cafeSeating.current();
  let journey;
  bookingSeat = true;
  activeBreakZone = null;
  $("#floor-feedback").textContent = "좌석을 확인하고 있어요.";
  renderFloorSelection();
  try {
    if (!window.cafeWorld) throw new Error("Connecting");
    if (!await window.cafeWorld.reserve(seat.key)) {
      $("#floor-feedback").textContent = "다른 손님이 먼저 앉았어요. 다른 자리를 골라주세요.";
      return;
    }
    journey = { seat, space: room.space ?? "lobby", phase: "walking" };
    seatJourney = journey;
    room.space = seat.space;
    room.seat = seat.index;
    room.since ??= Date.now();
    saveState(roomKey, room);
    if (seat.space !== "hall") prepareRoomArt();
    window.prepareCafeWallpaper?.();
    floor.close();
    renderRoom();
    const scene = $(".scene");
    if (!document.body.classList.contains("cafe-fullscreen")) {
      scene.parentElement.scrollIntoView({ block: "center", behavior: "instant" });
    }
    scene.focus({ preventScroll: true });
    await window.cafeWorld.walkToSeat(seat.key, previous, (space) => {
      journey.space = space;
      renderRoom();
    });
    if (seatJourney !== journey) return;
    journey.space = seat.space;
    if (!reduceSeatMotion.matches) {
      journey.phase = "sitting";
      renderRoom();
      await new Promise((resolve) => setTimeout(resolve, 310));
      if (seatJourney !== journey) return;
      journey.phase = "booting";
      window.cafeAudioPlay?.("pop");
      renderRoom();
      await new Promise((resolve) => setTimeout(resolve, window.cafeArt ? 800 : 290));
      if (seatJourney !== journey) return;
    }
    seatJourney = null;
    renderRoom();
    window.recordCafeStamp("seat");
    openDesktop(true);
    if (!desktop.open) $("#kiosk-title").focus();
  } catch {
    if (!journey) {
      $("#floor-feedback").textContent = "매장에 연결되지 않았어요. 잠시 뒤 다시 눌러주세요.";
    } else if (seatJourney === journey) {
      seatJourney = null;
      window.cafeWorld.cancelWalk();
      renderRoom();
      $("#seat-marker").focus({ preventScroll: true });
      notify("자리 예약은 완료됐어요. 내 PC를 눌러 열어주세요.");
    }
  } finally {
    bookingSeat = false;
    renderFloorSelection();
  }
});

function clearSeat() {
  seatJourney = null;
  activeBreakZone = null;
  window.cafeWorld?.cancelWalk();
  desktopReturnFocus = null;
  if (desktop.open) desktop.close();
  Object.assign(room, { space: null, seat: null, since: null, snack: "", order: null });
  saveState(roomKey, room);
  renderRoom();
  $("#open-floor").focus();
}
let leavingSeat = false;
async function leaveSeat() {
  if (leavingSeat || !room.space) return;
  leavingSeat = true;
  if (desktop.open) desktop.close();
  await window.cafeWorld?.standFromSeat?.();
  leavingSeat = false;
  if (!room.space) return;
  window.cafeWorld?.release();
  clearSeat();
  notify("자리를 비웠어요. 언제든 다시 들러요.");
}
$("#leave").addEventListener("click", leaveSeat);
$("#pc-end").addEventListener("click", leaveSeat);

// All 11 Mini-Games Lazy Loaders!
const gameLoaders = {
  pvp: () => import("./pvp.js").then(({ initPvp }) => initPvp()),
  tetris: () => import("./tetris.js").then(({ initTetris }) => initTetris()),
  bungeoppang: () => import("./tycoons.js").then(({ initBungeoppang }) => initBungeoppang()),
  "snack-tycoon": () => import("./tycoons.js").then(({ initSnackTycoon }) => initSnackTycoon()),
  acidrain: () => import("./acidrain.js").then(({ initAcidRain }) => initAcidRain()),
  arcade: () => import("./game.js").then(({ initArcade }) => initArcade()),
  mines: () => import("./game.js").then(({ initMines }) => initMines()),
  sudoku: () => import("./sudoku.js").then(({ initSudoku }) => initSudoku()),
  merge: () => import("./merge.js").then(({ initMerge }) => initMerge()),
  solitaire: () => import("./solitaire.js").then(({ initSolitaire }) => initSolitaire()),
  knit: () => import("./knit-unravel.js").then(({ initKnitUnravel }) => initKnitUnravel()),
};
const requestedGames = new Set();

window.openCafeWindow = openCafeWindow;
window.closeCafeWindow = closeCafeWindow;

document.querySelectorAll("[data-open]").forEach((button) => {
  button.addEventListener("click", () => {
    const source = cafeWindowOrigin(button);
    if (hub.contains(button) && hub.open) hub.close();
    if (launcher && launcher.contains(button)) setLauncherOpen(false);
    const next = document.getElementById(button.dataset.open);
    if (!next) return;
    const origin = button.closest("dialog");
    if (origin?.matches("#snacks, #snack-board, #snack-coupon, #snack-gift")) origin.close();
    if (!next.open) {
      openCafeWindow(next, button, source);
      if (next.id === "focus") {
        window.cafeWorld?.setActivity?.("focus");
        renderTimer();
      }
    }
    const load = gameLoaders[next.id];
    if (!load || requestedGames.has(next.id)) return;
    requestedGames.add(next.id);
    load().catch(() => {
      requestedGames.delete(next.id);
      const st = next.querySelector(".game-status");
      if (st) st.textContent = "게임을 불러오지 못했어요. 페이지를 새로고침해 주세요.";
    });
  });
});
document.querySelectorAll("[data-close]").forEach((button) => {
  button.addEventListener("click", () => closeCafeWindow(button.closest("dialog")));
});

const focusDialog = $("#focus");
focusDialog.addEventListener("close", () => {
  if (!focus.end) window.cafeWorld?.setActivity?.("");
});
const focusMinutesInput = $("#focus-minutes");
const focusDurationError = $("#focus-duration-error");
const focusSoundToggle = $("#focus-sound");
const focusComplete = $("#focus-complete");
let focusAudioContext = null;
focusMinutesInput.value = focus.durationMinutes === null ? "" : String(focus.durationMinutes);
focusSoundToggle.checked = focus.soundEnabled;

function focusDurationMs() {
  return focus.durationMinutes * 60_000;
}

function presentPendingFocusCompletion() {
  if (!focus.completionPending) return;
  focus.completionPending = false;
  focus.completionAnnounced = true;
  saveState(focusKey, focus);
  notify("집중 시간이 끝났어요! +40 G 적립!");
  window.cafeEarnPoints?.(40, "집중 모드 완주");
  showFocusCompletion({ animate: !skipFocusCompletionEffects, sound: !skipFocusCompletionEffects });
}

function setFocusDurationError(message) {
  focusDurationError.textContent = message;
  focusMinutesInput.setAttribute("aria-invalid", String(Boolean(message)));
}

function closeFocusAudio() {
  if (!focusAudioContext) return;
  const context = focusAudioContext;
  focusAudioContext = null;
  context.close().catch(() => {});
}

function unlockFocusAudio() {
  if (!focus.soundEnabled) return null;
  const AudioEngine = window.AudioContext || window.webkitAudioContext;
  if (!AudioEngine) return null;
  try {
    focusAudioContext ??= new AudioEngine();
    if (focusAudioContext.state === "suspended") focusAudioContext.resume().catch(() => {});
    return focusAudioContext;
  } catch {
    return null;
  }
}

function playFocusCompletionSound() {
  const context = focusAudioContext;
  if (!context || context.state !== "running") return false;
  const now = context.currentTime;
  const notes = [523.25, 659.25, 783.99];
  notes.forEach((frequency, index) => {
    const start = now + index * .12;
    const oscillator = context.createOscillator();
    const volume = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, start);
    volume.gain.setValueAtTime(.0001, start);
    volume.gain.exponentialRampToValueAtTime(.16, start + .018);
    volume.gain.exponentialRampToValueAtTime(.0001, start + .21);
    oscillator.connect(volume).connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + .23);
    oscillator.addEventListener("ended", () => {
      oscillator.disconnect();
      volume.disconnect();
    }, { once: true });
  });
  const playbackContext = context;
  window.setTimeout(() => {
    if (focusAudioContext !== playbackContext || focus.end) return;
    closeFocusAudio();
  }, 750);
  return true;
}

function hideFocusCompletion() {
  focusComplete.hidden = true;
  focusComplete.classList.remove("is-complete", "is-settled");
  focusDialog.classList.remove("is-complete");
}

function showFocusCompletion({ animate = false, sound = false } = {}) {
  if (!focus.completed) return;
  focusComplete.hidden = false;
  const playAnimation = animate && !focus.completionEffectsShown && focusDialog.open && !document.hidden &&
    !matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (playAnimation) {
    focusComplete.classList.remove("is-settled", "is-complete");
    requestAnimationFrame(() => {
      if (!focus.completed || !focusDialog.open || focusComplete.hidden) return;
      focusComplete.classList.add("is-complete");
      focusDialog.classList.add("is-complete");
      focus.completionEffectsShown = true;
      saveState(focusKey, focus);
    });
  } else {
    focusComplete.classList.add("is-complete", "is-settled");
    focusDialog.classList.add("is-complete");
    focus.completionEffectsShown = true;
    saveState(focusKey, focus);
  }
  if (sound && focus.soundEnabled && !focus.completionSoundPlayed && !document.hidden) {
    if (playFocusCompletionSound()) {
      focus.completionSoundPlayed = true;
      saveState(focusKey, focus);
    }
  }
}

function completeFocus() {
  const completionPending = document.hidden;
  Object.assign(focus, {
    remaining: 0,
    end: null,
    completed: true,
    completionPending,
    completionAnnounced: !completionPending,
  });
  saveState(focusKey, focus);
  window.cafeWorld?.setActivity?.("");
  if (completionPending) {
    if (focus.soundEnabled && !focus.completionSoundPlayed && playFocusCompletionSound()) {
      focus.completionSoundPlayed = true;
      saveState(focusKey, focus);
    }
    return;
  }
  notify("집중 시간이 끝났어요! +40 G 적립!");
  window.cafeEarnPoints?.(40, "집중 모드 완주");
  showFocusCompletion({ animate: !skipFocusCompletionEffects, sound: !skipFocusCompletionEffects });
}

function updateFocusDuration() {
  const minutes = focusMinutesInput.valueAsNumber;
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > maximumFocusMinutes) {
    setFocusDurationError(focusMinutesInput.value === ""
      ? "집중할 시간을 입력해 주세요."
      : `1분부터 ${maximumFocusMinutes}분 사이로 입력해 주세요.`);
    renderTimer();
    return false;
  }
  setFocusDurationError("");
  if (minutes !== focus.durationMinutes || focus.completed || !focus.durationMinutes) {
    Object.assign(focus, {
      durationMinutes: minutes,
      remaining: minutes * 60_000,
      end: null,
      completed: false,
      completionPending: false,
      completionAnnounced: false,
      completionEffectsShown: false,
      completionSoundPlayed: false,
    });
    skipFocusCompletionEffects = false;
    hideFocusCompletion();
    saveState(focusKey, focus);
    renderTimer();
    scheduleClock();
  }
  return true;
}

focusMinutesInput.addEventListener("change", updateFocusDuration);
focusMinutesInput.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  if (updateFocusDuration()) $("#timer-toggle").click();
});
focusMinutesInput.addEventListener("input", () => {
  const minutes = focusMinutesInput.valueAsNumber;
  setFocusDurationError(Number.isInteger(minutes) && minutes >= 1 && minutes <= maximumFocusMinutes
    ? ""
    : focusMinutesInput.value === "" ? "집중할 시간을 입력해 주세요."
      : `1분부터 ${maximumFocusMinutes}분 사이로 입력해 주세요.`);
  renderTimer();
});
focusSoundToggle.addEventListener("change", () => {
  focus.soundEnabled = focusSoundToggle.checked;
  saveState(focusKey, focus);
  if (focus.soundEnabled && focus.end) unlockFocusAudio();
});

function remainingTime() {
  return focus.end ? Math.max(0, focus.end - Date.now()) : focus.remaining;
}

const paintFocusMotion = createCafeFocusMotion($("#focus"));

function renderTimer() {
  const duration = focusDurationMs();
  const remaining = duration ? remainingTime() : 0;
  if (focus.end && duration && remaining === 0) {
    completeFocus();
  } else if (focus.completed) {
    showFocusCompletion();
  }
  const display = duration ? formatTime(Math.ceil(remaining / 1000)) : "00:00";
  paintFocusMotion(display, duration ? remaining / duration : 0, Boolean(focus.end), duration);
  $("#timer").classList.toggle("empty", !duration);
  const selectedMinutes = focusMinutesInput.valueAsNumber;
  const validSelection = Number.isInteger(selectedMinutes) && selectedMinutes >= 1 && selectedMinutes <= maximumFocusMinutes;
  $("#timer-toggle").disabled = !focus.end && !validSelection;
  $("#timer-toggle").textContent = focus.end ? "일시 정지"
    : focus.completed ? "다시 시작"
      : remaining < duration ? "이어서 집중" : "집중 시작";
  $("#timer-note").textContent = focus.completed ? "집중 완료. 잠깐 쉬어가요."
    : focus.end ? "창을 닫아도 타이머는 계속 돌아가요."
      : !duration ? "집중할 시간을 입력해 주세요." : "집중할 시간을 입력하고 시작하세요.";
  $("#focus-minutes").disabled = Boolean(focus.end);
  $("#focus-sound").disabled = Boolean(focus.end);
}

$("#timer-toggle").addEventListener("click", () => {
  if (focus.end) {
    const remaining = remainingTime();
    if (remaining === 0) {
      renderTimer();
      scheduleClock();
      return;
    }
    focus.remaining = remaining;
    focus.end = null;
    closeFocusAudio();
  } else {
    if (!updateFocusDuration()) return;
    const duration = focusDurationMs();
    if (focus.remaining === 0) focus.remaining = duration;
    focus.completed = false;
    focus.completionPending = false;
    focus.completionAnnounced = false;
    focus.completionEffectsShown = false;
    focus.completionSoundPlayed = false;
    skipFocusCompletionEffects = false;
    hideFocusCompletion();
    focus.end = Date.now() + focus.remaining;
    window.cafeWorld?.setActivity?.("focus");
    if (focus.soundEnabled) unlockFocusAudio();
  }
  saveState(focusKey, focus);
  renderTimer();
  scheduleClock();
});
$("#timer-reset").addEventListener("click", () => {
  Object.assign(focus, {
    remaining: focus.durationMinutes ? focusDurationMs() : 0,
    end: null,
    completed: false,
    completionPending: false,
    completionAnnounced: false,
    completionEffectsShown: false,
    completionSoundPlayed: false,
  });
  skipFocusCompletionEffects = false;
  hideFocusCompletion();
  closeFocusAudio();
  saveState(focusKey, focus);
  renderTimer();
  scheduleClock();
});
window.addEventListener("pagehide", closeFocusAudio);

const localTime = new Intl.DateTimeFormat("ko-KR", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23"
});
let lastClock;
let clockTimeout;
function scheduleClock() {
  clearTimeout(clockTimeout);
  if (document.hidden) {
    if (focus.end) clockTimeout = setTimeout(tick, Math.max(0, focus.end - Date.now()));
    return;
  }
  const interval = room.since || focus.end ? 1000 : 60_000;
  clockTimeout = setTimeout(tick, interval - Date.now() % interval);
}

function tick() {
  const time = localTime.format(new Date());
  if (time !== lastClock) {
    $("#clock").textContent = time;
    $("#pc-clock").textContent = time;
    const hudClock = $("#hud-clock");
    if (hudClock) hudClock.textContent = time;
    lastClock = time;
  }
  updateSessionTime();
  if (focus.end) renderTimer();
  scheduleClock();
}

let rainContext;
let rainGain;

function makeRain(AudioEngine) {
  rainContext = new AudioEngine();
  const buffer = rainContext.createBuffer(1, rainContext.sampleRate * 4, rainContext.sampleRate);
  const samples = buffer.getChannelData(0);
  let low = 0;
  for (let i = 0; i < samples.length; i++) {
    const white = Math.random() * 2 - 1;
    low = low * .94 + white * .06;
    samples[i] = .18 * white + .83 * low;
  }
  const rain = rainContext.createBufferSource();
  rain.buffer = buffer;
  rain.loop = true;
  const filter = rainContext.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 1950;
  rainGain = rainContext.createGain();
  rainGain.gain.value = 0;
  rain.connect(filter).connect(rainGain).connect(rainContext.destination);
  rain.start();
}

$(".hub-ambience").append($(".top-actions"));
const hudRainBtn = $("#hud-rain-toggle");
const rainSwitchBtn = document.querySelector(".top-actions .u013-sw");
function syncHudRainButton(enabled) {
  if (!hudRainBtn) return;
  hudRainBtn.setAttribute("aria-pressed", String(enabled));
  hudRainBtn.title = enabled ? "빗소리 켜짐 (누르면 끄기)" : "빗소리 꺼짐 (누르면 켜기)";
}
hudRainBtn?.addEventListener("click", () => rainSwitchBtn?.click());
connectCafeSwitch(document.querySelector(".top-actions .u013"), async (enabled) => {
  const AudioEngine = window.AudioContext || window.webkitAudioContext;
  if (!AudioEngine) {
    notify("이 브라우저에서는 빗소리를 재생할 수 없어요.", "err");
    syncHudRainButton(false);
    return false;
  }
  try {
    if (!rainContext) makeRain(AudioEngine);
    await rainContext.resume();
    rainGain.gain.setTargetAtTime(enabled ? .42 : 0, rainContext.currentTime, .13);
    syncHudRainButton(enabled);
    return true;
  } catch {
    notify("빗소리를 켜지 못했어요. 잠시 후 다시 눌러주세요.", "err");
    syncHudRainButton(false);
    return false;
  }
});

window.cafeSeating = {
  placeRoomDoors(portals, relaxPortals = {}) {
    window.cafeArt?.placeDoors(portals, relaxPortals);
    const container = $("#room-doors");
    container.replaceChildren();
    for (const [id, point] of Object.entries(portals)) {
      const door = document.createElement("button");
      door.type = "button";
      door.className = "stage-room-door";
      door.dataset.room = id;
      door.textContent = spaces[id].label;
      door.setAttribute("aria-label", spaces[id].label + " 입구");
      door.style.setProperty("--x", point.x + "%");
      door.style.setProperty("--y", point.y + "%");
      door.addEventListener("click", () => openFloor(id, door));
      container.append(door);
    }
    for (const [zoneId, point] of Object.entries(relaxPortals)) {
      const door = document.createElement("button");
      door.type = "button";
      door.className = "stage-room-door";
      door.dataset.relax = zoneId;
      door.textContent = (zoneId === "booth" ? "🚬 " : "🌙 ") + point.label;
      door.setAttribute("aria-label", point.label + " 입장");
      door.style.setProperty("--x", point.x + "%");
      door.style.setProperty("--y", point.y + "%");
      door.addEventListener("click", () => window.cafeWorld?.enterRelaxZone?.(zoneId));
      container.append(door);
    }
    document.addEventListener("cafe-zone-counts", ({ detail }) => {
      for (const [zoneId, point] of Object.entries(relaxPortals)) {
        const btn = container.querySelector(`[data-relax="${zoneId}"]`);
        if (!btn) continue;
        const n = detail.counts?.[zoneId] || 0;
        btn.textContent = (zoneId === "booth" ? "🚬 " : "🌙 ") + point.label + (n ? ` (${n})` : "");
      }
    });
  },
  current: () => room.space ? room.space + ":" + room.seat : null,
  phase: () => seatJourney?.phase ?? null,
  label(key) { return floorSeats.get(key)?.code ?? null; },
  chair: chairGeometry,
  trayPosition(key) {
    const placement = window.cafeArt?.tray(key);
    if (placement) return placement;
    const seat = floorSeats.get(key);
    if (!seat) return null;
    const [x, y] = spaces[seat.space].positions[seat.index];
    if (seat.space === "hall") return { x: x + (seat.index % 2 ? -1.2 : 1.2), y: y - 1 };
    const chair = chairGeometry(key);
    return { x: chair.x - chair.width * .43, y: chair.top - 1 };
  },
  position(key) {
    const chair = chairGeometry(key);
    if (chair) return { x: chair.x, y: chair.y };
    const seat = floorSeats.get(key);
    if (!seat) return null;
    const [x, y] = spaces[seat.space].positions[seat.index];
    return seat.space === "hall"
      ? { x: x + (seat.index % 2 ? 2 : -2), y: y + 2.6 }
      : { x, y: { solo: 74, duo: 70, team: 68, squad: seat.index < 3 ? 33 : 76 }[seat.space] };
  },
  refresh(keys, peerList = []) {
    occupiedSeats = new Set(keys);
    awaySeats = new Set(peerList.filter((p) => p.seat && (p.zone === "booth" || p.zone === "terrace")).map((p) => p.seat));
    const space = $(".scene").dataset.space;
    renderMonitorPower(space === "lobby" ? "hall" : space);
    if (floor.open) renderFloorSelection();
  },
  lose(key) {
    if (this.current() !== key) return;
    clearSeat();
    notify("연결이 끊긴 사이 다른 손님이 그 자리에 앉았어요.", "info");
  },
};
renderRoom();
if (room.space) window.recordCafeStamp("seat");
renderTimer();
tick();
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    clearTimeout(clockTimeout);
    scheduleClock();
    return;
  }
  presentPendingFocusCompletion();
  tick();
});
