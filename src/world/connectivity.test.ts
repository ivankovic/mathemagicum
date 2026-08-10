// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import { ensureConnectivity, findCarvePath, floodFillReachable, isReachable } from "./connectivity";
import { WorldGrid } from "./grid";
import { TerrainType } from "./terrain";

function gridFromRows(rows: readonly string[]): WorldGrid {
  const legend: Record<string, TerrainType> = { G: TerrainType.Grass, W: TerrainType.Water };
  return new WorldGrid(rows.map((row) => [...row].map((c) => legend[c] ?? TerrainType.Grass)));
}

describe("floodFillReachable", () => {
  test("open terrain: everything is reachable", () => {
    const grid = gridFromRows(["GGG", "GGG", "GGG"]);
    const visited = floodFillReachable(grid, { col: 0, row: 0 });
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        expect(isReachable(visited, grid, { col, row })).toBe(true);
      }
    }
  });

  test("a wall of water blocks reachability across it", () => {
    const grid = gridFromRows(["GGG", "WWW", "GGG"]);
    const visited = floodFillReachable(grid, { col: 0, row: 0 });
    expect(isReachable(visited, grid, { col: 1, row: 0 })).toBe(true);
    expect(isReachable(visited, grid, { col: 1, row: 2 })).toBe(false);
  });

  test("starting on impassable terrain reaches nothing", () => {
    const grid = gridFromRows(["WGG", "GGG"]);
    const visited = floodFillReachable(grid, { col: 0, row: 0 });
    expect(isReachable(visited, grid, { col: 1, row: 0 })).toBe(false);
  });
});

describe("findCarvePath", () => {
  test("costs zero when a fully passable route already exists", () => {
    const grid = gridFromRows(["GGG", "GGG", "GGG"]);
    const path = findCarvePath(grid, { col: 0, row: 0 }, { col: 2, row: 2 });
    expect(path).not.toBeNull();
    for (const { col, row } of path ?? []) {
      expect(grid.isPassable(col, row)).toBe(true);
    }
  });

  test("prefers a longer free route over a short carve when both exist", () => {
    // Wall spans the whole width except a gap at col=4 — going around
    // costs 0 carves via the gap; going straight through costs 1+.
    const grid = gridFromRows(["GGGGGGGGG", "WWWWGWWWW", "GGGGGGGGG"]);
    const path = findCarvePath(grid, { col: 0, row: 0 }, { col: 0, row: 2 });
    expect(path).not.toBeNull();
    const carvedTiles = (path ?? []).filter(({ col, row }) => !grid.isPassable(col, row));
    expect(carvedTiles.length).toBe(0);
  });

  test("carves the minimal number of tiles when no free route exists", () => {
    const grid = gridFromRows(["GGGGG", "WWWWW", "GGGGG"]);
    const path = findCarvePath(grid, { col: 0, row: 0 }, { col: 0, row: 2 });
    expect(path).not.toBeNull();
    const carvedTiles = (path ?? []).filter(({ col, row }) => !grid.isPassable(col, row));
    expect(carvedTiles.length).toBe(1);
  });

  test("returns an empty path when start equals goal", () => {
    const grid = gridFromRows(["GGG", "GGG"]);
    expect(findCarvePath(grid, { col: 1, row: 1 }, { col: 1, row: 1 })).toEqual([]);
  });
});

describe("ensureConnectivity", () => {
  test("leaves already-reachable targets untouched", () => {
    const grid = gridFromRows(["GGG", "GGG", "GGG"]);
    const before = grid.getTerrain(1, 1);
    ensureConnectivity(grid, { col: 0, row: 0 }, [{ col: 2, row: 2 }]);
    expect(grid.getTerrain(1, 1)).toBe(before);
  });

  test("carves a path to make an unreachable target reachable", () => {
    const grid = gridFromRows(["GGGGG", "WWWWW", "GGGGG"]);
    const target = { col: 2, row: 2 };
    const start = { col: 2, row: 0 };
    expect(isReachable(floodFillReachable(grid, start), grid, target)).toBe(false);

    ensureConnectivity(grid, start, [target]);

    expect(isReachable(floodFillReachable(grid, start), grid, target)).toBe(true);
  });

  test("carves minimally — most of the wall stays impassable", () => {
    const grid = gridFromRows(["GGGGGGGGG", "WWWWWWWWW", "GGGGGGGGG"]);
    ensureConnectivity(grid, { col: 4, row: 0 }, [{ col: 4, row: 2 }]);

    let passableInWall = 0;
    for (let col = 0; col < 9; col++) {
      if (grid.isPassable(col, 1)) passableInWall++;
    }
    expect(passableInWall).toBe(1);
  });

  test("handles multiple targets, each becoming reachable", () => {
    const grid = gridFromRows(["GGGGG", "WWWWW", "GGGGG"]);
    const start = { col: 0, row: 0 };
    const targets = [
      { col: 0, row: 2 },
      { col: 4, row: 2 },
    ];
    ensureConnectivity(grid, start, targets);
    const visited = floodFillReachable(grid, start);
    for (const t of targets) {
      expect(isReachable(visited, grid, t)).toBe(true);
    }
  });
});
