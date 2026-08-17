// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import type { AreaPlacement } from "./anchors";
import { type HighCorner, highEdges } from "./elevation";
import type { WorldGrid } from "./grid";
import { smoothNoise } from "./noise";
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

// How deep the wall runs, in objects, at its thinnest and thickest. One is
// enough to block; varying between one and four is what makes it read as a
// thicket that happens to be impassable rather than as a fence someone
// built along the edge of the map.
export const MIN_BARRIER_OBJECTS = 1;
export const MAX_BARRIER_OBJECTS = 4;
export const BARRIER_DEPTH = MAX_BARRIER_OBJECTS * 2;
// Over what distance the depth varies, in tiles. Long enough that the wall
// thickens and thins in stretches rather than tile by tile.
const DEPTH_PERIOD = 41;
const DEPTH_SEED_OFFSET = 5231;

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
  seed: number,
): PlacedObject[] {
  const edges = highEdges(corner);
  const placed: PlacedObject[] = [];

  // How many objects deep the wall is at a point along its length. Sampled
  // from the coordinate that runs *along* the edge, so the depth is constant
  // through the wall's thickness and varies as you walk beside it.
  const depthAt = (along: number): number => {
    const t = smoothNoise(along, 0, DEPTH_PERIOD, seed + DEPTH_SEED_OFFSET);
    const span = MAX_BARRIER_OBJECTS - MIN_BARRIER_OBJECTS;
    return MIN_BARRIER_OBJECTS + Math.min(span, Math.floor(t * (span + 1)));
  };

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
  // corner instead of fighting over the same cells. The horizontal edge is
  // laid first and the vertical one fills whatever it left.
  for (let col = 0; col < grid.width; col += OBJECT_SIZE) {
    for (let d = 0; d < depthAt(col); d++) {
      const row = edges.top ? d * OBJECT_SIZE : grid.height - (d + 1) * OBJECT_SIZE;
      tryPlace(col, row);
    }
  }
  for (let row = 0; row < grid.height; row += OBJECT_SIZE) {
    for (let d = 0; d < depthAt(row + grid.width); d++) {
      const col = edges.left ? d * OBJECT_SIZE : grid.width - (d + 1) * OBJECT_SIZE;
      tryPlace(col, row);
    }
  }
  return placed;
}
