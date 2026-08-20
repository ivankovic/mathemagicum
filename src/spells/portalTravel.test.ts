// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import { Facing } from "../world/characters";
import {
  PORTAL_TILES_ACROSS,
  PORTAL_TILES_DOWN,
  portalCell,
  portalOpenness,
  portalTravelMs,
  portalView,
} from "./portalTravel";

const WORLD = { width: 500, height: 500 };

describe("where the doorway stands", () => {
  test("on the tile the traveller is facing, not the one they are on", () => {
    const at = { col: 100, row: 100 };
    expect(portalCell(at, Facing.Up, WORLD)).toEqual({ col: 100, row: 99 });
    expect(portalCell(at, Facing.Down, WORLD)).toEqual({ col: 100, row: 101 });
    expect(portalCell(at, Facing.Left, WORLD)).toEqual({ col: 99, row: 100 });
    expect(portalCell(at, Facing.Right, WORLD)).toEqual({ col: 101, row: 100 });
  });

  // Casting it while facing the edge of the world is an ordinary thing to
  // do — the raised rim rings the whole map — and a doorway one tile outside
  // would be drawn over the black beyond it.
  test("facing out of the world, it opens behind them instead", () => {
    expect(portalCell({ col: 0, row: 250 }, Facing.Left, WORLD)).toEqual({ col: 1, row: 250 });
    expect(portalCell({ col: 250, row: 0 }, Facing.Up, WORLD)).toEqual({ col: 250, row: 1 });
    expect(portalCell({ col: 499, row: 250 }, Facing.Right, WORLD)).toEqual({
      col: 498,
      row: 250,
    });
    expect(portalCell({ col: 250, row: 499 }, Facing.Down, WORLD)).toEqual({
      col: 250,
      row: 498,
    });
  });

  // Clamping was the first answer and it put the doorway on the traveller's
  // own cell, which swallows them — the one reading `portalCell` exists to
  // avoid. It must never land on them while there is a tile either side.
  test("it never lands on the traveller themselves", () => {
    for (const at of [
      { col: 0, row: 0 },
      { col: 499, row: 499 },
      { col: 0, row: 499 },
      { col: 250, row: 250 },
    ]) {
      for (const facing of [Facing.Up, Facing.Down, Facing.Left, Facing.Right]) {
        const cell = portalCell(at, facing, WORLD);
        const where = { at: `${at.col},${at.row}`, facing };
        expect({ ...where, onTop: cell.col === at.col && cell.row === at.row }).toEqual({
          ...where,
          onTop: false,
        });
        expect({
          ...where,
          inside: cell.col >= 0 && cell.row >= 0 && cell.col < 500 && cell.row < 500,
        }).toEqual({ ...where, inside: true });
      }
    }
  });

  // Both sides outside needs a world one tile wide, and then there is
  // nowhere else for it to be.
  test("a world one tile wide leaves it standing on them", () => {
    expect(portalCell({ col: 0, row: 0 }, Facing.Left, { width: 1, height: 1 })).toEqual({
      col: 0,
      row: 0,
    });
  });
});

describe("what is seen through it", () => {
  test("a patch centred on where the traveller will land", () => {
    const view = portalView({ col: 200, row: 200 }, WORLD);
    expect(view.minCol).toBeLessThan(200);
    expect(view.maxCol).toBeGreaterThan(200);
    expect(view.minRow).toBeLessThan(200);
    expect(view.maxRow).toBeGreaterThan(200);
  });

  // Bigger than the opening, because the opening is an ellipse cut out of
  // it: one inscribed exactly in its own picture shows bald corners the
  // moment anything moves.
  test("the patch is wider and taller than the hole cut in it", () => {
    const view = portalView({ col: 200, row: 200 }, WORLD);
    expect(view.maxCol - view.minCol + 1).toBeGreaterThan(PORTAL_TILES_ACROSS);
    expect(view.maxRow - view.minRow + 1).toBeGreaterThan(PORTAL_TILES_DOWN);
  });

  // A destination in a corner shows the corner rather than a band of
  // nothing beside it.
  test("it stays inside the world at every corner", () => {
    for (const centre of [
      { col: 0, row: 0 },
      { col: 499, row: 0 },
      { col: 0, row: 499 },
      { col: 499, row: 499 },
      { col: 250, row: 250 },
    ]) {
      const view = portalView(centre, WORLD);
      const at = { col: centre.col, row: centre.row };
      expect({ ...at, inside: view.minCol >= 0 && view.minRow >= 0 }).toEqual({
        ...at,
        inside: true,
      });
      expect({
        ...at,
        inside: view.maxCol < WORLD.width && view.maxRow < WORLD.height,
      }).toEqual({ ...at, inside: true });
      // And it is always the full patch, never a sliver.
      expect({ ...at, cols: view.maxCol - view.minCol + 1 }).toEqual({
        ...at,
        cols: PORTAL_TILES_ACROSS + 2,
      });
    }
  });

  test("a world smaller than the patch is not asked for tiles it has not got", () => {
    const view = portalView({ col: 1, row: 1 }, { width: 3, height: 3 });
    expect(view.minCol).toBe(0);
    expect(view.minRow).toBe(0);
    expect(view.maxCol).toBe(2);
    expect(view.maxRow).toBe(2);
  });
});

describe("how it opens", () => {
  test("shut at the start and wide at the end", () => {
    expect(portalOpenness(0, 340)).toBe(0);
    expect(portalOpenness(340, 340)).toBe(1);
    expect(portalOpenness(999, 340)).toBe(1);
    expect(portalOpenness(-5, 340)).toBe(0);
  });

  // The fast part of a portal is the tearing open. A linear one reads as a
  // door on a hinge.
  test("it snaps wide and settles, rather than creeping", () => {
    expect(portalOpenness(170, 340)).toBeGreaterThan(0.8);
    for (let ms = 1; ms <= 340; ms++) {
      expect(portalOpenness(ms, 340)).toBeGreaterThanOrEqual(portalOpenness(ms - 1, 340));
    }
  });

  test("a duration of nothing is simply open", () => {
    expect(portalOpenness(0, 0)).toBe(1);
  });

  // It plays every time a child travels. A delight the first time is a toll
  // by the tenth.
  test("the whole crossing is under two seconds", () => {
    expect(portalTravelMs()).toBeLessThan(2000);
    expect(portalTravelMs()).toBeGreaterThan(800);
  });
});
