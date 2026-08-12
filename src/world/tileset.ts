// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import type { WorldGrid } from "./grid";
import { TerrainType } from "./terrain";

// The 47-tile "blob" autotile scheme: see tools/tileset-gen/src/
// tileset_gen/blob.py's module docstring for the full explanation. This
// file's bit constants and reduceBlobMask() MUST match that module's
// exactly — the generator decides which masks to draw PNGs for, this
// file decides which mask a live tile's actual neighbours produce, and
// they only agree if both reductions are identical.
export const UP = 1;
export const RIGHT = 2;
export const DOWN = 4;
export const LEFT = 8;
export const UP_LEFT = 16;
export const UP_RIGHT = 32;
export const DOWN_RIGHT = 64;
export const DOWN_LEFT = 128;

// Screen-adjacent grid offset for each bit. Direction names match
// GameScene.ts's DirectionTag (up/down/left/right), not compass points.
// The 4 diagonals are pure rendering data — WorldGrid/pathfinding/
// connectivity only ever use the 4 orthogonal neighbours (see
// pathfinding.ts's DELTAS) — so there's nothing to keep in sync there,
// this just reads grid.getTerrain() at 4 extra offsets.
interface NeighborOffset {
  dCol: number;
  dRow: number;
  bit: number;
}

export const EDGE_OFFSETS: readonly NeighborOffset[] = [
  { dCol: 0, dRow: -1, bit: UP },
  { dCol: 1, dRow: 0, bit: RIGHT },
  { dCol: 0, dRow: 1, bit: DOWN },
  { dCol: -1, dRow: 0, bit: LEFT },
];

export const CORNER_OFFSETS: readonly NeighborOffset[] = [
  { dCol: -1, dRow: -1, bit: UP_LEFT },
  { dCol: 1, dRow: -1, bit: UP_RIGHT },
  { dCol: 1, dRow: 1, bit: DOWN_RIGHT },
  { dCol: -1, dRow: 1, bit: DOWN_LEFT },
];

const NEIGHBOR_OFFSETS: readonly NeighborOffset[] = [...EDGE_OFFSETS, ...CORNER_OFFSETS];

// Zeroes every corner bit that isn't currently distinguishable (its two
// flanking edges aren't both "same terrain") — collapses the raw 256
// (8-bit) space down to the 47 canonical values.
export function reduceBlobMask(rawMask: number): number {
  let mask = rawMask;
  if (mask & UP || mask & LEFT) mask &= ~UP_LEFT;
  if (mask & UP || mask & RIGHT) mask &= ~UP_RIGHT;
  if (mask & DOWN || mask & RIGHT) mask &= ~DOWN_RIGHT;
  if (mask & DOWN || mask & LEFT) mask &= ~DOWN_LEFT;
  return mask;
}

function computeCanonicalBlobMasks(): readonly number[] {
  const seen = new Set<number>();
  const ordered: number[] = [];
  for (let raw = 0; raw < 256; raw++) {
    const reduced = reduceBlobMask(raw);
    if (!seen.has(reduced)) {
      seen.add(reduced);
      ordered.push(reduced);
    }
  }
  return ordered;
}

// The 47 unique reduced values — same derivation as tools/tileset-gen's
// canonical_masks(), computed independently rather than hardcoded so a
// mistake in either implementation shows up as a mismatch, not silently
// agrees by copy-paste.
export const CANONICAL_BLOB_MASKS: readonly number[] = computeCanonicalBlobMasks();

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

// Contract with tools/tileset-gen: only the fully-interior mask (0) gets
// TILE_VARIANTS distinct textures (named "<terrain>-blob-0-<variant>.png")
// — by far the most common case (open ground), so it's the one that would
// otherwise visibly repeat. Every other mask gets exactly one PNG, named
// "<terrain>-blob-<mask>.png".
export const TILE_VARIANTS = 4;

export const TERRAIN_TYPES: readonly TerrainType[] = Object.values(TerrainType);

// Deterministic per-tile variant so the same (col, row) always renders the
// same texture — reloading or re-panning past a tile can't make it flicker
// to a different look. A cheap integer hash, not anything cryptographic.
export function tileVariantFor(col: number, row: number): number {
  const hash = (col * 374761393 + row * 668265263) >>> 0;
  return hash % TILE_VARIANTS;
}

// mask 0 is the only one with more than one variant (see TILE_VARIANTS);
// `variant` is ignored for every other mask, so callers enumerating keys
// to preload can omit it entirely for those.
export function blobTileKey(terrain: TerrainType, mask: number, variant = 0): string {
  if (mask === 0) return `${terrain}-blob-0-${variant}`;
  return `${terrain}-blob-${mask}`;
}

export function terrainTileKey(
  terrain: TerrainType,
  mask: number,
  col: number,
  row: number,
): string {
  return blobTileKey(terrain, mask, tileVariantFor(col, row));
}

export function terrainPriorityRank(terrain: TerrainType): number {
  return TERRAIN_PRIORITY.indexOf(terrain);
}

// A tile's own cut mask counts a neighbour only if it's BOTH a different
// terrain AND higher priority. A higher-priority terrain is never cut by
// anything lower — it stays a full plain tile (this is why grass, the
// top of TERRAIN_PRIORITY, always renders as mask 0: nothing outranks
// it). The lower-priority terrain is the one that visibly gets eaten
// into, via edgeWedgeKey/cornerWedgeKey below — that split is what makes
// the reveal correct without needing one tile per terrain PAIR: cutting
// only ever exposes what a wedge draws, never "whatever happens to be
// underneath." Off the edge of the world counts as "same" (no cut):
// nothing beyond the border to blend toward.
export function ownCutMaskFor(
  grid: WorldGrid,
  col: number,
  row: number,
  terrain: TerrainType,
): number {
  const rank = terrainPriorityRank(terrain);
  let mask = 0;
  for (const { dCol, dRow, bit } of NEIGHBOR_OFFSETS) {
    const nCol = col + dCol;
    const nRow = row + dRow;
    if (!grid.inBounds(nCol, nRow)) continue;
    const neighborTerrain = grid.getTerrain(nCol, nRow);
    if (neighborTerrain !== terrain && terrainPriorityRank(neighborTerrain) > rank) {
      mask |= bit;
    }
  }
  return reduceBlobMask(mask);
}

// Wedge tiles: a higher-priority terrain encroaching into a lower-
// priority neighbour's own tile from one edge or corner direction — the
// exact alpha inverse of what ownCutMaskFor cuts away there (see
// blob.py's _wedge_tile for why it has to be the literal inverse, not an
// approximation built from the OTHER 3 edges' cuts — that was tried
// first and left gaps near corners, since edge_cut's u/v terms for
// different edges don't share zero-crossings). Not derived from
// CANONICAL_BLOB_MASKS — those all cut a notch FROM a solid tile, never
// the reverse — so tools/tileset-gen generates these separately, 4
// edges + 4 corners per terrain.
export function edgeWedgeKey(terrain: TerrainType, edgeBit: number): string {
  return `${terrain}-edge-${edgeBit}`;
}

export function cornerWedgeKey(terrain: TerrainType, cornerBit: number): string {
  return `${terrain}-corner-${cornerBit}`;
}
