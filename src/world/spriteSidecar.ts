// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import type { GridPoint } from "./topdown";

// The JSON the asset generator ships beside every building, object and room
// sprite. Field names are snake_case because they are the generator's, not
// ours — renaming them on the way in would just hide which side of the
// boundary a value came from.
//
// Cell coordinates in a sidecar are [row, col], matching the generator's
// numpy-ish row-major convention; the game is (col, row) everywhere else, so
// everything crossing this boundary goes through the helpers below rather
// than being destructured at call sites.

export interface SheetLayout {
  file: string;
  frame_width: number;
  frame_height: number;
  frame_count: number;
  // Extrusion, expressed the way a uniform-grid spritesheet loader wants it:
  // frame i starts at margin + i * (frame_width + spacing).
  margin: number;
  spacing: number;
}

export interface SpriteSidecar {
  sheet: SheetLayout | null;
  tile_size: number;
  footprint_tiles: { width: number; height: number };
  blocked_cells_relative_to_anchor: readonly (readonly [number, number])[];
  // Where to draw the sprite relative to the anchor cell's top-left corner.
  // y is negative: the sprite is drawn from the front and rises above the
  // footprint it stands on, which is what makes the view read as 3/4.
  sprite_offset_px: { x: number; y: number };
  sprite_size_px: { width: number; height: number };
  frame_count: number;
}

export interface BuildingSidecar extends SpriteSidecar {
  building: string;
  door_cell_relative_to_anchor: readonly [number, number];
}

export interface ObjectSidecar extends SpriteSidecar {
  terrain: string;
}

export function blockedCells(
  sidecar: SpriteSidecar,
  anchorCol: number,
  anchorRow: number,
): GridPoint[] {
  return sidecar.blocked_cells_relative_to_anchor.map(([dRow, dCol]) => ({
    col: anchorCol + dCol,
    row: anchorRow + dRow,
  }));
}

export function doorCell(
  sidecar: BuildingSidecar,
  anchorCol: number,
  anchorRow: number,
): GridPoint {
  const [dRow, dCol] = sidecar.door_cell_relative_to_anchor;
  return { col: anchorCol + dCol, row: anchorRow + dRow };
}

// Top-left pixel to draw the sprite at, given the footprint's anchor cell.
export function spriteOrigin(
  sidecar: SpriteSidecar,
  anchorCol: number,
  anchorRow: number,
): { x: number; y: number } {
  return {
    x: anchorCol * sidecar.tile_size + sidecar.sprite_offset_px.x,
    y: anchorRow * sidecar.tile_size + sidecar.sprite_offset_px.y,
  };
}

// The y a sprite depth-sorts on: the bottom of its footprint, which is where
// it meets the ground. Its own bottom edge would do just as well for
// buildings (the two coincide), but not for anything whose art extends below
// its footprint, so this is stated in terms of the footprint.
export function footprintBottomY(sidecar: SpriteSidecar, anchorRow: number): number {
  return (anchorRow + sidecar.footprint_tiles.height) * sidecar.tile_size;
}
