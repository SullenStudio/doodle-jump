import { COL } from "./palette.js";
import { W, H, PLAT_W, PLAT_H, START_Y, GRAVITY } from "./config.js";
import { DT } from "./frame.js";

export const altitudeAt = (y) => Math.max(0, START_Y - y);

/** r is a 0..1 roll, passed in so this stays pure and testable. */
export function rollKind(alt, r) {
  const pSpring = alt < 250 ? 0 : 0.09;
  const pMoving = alt < 500 ? 0 : Math.min(0.38, 0.06 + alt / 16000);
  const pBreak = alt < 1100 ? 0 : Math.min(0.3, 0.04 + alt / 18000);
  if (r < pSpring) return "spring";
  if (r < pSpring + pMoving) return "moving";
  if (r < pSpring + pMoving + pBreak) return "breakable";
  return "normal";
}

export const gapMax = (alt) => Math.min(150, 84 + alt / 120);

export function addStarfield() {
  for (let i = 0; i < 34; i++) {
    const star = add([
      circle(rand(1, 2.6)),
      pos(rand(0, W), rand(0, H)),
      color(COL.mint),
      opacity(rand(0.05, 0.18)),
      fixed(),
      z(1),
      { f: rand(0.15, 0.45), by: rand(0, H + 60) },
    ]);
    star.onUpdate(() => {
      const camY = camPos().y - H / 2;
      star.pos.y = ((((star.by + camY * star.f) % (H + 60)) + H + 60) % (H + 60)) - 30;
    });
  }
}

function addPlatform(x, y, kind) {
  const p = add([
    rect(PLAT_W, PLAT_H, { radius: 8 }),
    pos(x, y),
    anchor("center"),
    color(kind === "moving" ? COL.mintLight : kind === "breakable" ? COL.wood : COL.mint),
    outline(3, kind === "moving" ? COL.mint : kind === "breakable" ? COL.woodDark : COL.mintDark),
    opacity(1),
    rotate(0),
    z(2),
    "platform",
    { kind, broken: false, dir: choose([-1, 1]), speed: 0, fallV: 0, spin: 0 },
  ]);

  if (kind === "moving") {
    p.add([circle(2.5), pos(-13, 0), color(COL.mintDark)]);
    p.add([circle(2.5), pos(13, 0), color(COL.mintDark)]);
  } else if (kind === "breakable") {
    p.add([rect(2.5, PLAT_H - 6), pos(-12, 0), anchor("center"), rotate(18), color(COL.woodDark)]);
    p.add([rect(2.5, PLAT_H - 8), pos(9, 0), anchor("center"), rotate(-14), color(COL.woodDark)]);
  } else if (kind === "spring") {
    p.add([rect(6, 8), pos(0, -12), anchor("center"), color(COL.spring)]);
    p.add([rect(24, 6, { radius: 3 }), pos(0, -18), anchor("center"), color(COL.spring), outline(2, COL.springDark)]);
  }

  p.onUpdate(() => {
    if (p.broken) {
      p.fallV += GRAVITY * DT();
      p.pos.y += p.fallV * DT();
      p.angle += p.spin * DT();
      p.opacity -= 2.2 * DT();
      if (p.opacity <= 0) destroy(p);
    } else if (p.kind === "moving") {
      p.pos.x += p.dir * p.speed * DT();
      if (p.pos.x < PLAT_W / 2) {
        p.pos.x = PLAT_W / 2;
        p.dir = 1;
      } else if (p.pos.x > W - PLAT_W / 2) {
        p.pos.x = W - PLAT_W / 2;
        p.dir = -1;
      }
    }
  });
  return p;
}

// Black holes only. The drifting red monster is replaced by the demon horde.
function addBlackHole(x, y, player) {
  const hole = add([
    circle(24),
    pos(x, y),
    anchor("center"),
    color(rgb(0, 0, 0)),
    outline(4, COL.hole),
    area(),
    scale(1),
    rotate(0),
    z(2),
    "hazard",
    { t: rand(0, 6), instantKill: true },
  ]);
  hole.add([circle(13), pos(0, 0), outline(3, COL.holeSwirl), opacity(0.8)]);
  hole.add([circle(5), pos(0, 0), color(COL.holeSwirl), opacity(0.9)]);
  hole.onUpdate(() => {
    hole.t += DT();
    hole.angle += 140 * DT();
    const s = 1 + 0.09 * Math.sin(hole.t * 3.2);
    hole.scale = vec2(s, s);
    if (!player.dead && hole.pos.dist(player.pos) < 150) {
      player.pos = player.pos.lerp(hole.pos, 0.55 * DT());
    }
  });
  return hole;
}

export function createWorld({ player, onPlatform }) {
  let prevX = W / 2;
  let nextY = 0;

  function pickX(alt) {
    const maxDx = Math.min(250, 140 + alt / 90);
    let x = prevX + rand(-maxDx, maxDx);
    const lo = 50;
    const hi = W - 50;
    while (x < lo) x += hi - lo;
    while (x > hi) x -= hi - lo;
    return x;
  }

  function spawnRow(y) {
    const alt = altitudeAt(y);
    const kind = rollKind(alt, rand(1));
    const x = pickX(alt);
    const p = addPlatform(x, y, kind);
    if (kind === "moving") p.speed = 90 + Math.min(130, alt / 150) + rand(-15, 15);
    onPlatform?.(p, alt);
    prevX = x;

    // an extra easy platform low down
    if (alt < 1600 && rand() < 0.28) {
      const x2 = rand(60, W - 60);
      let d = Math.abs(x2 - x);
      d = Math.min(d, W - d);
      if (d > 150) {
        const extra = addPlatform(x2, y + rand(-10, 10), "normal");
        onPlatform?.(extra, alt);
      }
    }

    if (alt > 2200) {
      const chance = Math.min(0.08, 0.02 + (alt - 2200) / 40000);
      if (rand() < chance) addBlackHole(rand(50, W - 50), y - rand(80, 160), player);
    }
  }

  return {
    start() {
      addPlatform(W / 2, 880, "normal"); // base platform under the jumper
      nextY = 880 - rand(60, 80);
      this.ensure();
    },

    ensure() {
      const camTop = camPos().y - H / 2;
      while (nextY > camTop - 140) {
        spawnRow(nextY);
        nextY -= rand(52, gapMax(altitudeAt(nextY)));
      }
    },

    recycle(killY) {
      for (const p of get("platform")) if (p.pos.y > killY) destroy(p);
      for (const hz of get("hazard")) if (hz.pos.y > killY) destroy(hz);
    },
  };
}
