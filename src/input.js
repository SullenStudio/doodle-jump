import { W } from "./config.js";

// True on phones/tablets. Guarded so importing this module under a plain
// node test runner (no `window`) never throws — the guard short-circuits
// before touching any DOM global.
export const isTouchDevice =
  typeof window !== "undefined" &&
  (window.matchMedia("(pointer: coarse)").matches ||
    "ontouchstart" in window ||
    navigator.maxTouchPoints > 0);

// Steering priority is strictly linear and never overwrites a live source.
// The previous implementation checked a sticky swipe direction AFTER the
// keyboard and clobbered it, which is why swipe steering was removed.
export function resolveSteer({ keyLeft, keyRight, padDir, touchDir }) {
  let d = 0;
  if (keyLeft) d -= 1;
  if (keyRight) d += 1;
  if (d !== 0) return d; // live keyboard wins outright
  if (padDir !== 0) return padDir; // then the on-screen buttons
  if (touchDir !== 0) return touchDir; // then holding a half of the canvas
  return 0;
}

// kaplay's `touchToMouse: true` synthesizes isMouseDown("left") for the
// duration of any touch on the canvas — including the canvas-hold steering
// in bindSceneTouch(). Without the touchDevice guard, steering with a thumb
// on a phone would also read as firing. The FIRE button (padFire) and Space
// still work on every device.
export function resolveFire({ padFire, keySpace, mouseDown, touchDevice }) {
  return padFire || keySpace || (mouseDown && !touchDevice);
}

// Pure pointer-ownership reducer for the on-screen LEFT / FIRE / RIGHT
// buttons. Each control remembers which pointerId pressed it, so a release
// only clears the control it owns. This lets one finger hold a direction
// while a second finger taps FIRE without the FIRE release zeroing the
// still-held direction.
const EMPTY_PAD_STATE = {
  padDir: 0,
  dirPointerId: null,
  padFire: false,
  firePointerId: null,
};

export function applyPointerDown(state, pointerId, control) {
  if (control === "fire") {
    return { ...state, padFire: true, firePointerId: pointerId };
  }
  return { ...state, padDir: control, dirPointerId: pointerId };
}

export function applyPointerRelease(state, pointerId) {
  let { padDir, dirPointerId, padFire, firePointerId } = state;
  if (dirPointerId === pointerId) {
    padDir = 0;
    dirPointerId = null;
  }
  if (firePointerId === pointerId) {
    padFire = false;
    firePointerId = null;
  }
  return { padDir, dirPointerId, padFire, firePointerId };
}

let padState = { ...EMPTY_PAD_STATE };
let playHandler = null;
let touchDir = 0;
let wired = false;
const activeTouches = new Map(); // identifier -> { x }

export function registerPlayHandler(fn) {
  playHandler = fn;
}

export function resetInput() {
  padState = { ...EMPTY_PAD_STATE };
  touchDir = 0;
  activeTouches.clear();
}

export function initInput() {
  if (wired) return;
  wired = true;

  const steer = document.getElementById("steer");

  steer?.addEventListener("pointerdown", (e) => {
    const btn = e.target.closest("[data-dir], [data-fire]");
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    const control = btn.dataset.fire !== undefined ? "fire" : Number(btn.dataset.dir);
    padState = applyPointerDown(padState, e.pointerId, control);
  });

  const release = (e) => {
    padState = applyPointerRelease(padState, e.pointerId);
  };
  steer?.addEventListener("pointerup", release);
  steer?.addEventListener("pointercancel", release);
  steer?.addEventListener("pointerleave", release);
  window.addEventListener("pointerup", release);

  document.getElementById("btn-play")?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    playHandler?.();
  });
}

// Holding a half of the canvas steers. Registered per-scene because kaplay
// clears its event handlers on scene change.
export function bindSceneTouch() {
  const recalc = () => {
    if (activeTouches.size === 0) {
      touchDir = 0;
      return;
    }
    let sum = 0;
    for (const t of activeTouches.values()) sum += t.x < W / 2 ? -1 : 1;
    touchDir = Math.sign(sum);
  };
  onTouchStart((p, t) => {
    activeTouches.set(t.identifier, { x: p.x });
    recalc();
  });
  onTouchMove((p, t) => {
    const e = activeTouches.get(t.identifier);
    if (e) {
      e.x = p.x;
      recalc();
    }
  });
  onTouchEnd((p, t) => {
    activeTouches.delete(t.identifier);
    recalc();
  });
}

export function steerDir() {
  return resolveSteer({
    keyLeft: isKeyDown("left") || isKeyDown("a"),
    keyRight: isKeyDown("right") || isKeyDown("d"),
    padDir: padState.padDir,
    touchDir,
  });
}

export function fireDown() {
  // Desktop: mouse or space. Phone: the [FIRE] button.
  // Mouse no longer steers — that branch was removed to free it for firing.
  return resolveFire({
    padFire: padState.padFire,
    keySpace: isKeyDown("space"),
    mouseDown: isMouseDown("left"),
    touchDevice: isTouchDevice,
  });
}
