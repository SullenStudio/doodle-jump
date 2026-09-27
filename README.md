# Mint Jump

An endless vertical climber in the spirit of Doodle Jump, built by **Sullen Studio**.
Bounce from platform to platform, climb as high as you can, and don't fall — or
get eaten by what lurks at altitude.

Built with [Vite](https://vite.dev) + [Kaplay 3001](https://kaplayjs.com). All
graphics are drawn shapes — zero external assets.

## Play

- **Live:** https://sullenstudio.github.io/doodle-jump/

## Controls

| Input | Action |
| --- | --- |
| `←` / `→` or `A` / `D` | steer the jumper |
| hold left / right half of the screen | steer (touch) |
| left mouse button or `Space` | shoot downward |
| `[FIRE]` button | shoot downward (touch) |
| `Space` / tap | start, retry |

The jumper bounces automatically when it lands on a platform and wraps around
the left/right screen edges.

## Platform types

- **Mint** — normal, static platform
- **Light mint with dots** — moving platform, slides horizontally
- **Wood** — breakable, falls away after one bounce
- **Mint with an orange spring** — spring platform, huge boost

Higher up, platforms get sparser and moving/breakable ones get more common.
Past ~2200px of altitude, **black holes** start appearing — they pull you in,
and touching one ends the run instantly.

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

Score is height climbed in meters. Your best height is saved in
`localStorage`.

## Run locally

```sh
npm install
npm run dev
```

## Build

```sh
npm run build   # outputs to dist/
npm run preview # serve the production build locally
```

## Deploy

Pushes to `main` build and deploy to GitHub Pages automatically via
`.github/workflows/pages.yml`.

## License

MIT — see [LICENSE](LICENSE).
