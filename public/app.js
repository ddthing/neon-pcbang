import { formatCafeTime } from "./cafe-clock.mjs";
import "./cafe-layout.js";
import "./cafe-art.js";
import { mountLucianCafe } from "./cafe-lucian.js";
import { LANDMARKS, ROOMS, SEATS, SEAT_TIERS, center, seatCode, seatFor, toPercent } from "./cafe-map.mjs";
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

const { spaces } = window.cafeLayout;

const room = readState(roomKey, { space: null, seat: null, since: null, snack: "", order: null });
if (room.seat !== null && !room.space) {
  const legacySpace = room.seat === 0 ? "solo" : room.seat < 3 ? "duo" : "team";
  const firstSeat = { solo: 0, duo: 1, team: 3 };
  room.space = legacySpace;
  room.seat -= firstSeat[legacySpace];
  saveState(roomKey, room);
}
if (room.space && !seatFor(room.space + ":" + room.seat)) {
  Object.assign(room, { space: null, seat: null, since: null, snack: "", order: null });
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
const restorePill = $("#pc-restore-pill");
const relaxHud = $("#relax-hud");
const journeyProgress = $("#seat-journey");
const journeyLabel = $("#seat-journey-label");
const journeyStatus = $("#seat-journey-status");
const journeySteps = [...journeyProgress.querySelectorAll("[data-phase]")];

let selectedSeat = null;
let desktopReturnFocus;
let occupiedSeats = new Set();
let awaySeats = new Set();
let activeBreakZone = null; // null | "booth" | "terrace"
let bookingSeat = false;
let seatJourney = null;
let lastNotice = { text: "", time: 0 };
const reduceSeatMotion = matchMedia("(prefers-reduced-motion: reduce)");

function isSeated() {
  return Boolean(room.space) && (!seatJourney || seatJourney.phase === "booting");
}

function renderMonitorPower() {
  const key = isSeated() && !activeBreakZone ? room.space + ":" + room.seat : null;
  window.cafeArt.updateScreens(key, occupiedSeats, awaySeats);
}

function openDesktop(fromSeat = false) {
  if (seatJourney || desktop.open) return;
  if (activeBreakZone) {
    window.cafeWorld?.exitRelaxZone?.();
  }
  if (!isSeated()) return;
  desktopReturnFocus = fromSeat ? $("#seat-marker") : document.activeElement;
  window.prepareCafeWallpaper?.();
  desktop.classList.add("is-nonmodal");
  desktop.show();
  if (restorePill) restorePill.hidden = true;
  $("#pc-title").focus({ preventScroll: true });
}

function notify(message, kind = "info") {
  const now = Date.now();
  if (lastNotice.text === message && now - lastNotice.time < 2500) return;
  lastNotice = { text: message, time: now };
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

function renderRoom() {
  const view = activeBreakZone ?? seatJourney?.space ?? room.space ?? "lobby";
  const space = spaces[seatJourney?.seat.space ?? view];
  const seated = isSeated();
  const inBooth = view === "booth";
  const inTerrace = view === "terrace";
  const inSpecial = inBooth || inTerrace;

  const scene = $(".scene");
  const area = inBooth || inTerrace ? view : "hall";
  const oldArea = scene.dataset.space;
  scene.dataset.space = area;
  window.cafeArt.show(area, area === "hall" ? SEATS : []);
  if (oldArea !== area) window.cafeArt.openDoor();

  $("#cafe-joystick").hidden = Boolean((room.space && !activeBreakZone) || seatJourney);
  $("#kiosk-pin").hidden = inSpecial;
  $("#cafe-board-pin").hidden = inSpecial;
  $("#room-doors").hidden = inSpecial || Boolean(seatJourney);
  $("#world-seat-targets").hidden = inSpecial || Boolean(seatJourney);
  $("#quick-return-seat").hidden = !(activeBreakZone && seated);
  $("#game-view-pc").hidden = !seated || Boolean(activeBreakZone);

  $("#room-title").textContent = inBooth ? "실내 흡연구역"
    : inTerrace ? "야외 흡연구역 (2F 테라스)"
    : (space?.label ?? "PC방 입구");
  $("#room-count").textContent = inBooth ? "환기 가동 중"
    : inTerrace ? "우리 동네 · 밀크커피 자판기"
    : "67석";
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
  renderMonitorPower();

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
    const tierInfo = SEAT_TIERS[seat.tier || room.space];
    const label = !tierInfo || tierInfo.label === homeRoom.label
      ? `${seat.code} · ${homeRoom.label}`
      : `${seat.code} · ${homeRoom.label} (${tierInfo.label})`;
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
    for (const button of seat.buttons) {
      button.classList.toggle("my-seat", mine);
      button.classList.toggle("taken", occupied);
      button.disabled = occupied;
      button.setAttribute("aria-pressed", seat === selectedSeat);
      button.setAttribute("aria-label", seat.label + " " + seat.code + (mine ? ", 내 자리" : occupied ? ", 이용 중" : ""));
    }
    if (seat.worldButton) {
      seat.worldButton.disabled = occupied;
      seat.worldButton.setAttribute("aria-pressed", mine);
    }
    seat.option.disabled = occupied;
  }
  const mine = selectedSeat && isMySeat(selectedSeat);
  const taken = selectedSeat && occupiedSeats.has(selectedSeat.key);
  const tierInfo = selectedSeat ? SEAT_TIERS[selectedSeat.tier || selectedSeat.space] : null;
  $("#floor-selection").textContent = selectedSeat?.code ?? "선택 대기";
  $("#floor-detail").textContent = selectedSeat
    ? `${tierInfo?.label || selectedSeat.label} (${tierInfo?.perk || ""})` + (mine ? " · 내 자리" : taken ? " · 이용 중" : " · 이용 가능")
    : floor.dataset.room ? "이 룸에서 자리를 눌러주세요." : "일반석 또는 룸 영역을 눌러주세요.";
  $("#enter span").textContent = mine ? "현재 이용 중" : room.space ? "이 자리로 이동" : "이 자리로 입장";
  $("#enter").disabled = bookingSeat || !selectedSeat || mine || taken;
  floor.querySelector("[data-close]").disabled = bookingSeat;
  if (floorSelect.value !== (selectedSeat?.key ?? "")) floorSelect.value = selectedSeat?.key ?? "";
}

const overview = $("#floor-banks");
const map = overview.parentElement;
map.querySelectorAll("svg").forEach((node) => node.remove());
const details = $("#floor-rooms");
for (const [spaceId, { label }] of Object.entries(spaces)) {
  const options = document.createElement("optgroup");
  options.label = label;
  floorOptions.push({ spaceId, options });
  const panel = document.createElement("div");
  panel.className = "floor-room";
  panel.dataset.space = spaceId;
  for (const entry of SEATS.filter((seat) => seat.space === spaceId)) {
    const { key, index, room } = entry;
    const code = seatCode(entry);
    const option = document.createElement("option");
    option.value = key;
    option.textContent = [code, ROOMS.find(({ id }) => id === room)?.label ?? label].join(" · ");
    options.append(option);
    const buttons = [];
    const seat = { space: spaceId, index, key, code, label, room, tier: entry.tier || spaceId, button: null, buttons, option };
    for (const container of spaceId === "hall" ? [overview] : [overview, panel]) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "floor-seat mono";
      button.textContent = code;
      if (container === overview) {
        const { x, y } = toPercent(entry.foot);
        button.style.setProperty("--x", x + "%");
        button.style.setProperty("--y", y + "%");
        button.dataset.mapSeat = "";
      }
      button.addEventListener("click", () => {
        selectedSeat = seat;
        $("#floor-feedback").textContent = "";
        renderFloorSelection();
      });
      container.append(button);
      buttons.push(button);
    }
    seat.button = buttons[0];
    floorSeats.set(key, seat);
  }
  if (spaceId !== "hall") details.append(panel);
}
for (const suite of ROOMS) {
  const button = document.createElement("button");
  const { x, y } = toPercent({ x: suite.rect.x + suite.rect.w / 2, y: suite.rect.y + 8 });
  button.type = "button";
  button.className = "floor-map-room";
  button.textContent = suite.label;
  button.style.setProperty("--x", x + "%");
  button.style.setProperty("--y", y + "%");
  button.addEventListener("click", () => showFloorView(suite.space, suite.id));
  const outline = document.createElement("span");
  outline.className = "floor-room-footprint";
  const anchors = toPercent(suite.rect);
  const sizes = toPercent({ x: suite.rect.w, y: suite.rect.h });
  Object.assign(outline.style, { left: anchors.x + "%", top: anchors.y + "%", width: sizes.x + "%", height: sizes.y + "%" });
  map.prepend(outline);
  map.append(button);
}
function syncFloorLandmarks() {
  for (const [id, geometry] of Object.entries(LANDMARKS)) {
    const el = map.querySelector(`[data-landmark="${id}"]`);
    if (!el) continue;
    const { x, y } = toPercent(center(geometry));
    el.style.setProperty("--x", x + "%");
    el.style.setProperty("--y", y + "%");
    el.textContent = geometry.label;
  }
}
syncFloorLandmarks();

