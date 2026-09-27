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

  // Walks every integer and asserts the EXPECTED band, derived independently
  // from the documented thresholds. The previous version only asserted the
  // return was a string, which would have passed even if faceState returned
  // one constant for every input — it could not catch an off-by-one boundary.
  it("maps every integer 0..100 to the band its thresholds demand", () => {
    const expected = (hp) => {
      if (hp <= 0) return "dead";
      if (hp < 25) return "bloodied";
      if (hp < 50) return "angry";
      if (hp < 75) return "grim";
      return "calm";
    };
    for (let hp = 0; hp <= 100; hp++) {
      expect(faceState(hp), `hp ${hp} landed in the wrong band`).toBe(
        expected(hp),
      );
    }
  });
});
