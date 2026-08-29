// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import type { WorldGrid } from "./grid";
import { TerrainType } from "./terrain";
import { TILE_SIZE } from "./topdown";

// Terrain rendering, in full: read the terrain at a tile's four corners,
// join them into a frame name, draw that frame. There is no autotile mask,
// no priority table and no layer stack here, because the atlas ships a
// finished tile for every one of the 7^4 corner assignments — including the
// cells where three or four terrains meet, which no bitmask scheme can
// express and which the generator would otherwise only composite in Python.
// See ~/src/asset-generator's README ("Delivery formats").
export const TERRAIN_ATLAS_KEY = "terrain";

// Dual grid: the tiles drawn are offset half a cell from the terrain data
// cells, so each drawn tile's four *corners* land on exactly one data cell
// each. That is what lets a region have an organic outline instead of
// stair-stepping along cell boundaries — the boundary runs through tiles
// rather than between them.
//
// The dual tile indexed (col, row) reads these four data cells:
//
//   nw = (col,     row    )     ne = (col + 1, row    )
//   sw = (col,     row + 1)     se = (col + 1, row + 1)
//
// and is drawn at gridToScreen(col, row) shifted by DUAL_OFFSET on both
// axes, which is exactly the centre of data cell (col, row). The corner
// order here MUST match the generator's CORNERS = (nw, ne, se, sw), since
// that order is what the frame name encodes.
export const DUAL_OFFSET = TILE_SIZE / 2;

export type CornerTerrains = readonly [TerrainType, TerrainType, TerrainType, TerrainType];

// Data cells for the dual tile at (col, row), clamped at the world edge.
// Clamping rather than skipping is what makes the dual grid cover the whole
// data grid: the outermost ring of dual tiles is centred half a cell outside
// it, so without a clamp the first and last row/column of real terrain would
// have nothing drawn over their outer half.
export function cornerTerrainsFor(grid: WorldGrid, col: number, row: number): CornerTerrains {
  const clampCol = (c: number) => Math.min(Math.max(c, 0), grid.width - 1);
  const clampRow = (r: number) => Math.min(Math.max(r, 0), grid.height - 1);
  const west = clampCol(col);
  const east = clampCol(col + 1);
  const north = clampRow(row);
  const south = clampRow(row + 1);
  return [
    grid.getTerrain(west, north),
    grid.getTerrain(east, north),
    grid.getTerrain(east, south),
    grid.getTerrain(west, south),
  ];
}

// The dual grid runs one tile further back than the data grid on each axis:
// its first tile is indexed -1 so that its se corner is data cell (0, 0).
export const DUAL_ORIGIN = -1;

export function comboKey(corners: CornerTerrains): string {
  return corners.join("_");
}

export function frameName(corners: CornerTerrains, variation: number): string {
  return `${comboKey(corners)}_${variation}`;
}

/**
 * How many variations the atlas actually ships for each corner combination.
 *
 * Read from the loaded texture's frame names rather than hardcoded, because
 * the generator scales variation count with how often a combination recurs
 * on screen — fills get the most, three- and four-terrain cells get one. A
 * copy of that rule here would be a second cross-language contract to keep
 * in sync, and the one thing the frame names already tell us for free.
 */
export function buildVariationIndex(frameNames: Iterable<string>): Map<string, number> {
  const counts = new Map<string, number>();
  for (const name of frameNames) {
    const split = name.lastIndexOf("_");
    if (split < 0) continue;
    const combo = name.slice(0, split);
    const variation = Number(name.slice(split + 1));
    if (!Number.isInteger(variation)) continue;
    counts.set(combo, Math.max(counts.get(combo) ?? 0, variation + 1));
  }
  return counts;
}

// Deterministic per-tile scatter. Variation has to be stable across chunk
// evictions — a tile that redraws with a different variant when the camera
// comes back would visibly shimmer — so it is derived from the coordinates
// rather than drawn from an RNG at paint time.
export function variationFor(col: number, row: number, count: number): number {
  if (count <= 1) return 0;
  let hash = (col * 0x1f1f1f1f) ^ (row * 0x3b9aca07);
  hash = Math.imul(hash ^ (hash >>> 15), 0x2c1b3c6d);
  hash = Math.imul(hash ^ (hash >>> 12), 0x297a2d39);
  hash ^= hash >>> 15;
  return (hash >>> 0) % count;
}

