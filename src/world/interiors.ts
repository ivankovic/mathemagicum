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
export const INTERIOR_ROOMS: readonly string[] = ["cottage", "barn", "tower", "schoolhouse"];

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
