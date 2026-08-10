// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import { WorldGrid } from "./grid";
import { Habitat } from "./habitat";
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

describe("WorldGrid at world scale", () => {
  // The flat Uint8Array storage this backs onto is the whole reason this
  // class exists at world size (500x500 = 250k tiles) — a grid this large
  // would be real GC pressure as an array of {terrain, plant} objects.
  function bigGrid(size: number): WorldGrid {
    const row = Array.from({ length: size }, () => TerrainType.Grass);
    return new WorldGrid(
      Array.from({ length: size }, (_, r) =>
        r === 0 || r === size - 1 ? Array.from({ length: size }, () => TerrainType.Water) : row,
      ),
    );
  }

  test("reads back terrain correctly at every corner of a large grid", () => {
    const size = 500;
    const grid = bigGrid(size);
    expect(grid.width).toBe(size);
    expect(grid.height).toBe(size);
    expect(grid.getTerrain(0, 0)).toBe(TerrainType.Water); // top border row
    expect(grid.getTerrain(size - 1, 0)).toBe(TerrainType.Water);
    expect(grid.getTerrain(0, size - 1)).toBe(TerrainType.Water); // bottom border row
    expect(grid.getTerrain(size - 1, size - 1)).toBe(TerrainType.Water);
    expect(grid.getTerrain(size / 2, size / 2)).toBe(TerrainType.Grass); // interior
  });

  test("passability holds at scale for both the border and interior", () => {
    const grid = bigGrid(500);
    expect(grid.isPassable(250, 0)).toBe(false);
    expect(grid.isPassable(250, 250)).toBe(true);
  });

  test("planting at scale only affects the targeted tile", () => {
    const grid = bigGrid(500);
    expect(grid.plant(300, 300, PlantType.Sunflower)).toBe(true);
    expect(grid.getPlant(300, 300)).toBe(PlantType.Sunflower);
    expect(grid.getPlant(299, 300)).toBe(null);
    expect(grid.getPlant(301, 300)).toBe(null);
  });
});

describe("WorldGrid.empty", () => {
  test("fills a grid of the given size with the default terrain", () => {
    const grid = WorldGrid.empty(500, 500, TerrainType.Grass);
    expect(grid.width).toBe(500);
    expect(grid.height).toBe(500);
    expect(grid.getTerrain(0, 0)).toBe(TerrainType.Grass);
    expect(grid.getTerrain(499, 499)).toBe(TerrainType.Grass);
  });
});

describe("WorldGrid terrain/habitat mutation", () => {
  test("setTerrain overwrites a single tile without affecting neighbours", () => {
    const grid = WorldGrid.empty(5, 5, TerrainType.Grass);
    grid.setTerrain(2, 2, TerrainType.Water);
    expect(grid.getTerrain(2, 2)).toBe(TerrainType.Water);
    expect(grid.getTerrain(1, 2)).toBe(TerrainType.Grass);
    expect(grid.getTerrain(2, 1)).toBe(TerrainType.Grass);
  });

  test("habitat defaults to Meadow and can be overwritten per tile", () => {
    const grid = WorldGrid.empty(5, 5, TerrainType.Grass);
    expect(grid.getHabitat(0, 0)).toBe(Habitat.Meadow);
    grid.setHabitat(0, 0, Habitat.Woodland);
    expect(grid.getHabitat(0, 0)).toBe(Habitat.Woodland);
    expect(grid.getHabitat(1, 0)).toBe(Habitat.Meadow);
  });
});
