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
  BEST_KEY,
  GRUNT,
} from "./config.js";
import { rollPlatformPickup, addPickup, dropFromDemon } from "./pickups.js";
import { COL, initPalette } from "./palette.js";
import { DT } from "./frame.js";
import {
  initInput,
  registerPlayHandler,
  resetInput,
  bindSceneTouch,
  steerDir,
  fireDown,
  isTouchDevice,
} from "./input.js";
import { createPlayer, createGhosts, addFace, takeHit } from "./player.js";
import { createArsenal } from "./weapons.js";
import { addStarfield, createWorld } from "./world.js";
import { createHorde } from "./demons.js";

if (isTouchDevice) document.documentElement.classList.add("phone");

function setScreen(name) {
  document.documentElement.classList.toggle("menu", name === "menu");
  document.documentElement.classList.toggle("over", name === "over");
  document.documentElement.classList.toggle("play", name === "play");
}

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

const getBest = () => parseInt(localStorage.getItem(BEST_KEY) || "0", 10) || 0;
const setBest = (v) => localStorage.setItem(BEST_KEY, String(v));

// =================================================================== MENU ==
scene("menu", () => {
  setScreen("menu");
  const playBtn = document.getElementById("btn-play");
  if (playBtn) playBtn.textContent = "PLAY";
  camPos(vec2(W / 2, H / 2));
  addStarfield();

  add([
    text("S U L L E N   S T U D I O", { size: 18 }),
    pos(W / 2, 72),
    anchor("center"),
    color(COL.mint),
    opacity(0.85),
  ]);

  const title = add([
    text("MINT JUMP", { size: 64 }),
    pos(W / 2, 210),
    anchor("center"),
    color(COL.mint),
  ]);
  title.onUpdate(() => {
    title.pos.y = 210 + wave(-10, 10, time() * 1.4);
  });

  add([
    text("an endless climber", { size: 20 }),
    pos(W / 2, 272),
    anchor("center"),
    color(COL.text),
    opacity(0.6),
  ]);

  // decorative bouncing blob on a platform
  add([
    rect(PLAT_W, PLAT_H, { radius: 8 }),
    pos(W / 2, 560),
    anchor("center"),
    color(COL.mint),
    outline(3, COL.mintDark),
  ]);
  const blob = add([
    circle(PLAYER_R),
    pos(W / 2, 470),
    color(COL.mint),
    outline(3, COL.mintDark),
    rotate(0),
  ]);
  addFace(blob);
  blob.onUpdate(() => {
    const bounce = Math.abs(wave(0, 78, time() * 2.6));
    blob.pos.y = 470 - bounce;
    blob.angle = wave(-8, 8, time() * 2.6);
  });

  const best = getBest();
  if (best > 0) {
    add([
      text(`BEST ${best}m`, { size: 22 }),
      pos(W / 2, 640),
      anchor("center"),
      color(COL.spring),
    ]);
  }

  const hint = add([
    text("TAP OR PRESS SPACE", { size: 22 }),
    pos(W / 2, 710),
    anchor("center"),
    color(COL.text),
  ]);
  hint.onUpdate(() => {
    hint.opacity = wave(0.3, 1, time() * 3);
  });

  add([
    text("steer with arrows / A D", { size: 16 }),
    pos(W / 2, 780),
    anchor("center"),
    color(COL.text),
    opacity(0.55),
  ]);
  add([
    text("on phone swipe left / right, or use the buttons", { size: 16 }),
    pos(W / 2, 808),
    anchor("center"),
    color(COL.text),
    opacity(0.55),
  ]);

  let started = false;
  const start = () => {
    if (started) return;
    started = true;
    go("game");
  };
  registerPlayHandler(start);
  onKeyPress("space", start);
  onKeyPress("enter", start);
  onMousePress(start);
  onTouchStart(start);
});

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
    shake(6);
    if (player.hp <= 0) {
      markDead();
      shake(16);
      wait(0.4, endRun);
    }
  }

  // -------------------------------------------------------------- HUD -----
  const scoreLabel = add([
    text("0m", { size: 44 }),
    pos(W / 2, 18),
    anchor("top"),
    color(COL.text),
    fixed(),
    z(10),
  ]);

  // ------------------------------------------------------------ landing ---
  function landOn(p) {
    squashT = 1;
    if (p.kind === "spring") {
      player.vel.y = -SPRING_VEL;
      shake(5);
    } else {
      player.vel.y = -JUMP_VEL;
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
    if (fireDown()) arsenal.tryFire(player, time());

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
    destroy(p);
  });

  onCollide("bullet", "demon", (b, d) => {
    destroy(b);
    d.hp -= b.damage;
    if (d.hp <= 0) d.die();
  });

  // ------------------------------------------- camera / cleanup / death ---
  function endRun() {
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
    scoreLabel.text = `${Math.floor(maxAlt / 50)}m`;

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
scene("gameover", ({ score, best, isNew }) => {
  setScreen("over");
  const playBtn = document.getElementById("btn-play");
  if (playBtn) playBtn.textContent = "AGAIN";
  camPos(vec2(W / 2, H / 2));
  addStarfield();

  add([
    text("GAME OVER", { size: 52 }),
    pos(W / 2, 250),
    anchor("center"),
    color(COL.danger),
  ]);

  add([
    text(`${score}m`, { size: 84 }),
    pos(W / 2, 370),
    anchor("center"),
    color(COL.text),
  ]);

  add([
    text(`BEST ${best}m`, { size: 24 }),
    pos(W / 2, 452),
    anchor("center"),
    color(COL.mint),
  ]);

  if (isNew) {
    const badge = add([
      text("NEW BEST!", { size: 26 }),
      pos(W / 2, 512),
      anchor("center"),
      color(COL.spring),
    ]);
    badge.onUpdate(() => {
      badge.opacity = wave(0.3, 1, time() * 5);
    });
  }

  const hint = add([
    text("TAP OR SPACE TO CLIMB AGAIN", { size: 18 }),
    pos(W / 2, 650),
    anchor("center"),
    color(COL.text),
  ]);
  hint.onUpdate(() => {
    hint.opacity = wave(0.3, 1, time() * 3);
  });

  add([
    text("S U L L E N   S T U D I O", { size: 16 }),
    pos(W / 2, 880),
    anchor("center"),
    color(COL.mint),
    opacity(0.7),
  ]);

  let started = false;
  const retry = () => {
    if (started) return;
    started = true;
    go("game");
  };
  registerPlayHandler(retry);
  onKeyPress("space", retry);
  onKeyPress("enter", retry);
  // small delay so a death-touch doesn't instantly restart
  wait(0.4, () => {
    onMousePress(retry);
    onTouchStart(retry);
  });
});

go("menu");
