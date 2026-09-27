import { describe, it, expect } from "vitest";
import { WEAPONS, GRAVITY, RECOIL_CAP, JUMP_VEL } from "../src/config.js";

describe("weapon table", () => {
  it("defines sidearm and scattergun", () => {
    expect(Object.keys(WEAPONS).sort()).toEqual(["scattergun", "sidearm"]);
  });

  // The core balance invariant: continuous fire must accelerate the player
  // upward LESS than gravity pulls them down, so sustained flight is
  // impossible no matter how much ammo they have.
  it("every weapon obeys impulse/cooldown < GRAVITY", () => {
    for (const [id, w] of Object.entries(WEAPONS)) {
      const upwardAccel = w.impulse / w.cooldown;
      expect(upwardAccel, `${id} would allow sustained flight`).toBeLessThan(
        GRAVITY,
      );
    }
  });

  it("sidearm has infinite ammo, scattergun does not", () => {
    expect(WEAPONS.sidearm.ammo).toBe(Infinity);
    expect(WEAPONS.scattergun.ammo).toBe(24);
  });

  it("recoil cap sits above jump velocity so a big shot feels powerful", () => {
    expect(RECOIL_CAP).toBeGreaterThan(JUMP_VEL);
  });
});
