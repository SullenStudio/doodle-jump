import { describe, it, expect } from "vitest";
import { faceState } from "../src/hud.js";

describe("faceState", () => {
  it("maps each health band", () => {
    expect(faceState(100)).toBe("calm");
    expect(faceState(75)).toBe("calm");
    expect(faceState(74)).toBe("grim");
    expect(faceState(50)).toBe("grim");
    expect(faceState(49)).toBe("angry");
    expect(faceState(25)).toBe("angry");
    expect(faceState(24)).toBe("bloodied");
    expect(faceState(1)).toBe("bloodied");
    expect(faceState(0)).toBe("dead");
  });

  it("treats negative health as dead", () => {
    expect(faceState(-10)).toBe("dead");
  });

  it("covers every integer from 0 to 100 without gaps", () => {
    for (let hp = 0; hp <= 100; hp++) {
      expect(typeof faceState(hp)).toBe("string");
    }
  });
});
