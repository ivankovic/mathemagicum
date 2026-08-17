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

function isInsideAnyBox(col: number, row: number, boxes: readonly AreaPlacement[]): boolean {
  return boxes.some(
    (b) => col >= b.col && col < b.col + b.width && row >= b.row && row < b.row + b.height,
  );
}

/**
 * Paints every tile from its height on the slope (see elevation.ts).
 *
 * Reserved anchor boxes are skipped — that is story-area interior
 * generation, deliberately not built yet — and so is anything the village
 * already carved, since layout runs first and its paths and gardens are not
 * natural ground.
 */
export function fillFromElevation(
  grid: WorldGrid,
  corner: HighCorner,
  seed: number,
  reservedBoxes: readonly AreaPlacement[],
): void {
  for (let row = 0; row < grid.height; row++) {
    for (let col = 0; col < grid.width; col++) {
      if (isInsideAnyBox(col, row, reservedBoxes)) continue;
      const elevation = elevationAt(col, row, grid.width, grid.height, corner, seed);
      const ground = groundAt(col, row, elevation, seed);
      grid.setTerrain(col, row, ground.terrain);
      grid.setHabitat(col, row, ground.habitat);
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
