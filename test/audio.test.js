import { describe, it, expect } from "vitest";
import { makeRateLimiter } from "../src/audio.js";

describe("makeRateLimiter", () => {
  it("allows the first call", () => {
    const allow = makeRateLimiter(0.5);
    expect(allow(0)).toBe(true);
  });

  it("blocks calls inside the gap", () => {
    const allow = makeRateLimiter(0.5);
    allow(10);
    expect(allow(10.2)).toBe(false);
    expect(allow(10.4)).toBe(false);
  });

  it("allows again once the gap has passed", () => {
    const allow = makeRateLimiter(0.5);
    allow(10);
    expect(allow(10.5)).toBe(true);
  });

  it("keeps limiting after it re-opens", () => {
    const allow = makeRateLimiter(0.5);
    allow(10);
    allow(10.5);
    expect(allow(10.6)).toBe(false);
  });
});
