// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

/**
 * Where the faces go on the who's-playing screen.
 *
 * Its own module, with no Phaser in it, because the thing that actually
 * matters about this screen is arithmetic: every tile has to be big enough
 * for a child's finger and all of them have to fit without scrolling, on a
 * phone held upright as well as on a tablet. That is a calculation, and a
 * calculation is worth testing — the alternative is finding out on somebody
 * else's screen that two of the faces are off the bottom of it.
 */

/** The smallest a tile may get. Below this a tap lands between two faces. */
export const TILE_MIN = 84;
export const TILE_MAX = 132;
export const TILE_GAP = 16;
/** Room above the faces for the heading, and below for the remove button. */
export const HEADER = 76;
export const FOOTER = 64;

export interface TileGrid {
  readonly columns: number;
  readonly rows: number;
  readonly tile: number;
  /** Where the top-left of tile `index` sits. */
  readonly at: (index: number) => { x: number; y: number };
}

/**
 * Fit `count` tiles into a screen.
 *
 * Columns come from the width and the *smallest* acceptable tile, so a narrow
 * screen gets fewer and taller rather than a row of unhittable squares; the
 * tile then grows back into whatever space that leaves, up to a maximum,
 * because a single player on a tablet should not get one enormous face.
 */
export function tileGrid(width: number, height: number, count: number): TileGrid {
  const usableWidth = Math.max(TILE_MIN, width - TILE_GAP * 2);
  const usableHeight = Math.max(TILE_MIN, height - HEADER - FOOTER);
  const fitsAcross = Math.max(1, Math.floor((usableWidth + TILE_GAP) / (TILE_MIN + TILE_GAP)));
  const columns = Math.max(1, Math.min(fitsAcross, Math.max(1, count)));
  const rows = Math.max(1, Math.ceil(Math.max(1, count) / columns));

  const byWidth = (usableWidth - TILE_GAP * (columns - 1)) / columns;
  const byHeight = (usableHeight - TILE_GAP * (rows - 1)) / rows;
  const tile = Math.max(TILE_MIN, Math.min(TILE_MAX, Math.floor(Math.min(byWidth, byHeight))));

  const gridWidth = columns * tile + TILE_GAP * (columns - 1);
  const gridHeight = rows * tile + TILE_GAP * (rows - 1);
  const left = (width - gridWidth) / 2;
  const top = HEADER + Math.max(0, (usableHeight - gridHeight) / 2);

  return {
    columns,
    rows,
    tile,
    at: (index) => ({
      x: left + (index % columns) * (tile + TILE_GAP),
      y: top + Math.floor(index / columns) * (tile + TILE_GAP),
    }),
  };
}

/**
 * The three steps that make a player, in the order they are asked.
 *
 * Here rather than in the scene for the same reason the tile grid is: it is
 * a rule about what follows what, it has an off-the-end case in each
 * direction, and both are worth a test rather than a walkthrough.
 *
 * The order is the whole design. Language first, because every word of the
 * two steps after it is written in the answer — a form that asks a child to
 * read English in order to find the button that stops it being in English
 * has asked them the wrong thing first.
 */
export const MAKING_STEPS = ["tongue", "who", "sums"] as const;

export type MakingStep = (typeof MAKING_STEPS)[number];

/**
 * Where "next" or "back" goes from here.
 *
 * `null` means off the end: forward off the last step is finishing, and back
 * off the first is leaving without making anybody. Both are the caller's to
 * act on, because what they mean depends on what is behind this screen —
 * back off the front of a device with nobody on it has nowhere to go.
 */
export function stepFrom(from: MakingStep, by: number): MakingStep | null {
  const at = MAKING_STEPS.indexOf(from);
  if (at < 0) return null;
  return MAKING_STEPS[at + by] ?? null;
}
