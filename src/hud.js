import { W, H } from "./config.js";
import { COL } from "./palette.js";

const BAR_H = 76;
const BAR_TOP = H - BAR_H;

// Health bands for the portrait. The "face reflects health" idea is a genre
// convention; this face is our own mint blob, not anyone else's character.
export function faceState(hp) {
  if (hp <= 0) return "dead";
  if (hp < 25) return "bloodied";
  if (hp < 50) return "angry";
  if (hp < 75) return "grim";
  return "calm";
}

export function createHud() {
  // Semi-transparent so rising demons stay visible behind the bar; an opaque
  // bar would hide the threat the player most needs to see.
  add([
    rect(W, BAR_H),
    pos(0, BAR_TOP),
    color(COL.dark),
    opacity(0.82),
    fixed(),
    z(20),
  ]);
  add([rect(W, 2), pos(0, BAR_TOP), color(COL.mintDark), fixed(), z(21)]);

  const label = (str, x, y, size, col) =>
    add([
      text(str, { size }),
      pos(x, y),
      anchor("center"),
      color(col),
      fixed(),
      z(22),
    ]);

  label("HEALTH", 62, BAR_TOP + 18, 13, COL.mint);
  label("ALT", 292, BAR_TOP + 18, 13, COL.mint);
  label("AMMO", 448, BAR_TOP + 18, 13, COL.mint);

  const hpValue = label("100", 62, BAR_TOP + 46, 30, COL.text);
  const altValue = label("0m", 292, BAR_TOP + 46, 30, COL.text);
  const ammoValue = label("--", 448, BAR_TOP + 44, 28, COL.text);
  const weaponName = label("SIDEARM", 448, BAR_TOP + 66, 11, COL.spring);

  // ------------------------------------------------------------ portrait --
  const portrait = add([
    circle(24),
    pos(172, BAR_TOP + 40),
    color(COL.mint),
    outline(3, COL.mintDark),
    fixed(),
    z(22),
  ]);

  let drawn = null;
  const parts = [];

  function drawFace(state) {
    if (state === drawn) return;
    drawn = state;
    for (const p of parts) destroy(p);
    parts.length = 0;

    const push = (...comps) => {
      const e = portrait.add(comps);
      parts.push(e);
      return e;
    };

    const browTilt = { calm: 0, grim: 8, angry: 18, bloodied: 24, dead: 0 };
    const mouth = {
      calm: [10, 3, COL.mintDark],
      grim: [12, 3, COL.mintDark],
      angry: [16, 4, COL.monsterDark],
      bloodied: [18, 5, COL.blood],
      dead: [14, 4, COL.dark],
    };

    // eyes
    push(circle(6), pos(-8, -6), color(COL.white));
    push(circle(6), pos(8, -6), color(COL.white));
    if (state === "dead") {
      // X eyes
      push(rect(12, 2.5), pos(-8, -6), anchor("center"), rotate(40), color(COL.dark));
      push(rect(12, 2.5), pos(-8, -6), anchor("center"), rotate(-40), color(COL.dark));
      push(rect(12, 2.5), pos(8, -6), anchor("center"), rotate(40), color(COL.dark));
      push(rect(12, 2.5), pos(8, -6), anchor("center"), rotate(-40), color(COL.dark));
    } else {
      push(circle(3), pos(-8, -6), color(COL.dark));
      push(circle(3), pos(8, -6), color(COL.dark));
      // brows get angrier as health drops
      const t = browTilt[state];
      push(rect(11, 3), pos(-8, -14), anchor("center"), rotate(t), color(COL.mintDark));
      push(rect(11, 3), pos(8, -14), anchor("center"), rotate(-t), color(COL.mintDark));
    }

    const [mw, mh, mc] = mouth[state];
    push(rect(mw, mh, { radius: 1.5 }), pos(0, 8), anchor("center"), color(mc));

    // wounds accumulate
    if (state === "angry" || state === "bloodied" || state === "dead") {
      push(rect(10, 2.5), pos(-13, 2), anchor("center"), rotate(28), color(COL.blood));
    }
    if (state === "bloodied" || state === "dead") {
      push(rect(12, 2.5), pos(12, -1), anchor("center"), rotate(-34), color(COL.blood));
      push(circle(2.5), pos(6, 14), color(COL.blood));
      push(circle(2), pos(-4, 15), color(COL.blood));
    }
  }

  drawFace("calm");

  return {
    update({ hp, ammo, weaponName: wname, altitude }) {
      hpValue.text = String(Math.max(0, Math.round(hp)));
      hpValue.color = hp < 25 ? COL.danger : COL.text;
      altValue.text = `${altitude}m`;
      ammoValue.text = ammo === Infinity ? "∞" : String(ammo);
      weaponName.text = wname;
      drawFace(faceState(hp));
    },
  };
}
