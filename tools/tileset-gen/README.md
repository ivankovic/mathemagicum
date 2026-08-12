# tileset-gen

Procedural pixel-art tileset generator for Mathemagicum. Produces the
terrain diamond tiles the game renders (see `src/world/terrain.ts` /
`src/scenes/GameScene.ts`) as real textured PNGs instead of flat colors —
code-authored (palette, dithering, faceting), not AI-generated or
hand-drawn. Every tile fill is flat, not gradient-shaded — a per-tile
gradient resets at every tile boundary and reads as a seam on a real
tiled floor, even with no outline of its own; see `shading.py`.

Uses the 47-tile "blob" autotile scheme (edge + corner neighbour
matching) so terrain boundaries blend smoothly, priority-ordered so any
two terrains blend correctly without needing art for every pair — see
`src/tileset_gen/blob.py`'s module docstring for the full explanation,
and `src/world/tileset.ts` for the renderer side (`TERRAIN_PRIORITY`,
`ownCutMaskFor`, `GameScene.activateChunk`).

## Usage

```sh
cd tools/tileset-gen
uv run tileset-gen
```

Writes three kinds of 64x32 PNG to `public/assets/tiles/`. Deterministic:
the same `--seed` (default `1`) always reproduces the same tiles.

```sh
uv run tileset-gen --seed 2 --out /tmp/preview
```

**Blob tiles** — `<terrain>-blob-<mask>.png`, one per terrain per
canonical neighbour-pattern mask (47 of them — see `blob.py`). Mask `0`
(fully interior, i.e. surrounded by itself) gets `--variants` (default 4)
distinct textures, named `<terrain>-blob-0-<variant>.png`, since it's by
far the most common tile and would otherwise repeat visibly; every other
mask gets exactly one. No baked-in edge outline — tiles sit flush against
their neighbors with no seam of their own.

**Wedge tiles** — `<terrain>-edge-<bit>.png` (4 per terrain) and
`<terrain>-corner-<bit>.png` (4 per terrain). A higher-priority terrain
encroaching into a lower-priority neighbour's own tile from one
edge/corner direction — the exact alpha inverse of what that neighbour's
own blob cuts away there (see `blob.py`'s `_wedge_tile`). This is what a
cut in a blob tile actually reveals at render time, not "whatever's
underneath" — using the wrong shape here (reusing an existing blob mask
as an approximation, rather than the literal inverse) was tried first and
left gaps near corners; see `_wedge_tile`'s docstring.

Wired into the game: `GameScene.ts`'s `activateChunk` draws one pass per
`TERRAIN_PRIORITY` entry, each tile either its own cut blob or, for
lower-priority tiles with a higher-priority neighbour, that neighbour's
wedge.

## Layout

- `src/tileset_gen/palette.py` — base colors (kept in sync by eye with
  `src/world/palette.ts`) and a lighten/darken helper.
- `src/tileset_gen/iso.py` — the diamond shape, matching
  `src/world/iso.ts`'s `TILE_WIDTH`/`TILE_HEIGHT` exactly.
- `src/tileset_gen/shading.py` — reusable primitives: flat fill, dot
  scatter.
- `src/tileset_gen/texture.py` — one generator function per terrain type.
- `src/tileset_gen/blob.py` — the 47-mask bitmask/reduction logic, blob
  tile generation, and edge/corner wedge generation.
- `src/tileset_gen/__init__.py` — the `tileset-gen` CLI.

## License

This tool's own code: PolyForm-Noncommercial-1.0.0, same as the rest of
the repo. The PNGs it outputs live under `public/assets/tiles/`, which
REUSE.toml declares CC-BY-NC-ND-4.0 — the game's separate asset license.
