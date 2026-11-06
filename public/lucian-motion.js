/* Lucian UX/UI Prompt #013 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#013 */
/* Lucian UX/UI Prompt #100 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#100 */
/* Lucian UX/UI Prompt #070 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#070 */
/* Lucian UX/UI Prompt #061 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#061 */
"use strict";

const cafeReducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const cafeWindowTransitions = new WeakMap();
const cafeWindowBound = new WeakSet();
const cafeActiveMotions = new Set();
const cafeWindowTiming = { duration: 520, easing: "cubic-bezier(.2,.8,.2,1)" };

cafeReducedMotion.addEventListener("change", () => {
  if (cafeReducedMotion.matches) cafeActiveMotions.forEach((animation) => animation.cancel());
});

function trackCafeMotion(animation) {
  cafeActiveMotions.add(animation);
  const clear = () => cafeActiveMotions.delete(animation);
  animation.finished.then(clear, clear);
  return animation;
}

function cafeWindowOrigin(origin) {
  if (cafeReducedMotion.matches || !(origin instanceof Element)) return null;
  const rect = origin.getBoundingClientRect();
  return rect.width && rect.height && rect.right > 0 && rect.bottom > 0 &&
    rect.left < innerWidth && rect.top < innerHeight ? rect : null;
}

function cafeWindowFrames(source, target) {
  const sx = Math.max(.045, source.width / target.width);
  const sy = Math.max(.045, source.height / target.height);
  return [
    { transform: `translate(${source.left - target.left}px, ${source.top - target.top}px) scale(${sx}, ${sy})`, opacity: .25 },
    { transform: "none", opacity: 1 },
  ];
}

// Lucian #061 morphs the panel from its trigger. Transform and opacity keep it off the layout path.
function openCafeWindow(dialog, origin, source = cafeWindowOrigin(origin)) {
  if (!source) {
    dialog.showModal();
    return;
  }
  dialog.classList.add("u061-window");
  dialog.showModal();
  const entry = { origin, animation: trackCafeMotion(dialog.animate(cafeWindowFrames(source, dialog.getBoundingClientRect()), cafeWindowTiming)) };
  cafeWindowTransitions.set(dialog, entry);
  if (cafeWindowBound.has(dialog)) return;
  cafeWindowBound.add(dialog);
  dialog.addEventListener("cancel", (event) => {
    if (event.defaultPrevented || !cafeWindowTransitions.has(dialog)) return;
    event.preventDefault();
    closeCafeWindow(dialog);
  });
  dialog.addEventListener("close", () => {
    if (dialog.open) return;
    const current = cafeWindowTransitions.get(dialog);
    cafeWindowTransitions.delete(dialog);
    dialog.classList.remove("u061-window");
    current?.animation.cancel();
  });
}

function closeCafeWindow(dialog) {
  const entry = cafeWindowTransitions.get(dialog);
  if (entry?.closing || !dialog.open) return;
  const source = entry && cafeWindowOrigin(entry.origin);
  if (!source) {
    dialog.close();
    return;
  }
  const moving = entry.animation.playState === "running";
  const style = moving ? getComputedStyle(dialog) : null;
  const from = moving ? { transform: style.transform, opacity: Number(style.opacity) } : null;
  entry.animation.cancel();
  entry.closing = true;
  const frames = cafeWindowFrames(source, dialog.getBoundingClientRect()).reverse();
  if (from) frames[0] = from;
  entry.animation = trackCafeMotion(dialog.animate(frames, cafeWindowTiming));
  const finish = () => {
    if (dialog.open && cafeWindowTransitions.get(dialog) === entry) dialog.close();
  };
  entry.animation.finished.then(finish, finish);
}

function revealCafeView(view, direction) {
  if (cafeReducedMotion.matches) return;
  view.getAnimations().forEach((animation) => animation.cancel());
  trackCafeMotion(view.animate([
    { transform: `translateX(${direction * 40}px)`, opacity: .2 },
    { transform: "none", opacity: 1 },
  ], { duration: 420, easing: "cubic-bezier(.2,.8,.2,1)" }));
}

