// Adapted from Lucian UX/UI Prompt #227, #242, and #353 · MIT License (c) 2026 Seokwoooo.
const $ = (selector, root = document) => root.querySelector(selector);
const shop = $("#snacks");
const boardDialog = $("#snack-board");
const couponDialog = $("#snack-coupon");
const seating = window.cafeSeating;
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
const stateKey = "corner-cafe-order";
const storage = {
  get(store, key) { try { return window[store].getItem(key); } catch { return null; } },
  set(store, key, value) { try { window[store].setItem(key, value); } catch {} },
};
const member = storage.get("localStorage", "corner-cafe-member") || crypto.randomUUID();
storage.set("localStorage", "corner-cafe-member", member);
const currentSeat = () => !seating.phase() && seating.current();
const setText = (node, value) => { const text = String(value); if (node.textContent !== text) node.textContent = text; };
const lineText = (items) => items.map(({ name, count }) => name + " × " + count).join(" · ");
const element = (tag, className, content = "") => {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = content;
  return node;
};
let data, catalog, sending = false, inFlight, retryId, order, orderTick, pollTimer;
let clockOffset = 0;
try { order = JSON.parse(storage.get("sessionStorage", stateKey)); } catch {}
const serverNow = () => Date.now() + clockOffset;
const cart = new Map();
const controls = new Map();
const reward = $("#order-reward");
const rewardToggle = $("input", reward);
const submit = $("#place-order");
const shopFeedback = $("#shop-feedback");
const couponFeedback = $("#coupon-feedback");

function updateShop() {
  const seat = currentSeat();
  const waiting = order && order.readyAt > serverNow();
  const eligible = data && data.loyalty.balance >= data.loyalty.couponStamps;
  setText($("#order-location"), seat ? "내 자리 " + seating.label(seat) + "로 가져다드려요." : "자리에 앉으면 주문할 수 있어요.");
  reward.hidden = !catalog || !eligible;
  if (!eligible) rewardToggle.checked = false;
  const quantity = [...cart.values()].reduce((sum, count) => sum + count, 0) + Number(rewardToggle.checked);
  for (const [id, row] of controls) {
    const count = cart.get(id) || 0;
    setText(row.count, count);
    row.minus.disabled = sending || count === 0;
    row.plus.disabled = sending || count >= 9 || quantity >= 30 || (!count && cart.size >= 15);
  }
  rewardToggle.disabled = sending || (!rewardToggle.checked && quantity >= 30);
  submit.disabled = !seat || sending || !quantity || waiting;
  setText(submit, waiting ? "주문 조리 중" : quantity ? "내 자리로 주문하기 · " + quantity + "개" : "내 자리로 주문하기");
  $("#order-receipt").hidden = !order;
  if (order) {
    setText($("#order-status"), "주문 " + order.id.slice(0, 8).toUpperCase() + (waiting ? " · 조리 중" : " · 준비 완료"));
    setText($("#order-items"), lineText(order.items));
  }
}

