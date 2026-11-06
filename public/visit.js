/* Lucian UX/UI Prompt #353 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#353 */
"use strict";

{
  const key = "neon-pcbang-regular";
  const card = document.getElementById("visit-card");
  const menu = document.getElementById("cafe-menu");
  const count = document.getElementById("visit-count");
  const reward = document.getElementById("visit-reward");
  const stamps = [...card.querySelectorAll("[data-stamp]")];
  const queue = [];
  const progress = document.createElement("span");
  progress.className = "visit-progress";
  progress.setAttribute("aria-hidden", "true");
  const progressFill = document.createElement("span");
  progressFill.className = "visit-progress-fill";
  progress.append(progressFill);
  card.querySelector(".visit-title").after(progress);
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  let active = null;
  let saved;
  try { saved = JSON.parse(localStorage.getItem(key)); } catch {}
  const collected = new Set(stamps.map((item) => item.dataset.stamp)
    .filter((stamp) => Array.isArray(saved) && saved.includes(stamp)));

  for (const [index, item] of stamps.entries()) {
    const icon = item.querySelector("svg");
    icon.classList.add("visit-source-icon");
    const iconUse = icon.querySelector("use");
    const href = iconUse?.getAttribute("href");
    const degrees = ((index * 17 + 8) % 35) - 17;
    const ink = document.createElement("span");
    ink.className = "visit-ink";
    ink.style.setProperty("--visit-stamp-rotation", degrees + "deg");
    ink.setAttribute("aria-hidden", "true");
    const mark = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    mark.classList.add("visit-ink-mark");
    mark.setAttribute("viewBox", "0 0 60 60");
    const circle = document.createElementNS(mark.namespaceURI, "circle");
    circle.setAttribute("cx", "30");
    circle.setAttribute("cy", "30");
    circle.setAttribute("r", "26");
    circle.setAttribute("stroke-dasharray", "40 2 30 3 50 2");
    mark.append(circle);
    const innerCircle = document.createElementNS(mark.namespaceURI, "circle");
    innerCircle.setAttribute("cx", "30");
    innerCircle.setAttribute("cy", "30");
    innerCircle.setAttribute("r", "20");
    innerCircle.classList.add("visit-ink-inner");
    mark.append(innerCircle);
    const symbol = document.createElementNS(mark.namespaceURI, "svg");
    symbol.setAttribute("viewBox", "0 0 24 24");
    symbol.classList.add("visit-ink-symbol");
    if (href) {
      const use = document.createElementNS(mark.namespaceURI, "use");
      use.setAttribute("href", href);
      symbol.append(use);
    }
    mark.append(symbol);
    ink.append(mark);
    const press = document.createElement("span");
    press.className = "visit-stamp-press";
    press.setAttribute("aria-hidden", "true");
    item.classList.add("visit-stamp-slot");
    item.append(ink, press);
    if (collected.has(item.dataset.stamp)) ink.classList.add("is-on");
  }

  function paint() {
    for (const item of stamps) {
      const hasStamp = collected.has(item.dataset.stamp);
      const isStamped = item.querySelector(".visit-ink").classList.contains("is-on");
      item.classList.toggle("stamped", isStamped);
      item.setAttribute("aria-label", item.querySelector("span").textContent + (hasStamp ? ", 획득" : ", 획득 전"));
    }
    count.textContent = collected.size + " / " + stamps.length;
    const landed = stamps.filter((item) => item.querySelector(".visit-ink").classList.contains("is-on")).length;
    progressFill.style.width = landed / stamps.length * 100 + "%";
    if (collected.size === stamps.length) {
      card.classList.add("complete");
      reward.textContent = "단골 카드 완성! 이름 옆에 단골 별이 붙었어요.";
    }
  }

  function finalizeStamp(item) {
    item.querySelector(".visit-ink").classList.add("is-on");
    paint();
  }

  function stopActiveStamp(finish) {
    if (!active) return;
    const current = active;
    active = null;
    clearTimeout(current.land);
    if (current.animation) {
      current.animation.onfinish = null;
      current.animation.oncancel = null;
      current.animation.cancel();
    }
    current.press.classList.remove("is-pressing");
    if (finish) finalizeStamp(current.item);
    if (menu.open) playNext();
  }

  function stamp(item) {
    const press = item.querySelector(".visit-stamp-press");
    if (typeof press.animate !== "function") {
      finalizeStamp(item);
      if (menu.open) playNext();
      return;
    }
    const animation = press.animate([
      { transform: "translate(20px,-60px) scale(1.25) rotate(8deg)", opacity: 0 },
      { transform: "translate(0px,-10px) scale(1.1)", opacity: 1, offset: .4 },
      { transform: "translate(0px,2px) scale(1.04,.92)", offset: .55 },
      { transform: "translate(0px,-50px) scale(1.15)", opacity: 1, offset: .85 },
      { transform: "translate(-10px,-70px) scale(1.2)", opacity: 0 },
    ], { duration: 560, easing: "ease-in-out" });
    active = { item, press, animation, land: 0 };
    press.classList.add("is-pressing");
    active.land = setTimeout(() => finalizeStamp(item), 300);
    animation.onfinish = () => stopActiveStamp(false);
    animation.oncancel = () => stopActiveStamp(false);
  }

  function playNext() {
    if (!menu.open || active || !queue.length) return;
    if (motion.matches) {
      for (const item of queue.splice(0)) finalizeStamp(item);
      return;
    }
    stamp(queue.shift());
  }

  function updateMotion() {
    if (!motion.matches) return;
    stopActiveStamp(true);
    for (const item of queue.splice(0)) finalizeStamp(item);
  }

  function updateMenu() {
    if (menu.open) playNext();
    else stopActiveStamp(true);
  }

  const menuObserver = new MutationObserver(updateMenu);
  menuObserver.observe(menu, { attributes: true, attributeFilter: ["open"] });
  motion.addEventListener("change", updateMotion);

  window.cafeIsRegular = () => collected.size === stamps.length;
  window.recordCafeStamp = (stampName) => {
    const item = stamps.find((candidate) => candidate.dataset.stamp === stampName);
    if (!item || collected.has(stampName)) return;
    collected.add(stampName);
    try { localStorage.setItem(key, JSON.stringify([...collected])); } catch {}
    paint();
    if (menu.open) {
      queue.push(item);
      playNext();
    } else {
      queue.push(item);
    }
    if (window.cafeIsRegular()) {
      document.dispatchEvent(new Event("cafe-regular"));
      document.querySelector(".u070").dispatchEvent(new CustomEvent("pcbang-notice", {
        detail: { message: "단골 카드 완성! 이름 옆에 단골 별이 붙었어요.", kind: "ok" },
      }));
    }
  };
  paint();
}
