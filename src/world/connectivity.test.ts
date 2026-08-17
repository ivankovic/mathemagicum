// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import { ensureConnectivity, findCarvePath, floodFillReachable, isReachable } from "./connectivity";
import { WorldGrid } from "./grid";
import { TerrainType } from "./terrain";
import type { GridPoint } from "./topdown";

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

describe("ensureConnectivity through blocking objects", () => {
  function ringed(): { grid: WorldGrid; target: GridPoint } {
    // A pocket of open ground walled in by objects rather than by terrain —
    // exactly the shape a story area takes when the map's edge barrier
    // closes around it.
    const grid = WorldGrid.empty(21, 21, TerrainType.Grass);
    for (let row = 4; row <= 10; row++) {
      for (let col = 4; col <= 10; col++) {
        const onRing = row === 4 || row === 10 || col === 4 || col === 10;
        if (!onRing) continue;
        grid.placeObject({
          id: `wall-${col}-${row}`,
          type: "scenery-mountain",
          col,
          row,
          width: 1,
          height: 1,
          blocksMovement: true,
          anchorCol: col,
          anchorRow: row,
        });
      }
    }
    return { grid, target: { col: 7, row: 7 } };
  }

  test("a pocket walled in by objects starts out unreachable", () => {
    const { grid, target } = ringed();
    const reachable = floodFillReachable(grid, { col: 0, row: 0 });
    expect(isReachable(reachable, grid, target)).toBe(false);
  });

  test("carves through them, not just through terrain", () => {
    // Rewriting terrain alone leaves the boulder standing in the gap. This
    // failed silently once: a story area sealed into the mountain stayed
    // sealed while the generator reported success.
    const { grid, target } = ringed();
    ensureConnectivity(grid, { col: 0, row: 0 }, [target]);
    const reachable = floodFillReachable(grid, { col: 0, row: 0 });
    expect(isReachable(reachable, grid, target)).toBe(true);
  });

  test("removes as little of the wall as it can", () => {
    const { grid, target } = ringed();
    const before = grid.listObjects().length;
    ensureConnectivity(grid, { col: 0, row: 0 }, [target]);
    const removed = before - grid.listObjects().length;
    expect(removed).toBeGreaterThan(0);
    expect(removed).toBeLessThan(4);
  });

  test("throws rather than reporting success it did not achieve", () => {
    // The guarantee is the whole point of this function, so a target it
    // cannot open a route to has to be loud. Nothing inside the grid
    // qualifies any more — carving now clears objects as well as terrain,
    // so any in-bounds target is reachable — which leaves off the map as
    // the only genuinely impossible ask.
    const grid = WorldGrid.empty(9, 9, TerrainType.Grass);
    expect(() => ensureConnectivity(grid, { col: 0, row: 0 }, [{ col: 40, row: 40 }])).toThrow();
  });

  test("opens a route to any target that is actually on the map", () => {
    // The flip side of the above, and the stronger statement: with objects
    // clearable there is no in-bounds arrangement this cannot solve.
    const grid = WorldGrid.empty(15, 15, TerrainType.Water);
    grid.setTerrain(0, 0, TerrainType.Grass);
    for (const target of [
      { col: 14, row: 14 },
      { col: 0, row: 14 },
      { col: 7, row: 7 },
    ]) {
      ensureConnectivity(grid, { col: 0, row: 0 }, [target]);
      const reachable = floodFillReachable(grid, { col: 0, row: 0 });
      expect(isReachable(reachable, grid, target)).toBe(true);
    }
  });
});
