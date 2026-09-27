import { W, H } from "../config.js";
import { COL } from "../palette.js";
import { registerPlayHandler } from "../input.js";
import { addStarfield } from "../world.js";
import { setScreen } from "../screen.js";

export function registerGameoverScene() {
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
}
