// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import type { AnchorPlacements, AreaPlacement } from "./anchors";
import { TERRAIN_TYPES, type TerrainType } from "./terrain";

/**
 * The world seen from above, small enough to hang on a wall.
 *
 * The map in the tower is drawn from the player's own grid rather than
 * painted as art, because the world is generated per game: a coastline drawn
 * by an artist would be a picture of a world nobody is standing in. What
 * lives here is everything about that drawing which is not Phaser — the
 * colours, the scale, and where a cell lands on the page — so it can be
 * checked without a browser.
 *
 * One colour per terrain, and deliberately not the terrain art's own: the
 * atlas paints texture, speckle and blended edges, and at one pixel a tile
 * all of that averages to mud. A map is a diagram.
 */

/** How many world cells go into one pixel of the map. */
export const MINIMAP_STEP = 2;

export const MINIMAP_COLORS: Record<TerrainType, number> = {
  water: 0x4a86b8,
  sand: 0xe4cc8a,
  dirt: 0xc08a5c,
  grass: 0x74b45c,
  woodland: 0x3f8a4a,
  hilly: 0xa8c96a,
  mountain: 0x9aa0bc,
  cobble: 0x8f8a86,
};

export interface MinimapSize {
  readonly width: number;
  readonly height: number;
}

export function minimapSize(cols: number, rows: number, step = MINIMAP_STEP): MinimapSize {
  return { width: Math.ceil(cols / step), height: Math.ceil(rows / step) };
}

/** Where a world cell lands on the map, in map pixels. */
export function minimapPoint(
  col: number,
  row: number,
  step = MINIMAP_STEP,
): { x: number; y: number } {
  return { x: Math.floor(col / step), y: Math.floor(row / step) };
}

/** The middle of a placed area, as a world cell. */
export function areaCentre(area: AreaPlacement): { col: number; row: number } {
  return {
    col: area.col + Math.floor(area.width / 2),
    row: area.row + Math.floor(area.height / 2),
  };
}

/**
 * The places worth marking, in the order they are drawn.
 *
 * The village first so it is under the others if two ever overlap: it is the
 * one a player is looking for, and the one they can already find.
 */
export function markedPlaces(
  anchors: AnchorPlacements,
): readonly { readonly id: keyof AnchorPlacements; readonly area: AreaPlacement }[] {
  return [
    { id: "village", area: anchors.village },
    { id: "harbour", area: anchors.harbour },
    { id: "bigCity", area: anchors.bigCity },
    { id: "observatory", area: anchors.observatory },
    { id: "enchantedForest", area: anchors.enchantedForest },
  ];
}

/** Whether every terrain the world can hold has a colour on the map. */
export function terrainsWithoutColour(): readonly TerrainType[] {
  return TERRAIN_TYPES.filter((terrain) => MINIMAP_COLORS[terrain] === undefined);
}
