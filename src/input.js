import { W } from "./config.js";

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

let padDir = 0;
let padFire = false;
let mouseFire = false;
let playHandler = null;
let touchDir = 0;
let wired = false;
const activeTouches = new Map(); // identifier -> { x }

export function registerPlayHandler(fn) {
  playHandler = fn;
}

export function resetInput() {
  padDir = 0;
  padFire = false;
  mouseFire = false;
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
    if (btn.dataset.fire !== undefined) padFire = true;
    else padDir = Number(btn.dataset.dir);
  });

  const release = () => {
    padDir = 0;
    padFire = false;
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
    padDir,
    touchDir,
  });
}

export function fireDown() {
  // Desktop: mouse or space. Phone: the [FIRE] button.
  // Mouse no longer steers — that branch was removed to free it for firing.
  return padFire || isKeyDown("space") || isMouseDown("left");
}
