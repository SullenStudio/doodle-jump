# Weapons, Recoil and Demon Horde — Implementation Plan (Phase 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the Mint Jump vertical climber into a climber/boomer-shooter hybrid where firing downward both kills a horde chasing from below and boosts the player upward.

**Architecture:** Split the single 738-line `src/main.js` into focused modules (config, palette, input, player, weapons, demons, pickups, world, hud, audio) while `main.js` keeps only kaplay bootstrap and scene wiring. Every module exposes pure, kaplay-free helper functions for its decision logic (recoil math, damage state machine, steering priority, spawn curves) so they can be unit-tested under vitest without a browser or a canvas.

**Tech Stack:** Vite 6, Kaplay 3001.0.19, vanilla JS (ES modules), vitest (added in Task 1), WebAudio (no external assets).

## Global Constraints

These apply to **every** task. Do not violate them even if a task's steps don't repeat them.

- **CRITICAL — kaplay globals do not exist at module import time.** `kaplay({...})` injects `rgb`, `vec2`, `add`, `rand`, `dt` etc. onto `globalThis`. This was verified: before `kaplay()` runs, `typeof globalThis.rgb === "undefined"`. ES module imports are evaluated **before** the importing module's body runs. Therefore **no module may call a kaplay global at top level.** Only call them inside function bodies that run after `main.js` has invoked `kaplay()`. Violating this crashes the game on load with `rgb is not defined`.
- **Recoil invariant:** every weapon must satisfy `impulse / cooldown < GRAVITY` (2600 px/s²). This is what makes sustained flight impossible regardless of ammo. Any new weapon must obey it.
- **Zero external assets.** All graphics are kaplay primitive shapes; all audio is WebAudio synthesis. Do not add image, font, or sound files.
- **Copyright:** no Doom/id Software names, fonts, character designs, or assets. Weapon names are `SIDEARM` and `SCATTERGUN`; the enemy is `GRUNT`. Do not rename them to id Software terms.
- **Do not rename the game.** It stays `Mint Jump` in Phase 1. Renaming is a Phase 2 decision.
- **Pure helpers must stay kaplay-free.** Any function that a vitest test imports must not reference kaplay globals — take randomness and time as parameters instead.
- **The game must run after every task.** Run `npm run build` before each commit; it must succeed.
- Coordinate system: `y` grows **downward**. Upward velocity is **negative**. Recoil makes `vel.y` more negative.

---

### Task 1: Test harness, config and palette

Extracts every tuning constant and colour into kaplay-free modules and installs vitest. No gameplay change — the game must look and play identically after this task.

**Files:**
- Modify: `package.json` (add vitest + `test` script)
- Create: `vitest.config.js`
- Create: `src/config.js`
- Create: `src/palette.js`
- Modify: `src/main.js` (delete the inline `// tuning` and `// palette` blocks at lines 59-92, import from the new modules, call `initPalette()`)
- Test: `test/config.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `src/config.js` — named exports: `W`, `H`, `GRAVITY`, `JUMP_VEL`, `SPRING_VEL`, `MOVE_SPEED`, `PLAYER_R`, `PLAT_W`, `PLAT_H`, `START_Y`, `BEST_KEY`, `RECOIL_CAP`, `BULLET_SPEED`, `PLAYER_HP`, `INVULN_TIME`, `WEAPONS`, `GRUNT`, `HORDE`, `DROP`.
  - `src/palette.js` — named exports `COL` (object, empty until initialised) and `initPalette()` (fills `COL` in place; safe to call more than once).

- [ ] **Step 1: Install vitest**

```bash
npm install --save-dev vitest
```

- [ ] **Step 2: Add the test script**

In `package.json`, add to `"scripts"`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Create `vitest.config.js`**

```js
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.js"],
  },
});
```

- [ ] **Step 4: Write the failing test**

Create `test/config.test.js`:

```js
import { describe, it, expect } from "vitest";
import { WEAPONS, GRAVITY, RECOIL_CAP, JUMP_VEL } from "../src/config.js";

describe("weapon table", () => {
  it("defines sidearm and scattergun", () => {
    expect(Object.keys(WEAPONS).sort()).toEqual(["scattergun", "sidearm"]);
  });

  // The core balance invariant: continuous fire must accelerate the player
  // upward LESS than gravity pulls them down, so sustained flight is
  // impossible no matter how much ammo they have.
  it("every weapon obeys impulse/cooldown < GRAVITY", () => {
    for (const [id, w] of Object.entries(WEAPONS)) {
      const upwardAccel = w.impulse / w.cooldown;
      expect(upwardAccel, `${id} would allow sustained flight`).toBeLessThan(
        GRAVITY,
      );
    }
  });

  it("sidearm has infinite ammo, scattergun does not", () => {
    expect(WEAPONS.sidearm.ammo).toBe(Infinity);
    expect(WEAPONS.scattergun.ammo).toBe(24);
  });

  it("recoil cap sits above jump velocity so a big shot feels powerful", () => {
    expect(RECOIL_CAP).toBeGreaterThan(JUMP_VEL);
  });
});
```

- [ ] **Step 5: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot resolve `../src/config.js`.

- [ ] **Step 6: Create `src/config.js`**

Pure numbers only. **No kaplay globals** — this file is imported by tests that run in plain node.

```js
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
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `npm test`
Expected: PASS, 4 tests.

- [ ] **Step 8: Create `src/palette.js`**

**This is the kaplay-globals trap.** `COL` must start empty and be filled by `initPalette()` after `kaplay()` has run. Do not write `rgb(...)` at top level.

```js
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
```

- [ ] **Step 9: Rewire `src/main.js`**

Delete the whole `// ---- tuning ---` block (the `const W` through `const BEST_KEY` lines) and the whole `const COL = {...}` block. Add at the top of the file, after `import "./mobile.css";`:

```js
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
} from "./config.js";
import { COL, initPalette } from "./palette.js";
```

Then immediately after the `kaplay({...})` call and before anything else, add:

```js
initPalette();
```

- [ ] **Step 10: Verify the game still builds and runs**

Run: `npm run build`
Expected: build succeeds.

Run `npm run dev`, open the page. Expected: the menu appears with the bouncing mint blob, exactly as before. Play one run — platforms, springs, monsters, scoring all behave as before. If the console shows `rgb is not defined`, `initPalette()` is being called too late or a module calls a kaplay global at top level.

- [ ] **Step 11: Commit**

```bash
git add package.json package-lock.json vitest.config.js src/config.js src/palette.js src/main.js test/config.test.js
git commit -m "refactor: extract config and palette modules, add vitest

Palette is filled lazily by initPalette() because kaplay only injects
rgb() onto globalThis when kaplay() is called, which happens after ES
module imports are evaluated.

Adds the balance invariant test: impulse/cooldown < GRAVITY."
```

---

### Task 2: Input rewrite — remove swipe, add fire

Fixes the `swipeDir` bug by deleting the swipe path, moves desktop mouse from steering to firing, and adds the phone fire button. After this task firing input is *readable* but nothing shoots yet.

**Files:**
- Create: `src/input.js`
- Test: `test/input.test.js`
- Modify: `index.html` (the `#steer` button row)
- Modify: `src/mobile.css` (three-column steer grid)
- Modify: `src/main.js` (delete lines 15-47 input block and the `steerDir()`/touch handlers inside the `game` scene; call `initInput()`)

**Interfaces:**
- Consumes: `W` from `src/config.js`.
- Produces: `src/input.js` — named exports:
  - `resolveSteer({ keyLeft, keyRight, padDir, touchDir }) -> -1 | 0 | 1` (pure)
  - `initInput()` — attaches DOM listeners once; safe to call more than once
  - `registerPlayHandler(fn)` — what the PLAY/AGAIN button calls
  - `steerDir() -> -1 | 0 | 1` — reads live kaplay + DOM state
  - `fireDown() -> boolean`
  - `resetInput()` — clears held state between runs
  - `bindSceneTouch()` — wires kaplay touch handlers for the current scene; call inside the `game` scene

- [ ] **Step 1: Write the failing test**

Create `test/input.test.js`:

```js
import { describe, it, expect } from "vitest";
import { resolveSteer } from "../src/input.js";

const S = (o) => resolveSteer({ keyLeft: false, keyRight: false, padDir: 0, touchDir: 0, ...o });

describe("resolveSteer", () => {
  it("returns 0 with no input", () => {
    expect(S({})).toBe(0);
  });

  it("reads the keyboard", () => {
    expect(S({ keyLeft: true })).toBe(-1);
    expect(S({ keyRight: true })).toBe(1);
  });

  it("cancels opposing keys", () => {
    expect(S({ keyLeft: true, keyRight: true })).toBe(0);
  });

  // This is the regression that motivated the rewrite: in the old code a
  // stale swipeDir was checked AFTER the keyboard and overwrote it, so one
  // mouse drag killed keyboard steering for the rest of the run.
  it("never lets a lower-priority source override live keyboard input", () => {
    expect(S({ keyLeft: true, padDir: 1, touchDir: 1 })).toBe(-1);
    expect(S({ keyRight: true, padDir: -1, touchDir: -1 })).toBe(1);
  });

  it("falls back to the on-screen buttons when no key is held", () => {
    expect(S({ padDir: -1, touchDir: 1 })).toBe(-1);
  });

  it("falls back to canvas hold last", () => {
    expect(S({ touchDir: 1 })).toBe(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot resolve `../src/input.js`.

- [ ] **Step 3: Create `src/input.js`**

```js
import { W } from "./config.js";

