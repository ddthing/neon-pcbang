const directionNames = { up: "앞쪽", down: "아래쪽", left: "왼쪽", right: "오른쪽" };
const statusNames = { available: "이용 가능", occupied: "이용 중", mine: "내 자리", away: "자리 비움" };
const statusMarks = { available: "", occupied: "●", mine: "★", away: "★" };
const arrows = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };

function node(tag, className, text = "") {
  const element = document.createElement(tag);
  element.className = className;
  element.textContent = text;
  return element;
}

function placeRect(el, rect, view) {
  el.style.left = ((rect.x - view.x) / view.width) * 100 + "%";
  el.style.top = ((rect.y - view.y) / view.height) * 100 + "%";
  el.style.width = (rect.width / view.width) * 100 + "%";
  el.style.height = (rect.height / view.height) * 100 + "%";
}

function detailBounds(group, model) {
  if (group.zone !== "hall") return model.zones.find((zone) => zone.id === group.zone).rect;
  const footprints = group.seats.flatMap((seat) => [seat.deskRect, seat.chairRect]);
  const x = Math.max(0, Math.min(...footprints.map((r) => r.x)) - 44);
  const y = Math.max(0, Math.min(...footprints.map((r) => r.y)) - 25);
  const right = Math.min(model.world.width, Math.max(...footprints.map((r) => r.x + r.width)) + 44);
  const bottom = Math.min(model.world.height, Math.max(...footprints.map((r) => r.y + r.height)) + 25);
  return { x, y, width: right - x, height: bottom - y };
}

function drawPlan(board, model, view, seats, overview) {
  board.replaceChildren();
  board.style.aspectRatio = view.width + " / " + view.height;
  const schematic = node("div", "seat-plan-schematic");
  schematic.setAttribute("aria-hidden", "true");
  board.append(schematic);

  function draw(className, rect, label = "", id = "") {
    const el = node("div", className);
    placeRect(el, rect, view);
    if (id) el.dataset.planId = id;
    if (label) el.append(node("span", "seat-plan-label", label));
    schematic.append(el);
    return el;
  }

  for (const zone of model.zones) {
    const label = { hall: "일반석", solo: "1인룸", exterior: "매장 밖" }[zone.id] ?? zone.name;
    draw("seat-plan-zone", zone.rect, overview ? label : "", zone.id);
  }
  for (const aisle of model.aisles) draw("seat-plan-aisle", aisle.rect, "", aisle.id);
  for (const door of model.doors) {
    const label = overview && door.id === "entrance" ? "입구" : "";
    draw("seat-plan-door", door.threshold, label, door.id);
  }
  draw("seat-plan-kiosk", model.kiosk.rect, overview ? "키오스크" : "", model.kiosk.id);
  for (const seat of seats) {
    const desk = draw("seat-plan-desk", seat.deskRect);
    desk.dataset.facing = seat.facing;
    draw("seat-plan-chair", seat.chairRect).dataset.facing = seat.facing;
  }
}

function groupSeats(model) {
  const groups = new Map();
  let hallRow = 0;
  for (const seat of model.seats) {
    if (!groups.has(seat.group)) {
      const label = seat.zone === "hall" ? "일반석 " + (++hallRow) + "열" : model.zones.find((zone) => zone.id === seat.zone).name;
      groups.set(seat.group, { id: seat.group, zone: seat.zone, label, seats: [] });
    }
    groups.get(seat.group).seats.push(seat);
  }
  return groups;
}

function adjacentSeat(seat, seats, [dx, dy]) {
  const origin = seat.cushionAnchor;
  let nearest;
  let best = Infinity;
  for (const candidate of seats) {
    const x = candidate.cushionAnchor.x - origin.x;
    const y = candidate.cushionAnchor.y - origin.y;
    const forward = x * dx + y * dy;
    if (forward <= 0) continue;
    const sideways = Math.abs(x * dy - y * dx);
    const score = forward + sideways * 3;
    if (score < best) {
      best = score;
      nearest = candidate;
    }
  }
  return nearest;
}

