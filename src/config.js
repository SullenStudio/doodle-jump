// Every tuning number lives here. No kaplay globals in this file: it is
// imported by unit tests that run without a canvas.

export const W = 540;
export const H = 960;

export const GRAVITY = 2600;
export const JUMP_VEL = 1250; // ~300px max jump height
export const SPRING_VEL = 2050; // ~800px boost
export const MOVE_SPEED = 430;
export const PLAYER_R = 22;
export const PLAT_W = 96;
export const PLAT_H = 18;
export const START_Y = 827; // player spawn height (world coords, y grows down)
export const BEST_KEY = "mintjump_best";

// --------------------------------------------------------------- combat ---
export const RECOIL_CAP = 1500; // max upward speed reachable via recoil
export const BULLET_SPEED = 1400; // px/s, always straight down
export const PLAYER_HP = 100;
export const INVULN_TIME = 0.8; // seconds of i-frames after a hit
export const KNOCKBACK = { x: 380, y: 420 }; // push-away on taking a hit

// Balance invariant enforced by test/config.test.js:
//   impulse / cooldown < GRAVITY
// Continuous fire must accelerate upward less than gravity pulls down, so
// sustained flight is impossible regardless of ammo.
export const WEAPONS = {
  sidearm: {
    id: "sidearm",
    name: "SIDEARM",
    ammo: Infinity,
    pellets: 1,
    spread: 0, // degrees, half-angle
    damage: 1,
    impulse: 260, // 260 / 0.20 = 1300 px/s^2, half of gravity
    cooldown: 0.2,
  },
  scattergun: {
    id: "scattergun",
    name: "SCATTERGUN",
    ammo: 24,
    pellets: 5,
    spread: 22,
    damage: 1, // per pellet
    impulse: 700, // 700 / 0.55 = 1273 px/s^2, below gravity
    cooldown: 0.55,
  },
};

export const GRUNT = {
  hp: 1,
  radius: 22,
  damage: 25,
  speedLow: 150, // px/s at HORDE.startAlt
  speedHigh: 260, // px/s at HORDE.fullAlt and above
  wanderAmp: 46, // horizontal drift amplitude
  wanderSpd: 1.4,
};

export const HORDE = {
  startAlt: 600, // no demons below this altitude
  fullAlt: 6000, // curves stop scaling past this
  intervalLow: 2.2, // seconds between spawns at startAlt
  intervalHigh: 0.7, // seconds between spawns at fullAlt
  maxAlive: 12, // hard cap: perf + screen readability
  spawnBelowCam: 80, // px below the bottom of the camera
};

export const DROP = {
  gruntAmmoChance: 0.35,
  gruntAmmoMin: 2,
  gruntAmmoMax: 4,
  crateChance: 0.08, // share of platforms carrying an ammo crate
  crateAmmo: 8,
  medkitChance: 0.05, // share of platforms carrying a medkit
  medkitHeal: 25,
  weaponEveryPx: 1500, // roughly one scattergun per this much altitude
};
