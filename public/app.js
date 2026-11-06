"use strict";

const $ = (selector) => document.querySelector(selector);
const seatId = (index) => String(index + 1).padStart(2, "0");
const formatTime = (seconds) => [Math.floor(seconds / 60), seconds % 60]
  .map((value) => String(value).padStart(2, "0")).join(":");
const roomKey = "neon-pcbang-room";
const focusKey = "neon-pcbang-focus";
const focusDuration = 25 * 60 * 1000;

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
  } catch {
    // Controls still work for this visit when storage is disabled.
  }
}

const hallBanks = [
  { letter: "A", x: [428, 491] },
  { letter: "B", x: [651, 714] },
  { letter: "C", x: [892, 955] },
  { letter: "D", x: [1133, 1196] }
];
const hallRows = [196, 244, 291, 338, 386, 434, 481, 529, 577, 626, 675];
const bankSize = hallRows.length * 2;
const spaces = {
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
  // Preserve sessions saved before room types were added.
  const legacySpace = room.seat === 0 ? "solo" : room.seat < 3 ? "duo" : "team";
  const firstSeat = { solo: 0, duo: 1, team: 3 };
  room.space = legacySpace;
  room.seat -= firstSeat[legacySpace];
  saveState(roomKey, room);
}
const focus = readState(focusKey, { remaining: focusDuration, end: null });
const floor = $("#floor-kiosk");
const hub = $("#cafe-menu");
const floorSelect = $("#floor-select");
const floorSeats = new Map();
const floorOptions = [];
const desktop = $("#pc-desktop");
const monitorLayer = $("#monitor-layer");
const roomsArtwork = $("#rooms-art");
const journeyProgress = $("#seat-journey");
const journeyLabel = $("#seat-journey-label");
const journeyStatus = $("#seat-journey-status");
const journeySteps = [...journeyProgress.querySelectorAll("[data-phase]")];
let selectedSeat = null;
let poweredMonitor = null;
let desktopReturnFocus;
let occupiedSeats = new Set();
let bookingSeat = false;
let seatJourney = null;
const reduceSeatMotion = matchMedia("(prefers-reduced-motion: reduce)");

function isSeated() {
  return Boolean(room.space) && (!seatJourney || seatJourney.phase === "booting");
}

function prepareRoomArt() {
  if (!roomsArtwork.hasAttribute("src")) roomsArtwork.src = roomsArtwork.dataset.src;
}

function renderMonitorPower(spaceId) {
  if (monitorLayer.dataset.space !== spaceId) {
    monitorLayer.dataset.space = spaceId;
    const groups = spaceId === "hall"
      ? ["hall", "hall-solo", "hall-duo", "hall-team", "hall-squad"] : [spaceId];
    const scale = spaceId === "hall" ? 1 : 2;
    const panels = groups.flatMap((group) => cafeScreenShapes[group].map((points, index) =>
      [group.replace("hall-", "") + ":" + index, points]));
    monitorLayer.replaceChildren(...panels.map(([key, points], index) => {
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
      screen.style.setProperty("--screen-offset", -(index % 13) * 0.71 + "s");
      screen.style.setProperty("--screen-outline", "polygon(" + points.map(([px, py]) =>
        ((px - x) / width * 100).toFixed(2) + "% " + ((py - y) / height * 100).toFixed(2) + "%").join(",") + ")");
      return screen;
    }));
  }
  poweredMonitor = isSeated() && room.space === spaceId ? monitorLayer.children[room.seat] : null;
  for (const screen of monitorLayer.children) {
    screen.classList.toggle("is-on", screen === poweredMonitor || occupiedSeats.has(screen.dataset.seat));
  }
}

