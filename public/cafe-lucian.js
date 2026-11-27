/* Lucian UX/UI Prompt #292 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#292 */
/* Lucian UX/UI Prompt #416 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#416 */
/* Lucian UX/UI Prompt #433 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#433 */
/* Lucian UX/UI Prompt #437 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#437 */
/* Lucian UX/UI Prompt #020 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#020 */
/* Lucian UX/UI Prompt #467 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#467 */
/* Lucian UX/UI Prompt #408 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#408 */

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

function button(className, label) {
  const el = document.createElement("button");
  el.type = "button";
  el.className = className;
  el.textContent = label;
  return el;
}

function navigationIndex(event, index, count, arrows) {
  const [back, forward] = arrows;
  if (event.key === back) return (index + count - 1) % count;
  if (event.key === forward) return (index + 1) % count;
  if (event.key === "Home") return 0;
  if (event.key === "End") return count - 1;
  return null;
}

function mountLauncher(root) {
  const grid = root.querySelector(".u292-g");
  const filters = root.querySelector(".u292-fs");
  const count = root.querySelector(".u292-n");
  const categories = [
    ["전체", []],
    ["대전", ["pvp"]],
    ["퍼즐", ["mines", "sudoku", "solitaire", "merge", "knit"]],
    ["아케이드", ["tetris", "arcade", "acidrain"]],
    ["타이쿤", ["bungeoppang", "snack-tycoon"]],
  ];
  const tiles = [...grid.querySelectorAll(".pc-app")];
  let selected = 0;
  let laidOut = false;
  const chips = categories.map(([label], index) => {
    const chip = button("u292-f", label);
    chip.addEventListener("click", () => apply(index, true));
    return chip;
  });
  filters.replaceChildren(...chips);
  for (const tile of tiles) tile.classList.add("u292-t");

  function apply(index, animate) {
    selected = index;
    chips.forEach((chip, i) => chip.setAttribute("aria-pressed", String(i === index)));
    const visible = tiles.filter((tile) => index === 0 || categories[index][1].includes(tile.dataset.open));
    count.textContent = `${visible.length}개 게임`;
    const width = grid.clientWidth;
    if (!width) {
      laidOut = false;
      grid.classList.remove("is-laid-out");
      grid.style.height = "";
      return;
    }
    const columns = width >= 540 ? 3 : width >= 310 ? 2 : 1;
    const gap = 8;
    const height = 66;
    const cellWidth = (width - (columns - 1) * gap) / columns;
    grid.style.height = `${Math.ceil(visible.length / columns) * (height + gap) - gap}px`;
    grid.classList.add("is-laid-out");
    for (const tile of tiles) {
      const slot = visible.indexOf(tile);
      const keep = slot >= 0;
      const wasHidden = tile.inert;
      tile.inert = !keep;
      tile.setAttribute("aria-hidden", String(!keep));
      tile.style.width = `${cellWidth}px`;
      if (keep) {
        const x = (slot % columns) * (cellWidth + gap);
        const y = Math.floor(slot / columns) * (height + gap);
        const position = `translate(${x}px,${y}px)`;
        if (wasHidden && animate && laidOut && !reducedMotion.matches) {
          tile.style.transition = "none";
          tile.style.transform = `${position} scale(0)`;
          void tile.offsetWidth;
        }
        tile.style.transition = animate && laidOut ? "" : "none";
        tile.style.transitionDelay = animate && laidOut && !reducedMotion.matches ? `${slot * 35}ms` : "0ms";
        tile.classList.remove("out");
        tile.style.transform = position;
      } else {
        const position = tile.style.transform.replace(/ scale\([^)]*\)/, "");
        tile.style.transition = animate && laidOut ? "" : "none";
        tile.style.transitionDelay = "0ms";
        tile.classList.add("out");
        tile.style.transform = `${position || "translate(0,0)"} scale(.2)`;
      }
    }
    laidOut = true;
  }

  const launcher = root.closest(".pc-launcher");
  new MutationObserver(() => apply(selected, false)).observe(launcher, { attributes: true, attributeFilter: ["open"] });
  let lastWidth = 0;
  new ResizeObserver(() => {
    if (grid.clientWidth === lastWidth) return;
    lastWidth = grid.clientWidth;
    apply(selected, false);
  }).observe(grid);
  apply(0, false);
}

