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
const hallSideScreens = [
  [109, 215], [162, 215], [109, 340], [161, 340], [109, 470], [161, 470],
  [1367, 124], [1429, 124], [1405, 343], [1461, 343], [1406, 579], [1467, 579]
].map(([x, y]) => [x / 15.36, y / 10.24]);
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
const floorSelect = $("#floor-select");
const floorSeats = new Map();
const desktop = $("#pc-desktop");
const monitorLayer = $("#monitor-layer");
let selectedSeat = null;
let poweredMonitor = null;
let desktopReturnFocus;
let occupiedSeats = new Set();
let bookingSeat = false;

function renderMonitorPower(spaceId) {
  if (monitorLayer.dataset.space !== spaceId) {
    monitorLayer.dataset.space = spaceId;
    const positions = spaceId === "hall" ? [...spaces.hall.positions, ...hallSideScreens] : spaces[spaceId].positions;
    const dimensions = { hall: [1.92, 1.83], solo: [21.9, 17.1], duo: [18.3, 14.7], team: [10.6, 9.7], squad: [13.5, 9.9] };
    monitorLayer.replaceChildren(...positions.map(([x, y], index) => {
      const screen = document.createElement("span");
      const [width, height] = spaceId === "squad" && index >= 3 ? [15.6, 12.4] : dimensions[spaceId];
      screen.className = "pc-screen";
      screen.style.setProperty("--x", x + "%");
      screen.style.setProperty("--y", y + "%");
      screen.style.setProperty("--screen-width", width + "%");
      screen.style.setProperty("--screen-height", height + "%");
      return screen;
    }));
  }
  poweredMonitor = room.space === spaceId ? monitorLayer.children[room.seat] : null;
  for (const [index, screen] of Array.from(monitorLayer.children).entries()) {
    screen.classList.toggle("is-on", screen === poweredMonitor || occupiedSeats.has(spaceId + ":" + index));
  }
}

function openDesktop(fromSeat = false) {
  if (!poweredMonitor || desktop.open) return;
  if (fromSeat) poweredMonitor.scrollIntoView({ block: "nearest" });
  desktopReturnFocus = fromSeat ? $("#seat-marker") : document.activeElement;
  const origin = poweredMonitor.getBoundingClientRect();
  desktop.showModal();
  $("#pc-title").focus({ preventScroll: true });
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !desktop.animate) return;

  const target = desktop.getBoundingClientRect();
  const visible = origin.top < window.innerHeight && origin.bottom > 0;
  const x = visible ? origin.x + (origin.width - target.width) / 2 - target.x : 0;
  const y = visible ? origin.y + (origin.height - target.height) / 2 - target.y : 14;
  const scale = visible ? Math.max(.045, origin.width / target.width) : .94;
  desktop.animate([
    { opacity: .4, transform: `translate(${x}px, ${y}px) scale(${scale})` },
    { opacity: 1, transform: "none" }
  ], { duration: 440, easing: "cubic-bezier(.2,.8,.2,1)" });
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

