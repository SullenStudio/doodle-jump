import kaplay from "kaplay";
import "./mobile.css";
import {
  W,
  H,
  GRAVITY,
  JUMP_VEL,
  SPRING_VEL,
  MOVE_SPEED,
  PLAYER_R,
  PLAT_W,
  PLAT_H,
  START_Y,
  GRUNT,
} from "./config.js";
import { rollPlatformPickup, addPickup, dropFromDemon } from "./pickups.js";
import { initPalette } from "./palette.js";
import { DT } from "./frame.js";
import {
  initInput,
  resetInput,
  bindSceneTouch,
  steerDir,
  fireDown,
  isTouchDevice,
} from "./input.js";
import { createPlayer, createGhosts, takeHit } from "./player.js";
import { createArsenal } from "./weapons.js";
import { addStarfield, createWorld } from "./world.js";
import { createHorde } from "./demons.js";
import { createHud } from "./hud.js";
import { sfx } from "./audio.js";
import { getBest, setBest } from "./best.js";
import { setScreen } from "./screen.js";
import { registerMenuScene } from "./scenes/menu.js";
import { registerGameoverScene } from "./scenes/gameover.js";

if (isTouchDevice) document.documentElement.classList.add("phone");

kaplay({
  width: 540,
  height: 960,
  letterbox: true,
  crisp: true,
  pixelDensity: Math.min(devicePixelRatio, 2),
  background: [9, 12, 11],
  root: document.getElementById("game-wrap"),
  touchToMouse: true,
});

initPalette();
initInput();