export function createSeatPicker({ readModel, requestSeat, onOpen, onClose, fallbackFocus }) {
  const dialog = document.getElementById("seatmap-backdrop");
  const title = document.getElementById("seatmap-title");
  const close = document.getElementById("seatmap-close");
  const back = document.getElementById("seatmap-back");
  const overview = document.getElementById("seatmap-overview");
  const groupList = document.getElementById("seatmap-groups");
  const overviewBoard = document.getElementById("seatmap-board");
  const detail = document.getElementById("seatmap-detail");
  const detailTitle = document.getElementById("seatmap-detail-title");
  const seatBoard = document.getElementById("seatmap-seat-board");
  const notice = document.getElementById("seatmap-notice");
  const summary = document.getElementById("seatmap-selection");
  const confirm = document.getElementById("seatmap-confirm");
  const scrollArea = dialog.querySelector(".seat-picker-scroll");

  let groups;
  let openGroup;
  let selectedKey;
  let focusKey;
  let trigger;
  let pending = false;
  const groupButtons = new Map();
  const seatButtons = new Map();

  function update() {
    const model = readModel();
    const freshSeats = new Map(model.seats.map((seat) => [seat.key, seat]));
    for (const group of groups.values()) {
      group.seats = group.seats.map((seat) => freshSeats.get(seat.key));
      const available = group.seats.filter((seat) => seat.status === "available").length;
      const count = groupButtons.get(group.id).lastElementChild;
      const label = "빈자리 " + available + "/" + group.seats.length;
      if (count.textContent !== label) count.textContent = label;
    }
    for (const seat of openGroup?.seats ?? []) {
      const button = seatButtons.get(seat.key);
      const status = seat.status === "mine" && model.mySeatAway ? "away" : seat.status;
      const picked = seat.key === selectedKey;
      const label = seat.label + ", " + statusNames[status] + ", " + directionNames[seat.facing] + " 방향";
      if (button.dataset.status !== status) {
        button.dataset.status = status;
        button.setAttribute("aria-label", label);
        button.querySelector(".seat-hit-status").textContent = statusNames[status];
        button.querySelector(".seat-hit-status-mark").textContent = statusMarks[status];
      }
      button.setAttribute("aria-pressed", String(picked));
      button.setAttribute("aria-disabled", String(pending || status === "occupied"));
    }

    const picked = freshSeats.get(selectedKey);
    const caption = pending ? "선택한 좌석을 확인하고 있습니다." : picked
      ? openGroup.label + " · " + picked.label + (picked.status === "mine" ? " · " + (model.mySeatAway ? "자리 비움" : "내 자리") : "")
      : openGroup ? "도면에서 자리를 고르세요." : "좌석 줄이나 룸을 고르세요.";
    if (summary.textContent !== caption) summary.textContent = caption;
    confirm.textContent = pending ? "예약 확인 중…" : "이 자리로 이동";
    confirm.disabled = pending || !picked || picked.status === "occupied";
    close.disabled = pending;
    back.disabled = pending;
  }

  function focusSeat(key, preventScroll = false) {
    if (focusKey) seatButtons.get(focusKey)?.setAttribute("tabindex", "-1");
    focusKey = key;
    const button = seatButtons.get(key);
    button.tabIndex = 0;
    button.focus({ preventScroll });
  }

  function showGroup(group, model) {
    openGroup = group;
    selectedKey = null;
    focusKey = null;
    notice.textContent = "";
    detailTitle.textContent = group.label;
    seatBoard.setAttribute("aria-label", group.label + " 좌석 도면");
    const view = detailBounds(group, model);
    drawPlan(seatBoard, model, view, group.seats, false);
    seatButtons.clear();
    for (const seat of group.seats) {
      const button = node("button", "seat-hit");
      button.type = "button";
      button.tabIndex = -1;
      button.dataset.seatKey = seat.key;
      button.dataset.facing = seat.facing;
      button.style.left = ((seat.cushionAnchor.x - view.x) / view.width) * 100 + "%";
      button.style.top = ((seat.cushionAnchor.y - view.y) / view.height) * 100 + "%";
      button.append(
        node("span", "seat-hit-number", seat.displayNumber),
        node("span", "seat-hit-status-mark"),
        node("span", "seat-hit-picked", "✓"),
        node("span", "seat-hit-status"),
      );
      button.addEventListener("click", () => {
        if (pending) return;
        focusSeat(seat.key);
        if (button.dataset.status === "occupied") return;
        selectedKey = seat.key;
        notice.textContent = "";
        update();
      });
      seatButtons.set(seat.key, button);
      seatBoard.append(button);
    }
    overview.hidden = true;
    detail.hidden = false;
    update();
    scrollArea.scrollTop = 0;
    focusSeat(group.seats.find((seat) => seat.status !== "occupied")?.key ?? group.seats[0].key);
  }

  function showOverview(moveFocus) {
    const previousGroup = openGroup;
    openGroup = null;
    selectedKey = null;
    notice.textContent = "";
    detail.hidden = true;
    overview.hidden = false;
    update();
    scrollArea.scrollTop = 0;
    if (moveFocus) groupButtons.get(previousGroup.id).focus();
  }

  function open(triggerEl) {
    if (dialog.open) return;
    trigger = triggerEl ?? document.activeElement;
    const model = readModel();
    groups = groupSeats(model);
    drawPlan(overviewBoard, model, { x: 0, y: 0, ...model.world }, model.seats, true);
    groupButtons.clear();
    groupList.replaceChildren();
    for (const group of groups.values()) {
      const button = node("button", "seat-picker-group");
      button.type = "button";
      button.dataset.seatGroup = group.id;
      button.append(node("strong", "", group.label), node("span", ""));
      button.addEventListener("click", () => showGroup(group, readModel()));
      groupButtons.set(group.id, button);
      groupList.append(button);
    }
    showOverview(false);
    onOpen();
    dialog.showModal();
    title.focus();
  }

  function dismiss() {
    if (!dialog.open || pending) return;
    dialog.close();
    onClose();
    const original = trigger?.isConnected && trigger !== document.body && !trigger.closest("[hidden]") && !trigger.disabled ? trigger : fallbackFocus;
    original.focus({ preventScroll: true });
  }

  seatBoard.addEventListener("keydown", (event) => {
    const direction = arrows[event.key];
    const key = event.target.dataset.seatKey;
    if (!direction || !key) return;
    event.preventDefault();
    if (pending) return;
    const current = openGroup.seats.find((seat) => seat.key === key);
    const next = adjacentSeat(current, openGroup.seats, direction);
    if (next) focusSeat(next.key);
  });

  confirm.addEventListener("click", async () => {
    if (confirm.disabled || pending) return;
    const key = selectedKey;
    pending = true;
    notice.textContent = "";
    update();
    let outcome;
    try {
      outcome = await requestSeat(key);
    } catch {
      outcome = "unavailable";
    } finally {
      pending = false;
    }
    if (outcome === "accepted") {
      dismiss();
      return;
    }
    if (outcome === "occupied") {
      selectedKey = null;
      notice.textContent = "다른 손님이 먼저 선택했습니다. 같은 구역에서 다른 자리를 고르세요.";
    } else {
      notice.textContent = "이 자리로 이동할 수 없습니다. 다시 시도해 주세요.";
    }
    update();
    focusSeat(key, true);
  });

  close.addEventListener("click", dismiss);
  back.addEventListener("click", () => showOverview(true));
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    dismiss();
  });
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dismiss();
  });

  return { open, close: dismiss, get isOpen() { return dialog.open; } };
}
