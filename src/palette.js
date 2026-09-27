// Colours as raw triples, converted to kaplay Color objects by initPalette().
//
// WHY THE INDIRECTION: kaplay injects rgb() onto globalThis only when
// kaplay({...}) is called. ES module imports are evaluated BEFORE the
// importing module's body runs, so a top-level rgb() here would throw
// "rgb is not defined" at load. COL is exported empty and filled in place.

const RAW = {
  mint: [10, 184, 118],
  mintDark: [6, 122, 82],
  mintLight: [94, 234, 212],
  text: [217, 255, 240],
  wood: [176, 122, 62],
  woodDark: [122, 79, 36],
  spring: [245, 158, 11],
  springDark: [180, 110, 10],
  hole: [167, 139, 250],
  holeSwirl: [196, 181, 253],
  monster: [239, 68, 68],
  monsterDark: [127, 29, 29],
  white: [255, 255, 255],
  dark: [9, 12, 11],
  danger: [255, 107, 107],
  cheek: [255, 170, 190],
  blood: [190, 30, 34],
};

/** Filled by initPalette(). Empty until then — never read at module scope. */
export const COL = {};

/** Call once, immediately after kaplay({...}). Idempotent. */
export function initPalette() {
  for (const [key, [r, g, b]] of Object.entries(RAW)) {
    COL[key] = rgb(r, g, b);
  }
}