// #242: keep the chip rail visible and track the section at the scroll edge.
const scroller = $(".u242-sc");
const chips = $(".u242-cr");
const menuBody = $(".u242-bd");
const search = $("#snack-search");
let sections = [], pinnedUntil = 0, catalogFrame = 0;
function markSection(id) {
  const active = sections.find((section) => section.id === id);
  if (!active) return;
  for (const entry of sections) entry.chip.setAttribute("aria-current", String(entry === active));
  const highlight = $(".u242-ul", chips);
  highlight.style.width = active.chip.offsetWidth + "px";
  highlight.style.transform = "translateX(" + active.chip.offsetLeft + "px)";
  const left = active.chip.offsetLeft;
  const right = left + active.chip.offsetWidth;
  if (left < chips.scrollLeft || right > chips.scrollLeft + chips.clientWidth) {
    chips.scrollTo({ left: left - 14, behavior: reduced.matches ? "instant" : "smooth" });
  }
}
function renderCatalog() {
  if (!catalog) return;
  const query = search.value.trim().toLocaleLowerCase("ko");
  controls.clear();
  menuBody.replaceChildren();
  const highlight = element("i", "u242-ul");
  highlight.setAttribute("aria-hidden", "true");
  chips.replaceChildren(highlight);
  sections = [];
  for (const category of catalog.categories) {
    const matches = category.items.filter((item) => item.available !== false &&
      (category.name + " " + item.name + " " + item.copy).toLocaleLowerCase("ko").includes(query));
    if (!matches.length) continue;
    const chip = element("button", "u242-ch", category.name);
    chip.type = "button";
    const section = element("section", "u242-sx");
    section.append(element("h4", "", category.name));
    chip.addEventListener("click", () => {
      markSection(category.id);
      pinnedUntil = performance.now() + 640;
      const top = section.offsetTop - chips.offsetHeight;
      scroller.scrollTo({ top, behavior: reduced.matches ? "instant" : "smooth" });
    });
    chips.append(chip);
    menuBody.append(section);
    sections.push({ id: category.id, chip, section });
    for (const item of matches) {
      const row = element("article", "u242-it");
      const icon = element("i", "", item.icon);
      icon.setAttribute("aria-hidden", "true");
      const title = element("div", "");
      title.append(element("b", "", item.name), element("span", "", item.copy));
      const actions = element("div", "order-controls");
      const minus = element("button", "", "−");
      const count = element("span", "item-count", "0");
      const plus = element("button", "", "+");
      for (const [button, delta] of [[minus, -1], [plus, 1]]) {
        button.type = "button";
        button.setAttribute("aria-label", item.name + (delta > 0 ? " 추가" : " 빼기"));
        button.addEventListener("click", () => {
          const value = (cart.get(item.id) || 0) + delta;
          if (value) cart.set(item.id, value);
          else cart.delete(item.id);
          retryId = null;
          updateShop();
        });
      }
      controls.set(item.id, { count, minus, plus });
      actions.append(minus, count, plus);
      row.append(icon, title, actions);
      section.append(row);
    }
  }
  if (sections.length) menuBody.append(element("div", "u242-end"));
  else menuBody.append(element("p", "shop-menu-empty", "검색과 일치하는 메뉴가 없어요."));
  scroller.scrollTop = 0;
  pinnedUntil = 0;
  markSection(sections[0]?.id);
  updateShop();
}
search.addEventListener("input", renderCatalog);
rewardToggle.addEventListener("change", () => { retryId = null; updateShop(); });
scroller.addEventListener("scroll", () => {
  if (catalogFrame) return;
  catalogFrame = requestAnimationFrame(() => {
    catalogFrame = 0;
    chips.parentElement.classList.toggle("is-stuck", scroller.scrollTop > 0);
    if (performance.now() < pinnedUntil) return;
    const edge = scroller.scrollTop + chips.offsetHeight + 13;
    markSection(sections.findLast(({ section }) => section.offsetTop <= edge)?.id ?? sections[0]?.id);
  });
}, { passive: true });

// #227: reuse rows by order number, move them on sort, queue arrivals while paused.
const board = $("#snack-live");
const boardBody = $(".u227-bd", board);
const boardEmpty = $(".shop-board-empty", board);
const pause = $(".u227-pz", board);
const rendered = new Map();
let sortKey = "createdAt", direction = -1, paused = false, firstBoard = true;
function renderBoard() {
  if (!data) return;
  if (paused) {
    const count = data.orders.filter((entry) => !rendered.has(entry.number)).length;
    setText($("em", pause), count || "");
    return;
  }
  const orders = data.orders.toSorted((a, b) => direction * (a[sortKey] - b[sortKey]) || b.createdAt - a.createdAt);
  const numbers = new Set(orders.map((entry) => entry.number));
  for (const [number, row] of rendered) {
    if (!numbers.has(number)) { row.node.remove(); rendered.delete(number); }
  }
  orders.forEach((entry, index) => {
    let row = rendered.get(entry.number);
    if (!row) {
      const node = element("div", "u227-r");
      node.setAttribute("role", "row");
      const summary = element("span", "nm");
      const name = element("b", "", lineText(entry.items));
      name.title = name.textContent;
      summary.append(name, element("small", "", "#" + entry.number.toUpperCase()));
      const quantity = element("span", "am", entry.quantity + "개");
      const status = element("span", "st");
      for (const cell of [summary, quantity, status]) cell.setAttribute("role", "cell");
      node.append(summary, quantity, status);
      node.style.transform = "translateY(" + (index + 1) * 42 + "px)";
      boardBody.append(node);
      if (!firstBoard) node.classList.add("is-new");
      row = { node, status };
      rendered.set(entry.number, row);
      requestAnimationFrame(() => {
        if (rendered.get(entry.number) === row) row.node.style.transform = "translateY(" + row.index * 42 + "px)";
      });
    } else row.node.style.transform = "translateY(" + index * 42 + "px)";
    row.index = index;
    const ready = entry.readyAt <= serverNow();
    row.status.style.setProperty("--c", ready ? "#c4d6ac" : "#efcaa4");
    setText(row.status, ready ? "준비 완료" : "조리 중");
  });
  boardBody.style.height = orders.length * 42 + "px";
  boardEmpty.hidden = Boolean(orders.length);
  setText(boardEmpty, "아직 접수된 주문이 없어요.");
  firstBoard = false;
}
for (const button of board.querySelectorAll("[data-sort]")) {
  button.addEventListener("click", () => {
    direction = sortKey === button.dataset.sort ? -direction : -1;
    sortKey = button.dataset.sort;
    for (const candidate of board.querySelectorAll("[data-sort]")) {
      if (candidate === button) candidate.parentElement.setAttribute("aria-sort", direction < 0 ? "descending" : "ascending");
      else candidate.parentElement.removeAttribute("aria-sort");
    }
    renderBoard();
  });
}
pause.addEventListener("click", () => {
  paused = !paused;
  board.classList.toggle("is-pause", paused);
  pause.setAttribute("aria-pressed", String(paused));
  setText($("span", pause), paused ? "다시 재생" : "일시정지");
  if (!paused) setText($("em", pause), "");
  renderBoard();
});

