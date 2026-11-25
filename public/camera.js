// Each room in the atlas and each standalone painting uses this pixel grid.
const worldPixels = { width: 768, height: 512 };

export function createCafeCamera(scene) {
  const viewport = scene.parentElement;
  const button = document.getElementById("cafe-fullscreen");
  const pcButton = document.getElementById("game-view-pc");
  let busy = false;
  let position;
  let bounds;
  let lastSeat;
  let cameraX;
  let cameraY;

  function follow(point, seat) {
    position = point;
    if (seat !== lastSeat) {
      pcButton.hidden = !seat;
      lastSeat = seat;
    }
    if (!bounds) return;
    const { width, height, worldWidth, worldHeight, density } = bounds;
    const clamp = (target, overscan) => overscan < 0 ? -overscan / 2 : Math.min(0, Math.max(-overscan, target));
    const x = clamp(width * .5 - worldWidth * (point?.x ?? 50) / 100, worldWidth - width);
    const y = clamp(height * .53 - worldHeight * (point?.y ?? 50) / 100, worldHeight - height);
    const nextX = Math.round(x * density) / density;
    const nextY = Math.round(y * density) / density;
    if (nextX !== cameraX) {
      scene.style.setProperty("--camera-x", nextX + "px");
      cameraX = nextX;
    }
    if (nextY !== cameraY) {
      scene.style.setProperty("--camera-y", nextY + "px");
      cameraY = nextY;
    }
  }

  function resize() {
    const { clientWidth: width, clientHeight: height } = viewport;
    if (!width || !height) return;
    const density = window.devicePixelRatio;
    const scale = Math.max(1, Math.round(height * density / 360),
      Math.ceil(width * density / worldPixels.width), Math.ceil(height * density / worldPixels.height));
    const worldWidth = worldPixels.width * scale / density;
    const worldHeight = worldPixels.height * scale / density;
    bounds = { width, height, worldWidth, worldHeight, density };
    scene.style.setProperty("--camera-width", worldWidth + "px");
    scene.style.setProperty("--camera-height", worldHeight + "px");
    follow(position, lastSeat);
  }

  button.addEventListener("click", async () => {
    if (busy) return;
    busy = true;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
      scene.focus({ preventScroll: true });
    } catch {
      scene.focus({ preventScroll: true });
    }
    finally { busy = false; }
  });
  document.addEventListener("fullscreenchange", () => {
    const native = Boolean(document.fullscreenElement);
    button.setAttribute("aria-pressed", String(native));
    button.querySelector("span").textContent = native ? "전체화면 나가기" : "전체화면";
    resize();
  });
  if (!document.fullscreenEnabled) button.hidden = true;
  function watchDensity() {
    window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`)
      .addEventListener("change", () => {
        resize();
        watchDensity();
      }, { once: true });
  }
  watchDensity();
  new ResizeObserver(resize).observe(viewport);
  resize();
  pcButton.addEventListener("click", () => document.getElementById("open-monitor").click());
  return { follow };
}