function openDesktop(fromSeat = false) {
  if (seatJourney || !poweredMonitor || desktop.open) return;
  if (fromSeat) poweredMonitor.scrollIntoView({ block: "nearest" });
  desktopReturnFocus = fromSeat ? $("#seat-marker") : document.activeElement;
  window.prepareCafeWallpaper?.();
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

function renderRoom() {
  const view = seatJourney?.space ?? room.space ?? "lobby";
  const space = spaces[view];
  const seated = isSeated();
  const inRoom = Boolean(space) && view !== "hall";
  $(".scene").dataset.space = view;
  $("#lobby-art").hidden = inRoom;
  if (inRoom) prepareRoomArt();
  roomsArtwork.hidden = !inRoom;
  roomsArtwork.alt = inRoom ? space.alt : "";
  $("#cafe-joystick").hidden = Boolean(room.space || seatJourney);
  $("#kiosk-pin").hidden = inRoom;
  $("#room-doors").hidden = inRoom || Boolean(seatJourney);
  $("#room-title").textContent = space?.label ?? "PC방 입구";
  $("#room-count").textContent = inRoom ? "정원 " + space.positions.length + "명" : "102석";
  $("#kiosk-title").textContent = seated ? "자리를 잡았어요!" : "어디에 앉을까요?";
  $("#kiosk-copy").textContent = seated ? "빗소리 들으며 편히 쉬어가세요." : "전체 좌석도에서 앉고 싶은 자리를 골라요.";
  $("#kiosk-counts").hidden = seated;
  $("#stage-seated").hidden = !seated;
  $("#leave").hidden = !seated;
  $("#open-floor span").textContent = seated ? "좌석도에서 자리 바꾸기" : "전체 좌석도 열기";
  for (const button of document.querySelectorAll("#open-floor, #kiosk-pin, #game-view-floor, #open-monitor, #leave")) {
    button.disabled = Boolean(seatJourney);
  }
  renderSeatJourney();
  renderMonitorPower(inRoom ? view : "hall");

  const marker = $("#seat-marker");
  marker.hidden = !seated || Boolean(seatJourney);
  if (seated) {
    const seat = floorSeats.get(room.space + ":" + room.seat);
    const [x, y] = space.positions[room.seat];
    marker.style.setProperty("--x", x + "%");
    marker.style.setProperty("--y", y + "%");
    marker.textContent = seat.code;
    marker.setAttribute("aria-label", seat.code + " 내 PC 열기");
    const label = space.label + " · " + seat.code;
    $("#ticket-seat").textContent = label;
    $("#pc-seat").textContent = label;
    $("#room-hint").textContent = seat.code + " 자리에 앉았어요.";
  } else {
    $("#room-hint").textContent = "입구 왼쪽의 민트색 키오스크를 눌러보세요.";
  }
  updateSessionTime();
  scheduleClock();
  document.dispatchEvent(new Event("cafe-seat-phase"));
}

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
desktop.addEventListener("close", () => desktopReturnFocus?.focus({ preventScroll: true }));
const startMenu = $("#pc-start");
desktop.addEventListener("close", () => { startMenu.open = false; });
desktop.addEventListener("cancel", (event) => {
  if (!startMenu.open) return;
  event.preventDefault();
  startMenu.open = false;
  startMenu.querySelector("summary").focus();
});
startMenu.addEventListener("click", (event) => {
  if (event.target.closest("button")) startMenu.open = false;
});
document.querySelectorAll("[data-launcher]").forEach((button) => {
  button.addEventListener("click", () => $("#pc-launcher-title").focus());
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
      renderRoom();
      await new Promise((resolve) => setTimeout(resolve, 290));
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
  window.cafeWorld?.cancelWalk();
  desktopReturnFocus = null;
  if (desktop.open) desktop.close();
  Object.assign(room, { space: null, seat: null, since: null, snack: "", order: null });
  saveState(roomKey, room);
  renderRoom();
  $("#open-floor").focus();
}
function leaveSeat() {
  window.cafeWorld?.release();
  clearSeat();
  notify("자리를 비웠어요. 언제든 다시 들러요.");
}
$("#leave").addEventListener("click", leaveSeat);
$("#pc-end").addEventListener("click", leaveSeat);


const gameLoaders = {
  arcade: () => import("./game.js").then(({ initArcade }) => initArcade()),
  mines: () => import("./game.js").then(({ initMines }) => initMines()),
  sudoku: () => import("./sudoku.js").then(({ initSudoku }) => initSudoku()),
  merge: () => import("./merge.js").then(({ initMerge }) => initMerge()),
};
const requestedGames = new Set();

document.querySelectorAll("[data-open]").forEach((button) => {
  button.addEventListener("click", () => {
    const source = cafeWindowOrigin(button);
    if (hub.contains(button) && hub.open) hub.close();
    const next = document.getElementById(button.dataset.open);
    const origin = button.closest("dialog");
    if (origin?.matches("#snacks, #snack-board, #snack-coupon")) origin.close();
    if (!next.open) {
      openCafeWindow(next, button, source);
      if (next.id === "focus") renderTimer();
    }
    const load = gameLoaders[next.id];
    if (!load || requestedGames.has(next.id)) return;
    requestedGames.add(next.id);
    load().catch(() => {
      requestedGames.delete(next.id);
      next.querySelector(".game-status").textContent = "게임을 불러오지 못했어요. 페이지를 새로고침해 주세요.";
    });
  });
});
document.querySelectorAll("[data-close]").forEach((button) => {
  button.addEventListener("click", () => closeCafeWindow(button.closest("dialog")));
});
function remainingTime() {
  return focus.end ? Math.max(0, focus.end - Date.now()) : focus.remaining;
}

const paintFocusMotion = createCafeFocusMotion($("#focus"));

function renderTimer() {
  const remaining = remainingTime();
  if (focus.end && remaining === 0) {
    Object.assign(focus, { remaining: 0, end: null });
    saveState(focusKey, focus);
    notify("25분 집중이 끝났어요. 잠깐 쉬어가요.");
  }
  const display = formatTime(Math.ceil(remaining / 1000));
  paintFocusMotion(display, remaining / focusDuration, Boolean(focus.end));
  $("#timer-toggle").textContent = focus.end ? "일시 정지" : remaining === 0 ? "다시 시작" : remaining < focusDuration ? "이어서 집중" : "집중 시작";
  $("#timer-note").textContent = remaining === 0 ? "집중 완료. 잠깐 쉬어가요." : "창을 닫아도 타이머는 계속 돌아가요.";
}

$("#timer-toggle").addEventListener("click", () => {
  if (focus.end) {
    focus.remaining = remainingTime();
    focus.end = null;
  } else {
    focus.end = Date.now() + (focus.remaining || focusDuration);
  }
  saveState(focusKey, focus);
  renderTimer();
  scheduleClock();
});
$("#timer-reset").addEventListener("click", () => {
  Object.assign(focus, { remaining: focusDuration, end: null });
  saveState(focusKey, focus);
  renderTimer();
  scheduleClock();
});

const seoulTime = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23"
});
let lastClock;
let clockTimeout;
function scheduleClock() {
  clearTimeout(clockTimeout);
  if (document.hidden) return;
  const interval = room.since || focus.end ? 1000 : 60_000;
  clockTimeout = setTimeout(tick, interval - Date.now() % interval);
}