// #353: stamp lands on its slot and the card flips when the reward is ready.
const card = $("#coupon-card");
const claim = $("#claim-stamp");
const slots = Array.from({ length: 10 }, (_, index) => {
  const slot = element("span", "u353-sl");
  slot.innerHTML = '<svg viewBox="0 0 32 32"><path d="M8 9h13v9a6 6 0 0 1-6 6h-1a6 6 0 0 1-6-6zm13 2h4v5l-4 2M6 26h20M12 6V3m5 3V3" fill="none" stroke="#6a4e3d" stroke-width="2"/></svg><span class="u353-ink"><svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="14" fill="#9f6149"/><path d="M9 17l4 4 10-10" fill="none" stroke="#fff0d4" stroke-width="3"/></svg></span>';
  $(".u353-ink", slot).style.setProperty("--r", (index % 3 - 1) * 7 + "deg");
  $(".u353-gd", card).append(slot);
  return slot;
});
let stamping = false;
function duration(ms) {
  const minutes = Math.floor(ms / 60000);
  return minutes >= 60 ? Math.floor(minutes / 60) + "시간 " + minutes % 60 + "분" : minutes + "분";
}
function updateCoupon() {
  if (!data) return;
  const { today, total, claimed, balance, threshold, couponStamps } = data.loyalty;
  const progress = Math.min(balance, couponStamps);
  setText($("#coupon-time"), "오늘 " + duration(today) + " / " + duration(threshold) + " · 누적 " + duration(total));
  claim.disabled = sending || stamping || claimed || today < threshold;
  setText(claim, claimed ? "오늘 도장 받았어요" : "오늘 도장 받기");
  if (stamping) return;
  slots.forEach((slot, index) => $(".u353-ink", slot).classList.toggle("is-on", index < progress));
  $(".u353-bar i", card).style.width = progress / couponStamps * 100 + "%";
  setText($(".u353-n", card), progress + " / " + couponStamps);
  card.classList.toggle("is-done", balance >= couponStamps);
}
function stamp(index) {
  if (reduced.matches || !slots[index] || !couponDialog.open) return;
  const stampTool = $(".u353-stp", card);
  const box = slots[index].getBoundingClientRect();
  const base = card.getBoundingClientRect();
  const x = box.left - base.left + box.width / 2 - stampTool.offsetWidth / 2;
  const y = box.top - base.top + box.height / 2 - stampTool.offsetHeight / 2;
  stamping = true;
  stampTool.animate([
    { opacity: 0, transform: "translate(" + x + "px," + (y - 46) + "px) rotate(-12deg)" },
    { opacity: 1, transform: "translate(" + x + "px," + y + "px)", offset: .54 },
    { opacity: 0, transform: "translate(" + x + "px," + (y - 18) + "px)" },
  ], { duration: 560, easing: "ease-out" });
  setTimeout(() => $(".u353-ink", slots[index]).classList.add("is-on"), 300);
  setTimeout(() => { stamping = false; updateCoupon(); }, 560);
}

function showDelivery() {
  const seat = currentSeat();
  if (!seat || seat !== order.seat) return;
  const location = seating.position(seat);
  if (location) {
    const tray = element("div", "delivery-scene", "🍱");
    tray.setAttribute("aria-hidden", "true");
    tray.style.setProperty("--x", location.x + "%");
    tray.style.setProperty("--y", (location.y - 4) + "%");
    $(".scene").append(tray);
    setTimeout(() => tray.remove(), 3600);
  }
  const opened = [...document.querySelectorAll("dialog[open]")].at(-1);
  if (opened) {
    const banner = element("div", "delivery-banner");
    const icon = element("span", "", "🍱");
    icon.setAttribute("aria-hidden", "true");
    banner.append(icon, element("strong", "", "먹거리가 도착했어요!"));
    banner.setAttribute("role", "status");
    opened.append(banner);
    setTimeout(() => banner.remove(), 3800);
  }
  window.recordCafeStamp?.("snack");
}
function watchDelivery() {
  clearTimeout(orderTick);
  if (!order || order.delivered) return;
  const wait = order.readyAt - serverNow();
  if (wait > 0) { orderTick = setTimeout(watchDelivery, wait + 20); return; }
  order.delivered = true;
  storage.set("sessionStorage", stateKey, JSON.stringify(order));
  showDelivery();
  updateShop();
  if (boardDialog.open) renderBoard();
}

