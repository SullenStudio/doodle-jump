import { describe, it, expect } from "vitest";
import { applyDamage, takeHit } from "../src/player.js";
import { PLAYER_HP, INVULN_TIME, KNOCKBACK } from "../src/config.js";

const fresh = () => ({ hp: PLAYER_HP, invulnUntil: 0, dead: false });

describe("takeHit", () => {
  // takeHit only touches plain fields, so a stand-in stands in fine.
  const fakePlayer = (hp = PLAYER_HP) => ({
    hp,
    invulnUntil: 0,
    dead: false,
    pos: { x: 100, y: 0 },
    vel: { x: 0, y: 0 },
    hurt(amount, now) {
      const next = applyDamage(
        { hp: this.hp, invulnUntil: this.invulnUntil, dead: this.dead },
        amount,
        now,
      );
      if (next.hp === this.hp && next.invulnUntil === this.invulnUntil) return false;
      Object.assign(this, next);
      return true;
    },
  });

  it("knocks the player away from a source on its left", () => {
    const p = fakePlayer();
    expect(takeHit(p, 25, { x: 40 }, 0)).toBe(true);
    expect(p.vel.x).toBe(KNOCKBACK.x); // pushed right
    expect(p.vel.y).toBe(-KNOCKBACK.y); // and upward
    expect(p.hp).toBe(75);
  });

  it("knocks the player away from a source on its right", () => {
    const p = fakePlayer();
    takeHit(p, 25, { x: 300 }, 0);
    expect(p.vel.x).toBe(-KNOCKBACK.x);
  });

  it("pushes right when the source is exactly aligned, never zero", () => {
    const p = fakePlayer();
    takeHit(p, 25, { x: 100 }, 0);
    expect(p.vel.x).toBe(KNOCKBACK.x);
  });

  it("never converts existing upward motion into a slower climb", () => {
    const p = fakePlayer();
    p.vel.y = -900; // already rising fast
    takeHit(p, 25, { x: 40 }, 0);
    expect(p.vel.y).toBe(-900);
  });

  it("returns false and leaves velocity alone during i-frames", () => {
    const p = fakePlayer();
    takeHit(p, 25, { x: 40 }, 0);
    p.vel.x = 0;
    expect(takeHit(p, 25, { x: 40 }, 0.2)).toBe(false);
    expect(p.vel.x).toBe(0);
    expect(p.hp).toBe(75);
  });
});

describe("applyDamage", () => {
  it("subtracts damage and opens an i-frame window", () => {
    const s = applyDamage(fresh(), 25, 10);
    expect(s.hp).toBe(75);
    expect(s.invulnUntil).toBeCloseTo(10 + INVULN_TIME);
    expect(s.dead).toBe(false);
  });

  it("ignores hits taken during i-frames", () => {
    const first = applyDamage(fresh(), 25, 10);
    const second = applyDamage(first, 25, 10.3); // still invulnerable
    expect(second.hp).toBe(75);
    expect(second).toBe(first); // unchanged state is returned as-is
  });

  it("accepts a hit once i-frames expire", () => {
    const first = applyDamage(fresh(), 25, 10);
    const second = applyDamage(first, 25, 10 + INVULN_TIME + 0.01);
    expect(second.hp).toBe(50);
  });

  it("clamps hp at zero and marks dead", () => {
    const s = applyDamage({ hp: 10, invulnUntil: 0, dead: false }, 25, 5);
    expect(s.hp).toBe(0);
    expect(s.dead).toBe(true);
  });

  it("four grunt hits kill a full-health player", () => {
    let s = fresh();
    for (let i = 0; i < 4; i++) s = applyDamage(s, 25, i * (INVULN_TIME + 0.1));
    expect(s.hp).toBe(0);
    expect(s.dead).toBe(true);
  });
});
