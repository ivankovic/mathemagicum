// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import { WorldGrid } from "./grid";
import { TerrainType } from "./terrain";
import { CopyRefusal, cornerOf, planCopy, readPainted } from "./terrainCopy";

/** A small world of grass, with whatever else the test paints on it. */
function world(): WorldGrid {
  return WorldGrid.empty(10, 10, TerrainType.Grass);
}

describe("planning a copy", () => {
  test("takes the ground from there and puts it here", () => {
    const grid = world();
    grid.setTerrain(1, 1, TerrainType.Sand);
    const plan = planCopy(grid, [{ col: 1, row: 1 }], { col: 5, row: 5 });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.paint).toEqual([{ at: { col: 5, row: 5 }, terrain: TerrainType.Sand }]);
  });

  // A block is a list of squares, so it is the same path with more of them:
  // the corner of the source lands on the square she pointed at.
  test("and a whole block keeps its shape", () => {
    const grid = world();
    grid.setTerrain(1, 1, TerrainType.Sand);
    grid.setTerrain(2, 1, TerrainType.Dirt);
    const source = [
      { col: 1, row: 1 },
      { col: 2, row: 1 },
      { col: 1, row: 2 },
      { col: 2, row: 2 },
    ];
    const plan = planCopy(grid, source, { col: 6, row: 6 });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.paint).toHaveLength(4);
    expect(plan.paint[0]).toEqual({ at: { col: 6, row: 6 }, terrain: TerrainType.Sand });
    expect(plan.paint[1]).toEqual({ at: { col: 7, row: 6 }, terrain: TerrainType.Dirt });
    // Every square keeps its place relative to the corner.
    expect(plan.paint.map((one) => one.at)).toEqual([
      { col: 6, row: 6 },
      { col: 7, row: 6 },
      { col: 6, row: 7 },
      { col: 7, row: 7 },
    ]);
  });

  /**
   * It cannot make water and it cannot drown any.
   *
   * The one rule, and it is about the world staying playable: terrain is
   * what decides where a child can walk, so a spell that painted sea over a
   * path could cut a village in half or strand her on an island she made
   * herself.
   */
  test("but never copies the sea", () => {
    const grid = world();
    grid.setTerrain(1, 1, TerrainType.Water);
    const plan = planCopy(grid, [{ col: 1, row: 1 }], { col: 5, row: 5 });
    expect(plan.ok).toBe(false);
    if (plan.ok) return;
    expect(plan.why).toBe(CopyRefusal.NotGround);
    expect(plan.at).toEqual({ col: 1, row: 1 });
  });

  test("and never paints over it", () => {
    const grid = world();
    grid.setTerrain(5, 5, TerrainType.Water);
    const plan = planCopy(grid, [{ col: 1, row: 1 }], { col: 5, row: 5 });
    expect(plan.ok).toBe(false);
    if (plan.ok) return;
    expect(plan.why).toBe(CopyRefusal.OverWater);
    expect(plan.at).toEqual({ col: 5, row: 5 });
  });

  // Refused whole rather than half-done: half a block of moved ground is a
  // mess a child cannot undo.
  test("and one bad square refuses the whole block", () => {
    const grid = world();
    grid.setTerrain(7, 6, TerrainType.Water);
    const source = [
      { col: 1, row: 1 },
      { col: 2, row: 1 },
    ];
    const plan = planCopy(grid, source, { col: 6, row: 6 });
    expect(plan.ok).toBe(false);
    if (plan.ok) return;
    expect(plan.why).toBe(CopyRefusal.OverWater);
  });

  test("and refuses to run off the edge of the world", () => {
    const grid = world();
    const plan = planCopy(grid, [{ col: 1, row: 1 }], { col: 9, row: 9 });
    expect(plan.ok).toBe(true);
    const over = planCopy(
      grid,
      [
        { col: 1, row: 1 },
        { col: 2, row: 1 },
      ],
      { col: 9, row: 9 },
    );
    expect(over.ok).toBe(false);
    if (over.ok) return;
    expect(over.why).toBe(CopyRefusal.OffMap);
  });

  // Pointing at the place it already is is not a copy, and answering a whole
  // parchment to change nothing would be a spell that lied about working.
  test("and refuses to copy something onto itself", () => {
    const grid = world();
    const plan = planCopy(grid, [{ col: 3, row: 3 }], { col: 3, row: 3 });
    expect(plan.ok).toBe(false);
    if (plan.ok) return;
    expect(plan.why).toBe(CopyRefusal.SameSpot);
  });

  test("and nothing at all is nothing to copy", () => {
    expect(planCopy(world(), [], { col: 1, row: 1 }).ok).toBe(false);
  });
});

describe("the corner of a block", () => {
  test("is its smallest column and row, whichever way it was drawn", () => {
    expect(
      cornerOf([
        { col: 4, row: 7 },
        { col: 2, row: 9 },
        { col: 3, row: 5 },
      ]),
    ).toEqual({ col: 2, row: 5 });
  });
});

describe("reading painted ground back from a save", () => {
  test("keeps what makes sense", () => {
    expect(readPainted([[1, 2, "sand"]])).toEqual([[1, 2, TerrainType.Sand]]);
  });

  // A save is data from outside the program however it got there, and a
  // crash on load is a farm a child can never reach again.
  test("and drops what does not", () => {
    expect(readPainted([[1, 2, "lava"]])).toEqual([]);
    expect(readPainted([[1.5, 2, "sand"]])).toEqual([]);
    expect(readPainted([[1, 2]])).toEqual([]);
    expect(readPainted(["sand"])).toEqual([]);
    for (const junk of [null, undefined, 7, {}, "sand"]) {
      expect(readPainted(junk)).toEqual([]);
    }
  });
});
