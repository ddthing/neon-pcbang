/* Lucian UX/UI Prompt #093 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#093 */

const colors = ["#93c7aa", "#6fa88c", "#f4cb79", "#e79bb3", "#bda6da", "#9db9d8"];
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const panels = new WeakMap();

function confetti(root, canvas) {
  if (reducedMotion.matches) return () => {};
  const width = root.offsetWidth;
  const height = root.offsetHeight;
  const dpr = Math.min(2, devicePixelRatio || 1);
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};
  const pieces = Array.from({ length: 90 }, (_, i) => {
    const angle = -Math.PI / 2 + (Math.random() - .5) * 1.9;
    const speed = 380 + Math.random() * 420;
    return {
      x: width / 2 + (Math.random() - .5) * 40, y: height * .55,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      angle: Math.random() * 6, spin: (Math.random() - .5) * 14,
      width: 5 + Math.random() * 5, height: 8 + Math.random() * 6,
      color: colors[i % colors.length], time: 0, life: 1.6 + Math.random() * .9,
    };
  });
  let last = performance.now();
  let frame;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  function draw(now) {
    const dt = Math.min(.033, (now - last) / 1000);
    last = now;
    ctx.clearRect(0, 0, width, height);
    let alive = false;
    for (const p of pieces) {
      p.time += dt;
      if (p.time > p.life || p.y > height + 20 && p.vy > 0) continue;
      alive = true;
      p.vy += 900 * dt;
      p.vx *= .985;
      p.vy *= .985;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.angle += p.spin * dt;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.globalAlpha = Math.min(1, (p.life - p.time) / .4);
      ctx.scale(1, Math.cos(p.time * 9 + p.width));
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.width / 2, -p.height / 2, p.width, p.height);
      ctx.restore();
    }
    if (alive) frame = requestAnimationFrame(draw);
  }
  frame = requestAnimationFrame(draw);
  return () => { cancelAnimationFrame(frame); ctx.clearRect(0, 0, width, height); };
}

function mountPanel(dialog) {
  const root = document.createElement("section");
  root.className = "ux u093 cafe-game-result";
  root.hidden = true;
  root.setAttribute("aria-labelledby", `${dialog.id}-result-title`);
  root.innerHTML = `<div class="u093-win">
    <span class="u093-bdg" aria-hidden="true"><svg viewBox="0 0 42 42"><path d="M10 22l7 7 15-16"/></svg></span>
    <h3 class="u093-wt" id="${dialog.id}-result-title"></h3>
    <p class="u093-ws"></p><p class="u093-ws cafe-record-status" role="status"></p>
    <button class="u093-again" type="button">다시 하기</button>
  </div><canvas class="u093-cf" aria-hidden="true"></canvas>`;
  const inner = dialog.querySelector(".dialog-inner");
  const rank = inner.querySelector(".arcade-rank-box");
  inner.insertBefore(root, rank);
  const panel = {
    root,
    title: root.querySelector("h3"),
    metric: root.querySelector(".u093-ws"),
    record: root.querySelector(".cafe-record-status"),
    retry: root.querySelector(".u093-again"),
    canvas: root.querySelector("canvas"),
    serial: 0,
  };
  panel.hide = () => {
    panel.serial++;
    panel.stop?.();
    panel.stop = null;
    panel.root.hidden = true;
    panel.root.classList.remove("done");
    panel.action?.removeEventListener("click", panel.hide);
  };
  panel.retry.addEventListener("click", () => {
    const action = panel.action;
    if (!action || action.disabled) return;
    action.focus({ preventScroll: true });
    action.click();
  });
  dialog.addEventListener("close", panel.hide);
  panels.set(dialog, panel);
  return panel;
}

export function clearCafeGameResult(dialog) {
  panels.get(dialog)?.hide();
}

export function showCafeGameResult(dialog, { title, metric, win = false, record, action, nextLabel = "다시 하기" }) {
  if (!dialog.open) return;
  const panel = panels.get(dialog) || mountPanel(dialog);
  panel.hide();
  const serial = panel.serial;
  panel.title.textContent = title;
  panel.metric.textContent = metric;
  panel.record.textContent = record ? "랭킹에 기록하는 중…" : "";
  panel.action = typeof action === "string" ? document.getElementById(action) : action;
  panel.retry.hidden = !panel.action;
  panel.retry.textContent = nextLabel;
  panel.action?.addEventListener("click", panel.hide, { once: true });
  panel.root.dataset.win = String(win);
  panel.root.hidden = false;
  void panel.root.offsetWidth;
  panel.root.classList.add("done");
  if (win) panel.stop = confetti(panel.root, panel.canvas);
  if (record) void record.then((saved) => {
    if (panel.serial !== serial) return;
    panel.record.textContent = saved ? "랭킹에 기록을 제출했어요." : "랭킹 기록을 제출하지 못했어요.";
  });
}
