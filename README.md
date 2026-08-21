# Mathemagicum

A free-to-play, source-available, on-device educational RPG. Pixel art,
3/4 top-down view, runs entirely in the browser — no server, no account, no
network required after the first load.

Source is publicly readable and modifiable for noncommercial use (see
[License](#license)) — not OSI/FSF "open source," which requires permitting
commercial use.

## Status

Early. A generated 500×500 world you can walk around, with the Starting
Village laid out in it, and the first spell in place: crops are planted as
seedlings and grown by casting **addition** on them, a number-line minigame
opened from the spellbook. The player bends to plant, and a golden plus
sinks into the tile a spell lands on. Seeds and spells are picked from two icon trays
in the corner of the screen, and both act on the tile the player faces.
Ripe crops are picked with a tap and go into a basket, and the village
shopkeeper buys them for coins you can spend on fences, tables and lamps to
put down — and the counter is the second minigame: buying means counting the
exact sum out in coins — ducats and mites, which are nobody's real money — and
selling means checking the payment she counts back, which one time in ten is
wrong. Planting and harvesting are still direct actions — those spells
are not speced. The game is playable in English and German — every line of it
— and the language is the player's to pick.

How hard the sums are is a per-child setting, picked from four sample sums
rather than from ages or difficulty labels: one, two or three places on the
number line, whether the jumps carry, and how much of a cast arrives already
worked out. Inside that choice the game nudges quietly up or down on how the
last few casts went — never announced, never a level, and never able to leave
the band somebody picked. Easier sums never earn less: every price in the
store is quoted in crops, so a fence is two harvests at every setting.

Several children share one device. Each is a player of their own: their own
name, their own character, their own language, and their own world — the game
asks who is playing every time it starts, and a child picks their face off a
grid. Making a player means typing a name and choosing skin, hair, clothes
and one of four bodies. Worlds save themselves as they are played; nothing
has to be remembered to keep a farm.

## Assets

**Nothing in this repo generates art.** Every asset under `public/assets/`
is produced by the sibling [`asset-generator`](../asset-generator) repo and
committed here, so the game builds and runs with no Python toolchain and no
generation step.

To re-sync after regenerating them there:

```sh
cd ../asset-generator
uv run asset-generator terrain-atlas   --seed 7 --out-dir output/terrain_atlas
uv run asset-generator terrain-cliffs --seed 7 --out-dir output/terrain_cliffs
uv run asset-generator terrain-buildings --seed 7 --sheets --out-dir output/terrain_buildings
uv run asset-generator terrain-characters --seed 7 --out-dir output/terrain_characters
uv run asset-generator terrain-animals --out-dir output/terrain_animals
uv run asset-generator terrain-interiors --seed 7 --sheets --out-dir output/terrain_interiors
uv run asset-generator terrain-plants --seed 7 --out-dir output/terrain_plants
uv run asset-generator terrain-fixtures --seed 7 --out-dir output/terrain_fixtures
uv run asset-generator terrain-effects --seed 7 --out-dir output/terrain_effects
uv run asset-generator terrain-objects --seed 7 --sheets --out-dir output/terrain_objects
uv run asset-generator ui --seed 7 --out-dir output/ui

cd -
OUT=../asset-generator/output
cp $OUT/terrain_atlas/terrain*.{png,json} public/assets/terrain/
cp $OUT/terrain_cliffs/cliffs*.{png,json} public/assets/cliffs/
cp $OUT/terrain_buildings/{cottage,barn,tower,schoolhouse}{.json,_sheet.png} public/assets/buildings/
for c in player player-bun player-trousers player-short \
         teacher postal-worker shopkeeper villager-0 villager-1 villager-2; do
  cp "$OUT/terrain_characters/$c.json" "$OUT/terrain_characters/${c}_sheet.png" \
     public/assets/characters/
done
cp $OUT/terrain_characters/avatar.json public/assets/characters/
for a in chicken cat rabbit duck; do
  cp "$OUT/terrain_animals/$a.json" "$OUT/terrain_animals/${a}_sheet.png" public/assets/animals/
done
for r in cottage barn tower schoolhouse; do
  cp $OUT/terrain_interiors/$r{.json,_sheet.png} public/assets/interiors/
done
for p in carrot sunflower cactus tomato pepper wheat; do
  cp $OUT/terrain_plants/$p{.json,_sheet.png} public/assets/plants/
done
for f in well fence fence-side table lamp gate stall; do
  cp $OUT/terrain_fixtures/$f{.json,_sheet.png} public/assets/fixtures/
done
cp $OUT/terrain_effects/plus{.json,_sheet.png} public/assets/effects/
for t in grass woodland dirt hilly mountain sand; do
  cp $OUT/terrain_objects/$t{.json,_sheet.png} public/assets/objects/
done
cp $OUT/ui/{ui.json,parchment_fill.png,parchment_frame.png}    public/assets/ui/
cp $OUT/ui/{spellbook.png,rune_add.png,seed_pouch.png,basket.png,crate.png,map_wall.png} public/assets/ui/
cp $OUT/ui/{crop_*.png,item_*.png,coin_*.png}                     public/assets/ui/
bun test   # src/world/assets.test.ts checks the sync
```

Three things are worth knowing about what gets copied:

- **The terrain atlas holds a finished tile for every one of the 8⁴ ways
  terrain can meet at a tile's four corners**, including the cells where
  three or four terrains meet. Those cells have no autotile-bitmask
  representation and the generator only composites them in Python, so
  baking them all is what lets the renderer be a single frame lookup with
  no mask, priority table or layer stack — and what guarantees the world
  can never contain a tile with no art. `src/world/assets.test.ts` asserts
  that coverage against the shipped file. It spans two pages since the
  village square was paved: blending is pairwise, so an eighth terrain costs
  a pair against every other one, and 5328 tiles do not fit the 4096 a 2048
  page holds at 32px. The loader is a multiatlas and takes that in its
  stride; a *third* page would mean something had grown again.
- **Sprite sheets must come from `--sheets`**, which always writes 1:1 art.
  The GIFs and PNGs those commands write alongside are QA renders scaled up
  by `--scale`, and would draw several times too large. (`terrain-characters`
  needs no flag — it only ever writes game-ready output.)
- **Only the characters the world actually places are copied.** The generator
  will roll as many generic villagers as you ask for; the list in the loop
  above has to stay in step with `VILLAGER_CHARACTERS` in
  `src/world/characters.ts`, which is what the game loads.

Nothing in the game draws a placeholder any more. An object the world places
that resolves to neither a building sprite nor a fixture throws at spawn
rather than falling back to a coloured disc — a silent grey circle is how a
missing sprite survives to a release. `assets.test.ts` generates a world and
checks every placed object resolves, so that throw is unreachable in
practice and provably so.

Crops ship all three growth stages and the game now uses all of them:
planting drops a seedling and each successful cast of the addition spell
advances one stage. Growth is a change of animation on the same sprite, not
a swap — one sheet per crop with a row per stage is exactly what makes that
possible.

The interface art is the one set with no per-file sidecar. A panel has no
frames, no footprint and no animations to describe, so the generator ships a
single `ui.json` index instead: which file, how big, and where the parchment
frame's nine-slice cuts fall. The parchment is two assets rather than one on
purpose — a *seamless* fill the game tiles, and a border whose middle is
empty. A nine-slice stretches its middle, and stretching mottled paper
smears the grain into streaks; stretching nothing is safe.

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

## Testing

Three layers, and the middle one is the one that pays.

**Rules — `src/world/session.ts`.** Everything the player can do, with none
of what it looks like: position, facing, inventory, purse, and every action
with the message it produces. No Phaser. The whole loop — plant, cast twice,
pick, sell, buy, put down, take back — is a few lines of arithmetic in
`session.test.ts` and runs in milliseconds, which is what makes the awkward
scenarios affordable: selling a crop you do not have, fencing yourself into a
corner, casting on bare ground. None of those were ever tested while the
rules lived inside the scene, because each would have meant another browser
run and another screenshot to squint at.

**Art — the asset generator's own suite.** Pixel-level assertions belong
where the output is deterministic and pure. They have caught real bugs:
hands drawn below the ground line, and a boulder floating a third of a tile
above the ground it was supposed to be sitting on.

**Wiring — a browser.** What is left is what only a real loader and a real
input path can show: a texture key that resolves, a hit area over the right
tile, a tray that opens. Keep these few.

### Driving the game from a script

The game offers deliberate seams rather than being monkeypatched from
outside, all gated on `import.meta.env.DEV` (see `src/scenes/devHooks.ts`):

| | |
|---|---|
| `?seed=N` | fixes the spell's problems, so a script knows the sums |
| `?freezeNpcs` | holds villagers on their home tiles |
| `?coins=N` | starts with money, so a shop test need not farm first |
| `?lang=xx` | forces the language for one run, over the browser's and the saved choice |
| `?intro` | asks the postal worker for the welcome again, without clearing the saved settings — and is the one thing `?freezeNpcs` still lets him move for |
| `?skipTitle` | starts the game without waiting at the title card **or at the who's-playing screen** — every browser script needs this, since the world does not exist until somebody has said go and picked a player. Plays the most recent player, and makes one (saved, so a reload finds the same world) if the device has none |
| `?at=col,row` | starts the player on that tile. The world is five hundred tiles across and most of what is worth looking at is nowhere near where they start; walking a script there takes minutes and gets stuck on the first thing it cannot path around, and moving the session alone leaves the sprite and the camera behind |
| `?hour=N` | pins the clock, so night can be looked at without waiting for it (`?hour=22`, `?hour=6.5`). Moves the tint, the lights *and* whether the villagers are out — everything that reads the hour, which is the point |
| `window.__mathemagicum` | `{ session, ui(), doors(), npcs(), screenOf(), spell() }` — read state; look up buttons, doors and people by name; convert a tile to a screen position; read the cast on the parchment, since a script cannot answer a sum it cannot see |

Each replaced something that had gone wrong. Pinning `Date.now` to make the
spell predictable also stalled the walk tween, so sprites drew a tile from
where the camera said the player was, and three separate "the tap is broken"
conclusions turned out to be the test's own doing. Button coordinates copied
into scripts by hand silently pointed at their neighbour the day the action
bar grew a fourth slot — a test meaning to cast a spell planted a seed, and
the symptom surfaced three steps later as a tray that would not open. And a
colour search for a spell effect could not have succeeded at all, because the
night tint had shifted every reference value.

`screenOf` is there because computing a tile's screen position from the
camera centre holds outdoors and quietly stops holding indoors: a room is
smaller than the viewport, so the camera clamps and the player is nowhere
near the middle. Two runs' worth of taps landed on the floor beside the
shopkeeper and the game answered "Can't walk there".

So: assert on state read back through the handle, look buttons up by name,
and keep screenshots as artefacts for a human rather than as assertions.

On the gate, precisely: `__mathemagicum` is **absent** from a production
bundle — the export is dropped. The parameter names are not; a minifier
leaves the parsing function's string literals behind even though nothing
reaches them, because `devOptions()` folds to a constant before the call. So
grepping a release for `freezeNpcs` finds a hit, and the gate is still
holding: the options are never read, and there is no handle to reach.

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

## Deploying

Pushing to `main` publishes the game to GitHub Pages
(`.github/workflows/pages.yml`).

Two things have to be true of the repository itself, and neither can be done
from a workflow. Pages must be switched on with its source set to **GitHub
Actions**, under Settings → Pages — `configure-pages` can create the site
via the API, but only with `administration: write`, which is not a
permission `GITHUB_TOKEN` can be granted at any setting. And on GitHub Free,
Pages publishes from a **public** repository only.

`dist/` is host-agnostic and is meant to stay that way. `vite.config.ts`
builds with a **relative** base and `BootScene` prefixes every runtime asset
URL with `import.meta.env.BASE_URL`, so the same folder works served from a
domain root, from a project subpath like `/mathemagicum/`, or unzipped into
a directory and opened over a plain file server. The service worker
registers at `./sw.js` with a `./` scope for the same reason, which is what
lets the installed game work from a subpath at all — a root-scoped worker
would need a `Service-Worker-Allowed` header GitHub Pages will not send.

Nothing in the deploy passes `VITE_BASE`. It exists as an escape hatch if a
host ever needs an absolute path, and setting it would pin the build to that
one host.

To check a subpath build by hand, serve `dist/` under a prefix and watch the
*status codes* rather than the failures — a missing icon or a mis-based
service worker comes back as a perfectly successful `404`, which
`requestfailed` never sees.

## License

- Source code: [PolyForm Noncommercial 1.0.0](LICENSE) — noncommercial use,
  modification, and redistribution only.
- Art, audio, and other creative assets (once added): CC-BY-NC-ND-4.0.

See [`REUSE.toml`](REUSE.toml) for the per-path license mapping.
