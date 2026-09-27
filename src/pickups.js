import { DROP } from "./config.js";
import { DT } from "./frame.js";
import { COL } from "./palette.js";

// All three rolls are parameters so this stays pure. At most one pickup per
// platform; ammo is checked first so it wins ties.
export function rollPlatformPickup(alt, rCrate, rMed, rWeapon) {
  if (rCrate < DROP.crateChance) return "ammo";
  if (rMed < DROP.medkitChance) return "medkit";
  // Weapons are rare and only above the first interval, so the opening climb
  // is always played with the sidearm.
  if (alt > DROP.weaponEveryPx) {
    const perPlatform = 1 / (DROP.weaponEveryPx / 90); // ~90px between platforms
    if (rWeapon < perPlatform) return "weapon";
  }
  return null;
}

export function addPickup(kind, x, y) {
  const amount =
    kind === "ammo" ? DROP.crateAmmo : kind === "medkit" ? DROP.medkitHeal : 0;

  const body =
    kind === "medkit"
      ? [rect(20, 20, { radius: 4 }), color(COL.white), outline(2, COL.danger)]
      : kind === "weapon"
        ? [rect(30, 12, { radius: 3 }), color(COL.springDark), outline(2, COL.spring)]
        : [rect(20, 14, { radius: 3 }), color(COL.springDark), outline(2, COL.spring)];

  const p = add([
    ...body,
    pos(x, y),
    anchor("center"),
    area(),
    z(2),
    "pickup",
    { kind, amount, t: rand(0, 6) },
  ]);

  if (kind === "medkit") {
    p.add([rect(12, 4), pos(0, 0), anchor("center"), color(COL.danger)]);
    p.add([rect(4, 12), pos(0, 0), anchor("center"), color(COL.danger)]);
  } else if (kind === "weapon") {
    p.add([rect(8, 8), pos(-6, 8), anchor("center"), color(COL.spring)]);
  }

  p.onUpdate(() => {
    p.t += DT();
    p.pos.y += Math.sin(p.t * 3) * 6 * DT();
  });

  return p;
}

/** r and amountRoll are 0..1 parameters so callers control randomness. */
export function dropFromDemon(demon, r, amountRoll) {
  if (r >= DROP.gruntAmmoChance) return null;
  const span = DROP.gruntAmmoMax - DROP.gruntAmmoMin;
  const amount = DROP.gruntAmmoMin + Math.round(amountRoll * span);
  const p = addPickup("ammo", demon.pos.x, demon.pos.y);
  p.amount = amount;
  return p;
}