function connectCafeSwitch(root, requestChange) {
  var sw = root.querySelector('.u013-sw');
  var knob = root.querySelector('.u013-knob');
  var on = false, t = 0, pending = false;

  function paint(v, stretch) {
    on = v;
    root.classList.toggle('is-on', v);
    sw.setAttribute('aria-checked', String(v));
    // 이동하는 처음 순간에 늘어나고, 도착하면서 원래 폭으로 튕깁니다
    if (stretch && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      root.classList.add('is-stretch');
      clearTimeout(t);
      t = setTimeout(function () { root.classList.remove('is-stretch'); }, 170);
    }
  }
  async function set(v) {
    if (pending || on === v || sw.disabled) return;
    pending = true;
    try {
      if (await requestChange(v)) paint(v, true);
    } finally { pending = false; }
  }
  // 손잡이를 끌면 따라오고, 놓은 위치가 절반을 넘으면 그쪽으로 붙습니다
  var drag = null;
  sw.addEventListener('pointerdown', function (e) {
    if (e.button !== 0 || pending || sw.disabled) return;
    drag = { x: e.clientX, moved: false, start: on ? 72 : 8 };
    sw.setPointerCapture(e.pointerId);
  });
  sw.addEventListener('pointermove', function (e) {
    if (!drag) return;
    var k = sw.getBoundingClientRect().width / sw.offsetWidth || 1;
    var dx = (e.clientX - drag.x) / k;
    if (Math.abs(dx) > 4) drag.moved = true;
    if (!drag.moved) return;
    root.classList.add('is-drag');
    var x = Math.max(8, Math.min(72, drag.start + dx));
    knob.style.left = x + 'px';
    knob.style.width = (60 + Math.min(18, Math.abs(dx) * 0.25)) + 'px';
  });
  function end(e) {
    if (!drag) return;
    var d = drag; drag = null;
    root.classList.remove('is-drag');
    var x = parseFloat(knob.style.left || (on ? 72 : 8));
    knob.style.left = ''; knob.style.width = '';
    if (d.moved && e.type === 'pointerup') { set(x > 40); sw._skip = true; }
  }
  sw.addEventListener('pointerup', end);
  sw.addEventListener('pointercancel', end);
  sw.addEventListener('click', function () {
    if (sw._skip) { sw._skip = false; return; }
    set(!on);
  });
  return function sync(v) { paint(v, false); };
}

