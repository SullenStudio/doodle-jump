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
| drag horizontally | steer (touch) |
| `Space` / tap | start, retry |

The jumper bounces automatically when it lands on a platform and wraps around
the left/right screen edges.

## Platform types

- **Mint** — normal, static platform
- **Light mint with dots** — moving platform, slides horizontally
- **Wood** — breakable, falls away after one bounce
- **Mint with an orange spring** — spring platform, huge boost

Higher up, platforms get sparser and moving/breakable ones get more common.
Past ~2200px of altitude, **black holes** (they pull you in) and **monsters**
start appearing — touching either ends the run.

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
