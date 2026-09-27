import { GRUNT, HORDE, W, H } from "./config.js";
import { DT } from "./frame.js";
import { COL } from "./palette.js";
import { sfx } from "./audio.js";

const clamp01 = (t) => Math.max(0, Math.min(1, t));
const ramp = (alt) => clamp01((alt - HORDE.startAlt) / (HORDE.fullAlt - HORDE.startAlt));

export function hordeSpeed(alt) {
  return GRUNT.speedLow + (GRUNT.speedHigh - GRUNT.speedLow) * ramp(alt);
}

export function spawnInterval(alt) {
  if (alt < HORDE.startAlt) return Infinity;
  return HORDE.intervalLow + (HORDE.intervalHigh - HORDE.intervalLow) * ramp(alt);
}

function addGrunt(x, y, player) {
  const g = add([
    circle(GRUNT.radius),
    pos(x, y),
    anchor("center"),
    color(COL.monster),
    outline(3, COL.monsterDark),
    area(),
    scale(1),
    z(2),
    "demon",
    { hp: GRUNT.hp, t: rand(0, 6), baseX: x },
  ]);

  // face + horns, drawn from primitives
  g.add([circle(6), pos(-9, -6), color(COL.white)]);
  g.add([circle(6), pos(9, -6), color(COL.white)]);
  g.add([circle(3), pos(-9, -6), color(COL.dark)]);
  g.add([circle(3), pos(9, -6), color(COL.dark)]);
  g.add([rect(6, 8), pos(-8, 10), color(COL.white)]);
  g.add([rect(6, 8), pos(2, 10), color(COL.white)]);
  g.add([rect(6, 10), pos(-10, -26), rotate(-20), color(COL.monsterDark)]);
  g.add([rect(6, 10), pos(4, -26), rotate(20), color(COL.monsterDark)]);

  g.die = () => {
    sfx.demonDeath();
    g.onDeathCb?.(g);
    // brief pop, then gone
    const puff = add([
      circle(GRUNT.radius),
      pos(g.pos),
      anchor("center"),
      color(COL.monsterDark),
      opacity(0.8),
      scale(1),
      z(2),
    ]);
    puff.onUpdate(() => {
      const d = DT();
      puff.opacity -= 3.5 * d;
      const s = puff.scale.x + 2.6 * d;
      puff.scale = vec2(s, s);
      if (puff.opacity <= 0) destroy(puff);
    });
    destroy(g);
  };

  g.onUpdate(() => {
    const d = DT();
    g.t += d;
    // climb toward the player, wandering sideways so a column of them
    // does not read as a single wall
    g.pos.y -= g.speed * d;
    g.baseX += Math.sign(player.pos.x - g.baseX) * g.speed * 0.35 * d;
    g.pos.x = clamp(g.baseX + Math.sin(g.t * GRUNT.wanderSpd) * GRUNT.wanderAmp, 24, W - 24);
    g.scale = vec2(1, 1 + 0.08 * Math.sin(g.t * 6));
  });

  return g;
}

export function createHorde({ player, onDeath }) {
  let timer = 0;

  return {
    count: () => get("demon").length,

    update(alt) {
      const interval = spawnInterval(alt);
      if (interval === Infinity) return;

      timer -= DT();
      if (timer > 0) return;
      timer = interval;

      if (get("demon").length >= HORDE.maxAlive) return;

      const y = camPos().y + H / 2 + HORDE.spawnBelowCam;
      const g = addGrunt(rand(40, W - 40), y, player);
      g.speed = hordeSpeed(alt);
      g.onDeathCb = onDeath;
      sfx.growl(time());
    },
  };
}
