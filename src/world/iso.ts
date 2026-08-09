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

// Sort key for isometric depth: tiles/sprites further "back" (lower col+row)
// must render before ones further "front".
export function isoDepth(col: number, row: number): number {
  return col + row;
}
