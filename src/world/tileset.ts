// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import type { WorldGrid } from "./grid";
import { TerrainType } from "./terrain";

// Modern "dual-grid" autotiling: the tiles actually drawn sit on a grid
// offset by half a cell (both axes) from the terrain data grid, so each
// drawn diamond's four vertices each land on exactly one data cell,
// rather than each drawn tile being centered ON a data cell and needing
// to know about all 8 of its neighbours. Concretely, the dual tile
// "indexed" at (col, row) is centered at grid position (col + 0.5,
// row + 0.5); gridToScreen is linear, so that center is just
// gridToScreen(col, row) shifted by (0, TILE_HEIGHT / 2) — see
// GameScene.ts's activateChunk for the resulting draw-offset trick. Its
// four vertices land on these four data cells:
//
//   UP    = (col,     row    )
//   RIGHT = (col + 1, row    )
//   DOWN  = (col + 1, row + 1)
//   LEFT  = (col,     row + 1)
//
// A dual tile's mask for a given terrain has exactly the bits of the
// corners that ARE that terrain — no reduction step (every one of the 16
// combinations is visually distinguishable, unlike the old 8-neighbour
// blob scheme this replaced), and no wedge tiles: cornerMaskFor is the
// same 4-bit computation regardless of which terrain is being tested, so
// GameScene draws each TERRAIN_PRIORITY layer with one uniform pass over
// the dual grid instead of a separate "own cut" vs "neighbour's wedge"
// case split. See tools/tileset-gen/src/tileset_gen/dual_grid.py's module
// docstring for the bilinear alpha math the generator uses to make a
// terrain's own tile fade smoothly toward whichever corners it doesn't
// own — the bit constants and corner-offset layout here MUST match that
// module's exactly, same cross-language contract the old scheme had.
export const UP = 1;
export const RIGHT = 2;
export const DOWN = 4;
export const LEFT = 8;

interface CornerOffset {
  dCol: number;
  dRow: number;
  bit: number;
}

const CORNER_OFFSETS: readonly CornerOffset[] = [
  { dCol: 0, dRow: 0, bit: UP },
  { dCol: 1, dRow: 0, bit: RIGHT },
  { dCol: 1, dRow: 1, bit: DOWN },
  { dCol: 0, dRow: 1, bit: LEFT },
];

// Masks 1-15: every combination except "none of my corners are this
// terrain" (0), which is fully transparent and needs no PNG — the
// renderer just skips drawing this terrain's layer for that dual tile.
export const DRAWABLE_MASKS: readonly number[] = Array.from({ length: 15 }, (_, i) => i + 1);

// Draw order for GameScene's chunk renderer: lowest first (fully covered
// by anything drawn after it), highest last (visible edge cuts into
// everything below). Confirmed with the user: water is the "coastline"
// everything else cuts into; grass reads as sitting on top of everything.
export const TERRAIN_PRIORITY: readonly TerrainType[] = [
  TerrainType.Water,
  TerrainType.Rock,
  TerrainType.Sand,
  TerrainType.Dirt,
  TerrainType.Grass,
];

// The one mask whose 4 corners are all `terrain` — i.e. the plain
// fully-interior tile, by far the most common case in open ground.
export const FULL_MASK = 15;

// Contract with tools/tileset-gen: every mask gets TILE_VARIANTS distinct
// textures (named "<terrain>-dual-<mask>-<variant>.png"), not just
// FULL_MASK — a partial mask's edge has its own random wobble (see
// dual_grid.py's _make_boundary_noise) that would otherwise repeat
// identically at every tile sharing that mask along a long straight
// boundary.
export const TILE_VARIANTS = 4;

export const TERRAIN_TYPES: readonly TerrainType[] = Object.values(TerrainType);