function tick() {
  const time = seoulTime.format(new Date());
  if (time !== lastClock) {
    $("#clock").textContent = time;
    $("#pc-clock").textContent = time;
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
connectCafeSwitch(document.querySelector(".top-actions .u013"), async (enabled) => {
  const AudioEngine = window.AudioContext || window.webkitAudioContext;
  if (!AudioEngine) {
    notify("이 브라우저에서는 빗소리를 재생할 수 없어요.", "err");
    return false;
  }
  try {
    if (!rainContext) makeRain(AudioEngine);
    await rainContext.resume();
    rainGain.gain.setTargetAtTime(enabled ? .42 : 0, rainContext.currentTime, .13);
    return true;
  } catch {
    notify("빗소리를 켜지 못했어요. 잠시 후 다시 눌러주세요.", "err");
    return false;
  }
});

window.cafeSeating = {
  placeRoomDoors(portals) {
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
      $("#room-doors").append(door);
    }
  },
  current: () => room.space ? room.space + ":" + room.seat : null,
  phase: () => seatJourney?.phase ?? null,
  label(key) { return floorSeats.get(key)?.code ?? null; },
  position(key) {
    const seat = floorSeats.get(key);
    if (!seat) return null;
    const [x, y] = spaces[seat.space].positions[seat.index];
    return seat.space === "hall"
      ? { x: x + (seat.index % 2 ? 2 : -2), y: y + 2.6 }
      : { x, y: { solo: 74, duo: 70, team: 68, squad: seat.index < 3 ? 33 : 76 }[seat.space] };
  },
  refresh(keys) {
    if (keys.length === occupiedSeats.size && keys.every((key) => occupiedSeats.has(key))) return;
    occupiedSeats = new Set(keys);
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
  if (document.hidden) clearTimeout(clockTimeout);
  else tick();
});
