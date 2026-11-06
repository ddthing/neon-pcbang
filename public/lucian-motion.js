/* Lucian UX/UI Prompt #013 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#013 */
/* Lucian UX/UI Prompt #070 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#070 */
"use strict";

function connectRainSwitch(requestChange) {
  var root = document.querySelector('.u013');
  var sw = root.querySelector('.u013-sw');
  var knob = root.querySelector('.u013-knob');
  var on = false, t = 0, pending = false;

  async function set(v) {
    if (pending || on === v) return;
    pending = true;
    var applied;
    try { applied = await requestChange(v); }
    finally { pending = false; }
    if (!applied) return;
    on = v;
    root.classList.toggle('is-on', v);
    sw.setAttribute('aria-checked', String(v));
    // 이동하는 처음 순간에 늘어나고, 도착하면서 원래 폭으로 튕깁니다
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      root.classList.add('is-stretch');
      clearTimeout(t);
      t = setTimeout(function () { root.classList.remove('is-stretch'); }, 170);
    }
  }
  // 손잡이를 끌면 따라오고, 놓은 위치가 절반을 넘으면 그쪽으로 붙습니다
  var drag = null;
  sw.addEventListener('pointerdown', function (e) {
    if (e.button !== 0 || pending) return;
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
}

(function () {
  var root = document.querySelector('.u070');
  var zone = root.querySelector('.u070-zone'), live = root.querySelector('.u070-live');
  var ICON = { ok: '<svg viewBox="0 0 18 18"><path d="M4 9.4l3.2 3.2L14 5.6"/></svg>', err: '<svg viewBox="0 0 18 18"><path d="M9 5v5M9 13h.01"/></svg>', info: '<svg viewBox="0 0 18 18"><path d="M3.5 4.5h11v7h-6l-3 2.5v-2.5h-2z"/></svg>' };
  var K = { ok: 'var(--ux-mint)', err: 'var(--ux-danger)', info: 'var(--ux-accent)' };
  var list = [], open = false, DUR = 4500, last = 0;
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
  }
  function push(k, message) {
    var el = document.createElement('div');
    el.className = 'u070-t enter';
    el.style.setProperty('--c', K[k]);
    if (k === 'err') el.setAttribute('role', 'alert');
    el.innerHTML = '<span class="u070-ic" aria-hidden="true">' + ICON[k] + '</span><span class="u070-tx"><b></b><small></small></span>' + '<button class="u070-x" type="button" aria-label="알림 닫기"><svg viewBox="0 0 14 14"><path d="M3.5 3.5l7 7M10.5 3.5l-7 7"/></svg></button><span class="u070-bar" aria-hidden="true"></span>';
    el.querySelector('b').textContent = message;
    el.querySelector('small').textContent = '네온 PC방';
    var t = { el: el, left: DUR };
    zone.appendChild(el);
    list.unshift(t);
    void el.offsetWidth;
    el.classList.remove('enter');
    layout();
    live.textContent = k === 'err' ? '' : message;
    if (!last) { last = performance.now(); requestAnimationFrame(loop); }
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
    if (!root.isConnected) return;
    var dt = now - last; last = now;
    if (!open) list.slice().forEach(function (t, i) {
      if (i > 0) return;
      t.left -= dt;
      t.el.style.setProperty('--left', Math.max(0, t.left / DUR).toFixed(3));
      if (t.left <= 0) remove(t);
    });
    if (list.length) requestAnimationFrame(loop);
    else last = 0;
  }
  function setOpen(v) { if (open === v) return; open = v; layout(); }
  zone.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') setOpen(true); });
  zone.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse' && !zone.contains(document.activeElement)) setOpen(false); });
  zone.addEventListener('focusin', function () { setOpen(true); });
  zone.addEventListener('focusout', function (e) { if (!zone.contains(e.relatedTarget)) setOpen(false); });
  zone.addEventListener('click', function (e) { if (!e.target.closest('button') && list.length > 1) setOpen(!open); });
  root.addEventListener('pcbang-notice', function (event) {
    push(event.detail.kind, event.detail.message);
  });
})();
