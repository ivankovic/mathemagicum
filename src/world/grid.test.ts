// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import { WorldGrid } from "./grid";
import { PlantType } from "./plants";
import { TerrainType } from "./terrain";

function smallGrid(): WorldGrid {
  return new WorldGrid([
    [TerrainType.Grass, TerrainType.Sand],
    [TerrainType.Water, TerrainType.Rock],
  ]);
}

describe("WorldGrid bounds", () => {
  test("reports its dimensions", () => {
    const grid = smallGrid();
    expect(grid.width).toBe(2);
    expect(grid.height).toBe(2);
  });

  test("inBounds is true inside the grid and false outside", () => {
    const grid = smallGrid();
    expect(grid.inBounds(0, 0)).toBe(true);
    expect(grid.inBounds(1, 1)).toBe(true);
    expect(grid.inBounds(-1, 0)).toBe(false);
    expect(grid.inBounds(0, 2)).toBe(false);
  });

  test("getTerrain reads back what the grid was built with", () => {
    const grid = smallGrid();
    expect(grid.getTerrain(1, 0)).toBe(TerrainType.Sand);
    expect(grid.getTerrain(0, 1)).toBe(TerrainType.Water);
  });
});

describe("WorldGrid passability", () => {
  test("grass and sand are passable, water and rock are not", () => {
    const grid = smallGrid();
    expect(grid.isPassable(0, 0)).toBe(true);
    expect(grid.isPassable(1, 0)).toBe(true);
    expect(grid.isPassable(0, 1)).toBe(false);
    expect(grid.isPassable(1, 1)).toBe(false);
  });

  test("out-of-bounds tiles are not passable", () => {
    const grid = smallGrid();
    expect(grid.isPassable(5, 5)).toBe(false);
  });
});

describe("WorldGrid planting", () => {
  test("can plant a valid plant on matching terrain", () => {
    const grid = smallGrid();
    expect(grid.canPlant(0, 0, PlantType.Sunflower)).toBe(true);
    expect(grid.plant(0, 0, PlantType.Sunflower)).toBe(true);
    expect(grid.getPlant(0, 0)).toBe(PlantType.Sunflower);
  });

  test("cannot plant on terrain the plant doesn't allow", () => {
    const grid = smallGrid();
    expect(grid.canPlant(1, 0, PlantType.Sunflower)).toBe(false);
    expect(grid.plant(1, 0, PlantType.Sunflower)).toBe(false);
    expect(grid.getPlant(1, 0)).toBe(null);
  });

  test("cannot plant twice on the same tile", () => {
    const grid = smallGrid();
    expect(grid.plant(0, 0, PlantType.Sunflower)).toBe(true);
    expect(grid.canPlant(0, 0, PlantType.Sunflower)).toBe(false);
    expect(grid.plant(0, 0, PlantType.Sunflower)).toBe(false);
  });

  test("cannot plant out of bounds", () => {
    const grid = smallGrid();
    expect(grid.plant(9, 9, PlantType.Sunflower)).toBe(false);
  });
});
