# tileset-gen

Procedural pixel-art asset generation for Mathemagicum — code-authored
(palette, shading, geometry), not AI-generated or hand-drawn. Two CLIs
today: `tileset-gen` for terrain, `building-gen` for standalone building
sprites; both share `src/tileset_gen/palette.py`/`shading.py`.

## Terrain (`tileset-gen`)

Produces the terrain diamond tiles the game renders (see
`src/world/terrain.ts` / `src/scenes/GameScene.ts`) as real textured PNGs
instead of flat colors. Every tile fill is flat, not gradient-shaded — a
per-tile gradient resets at every tile boundary and reads as a seam on a
real tiled floor, even with no outline of its own; see `shading.py`.

Uses a "dual-grid" autotile scheme: the tiles actually drawn sit on a
grid offset by half a cell from the terrain data grid, so each drawn
diamond's four vertices each land on exactly one data cell — 16 corner-
membership combinations per terrain (minus the all-empty one, which
needs no PNG), priority-ordered so any two terrains blend correctly
without needing art for every pair. See `src/tileset_gen/dual_grid.py`'s
module docstring for the full geometry, and `src/world/tileset.ts` for
the renderer side (`TERRAIN_PRIORITY`, `cornerMaskFor`,
`GameScene.activateChunk`). This replaced an earlier 47-tile "blob"
(edge + corner neighbour matching) scheme — see git history for
`blob.py` if you need the old approach.

### Usage

```sh
cd tools/tileset-gen
uv run tileset-gen
```

Writes one kind of 64x32 PNG to `public/assets/tiles/`. Deterministic:
the same `--seed` (default `1`) always reproduces the same tiles.

```sh
uv run tileset-gen --seed 2 --out /tmp/preview
```

**Dual-grid tiles** — `<terrain>-dual-<mask>.png`, one per terrain per
drawable corner mask (15 of them, 1-15 — see `dual_grid.py`; mask 0,
none of the tile's 4 corners this terrain, is fully transparent and
needs no file). Mask `15` (all 4 corners, i.e. the fully-interior tile)
gets `--variants` (default 4) distinct textures, named
`<terrain>-dual-15-<variant>.png`, since it's by far the most common
tile and would otherwise repeat visibly; every other mask gets exactly
one. No baked-in edge outline — tiles sit flush against their neighbors
with no seam of their own.

Wired into the game: `GameScene.ts`'s `activateChunk` draws one pass per
`TERRAIN_PRIORITY` entry over the dual grid (one extra row/column beyond
the terrain data grid on every side), skipping any tile where that
terrain's corner mask is 0.

**Resolution:** generation happens at 128x64 — 2x the actual output
size — purely for smoother procedural detail and cleaner alpha edges;
every PNG is downsampled back to 64x32 before being saved (see
`shading.py`'s `downsample` — a thin wrapper over Pillow's own `resize`,
which already premultiplies alpha internally; see that function's
docstring for the double-premultiply bug an earlier, more "clever"
version of it had), which is exactly `src/world/iso.ts`'s
`TILE_WIDTH`/`TILE_HEIGHT`. The renderer never sees the larger size and
needs no changes to match it.

## Buildings (`building-gen`)

Produces standalone billboard sprites for `PlacedObject` types (the
village well, house, school, post-office, store — see
`src/world/villageLayout.ts`) as one PNG per type per variant, **not**
diamond tiles: a building needs to rise above and often overhang the
multi-tile footprint it sits on, which per-cell tile art can't express
(see `src/world/objects.ts`'s `PlacedObject.anchorCol` for the in-game
anchor point, and `GameScene.ts`'s `spawnBuildings`).

```sh
uv run building-gen
```

Writes `<type>-<variant>.png` to `public/assets/buildings/`, `--variants`
(default 4) of each — same seeding/flags as `tileset-gen`. The well gets
its own, smaller canvas (`WELL_CANVAS_*` in `buildings.py`) than the 4
cottage-shaped buildings share (`BUILDING_CANVAS_*`), matching its 1x1
footprint vs. their 4x4 (`villageLayout.ts`'s `BUILDING_SIZE`) — see
`buildings.py`'s module docstring.

## Layout

- `src/tileset_gen/palette.py` — base colors (kept in sync by eye with
  `src/world/palette.ts`) and a lighten/darken helper.
- `src/tileset_gen/iso.py` — the diamond shape, and the generation-vs-
  output resolution split (see "Resolution" above).
- `src/tileset_gen/shading.py` — reusable primitives: flat fill, dot
  scatter, the downsample.
- `src/tileset_gen/terrain.py` — one generator function per terrain type.
- `src/tileset_gen/dual_grid.py` — the corner-mask bilinear alpha logic
  and dual-grid tile generation.
- `src/tileset_gen/__init__.py` — the `tileset-gen` CLI.
- `src/tileset_gen/buildings.py` — one generator function per building
  type, and the shared cottage-shell helper.
- `src/tileset_gen/asset_cli.py` — shared CLI plumbing for "one generator
  per hardcoded name, N variants each" tools (today just `building_cli.py`
  — terrain's own masks/corner logic don't fit this shape).
- `src/tileset_gen/building_cli.py` — the `building-gen` CLI.

## License

This tool's own code: PolyForm-Noncommercial-1.0.0, same as the rest of
the repo. The PNGs it outputs live under `public/assets/tiles/`, which
REUSE.toml declares CC-BY-NC-ND-4.0 — the game's separate asset license.
