// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

/**
 * Where the coins sit on the table.
 *
 * The shop's counting used to be a keypad: one button per coin, a tap to add
 * one, and a line of text saying what the total had reached. It taught the
 * sum and showed no money — the only thing on screen that was money was a
 * word. A child counting out 12,50 was reading a number back, not counting.
 *
 * So the coins are on a table now: piles on the left to take from, an empty
 * space on the right to build the payment in, and the answer readable by
 * looking at what you have put down. That makes *arrangement* a rule rather
 * than a detail — coins that overlap cannot be counted, and coins that fall
 * off the edge cannot be seen — which is why it lives here with the other
 * rules instead of inside the panel.
 *
 * Positions are returned as offsets from the top-left of the area given, in
 * pixels, so this can be tested without a browser anywhere near it.
 */

export interface Spot {
  readonly x: number;
  readonly y: number;
}

export interface TableArea {
  readonly width: number;
  readonly height: number;
}

/**
 * How the coins already on the counter are laid out.
 *
 * Left to right, then down — reading order, because that is the order a
 * child counts in and the order the coins were put down in. Not a heap: a
 * pile of overlapping coins is exactly the thing a child cannot check their
 * own work against, and checking is the whole exercise.
 *
 * The grid tightens rather than overflowing. Ten coins in a space three
 * wide would run off the bottom, so the spacing closes up until they fit —
 * they touch before they vanish. `MOST_COUNTER_COINS` keeps that from ever
 * becoming a squint; this is what happens if it does.
 */
export interface Laid {
  /** How big each coin should be drawn, which shrinks as the pile grows. */
  readonly size: number;
  readonly spots: readonly Spot[];
}

/** The smallest a coin may be drawn and still be a coin rather than a dot. */
export const LEAST_COIN = 14;

export function counterSpots(count: number, area: TableArea, preferred: number): Laid {
  if (count <= 0 || preferred <= 0) return { size: preferred, spots: [] };
  // The size is worked out here rather than handed in, which it used to be.
  // A payment is a handful of coins and always fitted; a *sale* can be the
  // whole basket now, and forty coins at the size four are drawn at is not a
  // tighter grid, it is a heap. So the coins shrink until the pile fits, and
  // stop shrinking at the point where they stop being coins.
  let size = preferred;
  while (size > LEAST_COIN && !fits(count, area, size)) size -= 1;
  const rows = rowsAt(count, area, size);
  // Shared out between the rows rather than poured into them: thirteen coins
  // filling rows of five is five, five and a lonely three, which is a shape
  // a child counts wrong. Five, four and four is three rows anybody checks
  // at a glance. So each row gets the same number, give or take one.
  const base = Math.floor(count / rows);
  const extra = count % rows;
  // Spread across the room there is, but never further apart than a coin and
  // a comfortable gap: four coins should not stand at the four corners.
  const stepX = Math.min(size + GAP, area.width / Math.max(1, base + (extra > 0 ? 1 : 0)));
  const stepY = Math.min(size + GAP, area.height / rows);
  const spots: Spot[] = [];
  for (let row = 0; row < rows; row++) {
    const columns = base + (row < extra ? 1 : 0);
    for (let column = 0; column < columns; column++) {
      spots.push({
        x: (area.width - stepX * columns) / 2 + stepX * (column + 0.5),
        y: (area.height - stepY * rows) / 2 + stepY * (row + 0.5),
      });
    }
  }
  return { size, spots };
}

/** The breathing room between two coins lying side by side. */
const GAP = 4;

/** How many rows this many coins need at this size: as few as will hold them. */
function rowsAt(count: number, area: TableArea, size: number): number {
  const most = Math.max(1, Math.floor(area.width / (size + GAP)));
  return Math.max(1, Math.ceil(count / most));
}

function fits(count: number, area: TableArea, size: number): boolean {
  return rowsAt(count, area, size) * (size + GAP) <= area.height;
}

/**
 * Where each pile stands, evenly spaced down or across its half of the table.
 *
 * One pile per coin, in ladder order, smallest first — left to right, the
 * way the coins are written down everywhere else in the game. A pile whose
 * position depended on how much was in it would move while a child was
 * reaching for it.
 */
export function pileSpots(count: number, area: TableArea): Spot[] {
  if (count <= 0) return [];
  const step = area.width / count;
  return Array.from({ length: count }, (_, index) => ({
    x: step * (index + 0.5),
    y: area.height / 2,
  }));
}

/** Whether a point is inside an area whose top-left is at the origin given. */
export function within(point: Spot, origin: Spot, area: TableArea): boolean {
  return (
    point.x >= origin.x &&
    point.x <= origin.x + area.width &&
    point.y >= origin.y &&
    point.y <= origin.y + area.height
  );
}