// The frame to draw for one dual tile. Falls back to variation 0 when a
// combination is missing a variant, and reports an unknown combination as
// null so a caller can decide whether that is a bug or an empty edge.
export function frameFor(
  corners: CornerTerrains,
  col: number,
  row: number,
  variations: ReadonlyMap<string, number>,
): string | null {
  const combo = stillCombo(corners);
  if (combo === null) return null;
  const count = variations.get(combo);
  if (count === undefined || count <= 0) return null;
  return `${combo}_${variationFor(col, row, count)}`;
}

// --- water that moves -------------------------------------------------------
//
// The sea is drawn in two halves, and this is the game's half of that
// bargain. A chunk is baked once and never touched again — rebaking the ones
// on screen measured at twenty-odd milliseconds, a dropped frame every tick —
// so the ground cannot animate by being redrawn. What animates is a sprite
// *under* the chunk, and the chunk is baked with a hole in it.
//
// So a tile that touches water bakes its `dry_` frame: the land, the rim and
// the foam, with the open water cut out and left transparent. A tile of
// nothing but sea bakes nothing at all. Underneath both, one wave sprite per
// tile, cycling.
//
// The generator holds up the other end and asserts it exactly: a wave frame
// with its cutout laid over the top is the tile the atlas used to ship, pixel
// for pixel. It costs fifty-six frames more than the still world did, because
// a coastline's land is drawn once rather than once per phase.

/** Whether any of a tile's corners is sea. */
export function touchesWater(corners: CornerTerrains): boolean {
  return corners.includes(TerrainType.Water);
}

/**
 * The still half of a tile: what gets baked into the chunk.
 *
 * Null for open sea, which has no still half — the wave sprite is the whole
 * picture there, and baking a fully transparent frame over it would be a
 * draw call to say nothing.
 */
export function stillCombo(corners: CornerTerrains): string | null {
  if (!touchesWater(corners)) return comboKey(corners);
  if (corners.every((corner) => corner === TerrainType.Water)) return null;
  return `dry_${comboKey(corners)}`;
}

/** How many wave frames there are, and how many steps round they go. */
export interface WaterFrames {
  variations: number;
  phases: number;
}

/**
 * Read the sea's shape out of the loaded atlas, the way everything else here
 * is read: from the frame names, rather than from a number written down on
 * both sides of a language boundary.
 */
export function waterFrames(frameNames: Iterable<string>): WaterFrames {
  let variations = 0;
  let phases = 0;
  for (const name of frameNames) {
    const parts = name.split("_");
    if (parts.length !== 3 || parts[0] !== "wave") continue;
    const variation = Number(parts[1]);
    const phase = Number(parts[2]);
    if (!Number.isInteger(variation) || !Number.isInteger(phase)) continue;
    variations = Math.max(variations, variation + 1);
    phases = Math.max(phases, phase + 1);
  }
  return { variations, phases };
}

/**
 * Which sea to draw under a tile, this many steps into the cycle.
 *
 * The phase is offset per tile rather than shared. A whole sea stepping
 * together reads as a flicker; the same ripples starting at different points
 * read as water. The offset is a hash of the coordinates for the same reason
 * the variation is — a tile whose sea jumped when the camera came back would
 * be worse than one that never moved.
 *
 * The variation is hashed apart from the still half's, because the two do not
 * have the same number to choose from: open water is one terrain and gets
 * eight variants, a coastline is two and gets four. They need not agree — the
 * cutout's hole is exactly the open water either way, and one set of ripples
 * fills it as well as another.
 */
export function waveFrameFor(col: number, row: number, phase: number, water: WaterFrames): string {
  const variation = variationFor(col, row, water.variations);
  const offset = variationFor(row, col, water.phases);
  return `wave_${variation}_${(phase + offset) % water.phases}`;
}
