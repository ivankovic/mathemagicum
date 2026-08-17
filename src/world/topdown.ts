// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

// 3/4 top-down projection on a square 32x32 grid, replacing the 2:1 diamond
// isometric one. "3/4" describes the art, not the maths: the ground is seen
// from straight above, so a tile is an axis-aligned square and grid space is
// screen space scaled by TILE_SIZE. What makes it read as 3/4 rather than
// flat is that objects and buildings are drawn from the front and stand up
// out of their footprint — which is a depth-sorting problem (see depthFor)
// rather than a coordinate one.
export const TILE_SIZE = 32;

export interface ScreenPoint {
  x: number;
  y: number;
}

// The tile's top-left corner in the map's own projection space — callers add
// their own offset to place the map within a scene.
export function gridToScreen(col: number, row: number): ScreenPoint {
  return { x: col * TILE_SIZE, y: row * TILE_SIZE };
}

export interface GridPoint {
  col: number;
  row: number;
}

// Inverse of gridToScreen. Floor, not round: unlike the isometric version
// this replaced, a tile's screen square *starts* at its integer coordinate
// rather than being centred on it, so a point belongs to the tile whose
// origin it is past.
export function screenToGrid(x: number, y: number): GridPoint {
  return { col: Math.floor(x / TILE_SIZE), row: Math.floor(y / TILE_SIZE) };
}

// Depth sort key. Isometric sorted by col + row, because a diamond's
// "further back" runs along both axes at once; top-down only cares about the
// vertical, so what decides who occludes whom is the y of a sprite's feet —
// its bottom edge, not its origin, since a tall sprite's origin is somewhere
// up in the air above the cell it actually stands on.
export function depthFor(bottomY: number): number {
  return bottomY;
}

export interface PixelRect {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

// Screen-space AABB of the whole (col, row) in [0,width) x [0,height) grid.
// Used for camera bounds on a world bigger than the viewport.
export function computeMapScreenBounds(width: number, height: number): PixelRect {
  return { minX: 0, minY: 0, maxX: width * TILE_SIZE, maxY: height * TILE_SIZE };
}