// =================================================================== GAME ==
scene("game", () => {
  setScreen("play");
  resetInput();
  bindSceneTouch();
  setGravity(GRAVITY);
  camPos(vec2(W / 2, H / 2));
  addStarfield();

  // ------------------------------------------------------------- state ---
  let dead = false;
  let maxAlt = 0;
  let squashT = 0;
  let prevFeet = START_Y + PLAYER_R;

  // ------------------------------------------------------------ player ---
  const player = createPlayer();
  const pupils = player.pupils;
  const ghosts = createGhosts(player);
  const arsenal = createArsenal();
  const world = createWorld({
    player,
    onPlatform: (p, alt) => {
      const kind = rollPlatformPickup(alt, rand(1), rand(1), rand(1));
      if (kind) addPickup(kind, p.pos.x, p.pos.y - PLAT_H / 2 - 14);
    },
  });
  const horde = createHorde({
    player,
    onDeath: (g) => dropFromDemon(g, rand(1), rand(1)),
  });

  // Single writer for death: the scene reads `dead`, but player.js and
  // world.js read player.dead. They must never disagree.
  function markDead() {
    dead = true;
    player.dead = true;
  }

  // Every damage source funnels through here: knockback lives in
  // takeHit(), the scene owns the feedback and the death transition.
  function damagePlayer(amount, fromPos) {
    if (!takeHit(player, amount, fromPos, time())) return; // i-frames ate it
    sfx.hurt();
    shake(6);
    if (player.hp <= 0) {
      markDead();
      shake(16);
      wait(0.4, endRun);
    }
  }

  // -------------------------------------------------------------- HUD -----
  const hud = createHud();

  // ------------------------------------------------------------ landing ---
  function landOn(p) {
    squashT = 1;
    if (p.kind === "spring") {
      player.vel.y = -SPRING_VEL;
      shake(5);
      sfx.spring();
    } else {
      player.vel.y = -JUMP_VEL;
      sfx.bounce();
    }
    if (p.kind === "breakable") {
      p.broken = true;
      p.fallV = 60;
      p.spin = rand(-160, 160);
    }
  }

  player.onUpdate(() => {
    if (dead) return;
    const d = DT();

    // steering + tilt toward movement
    const dir = steerDir();
    player.vel.x = lerp(player.vel.x, dir * MOVE_SPEED, Math.min(1, 14 * d));
    player.angle = lerp(
      player.angle,
      clamp(player.vel.x * 0.045, -22, 22),
      Math.min(1, 10 * d),
    );

    // pupils look toward movement
    const look = clamp(player.vel.x * 0.006, -2.5, 2.5);
    pupils.pl.pos.x = -8 + look;
    pupils.pr.pos.x = 8 + look;

    // fire straight down; recoil lifts the player
    arsenal.update();
    if (fireDown()) {
      const id = arsenal.current.id;
      if (arsenal.tryFire(player, time())) sfx.shoot(id);
    }

    // squash & stretch recovery
    squashT = Math.max(0, squashT - d * 5);
    player.scale = vec2(1 + 0.22 * squashT, 1 - 0.26 * squashT);

    // blink while invulnerable
    player.opacity = player.isInvuln(time()) ? (Math.floor(time() * 20) % 2 ? 0.35 : 1) : 1;

    // wrap around screen edges
    if (player.pos.x < -PLAYER_R) player.pos.x += W + PLAYER_R * 2;
    else if (player.pos.x > W + PLAYER_R) player.pos.x -= W + PLAYER_R * 2;

    // swept landing check: only when falling onto a platform top
    const feet = player.pos.y + PLAYER_R;
    if (player.vel.y > 0) {
      for (const p of get("platform")) {
        if (p.broken) continue;
        const top = p.pos.y - PLAT_H / 2;
        if (prevFeet <= top + 2 && feet >= top - 2) {
          let dx = Math.abs(player.pos.x - p.pos.x);
          dx = Math.min(dx, W - dx); // wrap-aware distance
          if (dx <= PLAT_W / 2 + PLAYER_R * 0.55) {
            landOn(p);
            break;
          }
        }
      }
    }
    prevFeet = feet;
  });

  // Black holes still kill outright; the drifting monster now deals damage.
  player.onCollide("hazard", (hz) => {
    if (dead) return;
    if (hz.instantKill) {
      markDead();
      shake(16);
      player.vel = vec2(0, 0);
      player.gravityScale = 0;
      tween(player.pos, hz.pos, 0.4, (v) => (player.pos = v), easings.easeInQuad);
      tween(vec2(1, 1), vec2(0.01, 0.01), 0.4, (v) => (player.scale = v), easings.easeInQuad);
      wait(0.55, endRun);
      return;
    }
    damagePlayer(25, hz.pos);
  });

  player.onCollide("demon", (g) => {
    if (dead) return;
    damagePlayer(GRUNT.damage, g.pos); // same helper the hazards use
  });

  player.onCollide("pickup", (p) => {
    if (dead) return;
    if (p.kind === "medkit") player.heal(p.amount);
    else if (p.kind === "ammo") arsenal.give("scattergun", p.amount);
    else if (p.kind === "weapon") arsenal.give("scattergun", 24);
    sfx.pickup();
    destroy(p);
  });

  onCollide("bullet", "demon", (b, d) => {
    destroy(b);
    d.hp -= b.damage;
    if (d.hp <= 0) d.die();
  });

  // ------------------------------------------- camera / cleanup / death ---
  function endRun() {
    sfx.gameOver();
    markDead();
    const score = Math.floor(maxAlt / 50);
    const best = getBest();
    const isNew = score > best;
    if (isNew) setBest(score);
    go("gameover", { score, best: Math.max(best, score), isNew });
  }

  onUpdate(() => {
    // ghosts mirror the player across the wrap seam
    ghosts.update();
    if (dead) return;

    // camera follows the jumper upward only
    const line = camPos().y - H / 2 + H * 0.38;
    if (player.pos.y < line) {
      camPos(vec2(W / 2, player.pos.y + H / 2 - H * 0.38));
    }

    maxAlt = Math.max(maxAlt, START_Y - player.pos.y);
    hud.update({
      hp: player.hp,
      ammo: arsenal.ammo,
      weaponName: arsenal.current.name,
      altitude: Math.floor(maxAlt / 50),
    });
    if (!dead && player.hp > 0 && player.hp < 25) sfx.heartbeat(time());

    world.ensure();
    horde.update(maxAlt);

    // recycle what fell far below the camera
    const killY = camPos().y + H / 2 + 140;
    world.recycle(killY);
    for (const b of get("bullet")) {
      if (b.pos.y > killY || b.pos.y < camPos().y - H) destroy(b);
    }
    for (const g of get("demon")) if (g.pos.y > killY) destroy(g);
    for (const p of get("pickup")) if (p.pos.y > killY) destroy(p);

    // fell below the screen
    if (player.pos.y - PLAYER_R > camPos().y + H / 2 + 60) endRun();
  });

  // -------------------------------------------------------------- start ---
  world.start();
});

// ============================================================== GAME OVER ==

// Scenes are registered AFTER kaplay() and initPalette(), never at module
// import time: a scene body references kaplay globals that do not exist until
// kaplay() has run.
registerMenuScene();
registerGameoverScene();

go("menu");
