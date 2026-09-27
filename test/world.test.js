import { describe, it, expect } from "vitest";
import { rollKind, altitudeAt, gapMax } from "../src/world.js";
import { START_Y } from "../src/config.js";

describe("altitudeAt", () => {
  it("is zero at the spawn height and never negative", () => {
    expect(altitudeAt(START_Y)).toBe(0);
    expect(altitudeAt(START_Y + 500)).toBe(0);
  });

  it("grows as y decreases", () => {
    expect(altitudeAt(START_Y - 300)).toBe(300);
  });
});

describe("rollKind", () => {
  it("only makes normal platforms at the very bottom", () => {
    for (const r of [0, 0.25, 0.5, 0.75, 0.999]) {
      expect(rollKind(0, r)).toBe("normal");
    }
  });

  it("introduces springs above 250", () => {
    expect(rollKind(300, 0.01)).toBe("spring");
    expect(rollKind(200, 0.01)).toBe("normal");
  });

  it("introduces moving platforms above 500", () => {
    expect(rollKind(600, 0.12)).toBe("moving");
    expect(rollKind(400, 0.12)).toBe("normal");
  });

  it("introduces breakable platforms above 1100", () => {
    expect(rollKind(1200, 0.3)).toBe("breakable");
  });

  // If the special-kind probabilities ever summed above 1 the "normal" case
  // would become unreachable and the game would lose its safe platforms.
  it("always leaves room for normal platforms", () => {
    for (let alt = 0; alt <= 20000; alt += 250) {
      expect(rollKind(alt, 0.999), `alt ${alt} has no normal platforms`).toBe(
        "normal",
      );
    }
  });
});

describe("gapMax", () => {
  it("widens with altitude but stays reachable", () => {
    expect(gapMax(0)).toBeLessThan(gapMax(5000));
    // A jump clears ~300px; gaps must never exceed that or the run dead-ends.
    expect(gapMax(1e6)).toBeLessThanOrEqual(150);
  });
});
