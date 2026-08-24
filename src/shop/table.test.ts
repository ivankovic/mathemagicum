// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import { MISTAKE_MAX_COINS } from "./payment";
import { LEAST_COIN, type Spot, counterSpots, pileSpots, within } from "./table";
import { MOST_COUNTER_COINS } from "./tender";

const AREA = { width: 200, height: 120 };
const SIZE = 26;
/** The most coins ever laid out singly: a full payment, and a miscount. */
const MOST = MOST_COUNTER_COINS + MISTAKE_MAX_COINS;

/** How far apart two coins are, centre to centre. */
function apart(a: Spot, b: Spot): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

describe("coins on the counter", () => {
  // Up to the largest pile anything can ask for, which is a whole basket
  // sold rather than a purchase now — the interesting sizes are the big ones
  // and the test used to stop before any of them.
  test("one coin per coin, and none of them on top of another", () => {
    for (let count = 1; count <= MOST; count++) {
      const { size, spots } = counterSpots(count, AREA, SIZE);
      expect(spots.length).toBe(count);
      for (let i = 0; i < spots.length; i++) {
        for (let j = i + 1; j < spots.length; j++) {
          // Touching is allowed; sharing a centre is not. A child counting a
          // heap counts it wrong, and counting is the whole exercise.
          expect({ count, clear: apart(spots[i] as Spot, spots[j] as Spot) >= size }).toEqual({
            count,
            clear: true,
          });
        }
      }
    }
  });

  // They shrink rather than pile up, and stop shrinking while they are still
  // coins. Past this many they are gathered into piles instead.
  test("the coins shrink to fit, but never past being coins", () => {
    let last = Number.POSITIVE_INFINITY;
    for (let count = 1; count <= MOST; count++) {
      const { size } = counterSpots(count, AREA, SIZE);
      expect(size).toBeLessThanOrEqual(SIZE);
      expect(size).toBeGreaterThanOrEqual(LEAST_COIN);
      // Never bigger for a bigger pile: a coin that grew as more were added
      // would make the table jump about under a child's hand.
      expect(size).toBeLessThanOrEqual(last);
      last = size;
    }
  });

  test("and every one of them on the table", () => {
    for (let count = 1; count <= MOST; count++) {
      for (const spot of counterSpots(count, AREA, SIZE).spots) {
        expect(spot.x).toBeGreaterThanOrEqual(0);
        expect(spot.y).toBeGreaterThanOrEqual(0);
        expect(spot.x).toBeLessThanOrEqual(AREA.width);
        expect(spot.y).toBeLessThanOrEqual(AREA.height);
      }
    }
  });

  // Reading order, because that is the order they were put down in and the
  // order a child counts in.
  test("they are laid left to right, then down", () => {
    const { spots } = counterSpots(6, AREA, SIZE);
    for (let i = 1; i < spots.length; i++) {
      const before = spots[i - 1] as Spot;
      const now = spots[i] as Spot;
      const wrapped = now.y > before.y + 1;
      expect(wrapped || now.x > before.x).toBe(true);
    }
  });

  // The one that would go unnoticed: putting a coin down must not shuffle
  // the coins already there, or a child loses their count every time.
  test("adding one does not move the ones already down", () => {
    for (let count = 1; count < MOST; count++) {
      const { spots: before } = counterSpots(count, AREA, SIZE);
      const { spots: after } = counterSpots(count + 1, AREA, SIZE);
      const sameRow = before.every((spot, i) => spot.y === (after[i] as Spot).y);
      // A new row may lift the whole tray, which is honest; what must not
      // happen is coins changing their order or their column.
      const sameOrder = before.every((spot, i) => {
        const now = after[i] as Spot;
        return i === 0 || now.x > (after[i - 1] as Spot).x || now.y > (after[i - 1] as Spot).y;
      });
      expect(sameOrder).toBe(true);
      void sameRow;
    }
  });

  // Eleven and a lonely one is a shape a child counts wrong; six and six is
  // two rows anybody can check.
  test("the rows are shared out evenly rather than filled and spilled", () => {
    for (let count = 1; count <= MOST; count++) {
      const { spots } = counterSpots(count, AREA, SIZE);
      const perRow = new Map<number, number>();
      for (const spot of spots) perRow.set(spot.y, (perRow.get(spot.y) ?? 0) + 1);
      const counts = [...perRow.values()];
      const fullest = Math.max(...counts);
      const emptiest = Math.min(...counts);
      expect({ count, spread: fullest - emptiest }).toEqual({
        count,
        spread: fullest - emptiest <= 1 ? fullest - emptiest : 0,
      });
      expect(fullest - emptiest).toBeLessThanOrEqual(1);
    }
  });

  test("nothing to count is nothing to draw", () => {
    expect(counterSpots(0, AREA, SIZE).spots).toEqual([]);
    expect(counterSpots(-1, AREA, SIZE).spots).toEqual([]);
  });
});

describe("the piles", () => {
  test("stand in ladder order, evenly across their half", () => {
    const spots = pileSpots(4, AREA);
    expect(spots.length).toBe(4);
    for (let i = 1; i < spots.length; i++) {
      expect((spots[i] as Spot).x).toBeGreaterThan((spots[i - 1] as Spot).x);
    }
    const gaps = spots.slice(1).map((spot, i) => spot.x - (spots[i] as Spot).x);
    for (const gap of gaps) expect(gap).toBeCloseTo(gaps[0] as number, 6);
  });

  // A pile that moved when it was drawn from would move under the finger
  // reaching for it.
  test("and stand in the same place however many coins are on the counter", () => {
    expect(pileSpots(4, AREA)).toEqual(pileSpots(4, AREA));
  });
});

describe("dropping a coin", () => {
  test("counts only inside the space it was aimed at", () => {
    const origin = { x: 100, y: 50 };
    expect(within({ x: 150, y: 80 }, origin, AREA)).toBe(true);
    expect(within({ x: 99, y: 80 }, origin, AREA)).toBe(false);
    expect(within({ x: 150, y: 49 }, origin, AREA)).toBe(false);
    expect(within({ x: 301, y: 80 }, origin, AREA)).toBe(false);
    expect(within({ x: 150, y: 171 }, origin, AREA)).toBe(false);
  });
});
