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
 * The steps that make a player, in the order they are asked.
 *
 * Here rather than in the scene for the same reason the tile grid is: it is
 * a rule about what follows what, it has an off-the-end case in each
 * direction, and both are worth a test rather than a walkthrough.
 *
 * The order is the whole design. Language first, because every word of the
 * steps after it is written in the answer — a form that asks a child to
 * read English in order to find the button that stops it being in English
 * has asked them the wrong thing first.
 *
 * Then three panels of small print for whoever is holding the tablet: who
 * this part is for, that the game never goes online, and what a lost device
 * costs. Second rather than first, because the flags are what makes them
 * readable at all, and second rather than last, because by the last step
 * the tablet is in a child's hands and the notices are not for them.
 *
 * The child's own two steps come after, and they are the ones that finish:
 * a grown-up reads three screens and hands over, which is the shape of the
 * thing rather than an accident of ordering.
 */
export const MAKING_STEPS = ["tongue", "parents", "offline", "backup", "who", "sums"] as const;

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

/**
 * The part of the page a keyboard has left visible.
 *
 * `window.visualViewport` in the two numbers that matter, so the arithmetic
 * below can be tested without a browser and without an iPad.
 */
export interface VisibleBand {
  /** How far the visible part has been pushed down the layout viewport. */
  readonly offsetTop: number;
  /** And how tall what is left of it is. */
  readonly height: number;
}

/** How much air is kept between the box and the edge of what is visible. */
const BOX_MARGIN = 8;

/**
 * Where the name box has to sit to stay on screen with a keyboard up.
 *
 * The one HTML input in this game is `position: fixed`, which anchors it to
 * the *layout* viewport — and a software keyboard does not change that
 * viewport at all. It changes the **visual** one: iOS shrinks it to the band
 * above the keyboard and scrolls it to reveal whatever is focused. A fixed
 * box therefore goes wherever the page went, which on a tablet is off the
 * top of the screen; and when the keyboard is put away the band comes back
 * and the box, never repositioned, is somewhere else entirely.
 *
 * That is the whole of the playtest report: *the input box goes above the
 * screen, and pulling the keyboard down makes the top visible but the box
 * disappears.* Two halves of one thing — the box has to be placed against
 * the band that is actually visible, and placed again every time it moves.
 *
 * So: start from where the layout wanted it, follow the band, and hold it
 * inside. A box pushed off the bottom by a keyboard is lifted above it; one
 * pushed off the top is brought back down; and where the band is the whole
 * page, which is every desktop and every tablet with no keyboard up, this
 * gives back exactly the y that was asked for.
 */
export function boxTopWithin(band: VisibleBand, wanted: number, boxHeight: number): number {
  const top = band.offsetTop + BOX_MARGIN;
  const bottom = band.offsetTop + band.height - boxHeight - BOX_MARGIN;
  // A band shorter than the box itself has no room to hold it in; pinning to
  // the top at least keeps the box's own first line readable, where clamping
  // the other way round would put all of it under the keyboard.
  if (bottom <= top) return top;
  return Math.round(Math.max(top, Math.min(bottom, band.offsetTop + wanted)));
}