(function () {
  var root = document.querySelector('.u070');
  var zone = root.querySelector('.u070-zone'), live = root.querySelector('.u070-live');
  var ICON = { ok: '<svg viewBox="0 0 18 18"><path d="M4 9.4l3.2 3.2L14 5.6"/></svg>', err: '<svg viewBox="0 0 18 18"><path d="M9 5v5M9 13h.01"/></svg>', info: '<svg viewBox="0 0 18 18"><path d="M3.5 4.5h11v7h-6l-3 2.5v-2.5h-2z"/></svg>' };
  var K = { ok: 'var(--ux-mint)', err: 'var(--ux-danger)', info: 'var(--ux-accent)' };
  var list = [], open = false, DUR = 4500, last = 0, frame = null;
  // 접혀 있을 때는 뒤 알림을 작게 겹치고, 펼치면 높이만큼 위로 쌓아 목록처럼 보여 줍니다
  function layout() {
    var acc = 0;
    list.forEach(function (t, i) {
      var el = t.el;
      el.classList.toggle('back', !open && i > 0);
      if (open) { el.style.setProperty('--y', -acc + 'px'); el.style.setProperty('--s', 1); el.style.setProperty('--o', 1); acc += el.offsetHeight + 8; }
      else { el.style.setProperty('--y', -(i * 14) + 'px'); el.style.setProperty('--s', (1 - i * 0.06).toFixed(2)); el.style.setProperty('--o', i > 2 ? 0 : 1); }
      el.style.zIndex = 50 - i;
      el.inert = !open && i > 0;
    });
  }
  function remove(t, dir) {
    var i = list.indexOf(t);
    if (i < 0) return;
    list.splice(i, 1);
    t.el.classList.add('leave');
    if (dir) { t.el.style.setProperty('--dir', dir); t.el.classList.add('side'); }
    setTimeout(function () { t.el.remove(); }, 450);
    layout();
    if (!list.length) stopLoop();
  }
  function stopLoop() {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    last = 0;
  }
  function startLoop() {
    if (frame !== null || open || !list.length || !root.isConnected) return;
    last = performance.now();
    frame = requestAnimationFrame(loop);
  }
  function advance(now) {
    var dt = now - last; last = now;
    list.slice().forEach(function (t, i) {
      if (i > 0) return;
      t.left -= dt;
      t.el.style.setProperty('--left', Math.max(0, t.left / DUR).toFixed(3));
      if (t.left <= 0) remove(t);
    });
  }
  function pauseLoop() {
    if (frame === null) return;
    cancelAnimationFrame(frame);
    frame = null;
    if (list.length) advance(performance.now());
    last = 0;
  }
  function push(k, message) {
    var el = document.createElement('div');
    el.className = 'u070-t enter';
    el.style.setProperty('--c', K[k]);
    if (k === 'err') el.setAttribute('role', 'alert');
    el.innerHTML = '<span class="u070-ic" aria-hidden="true">' + ICON[k] + '</span><span class="u070-tx"><b></b><small></small></span>' + '<button class="u070-x" type="button" aria-label="알림 닫기"><svg viewBox="0 0 14 14"><path d="M3.5 3.5l7 7M10.5 3.5l-7 7"/></svg></button><span class="u070-bar" aria-hidden="true"></span>';
    el.querySelector('b').textContent = message;
    el.querySelector('small').textContent = '길모퉁이PC방';
    var t = { el: el, left: DUR };
    zone.appendChild(el);
    list.unshift(t);
    void el.offsetWidth;
    el.classList.remove('enter');
    layout();
    live.textContent = k === 'err' ? '' : message;
    startLoop();
    el.querySelector('.u070-x').addEventListener('click', function () { remove(t); });
    // 옆으로 밀어 닫기
    var sx = 0, dx = 0, down = false;
    el.addEventListener('pointerdown', function (e) { if (e.target.closest('button')) return; down = true; sx = e.clientX; dx = 0; el.setPointerCapture(e.pointerId); el.classList.add('drag'); });
    el.addEventListener('pointermove', function (e) { if (!down) return; dx = e.clientX - sx; el.style.setProperty('--dx', dx + 'px'); el.style.setProperty('--o', Math.max(0.2, 1 - Math.abs(dx) / 260)); });
    var end = function () { if (!down) return; down = false; el.classList.remove('drag'); if (Math.abs(dx) > 90) remove(t, dx > 0 ? 1 : -1); else { el.style.setProperty('--dx', '0px'); layout(); } };
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
  }
  // 펼쳐 둔 동안은 남은 시간이 줄지 않습니다
  function loop(now) {
    frame = null;
    if (!root.isConnected || open || !list.length) { last = 0; return; }
    advance(now);
    if (list.length && !open) frame = requestAnimationFrame(loop);
    else last = 0;
  }
  function setOpen(v) {
    if (open === v) return;
    if (v) pauseLoop();
    open = v;
    layout();
    if (!open) startLoop();
  }
  zone.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') setOpen(true); });
  zone.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse' && !zone.contains(document.activeElement)) setOpen(false); });
  zone.addEventListener('focusin', function () { setOpen(true); });
  zone.addEventListener('focusout', function (e) { if (!zone.contains(e.relatedTarget)) setOpen(false); });
  zone.addEventListener('click', function (e) { if (!e.target.closest('button') && list.length > 1) setOpen(!open); });
  root.addEventListener('pcbang-notice', function (event) {
    push(event.detail.kind, event.detail.message);
  });
})();

