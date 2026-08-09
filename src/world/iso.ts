// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

// Standard 2:1 diamond isometric projection. (col, row) grid coordinates map
// to a screen position relative to the map's own origin — callers add their
// own offset to place the map within a scene.
export const TILE_WIDTH = 64;
export const TILE_HEIGHT = 32;

export interface ScreenPoint {
  x: number;
  y: number;
}

export function gridToScreen(col: number, row: number): ScreenPoint {
  return {
    x: (col - row) * (TILE_WIDTH / 2),
    y: (col + row) * (TILE_HEIGHT / 2),
  };
}

export interface GridPoint {
  col: number;
  row: number;
}

// Inverse of gridToScreen. Uses round (not floor): each tile's diamond
// corresponds to a square centered on its own integer coordinate in the
// continuous (col, row) parameter space, not a square starting at it, so
// floor would misassign points on the near side of a tile's center.
export function screenToGrid(x: number, y: number): GridPoint {
  const a = x / (TILE_WIDTH / 2);
  const b = y / (TILE_HEIGHT / 2);
  return {
    // The `+ 0` normalizes -0 (e.g. Math.round(-0.5)) to 0 — equal in value
    // but not under strict deep-equality, which trips up tests and Map keys.
    col: Math.round((a + b) / 2) + 0,
    row: Math.round((b - a) / 2) + 0,
  };
}

// Sort key for isometric depth: tiles/sprites further "back" (lower col+row)
// must render before ones further "front".
export function isoDepth(col: number, row: number): number {
  return col + row;
}