// Steering priority is strictly linear and never overwrites a live source.
// The previous implementation checked a sticky swipe direction AFTER the
// keyboard and clobbered it, which is why swipe steering was removed.
export function resolveSteer({ keyLeft, keyRight, padDir, touchDir }) {
  let d = 0;
  if (keyLeft) d -= 1;
  if (keyRight) d += 1;
  if (d !== 0) return d; // live keyboard wins outright
  if (padDir !== 0) return padDir; // then the on-screen buttons
  if (touchDir !== 0) return touchDir; // then holding a half of the canvas
  return 0;
}

let padDir = 0;
let padFire = false;
let mouseFire = false;
let playHandler = null;
let touchDir = 0;
let wired = false;
const activeTouches = new Map(); // identifier -> { x }

export function registerPlayHandler(fn) {
  playHandler = fn;
}

export function resetInput() {
  padDir = 0;
  padFire = false;
  mouseFire = false;
  touchDir = 0;
  activeTouches.clear();
}

export function initInput() {
  if (wired) return;
  wired = true;

  const steer = document.getElementById("steer");

  steer?.addEventListener("pointerdown", (e) => {
    const btn = e.target.closest("[data-dir], [data-fire]");
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    if (btn.dataset.fire !== undefined) padFire = true;
    else padDir = Number(btn.dataset.dir);
  });

  const release = () => {
    padDir = 0;
    padFire = false;
  };
  steer?.addEventListener("pointerup", release);
  steer?.addEventListener("pointercancel", release);
  steer?.addEventListener("pointerleave", release);
  window.addEventListener("pointerup", release);

  document.getElementById("btn-play")?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    playHandler?.();
  });
}

// Holding a half of the canvas steers. Registered per-scene because kaplay
// clears its event handlers on scene change.
export function bindSceneTouch() {
  const recalc = () => {
    if (activeTouches.size === 0) {
      touchDir = 0;
      return;
    }
    let sum = 0;
    for (const t of activeTouches.values()) sum += t.x < W / 2 ? -1 : 1;
    touchDir = Math.sign(sum);
  };
  onTouchStart((p, t) => {
    activeTouches.set(t.identifier, { x: p.x });
    recalc();
  });
  onTouchMove((p, t) => {
    const e = activeTouches.get(t.identifier);
    if (e) {
      e.x = p.x;
      recalc();
    }
  });
  onTouchEnd((p, t) => {
    activeTouches.delete(t.identifier);
    recalc();
  });
}

export function steerDir() {
  return resolveSteer({
    keyLeft: isKeyDown("left") || isKeyDown("a"),
    keyRight: isKeyDown("right") || isKeyDown("d"),
    padDir,
    touchDir,
  });
}

