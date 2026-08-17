# Mathemagicum

A free-to-play, source-available, on-device educational RPG. Pixel art,
3/4 top-down view, runs entirely in the browser — no server, no account, no
network required after the first load.

Source is publicly readable and modifiable for noncommercial use (see
[License](#license)) — not OSI/FSF "open source," which requires permitting
commercial use.

## Status

Early. A generated 500×500 world you can walk around, with the Starting
Village laid out in it. No minigames yet — planting is a direct keypress
standing in for where the first spell will go.

## Assets

**Nothing in this repo generates art.** Every asset under `public/assets/`
is produced by the sibling [`asset-generator`](../asset-generator) repo and
committed here, so the game builds and runs with no Python toolchain and no
generation step.

To re-sync after regenerating them there:

```sh
cd ../asset-generator
uv run asset-generator terrain-atlas   --seed 7 --out-dir output/terrain_atlas
uv run asset-generator terrain-buildings --seed 7 --sheets --out-dir output/terrain_buildings
uv run asset-generator terrain-characters --seed 7 --out-dir output/terrain_characters
uv run asset-generator terrain-interiors --seed 7 --sheets --out-dir output/terrain_interiors

cd -
OUT=../asset-generator/output
cp $OUT/terrain_atlas/terrain*.{png,json} public/assets/terrain/
cp $OUT/terrain_buildings/{cottage,barn,tower,schoolhouse}{.json,_sheet.png} public/assets/buildings/
for c in player teacher postal-worker shopkeeper villager-0 villager-1 villager-2; do
  cp $OUT/terrain_characters/$c{.json,_sheet.png} public/assets/characters/
done
for r in cottage barn tower schoolhouse; do
  cp $OUT/terrain_interiors/$r{.json,_sheet.png} public/assets/interiors/
done
bun test   # src/world/assets.test.ts checks the sync
```

Three things are worth knowing about what gets copied:

- **The terrain atlas holds a finished tile for every one of the 7⁴ ways
  terrain can meet at a tile's four corners**, including the cells where
  three or four terrains meet. Those cells have no autotile-bitmask
  representation and the generator only composites them in Python, so
  baking them all is what lets the renderer be a single frame lookup with
  no mask, priority table or layer stack — and what guarantees the world
  can never contain a tile with no art. `src/world/assets.test.ts` asserts
  that coverage against the shipped file.
- **Sprite sheets must come from `--sheets`**, which always writes 1:1 art.
  The GIFs and PNGs those commands write alongside are QA renders scaled up
  by `--scale`, and would draw several times too large. (`terrain-characters`
  needs no flag — it only ever writes game-ready output.)
- **Only the characters the world actually places are copied.** The generator
  will roll as many generic villagers as you ask for; the list in the loop
  above has to stay in step with `VILLAGER_CHARACTERS` in
  `src/world/characters.ts`, which is what the game loads.

An interior's art is exactly as large as the grid it describes plus its north
wall, and `assets.test.ts` checks that: cell (0,0) is drawn `wall_rise_px`
below the image's top-left, so art and grid disagreeing would put the player
inside the furniture everywhere in the room. It also checks every open cell
is reachable from the doorway — two rooms once shipped with furniture
directly in front of their own door, which renders perfectly and only shows
up by walking it.

A character sheet is the only asset here laid out as a 2D grid, and both of
its axes are an exact multiple of the frame pitch with no slack — so a loader
that miscounts a row drops it *silently*, and the animations in that row
simply have no frames while every other facing still plays. `BootScene`
asserts each sheet sliced into as many frames as its sidecar declares, which
turns that into a load-time error instead of one direction where the
character mysteriously freezes.

`assets.test.ts` is the guard on all of this: it reads the committed files
and fails if they drift from what the renderer assumes, since a bad sync is
otherwise invisible until something renders wrong.

## Stack

- [Bun](https://bun.sh) — runtime, package manager, test runner
- [Phaser 3](https://phaser.io) — game framework (TypeScript)
- [Vite](https://vitejs.dev) — dev server / static build (+ `vite-plugin-pwa` for offline support)
- [Biome](https://biomejs.dev) — lint + format
- [Lefthook](https://github.com/evilmartians/lefthook) — git hooks

## Getting started

```sh
bun install
bun run dev       # dev server
bun run test      # bun:test
bun run typecheck # tsc --noEmit
bun run lint      # biome check
bun run build     # production build to dist/
```

> `dev`/`build`/`preview` run through `bunx --bun` rather than plain `vite`:
> Vite's bin has a `#!/usr/bin/env node` shebang, and the PWA plugin's
> Workbox dependency crashes under Node <19 (no global WebCrypto). Forcing
> Bun's own runtime sidesteps the host's Node version entirely.

## License

- Source code: [PolyForm Noncommercial 1.0.0](LICENSE) — noncommercial use,
  modification, and redistribution only.
- Art, audio, and other creative assets (once added): CC-BY-NC-ND-4.0.

See [`REUSE.toml`](REUSE.toml) for the per-path license mapping.