function addWorldTarget(container, label, point, activate) {
  const target = document.createElement("button");
  target.type = "button";
  target.className = "world-target";
  target.style.left = point.x + "%";
  target.style.top = point.y + "%";
  target.setAttribute("aria-label", label);
  target.dataset.tip = label;
  container.append(target);
  target.addEventListener("click", () => activate(target));
  return target;
}

for (const entry of SEATS) {
  const seat = floorSeats.get(entry.key);
  seat.worldButton = addWorldTarget($("#world-seat-targets"), seat.code + " · " + seat.label, toPercent(entry.foot), () => {
    if (seatJourney || bookingSeat) return;
    if (isMySeat(seat)) {
      leaveSeat();
      return;
    }
    selectedSeat = seat;
    renderFloorSelection();
    $("#enter").click();
  });
}

function showFloorView(roomId, suiteId) {
  const inside = Boolean(roomId);
  floor.dataset.room = roomId ?? "";
  $("#floor-overview").hidden = inside;
  $("#floor-room-view").hidden = !inside;
  for (const panel of $("#floor-rooms").children) panel.hidden = panel.dataset.space !== roomId;
  if (inside) {
    const suite = ROOMS.find(({ id }) => id === suiteId);
    $("#floor-room-title").textContent = suite?.label ?? spaces[roomId].label;
    $("#floor-room-count").textContent = "좌석 " + (suite ? SEATS.filter(({ room }) => room === suite.id).length : spaces[roomId].positions.length) + "개";
  }
  for (const seat of floorSeats.values()) {
    if (seat.buttons[1]) seat.buttons[1].hidden = Boolean(suiteId && suiteId !== seat.room);
    seat.option.hidden = Boolean(suiteId && suiteId !== seat.room);
  }
  $("#floor-instruction").textContent = inside
    ? "이 룸에서 이용할 자리를 골라주세요."
    : "일반석을 고르거나 룸 영역을 눌러 내부 좌석을 보세요.";
  floorSelect.replaceChildren(floorSelect.options[0],
    ...floorOptions.filter(({ spaceId }) => !roomId || spaceId === roomId).map(({ options }) => options));
  selectedSeat = null;
  $("#floor-feedback").textContent = "";
  renderFloorSelection();
  if (floor.open) revealCafeView($(inside ? "#floor-room-view" : "#floor-overview"), inside ? 1 : -1);
}

