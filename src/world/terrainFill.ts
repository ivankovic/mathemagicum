// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import type { AreaPlacement } from "./anchors";
import { type HighCorner, bandFloor, elevationAt, groundAt, highEdges } from "./elevation";
import type { WorldGrid } from "./grid";
import { Habitat } from "./habitat";
import { TerrainType } from "./terrain";

// How deep the far edges are forced to open water. Two tiles rather than
// one: the warp can lift a tile at the very edge into the sand band, and a
// world whose "sea" is a one-tile trim of beach does not read as a sea.
const SHORE_DEPTH = 2;

/**
 * Paints every tile from its height on the slope (see elevation.ts).
 *
 * Every tile, story areas included. They used to be skipped and left at the
 * grid's default grass, which made each one a green rectangle sitting in
 * whatever it had been placed in — a lawn in the mountains, a lawn on the
 * beach. A story area should look like it belongs where it is; what makes it
 * *usable* is `flattenReservedAreas`, not a different terrain.
 */
export function fillFromElevation(grid: WorldGrid, corner: HighCorner, seed: number): void {
  for (let row = 0; row < grid.height; row++) {
    for (let col = 0; col < grid.width; col++) {
      const elevation = elevationAt(col, row, grid.width, grid.height, corner, seed);
      const ground = groundAt(col, row, elevation, seed);
      grid.setTerrain(col, row, ground.terrain);
      grid.setHabitat(col, row, ground.habitat);
    }
  }
}

// What impassable ground becomes inside a story area: the next band in
// toward the walkable middle. Rock gives way to the slope below it and sea
// to the shore above it, so a cleared area still reads as part of the
// landscape it was cut from rather than as a patch of something else.
const WALKABLE_INSTEAD: Partial<Record<TerrainType, TerrainType>> = {
  [TerrainType.Mountain]: TerrainType.Hilly,
  [TerrainType.Water]: TerrainType.Sand,
};

/**
 * Makes the ground inside each story area walkable without flattening how it
 * looks.
 *
 * These are the five places the game will build content in, so a player has
 * to be able to stand in them — but the Observatory sits in the mountain and
 * the Harbour on the shore, and both would otherwise be largely rock and
 * sea. Only the impassable tiles change, and each becomes the band next to
 * it, so the Observatory reads as a shelf in the rock and the Harbour as a
 * beach rather than either becoming a lawn.
 */
export function flattenReservedAreas(
  grid: WorldGrid,
  reservedBoxes: readonly AreaPlacement[],
): void {
  for (const box of reservedBoxes) {
    for (let row = box.row; row < box.row + box.height; row++) {
      for (let col = box.col; col < box.col + box.width; col++) {
        if (!grid.inBounds(col, row)) continue;
        const instead = WALKABLE_INSTEAD[grid.getTerrain(col, row)];
        if (instead) grid.setTerrain(col, row, instead);
      }
    }
  }
}

/**
 * Forces the two edges furthest from the high corner to open water.
 *
 * The slope already sends them there, but "already sends them there" is not
 * the same as "is water": the warp that gives the coastline its shape can
 * lift a tile at the very edge into sand or grass. These two edges are the
 * far side of the world and the design calls for them to read as sea, so
 * they are set rather than sampled.
 *
 * The other two edges are left alone. They climb from the high corner, so
 * they are mountain and woodland along most of their length and reach the
 * water only where they meet the low corner — a ridge running down to the
 * sea, which needs no forcing.
 */
export function sealFarEdges(grid: WorldGrid, corner: HighCorner): void {
  const edges = highEdges(corner);
  for (let row = 0; row < grid.height; row++) {
    for (let col = 0; col < grid.width; col++) {
      const fromLeft = col;
      const fromRight = grid.width - 1 - col;
      const fromTop = row;
      const fromBottom = grid.height - 1 - row;
      const horizontal = edges.left ? fromRight : fromLeft;
      const vertical = edges.top ? fromBottom : fromTop;
      if (Math.min(horizontal, vertical) >= SHORE_DEPTH) continue;
      grid.setTerrain(col, row, TerrainType.Water);
      grid.setHabitat(col, row, Habitat.Coastal);
    }
  }
}

/** Elevation above which the ground is walled by rock or forest, not sea. */
export function barrierFloor(): number {
  return bandFloor(TerrainType.Woodland);
}
