import assert from "node:assert/strict";
import test from "node:test";
import { createCafeCamera } from "../public/camera.js";

class Element extends EventTarget {
  dataset = {};
  style = new Map();
  captures = [];
  constructor() {
    super();
    this.style.setProperty = this.style.set.bind(this.style);
  }
  contains() { return true; }
  setPointerCapture(id) { this.captures.push(id); }
}

test("390px uses CSS 3×, distinguishes taps from drags, and clamps pinch zoom to 2×–4×", (t) => {
  const viewport = new Element();
  Object.assign(viewport, { clientWidth: 390, clientHeight: 844 });
  const scene = new Element();
  scene.dataset.space = "hall";
  scene.parentElement = viewport;
  const fullscreen = new Element();
  const pc = new Element();
  const document = new Element();
  document.getElementById = id => id === "cafe-fullscreen" ? fullscreen : pc;
  document.querySelectorAll = () => [];
  const media = new Element();
  media.matches = true;
  const globals = {
    document,
    matchMedia: () => media,
    window: new EventTarget(),
    devicePixelRatio: 3,
    ResizeObserver: class { observe() {} },
    MutationObserver: class { observe() {} },
    cancelAnimationFrame() {},
  };
  for (const [name, value] of Object.entries(globals)) {
    const original = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { configurable: true, value });
    t.after(() => {
      if (original) Object.defineProperty(globalThis, name, original);
      else delete globalThis[name];
    });
  }
  createCafeCamera(scene);

  assert.equal(viewport.dataset.cameraScale, "3");
  assert.equal(scene.style.get("--camera-width"), "2304px");
  const original = scene.style.get("--camera-x");
  const pointer = (type, pointerId, clientX) => {
    viewport.dispatchEvent(Object.assign(new Event(type, { cancelable: true }),
      { pointerId, clientX, clientY: 300, button: 0, pointerType: "touch" }));
  };
  pointer("pointerdown", 1, 155);
  pointer("pointermove", 1, 163);
  assert.equal(scene.style.get("--camera-x"), original);
  pointer("pointermove", 1, 213);
  assert.notEqual(scene.style.get("--camera-x"), original);
  pointer("pointerup", 1, 213);

  pointer("pointerdown", 2, 150);
  pointer("pointerdown", 3, 200);
  pointer("pointermove", 3, 240);
  assert.equal(viewport.dataset.cameraScale, "4");
  pointer("pointermove", 3, 300);
  assert.equal(viewport.dataset.cameraScale, "4");
  pointer("pointermove", 3, 250);
  assert.equal(viewport.dataset.cameraScale, "3");
  pointer("pointermove", 3, 200);
  pointer("pointermove", 3, 174);
  assert.equal(viewport.dataset.cameraScale, "2");
  assert.equal(scene.style.get("--camera-width"), "1536px");
  pointer("pointerup", 2, 150);
  pointer("pointerup", 3, 174);
});

test("Desktop 1920x993 opens at comfortable 2x scale, follows character, and steps 1x/2x/3x via wheel", (t) => {
  const viewport = new Element();
  Object.assign(viewport, { clientWidth: 1920, clientHeight: 993 });
  const scene = new Element();
  scene.dataset.space = "hall";
  scene.parentElement = viewport;
  const fullscreen = new Element();
  const pc = new Element();
  const document = new Element();
  document.getElementById = id => id === "cafe-fullscreen" ? fullscreen : pc;
  document.querySelectorAll = () => [];
  const media = new Element();
  media.matches = false;
  const globals = {
    document,
    matchMedia: () => media,
    window: new EventTarget(),
    devicePixelRatio: 1,
    ResizeObserver: class { observe() {} },
    MutationObserver: class { observe() {} },
    cancelAnimationFrame() {},
  };
  for (const [name, value] of Object.entries(globals)) {
    const original = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { configurable: true, value });
    t.after(() => {
      if (original) Object.defineProperty(globalThis, name, original);
      else delete globalThis[name];
    });
  }
  const camera = createCafeCamera(scene);

  assert.equal(viewport.dataset.cameraMode, "desktop");
  assert.equal(viewport.dataset.cameraScale, "2");
  assert.equal(scene.style.get("--camera-width"), "1536px");
  assert.equal(scene.style.get("--camera-height"), "1024px");

  // Desktop 2x world (1024px) exceeds 993px height so follow() pans vertically
  const initialY = scene.style.get("--camera-y");
  camera.follow({ x: 50, y: 85 }, null);
  assert.notEqual(scene.style.get("--camera-y"), initialY);

  // Wheel zoom: 2 -> 1 -> 2 -> 3
  const target = new Element();
  const fireWheel = (deltaY) => {
    const ev = new Event("wheel", { cancelable: true });
    Object.defineProperty(ev, "target", { value: target });
    ev.deltaY = deltaY;
    viewport.dispatchEvent(ev);
  };
  fireWheel(120);
  assert.equal(viewport.dataset.cameraScale, "1");
  fireWheel(-120);
  assert.equal(viewport.dataset.cameraScale, "2");
  fireWheel(-120);
  assert.equal(viewport.dataset.cameraScale, "3");
});
