// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import { WorldGrid } from "./grid";
import { SCATTER_DENSITY, scatterScenery } from "./scatter";
import { sceneryKind, sceneryOn } from "./scenery";
import { TerrainType } from "./terrain";
import { generateWorld } from "./worldGenerator";

function field(terrain: TerrainType, size = 60): WorldGrid {
  const grid = WorldGrid.empty(size, size, terrain);
  return grid;
}

describe("what the ground grows", () => {
  // Each terrain grows its own, so what stands on a tile is decided by what
  // the tile is rather than chosen — and a boulder never appears in the
  // middle of a wood.
  test("every piece is the scenery its own ground grows", () => {
    for (const terrain of [TerrainType.Woodland, TerrainType.Grass, TerrainType.Mountain]) {
      const grid = field(terrain);
      for (const object of scatterScenery(grid, [], 5)) {
        expect({ terrain, kind: sceneryKind(object.type) }).toEqual({
          terrain,
          kind: sceneryOn(terrain) ?? null,
        });
      }
    }
  });

  // The numbers are the whole difference between "a wood" and "a lawn with
  // trees on it".
  test("a wood is thick and a meadow is not", () => {
    const wood = scatterScenery(field(TerrainType.Woodland), [], 5).length;
    const meadow = scatterScenery(field(TerrainType.Grass), [], 5).length;
    expect(wood).toBeGreaterThan(meadow * 3);
    expect(SCATTER_DENSITY[TerrainType.Woodland] ?? 0).toBeGreaterThan(
      SCATTER_DENSITY[TerrainType.Grass] ?? 0,
    );
  });

  // A wood with its trees at a uniform spacing reads as an orchard; what
  // makes it a wood is thickets with clearings between them.
  test("it clumps rather than sprinkling evenly", () => {
    const grid = field(TerrainType.Woodland, 80);
    const placed = scatterScenery(grid, [], 5);
    // Count per quarter: an even sprinkle would put roughly the same number
    // in each, and thickets will not.
    const quarters = [0, 0, 0, 0];
    for (const object of placed) {
      const q = (object.col < 40 ? 0 : 1) + (object.row < 40 ? 0 : 2);
      quarters[q] = (quarters[q] ?? 0) + 1;
    }
    const spread = Math.max(...quarters) - Math.min(...quarters);
    expect(spread).toBeGreaterThan(placed.length / 20);
  });

  test("nothing lands on water, which grows nothing", () => {
    expect(scatterScenery(field(TerrainType.Water), [], 5)).toEqual([]);
  });

  test("nothing lands in a reserved story area", () => {
    const grid = field(TerrainType.Woodland);
    const box = { id: "harbour", col: 10, row: 10, width: 20, height: 20 };
    for (const object of scatterScenery(grid, [box], 5)) {
      const overlaps =
        object.col + 1 > box.col &&
        object.col < box.col + box.width &&
        object.row + 1 > box.row &&
        object.row < box.row + box.height;
      expect({ id: object.id, overlaps }).toEqual({ id: object.id, overlaps: false });
    }
  });

  // A cliff is drawn from the levels at a tile's four *corners*, so a tree
  // standing beside a step has the cliff line drawn across its trunk even
  // though the tree itself is on flat ground. Nothing may stand on the lip.
  test("nothing stands on the lip of a step", () => {
    const grid = field(TerrainType.Woodland);
    for (let col = 0; col < 60; col++) grid.setLevel(col, 30, 1);
    for (const object of scatterScenery(grid, [], 5)) {
      const levels = new Set<number>();
      for (let row = object.row - 1; row <= object.row + 1; row++) {
        for (let col = object.col - 1; col <= object.col + 1; col++) {
          if (grid.inBounds(col, row)) levels.add(grid.getLevel(col, row));
        }
      }
      expect({ id: object.id, levels: levels.size }).toEqual({ id: object.id, levels: 1 });
    }
  });

  test("nothing lands on top of anything else", () => {
    const grid = field(TerrainType.Woodland);
    const seen = new Set<string>();
    for (const object of scatterScenery(grid, [], 5)) {
      const key = `${object.col},${object.row}`;
      expect({ key, taken: seen.has(key) }).toEqual({ key, taken: false });
      seen.add(key);
    }
  });

  // The whole reason the lattice went to a single tile: a wood is thickets
  // with clearings between them, and a thicket needs trees that touch.
  test("trees may stand next to each other", () => {
    const grid = field(TerrainType.Woodland);
    const at = new Set(scatterScenery(grid, [], 5).map((o) => `${o.col},${o.row}`));
    const touching = [...at].some((key) => {
      const [col, row] = key.split(",").map(Number) as [number, number];
      return at.has(`${col + 1},${row}`) || at.has(`${col},${row + 1}`);
    });
    expect(touching).toBe(true);
  });

  test("the same seed grows the same wood", () => {
    const a = scatterScenery(field(TerrainType.Woodland), [], 11).map((o) => o.id);
    const b = scatterScenery(field(TerrainType.Woodland), [], 11).map((o) => o.id);
    expect(a).toEqual(b);
    expect(a).not.toEqual(scatterScenery(field(TerrainType.Woodland), [], 12).map((o) => o.id));
  });
});

describe("a real world", () => {
  // The wall along the rim was the only thing that had ever placed a tree,
  // so taking it away took every tree in the world with it.
  test("has trees in it", () => {
    const world = generateWorld(200, 200, 7);
    const scenery = world.grid.listObjects().filter((o) => sceneryKind(o.type));
    expect(scenery.length).toBeGreaterThan(100);
    const kinds = new Set(scenery.map((o) => sceneryKind(o.type)));
    expect(kinds.size).toBeGreaterThan(1);
  });
});