function mountDifficulty(source, options, current, choose, ariaLabel) {
  const root = document.createElement("div");
  root.className = "ux u416 cafe-game-difficulty";
  root.innerHTML = `<div class="u416-tl" role="group"><span class="u416-th" aria-hidden="true"></span></div>`;
  const track = root.firstElementChild;
  const thumb = track.firstElementChild;
  track.setAttribute("aria-label", ariaLabel);
  let selected = current();
  const choices = options.map((label, index) => {
    const el = button("u416-tab", label);
    el.addEventListener("click", () => { if (index !== current()) choose(index); sync(); });
    track.append(el);
    return el;
  });
  function sync() {
    const index = current();
    const el = choices[index];
    if (!el) return;
    const forward = index > selected;
    thumb.style.setProperty("--tl", forward ? ".62s" : ".38s");
    thumb.style.setProperty("--tr", forward ? ".38s" : ".62s");
    thumb.style.setProperty("--l", `${el.offsetLeft}px`);
    thumb.style.setProperty("--r", `${track.clientWidth - el.offsetLeft - el.offsetWidth}px`);
    choices.forEach((choice, i) => {
      choice.setAttribute("aria-pressed", String(i === index));
      choice.tabIndex = i === index ? 0 : -1;
    });
    selected = index;
  }
  track.addEventListener("keydown", (event) => {
    const next = navigationIndex(event, selected, choices.length, ["ArrowLeft", "ArrowRight"]);
    if (next === null) return;
    event.preventDefault();
    choices[next].click();
    choices[next].focus({ preventScroll: true });
  });
  source.after(root);
  source.hidden = true;
  new ResizeObserver(sync).observe(track);
  sync();
  return sync;
}

function mountSelectDifficulty(select) {
  const choices = [...select.options];
  const sync = mountDifficulty(select.closest("label") || select, choices.map((item) => item.textContent), () => select.selectedIndex, (index) => {
    select.selectedIndex = index;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  }, "난이도 선택");
  select.addEventListener("change", sync);
}

function mountGameOptions() {
  for (const id of ["pvp-game-type", "pvp-ai-level"]) {
    const select = document.getElementById(id);
    const root = document.createElement("div");
    root.className = "ux u433 cafe-game-options";
    const group = document.createElement("div");
    group.className = "u433-rg";
    group.setAttribute("role", "radiogroup");
    group.setAttribute("aria-label", select.getAttribute("aria-label"));
    root.append(group);
    const radios = [...select.options].map((option) => {
      const row = document.createElement("label");
      row.className = "u433-row";
      row.innerHTML = '<input class="u433-in" type="radio"><span class="u433-rd" aria-hidden="true"></span>';
      row.append(option.textContent.replace(/^(⚫|🎯)\s*/, ""));
      const input = row.firstElementChild;
      input.name = `${id}-choice`;
      input.value = option.value;
      input.addEventListener("change", () => {
        select.value = input.value;
        select.dispatchEvent(new Event("change", { bubbles: true }));
      });
      group.append(row);
      return input;
    });
    function sync() {
      root.hidden = select.hidden;
      for (const input of radios) {
        input.checked = input.value === select.value;
        input.disabled = select.disabled;
      }
    }
    select.after(root);
    select.classList.add("cafe-mirrored-control");
    select.addEventListener("change", sync);
    new MutationObserver(sync).observe(select, { attributes: true, attributeFilter: ["disabled", "hidden"] });
    sync();
  }

  const original = document.getElementById("sol-draw-mode");
  const root = document.createElement("div");
  root.className = "ux u433 cafe-game-options";
  root.innerHTML = '<label class="u433-row u433-sw-row">3장 뽑기<input class="u433-in" type="checkbox" role="switch"><span class="u433-sw" aria-hidden="true"></span></label>';
  const row = root.firstElementChild;
  const control = row.querySelector("input");
  const sync = () => { control.checked = original.getAttribute("aria-pressed") === "true"; };
  control.addEventListener("change", () => { original.click(); sync(); });
  row.addEventListener("pointerdown", (event) => { if (event.button === 0) row.classList.add("is-press"); });
  for (const name of ["pointerup", "pointercancel", "pointerleave", "keyup", "focusout"]) {
    row.addEventListener(name, () => row.classList.remove("is-press"));
  }
  control.addEventListener("keydown", (event) => { if (event.key === " ") row.classList.add("is-press"); });
  original.after(root);
  original.hidden = true;
  new MutationObserver(sync).observe(original, { attributes: true, attributeFilter: ["aria-pressed"] });
  sync();
}