export function fireDown() {
  // Desktop: mouse or space. Phone: the [FIRE] button.
  // Mouse no longer steers — that branch was removed to free it for firing.
  return padFire || isKeyDown("space") || isMouseDown("left");
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`
Expected: PASS — 6 input tests plus the 4 config tests.

- [ ] **Step 5: Add the fire button to `index.html`**

Replace the `<div id="steer">` block with:

```html
        <div id="steer">
          <button type="button" data-dir="-1" aria-label="Left">◀</button>
          <button type="button" data-fire aria-label="Fire" class="fire">FIRE</button>
          <button type="button" data-dir="1" aria-label="Right">▶</button>
        </div>
```

- [ ] **Step 6: Make the steer row three columns in `src/mobile.css`**

Replace the `#steer` rule and add a `.fire` rule:

```css
#steer {
  display: grid;
  grid-template-columns: 1fr 1.2fr 1fr;
  gap: 10px;
}

#steer button.fire {
  border-color: #7a2418;
  background: #3a1008;
  color: #ffd9c9;
  letter-spacing: 0.1em;
}
```

- [ ] **Step 7: Rewire `src/main.js`**

Delete the entire input block near the top of the file — the `let padDir`, `let swipeDir`, `let playHandler`, `let swipeStart` declarations and every listener through the `btn-play` click handler. Add to the imports:

```js
import {
  initInput,
  registerPlayHandler,
  resetInput,
  bindSceneTouch,
  steerDir,
  fireDown,
} from "./input.js";
```

Call `initInput();` right after `initPalette();`.

In the `menu` and `gameover` scenes, replace `playHandler = start;` / `playHandler = retry;` with `registerPlayHandler(start);` / `registerPlayHandler(retry);`.

In the `game` scene: delete `padDir = 0; swipeDir = 0;`, the `activeTouches` map, `touchDir`, `recalcTouchDir()`, the three `onTouch*` handlers and the local `steerDir()` function. Replace them with:

```js
  resetInput();
  bindSceneTouch();
```

The `player.onUpdate` callback already calls `steerDir()`; it now resolves to the imported one. The local `phone` constant is no longer used by steering — keep it, it still drives the `phone` CSS class.

- [ ] **Step 8: Verify the regression is actually gone**

Run `npm run dev`. On desktop: drag the mouse across the canvas, release, then steer with the arrow keys. Expected: **keys still work.** Before this task, that drag permanently hijacked steering.

Also confirm holding the left mouse button no longer steers.

- [ ] **Step 9: Verify the build**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 10: Commit**

```bash
git add src/input.js test/input.test.js src/main.js index.html src/mobile.css
git commit -m "fix: rewrite input, drop sticky swipe steering

swipeDir was set on pointerup and never cleared, and steerDir() checked
it after the keyboard, so a single drag disabled keyboard steering for
the rest of the run. Swipe steering is removed entirely; it also could
not coexist with tap-to-fire.

Desktop mouse moves from steering to firing. Phone gains a [FIRE]
button between the steer buttons."
```

---

### Task 3: Player module with health and i-frames

Extracts the player and its face into a module and gives it the HP state machine. After this task the black hole and the existing red monster deal damage instead of killing instantly, and the player dies at 0 HP.

**Files:**
- Create: `src/player.js`
- Test: `test/player.test.js`
- Modify: `src/main.js` (remove `addFace`, remove the inline player/ghost setup, rewire the hazard collision)

**Interfaces:**
- Consumes: `COL` from `src/palette.js`; `PLAYER_R`, `PLAYER_HP`, `INVULN_TIME`, `START_Y`, `W`, `JUMP_VEL` from `src/config.js`.
- Produces: `src/player.js` — named exports:
  - `applyDamage(state, amount, now) -> { hp, invulnUntil, dead }` (pure)
  - `addFace(entity) -> { pl, pr }` — attaches eyes/smile/cheeks, returns the pupils
  - `createPlayer() -> entity` — the kaplay entity, tagged `"player"`, with extra members `hp`, `invulnUntil`, `pupils`, `hurt(amount, now)`, `heal(amount)`, `isInvuln(now)`
  - `createGhosts(player) -> { update() }` — the wrap-seam mirror copies

- [ ] **Step 1: Write the failing test**

Create `test/player.test.js`:

```js
import { describe, it, expect } from "vitest";
import { applyDamage } from "../src/player.js";
import { PLAYER_HP, INVULN_TIME } from "../src/config.js";

const fresh = () => ({ hp: PLAYER_HP, invulnUntil: 0, dead: false });

describe("applyDamage", () => {
  it("subtracts damage and opens an i-frame window", () => {
    const s = applyDamage(fresh(), 25, 10);
    expect(s.hp).toBe(75);
    expect(s.invulnUntil).toBeCloseTo(10 + INVULN_TIME);
    expect(s.dead).toBe(false);
  });

  it("ignores hits taken during i-frames", () => {
    const first = applyDamage(fresh(), 25, 10);
    const second = applyDamage(first, 25, 10.3); // still invulnerable
    expect(second.hp).toBe(75);
    expect(second).toBe(first); // unchanged state is returned as-is
  });

  it("accepts a hit once i-frames expire", () => {
    const first = applyDamage(fresh(), 25, 10);
    const second = applyDamage(first, 25, 10 + INVULN_TIME + 0.01);
    expect(second.hp).toBe(50);
  });

  it("clamps hp at zero and marks dead", () => {
    const s = applyDamage({ hp: 10, invulnUntil: 0, dead: false }, 25, 5);
    expect(s.hp).toBe(0);
    expect(s.dead).toBe(true);
  });

  it("four grunt hits kill a full-health player", () => {
    let s = fresh();
    for (let i = 0; i < 4; i++) s = applyDamage(s, 25, i * (INVULN_TIME + 0.1));
    expect(s.hp).toBe(0);
    expect(s.dead).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot resolve `../src/player.js`.

- [ ] **Step 3: Create `src/player.js`**

```js
import { COL } from "./palette.js";
import { PLAYER_R, PLAYER_HP, INVULN_TIME, START_Y, W, JUMP_VEL } from "./config.js";

// Pure damage state machine. Time is a parameter so this is testable without
// kaplay. Returns the SAME object when the hit is absorbed by i-frames, which
// lets callers cheaply detect "nothing happened".
export function applyDamage(state, amount, now) {
  if (now < state.invulnUntil) return state;
  const hp = Math.max(0, state.hp - amount);
  return { hp, invulnUntil: now + INVULN_TIME, dead: hp <= 0 };
}

// Eyes / pupils / smile / cheeks. Shared by the menu blob and the player.
export function addFace(blob) {
  blob.add([circle(6), pos(-8, -7), color(COL.white)]);
  blob.add([circle(6), pos(8, -7), color(COL.white)]);
  const pl = blob.add([circle(2.8), pos(-8, -7), color(COL.dark)]);
  const pr = blob.add([circle(2.8), pos(8, -7), color(COL.dark)]);
  blob.add([rect(10, 3, { radius: 1.5 }), pos(0, 6), anchor("center"), color(COL.mintDark)]);
  blob.add([circle(2.5), pos(-14, 1), color(COL.cheek), opacity(0.7)]);
  blob.add([circle(2.5), pos(14, 1), color(COL.cheek), opacity(0.7)]);
  return { pl, pr };
}

export function createPlayer() {
  const player = add([
    circle(PLAYER_R),
    pos(W / 2, START_Y),
    color(COL.mint),
    outline(3, COL.mintDark),
    area(),
    body({ maxVelocity: 1700 }),
    scale(1),
    rotate(0),
    z(3),
    "player",
    {
      hp: PLAYER_HP,
      invulnUntil: 0,
      dead: false,
    },
  ]);

  player.pupils = addFace(player);
  player.vel = vec2(0, -JUMP_VEL);

  player.isInvuln = (now) => now < player.invulnUntil;

  /** Returns true if the hit landed, false if absorbed by i-frames. */
  player.hurt = (amount, now) => {
    const next = applyDamage(
      { hp: player.hp, invulnUntil: player.invulnUntil, dead: player.dead },
      amount,
      now,
    );
    if (next.hp === player.hp && next.invulnUntil === player.invulnUntil) return false;
    player.hp = next.hp;
    player.invulnUntil = next.invulnUntil;
    player.dead = next.dead;
    return true;
  };

  player.heal = (amount) => {
    player.hp = Math.min(PLAYER_HP, player.hp + amount);
  };

  return player;
}

// Mirror copies either side of the wrap seam so the blob stays visible while
// crossing a screen edge.
export function createGhosts(player) {
  const comps = () => [
    circle(PLAYER_R),
    pos(-100, -100),
    color(COL.mint),
    outline(3, COL.mintDark),
    opacity(0.9),
    rotate(0),
    z(3),
  ];
  const ghostL = add(comps());
  const ghostR = add(comps());
  return {
    update() {
      ghostL.pos = vec2(player.pos.x - W, player.pos.y);
      ghostR.pos = vec2(player.pos.x + W, player.pos.y);
      ghostL.angle = ghostR.angle = player.angle;
      const vis = player.dead ? 0 : player.isInvuln(time()) ? 0.35 : 0.9;
      ghostL.opacity = ghostR.opacity = vis;
    },
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`
Expected: PASS — 5 player tests added.

- [ ] **Step 5: Rewire `src/main.js`**

Delete the module-level `addFace` function and, in the `game` scene, the inline `const player = add([...])`, `const pupils = addFace(player)`, `player.vel = ...`, `ghostComps`, `ghostL`, `ghostR`.

Add to the imports:

```js
import { createPlayer, createGhosts, addFace } from "./player.js";
import { PLAYER_HP, INVULN_TIME } from "./config.js";
```

In the `game` scene, replace the deleted block with:

```js
  const player = createPlayer();
  const pupils = player.pupils;
  const ghosts = createGhosts(player);
```

In the scene's `onUpdate`, replace the four ghost lines with `ghosts.update();`.

The `menu` scene still calls `addFace(blob)` — it now uses the imported one, no change needed there.

- [ ] **Step 6: Add a single writer for the death flag**

The `game` scene tracks death in a local `let dead = false`, but `src/player.js`
(ghost opacity) and later `src/world.js` (black hole pull) read `player.dead`.
Two flags that can disagree means a black hole would keep dragging a corpse
around. Add one writer just below `let dead = false;` in the `game` scene:

```js
  // Single writer for death: the scene reads `dead`, but player.js and
  // world.js read player.dead. They must never disagree.
  function markDead() {
    dead = true;
    player.dead = true;
  }
```

Note: `markDead` must be declared **after** `const player = createPlayer();`
so it closes over a defined `player`. Function declarations hoist, but the
body only runs on call, so placing it anywhere inside the scene works — put it
directly under the `player` creation for readability.

From here on, **never assign `dead = true` directly** — always call `markDead()`.

Also make the fall-off-the-bottom path mark death. Change the first line of
`endRun()` to call it, since that path currently calls `endRun()` without
setting any flag:

```js
  function endRun() {
    markDead();
    const score = Math.floor(maxAlt / 50);
    // ...rest unchanged
  }
```

- [ ] **Step 7: Make hazards deal damage instead of instant death**

Replace the whole `player.onCollide("hazard", ...)` handler with:

```js
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
    if (!player.hurt(25, time())) return; // absorbed by i-frames
    shake(6);
    const away = Math.sign(player.pos.x - hz.pos.x) || 1;
    player.vel.x = away * 380;
    player.vel.y = Math.min(player.vel.y, -420);
    if (player.hp <= 0) {
      markDead();
      shake(16);
      wait(0.4, endRun);
    }
  });
```

- [ ] **Step 8: Mark black holes as instant kills**

In `addHazard`, add `instantKill: true` to the black hole's custom-properties object (the one that currently reads `{ t: rand(0, 6) }`), so it becomes `{ t: rand(0, 6), instantKill: true }`. Leave the monster's property object alone — it defaults to falsy.

- [ ] **Step 9: Add the i-frame blink**

Inside `player.onUpdate`, just after the `squashT` lines, add:

```js
    // blink while invulnerable
    player.opacity = player.isInvuln(time()) ? (Math.floor(time() * 20) % 2 ? 0.35 : 1) : 1;
```

For this to work the player needs an `opacity` component. In `src/player.js`, add `opacity(1),` to the `createPlayer()` component list, right after `scale(1),`.

- [ ] **Step 10: Playtest**

Run `npm run dev`. Climb to ~2200m altitude where hazards appear. Expected: touching a red monster flashes the blob, knocks it sideways, and costs a quarter of its health — it takes four touches to die, not one. Touching a black hole still ends the run immediately.

- [ ] **Step 11: Verify the build and commit**

```bash
npm run build
git add src/player.js test/player.test.js src/main.js
git commit -m "feat: player module with health and i-frames

Monsters now deal 25 damage with 0.8s of i-frames instead of killing
outright. Black holes stay instant kills."
```

---

### Task 4: Weapons — firing downward with recoil

The centrepiece. After this task the player can shoot downward and the recoil lifts them, with the balance invariant enforced by a simulation test. Bullets already carry damage and look for `"demon"` targets; demons arrive in Task 6.

**Files:**
- Create: `src/weapons.js`
- Test: `test/weapons.test.js`
- Modify: `src/main.js` (create the arsenal, drive it from the player update loop)

**Interfaces:**
- Consumes: `WEAPONS`, `RECOIL_CAP`, `BULLET_SPEED`, `PLAYER_R` from `src/config.js`; `COL` from `src/palette.js`. (The test additionally imports `GRAVITY` to check the balance invariant.)
- Produces: `src/weapons.js` — named exports:
  - `applyRecoil(velY, impulse, cap) -> number` (pure)
  - `pelletAngles(pellets, spread) -> number[]` degrees (pure)
  - `selectWeapon(currentId, ammo) -> weaponId` (pure)
  - `createArsenal() -> { current, ammoFor(id), tryFire(player, now), give(id, rounds), update() }`

- [ ] **Step 1: Write the failing test**

Create `test/weapons.test.js`:

```js
import { describe, it, expect } from "vitest";
import { applyRecoil, pelletAngles, selectWeapon } from "../src/weapons.js";
import { WEAPONS, RECOIL_CAP, GRAVITY } from "../src/config.js";

describe("applyRecoil", () => {
  // y grows downward, so upward velocity is negative.
  it("pushes velocity upward", () => {
    expect(applyRecoil(0, 260, RECOIL_CAP)).toBe(-260);
  });

  it("adds to existing upward motion", () => {
    expect(applyRecoil(-300, 260, RECOIL_CAP)).toBe(-560);
  });

  it("clamps at the cap so shots cannot stack without limit", () => {
    expect(applyRecoil(-1400, 700, RECOIL_CAP)).toBe(-RECOIL_CAP);
    expect(applyRecoil(-RECOIL_CAP, 700, RECOIL_CAP)).toBe(-RECOIL_CAP);
  });

  it("arrests a fall", () => {
    expect(applyRecoil(900, 700, RECOIL_CAP)).toBe(200);
  });
});

describe("selectWeapon", () => {
  it("keeps the current weapon while it has ammo", () => {
    expect(selectWeapon("scattergun", { sidearm: Infinity, scattergun: 5 })).toBe("scattergun");
  });

  // Spec requirement: running dry drops you back to the sidearm silently.
  it("falls back to the sidearm at zero ammo", () => {
    expect(selectWeapon("scattergun", { sidearm: Infinity, scattergun: 0 })).toBe("sidearm");
  });

  it("falls back for an unknown weapon id", () => {
    expect(selectWeapon("railgun", { sidearm: Infinity })).toBe("sidearm");
  });

  it("never falls back away from the sidearm itself", () => {
    expect(selectWeapon("sidearm", { sidearm: Infinity })).toBe("sidearm");
  });
});

describe("pelletAngles", () => {
  it("fires a single pellet straight down", () => {
    expect(pelletAngles(1, 0)).toEqual([0]);
  });

  it("spreads pellets evenly across the full cone", () => {
    const a = pelletAngles(5, 22);
    expect(a).toHaveLength(5);
    expect(a[0]).toBeCloseTo(-22);
    expect(a[4]).toBeCloseTo(22);
    expect(a[2]).toBeCloseTo(0);
  });
});

// The invariant that makes the whole design work. Simulating is stronger than
// asserting the ratio, because it proves the player actually falls.
describe("sustained flight is impossible", () => {
  for (const [id, w] of Object.entries(WEAPONS)) {
    it(`${id}: holding fire for 5s still ends up below the start`, () => {
      const step = 1 / 60;
      let y = 0;
      let vy = 0;
      let cd = 0;
      for (let t = 0; t < 5; t += step) {
        cd -= step;
        if (cd <= 0) {
          vy = applyRecoil(vy, w.impulse, RECOIL_CAP);
          cd = w.cooldown;
        }
        vy += GRAVITY * step;
        y += vy * step;
      }
      expect(y, `${id} allowed the player to climb forever`).toBeGreaterThan(0);
    });

    it(`${id}: upward velocity never exceeds the cap`, () => {
      const step = 1 / 60;
      let vy = 0;
      let cd = 0;
      let peak = 0;
      for (let t = 0; t < 5; t += step) {
        cd -= step;
        if (cd <= 0) {
          vy = applyRecoil(vy, w.impulse, RECOIL_CAP);
          cd = w.cooldown;
        }
        vy += GRAVITY * step;
        peak = Math.min(peak, vy);
      }
      expect(Math.abs(peak)).toBeLessThanOrEqual(RECOIL_CAP);
    });
  }
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot resolve `../src/weapons.js`.

- [ ] **Step 3: Create `src/weapons.js`**

```js
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`
Expected: PASS — 14 weapon tests added (2 per weapon in the invariant block, plus 4 for `selectWeapon`).

- [ ] **Step 5: Wire the arsenal into `src/main.js`**

Add to the imports:

```js
import { createArsenal } from "./weapons.js";
```

In the `game` scene, after `const ghosts = createGhosts(player);`:

```js
  const arsenal = createArsenal();
```

Inside `player.onUpdate`, after the steering block and before the squash block:

```js
    // fire straight down; recoil lifts the player
    arsenal.update();
    if (fireDown()) arsenal.tryFire(player, time());
```

- [ ] **Step 6: Clean up bullets that leave the play area**

In the scene's `onUpdate`, alongside the existing platform/hazard recycling lines, add:

```js
    for (const b of get("bullet")) {
      if (b.pos.y > killY || b.pos.y < camPos().y - H) destroy(b);
    }
```

- [ ] **Step 7: Give bullets something to do on impact**

Still in `src/main.js`, inside the `game` scene, add near the other collision handler:

```js
  // Demons arrive in the next task; the handler is here so bullets are
  // already lethal the moment they exist.
  onCollide("bullet", "demon", (b, d) => {
    destroy(b);
    d.hp -= b.damage;
    if (d.hp <= 0) d.die();
  });
```

- [ ] **Step 8: Playtest the feel**

Run `npm run dev`. Hold the left mouse button (or Space) while falling.

Expected:
- A stream of orange pellets shoots downward.
- The fall visibly slows to roughly half speed but **never reverses into a climb**. If you can hover or gain altitude by holding fire, the invariant is broken — re-check `WEAPONS` values against `GRAVITY`.
- On phone, the `[FIRE]` button does the same.

- [ ] **Step 9: Verify the build and commit**

```bash
npm run build
git add src/weapons.js test/weapons.test.js src/main.js
git commit -m "feat: downward firing with recoil lift

Recoil subtracts from vel.y and clamps at RECOIL_CAP. Sustained flight
is impossible because every weapon obeys impulse/cooldown < GRAVITY,
proven by a 5-second simulation test per weapon."
```

---

### Task 5: World module — platforms, generation, starfield

Pure extraction with one behavioural addition: an `onPlatform` callback so Task 7 can drop pickups onto platforms without `world.js` knowing pickups exist.

**Files:**
- Create: `src/world.js`
- Test: `test/world.test.js`
- Modify: `src/main.js` (remove `addStarfield`, `addPlatform`, `addHazard`, `altitudeAt`, `rollKind`, `pickX`, `spawnRow`, `ensurePlatforms`)

**Interfaces:**
- Consumes: `COL` from `src/palette.js`; `W`, `H`, `PLAT_W`, `PLAT_H`, `START_Y`, `GRAVITY` from `src/config.js`.
- Produces: `src/world.js` — named exports:
  - `rollKind(alt, r) -> "spring" | "moving" | "breakable" | "normal"` (pure; `r` is a 0..1 roll)
  - `altitudeAt(y) -> number` (pure)
  - `gapMax(alt) -> number` (pure)
  - `addStarfield()`
  - `createWorld({ player, onPlatform }) -> { start(), ensure(), recycle(killY) }`

  `onPlatform(platform, altitude)` is called once for every platform created. Landing detection stays in `src/main.js` — it needs the player's swept feet position, which is scene state.

- [ ] **Step 1: Write the failing test**

Create `test/world.test.js`:

```js
import { describe, it, expect } from "vitest";
import { rollKind, altitudeAt, gapMax } from "../src/world.js";
import { START_Y } from "../src/config.js";

describe("altitudeAt", () => {
  it("is zero at the spawn height and never negative", () => {
    expect(altitudeAt(START_Y)).toBe(0);
    expect(altitudeAt(START_Y + 500)).toBe(0);
  });

  it("grows as y decreases", () => {
    expect(altitudeAt(START_Y - 300)).toBe(300);
  });
});

describe("rollKind", () => {
  it("only makes normal platforms at the very bottom", () => {
    for (const r of [0, 0.25, 0.5, 0.75, 0.999]) {
      expect(rollKind(0, r)).toBe("normal");
    }
  });

  it("introduces springs above 250", () => {
    expect(rollKind(300, 0.01)).toBe("spring");
    expect(rollKind(200, 0.01)).toBe("normal");
  });

  it("introduces moving platforms above 500", () => {
    expect(rollKind(600, 0.12)).toBe("moving");
    expect(rollKind(400, 0.12)).toBe("normal");
  });

  it("introduces breakable platforms above 1100", () => {
    expect(rollKind(1200, 0.98)).toBe("breakable");
  });

  // If the special-kind probabilities ever summed above 1 the "normal" case
  // would become unreachable and the game would lose its safe platforms.
  it("always leaves room for normal platforms", () => {
    for (let alt = 0; alt <= 20000; alt += 250) {
      expect(rollKind(alt, 0.999), `alt ${alt} has no normal platforms`).toBe(
        "breakable",
      );
    }
  });
});

describe("gapMax", () => {
  it("widens with altitude but stays reachable", () => {
    expect(gapMax(0)).toBeLessThan(gapMax(5000));
    // A jump clears ~300px; gaps must never exceed that or the run dead-ends.
    expect(gapMax(1e6)).toBeLessThanOrEqual(150);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot resolve `../src/world.js`.

- [ ] **Step 3: Create `src/world.js`**

Move `addStarfield`, `addPlatform`, `addHazard`, `pickX`, `spawnRow` and `ensurePlatforms` across from `src/main.js` verbatim, then apply the changes below. The full file:

```js
import { COL } from "./palette.js";
import { W, H, PLAT_W, PLAT_H, START_Y, GRAVITY } from "./config.js";

const DT = () => Math.min(dt(), 1 / 30);

export const altitudeAt = (y) => Math.max(0, START_Y - y);

/** r is a 0..1 roll, passed in so this stays pure and testable. */
export function rollKind(alt, r) {
  const pSpring = alt < 250 ? 0 : 0.09;
  const pMoving = alt < 500 ? 0 : Math.min(0.38, 0.06 + alt / 16000);
  const pBreak = alt < 1100 ? 0 : Math.min(0.3, 0.04 + alt / 18000);
  if (r < pSpring) return "spring";
  if (r < pSpring + pMoving) return "moving";
  if (r < pSpring + pMoving + pBreak) return "breakable";
  return "normal";
}

export const gapMax = (alt) => Math.min(150, 84 + alt / 120);

export function addStarfield() {
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
      star.pos.y = ((((star.by + camY * star.f) % (H + 60)) + H + 60) % (H + 60)) - 30;
    });
  }
}

