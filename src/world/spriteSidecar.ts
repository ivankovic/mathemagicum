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
  // The sheet's grid. Buildings and objects are a single row; a character is
  // several, one animation per row.
  columns: number;
  rows: number;
  // Extrusion, expressed the way a uniform-grid spritesheet loader wants it:
  // the frame at grid position (col, row) starts at
  // margin + col * (frame_width + spacing).
  margin: number;
  spacing: number;
}

/**
 * How a loader must slice one of these sheets.
 *
 * One function, used by everything that turns a sheet into frames, because
 * the alternative has already gone wrong once: the avatar's recoloured copy
 * was registered with a frame size and nothing else, so every frame came out
 * a pixel up and left of where it belonged and drifted further across the
 * sheet — and what showed inside each frame was a sliver of its neighbour,
 * which on a character sheet is the next frame's shadow. It appeared as a
 * shadow smeared over the player.
 *
 * The padding is not optional and it is not zero: the generator extrudes
 * every frame, so `margin` and `spacing` are always part of the answer.
 */
export function spriteSheetConfig(sheet: SheetLayout): {
  frameWidth: number;
  frameHeight: number;
  margin: number;
  spacing: number;
} {
  return {
    frameWidth: sheet.frame_width,
    frameHeight: sheet.frame_height,
    margin: sheet.margin,
    spacing: sheet.spacing,
  };
}

// Common to everything the generator draws standing on the ground.
export interface SheetSprite {
  sheet: SheetLayout | null;
  tile_size: number;
  footprint_tiles: { width: number; height: number };
  // Where to draw the sprite relative to the anchor cell's top-left corner.
  // y is negative: the sprite is drawn from the front and rises above the
  // footprint it stands on, which is what makes the view read as 3/4.
  sprite_offset_px: { x: number; y: number };
  sprite_size_px: { width: number; height: number };
  frame_count: number;
}

// A frame range within the sheet, inclusive at both ends.
export interface AnimationRange {
  start: number;
  end: number;
  frame_count: number;
}

// Things placed once at generation time, which the world marks as occupied.
export interface SpriteSidecar extends SheetSprite {
  blocked_cells_relative_to_anchor: readonly (readonly [number, number])[];
}

export interface BuildingSidecar extends SpriteSidecar {
  /**
   * Every colour the sheet was drawn in, by slot name.
   *
   * Shipped so a game can repaint one ramp — the roof — without having to
   * work out which of fourteen near-neighbours it is looking at. Two of the
   * greys in a cottage are a dozen units apart, and nothing outside the
   * generator is in a position to tell them apart.
   */
  palette?: Readonly<Record<string, readonly [number, number, number]>>;
  /** The roofs a house may wear instead of the one it shipped in. */
  roof_options?: readonly (readonly (readonly [number, number, number])[])[];
  building: string;
  door_cell_relative_to_anchor: readonly [number, number];
  // One frame range per door position, keyed `door_{state}`. The door is
  // state rather than a transition that plays, so each range is its own
  // looping row of smoke frames and opening the door means switching rows.
  animations: Record<string, AnimationRange>;
  door_states: readonly string[];
}

export interface ObjectSidecar extends SpriteSidecar {
  terrain: string;
  // One frame range per distinct individual, keyed `instance_N`. A wall
  // packs hundreds of these in a row, so which one a tile gets is what stops
  // the formation reading as wallpaper.
  animations: Record<string, AnimationRange>;
  instances: number;
}

/**
 * The one-of-a-kind thing at the heart of a place.
 *
 * Shaped like scenery — a footprint, blocked cells, one looping animation —
 * and separate from it because there is exactly one of these per place and
 * no `instances` to vary between. A landmark that varied would not be one.
 */
export interface LandmarkSidecar extends SpriteSidecar {
  landmark: string;
  animations: Record<string, AnimationRange>;
}

// A built prop standing on one cell, which it blocks.
export interface FixtureSidecar extends SpriteSidecar {
  fixture: string;
}

// A spell landing on a tile. Blocks nothing and is never walked round; the
// only thing it shares with a prop is that it happens at a cell.
export interface EffectSidecar extends SheetSprite {
  effect: string;
  animations: Record<string, AnimationRange>;
  // Whether the generator drew this as something that repeats. Read rather
  // than assumed: an effect left looping never goes away, and the sidecar is
  // where the art says what it is.
  loops: boolean;
}

// A crop. Like a character it carries no blocked cells — a field is walked
// across, not around — and like a building its frames are grouped into named
// ranges, one per growth stage.
export interface PlantSidecar extends SheetSprite {
  plant: string;
  stages: readonly string[];
  animations: Record<string, AnimationRange>;
}

// A room the player can walk around inside. Unlike a building, which is one
// sprite standing on the world grid, an interior *is* a little grid of its
// own — so it carries its size and its own blocked cells rather than a
// footprint and an offset.
export interface InteriorSidecar {
  /** Every colour the room was drawn in, by slot name. See BuildingSidecar. */
  palette?: Readonly<Record<string, readonly [number, number, number]>>;
  /** The bedding and rugs a room may be furnished with instead. */
  fabric_options?: readonly (readonly (readonly [number, number, number])[])[];
  sheet: SheetLayout | null;
  room: string;
  size_cells: { cols: number; rows: number };
  tile_size: number;
  // The north wall is the one surface facing the viewer, so it has real
  // height: the art is this many pixels taller than the grid it describes,
  // and cell (0,0) starts below it.
  wall_rise_px: number;
  door_cell: readonly [number, number];
  blocked_cells: readonly (readonly [number, number])[];
  furniture: readonly { name: string; cell: readonly [number, number]; blocks: boolean }[];
  /**
   * Which columns of the north wall a window takes up.
   *
   * Windows are wall decoration rather than furniture — the generator draws
   * them in pixels and they appear in no other list — so a game hanging
   * something on that wall would have to guess where they are. It guessed
   * wrong once, and put the world map across the tower's window.
   */
  window_columns?: readonly number[];
}

// Characters carry no blocked-cells list, and deliberately so: they move, so
// nothing ever stamps them into the grid the way a building is stamped.
export interface CharacterSidecar extends SheetSprite {
  character: string;
  directions: readonly string[];
  animations: Record<string, AnimationRange>;
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
