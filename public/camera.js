import { WORLD, QUICK_VIEWS, TILE, toPercent } from "./cafe-map.mjs";

const center = { x: 50, y: 50 };
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function createCafeCamera(scene) {
  const viewport = scene.parentElement;
  const fullscreen = document.getElementById("cafe-fullscreen");
  const pcButton = document.getElementById("game-view-pc");
  const small = matchMedia("(max-width: 768px), (pointer: coarse)");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const pointers = new Map();
  let mode;
  let zoom = 3;
  let focus = center;
  let bounds;
  let lastSeat;
  let manual = false;
  let dragging = false;
  let pinching = false;
  let pinchStart;
  let suppressUntil = 0;
  let offset = { x: 0, y: 0 };
  let velocity = { x: 0, y: 0, time: 0 };
  let frame;

  function place(x, y) {
    const { width, height, worldWidth, worldHeight, density } = bounds;
    const fit = (position, size, frameSize) => {
      const margin = frameSize - size;
      return margin >= 0 ? margin / 2 : clamp(position, margin, 0);
    };
    offset = {
      x: Math.round(fit(x, worldWidth, width) * density) / density,
      y: Math.round(fit(y, worldHeight, height) * density) / density,
    };
    scene.style.setProperty("--camera-x", offset.x + "px");
    scene.style.setProperty("--camera-y", offset.y + "px");
  }

  function recenter(point) {
    const { width, height, worldWidth, worldHeight } = bounds;
    place(width / 2 - worldWidth * point.x / 100, height / 2 - worldHeight * point.y / 100);
  }

  function keepFocus() {
    focus = {
      x: (bounds.width / 2 - offset.x) / bounds.worldWidth * 100,
      y: (bounds.height / 2 - offset.y) / bounds.worldHeight * 100,
    };
  }

  function resize() {
    const width = viewport.clientWidth || innerWidth;
    const height = viewport.clientHeight || innerHeight;
    const density = devicePixelRatio || 1;
    if (small.matches !== mode) {
      mode = small.matches;
      manual = false;
      zoom = 3;
    }
    const scale = mode ? zoom : Math.max(1, Math.floor(Math.min(width * density / WORLD.width, height * density / WORLD.height)));
    const pixel = scale / density;
    const worldWidth = WORLD.width * pixel;
    const worldHeight = WORLD.height * pixel;
    bounds = { width, height, worldWidth, worldHeight, density };
    viewport.dataset.cameraScale = String(scale);
    viewport.dataset.cameraMode = mode ? "mobile" : "desktop";
    scene.style.setProperty("--camera-width", worldWidth + "px");
    scene.style.setProperty("--camera-height", worldHeight + "px");
    viewport.style.setProperty("--world-pixel", pixel + "px");
    recenter(mode ? focus : center);
  }

  function follow(point, seat) {
    if (seat !== lastSeat) {
      pcButton.hidden = !seat || scene.dataset.space !== "hall";
      if (seat) manual = false;
      lastSeat = seat;
    }
    if (!point || !mode || manual || dragging) return;
    focus = point;
    recenter(point);
  }

  function distance() {
    const [first, second] = pointers.values();
    return Math.hypot(first.x - second.x, first.y - second.y);
  }

  function quickView(point) {
    if (scene.dataset.space !== "hall") window.cafeWorld?.exitRelaxZone();
    manual = true;
    focus = toPercent({ x: Math.round(point.x / TILE) * TILE, y: Math.round(point.y / TILE) * TILE });
    if (!reduced.matches) {
      scene.classList.add("camera-glide");
      setTimeout(() => scene.classList.remove("camera-glide"), 200);
    }
    recenter(focus);
  }

  document.querySelectorAll("[data-camera-to]").forEach((button) => {
    button.addEventListener("click", () => quickView(QUICK_VIEWS[button.dataset.cameraTo]));
  });
  viewport.addEventListener("pointerdown", (event) => {
    if (!mode || event.pointerType === "mouse" || !scene.contains(event.target)) return;
    cancelAnimationFrame(frame);
    const point = { x: event.clientX, y: event.clientY };
    pointers.set(event.pointerId, { ...point, origin: point });
    if (pointers.size === 2) {
      dragging = true;
      pinching = true;
      manual = true;
      pinchStart = distance();
    }
  });
  viewport.addEventListener("pointermove", (event) => {
    const pointer = pointers.get(event.pointerId);
    if (!pointer) return;
    const dx = event.clientX - pointer.x;
    const dy = event.clientY - pointer.y;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    if (!dragging && Math.hypot(pointer.x - pointer.origin.x, pointer.y - pointer.origin.y) <= 8) return;
    event.preventDefault();
    if (!dragging) {
      dragging = true;
      manual = true;
      viewport.setPointerCapture(event.pointerId);
    }
    if (pointers.size >= 2) {
      const span = distance();
      if (span > pinchStart * 1.22 || span < pinchStart * .82) {
        keepFocus();
        zoom = clamp(zoom + (span > pinchStart ? 1 : -1), 2, 4);
        pinchStart = span;
        resize();
      }
      return;
    }
    if (pinching) return;
    place(offset.x + dx, offset.y + dy);
    velocity = { x: dx, y: dy, time: performance.now() };
    keepFocus();
  });

  function stopPan(event) {
    if (!pointers.delete(event.pointerId) || pointers.size) return;
    if (dragging) suppressUntil = performance.now() + 450;
    const coast = dragging && !pinching && !reduced.matches && performance.now() - velocity.time < 80;
    dragging = false;
    pinching = false;
    if (!coast) return;
    const glide = () => {
      velocity.x *= .84;
      velocity.y *= .84;
      if (Math.hypot(velocity.x, velocity.y) < .45) return;
      place(offset.x + velocity.x, offset.y + velocity.y);
      keepFocus();
      frame = requestAnimationFrame(glide);
    };
    frame = requestAnimationFrame(glide);
  }
  viewport.addEventListener("pointerup", stopPan);
  viewport.addEventListener("pointercancel", stopPan);
  viewport.addEventListener("click", (event) => {
    if (performance.now() >= suppressUntil || event.detail === 0) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

  fullscreen.addEventListener("click", async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } finally {
      scene.focus({ preventScroll: true });
    }
  });
  document.addEventListener("fullscreenchange", () => {
    const native = Boolean(document.fullscreenElement);
    fullscreen.setAttribute("aria-pressed", String(native));
    fullscreen.querySelector("span").textContent = native ? "전체화면 나가기" : "전체화면";
    resize();
  });
  if (!document.fullscreenEnabled) fullscreen.hidden = true;
  window.addEventListener("resize", resize);
  small.addEventListener("change", resize);
  new ResizeObserver(resize).observe(viewport);
  new MutationObserver(() => { manual = false; }).observe(scene, { attributes: true, attributeFilter: ["data-space"] });
  pcButton.addEventListener("click", () => document.getElementById("open-monitor").click());
  resize();
  return { follow };
}
