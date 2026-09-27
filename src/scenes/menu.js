import { W, H, PLAYER_R, PLAT_W, PLAT_H } from "../config.js";
import { COL } from "../palette.js";
import { registerPlayHandler } from "../input.js";
import { addFace } from "../player.js";
import { addStarfield } from "../world.js";
import { getBest } from "../best.js";
import { setScreen } from "../screen.js";

export function registerMenuScene() {
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
      text("arrows / A D to steer", { size: 16 }),
      pos(W / 2, 764),
      anchor("center"),
      color(COL.text),
      opacity(0.55),
    ]);
    add([
      text("mouse or SPACE to shoot downward", { size: 16 }),
      pos(W / 2, 790),
      anchor("center"),
      color(COL.text),
      opacity(0.55),
    ]);
    add([
      text("on phone use the buttons below", { size: 16 }),
      pos(W / 2, 816),
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
}