function renderRoom() {
  const space = spaces[room.space];
  const seated = Boolean(space);
  const inRoom = seated && room.space !== "hall";
  $(".scene").dataset.space = room.space ?? "lobby";
  $("#lobby-art").hidden = inRoom;
  $("#rooms-art").hidden = !inRoom;
  $("#rooms-art").alt = inRoom ? space.alt : "";
  $("#kiosk-pin").hidden = inRoom;
  $("#room-title").textContent = seated ? space.label : "PC방 입구";
  $("#room-count").textContent = inRoom ? "정원 " + space.positions.length + "명" : "102석";
  $("#kiosk-title").textContent = seated ? "자리를 잡았어요!" : "어디에 앉을까요?";
  $("#kiosk-copy").textContent = seated ? "빗소리 들으며 편히 쉬어가세요." : "전체 좌석도에서 앉고 싶은 자리를 골라요.";
  $("#kiosk-counts").hidden = seated;
  $("#stage-seated").hidden = !seated;
  $("#leave").hidden = !seated;
  $("#open-floor span").textContent = seated ? "좌석도에서 자리 바꾸기" : "전체 좌석도 열기";
  renderMonitorPower(inRoom ? room.space : "hall");

  const marker = $("#seat-marker");
  marker.hidden = !seated;
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
  renderOrder();
  updateSessionTime();
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
    : "좌석도에서 자리를 눌러주세요.";
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
  heading.textContent = label;
  group.append(heading);
  const grid = document.createElement("div");
  grid.className = "floor-seat-grid";
  group.append(grid);
  parent.append(group);

  const options = document.createElement("optgroup");
  options.label = label;
  floorSelect.append(options);
  for (let i = 0; i < count; i++) {
    const index = first + i;
    const code = letter + seatId(i);
    const key = spaceId + ":" + index;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "floor-seat mono";
    button.tabIndex = -1;
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

function openFloor() {
  selectedSeat = null;
  $("#floor-feedback").textContent = "";
  renderFloorSelection();
  floor.showModal();
  $("#floor-title").focus({ preventScroll: true });
}
floor.addEventListener("cancel", (event) => {
  if (bookingSeat) event.preventDefault();
});
$("#kiosk-pin").addEventListener("click", openFloor);
$("#open-floor").addEventListener("click", openFloor);
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
  bookingSeat = true;
  $("#floor-feedback").textContent = "좌석을 확인하고 있어요.";
  renderFloorSelection();
  try {
    if (!window.cafeWorld) throw new Error("Connecting");
    if (!await window.cafeWorld.reserve(seat.key)) {
      $("#floor-feedback").textContent = "다른 손님이 먼저 앉았어요. 다른 자리를 골라주세요.";
      return;
    }
    room.space = seat.space;
    room.seat = seat.index;
    room.since ??= Date.now();
    saveState(roomKey, room);
    renderRoom();
    floor.close();
    openDesktop(true);
    if (!desktop.open) $("#kiosk-title").focus();
  } catch {
    $("#floor-feedback").textContent = "매장에 연결되지 않았어요. 잠시 뒤 다시 눌러주세요.";
  } finally {
    bookingSeat = false;
    renderFloorSelection();
  }
});
function clearSeat() {
  desktopReturnFocus = null;
  if (desktop.open) desktop.close();
  Object.assign(room, { space: null, seat: null, since: null, snack: "", order: null });
  orderCart.fill(0);
  clearTimeout(orderTimer);
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


document.querySelectorAll("[data-open]").forEach((button) => {
  button.addEventListener("click", () => document.getElementById(button.dataset.open).showModal());
});
document.querySelectorAll("[data-close]").forEach((button) => {
  button.addEventListener("click", () => button.closest("dialog").close());
});
const snackMenu = [
  { icon: "🍜", name: "컵라면", copy: "김이 모락모락 나는 야식" },
  { icon: "🥤", name: "캔콜라", copy: "톡 쏘는 한 모금" },
  { icon: "🍢", name: "소떡소떡", copy: "달콤매콤한 한 꼬치" },
  { icon: "🍟", name: "감자튀김", copy: "바삭하게 튀긴 감자" }
];
const orderCart = snackMenu.map(() => 0);
let orderTimer;
const orderControls = snackMenu.map((item, index) => {
  const row = document.createElement("div");
  row.className = "order-row";
  row.innerHTML = '<span class="activity-icon cream" aria-hidden="true"></span><span class="order-product"><strong></strong><small></small></span><div class="order-quantity"><button type="button">−</button><output>0</output><button type="button">＋</button></div>';
  row.querySelector(".activity-icon").textContent = item.icon;
  row.querySelector("strong").textContent = item.name;
  row.querySelector("small").textContent = item.copy;
  const [minus, plus] = row.querySelectorAll("button");
  const count = row.querySelector("output");
  count.setAttribute("aria-label", item.name + " 수량");
  minus.setAttribute("aria-label", item.name + " 빼기");
  plus.setAttribute("aria-label", item.name + " 추가");
  minus.addEventListener("click", () => {
    orderCart[index] = Math.max(0, orderCart[index] - 1);
    renderOrder();
  });
  plus.addEventListener("click", () => {
    orderCart[index] = Math.min(9, orderCart[index] + 1);
    renderOrder();
  });
  $("#order-menu").append(row);
  return { minus, plus, count };
});

function renderOrder() {
  const seat = floorSeats.get(room.space + ":" + room.seat);
  const order = room.order;
  const preparing = order && order.readyAt > Date.now();
  const total = orderCart.reduce((sum, count) => sum + count, 0);
  $("#order-location").textContent = seat
    ? spaces[room.space].label + " · " + seat.code + " 자리로 가져다드려요."
    : "자리에 앉으면 주문할 수 있어요.";
  for (const [index, controls] of orderControls.entries()) {
    const count = orderCart[index];
    controls.count.textContent = count;
    controls.minus.disabled = count === 0;
    controls.plus.disabled = count === 9;
  }
  $("#place-order").disabled = !seat || !total || Boolean(preparing);
  $("#place-order").textContent = total ? "내 자리로 " + total + "개 주문하기" : "내 자리로 주문하기";
  $("#order-receipt").hidden = !order;
  if (order) {
    $("#order-status").textContent = preparing ? "주문 접수 · 준비 중" : "간식이 도착했어요";
    $("#order-items").textContent = order.items.map(({ name, count }) => name + " × " + count).join(" · ");
  }
  const summary = order ? preparing ? "주문 준비 중" : "간식 도착" : "";
  $("#pc-order-summary").textContent = summary || "내 자리로 간식 보내기";
  $("#snack-subtitle").textContent = summary || (room.snack ? "고른 간식 · " + room.snack : "내 자리로 간식 주문하기");
}

function watchOrder() {
  clearTimeout(orderTimer);
  if (!room.order || room.order.readyAt <= Date.now()) return;
  orderTimer = setTimeout(() => {
    renderOrder();
    if (!desktop.open && !$("#snacks").open) notify("매점에서 간식이 도착했어요.", "ok");
  }, room.order.readyAt - Date.now());
}

$("#place-order").addEventListener("click", () => {
  if ($("#place-order").disabled) return;
  const items = snackMenu.flatMap(({ name }, index) => orderCart[index] ? [{ name, count: orderCart[index] }] : []);
  room.order = { items, readyAt: Date.now() + 4500 };
  room.snack = "";
  saveState(roomKey, room);
  orderCart.fill(0);
  renderOrder();
  $("#order-receipt").focus();
  watchOrder();
});

function remainingTime() {
  return focus.end ? Math.max(0, focus.end - Date.now()) : focus.remaining;
}

function renderTimer() {
  const remaining = remainingTime();
  if (focus.end && remaining === 0) {
    Object.assign(focus, { remaining: 0, end: null });
    saveState(focusKey, focus);
    notify("25분 집중이 끝났어요. 잠깐 쉬어가요.");
  }
  const display = formatTime(Math.ceil(remaining / 1000));
  $("#timer").textContent = display;
  $("#timer-toggle").textContent = focus.end ? "일시 정지" : remaining === 0 ? "다시 시작" : remaining < focusDuration ? "이어서 집중" : "집중 시작";
  $("#timer-note").textContent = remaining === 0 ? "집중 완료. 잠깐 쉬어가요." : "창을 닫아도 타이머는 계속 돌아가요.";
  $("#focus-subtitle").textContent = focus.end ? "집중 중 · " + display : remaining === 0 ? "25분 집중 완료" : remaining < focusDuration ? "일시 정지 · " + display : "25분 타이머 켜기";
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
});
$("#timer-reset").addEventListener("click", () => {
  Object.assign(focus, { remaining: focusDuration, end: null });
  saveState(focusKey, focus);
  renderTimer();
});

const seoulTime = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23"
});
function tick() {
  const time = seoulTime.format(new Date());
  $("#clock").textContent = time;
  $("#pc-clock").textContent = time;
  updateSessionTime();
  renderTimer();
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

connectRainSwitch(async (enabled) => {
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
  current: () => room.space ? room.space + ":" + room.seat : null,
  position(key) {
    const seat = floorSeats.get(key);
    if (!seat) return null;
    const [x, y] = spaces[seat.space].positions[seat.index];
    return seat.space === "hall"
      ? { x: x + (seat.index % 2 ? 2 : -2), y: y + 2.6 }
      : { x, y: y + 18 };
  },
  refresh(keys) {
    if (keys.length === occupiedSeats.size && keys.every((key) => occupiedSeats.has(key))) return;
    occupiedSeats = new Set(keys);
    renderMonitorPower(room.space && room.space !== "hall" ? room.space : "hall");
    if (floor.open) renderFloorSelection();
  },
  lose(key) {
    if (this.current() !== key) return;
    clearSeat();
    notify("연결이 끊긴 사이 다른 손님이 그 자리에 앉았어요.", "info");
  },
};
renderRoom();
watchOrder();
tick();
setInterval(tick, 250);
