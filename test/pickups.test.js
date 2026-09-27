import { describe, it, expect } from "vitest";
import { rollPlatformPickup } from "../src/pickups.js";
import { DROP } from "../src/config.js";

describe("rollPlatformPickup", () => {
  it("usually places nothing", () => {
    expect(rollPlatformPickup(3000, 0.99, 0.99, 0.99)).toBe(null);
  });

  it("places an ammo crate inside the crate chance", () => {
    expect(rollPlatformPickup(3000, DROP.crateChance - 0.001, 0.99, 0.99)).toBe("ammo");
  });

  it("places a medkit inside the medkit chance", () => {
    expect(rollPlatformPickup(3000, 0.99, DROP.medkitChance - 0.001, 0.99)).toBe("medkit");
  });

  it("gives at most one thing per platform, ammo winning ties", () => {
    expect(rollPlatformPickup(3000, 0.001, 0.001, 0.001)).toBe("ammo");
  });

  it("never offers a weapon before the first weapon interval", () => {
    expect(rollPlatformPickup(100, 0.99, 0.99, 0.0001)).toBe(null);
  });

  it("can offer a weapon once high enough", () => {
    expect(rollPlatformPickup(DROP.weaponEveryPx + 1, 0.99, 0.99, 0.0001)).toBe("weapon");
  });
});
