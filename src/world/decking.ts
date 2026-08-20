// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import type { SheetLayout } from "./spriteSidecar";

/**
 * The planking a pier is made of.
 *
 * Neither terrain nor a sprite standing on a cell, and the reason is worth
 * stating once here because nothing else in the game is shaped like this.
 *
 * It is not **terrain** because the dual-grid blend enumerates every
 * four-corner combination of every material against every other: a ninth
 * terrain costs the shipped atlas 2,465 frames, for a material that appears
 * in one place on the map, always in a straight line, and never blending
 * with anything.
 *
 * It is not an **object** because objects block the cell they stand on, and
 * the entire point of a plank is that you walk on it.
 *
 * So it is a tile drawn *over* the ground, painted into the same chunk
 * texture the terrain goes into — no sprite per plank, no depth to sort, and
 * nothing that has to be spawned or despawned as the camera moves. What
 * makes a cell walkable is the grid's own bridge flag; this is only how it
 * looks.
 */

export const DECK_SIDECAR_KEY = "decking-deck-sidecar";
export const DECK_SHEET_KEY = "decking-deck";

export interface DeckSidecar {
  sheet?: SheetLayout;
  decking: string;
  tile_size: number;
  /** How many distinct planks the sheet ships. */
  variations: number;
  frame_count: number;
}
