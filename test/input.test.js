import { describe, it, expect } from "vitest";
import {
  resolveSteer,
  resolveFire,
  applyPointerDown,
  applyPointerRelease,
} from "../src/input.js";

const S = (o) => resolveSteer({ keyLeft: false, keyRight: false, padDir: 0, touchDir: 0, ...o });

describe("resolveSteer", () => {
  it("returns 0 with no input", () => {
    expect(S({})).toBe(0);
  });

  it("reads the keyboard", () => {
    expect(S({ keyLeft: true })).toBe(-1);
    expect(S({ keyRight: true })).toBe(1);
  });

  it("cancels opposing keys", () => {
    expect(S({ keyLeft: true, keyRight: true })).toBe(0);
  });

  // This is the regression that motivated the rewrite: in the old code a
  // stale swipeDir was checked AFTER the keyboard and overwrote it, so one
  // mouse drag killed keyboard steering for the rest of the run.
  it("never lets a lower-priority source override live keyboard input", () => {
    expect(S({ keyLeft: true, padDir: 1, touchDir: 1 })).toBe(-1);
    expect(S({ keyRight: true, padDir: -1, touchDir: -1 })).toBe(1);
  });

  it("falls back to the on-screen buttons when no key is held", () => {
    expect(S({ padDir: -1, touchDir: 1 })).toBe(-1);
  });

  it("falls back to canvas hold last", () => {
    expect(S({ touchDir: 1 })).toBe(1);
  });
});

// kaplay's touchToMouse: true makes isMouseDown("left") true for the
// duration of any touch, which would make ordinary canvas-hold steering on
// a phone also read as firing unless the mouse source is disabled on touch
// devices.
describe("resolveFire", () => {
  it("fires on mouse alone on desktop", () => {
    expect(
      resolveFire({ padFire: false, keySpace: false, mouseDown: true, touchDevice: false }),
    ).toBe(true);
  });

  it("does NOT fire on mouse alone on a touch device", () => {
    expect(
      resolveFire({ padFire: false, keySpace: false, mouseDown: true, touchDevice: true }),
    ).toBe(false);
  });

  it("the FIRE button fires on both desktop and touch", () => {
    expect(
      resolveFire({ padFire: true, keySpace: false, mouseDown: false, touchDevice: false }),
    ).toBe(true);
    expect(
      resolveFire({ padFire: true, keySpace: false, mouseDown: false, touchDevice: true }),
    ).toBe(true);
  });

  it("space fires on both desktop and touch", () => {
    expect(
      resolveFire({ padFire: false, keySpace: true, mouseDown: false, touchDevice: false }),
    ).toBe(true);
    expect(
      resolveFire({ padFire: false, keySpace: true, mouseDown: false, touchDevice: true }),
    ).toBe(true);
  });

  it("no input means no fire", () => {
    expect(
      resolveFire({ padFire: false, keySpace: false, mouseDown: false, touchDevice: false }),
    ).toBe(false);
  });
});

// Two-thumb play: one finger holds a direction button, a second finger taps
// FIRE. Lifting the FIRE finger must not zero the still-held direction, and
// vice versa. Each control is "owned" by whichever pointerId pressed it.
describe("pad pointer ownership (applyPointerDown / applyPointerRelease)", () => {
  const empty = () => ({
    padDir: 0,
    dirPointerId: null,
    padFire: false,
    firePointerId: null,
  });

  it("a second pointer releasing FIRE does not clear a direction held by another pointer", () => {
    let state = empty();
    state = applyPointerDown(state, 1, -1); // finger 1 presses LEFT
    state = applyPointerDown(state, 2, "fire"); // finger 2 presses FIRE
    expect(state).toEqual({ padDir: -1, dirPointerId: 1, padFire: true, firePointerId: 2 });

    state = applyPointerRelease(state, 2); // finger 2 lifts off FIRE
    expect(state.padDir).toBe(-1); // LEFT is still held
    expect(state.dirPointerId).toBe(1);
    expect(state.padFire).toBe(false);
    expect(state.firePointerId).toBe(null);
  });

  it("a release from an unrelated pointerId clears nothing", () => {
    let state = applyPointerDown(empty(), 1, 1); // finger 1 presses RIGHT
    state = applyPointerRelease(state, 999); // some other pointer releasing
    expect(state.padDir).toBe(1);
    expect(state.dirPointerId).toBe(1);
  });

  it("the owning pointer releasing fully clears its own control", () => {
    let state = applyPointerDown(empty(), 5, "fire");
    state = applyPointerRelease(state, 5);
    expect(state.padFire).toBe(false);
    expect(state.firePointerId).toBe(null);
  });

  it("a later pointerdown on the same control reassigns ownership", () => {
    let state = applyPointerDown(empty(), 1, -1); // finger 1 -> LEFT
    state = applyPointerDown(state, 2, 1); // finger 2 -> RIGHT (overwrites the single dir slot)
    expect(state.padDir).toBe(1);
    expect(state.dirPointerId).toBe(2);
    // finger 1 releasing no longer matches, so it does not zero finger 2's RIGHT
    state = applyPointerRelease(state, 1);
    expect(state.padDir).toBe(1);
  });
});
