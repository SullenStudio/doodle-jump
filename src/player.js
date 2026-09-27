import { COL } from "./palette.js";
import { PLAYER_R, PLAYER_HP, INVULN_TIME, KNOCKBACK, START_Y, W, JUMP_VEL } from "./config.js";

// Pure damage state machine. Time is a parameter so this is testable without
// kaplay. Returns the SAME object when the hit is absorbed by i-frames, which
// lets callers cheaply detect "nothing happened".
export function applyDamage(state, amount, now) {
  if (now < state.invulnUntil) return state;
  const hp = Math.max(0, state.hp - amount);
  return { hp, invulnUntil: now + INVULN_TIME, dead: hp <= 0 };
}

// One hit rule for every damage source (demons and drifting hazards alike).
// Returns false when i-frames absorbed the hit, so callers can skip their
// feedback. Death is the caller's business — it needs scene state.
export function takeHit(player, amount, fromPos, now) {
  if (!player.hurt(amount, now)) return false;
  const away = Math.sign(player.pos.x - fromPos.x) || 1;
  player.vel.x = away * KNOCKBACK.x;
  player.vel.y = Math.min(player.vel.y, -KNOCKBACK.y);
  return true;
}

// Eyes / pupils / smile / cheeks. Shared by the menu blob and the player.
export function addFace(blob) {
  blob.add([circle(6), pos(-8, -7), color(COL.white)]);
  blob.add([circle(6), pos(8, -7), color(COL.white)]);
  const pl = blob.add([circle(2.8), pos(-8, -7), color(COL.dark)]);
  const pr = blob.add([circle(2.8), pos(8, -7), color(COL.dark)]);
  blob.add([rect(10, 3, { radius: 1.5 }), pos(0, 6), anchor("center"), color(COL.mintDark)]);
  blob.add([circle(2.5), pos(-14, 1), color(COL.cheek), opacity(0.7)]);
  blob.add([circle(2.5), pos(14, 1), color(COL.cheek), opacity(0.7)]);
  return { pl, pr };
}

export function createPlayer() {
  const player = add([
    circle(PLAYER_R),
    pos(W / 2, START_Y),
    color(COL.mint),
    outline(3, COL.mintDark),
    area(),
    body({ maxVelocity: 1700 }),
    scale(1),
    rotate(0),
    opacity(1),
    z(3),
    "player",
    {
      hp: PLAYER_HP,
      invulnUntil: 0,
      dead: false,
    },
  ]);

  player.pupils = addFace(player);
  player.vel = vec2(0, -JUMP_VEL);

  player.isInvuln = (now) => now < player.invulnUntil;

  /** Returns true if the hit landed, false if absorbed by i-frames. */
  player.hurt = (amount, now) => {
    const next = applyDamage(
      { hp: player.hp, invulnUntil: player.invulnUntil, dead: player.dead },
      amount,
      now,
    );
    if (next.hp === player.hp && next.invulnUntil === player.invulnUntil) return false;
    player.hp = next.hp;
    player.invulnUntil = next.invulnUntil;
    player.dead = next.dead;
    return true;
  };

  player.heal = (amount) => {
    player.hp = Math.min(PLAYER_HP, player.hp + amount);
  };

  return player;
}

// Mirror copies either side of the wrap seam so the blob stays visible while
// crossing a screen edge.
export function createGhosts(player) {
  const comps = () => [
    circle(PLAYER_R),
    pos(-100, -100),
    color(COL.mint),
    outline(3, COL.mintDark),
    opacity(0.9),
    rotate(0),
    z(3),
  ];
  const ghostL = add(comps());
  const ghostR = add(comps());
  return {
    update() {
      ghostL.pos = vec2(player.pos.x - W, player.pos.y);
      ghostR.pos = vec2(player.pos.x + W, player.pos.y);
      ghostL.angle = ghostR.angle = player.angle;
      const vis = player.dead ? 0 : player.isInvuln(time()) ? 0.35 : 0.9;
      ghostL.opacity = ghostR.opacity = vis;
    },
  };
}