function createCafeFocusMotion(dialog) {
  const timer = dialog.querySelector("#timer");
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const screenReader = document.createElement("span");
  const clock = document.createElement("span");
  const progress = document.createElement("div");
  const bar = document.createElement("i");
  const digits = [];
  let showing = false;

  clock.className = "u100-clk cafe-focus-flip";
  clock.setAttribute("aria-hidden", "true");

  for (let index = 0; index < 5; index += 1) {
    if (index === 3) {
      const colon = document.createElement("span");
      colon.className = "u100-co";
      colon.setAttribute("aria-hidden", "true");
      colon.innerHTML = "<i></i><i></i>";
      clock.append(colon);
    }
    const face = document.createElement("span");
    face.className = "u100-fl";
    face.setAttribute("aria-hidden", "true");
    face.innerHTML = '<span class="u100-t"><b>0</b></span><span class="u100-b"><b>0</b></span>' +
      '<span class="u100-ft"><b>0</b></span><span class="u100-fb"><b>0</b></span>';
    digits.push({
      value: "",
      face,
      top: face.querySelector(".u100-t b"),
      bottom: face.querySelector(".u100-b b"),
      topFlip: face.querySelector(".u100-ft"),
      bottomFlip: face.querySelector(".u100-fb"),
    });
    clock.append(face);
  }

  progress.className = "cafe-focus-progress";
  progress.setAttribute("aria-hidden", "true");
  progress.append(bar);
  screenReader.className = "cafe-focus-sr";
  screenReader.textContent = "";
  timer.replaceChildren(screenReader, clock, progress);
  timer.dataset.flipReady = "true";

  function cancelFlips() {
    clock.getAnimations().forEach((animation) => animation.cancel());
    clock.classList.remove("run", "cafe-focus-shake");
    for (const digit of digits) {
      digit.topFlip.getAnimations().forEach((animation) => animation.cancel());
      digit.bottomFlip.getAnimations().forEach((animation) => animation.cancel());
      digit.bottom.textContent = digit.value || "0";
    }
  }

  function paintDigit(digit, next, animate) {
    if (next === digit.value) return;
    const previous = digit.value;
    digit.value = next;
    digit.top.textContent = next;
    digit.topFlip.firstElementChild.textContent = previous || next;
    digit.bottomFlip.firstElementChild.textContent = next;
    digit.topFlip.getAnimations().forEach((animation) => animation.cancel());
    digit.bottomFlip.getAnimations().forEach((animation) => animation.cancel());

    if (!animate || !previous) {
      digit.bottom.textContent = next;
      return;
    }

    digit.bottom.textContent = previous;
    digit.topFlip.animate([
      { transform: "perspective(320px) rotateX(0deg)", filter: "brightness(1)" },
      { transform: "perspective(320px) rotateX(-90deg)", filter: "brightness(.6)" },
    ], { duration: 240, easing: "cubic-bezier(.55,0,.9,.6)" });

    const flip = digit.bottomFlip.animate([
      { transform: "perspective(320px) rotateX(90deg)", filter: "brightness(1.5)" },
      { transform: "perspective(320px) rotateX(0deg)", filter: "brightness(1)" },
    ], {
      duration: 300,
      delay: 240,
      easing: "cubic-bezier(.2,.9,.3,1.25)",
      fill: "forwards",
    });
    flip.onfinish = () => {
      digit.bottom.textContent = digit.value;
      flip.cancel();
    };
  }

  function update(display, remainingRatio, isRunning = false, durationMs) {
    const previous = screenReader.textContent;
    if (previous !== display) screenReader.textContent = display;
    if (!dialog.open || document.hidden) return;
    const nextRatio = Math.max(0, Math.min(1, Number(remainingRatio) || 0));
    const [minutes = "0", seconds = "00"] = display.split(":");
    const minuteValue = Number(minutes) || 0;
    const next = String(minuteValue).padStart(3, "0") + seconds.padStart(2, "0");
    const animate = showing && !motion.matches;
    showing = true;
    digits[0].face.classList.toggle("u100-empty-leading", minuteValue < 100);
    next.split("").forEach((digit, index) => paintDigit(digits[index], digit, animate));
    const hasDuration = Number.isFinite(durationMs) && durationMs > 0;
    timer.classList.toggle("warn", hasDuration && nextRatio > 0 && nextRatio * durationMs <= 10_000);
    timer.classList.toggle("done", hasDuration && nextRatio === 0);
    timer.classList.toggle("empty", !hasDuration);
    clock.classList.toggle("run", isRunning && !motion.matches);
    progress.classList.toggle("is-animated", animate);
    bar.style.setProperty("--p", String(nextRatio));

    if (nextRatio === 0 && previous !== display && animate) {
      clock.classList.add("cafe-focus-shake");
    }
  }

  function suspend() {
    showing = false;
    cancelFlips();
  }

  clock.addEventListener("animationend", (event) => {
    if (event.animationName === "cafe-focus-shake") clock.classList.remove("cafe-focus-shake");
  });
  dialog.addEventListener("close", suspend);
  document.addEventListener("visibilitychange", () => { if (document.hidden && dialog.open) suspend(); });
  motion.addEventListener("change", () => { if (motion.matches && dialog.open) suspend(); });
  return update;
}
