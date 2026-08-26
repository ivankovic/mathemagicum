// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import {
  PATCH_REACH,
  markingZoom,
  patchArea,
  patchBetween,
  patchCells,
  patchHolds,
  patchIsCastable,
} from "./selection";

const WORLD = { width: 50, height: 40 };

describe("drawing a patch between two corners", () => {
  test("takes the cells between them, whichever corner came first", () => {
    const forward = patchBetween({ col: 4, row: 7 }, { col: 6, row: 9 }, WORLD);
    const backward = patchBetween({ col: 6, row: 9 }, { col: 4, row: 7 }, WORLD);
    expect(forward).toEqual({ col: 4, row: 7, width: 3, height: 3 });
    expect(backward).toEqual(forward);
  });

  test("a patch of one cell is one cell", () => {
    expect(patchBetween({ col: 2, row: 2 }, { col: 2, row: 2 }, WORLD)).toEqual({
      col: 2,
      row: 2,
      width: 1,
      height: 1,
    });
  });

  // The corner the drag started on is the one that stays put. A patch that
  // slid out from under the finger that placed it would read as the game
  // arguing rather than as a limit being reached.
  test("stops at the reach without moving the corner it started from", () => {
    const patch = patchBetween({ col: 10, row: 10 }, { col: 40, row: 30 }, WORLD);
    expect({ col: patch.col, row: patch.row }).toEqual({ col: 10, row: 10 });
    expect({ width: patch.width, height: patch.height }).toEqual({
      width: PATCH_REACH,
      height: PATCH_REACH,
    });
  });

  test("and stops the same way when the drag goes up and left", () => {
    const patch = patchBetween({ col: 40, row: 30 }, { col: 2, row: 1 }, WORLD);
    // The anchor is the far corner of the patch now, but it is still on it.
    expect(patchHolds(patch, { col: 40, row: 30 })).toBe(true);
    expect({ width: patch.width, height: patch.height }).toEqual({
      width: PATCH_REACH,
      height: PATCH_REACH,
    });
  });

  test("never reaches outside the world, however far the drag goes", () => {
    for (const [from, to] of [
      [
        { col: 0, row: 0 },
        { col: -20, row: -20 },
      ],
      [
        { col: 49, row: 39 },
        { col: 200, row: 200 },
      ],
      [
        { col: 3, row: 3 },
        { col: 999, row: -999 },
      ],
    ] as const) {
      const patch = patchBetween(from, to, WORLD);
      expect(patch.col).toBeGreaterThanOrEqual(0);
      expect(patch.row).toBeGreaterThanOrEqual(0);
      expect(patch.col + patch.width).toBeLessThanOrEqual(WORLD.width);
      expect(patch.row + patch.height).toBeLessThanOrEqual(WORLD.height);
    }
  });

  test("has a cell for every square of it, and no more", () => {
    const patch = patchBetween({ col: 5, row: 5 }, { col: 8, row: 6 }, WORLD);
    const cells = patchCells(patch);
    expect(cells.length).toBe(patchArea(patch));
    expect(cells.length).toBe(8);
    expect(new Set(cells.map((c) => `${c.col},${c.row}`)).size).toBe(8);
    for (const cell of cells) expect(patchHolds(patch, cell)).toBe(true);
    expect(patchHolds(patch, { col: 9, row: 5 })).toBe(false);
  });
});

describe("whether a patch is worth casting on", () => {
  // "One times one" is a question with nothing in it.
  test("one cell is not a multiplication", () => {
    expect(patchIsCastable(patchBetween({ col: 1, row: 1 }, { col: 1, row: 1 }, WORLD))).toBe(
      false,
    );
  });

  // Five in a line is a perfectly good first times table, and refusing it
  // would mean the youngest child could not cast on the row of beds they
  // actually have.
  test("a single row is", () => {
    expect(patchIsCastable(patchBetween({ col: 1, row: 1 }, { col: 5, row: 1 }, WORLD))).toBe(true);
    expect(patchIsCastable(patchBetween({ col: 1, row: 1 }, { col: 1, row: 2 }, WORLD))).toBe(true);
  });
});

/**
 * How far out the camera pulls while a patch is being drawn.
 *
 * The numbers here are real screens rather than round ones, because the bug
 * this fixes was a real screen: a child on an iPhone could mark one row and
 * nothing wider.
 */
describe("markingZoom", () => {
  const TILE = 32;
  const NORMAL = 2;
  const PHONE = { width: 390, height: 844 };
  const DESKTOP = { width: 1000, height: 760 };

  test("leaves a desktop exactly as it was", () => {
    // The whole reach already fits at the world's own zoom, so this must not
    // touch it. A fix for phones that quietly halved every other screen
    // would be a worse bug than the one it fixed.
    expect(markingZoom(DESKTOP, TILE, NORMAL)).toBe(NORMAL);
  });

  test("pulls a phone out until the whole reach fits", () => {
    expect(markingZoom(PHONE, TILE, NORMAL)).toBe(1);
    expect(PATCH_REACH * TILE * markingZoom(PHONE, TILE, NORMAL)).toBeLessThanOrEqual(PHONE.width);
  });

  test("whatever it picks, a patch of the full reach fits across", () => {
    for (const width of [320, 390, 414, 768, 1000, 1440]) {
      for (const height of [480, 568, 760, 844, 1024]) {
        const zoom = markingZoom({ width, height }, TILE, NORMAL);
        const needed = PATCH_REACH * TILE * zoom;
        const shorter = Math.min(width, height);
        // Either it fits, or the screen is too small for any whole zoom to
        // make it fit and we are at the floor rather than below it.
        expect({ width, height, ok: needed <= shorter || zoom === 1 }).toEqual({
          width,
          height,
          ok: true,
        });
      }
    }
  });

  test("is always a whole number, and never more than the world's own", () => {
    for (let width = 200; width <= 2000; width += 7) {
      const zoom = markingZoom({ width, height: width }, TILE, NORMAL);
      expect(Number.isInteger(zoom)).toBe(true);
      expect(zoom).toBeGreaterThanOrEqual(1);
      expect(zoom).toBeLessThanOrEqual(NORMAL);
    }
  });

  test("never goes below 1, however small the screen", () => {
    // Sixteen-pixel tiles are not a target a finger can hit, so there is a
    // floor and a very small screen sits on it rather than under it.
    expect(markingZoom({ width: 120, height: 120 }, TILE, NORMAL)).toBe(1);
  });

  test("the short side is what decides it", () => {
    // A patch is up to ten squares *either* way, so a wide, short screen is
    // governed by its height.
    expect(markingZoom({ width: 2000, height: 390 }, TILE, NORMAL)).toBe(
      markingZoom({ width: 390, height: 2000 }, TILE, NORMAL),
    );
  });
});
