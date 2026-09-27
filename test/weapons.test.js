import { describe, it, expect } from "vitest";
import { applyRecoil, pelletAngles, selectWeapon } from "../src/weapons.js";
import { WEAPONS, RECOIL_CAP, GRAVITY } from "../src/config.js";

describe("applyRecoil", () => {
  // y grows downward, so upward velocity is negative.
  it("pushes velocity upward", () => {
    expect(applyRecoil(0, 260, RECOIL_CAP)).toBe(-260);
  });

  it("adds to existing upward motion", () => {
    expect(applyRecoil(-300, 260, RECOIL_CAP)).toBe(-560);
  });

  it("clamps at the cap so shots cannot stack without limit", () => {
    expect(applyRecoil(-1400, 700, RECOIL_CAP)).toBe(-RECOIL_CAP);
    expect(applyRecoil(-RECOIL_CAP, 700, RECOIL_CAP)).toBe(-RECOIL_CAP);
  });

  it("arrests a fall", () => {
    expect(applyRecoil(900, 700, RECOIL_CAP)).toBe(200);
  });
});

describe("selectWeapon", () => {
  it("keeps the current weapon while it has ammo", () => {
    expect(selectWeapon("scattergun", { sidearm: Infinity, scattergun: 5 })).toBe("scattergun");
  });

  // Spec requirement: running dry drops you back to the sidearm silently.
  it("falls back to the sidearm at zero ammo", () => {
    expect(selectWeapon("scattergun", { sidearm: Infinity, scattergun: 0 })).toBe("sidearm");
  });

  it("falls back for an unknown weapon id", () => {
    expect(selectWeapon("railgun", { sidearm: Infinity })).toBe("sidearm");
  });

  it("never falls back away from the sidearm itself", () => {
    expect(selectWeapon("sidearm", { sidearm: Infinity })).toBe("sidearm");
  });
});

describe("pelletAngles", () => {
  it("fires a single pellet straight down", () => {
    expect(pelletAngles(1, 0)).toEqual([0]);
  });

  it("spreads pellets evenly across the full cone", () => {
    const a = pelletAngles(5, 22);
    expect(a).toHaveLength(5);
    expect(a[0]).toBeCloseTo(-22);
    expect(a[4]).toBeCloseTo(22);
    expect(a[2]).toBeCloseTo(0);
  });
});

// The invariant that makes the whole design work. Simulating is stronger than
// asserting the ratio, because it proves the player actually falls.
describe("sustained flight is impossible", () => {
  for (const [id, w] of Object.entries(WEAPONS)) {
    it(`${id}: holding fire for 5s still ends up below the start`, () => {
      const step = 1 / 60;
      let y = 0;
      let vy = 0;
      let cd = 0;
      for (let t = 0; t < 5; t += step) {
        cd -= step;
        if (cd <= 0) {
          vy = applyRecoil(vy, w.impulse, RECOIL_CAP);
          cd = w.cooldown;
        }
        vy += GRAVITY * step;
        y += vy * step;
      }
      expect(y, `${id} allowed the player to climb forever`).toBeGreaterThan(0);
    });

    it(`${id}: upward velocity never exceeds the cap`, () => {
      const step = 1 / 60;
      let vy = 0;
      let cd = 0;
      let peak = 0;
      for (let t = 0; t < 5; t += step) {
        cd -= step;
        if (cd <= 0) {
          vy = applyRecoil(vy, w.impulse, RECOIL_CAP);
          cd = w.cooldown;
        }
        vy += GRAVITY * step;
        peak = Math.min(peak, vy);
      }
      expect(Math.abs(peak)).toBeLessThanOrEqual(RECOIL_CAP);
    });
  }
});
