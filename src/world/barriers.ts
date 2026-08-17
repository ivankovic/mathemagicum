// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import type { AreaPlacement } from "./anchors";
import { type HighCorner, highEdges } from "./elevation";
import type { WorldGrid } from "./grid";
import type { PlacedObject } from "./objects";
import { sceneryOn, sceneryType } from "./scenery";

/**
 * Walls the two edges at the high corner with rock and forest.
 *
 * The other two edges are sea, which needs no help. These two climb from the
 * high corner and would otherwise be open ground running to the map's edge —
 * so they are packed with the scenery the ground there already grows:
 * spires and boulders up in the rock, close-set conifers through the trees.
 * The barrier is what the *player* meets; the grid's own bounds were always
 * impassable, but "the world stops here" should be something you can see.
 *
 * Only the rim is walled. A barrier further in could cut the map in two, and
 * `ensureConnectivity` cannot rescue that: it carves terrain, and an object
 * blocks a tile whatever the terrain under it is.
 */

// Two objects deep. One is enough to block; two is what reads as a thicket
// or a rockfall rather than a fence.
export const BARRIER_DEPTH = 4;

// Every scenery object is a 2x2 footprint, so anchors sit on a 2-tile
// lattice and the formation packs with no gaps for the player to slip
// through.
const OBJECT_SIZE = 2;

function insideAnyBox(
  col: number,
  row: number,
  size: number,
  boxes: readonly AreaPlacement[],
): boolean {
  return boxes.some(
    (b) =>
      col + size > b.col && col < b.col + b.width && row + size > b.row && row < b.row + b.height,
  );
}

function canStand(grid: WorldGrid, col: number, row: number): string | null {
  let kind: string | null = null;
  for (let r = row; r < row + OBJECT_SIZE; r++) {
    for (let c = col; c < col + OBJECT_SIZE; c++) {
      if (!grid.inBounds(c, r)) return null;
      if (grid.getObjectAt(c, r)) return null;
      const here = sceneryOn(grid.getTerrain(c, r));
      // Every cell of the footprint has to be land. A formation that
      // overhangs the waterline reads as scenery floating on the sea.
      if (!here) return null;
      kind ??= here;
    }
  }
  return kind;
}

export function placeEdgeBarriers(
  grid: WorldGrid,
  corner: HighCorner,
  reservedBoxes: readonly AreaPlacement[],
): PlacedObject[] {
  const edges = highEdges(corner);
  const placed: PlacedObject[] = [];

  const tryPlace = (col: number, row: number): void => {
    if (insideAnyBox(col, row, OBJECT_SIZE, reservedBoxes)) return;
    const kind = canStand(grid, col, row);
    if (!kind) return;
    const object: PlacedObject = {
      id: `barrier-${col}-${row}`,
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
  };

  // Anchors step by the footprint size so the two bands interlock at the
  // corner instead of fighting over the same cells.
  const depth = BARRIER_DEPTH;
  if (edges.top) {
    for (let row = 0; row < depth; row += OBJECT_SIZE) {
      for (let col = 0; col < grid.width; col += OBJECT_SIZE) tryPlace(col, row);
    }
  } else {
    for (let row = grid.height - depth; row < grid.height; row += OBJECT_SIZE) {
      for (let col = 0; col < grid.width; col += OBJECT_SIZE) tryPlace(col, row);
    }
  }
  if (edges.left) {
    for (let col = 0; col < depth; col += OBJECT_SIZE) {
      for (let row = 0; row < grid.height; row += OBJECT_SIZE) tryPlace(col, row);
    }
  } else {
    for (let col = grid.width - depth; col < grid.width; col += OBJECT_SIZE) {
      for (let row = 0; row < grid.height; row += OBJECT_SIZE) tryPlace(col, row);
    }
  }
  return placed;
}
