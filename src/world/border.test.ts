// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import { generateBorder, perimeterTiles } from "./border";
import { WorldGrid } from "./grid";
import { Habitat } from "./habitat";
import { createRng } from "./rng";
import { TerrainType, isPassable } from "./terrain";

describe("perimeterTiles", () => {
  test("count matches the standard ring formula for a square grid", () => {
    const tiles = perimeterTiles(10, 10);
    expect(tiles.length).toBe(2 * (10 + 10) - 4);
  });

  test("count matches for a non-square grid", () => {
    const tiles = perimeterTiles(20, 5);
    expect(tiles.length).toBe(2 * (20 + 5) - 4);
  });

  test("every tile is unique", () => {
    const tiles = perimeterTiles(15, 12);
    const keys = new Set(tiles.map((t) => `${t.col},${t.row}`));
    expect(keys.size).toBe(tiles.length);
  });

  test("every tile is actually on the ring, not the interior", () => {
    const width = 15;
    const height = 12;
    for (const { col, row } of perimeterTiles(width, height)) {
      const onRing = col === 0 || col === width - 1 || row === 0 || row === height - 1;
      expect(onRing).toBe(true);
    }
  });

  test("degenerate 1x1 grid returns a single tile", () => {
    expect(perimeterTiles(1, 1)).toEqual([{ col: 0, row: 0 }]);
  });
});

describe("generateBorder", () => {
  test("every ring tile ends up impassable, every interior tile untouched", () => {
    const size = 200;
    const grid = WorldGrid.empty(size, size, TerrainType.Grass);
    generateBorder(grid, createRng(1));

    const borderHabitats: Habitat[] = [Habitat.Coastal, Habitat.Highland];
    for (const { col, row } of perimeterTiles(size, size)) {
      expect(isPassable(grid.getTerrain(col, row))).toBe(false);
      expect(borderHabitats).toContain(grid.getHabitat(col, row));
    }
    expect(grid.getTerrain(size / 2, size / 2)).toBe(TerrainType.Grass);
  });

  test("produces both coastal and mountainous stretches, not just one", () => {
    const size = 300;
    const grid = WorldGrid.empty(size, size, TerrainType.Grass);
    generateBorder(grid, createRng(2));

    const habitatsSeen = new Set(
      perimeterTiles(size, size).map(({ col, row }) => grid.getHabitat(col, row)),
    );
    expect(habitatsSeen.has(Habitat.Coastal)).toBe(true);
    expect(habitatsSeen.has(Habitat.Highland)).toBe(true);
  });

  test("is deterministic for the same seed", () => {
    const size = 100;
    const gridA = WorldGrid.empty(size, size, TerrainType.Grass);
    const gridB = WorldGrid.empty(size, size, TerrainType.Grass);
    generateBorder(gridA, createRng(42));
    generateBorder(gridB, createRng(42));

    for (const { col, row } of perimeterTiles(size, size)) {
      expect(gridA.getTerrain(col, row)).toBe(gridB.getTerrain(col, row));
      expect(gridA.getHabitat(col, row)).toBe(gridB.getHabitat(col, row));
    }
  });
});
