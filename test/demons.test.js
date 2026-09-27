import { describe, it, expect } from "vitest";
import { hordeSpeed, spawnInterval } from "../src/demons.js";
import { HORDE, GRUNT } from "../src/config.js";

describe("hordeSpeed", () => {
  it("starts at the low speed and tops out at the high speed", () => {
    expect(hordeSpeed(HORDE.startAlt)).toBeCloseTo(GRUNT.speedLow);
    expect(hordeSpeed(HORDE.fullAlt)).toBeCloseTo(GRUNT.speedHigh);
  });

  it("does not keep accelerating past the full altitude", () => {
    expect(hordeSpeed(HORDE.fullAlt * 10)).toBeCloseTo(GRUNT.speedHigh);
  });

  it("never exceeds the high speed below the floor", () => {
    expect(hordeSpeed(0)).toBeLessThanOrEqual(GRUNT.speedLow);
  });

  it("rises monotonically", () => {
    let prev = -Infinity;
    for (let a = 0; a <= HORDE.fullAlt; a += 300) {
      const s = hordeSpeed(a);
      expect(s).toBeGreaterThanOrEqual(prev);
      prev = s;
    }
  });
});

describe("spawnInterval", () => {
  it("never spawns below the start altitude", () => {
    expect(spawnInterval(0)).toBe(Infinity);
    expect(spawnInterval(HORDE.startAlt - 1)).toBe(Infinity);
  });

  it("spawns slowly at first and fast at altitude", () => {
    expect(spawnInterval(HORDE.startAlt)).toBeCloseTo(HORDE.intervalLow);
    expect(spawnInterval(HORDE.fullAlt)).toBeCloseTo(HORDE.intervalHigh);
  });

  it("stops tightening past the full altitude", () => {
    expect(spawnInterval(HORDE.fullAlt * 5)).toBeCloseTo(HORDE.intervalHigh);
  });

  it("shortens monotonically", () => {
    let prev = Infinity;
    for (let a = HORDE.startAlt; a <= HORDE.fullAlt; a += 300) {
      const s = spawnInterval(a);
      expect(s).toBeLessThanOrEqual(prev);
      prev = s;
    }
  });
});