function addPlatform(x, y, kind) {
  const p = add([
    rect(PLAT_W, PLAT_H, { radius: 8 }),
    pos(x, y),
    anchor("center"),
    color(kind === "moving" ? COL.mintLight : kind === "breakable" ? COL.wood : COL.mint),
    outline(3, kind === "moving" ? COL.mint : kind === "breakable" ? COL.woodDark : COL.mintDark),
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
    p.add([rect(2.5, PLAT_H - 6), pos(-12, 0), anchor("center"), rotate(18), color(COL.woodDark)]);
    p.add([rect(2.5, PLAT_H - 8), pos(9, 0), anchor("center"), rotate(-14), color(COL.woodDark)]);
  } else if (kind === "spring") {
    p.add([rect(6, 8), pos(0, -12), anchor("center"), color(COL.spring)]);
    p.add([rect(24, 6, { radius: 3 }), pos(0, -18), anchor("center"), color(COL.spring), outline(2, COL.springDark)]);
  }

  p.onUpdate(() => {
    if (p.broken) {
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

// Black holes only. The drifting red monster is replaced by the demon horde.
function addBlackHole(x, y, player) {
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
    if (!player.dead && hole.pos.dist(player.pos) < 150) {
      player.pos = player.pos.lerp(hole.pos, 0.55 * DT());
    }
  });
  return hole;
}

export function createWorld({ player, onPlatform }) {
  let prevX = W / 2;
  let nextY = 0;

  function pickX(alt) {
    const maxDx = Math.min(250, 140 + alt / 90);
    let x = prevX + rand(-maxDx, maxDx);
    const lo = 50;
    const hi = W - 50;
    while (x < lo) x += hi - lo;
    while (x > hi) x -= hi - lo;
    return x;
  }

  function spawnRow(y) {
    const alt = altitudeAt(y);
    const kind = rollKind(alt, rand(1));
    const x = pickX(alt);
    const p = addPlatform(x, y, kind);
    if (kind === "moving") p.speed = 90 + Math.min(130, alt / 150) + rand(-15, 15);
    onPlatform?.(p, alt);
    prevX = x;

    // an extra easy platform low down
    if (alt < 1600 && rand() < 0.28) {
      const x2 = rand(60, W - 60);
      let d = Math.abs(x2 - x);
      d = Math.min(d, W - d);
      if (d > 150) {
        const extra = addPlatform(x2, y + rand(-10, 10), "normal");
        onPlatform?.(extra, alt);
      }
    }

    if (alt > 2200) {
      const chance = Math.min(0.08, 0.02 + (alt - 2200) / 40000);
      if (rand() < chance) addBlackHole(rand(50, W - 50), y - rand(80, 160), player);
    }
  }

  return {
    start() {
      addPlatform(W / 2, 880, "normal"); // base platform under the jumper
      nextY = 880 - rand(60, 80);
      this.ensure();
    },

    ensure() {
      const camTop = camPos().y - H / 2;
      while (nextY > camTop - 140) {
        spawnRow(nextY);
        nextY -= rand(52, gapMax(altitudeAt(nextY)));
      }
    },

    recycle(killY) {
      for (const p of get("platform")) if (p.pos.y > killY) destroy(p);
      for (const hz of get("hazard")) if (hz.pos.y > killY) destroy(hz);
    },
  };
}
```

Note two deliberate changes from the original: the drifting red monster is gone from `addHazard` (the demon horde replaces it in Task 6, so `addHazard` becomes `addBlackHole`), and the black hole rate is halved (`0.14` → `0.08` ceiling) because demons now supply most of the pressure.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`
Expected: PASS — 8 world tests added.

- [ ] **Step 5: Rewire `src/main.js`**

Delete `addStarfield`, and inside the `game` scene delete `addPlatform`, `addHazard`, `altitudeAt`, `rollKind`, `pickX`, `spawnRow`, `ensurePlatforms`, `prevX`, `nextY`, and the two bootstrap lines at the bottom of the scene (`addPlatform(W / 2, 880, "normal");` and `nextY = ...; ensurePlatforms();`).

Add to the imports:

```js
import { addStarfield, createWorld } from "./world.js";
```

In the `game` scene, after the arsenal is created:

```js
  const world = createWorld({ player, onPlatform: null });
```

Replace the call to `ensurePlatforms()` in the scene `onUpdate` with `world.ensure();`, and replace the two platform/hazard recycle loops with `world.recycle(killY);`.

At the very bottom of the `game` scene, replace the deleted bootstrap with:

```js
  world.start();
```

The `menu` and `gameover` scenes call `addStarfield()` — they now use the imported one, no change needed.

- [ ] **Step 6: Playtest and commit**

Run `npm run dev` and play a full run to ~2500m. Expected: generation, springs, moving and breakable platforms behave exactly as before; black holes still appear but less often; the red drifting monster is gone.

```bash
npm run build
git add src/world.js test/world.test.js src/main.js
git commit -m "refactor: extract world generation into a module

Adds an onPlatform hook for pickups. Drops the drifting monster (the
demon horde replaces it) and halves the black hole rate."
```

---

### Task 6: Demon horde

Grunts climb from below the camera toward the player. Shooting them down is both the combat and the movement. This is the task that makes the game a shooter.

**Files:**
- Create: `src/demons.js`
- Test: `test/demons.test.js`
- Modify: `src/main.js` (create the horde, update it, handle demon contact)

**Interfaces:**
- Consumes: `GRUNT`, `HORDE`, `W`, `H` from `src/config.js`; `COL` from `src/palette.js`.
- Produces: `src/demons.js` — named exports:
  - `hordeSpeed(alt) -> number` (pure)
  - `spawnInterval(alt) -> number` seconds, `Infinity` below `HORDE.startAlt` (pure)
  - `createHorde({ player, onDeath }) -> { update(alt), count() }`

  Each demon entity is tagged `"demon"` and exposes `hp` and `die()`. `onDeath(demon)` fires when a demon is shot down (not when it is recycled offscreen) — Task 7 uses it to drop ammo.

- [ ] **Step 1: Write the failing test**

Create `test/demons.test.js`:

```js
import { describe, it, expect } from "vitest";
import { hordeSpeed, spawnInterval } from "../src/demons.js";
import { HORDE, GRUNT } from "../src/config.js";

describe("hordeSpeed", () => {
  it("starts at the low speed and tops out at the high speed", () => {
    expect(hordeSpeed(HORDE.startAlt)).toBeCloseTo(GRUNT.speedLow);
    expect(hordeSpeed(HORDE.fullAlt)).toBeCloseTo(GRUNT.speedHigh);
  });

  it("does not keep accelerating past the full altitude", () => {
    expect(hordeSpeed(HORDE.fullAlt * 10)).toBeCloseTo(GRUNT.speedHigh);
  });

  it("never exceeds the high speed below the floor", () => {
    expect(hordeSpeed(0)).toBeLessThanOrEqual(GRUNT.speedLow);
  });

  it("rises monotonically", () => {
    let prev = -Infinity;
    for (let a = 0; a <= HORDE.fullAlt; a += 300) {
      const s = hordeSpeed(a);
      expect(s).toBeGreaterThanOrEqual(prev);
      prev = s;
    }
  });
});

describe("spawnInterval", () => {
  it("never spawns below the start altitude", () => {
    expect(spawnInterval(0)).toBe(Infinity);
    expect(spawnInterval(HORDE.startAlt - 1)).toBe(Infinity);
  });

  it("spawns slowly at first and fast at altitude", () => {
    expect(spawnInterval(HORDE.startAlt)).toBeCloseTo(HORDE.intervalLow);
    expect(spawnInterval(HORDE.fullAlt)).toBeCloseTo(HORDE.intervalHigh);
  });

  it("stops tightening past the full altitude", () => {
    expect(spawnInterval(HORDE.fullAlt * 5)).toBeCloseTo(HORDE.intervalHigh);
  });

  it("shortens monotonically", () => {
    let prev = Infinity;
    for (let a = HORDE.startAlt; a <= HORDE.fullAlt; a += 300) {
      const s = spawnInterval(a);
      expect(s).toBeLessThanOrEqual(prev);
      prev = s;
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot resolve `../src/demons.js`.

- [ ] **Step 3: Create `src/demons.js`**

```js
import { GRUNT, HORDE, W, H } from "./config.js";
import { COL } from "./palette.js";

const DT = () => Math.min(dt(), 1 / 30);

const clamp01 = (t) => Math.max(0, Math.min(1, t));
const ramp = (alt) => clamp01((alt - HORDE.startAlt) / (HORDE.fullAlt - HORDE.startAlt));

export function hordeSpeed(alt) {
  return GRUNT.speedLow + (GRUNT.speedHigh - GRUNT.speedLow) * ramp(alt);
}

export function spawnInterval(alt) {
  if (alt < HORDE.startAlt) return Infinity;
  return HORDE.intervalLow + (HORDE.intervalHigh - HORDE.intervalLow) * ramp(alt);
}

function addGrunt(x, y, player) {
  const g = add([
    circle(GRUNT.radius),
    pos(x, y),
    anchor("center"),
    color(COL.monster),
    outline(3, COL.monsterDark),
    area(),
    scale(1),
    z(2),
    "demon",
    { hp: GRUNT.hp, t: rand(0, 6), baseX: x },
  ]);

  // face + horns, drawn from primitives
  g.add([circle(6), pos(-9, -6), color(COL.white)]);
  g.add([circle(6), pos(9, -6), color(COL.white)]);
  g.add([circle(3), pos(-9, -6), color(COL.dark)]);
  g.add([circle(3), pos(9, -6), color(COL.dark)]);
  g.add([rect(6, 8), pos(-8, 10), color(COL.white)]);
  g.add([rect(6, 8), pos(2, 10), color(COL.white)]);
  g.add([rect(6, 10), pos(-10, -26), rotate(-20), color(COL.monsterDark)]);
  g.add([rect(6, 10), pos(4, -26), rotate(20), color(COL.monsterDark)]);

  g.die = () => {
    g.onDeathCb?.(g);
    // brief pop, then gone
    const puff = add([
      circle(GRUNT.radius),
      pos(g.pos),
      anchor("center"),
      color(COL.monsterDark),
      opacity(0.8),
      scale(1),
      z(2),
    ]);
    puff.onUpdate(() => {
      const d = DT();
      puff.opacity -= 3.5 * d;
      const s = puff.scale.x + 2.6 * d;
      puff.scale = vec2(s, s);
      if (puff.opacity <= 0) destroy(puff);
    });
    destroy(g);
  };

  g.onUpdate(() => {
    const d = DT();
    g.t += d;
    // climb toward the player, wandering sideways so a column of them
    // does not read as a single wall
    g.pos.y -= g.speed * d;
    g.baseX += Math.sign(player.pos.x - g.baseX) * g.speed * 0.35 * d;
    g.pos.x = clamp(g.baseX + Math.sin(g.t * GRUNT.wanderSpd) * GRUNT.wanderAmp, 24, W - 24);
    g.scale = vec2(1, 1 + 0.08 * Math.sin(g.t * 6));
  });

  return g;
}

export function createHorde({ player, onDeath }) {
  let timer = 0;

  return {
    count: () => get("demon").length,

    update(alt) {
      const interval = spawnInterval(alt);
      if (interval === Infinity) return;

      timer -= DT();
      if (timer > 0) return;
      timer = interval;

      if (get("demon").length >= HORDE.maxAlive) return;

      const y = camPos().y + H / 2 + HORDE.spawnBelowCam;
      const g = addGrunt(rand(40, W - 40), y, player);
      g.speed = hordeSpeed(alt);
      g.onDeathCb = onDeath;
    },
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`
Expected: PASS — 8 demon tests added.

- [ ] **Step 5: Wire the horde into `src/main.js`**

Add to the imports:

```js
import { createHorde } from "./demons.js";
import { GRUNT } from "./config.js";
```

In the `game` scene, after the world is created:

```js
  const horde = createHorde({ player, onDeath: null });
```

In the scene `onUpdate`, right after `world.ensure();`:

```js
    horde.update(maxAlt);
```

And extend the recycle block — demons that fall far below the camera are gone for good:

```js
    for (const g of get("demon")) if (g.pos.y > killY) destroy(g);
```

- [ ] **Step 6: Make demon contact hurt**

Add alongside the hazard handler:

```js
  player.onCollide("demon", (g) => {
    if (dead) return;
    if (!player.hurt(GRUNT.damage, time())) return; // absorbed by i-frames
    shake(6);
    const away = Math.sign(player.pos.x - g.pos.x) || 1;
    player.vel.x = away * 380;
    player.vel.y = Math.min(player.vel.y, -420);
    if (player.hp <= 0) {
      markDead();
      shake(16);
      wait(0.4, endRun);
    }
  });
```

- [ ] **Step 7: Playtest the pressure curve**

Run `npm run dev`. Climb past 600px of altitude.

Expected:
- Grunts start rising from the bottom of the screen and track toward you.
- Shooting one destroys it in a puff — one sidearm pellet is enough (`GRUNT.hp` is 1).
- **Stop climbing deliberately.** The horde should catch you within a few seconds. Climb steadily and you should outrun them.
- Never more than 12 on screen at once.

If grunts outrun a steady climb, lower `GRUNT.speedHigh` in `src/config.js`. If they never threaten you, raise it. This is tuning, not a code change.

- [ ] **Step 8: Verify the build and commit**

```bash
npm run build
git add src/demons.js test/demons.test.js src/main.js
git commit -m "feat: demon horde climbing from below

Grunts spawn below the camera and track the player, with speed and
spawn rate ramping from altitude 600 to 6000 and a hard cap of 12
alive. Shooting down is now both combat and movement."
```

---

### Task 7: Pickups — ammo, medkits, the scattergun

Closes the resource loop: accurate shooting pays for itself through drops, missing drains the reserve and forces you onto platforms.

**Files:**
- Create: `src/pickups.js`
- Test: `test/pickups.test.js`
- Modify: `src/main.js` (pass real `onPlatform` and `onDeath` callbacks, handle pickup collisions)

**Interfaces:**
- Consumes: `DROP`, `W` from `src/config.js`; `COL` from `src/palette.js`.
- Produces: `src/pickups.js` — named exports:
  - `rollPlatformPickup(alt, rCrate, rMed, rWeapon) -> "ammo" | "medkit" | "weapon" | null` (pure)
  - `addPickup(kind, x, y)` — spawns an entity tagged `"pickup"` with `kind` and `amount`
  - `dropFromDemon(demon, r, amountRoll)` — spawns ammo at the demon's position, or nothing

- [ ] **Step 1: Write the failing test**

Create `test/pickups.test.js`:

```js
import { describe, it, expect } from "vitest";
import { rollPlatformPickup } from "../src/pickups.js";
import { DROP } from "../src/config.js";

describe("rollPlatformPickup", () => {
  it("usually places nothing", () => {
    expect(rollPlatformPickup(3000, 0.99, 0.99, 0.99)).toBe(null);
  });

  it("places an ammo crate inside the crate chance", () => {
    expect(rollPlatformPickup(3000, DROP.crateChance - 0.001, 0.99, 0.99)).toBe("ammo");
  });

  it("places a medkit inside the medkit chance", () => {
    expect(rollPlatformPickup(3000, 0.99, DROP.medkitChance - 0.001, 0.99)).toBe("medkit");
  });

  it("gives at most one thing per platform, ammo winning ties", () => {
    expect(rollPlatformPickup(3000, 0.001, 0.001, 0.001)).toBe("ammo");
  });

  it("never offers a weapon before the first weapon interval", () => {
    expect(rollPlatformPickup(100, 0.99, 0.99, 0.0001)).toBe(null);
  });

  it("can offer a weapon once high enough", () => {
    expect(rollPlatformPickup(DROP.weaponEveryPx + 1, 0.99, 0.99, 0.0001)).toBe("weapon");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot resolve `../src/pickups.js`.

- [ ] **Step 3: Create `src/pickups.js`**

```js
import { DROP } from "./config.js";
import { COL } from "./palette.js";

const DT = () => Math.min(dt(), 1 / 30);

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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`
Expected: PASS — 6 pickup tests added.

- [ ] **Step 5: Wire pickups into `src/main.js`**

Add to the imports:

```js
import { rollPlatformPickup, addPickup, dropFromDemon } from "./pickups.js";
import { PLAT_H } from "./config.js";
```

Replace `onPlatform: null` in the `createWorld` call:

```js
  const world = createWorld({
    player,
    onPlatform: (p, alt) => {
      const kind = rollPlatformPickup(alt, rand(1), rand(1), rand(1));
      if (kind) addPickup(kind, p.pos.x, p.pos.y - PLAT_H / 2 - 14);
    },
  });
```

Replace `onDeath: null` in the `createHorde` call:

```js
  const horde = createHorde({
    player,
    onDeath: (g) => dropFromDemon(g, rand(1), rand(1)),
  });
```

- [ ] **Step 6: Handle collecting a pickup**

Add alongside the other collision handlers:

```js
  player.onCollide("pickup", (p) => {
    if (dead) return;
    if (p.kind === "medkit") player.heal(p.amount);
    else if (p.kind === "ammo") arsenal.give("scattergun", p.amount);
    else if (p.kind === "weapon") arsenal.give("scattergun", 24);
    destroy(p);
  });
```

- [ ] **Step 7: Recycle offscreen pickups**

In the recycle block in the scene `onUpdate`, add:

```js
    for (const p of get("pickup")) if (p.pos.y > killY) destroy(p);
```

- [ ] **Step 8: Playtest the resource loop**

Run `npm run dev`.

Expected:
- Orange crates and white medkits sit on some platforms; touching them collects them.
- Above 1500m a wider orange pickup appears occasionally — collecting it equips the scattergun, whose shots fire five pellets in a cone and kick noticeably harder.
- Killing grunts sometimes drops small ammo crates.
- Firing the scattergun 24 times silently returns you to the sidearm.

Note: health and ammo are not on screen yet — that is Task 8. For now, verify by watching behaviour (the harder kick means the scattergun is equipped).

- [ ] **Step 9: Verify the build and commit**

```bash
npm run build
git add src/pickups.js test/pickups.test.js src/main.js
git commit -m "feat: ammo, medkit and weapon pickups

Closes the resource loop: grunts drop ammo on death, platforms carry
crates and medkits, and the scattergun appears above 1500m."
```

---

### Task 8: HUD — status bar and the reacting portrait

**Files:**
- Create: `src/hud.js`
- Test: `test/hud.test.js`
- Modify: `src/main.js` (replace the floating score label with the status bar)

**Interfaces:**
- Consumes: `W`, `H` from `src/config.js`; `COL` from `src/palette.js`.
- Produces: `src/hud.js` — named exports:
  - `faceState(hp) -> "calm" | "grim" | "angry" | "bloodied" | "dead"` (pure)
  - `createHud() -> { update({ hp, ammo, weaponName, altitude }) }`

- [ ] **Step 1: Write the failing test**

Create `test/hud.test.js`:

```js
import { describe, it, expect } from "vitest";
import { faceState } from "../src/hud.js";

describe("faceState", () => {
  it("maps each health band", () => {
    expect(faceState(100)).toBe("calm");
    expect(faceState(75)).toBe("calm");
    expect(faceState(74)).toBe("grim");
    expect(faceState(50)).toBe("grim");
    expect(faceState(49)).toBe("angry");
    expect(faceState(25)).toBe("angry");
    expect(faceState(24)).toBe("bloodied");
    expect(faceState(1)).toBe("bloodied");
    expect(faceState(0)).toBe("dead");
  });

  it("treats negative health as dead", () => {
    expect(faceState(-10)).toBe("dead");
  });

  it("covers every integer from 0 to 100 without gaps", () => {
    for (let hp = 0; hp <= 100; hp++) {
      expect(typeof faceState(hp)).toBe("string");
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot resolve `../src/hud.js`.

- [ ] **Step 3: Create `src/hud.js`**

```js
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`
Expected: PASS — 3 HUD tests added.

- [ ] **Step 5: Replace the floating score label in `src/main.js`**

Add to the imports:

```js
import { createHud } from "./hud.js";
```

In the `game` scene, delete the `const scoreLabel = add([...])` block and replace it with:

```js
  const hud = createHud();
```

In the scene `onUpdate`, replace the line `scoreLabel.text = ...` with:

```js
    hud.update({
      hp: player.hp,
      ammo: arsenal.ammo,
      weaponName: arsenal.current.name,
      altitude: Math.floor(maxAlt / 50),
    });
```

- [ ] **Step 6: Playtest the HUD**

Run `npm run dev`.

Expected:
- A bar across the bottom showing `HEALTH`, the portrait, `ALT` and `AMMO`.
- `AMMO` reads `∞` with the sidearm and a countdown with the scattergun.
- Take damage from a grunt: the health number drops and the portrait's brows tilt angrier, gaining cuts, then blood below 25 where the number also turns red.
- Rising demons remain visible through the bar.

- [ ] **Step 7: Verify the build and commit**

```bash
npm run build
git add src/hud.js test/hud.test.js src/main.js
git commit -m "feat: status bar HUD with health-reactive portrait

Bottom bar shows health, altitude, ammo and current weapon. The mint
blob portrait shifts through five states as health drops. The bar is
semi-transparent so rising demons stay visible behind it."
```

---

### Task 9: Audio

Synthesised with WebAudio, no asset files. Browsers block audio until a user gesture, so the context is created lazily on the first sound after a real input.

**Files:**
- Create: `src/audio.js`
- Test: `test/audio.test.js`
- Modify: `src/main.js` (call the sound effects)

**Interfaces:**
- Consumes: nothing from other modules.
- Produces: `src/audio.js` — named exports:
  - `makeRateLimiter(minGap) -> (now) => boolean` (pure)
  - `sfx` — object with `shoot(weaponId)`, `demonDeath()`, `hurt()`, `pickup()`, `growl(now)`, `bounce()`, `spring()`, `gameOver()`, `heartbeat(now)`

- [ ] **Step 1: Write the failing test**

Create `test/audio.test.js`:

```js
import { describe, it, expect } from "vitest";
import { makeRateLimiter } from "../src/audio.js";

describe("makeRateLimiter", () => {
  it("allows the first call", () => {
    const allow = makeRateLimiter(0.5);
    expect(allow(0)).toBe(true);
  });

  it("blocks calls inside the gap", () => {
    const allow = makeRateLimiter(0.5);
    allow(10);
    expect(allow(10.2)).toBe(false);
    expect(allow(10.4)).toBe(false);
  });

  it("allows again once the gap has passed", () => {
    const allow = makeRateLimiter(0.5);
    allow(10);
    expect(allow(10.5)).toBe(true);
  });

  it("keeps limiting after it re-opens", () => {
    const allow = makeRateLimiter(0.5);
    allow(10);
    allow(10.5);
    expect(allow(10.6)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot resolve `../src/audio.js`.

- [ ] **Step 3: Create `src/audio.js`**

```js
// Everything is synthesised; the project ships no audio files.

/** Pure: returns a predicate that is true at most once per minGap seconds. */
export function makeRateLimiter(minGap) {
  let last = -Infinity;
  return (now) => {
    if (now - last < minGap) return false;
    last = now;
    return true;
  };
}

let ctx = null;

// Browsers refuse to start an AudioContext before a user gesture. Creating it
// lazily on the first sound means the first sound follows a real input.
function audio() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  return ctx;
}

function tone({ freq, endFreq, type = "square", dur = 0.12, gain = 0.12, delay = 0 }) {
  const ac = audio();
  if (!ac) return;
  const t0 = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (endFreq) osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), t0 + dur);
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noise({ dur = 0.2, gain = 0.25, from = 3000, to = 200 }) {
  const ac = audio();
  if (!ac) return;
  const t0 = ac.currentTime;
  const frames = Math.floor(ac.sampleRate * dur);
  const buf = ac.createBuffer(1, frames, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;

  const src = ac.createBufferSource();
  src.buffer = buf;
  const filter = ac.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(from, t0);
  filter.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

  src.connect(filter).connect(g).connect(ac.destination);
  src.start(t0);
  src.stop(t0 + dur);
}

const growlAllowed = makeRateLimiter(1.2);
const heartbeatAllowed = makeRateLimiter(0.9);

export const sfx = {
  shoot(weaponId) {
    if (weaponId === "scattergun") {
      noise({ dur: 0.26, gain: 0.3, from: 4200, to: 160 });
      tone({ freq: 160, endFreq: 50, type: "sawtooth", dur: 0.16, gain: 0.14 });
    } else {
      tone({ freq: 640, endFreq: 180, type: "square", dur: 0.07, gain: 0.08 });
    }
  },

  demonDeath() {
    tone({ freq: 220, endFreq: 40, type: "sawtooth", dur: 0.2, gain: 0.14 });
    noise({ dur: 0.14, gain: 0.14, from: 1800, to: 120 });
  },

  hurt() {
    tone({ freq: 300, endFreq: 70, type: "sawtooth", dur: 0.3, gain: 0.2 });
  },

  pickup() {
    tone({ freq: 880, type: "triangle", dur: 0.07, gain: 0.12 });
    tone({ freq: 1320, type: "triangle", dur: 0.09, gain: 0.1, delay: 0.06 });
  },

  /** Rate-limited: a dozen grunts spawning must not produce a wall of noise. */
  growl(now) {
    if (!growlAllowed(now)) return;
    tone({ freq: 90, endFreq: 62, type: "sawtooth", dur: 0.34, gain: 0.1 });
  },

  bounce() {
    tone({ freq: 420, endFreq: 760, type: "triangle", dur: 0.09, gain: 0.09 });
  },

  spring() {
    tone({ freq: 360, endFreq: 1500, type: "square", dur: 0.22, gain: 0.12 });
  },

  gameOver() {
    tone({ freq: 380, endFreq: 60, type: "sawtooth", dur: 0.9, gain: 0.2 });
  },

  /** Low-health pulse. Rate-limited so it beats rather than drones. */
  heartbeat(now) {
    if (!heartbeatAllowed(now)) return;
    tone({ freq: 70, endFreq: 46, type: "sine", dur: 0.11, gain: 0.22 });
    tone({ freq: 62, endFreq: 40, type: "sine", dur: 0.13, gain: 0.16, delay: 0.17 });
  },
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`
Expected: PASS — 4 audio tests added. (`heartbeat` reuses the already-tested `makeRateLimiter`, so it needs no test of its own.)

- [ ] **Step 5: Hook the sounds up in `src/main.js`**

Add to the imports:

```js
import { sfx } from "./audio.js";
```

Then add each call:

- In `landOn(p)`: `sfx.spring()` in the spring branch, `sfx.bounce()` in the else branch.
- In the `fireDown()` block inside `player.onUpdate`, change it to capture whether a shot happened:

```js
    arsenal.update();
    if (fireDown()) {
      const id = arsenal.current.id;
      if (arsenal.tryFire(player, time())) sfx.shoot(id);
    }
```

- In the `player.onCollide("demon", ...)` and `player.onCollide("hazard", ...)` handlers, after a hit actually lands: `sfx.hurt();`.
- In `player.onCollide("pickup", ...)`, before `destroy(p)`: `sfx.pickup();`.
- In `endRun()`, as the first line: `sfx.gameOver();`.
- In the scene `onUpdate`, right after the `hud.update({...})` call, add the low-health pulse:

```js
    if (!dead && player.hp > 0 && player.hp < 25) sfx.heartbeat(time());
```

- [ ] **Step 6: Play the demon growl on spawn**

In `src/demons.js`, add the import at the top:

```js
import { sfx } from "./audio.js";
```

and inside `createHorde`'s `update`, right after `g.onDeathCb = onDeath;`:

```js
      sfx.growl(time());
```

In `src/demons.js`, inside `g.die()`, add as the first line:

```js
    sfx.demonDeath();
```

- [ ] **Step 7: Playtest the audio**

Run `npm run dev`. Click to start (this is the gesture that unlocks audio).

Expected: bounces chirp, springs whoop, the sidearm pops and the scattergun booms, grunts growl on spawn but never more than about once per 1.2s, kills thud, pickups blip, damage rasps, game over drops. Drop below 25 health and a slow double-thump heartbeat starts under everything.

If nothing plays, check the browser console for an AudioContext warning — it means a sound was attempted before any user gesture.

- [ ] **Step 8: Verify the build and commit**

```bash
npm run build
git add src/audio.js test/audio.test.js src/main.js src/demons.js
git commit -m "feat: synthesised WebAudio sound effects

No audio files: everything is oscillators and filtered noise. The
context is created lazily on first playback so it follows a user
gesture. Demon growls are rate-limited to one per 1.2s."
```

---

### Task 10: Menu, game over, docs and final verification

Brings the front-of-house screens in line with the new controls, updates the README, and confirms the whole thing works end to end.

**Files:**
- Modify: `src/main.js` (menu and gameover copy; confirm `main.js` is now bootstrap + scenes only)
- Modify: `README.md`

**Interfaces:**
- Consumes: everything from Tasks 1-9.
- Produces: no new exports.

- [ ] **Step 1: Update the menu control hints**

In the `menu` scene, replace the two hint lines at the bottom (the ones reading `steer with arrows / A D` and `on phone swipe left / right, or use the buttons`) with three lines:

```js
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
```

- [ ] **Step 2: Make the phone steer row visible during play only**

`src/mobile.css` already hides `#steer` on the menu and gameover screens via `html.phone.menu #steer` and `html.phone.over #steer`. Confirm the fire button inherits this — it is inside `#steer`, so it does. No change needed; just verify on a phone-sized viewport that the `[◀] [FIRE] [▶]` row appears only during a run.

- [ ] **Step 3: Verify `main.js` shrank**

Run: `wc -l src/main.js`
Expected: well under 300 lines. It should now contain only: imports, the `phone` detection, `setScreen`, the `kaplay({...})` call, `initPalette()`, `initInput()`, the three scenes, and `go("menu")`. If gameplay helper functions are still defined inline, they belong in a module — move them.

- [ ] **Step 4: Run the whole test suite**

Run: `npm test`
Expected: PASS. Counting the tests added across tasks: 4 config + 6 input + 5 player + 14 weapons + 8 world + 8 demons + 6 pickups + 3 hud + 4 audio = **58 tests**.

- [ ] **Step 5: Update `README.md`**

Replace the `## Controls` table with:

```markdown
| Input | Action |
| --- | --- |
| `←` / `→` or `A` / `D` | steer the jumper |
| hold left / right half of the screen | steer (touch) |
| left mouse button or `Space` | shoot downward |
| `[FIRE]` button | shoot downward (touch) |
| `Space` / tap | start, retry |
```

After the `## Platform types` section, add:

```markdown
## Weapons

You shoot **downward**, and the recoil lifts you. Every weapon obeys
`impulse / cooldown < GRAVITY`, so holding fire slows your fall by about half
but can never produce sustained flight — you still need platforms.

- **SIDEARM** — infinite ammo, one pellet, a gentle kick
- **SCATTERGUN** — 24 rounds, five pellets in a cone, a real boost

Run out of ammo and you drop back to the SIDEARM automatically.

## Demons

**GRUNTS** climb toward you from below the screen, getting faster and more
frequent with altitude. Shooting downward kills them and pushes you up at the
same time — one action solves both problems. Touching one costs 25 health and
knocks you sideways; you get a moment of invulnerability afterwards.

Ammo crates and medkits sit on platforms, and grunts drop ammo when they die.
Accurate shooting pays for itself; spraying does not.
```

Update the paragraph under `## Platform types` that mentions monsters so it reads:

```markdown
Higher up, platforms get sparser and moving/breakable ones get more common.
Past ~2200px of altitude, **black holes** start appearing — they pull you in
and touching one ends the run instantly.
```

- [ ] **Step 6: Full manual playtest**

Run `npm run dev` and play at least three complete runs. Confirm each of these:

1. Menu shows, PLAY starts a run.
2. Arrow keys steer. Dragging the mouse does **not** break keyboard steering.
3. Holding the mouse or Space fires downward and slows the fall, but never lets you climb without platforms.
4. Past ~600px altitude grunts rise from below; shooting them kills them.
5. Stalling on a platform lets the horde reach you; four hits kill.
6. Crates, medkits and the scattergun can be collected; the HUD reflects all of it.
7. The portrait visibly degrades as health drops.
8. Falling off the bottom ends the run; a black hole ends it instantly.
9. Game over shows the score and best, and AGAIN restarts cleanly with full health and sidearm-only ammo.
10. Sound plays for all of the above.

Then resize the browser to a narrow phone viewport (or use device emulation) and confirm the `[◀] [FIRE] [▶]` row works and only appears during a run.

- [ ] **Step 7: Confirm a clean build and commit**

```bash
npm test
npm run build
git add src/main.js README.md
git commit -m "docs: document weapons, demons and the new controls

Updates the menu hints and README for downward firing, the fire button
and the demon horde."
```

- [ ] **Step 8: Report status**

State plainly which of the ten manual checks in Step 6 passed and which did not. Do not claim the phase is complete unless `npm test` and `npm run build` both succeeded and every check passed. If tuning felt wrong (horde too fast or too slow, recoil too weak or too strong), report the numbers you would change in `src/config.js` rather than changing the design.

---

## Phase 1 Definition of Done

- `npm test` passes all 58 tests.
- `npm run build` succeeds.
- `src/main.js` is under 300 lines and contains only bootstrap and scene wiring.
- The player shoots downward, gets lifted by recoil, cannot achieve sustained flight, fights a horde rising from below, collects ammo and medkits, and sees health/ammo/altitude in a status bar with a health-reactive portrait.
- Sound plays, sourced entirely from WebAudio synthesis.
- Works on desktop and on a phone-sized viewport.
- No Doom/id Software names, fonts, character designs, or assets anywhere in the codebase.

## Deferred to Phase 2

Tracked here so nothing is silently lost:

- Three more weapons (chaingun, mortar, plasma archetypes) — each must obey `impulse / cooldown < GRAVITY`.
- Three more demon types (leaper, bloater, spitter).
- Hell art direction: palette, backgrounds, particles, keeping the mint hero as contrast.
- An altitude boss.
- The decision on whether to rename the game.
