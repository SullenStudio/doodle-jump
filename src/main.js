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
  PLAYER_HP,
  INVULN_TIME,
} from "./config.js";
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

// -------------------------------------------------------------- decorators --
// parallax starfield, fixed to the screen but drifting with the camera
function addStarfield() {
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
      star.pos.y =
        (((star.by + camY * star.f) % (H + 60)) + H + 60) % (H + 60) - 30;
    });
  }
}

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
  let prevX = W / 2;
  let nextY = 0; // set below, after the base platform

  // ------------------------------------------------------------ player ---
  const player = createPlayer();
  const pupils = player.pupils;
  const ghosts = createGhosts(player);

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

  // ---------------------------------------------------------- platforms ---
  function addPlatform(x, y, kind) {
    const p = add([
      rect(PLAT_W, PLAT_H, { radius: 8 }),
      pos(x, y),
      anchor("center"),
      color(
        kind === "moving"
          ? COL.mintLight
          : kind === "breakable"
            ? COL.wood
            : COL.mint,
      ),
      outline(
        3,
        kind === "moving"
          ? COL.mint
          : kind === "breakable"
            ? COL.woodDark
            : COL.mintDark,
      ),
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
      p.add([
        rect(2.5, PLAT_H - 6),
        pos(-12, 0),
        anchor("center"),
        rotate(18),
        color(COL.woodDark),
      ]);
      p.add([
        rect(2.5, PLAT_H - 8),
        pos(9, 0),
        anchor("center"),
        rotate(-14),
        color(COL.woodDark),
      ]);
    } else if (kind === "spring") {
      p.add([rect(6, 8), pos(0, -12), anchor("center"), color(COL.spring)]);
      p.add([
        rect(24, 6, { radius: 3 }),
        pos(0, -18),
        anchor("center"),
        color(COL.spring),
        outline(2, COL.springDark),
      ]);
    }

    p.onUpdate(() => {
      if (p.broken) {
        // falls away after one bounce
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

  // ------------------------------------------------------------ hazards ---
  function addHazard(x, y) {
    if (rand() < 0.5) {
      // black hole: pulls the jumper in, ends the run on touch
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
        if (!dead && hole.pos.dist(player.pos) < 150) {
          player.pos = player.pos.lerp(hole.pos, 0.55 * DT());
        }
      });
    } else {
      // monster: drifts side to side, ends the run on touch
      const m = add([
        circle(24),
        pos(x, y),
        anchor("center"),
        color(COL.monster),
        outline(3, COL.monsterDark),
        area(),
        z(2),
        "hazard",
        {
          baseX: x,
          baseY: y,
          t: rand(0, 6),
          amp: rand(40, 100),
          spd: rand(0.9, 1.7),
        },
      ]);
      m.add([circle(6), pos(-9, -6), color(COL.white)]);
      m.add([circle(6), pos(9, -6), color(COL.white)]);
      m.add([circle(3), pos(-9, -6), color(COL.dark)]);
      m.add([circle(3), pos(9, -6), color(COL.dark)]);
      m.add([rect(6, 8), pos(-8, 12), color(COL.white)]);
      m.add([rect(6, 8), pos(2, 12), color(COL.white)]);
      m.add([rect(6, 10), pos(-10, -26), rotate(-20), color(COL.monsterDark)]);
      m.add([rect(6, 10), pos(4, -26), rotate(20), color(COL.monsterDark)]);
      m.onUpdate(() => {
        m.t += DT();
        m.pos.x = clamp(m.baseX + Math.sin(m.t * m.spd) * m.amp, 28, W - 28);
        m.pos.y = m.baseY + Math.sin(m.t * 2.3) * 10;
      });
    }
  }

  // --------------------------------------------------------- generation ---
  const altitudeAt = (y) => Math.max(0, START_Y - y);

  function rollKind(a) {
    const r = rand(1);
    const pSpring = a < 250 ? 0 : 0.09;
    const pMoving = a < 500 ? 0 : Math.min(0.38, 0.06 + a / 16000);
    const pBreak = a < 1100 ? 0 : Math.min(0.3, 0.04 + a / 18000);
    if (r < pSpring) return "spring";
    if (r < pSpring + pMoving) return "moving";
    if (r < pSpring + pMoving + pBreak) return "breakable";
    return "normal";
  }

  function pickX(a) {
    const maxDx = Math.min(250, 140 + a / 90);
    let x = prevX + rand(-maxDx, maxDx);
    const lo = 50;
    const hi = W - 50;
    while (x < lo) x += hi - lo;
    while (x > hi) x -= hi - lo;
    return x;
  }

  function spawnRow(y) {
    const a = altitudeAt(y);
    const kind = rollKind(a);
    const x = pickX(a);
    const p = addPlatform(x, y, kind);
    if (kind === "moving") p.speed = 90 + Math.min(130, a / 150) + rand(-15, 15);
    prevX = x;

    // an extra easy platform low down
    if (a < 1600 && rand() < 0.28) {
      const x2 = rand(60, W - 60);
      let d = Math.abs(x2 - x);
      d = Math.min(d, W - d);
      if (d > 150) addPlatform(x2, y + rand(-10, 10), "normal");
    }

    // hazards appear at altitude
    if (a > 2200) {
      const chance = Math.min(0.14, 0.03 + (a - 2200) / 22000);
      if (rand() < chance) addHazard(rand(50, W - 50), y - rand(80, 160));
    }
  }

  function ensurePlatforms() {
    const camTop = camPos().y - H / 2;
    while (nextY > camTop - 140) {
      spawnRow(nextY);
      const a = altitudeAt(nextY);
      const gapMax = Math.min(150, 84 + a / 120);
      nextY -= rand(52, gapMax);
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

    ensurePlatforms();

    // recycle what fell far below the camera
    const killY = camPos().y + H / 2 + 140;
    for (const p of get("platform")) if (p.pos.y > killY) destroy(p);
    for (const hz of get("hazard")) if (hz.pos.y > killY) destroy(hz);

    // fell below the screen
    if (player.pos.y - PLAYER_R > camPos().y + H / 2 + 60) endRun();
  });

  // -------------------------------------------------------------- start ---
  addPlatform(W / 2, 880, "normal"); // base platform under the jumper
  nextY = 880 - rand(60, 80);
  ensurePlatforms();
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
