export function createCafeCamera(scene) {
  const viewport = scene.parentElement;
  const button = document.getElementById("cafe-fullscreen");
  const overviewButton = document.getElementById("cafe-overview");
  const pcButton = document.getElementById("game-view-pc");
  let overview = false;
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
    if (!bounds || !point) return;
    const { width, height, worldWidth, worldHeight } = bounds;
    const clamp = (target, overscan) => overscan < 0 ? -overscan / 2 : Math.min(0, Math.max(-overscan, target));
    const x = clamp(width * .5 - worldWidth * point.x / 100, worldWidth - width);
    const y = clamp(height * .53 - worldHeight * point.y / 100, worldHeight - height);
    const nextX = Math.round(x);
    const nextY = Math.round(y);
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
    const worldWidth = overview
      ? Math.floor(Math.min(width, height * 1.5))
      : Math.ceil(Math.max(width, height * 1.5) * 1.12);
    const worldHeight = Math.ceil(worldWidth * 2 / 3);
    bounds = { width, height, worldWidth, worldHeight };
    scene.style.setProperty("--camera-width", worldWidth + "px");
    scene.style.setProperty("--camera-height", worldHeight + "px");
    follow(position, lastSeat);
  }

  function setOverview(value) {
    if (value === overview) return;
    overview = value;
    scene.classList.toggle("camera-ready", !overview);
    overviewButton.setAttribute("aria-pressed", String(overview));
    overviewButton.textContent = overview ? "가까이 보기" : "전체 지도";
    resize();
  }

  overviewButton.addEventListener("click", () => {
    setOverview(!overview);
    scene.focus({ preventScroll: true });
  });
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
  new ResizeObserver(resize).observe(viewport);
  scene.classList.add("camera-ready");
  pcButton.addEventListener("click", () => document.getElementById("open-monitor").click());
  return { follow, track: () => setOverview(false) };
}