function mountTooltips(root, entries) {
  root.classList.add("ux", "u437", "cafe-game-tools");
  const tip = document.createElement("span");
  tip.className = "u437-tip";
  tip.id = `${root.closest("dialog").id}-tool-tip`;
  tip.setAttribute("role", "tooltip");
  tip.hidden = true;
  tip.innerHTML = '<span class="u437-in"><span class="u437-tl"></span><kbd><span></span></kbd><span class="u437-ar"></span></span>';
  const caption = tip.querySelector(".u437-tl");
  const key = tip.querySelector("kbd");
  root.append(tip);
  let current, pending, closeTimer, lastClose = -Infinity;
  function hide() {
    clearTimeout(pending);
    clearTimeout(closeTimer);
    if (!current) return;
    current.removeAttribute("aria-describedby");
    current.classList.remove("is-on");
    current = null;
    lastClose = performance.now();
    tip.classList.remove("is-on");
    closeTimer = setTimeout(() => { if (!current) tip.hidden = true; }, 160);
  }
  function show(target, label, shortcut) {
    clearTimeout(closeTimer);
    current?.removeAttribute("aria-describedby");
    current?.classList.remove("is-on");
    tip.classList.toggle("is-glide", !reducedMotion.matches && performance.now() - lastClose < 650);
    current = target;
    caption.textContent = label;
    key.hidden = !shortcut;
    key.firstElementChild.textContent = shortcut || "";
    tip.hidden = false;
    const center = target.getBoundingClientRect().left - root.getBoundingClientRect().left + target.offsetWidth / 2;
    const left = Math.max(0, Math.min(root.clientWidth - tip.offsetWidth, center - tip.offsetWidth / 2));
    tip.style.setProperty("--x", `${left}px`);
    tip.style.setProperty("--y", `${target.offsetTop - 40}px`);
    tip.style.setProperty("--ax", `${center - left}px`);
    target.setAttribute("aria-describedby", tip.id);
    target.classList.add("is-on");
    void tip.offsetWidth;
    tip.classList.add("is-on");
  }
  for (const [id, label, shortcut] of entries) {
    const target = document.getElementById(id);
    if (!target) continue;
    target.classList.add("u437-b");
    function want() {
      clearTimeout(pending);
      const delay = performance.now() - lastClose < 650 || reducedMotion.matches ? 0 : 400;
      pending = setTimeout(() => show(target, label, shortcut), delay);
    }
    target.addEventListener("pointerenter", (event) => { if (event.pointerType !== "touch") want(); });
    target.addEventListener("pointerleave", hide);
    target.addEventListener("focus", () => show(target, label, shortcut));
    target.addEventListener("blur", hide);
  }
  root.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && current) { event.preventDefault(); event.stopPropagation(); hide(); }
  });
  root.closest("dialog").addEventListener("close", hide);
}

function mountProfile(root) {
  const toggle = root.querySelector(".u408-av");
  const menu = root.querySelector(".u408-m");
  const items = [...menu.querySelectorAll("[role=menuitem]")];
  function setOpen(open, focusIndex) {
    root.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    menu.inert = !open;
    if (open && focusIndex !== undefined) items[focusIndex].focus({ preventScroll: true });
  }
  toggle.addEventListener("click", () => setOpen(menu.inert, menu.inert ? 0 : undefined));
  toggle.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    setOpen(true, event.key === "ArrowUp" ? items.length - 1 : 0);
  });
  menu.addEventListener("keydown", (event) => {
    if (event.key === "Escape" || event.key === "Tab") {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); }
      setOpen(false);
      toggle.focus({ preventScroll: true });
      return;
    }
    const next = navigationIndex(event, items.indexOf(document.activeElement), items.length, ["ArrowUp", "ArrowDown"]);
    if (next === null) return;
    event.preventDefault();
    items[next].focus({ preventScroll: true });
  });
  document.addEventListener("pointerdown", (event) => { if (!root.contains(event.target)) setOpen(false); });
  for (const item of items) {
    item.addEventListener("click", () => {
      setOpen(false);
      toggle.focus({ preventScroll: true });
    });
  }
  document.getElementById("profile-settings").addEventListener("click", () => document.getElementById("cafe-menu-open").click());
}

export function mountNicknameCounter(input) {
  const root = input.form;
  const circle = root.querySelector(".u467-rg .fg");
  const number = root.querySelector(".u467-rg b");
  const live = root.querySelector(".u467-live");
  const circumference = 2 * Math.PI * 12;
  function sync(typed = false) {
    const left = Math.max(0, input.maxLength - input.value.length);
    root.classList.toggle("is-warn", left <= 3);
    circle.style.strokeDasharray = `${circumference * (1 - left / input.maxLength)} ${circumference}`;
    number.textContent = String(left);
    if (!typed || left > 3) live.textContent = "";
    else live.textContent = `${left}자 남았어요`;
  }
  input.addEventListener("input", () => sync(true));
  sync();
  return sync;
}