function applyData(result, animateStamp = false) {
  const previousBalance = data?.loyalty.balance ?? 0;
  data = result;
  clockOffset = result.now - Date.now();
  if (animateStamp && result.loyalty.claimed && result.loyalty.balance > previousBalance) stamp(previousBalance);
  if (boardDialog.open) renderBoard();
  updateCoupon();
  updateShop();
  watchDelivery();
}
async function request(action, params = {}) {
  const visitor = storage.get("sessionStorage", "neon-cafe-visitor");
  const response = await fetch("./api/snacks", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, member, visitor, ...params }),
    signal: AbortSignal.timeout(6000),
  });
  if (!response.ok) throw Error("snack service");
  return response.json();
}
async function refresh() {
  clearTimeout(pollTimer);
  if (document.hidden || !(currentSeat() || shop.open || boardDialog.open || couponDialog.open)) return;
  if (!sending && !inFlight) {
    inFlight = request("sync", { active: Boolean(currentSeat()) });
    try {
      const result = await inFlight;
      if (!sending) {
        applyData(result);
        if (couponFeedback.dataset.network) { delete couponFeedback.dataset.network; setText(couponFeedback, ""); }
      }
    } catch {
      if (!data) {
        setText(boardEmpty, "주문표에 연결할 수 없어요. 잠시 후 다시 시도해요.");
        couponFeedback.dataset.network = "true";
        setText(couponFeedback, "이용 시간을 확인할 수 없어요. 잠시 후 다시 시도해요.");
      }
    } finally { inFlight = null; }
  }
  clearTimeout(pollTimer);
  pollTimer = setTimeout(refresh, boardDialog.open ? 2800 : 8500);
}
async function action(task) {
  if (sending) return;
  sending = true;
  updateShop();
  updateCoupon();
  try { if (inFlight) await inFlight.catch(() => {}); await task(); }
  finally { sending = false; updateShop(); updateCoupon(); }
}
submit.addEventListener("click", () => action(async () => {
  setText(shopFeedback, "주문을 보내고 있어요.");
  try {
    const result = await request("order", {
      id: retryId ||= crypto.randomUUID(),
      items: [...cart].map(([id, count]) => ({ id, count })),
      coupon: rewardToggle.checked,
    });
    if (result.order) {
      order = result.order;
      storage.set("sessionStorage", stateKey, JSON.stringify(order));
      cart.clear();
      retryId = null;
      rewardToggle.checked = false;
      setText(shopFeedback, "");
    } else setText(shopFeedback, "좌석이나 쿠폰 상태가 바뀌었거나 이미 조리 중인 주문이 있어요.");
    applyData(result);
  } catch { setText(shopFeedback, "주문을 확인하지 못했어요. 다시 눌러주세요."); }
}));
claim.addEventListener("click", () => action(async () => {
  try {
    const result = await request("stamp");
    setText(couponFeedback, result.loyalty.claimed ? "오늘 도장이 기록됐어요." : "오늘 이용 시간이 아직 부족해요.");
    applyData(result, true);
  } catch { setText(couponFeedback, "도장을 받지 못했어요. 잠시 후 다시 눌러주세요."); }
}));
const onDialog = new MutationObserver(() => {
  if (shop.open) requestAnimationFrame(() => markSection(sections[0]?.id));
  if (boardDialog.open) renderBoard();
  refresh();
});
for (const dialog of [shop, boardDialog, couponDialog]) onDialog.observe(dialog, { attributes: true, attributeFilter: ["open"] });
document.addEventListener("visibilitychange", refresh);
document.addEventListener("cafe-seat-phase", () => { updateShop(); refresh(); });
fetch("./snack-menu.json").then((response) => {
  if (!response.ok) throw Error("catalog");
  return response.json();
}).then((menu) => {
  catalog = menu;
  setText($("span", reward), menu.reward.icon + " " + menu.reward.name + " 쿠폰 적용");
  renderCatalog();
}).catch(() => menuBody.append(element("p", "shop-menu-empty", "매점 메뉴를 불러올 수 없어요. 새로고침해 주세요.")));
updateShop();
watchDelivery();
refresh();
