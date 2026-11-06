export function createCafeCamera(scene) {
  const viewport = scene.parentElement;
  const button = document.getElementById("cafe-fullscreen");
  const floorButton = document.getElementById("game-view-floor");
  const pcButton = document.getElementById("game-view-pc");
  let active = false;
  let native = false;
  let busy = false;
  let position;
  let bounds;
  let lastSeat;

  function follow(point, seat) {
    position = point;
    if (seat !== lastSeat) {
      pcButton.hidden = !seat;
      lastSeat = seat;
    }
    if (!active || !bounds || !point) return;
    const { width, height, worldWidth, worldHeight } = bounds;
    const clamp = (target, overscan) => Math.min(0, Math.max(-overscan, target));
    const x = clamp(width * .5 - worldWidth * point.x / 100, worldWidth - width);
    const y = clamp(height * .53 - worldHeight * point.y / 100, worldHeight - height);
    scene.style.setProperty("--camera-x", Math.round(x) + "px");
    scene.style.setProperty("--camera-y", Math.round(y) + "px");
  }

  function resize() {
    if (!active) return;
    const { clientWidth: width, clientHeight: height } = viewport;
    const worldWidth = Math.ceil(Math.max(width, height * 1.5) * 1.25);
    const worldHeight = Math.ceil(worldWidth * 2 / 3);
    bounds = { width, height, worldWidth, worldHeight };
    scene.style.setProperty("--camera-width", worldWidth + "px");
    scene.style.setProperty("--camera-height", worldHeight + "px");
    follow(position, lastSeat);
  }

  function setView(value) {
    active = value;
    document.body.classList.toggle("cafe-fullscreen", value);
    button.setAttribute("aria-pressed", String(value));
    button.querySelector("span").textContent = value ? "전체화면 나가기" : "전체화면";
    if (value) {
      resize();
      scene.focus({ preventScroll: true });
      requestAnimationFrame(() => {
        if (active) scene.classList.add("camera-ready");
      });
    } else {
      scene.classList.remove("camera-ready");
      for (const key of ["width", "height", "x", "y"]) scene.style.removeProperty("--camera-" + key);
      if (!document.querySelector("dialog[open]")) button.focus({ preventScroll: true });
    }
  }

  button.addEventListener("click", async () => {
    if (busy) return;
    if (active) {
      if (native && document.fullscreenElement) {
        try { await document.exitFullscreen(); } catch { setView(false); }
      } else setView(false);
      return;
    }
    setView(true);
    if (!document.fullscreenEnabled || !document.documentElement.requestFullscreen) return;
    busy = true;
    try {
      await document.documentElement.requestFullscreen();
      native = document.fullscreenElement === document.documentElement;
      if (!active && native) await document.exitFullscreen();
    } catch { /* The in-page game view also works in embeds and on mobile. */ }
    finally { busy = false; }
  });
  document.addEventListener("fullscreenchange", () => {
    if (document.fullscreenElement === document.documentElement && active) {
      native = true;
      resize();
    } else if (native) {
      native = false;
      setView(false);
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !active || native || document.querySelector("dialog[open]")) return;
    event.preventDefault();
    setView(false);
  });
  new ResizeObserver(resize).observe(viewport);
  floorButton.addEventListener("click", () => document.getElementById("open-floor").click());
  pcButton.addEventListener("click", () => document.getElementById("open-monitor").click());
  return { follow };
}
