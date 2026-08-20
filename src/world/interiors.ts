// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import type { BuildingSprite } from "./buildings";
import { WorldGrid } from "./grid";
import type { PlacedObject } from "./objects";
import type { InteriorSidecar } from "./spriteSidecar";
import { TerrainType } from "./terrain";
import type { GridPoint } from "./topdown";

// Every building the village places has a room behind its door, and the
// generator names rooms after the buildings they belong in. Stated as a
// function anyway rather than relying on the names matching, because that
// is the sort of coincidence that quietly stops being true.
export function interiorFor(sprite: BuildingSprite): string {
  return sprite;
}

// The rooms shipped under public/assets/interiors. interiors.test.ts checks
// this covers every building the village can place.
export const INTERIOR_ROOMS: readonly string[] = [
  "cottage",
  "townhouse",
  "ship",
  "barn",
  "tower",
  "schoolhouse",
  "observatory",
];

/**
 * Where a map hangs on a room's back wall.
 *
 * The middle of the wall, stepping outward until it finds a cell with no
 * furniture against it. Derived rather than written down per room: the room
 * art and its furniture come from the generator, and a coordinate typed in
 * here would go on being right only until somebody moved a bookshelf.
 *
 * The one thing on that wall which is not furniture is a window, and the
 * generator now says which columns those take: it did not, this hung the map
 * across the tower's, and "the picture will tell you" is not something code
 * can read.
 */
export function wallHangingCell(sidecar: InteriorSidecar): GridPoint {
  const { cols } = sidecar.size_cells;
  const taken = new Set(
    (sidecar.furniture ?? []).map((piece) => `${piece.cell[0]},${piece.cell[1]}`),
  );
  const windows = new Set(sidecar.window_columns ?? []);
  // The centre line, which falls on a cell in an odd-width room and between
  // two in an even one — hence the halves rather than a `floor`.
  const middle = (cols - 1) / 2;
  const order = [...Array(cols).keys()].sort((a, b) => Math.abs(a - middle) - Math.abs(b - middle));
  for (const col of order) {
    if (!taken.has(`0,${col}`) && !windows.has(col)) return { col, row: 0 };
  }
  return { col: Math.round(middle), row: 0 };
}

export function interiorSheetKey(room: string): string {
  return `interior-${room}`;
}

export function interiorSidecarKey(room: string): string {
  return `interior-sidecar-${room}`;
}

export function interiorAnimKey(room: string): string {
  return `interior-${room}-idle`;
}

// The room's floor. Nothing is planted or grown indoors, so the terrain here
// is a formality — what matters is that it is passable and that the walls
// and furniture on top of it are not.
const FLOOR = TerrainType.Dirt;

/**
 * The room as a walkable grid.
 *
 * Built out of the same WorldGrid the outdoors uses, with one blocking
 * object per wall or furniture cell, so movement, collision and pathfinding
 * indoors go through exactly the code that is already tested outdoors rather
 * than a parallel implementation that could disagree with it.
 */
export function buildInteriorGrid(sidecar: InteriorSidecar): WorldGrid {
  const { cols, rows } = sidecar.size_cells;
  const grid = WorldGrid.empty(cols, rows, FLOOR);
  for (const [row, col] of sidecar.blocked_cells) {
    const blocker: PlacedObject = {
      id: `${sidecar.room}-blocked-${row}-${col}`,
      type: "interior-wall",
      col,
      row,
      width: 1,
      height: 1,
      blocksMovement: true,
      anchorCol: col,
      anchorRow: row,
    };
    grid.placeObject(blocker);
  }
  return grid;
}

/**
 * Where someone who works in this room stands.
 *
 * The back of the room, as near the middle as the furniture allows: the
 * player walks in at the door and should see them without hunting, and a
 * shopkeeper standing beside the door she came through reads as someone on
 * their way out rather than someone serving.
 *
 * Chosen from the room's own walkability rather than written down per room,
 * so a rearranged interior moves them instead of leaving them inside a
 * cupboard. Null if there is nowhere to stand, which no shipped room does —
 * interiors.test.ts checks that.
 */
export function interiorAttendantCell(sidecar: InteriorSidecar): GridPoint | null {
  const grid = buildInteriorGrid(sidecar);
  const door = interiorDoor(sidecar);
  const middle = (sidecar.size_cells.cols - 1) / 2;
  let best: GridPoint | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (let row = 0; row < sidecar.size_cells.rows; row++) {
    for (let col = 0; col < sidecar.size_cells.cols; col++) {
      if (!grid.isPassable(col, row)) continue;
      // Distance from the door dominates; nearness to the centre only breaks
      // ties, so she ends up at the back middle rather than a back corner.
      const score = Math.abs(row - door.row) * 100 - Math.abs(col - middle);
      if (score > bestScore) {
        bestScore = score;
        best = { col, row };
      }
    }
  }
  return best;
}

// Where the player stands when they walk in, and where they walk out from.
// The generator puts it on the room's last row, so stepping off that row is
// what leaves.
export function interiorDoor(sidecar: InteriorSidecar): GridPoint {
  const [row, col] = sidecar.door_cell;
  return { col, row };
}

// Pixel offset of the grid's origin within the room image: the north wall
// stands above cell (0,0).
export function interiorOriginY(sidecar: InteriorSidecar): number {
  return sidecar.wall_rise_px;
}

export interface Extent {
  readonly width: number;
  readonly height: number;
}

export interface CameraBounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Where a camera may go while the player is in a room.
 *
 * Axis by axis, because a room can overflow one and not the other and the
 * two want opposite things. The tower is the case that showed it: it grew
 * wide enough to need scrolling on a phone while staying shorter than the
 * screen, and an all-or-nothing rule pinned it to the top of the viewport
 * with a band of black under it.
 *
 * Where the room is bigger than the view, the bounds are the room's own
 * extent and the camera follows inside them. Where it is smaller, the bounds
 * are a view-sized band centred on the room: the camera cannot move on that
 * axis at all, so it sits centred and the room is framed rather than hard
 * against a wall of black. A room that fits on both axes falls out of the
 * same rule as centred on both, which is what the special case used to do.
 */
export function roomCameraBounds(room: Extent, view: Extent): CameraBounds {
  const span = (size: number, seen: number) =>
    size >= seen ? { at: 0, size } : { at: (size - seen) / 2, size: seen };
  const across = span(room.width, view.width);
  const down = span(room.height, view.height);
  return { x: across.at, y: down.at, width: across.size, height: down.size };
}