function openFloor(roomId, origin, suiteId) {
  if (seatJourney || floor.open) return;
  const source = cafeWindowOrigin(origin);
  if (hub.open) hub.close();
  showFloorView(roomId, suiteId);
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
$("#game-view-pc")?.addEventListener("click", () => openDesktop(true));
$("#quick-booth")?.addEventListener("click", () => window.cafeWorld?.enterRelaxZone?.("booth"));
$("#quick-terrace")?.addEventListener("click", () => window.cafeWorld?.enterRelaxZone?.("terrace"));
$("#quick-return-seat")?.addEventListener("click", () => {
  window.cafeWorld?.exitRelaxZone?.();
  setTimeout(() => openDesktop(true), 120);
});
document.querySelectorAll("[data-pc-break]").forEach((btn) => {
  btn.addEventListener("click", () => window.cafeWorld?.enterRelaxZone?.(btn.dataset.pcBreak));
});

desktop.addEventListener("close", () => {
  if (desktop.open) return;
  desktop.classList.remove("is-nonmodal");
  desktopReturnFocus?.focus({ preventScroll: true });
});
$("#pc-minimize")?.addEventListener("click", () => {
  if (desktop.open) desktop.close();
  if (isSeated() && restorePill) restorePill.hidden = false;
});
restorePill?.addEventListener("click", () => openDesktop(true));
const startMenu = $("#pc-start");
const launcher = $("#pc-launcher");
const launcherTriggers = document.querySelectorAll("[data-launcher]");
let launcherOrigin = null;
desktop.addEventListener("close", () => {
  if (desktop.open) return;
  startMenu.open = false;
  if (launcher.open) launcher.close();
});
desktop.addEventListener("cancel", (event) => {
  if (startMenu.open) {
    event.preventDefault();
    startMenu.open = false;
    startMenu.querySelector("summary").focus();
  }
});
startMenu.addEventListener("click", (event) => {
  if (event.target.closest("button")) startMenu.open = false;
});
launcherTriggers.forEach((button) => {
  button.setAttribute("aria-expanded", "false");
  button.setAttribute("aria-haspopup", "dialog");
  button.setAttribute("aria-controls", launcher.id);
  button.addEventListener("click", () => {
    if (!desktop.open || launcher.open) return;
    const source = cafeWindowOrigin(button);
    const fromStartMenu = Boolean(startMenu.contains(button));
    if (fromStartMenu) startMenu.open = false;
    launcherOrigin = fromStartMenu ? startMenu.querySelector("summary") : button;
    openCafeWindow(launcher, launcherOrigin, source);
    launcherTriggers.forEach((trigger) => trigger.setAttribute("aria-expanded", "true"));
  });
});
launcher.addEventListener("close", () => {
  if (launcher.open) return;
  launcherTriggers.forEach((trigger) => trigger.setAttribute("aria-expanded", "false"));
  if (desktop.open) launcherOrigin?.focus({ preventScroll: true });
  launcherOrigin = null;
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
  if (restorePill) restorePill.hidden = true;
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
    next.setAttribute("aria-busy", "true");
    const controls = [...next.querySelector(".dialog-inner").children].filter((el) => !el.inert && !el.matches(".dialog-head"));
    const restoreFocus = controls.some((element) => element.contains(document.activeElement)) ? document.activeElement : null;
    const closeButton = next.querySelector(".dialog-head [data-close]");
    if (restoreFocus) closeButton.focus({ preventScroll: true });
    controls.forEach((el) => { el.inert = true; });
    load().catch(() => {
      requestedGames.delete(next.id);
      const st = next.querySelector(".game-status");
      if (st) st.textContent = "게임을 불러오지 못했어요. 페이지를 새로고침해 주세요.";
    }).finally(() => {
      controls.forEach((el) => { el.inert = false; });
      next.removeAttribute("aria-busy");
      if (next.open && document.activeElement === closeButton) restoreFocus?.focus({ preventScroll: true });
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
  const time = formatCafeTime(new Date());
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
  placeRoomDoors(_portals, relaxPortals = {}) {
    const container = $("#room-doors");
    container.replaceChildren();
    for (const room of ROOMS) {
      const { x, y } = toPercent({ x: room.door.x + 8, y: room.door.y + 8 });
      addWorldTarget(container, room.label + " 입구", { x, y }, (button) => openFloor(room.space, button, room.id));
    }
    for (const [zoneId, point] of Object.entries(relaxPortals)) {
      addWorldTarget(container, point.label + " 입장", point, () => window.cafeWorld?.enterRelaxZone?.(zoneId));
    }
  },
  current: () => room.space ? room.space + ":" + room.seat : null,
  phase: () => seatJourney?.phase ?? null,
  label(key) { return floorSeats.get(key)?.code ?? null; },
  chair(key) {
    const seat = seatFor(key);
    return seat && { ...toPercent(seat.foot), direction: window.cafeArt.chairDirection(seat), stand: toPercent(seat.stand) };
  },
  trayPosition(key) { return window.cafeArt.tray(key); },
  position(key) {
    const seat = seatFor(key);
    return seat && toPercent(seat.foot);
  },
  refresh(keys, peerList = []) {
    occupiedSeats = new Set(keys);
    awaySeats = new Set(peerList.filter((p) => p.seat && (p.zone === "booth" || p.zone === "terrace")).map((p) => p.seat));
    renderMonitorPower();
    if (floor.open) renderFloorSelection();
  },
  lose(key) {
    if (this.current() !== key) return;
    clearSeat();
    notify("연결이 끊긴 사이 다른 손님이 그 자리에 앉았어요.", "info");
  },
};
document.addEventListener("cafe-art-ready", () => {
  renderRoom();
  window.cafeArt?.setDeskProps?.(deskPropsState.equipped);
}, { once: true });

// Daily 3 Missions + Cozy Desk Prop Shop (B4 G-Point Economy)
const missionsKey = "neon-pcbang-daily-missions";
const deskPropsKey = "neon-pcbang-desk-props";
const DAILY_MISSIONS = [
  { id: "greet", label: "손님에게 인사 / 간식 쏘기", reward: 20 },
  { id: "game", label: "미니게임 1판 즐기기", reward: 25 },
  { id: "snack", label: "매점 먹거리 주문하기", reward: 20 },
];
const DESK_PROPS = [
  { id: "cactus", name: "🌵 미니 다육이", desc: "모니터 옆 푸릇한 화분", cost: 30 },
  { id: "mug", name: "☕ 코지 머그컵", desc: "김이 모락모락 라떼 한 잔", cost: 40 },
  { id: "cat", name: "🐱 분홍 고양이 인형", desc: "포근한 행운 마네키네코", cost: 50 },
  { id: "headset", name: "🎧 게이밍 헤드셋 거치대", desc: "로즈톤 프로 스탠드", cost: 60 },
  { id: "lamp", name: "💡 레트로 무드 스탠드", desc: "노란 빛으로 책상 밝히기", cost: 80 },
  { id: "figure", name: "👾 한정판 픽셀 피규어", desc: "민트빛 수집용 피규어", cost: 120 },
];
const kstDay = () => new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
function loadMissions() {
  const today = kstDay();
  const saved = readState(missionsKey, { date: today, done: {}, claimed: {} });
  if (saved.date !== today) return { date: today, done: {}, claimed: {} };
  return saved;
}
let missionsState = loadMissions();
let deskPropsState = readState(deskPropsKey, { owned: [], equipped: [] });

function renderMissions() {
  const list = $("#pc-missions-list");
  const count = $("#pc-missions-count");
  if (!list || !count) return;
  const doneCount = DAILY_MISSIONS.filter((m) => missionsState.done[m.id]).length;
  count.textContent = `${doneCount}/${DAILY_MISSIONS.length}`;
  list.replaceChildren(...DAILY_MISSIONS.map((m) => {
    const li = document.createElement("li");
    li.className = "pc-mission-row";
    const span = document.createElement("span");
    const isDone = Boolean(missionsState.done[m.id]);
    const isClaimed = Boolean(missionsState.claimed[m.id]);
    span.textContent = (isClaimed ? "☑ " : isDone ? "✔ " : "□ ") + m.label;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "pc-mission-btn" + (isClaimed ? " claimed" : "");
    btn.textContent = isClaimed ? "완료" : isDone ? `받기 +${m.reward}G` : `+${m.reward}G`;
    btn.disabled = !isDone || isClaimed;
    btn.addEventListener("click", () => {
      if (!missionsState.done[m.id] || missionsState.claimed[m.id]) return;
      missionsState.claimed[m.id] = true;
      saveState(missionsKey, missionsState);
      window.cafeEarnPoints?.(m.reward, `미션 완료: ${m.label}`);
      renderMissions();
    });
    li.append(span, btn);
    return li;
  }));
}

function renderDeskShop() {
  const list = $("#desk-shop-list");
  const eqCount = $("#desk-shop-equipped");
  const status = $("#desk-shop-status");
  if (!list) return;
  if (eqCount) eqCount.textContent = `배치 중: ${deskPropsState.equipped.length} / 3`;
  list.replaceChildren(...DESK_PROPS.map((item) => {
    const owned = deskPropsState.owned.includes(item.id);
    const equipped = deskPropsState.equipped.includes(item.id);
    const card = document.createElement("div");
    card.className = "desk-prop-card";
    const title = document.createElement("strong");
    title.textContent = item.name;
    const desc = document.createElement("small");
    desc.textContent = item.desc + (owned ? " · 보유 중" : ` · ${item.cost} G`);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.setAttribute("aria-pressed", String(equipped));
    btn.textContent = !owned ? `${item.cost} G로 구매` : equipped ? "✓ 배치 중 (해제)" : "책상에 올리기";
    btn.addEventListener("click", async () => {
      if (!owned) {
        const res = await window.cafeSpendPoints?.(item.cost, `${item.name} 구매`);
        if (!res?.ok) {
          if (status) status.textContent = res?.reason === "insufficient_points"
            ? `G-포인트가 부족해요! (${item.cost} G 필요)` : "잠시 후 다시 시도해 주세요.";
          return;
        }
        deskPropsState.owned.push(item.id);
        if (deskPropsState.equipped.length < 3) deskPropsState.equipped.push(item.id);
        saveState(deskPropsKey, deskPropsState);
        window.cafeArt?.setDeskProps?.(deskPropsState.equipped);
        if (status) status.textContent = `${item.name} 구매 완료! 내 자리에 예쁘게 올려뒀어요.`;
        renderDeskShop();
        return;
      }
      if (equipped) {
        deskPropsState.equipped = deskPropsState.equipped.filter((id) => id !== item.id);
      } else {
        if (deskPropsState.equipped.length >= 3) {
          if (status) status.textContent = "소품은 최대 3개까지만 올릴 수 있어요!";
          return;
        }
        deskPropsState.equipped.push(item.id);
      }
      saveState(deskPropsKey, deskPropsState);
      window.cafeArt?.setDeskProps?.(deskPropsState.equipped);
      if (status) status.textContent = equipped ? "책상에서 치웠어요." : `${item.name}을(를) 책상에 올렸어요!`;
      renderDeskShop();
    });
    card.append(title, desc, btn);
    return card;
  }));
}

document.addEventListener("cafe-mission", ({ detail }) => {
  const id = detail?.id;
  if (!id || missionsState.done[id]) return;
  missionsState = loadMissions();
  missionsState.done[id] = true;
  saveState(missionsKey, missionsState);
  renderMissions();
});

new MutationObserver(() => {
  if ($("#desk-shop")?.open) renderDeskShop();
}).observe($("#desk-shop"), { attributes: true, attributeFilter: ["open"] });

// Keyboard 1/2/3 shortcuts for quick actions when no input or modal dialog blocks
document.addEventListener("keydown", (event) => {
  if (event.altKey || event.ctrlKey || event.metaKey || event.repeat) return;
  if (event.target.closest("input, textarea, select, [contenteditable]")) return;
  if (document.querySelector("dialog[open]:not(#pc-desktop)")) return;
  if (event.key === "1") $("#game-view-floor")?.click();
  else if (event.key === "2") $("#quick-snacks")?.click();
  else if (event.key === "3") $("#cafe-wave")?.click();
});

mountLucianCafe();
renderMissions();
renderRoom();
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