export function mountAvatarPalette(stage, list, onSelect) {
  stage.classList.add("u020");
  const sample = stage.querySelector(".u020-new");
  const glow = stage.querySelector(".u020-glow");
  const root = document.createElement("div");
  root.className = "ux u020 cafe-avatar-palette";
  root.innerHTML = '<p class="u020-name" aria-live="polite"></p><div class="u020-row" role="radiogroup" aria-label="헤어 색상"><span class="u020-ring" aria-hidden="true"></span></div>';
  const row = root.querySelector(".u020-row");
  const ring = row.firstElementChild;
  const name = root.querySelector(".u020-name");
  let active = -1;
  let finishColor = 0;
  const choices = list.map((item, index) => {
    const el = button("u020-sw", "");
    el.style.setProperty("--s", item.base);
    el.setAttribute("role", "radio");
    el.setAttribute("aria-label", item.name);
    el.addEventListener("click", () => onSelect(index));
    row.append(el);
    return el;
  });
  function updateRing() {
    const el = choices[active];
    if (el) ring.style.transform = `translate(${el.offsetLeft - 6}px,${el.offsetTop - 6}px)`;
  }
  function sync(index) {
    if (index === active) return;
    const previous = active;
    active = index;
    const { name: label, base } = list[index];
    choices.forEach((el, i) => {
      el.tabIndex = i === index ? 0 : -1;
      el.setAttribute("aria-checked", String(i === index));
    });
    updateRing();
    clearTimeout(finishColor);
    const animate = previous !== -1 && !reducedMotion.matches;
    stage.style.setProperty("--n", base);
    glow.style.backgroundColor = base;
    sample.classList.remove("go");
    if (animate) {
      void sample.offsetWidth;
      sample.classList.add("go");
      finishColor = setTimeout(() => {
        stage.style.setProperty("--c", base);
        sample.classList.remove("go");
      }, 700);
    } else stage.style.setProperty("--c", base);
    const old = name.lastElementChild;
    const text = document.createElement("span");
    text.textContent = label;
    if (old && animate) {
      old.setAttribute("aria-hidden", "true");
      old.style.transform = "translateY(-24px)";
      old.style.opacity = "0";
      text.style.transform = "translateY(24px)";
      text.style.opacity = "0";
      name.replaceChildren(old, text);
      void text.offsetWidth;
      text.style.transform = "none";
      text.style.opacity = "1";
      setTimeout(() => old.remove(), 500);
    } else name.replaceChildren(text);
  }
  row.addEventListener("keydown", (event) => {
    const next = navigationIndex(event, active, choices.length, ["ArrowLeft", "ArrowRight"]);
    if (next === null) return;
    event.preventDefault();
    onSelect(next);
    choices[next].focus({ preventScroll: true });
  });
  new ResizeObserver(updateRing).observe(row);
  return { root, sync };
}

export function mountLucianCafe() {
  mountLauncher(document.querySelector(".cafe-launcher-gallery"));
  mountProfile(document.querySelector(".cafe-profile"));
  mountGameOptions();
  mountSelectDifficulty(document.getElementById("sudoku-level"));
  const tiers = document.querySelector(".mine-tiers");
  const modes = [...tiers.querySelectorAll("[data-mine-tier]")];
  const sync = mountDifficulty(tiers, modes.map((mode) => mode.textContent.split(" (")[0]),
    () => modes.findIndex((mode) => mode.getAttribute("aria-pressed") === "true"),
    (index) => modes[index].click(), "지뢰찾기 난이도");
  const changes = new MutationObserver(sync);
  changes.observe(tiers, { subtree: true, attributes: true, attributeFilter: ["aria-pressed"] });
  mountTooltips(document.querySelector(".sol-toolbar"), [["sol-hint", "옮길 수 있는 카드 보기"], ["sol-undo", "마지막 이동 되돌리기"]]);
  mountTooltips(document.querySelector(".knit-toolbar"), [["knit-hint", "풀 수 있는 실패 보기"], ["knit-undo", "마지막 동작 되돌리기"]]);
  mountTooltips(document.querySelector(".mine-toolbar"), [["mine-toggle", "깃발 모드", "F"]]);
}
