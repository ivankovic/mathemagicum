// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import { WorldGrid } from "./grid";
import { findPath } from "./pathfinding";
import { TerrainType } from "./terrain";

function gridFromRows(rows: readonly string[]): WorldGrid {
  const legend: Record<string, TerrainType> = {
    G: TerrainType.Grass,
    W: TerrainType.Water,
  };
  return new WorldGrid(rows.map((row) => [...row].map((c) => legend[c] ?? TerrainType.Grass)));
}

describe("findPath", () => {
  test("returns an empty path when already at the goal", () => {
    const grid = gridFromRows(["GGG", "GGG", "GGG"]);
    expect(findPath(grid, { col: 1, row: 1 }, { col: 1, row: 1 })).toEqual([]);
  });

  test("finds the shortest straight-line path on open terrain", () => {
    const grid = gridFromRows(["GGGGG"]);
    const path = findPath(grid, { col: 0, row: 0 }, { col: 3, row: 0 });
    expect(path).toEqual([
      { col: 1, row: 0 },
      { col: 2, row: 0 },
      { col: 3, row: 0 },
    ]);
  });

  test("returns null when the goal tile is impassable", () => {
    const grid = gridFromRows(["GGG", "GWG", "GGG"]);
    expect(findPath(grid, { col: 0, row: 0 }, { col: 1, row: 1 })).toEqual(null);
  });

  test("returns null when the goal is walled off by impassable terrain", () => {
    const grid = gridFromRows(["GWG", "GWG", "GWG"]);
    expect(findPath(grid, { col: 0, row: 0 }, { col: 2, row: 0 })).toEqual(null);
  });

  test("routes around obstacles instead of failing", () => {
    const grid = gridFromRows(["GGG", "WWG", "GGG"]);
    const path = findPath(grid, { col: 0, row: 0 }, { col: 0, row: 2 });
    expect(path).not.toBeNull();
    expect(path?.at(-1)).toEqual({ col: 0, row: 2 });
    for (const step of path ?? []) {
      expect(grid.isPassable(step.col, step.row)).toBe(true);
    }
  });

  test("returns null for an out-of-bounds goal", () => {
    const grid = gridFromRows(["GGG", "GGG", "GGG"]);
    expect(findPath(grid, { col: 0, row: 0 }, { col: 99, row: 99 })).toEqual(null);
  });
});
