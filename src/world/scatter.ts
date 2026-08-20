// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import type { AreaPlacement } from "./anchors";
import type { WorldGrid } from "./grid";
import { smoothNoise } from "./noise";
import type { PlacedObject } from "./objects";
import { sceneryOn, sceneryType } from "./scenery";
import { TerrainType } from "./terrain";

/**
 * The trees, boulders and spires the ground grows.
 *
 * These used to exist only as a *wall*: hundreds of them packed along the
 * two edges of the map that were not sea, which is what stopped the player
 * walking out of the world. The rim is a cliff now — the ground simply steps
 * up at the edge, and the same rule that stops you climbing a cliff inland
 * stops you climbing out — and taking the wall away took every tree in the
 * world with it, because the wall was the only thing that had ever placed
 * one.
 *
 * So they are scattered instead, which is what a wood is. Density is a
 * property of the ground: thick through the woodland, thin on the meadows,
 * occasional boulders up in the rock. Each terrain grows its own — conifers
 * in the wood, spires in the mountains — so what stands on a tile is decided
 * by what the tile is rather than chosen, and a boulder never appears in the
 * middle of a wood.
 */

/**
 * Scenery blocks the one tile it grows out of, and stands anywhere.
 *
 * It used to be a 2x2 footprint on a 2-tile lattice, and the two were one
 * constant because they were the same number. They are different questions:
 * how much ground a tree takes, and how finely the world is sampled for
 * places to put one. Shrinking the art to a tile answered the first; the
 * second wants to be *finer*, not coarser, because a lattice as wide as the
 * object is a grid you can see — trees exactly two tiles apart in every
 * direction read as an orchard however the density is noised.
 */
const OBJECT_SIZE = 1;

/**
 * How much of each terrain is covered, as a share of its lattice positions.
 *
 * A wood is mostly trees and a meadow is mostly meadow — the numbers are the
 * whole difference between "a wood" and "a lawn with trees on it". Sand and
 * dirt get almost nothing: a beach with boulders every few paces reads as a
 * quarry.
 *
 * They are all about a quarter of what they were, and the world has about as
 * many trees in it as before: the lattice went from two tiles to one, which
 * is four times as many places to stand, so a quarter of the share is the
 * same count. What changed is that trees may now stand *next to* each other,
 * which is what a thicket is.
 *
 * The count matters as much as the look. Every one of these is a sprite with
 * a sway animation playing on it, and a five-hundred-cell world carries
 * thirteen thousand of them — quadrupling that to keep the old fractions
 * would have been a decision about frame rate dressed up as one about woods.
 */
export const SCATTER_DENSITY: Partial<Record<TerrainType, number>> = {
  [TerrainType.Woodland]: 0.3,
  [TerrainType.Grass]: 0.03,
  [TerrainType.Hilly]: 0.11,
  [TerrainType.Mountain]: 0.15,
  [TerrainType.Sand]: 0.008,
  [TerrainType.Dirt]: 0.01,
};

/**
 * Over what distance the density wanders, in tiles.
 *
 * Clumped rather than even. A wood with its trees spread at a uniform
 * spacing reads as an orchard; what makes it a wood is thickets with
 * clearings between them, and this is the size of both.
 */
const CLUMP_PERIOD = 23;
const CLUMP_SEED_OFFSET = 4441;

function insideAnyBox(col: number, row: number, boxes: readonly AreaPlacement[]): boolean {
  return boxes.some(
    (b) =>
      col + OBJECT_SIZE > b.col &&
      col < b.col + b.width &&
      row + OBJECT_SIZE > b.row &&
      row < b.row + b.height,
  );
}

/**
 * What grows on this tile, or nothing.
 *
 * The level check reaches one cell further than the object does, and has to:
 * a cliff is drawn from the levels at a tile's four *corners*, so a tree
 * standing next to a step has the cliff line drawn across its trunk even
 * though the tree itself is on flat ground. Asking the ring around it keeps
 * scenery off the lip.
 */
function blockKind(grid: WorldGrid, col: number, row: number): string | null {
  if (!grid.inBounds(col, row)) return null;
  if (grid.getObjectAt(col, row)) return null;
  const kind = sceneryOn(grid.getTerrain(col, row));
  if (!kind) return null;
  const level = grid.getLevel(col, row);
  for (let r = row - 1; r <= row + 1; r++) {
    for (let c = col - 1; c <= col + 1; c++) {
      if (!grid.inBounds(c, r)) continue;
      if (grid.getLevel(c, r) !== level) return null;
    }
  }
  return kind;
}

export function scatterScenery(
  grid: WorldGrid,
  reservedBoxes: readonly AreaPlacement[],
  seed: number,
): PlacedObject[] {
  const placed: PlacedObject[] = [];
  for (let row = 0; row + OBJECT_SIZE <= grid.height; row += OBJECT_SIZE) {
    for (let col = 0; col + OBJECT_SIZE <= grid.width; col += OBJECT_SIZE) {
      if (insideAnyBox(col, row, reservedBoxes)) continue;
      const kind = blockKind(grid, col, row);
      if (!kind) continue;
      const density = SCATTER_DENSITY[grid.getTerrain(col, row)] ?? 0;
      if (density <= 0) continue;
      // Two fields multiplied: one that wanders slowly, making thickets and
      // clearings, and one per position that decides within them. A single
      // per-position roll gives an even sprinkle, which is an orchard.
      const clump = smoothNoise(col, row, CLUMP_PERIOD, seed + CLUMP_SEED_OFFSET);
      const here = smoothNoise(col * 3, row * 3, OBJECT_SIZE * 2, seed);
      if (here > density * 2 * clump * 2) continue;

      const object: PlacedObject = {
        id: `scenery-${col}-${row}`,
        type: sceneryType(kind),
        col,
        row,
        width: OBJECT_SIZE,
        height: OBJECT_SIZE,
        blocksMovement: true,
        anchorCol: col,
        anchorRow: row,
      };
      grid.placeObject(object);
      placed.push(object);
    }
  }
  return placed;
}
