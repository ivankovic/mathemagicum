// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import { STEP_DIRECTIONS, insideWander, stepsToward } from "./wander";

describe("the four a foot can go", () => {
  test("four of them, all one square, none diagonal", () => {
    expect(STEP_DIRECTIONS).toHaveLength(4);
    for (const step of STEP_DIRECTIONS) {
      expect(Math.abs(step.dCol) + Math.abs(step.dRow)).toBe(1);
    }
    // All four, rather than the same one four times.
    expect(new Set(STEP_DIRECTIONS.map((s) => `${s.dCol},${s.dRow}`)).size).toBe(4);
  });
});

describe("keeping to your own patch", () => {
  const home = { col: 10, row: 10 };

  test("a square either way is inside, two is not", () => {
    expect(insideWander(home, 1, { col: 11, row: 11 })).toBe(true);
    expect(insideWander(home, 1, { col: 12, row: 10 })).toBe(false);
    expect(insideWander(home, 1, { col: 10, row: 8 })).toBe(false);
  });

  /**
   * Measured as a square, not as a circle.
   *
   * The corner of a patch is as much in it as the middle of an edge — which
   * is what "a few squares either way" means to anybody looking at a village
   * — and a straight-line distance would quietly clip the corners off every
   * villager's ground.
   */
  test("the corners count, which a circle would have cut off", () => {
    expect(insideWander(home, 2, { col: 12, row: 12 })).toBe(true);
    expect(insideWander(home, 2, { col: 13, row: 12 })).toBe(false);
  });

  test("and standing still is always inside, even at nought", () => {
    expect(insideWander(home, 0, home)).toBe(true);
    expect(insideWander(home, 0, { col: 11, row: 10 })).toBe(false);
  });
});

describe("walking home", () => {
  test("the longer axis is tried first, and the other is the fallback", () => {
    // Eight across and three down: go across.
    expect(stepsToward({ col: 0, row: 0 }, { col: 8, row: 3 })).toEqual([
      { dCol: 1, dRow: 0 },
      { dCol: 0, dRow: 1 },
    ]);
    // Three across and eight down: go down.
    expect(stepsToward({ col: 0, row: 0 }, { col: 3, row: 8 })).toEqual([
      { dCol: 0, dRow: 1 },
      { dCol: 1, dRow: 0 },
    ]);
  });

  test("and it goes the right way, whichever way home is", () => {
    expect(stepsToward({ col: 9, row: 9 }, { col: 1, row: 6 })[0]).toEqual({ dCol: -1, dRow: 0 });
    expect(stepsToward({ col: 9, row: 9 }, { col: 7, row: 1 })[0]).toEqual({ dCol: 0, dRow: -1 });
  });

  /**
   * Straight down a row, so there is nothing to fall back to.
   *
   * A second step of `0,0` would be a step nowhere, and the caller tries
   * every step it is handed — so it would ask the grid whether a villager
   * can walk onto the square they are already standing on, and then "move"
   * them there. A villager who did that would stand in the road jittering.
   */
  test("a straight line home offers one step and no second", () => {
    expect(stepsToward({ col: 4, row: 2 }, { col: 4, row: 9 })).toEqual([{ dCol: 0, dRow: 1 }]);
    expect(stepsToward({ col: 2, row: 4 }, { col: 9, row: 4 })).toEqual([{ dCol: 1, dRow: 0 }]);
  });

  test("and being home already offers nothing at all", () => {
    expect(stepsToward({ col: 5, row: 5 }, { col: 5, row: 5 })).toEqual([]);
  });
});
