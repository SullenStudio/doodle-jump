import { WEAPONS, RECOIL_CAP, BULLET_SPEED, PLAYER_R } from "./config.js";
import { COL } from "./palette.js";

// y grows downward, so an upward impulse SUBTRACTS from vel.y. The clamp is a
// secondary safety: the primary guarantee against sustained flight is the
// config invariant impulse/cooldown < GRAVITY, proven in test/weapons.test.js.
export function applyRecoil(velY, impulse, cap = RECOIL_CAP) {
  return Math.max(velY - impulse, -cap);
}

// Which weapon actually fires, given what is loaded. Pure so the ammo
// fallback rule is testable without spawning entities.
export function selectWeapon(currentId, ammo) {
  if ((ammo[currentId] ?? 0) <= 0) return "sidearm";
  return currentId;
}

/** Evenly spaced pellet angles in degrees, 0 = straight down. */
export function pelletAngles(pellets, spread) {
  if (pellets <= 1) return [0];
  const out = [];
  for (let i = 0; i < pellets; i++) {
    out.push(-spread + (2 * spread * i) / (pellets - 1));
  }
  return out;
}

function spawnPellet(x, y, angleDeg, damage) {
  const rad = (angleDeg * Math.PI) / 180;
  const vx = Math.sin(rad) * BULLET_SPEED;
  const vy = Math.cos(rad) * BULLET_SPEED; // positive = downward
  const b = add([
    rect(4, 12, { radius: 2 }),
    pos(x, y),
    anchor("center"),
    color(COL.spring),
    outline(1, COL.springDark),
    area(),
    rotate(-angleDeg),
    z(4),
    "bullet",
    { vx, vy, damage },
  ]);
  b.onUpdate(() => {
    const d = Math.min(dt(), 1 / 30);
    b.pos.x += b.vx * d;
    b.pos.y += b.vy * d;
  });
  return b;
}

export function createArsenal() {
  const ammo = { sidearm: Infinity, scattergun: 0 };
  let currentId = "sidearm";
  let cooldown = 0;

  const arsenal = {
    get current() {
      return WEAPONS[currentId];
    },
    ammoFor(id) {
      return ammo[id];
    },
    get ammo() {
      return ammo[currentId];
    },

    give(id, rounds) {
      ammo[id] = (ammo[id] === Infinity ? Infinity : (ammo[id] || 0)) + rounds;
      if (id !== "sidearm") currentId = id; // picking a gun up equips it
    },

    /** Returns true if a shot was actually fired. */
    tryFire(player, now) {
      if (cooldown > 0) return false;
      currentId = selectWeapon(currentId, ammo); // silent, instant fallback
      const w = WEAPONS[currentId];
      if (ammo[currentId] !== Infinity) ammo[currentId] -= 1;
      cooldown = w.cooldown;

      for (const a of pelletAngles(w.pellets, w.spread)) {
        spawnPellet(player.pos.x, player.pos.y + PLAYER_R, a, w.damage);
      }
      player.vel.y = applyRecoil(player.vel.y, w.impulse, RECOIL_CAP);

      currentId = selectWeapon(currentId, ammo);
      return true;
    },

    update() {
      if (cooldown > 0) cooldown -= Math.min(dt(), 1 / 30);
    },
  };

  return arsenal;
}
