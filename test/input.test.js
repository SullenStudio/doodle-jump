import { describe, it, expect } from "vitest";
import { resolveSteer } from "../src/input.js";

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