// Deterministic per-tile variant so the same (col, row) always renders the
// same texture — reloading or re-panning past a tile can't make it flicker
// to a different look. A cheap integer hash, not anything cryptographic.
// Used for both primal (col, row) and dual (col, row) indices — it's just
// a hash of two integers, it doesn't care which grid they came from.
export function tileVariantFor(col: number, row: number): number {
  const hash = (col * 374761393 + row * 668265263) >>> 0;
  return hash % TILE_VARIANTS;
}

export function dualTileKey(terrain: TerrainType, mask: number, variant: number): string {
  return `${terrain}-dual-${mask}-${variant}`;
}

export function terrainPriorityRank(terrain: TerrainType): number {
  return TERRAIN_PRIORITY.indexOf(terrain);
}

// Off-grid corners clamp to the nearest in-bounds cell rather than
// counting as some fixed "background" terrain — the dual grid extends
// one row/column of tiles beyond the data grid on every side (see
// GameScene.ts's activateChunk), and clamping means those edge tiles
// blend toward whatever the world's actual border terrain is instead of
// popping to an arbitrary fallback.
function clampedTerrain(grid: WorldGrid, col: number, row: number): TerrainType {
  const c = Math.min(Math.max(col, 0), grid.width - 1);
  const r = Math.min(Math.max(row, 0), grid.height - 1);
  return grid.getTerrain(c, r);
}

// The dual tile "indexed" at (dualCol, dualRow) — see this file's module
// docstring for which 4 data cells that corresponds to. Bit `bit` is set
// when that corner IS `terrain` — used identically for every terrain in
// TERRAIN_PRIORITY (no "own cut" vs "wedge" distinction like the old
// scheme needed), so GameScene calls this once per (terrain, dual tile)
// and just skips the draw when the result is 0.
export function cornerMaskFor(
  grid: WorldGrid,
  dualCol: number,
  dualRow: number,
  terrain: TerrainType,
): number {
  let mask = 0;
  for (const { dCol, dRow, bit } of CORNER_OFFSETS) {
    if (clampedTerrain(grid, dualCol + dCol, dualRow + dRow) === terrain) {
      mask |= bit;
    }
  }
  return mask;
}

// The terrain GameScene draws SOLID (its own FULL_MASK tile, not cut to
// its actual corner mask) underneath this dual tile's normal
// TERRAIN_PRIORITY layers — the lowest-priority terrain actually present
// among the tile's 4 corners, not always water.
//
// This isn't just a defensive backdrop (see the old 47-blob scheme's
// comment about "a patch of water" — this replaces that): each real
// terrain's own alpha here is an exact bilinear partition (they sum to
// 1 across the tile), but standard source-over compositing of several
// semi-transparent layers does NOT reconstruct that sum for anything
// below the topmost layer — algebraically, compositing dirt(alpha 1-q)
// then grass(alpha q) over an opaque base color Cbase works out to
// q*Cg + (1-q)^2*Cd + q(1-q)*Cbase, not the desired q*Cg + (1-q)*Cd.
// Those are equal only when Cbase = Cd — i.e. the base has to equal the
// color of the terrain that would otherwise show through, or a
// completely unrelated color (e.g. water's blue at a grass/dirt border
// with no water corner at all) visibly bleeds through every boundary,
// not just rare 3+-terrain junctions. Using the lowest-priority PRESENT
// terrain as the base makes every 2-terrain boundary composite exactly;
// a genuine 3+-terrain junction can still lose a little of a MIDDLE-
// priority terrain's share to whichever terrain is under it, but never
// bleeds in a terrain that isn't actually one of the tile's 4 corners.
export function baseTerrainFor(grid: WorldGrid, dualCol: number, dualRow: number): TerrainType {
  let best: TerrainType = clampedTerrain(grid, dualCol, dualRow);
  let bestRank = terrainPriorityRank(best);
  for (const { dCol, dRow } of CORNER_OFFSETS) {
    const terrain = clampedTerrain(grid, dualCol + dCol, dualRow + dRow);
    const rank = terrainPriorityRank(terrain);
    if (rank < bestRank) {
      bestRank = rank;
      best = terrain;
    }
  }
  return best;
}
