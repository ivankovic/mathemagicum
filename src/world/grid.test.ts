// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import { WorldGrid } from "./grid";
import { Habitat } from "./habitat";
import type { PlacedObject } from "./objects";
import { PlantStage, PlantType } from "./plants";
import { TerrainType } from "./terrain";

function smallGrid(): WorldGrid {
  return new WorldGrid([
    [TerrainType.Grass, TerrainType.Sand],
    [TerrainType.Water, TerrainType.Mountain],
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
  // Only the sea blocks. Mountain used to as well, and playtesting killed
  // it: a whole terrain nobody can set foot on is a third of the map behind
  // glass. What makes high ground hard going is the rock standing on it, not
  // the ground itself.
  test("only water is impassable ground", () => {
    const grid = smallGrid();
    expect(grid.isPassable(0, 0)).toBe(true);
    expect(grid.isPassable(1, 0)).toBe(true);
    expect(grid.isPassable(0, 1)).toBe(false);
    expect(grid.isPassable(1, 1)).toBe(true);
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

describe("WorldGrid growing", () => {
  test("a new crop starts as a seedling", () => {
    const grid = smallGrid();
    grid.plant(0, 0, PlantType.Sunflower);
    expect(grid.getCrop(0, 0)).toEqual({
      plant: PlantType.Sunflower,
      stage: PlantStage.Seedling,
    });
  });

  test("growing walks the stages in order and then stops", () => {
    const grid = smallGrid();
    grid.plant(0, 0, PlantType.Sunflower);
    expect(grid.growCrop(0, 0)?.stage).toBe(PlantStage.Growing);
    expect(grid.growCrop(0, 0)?.stage).toBe(PlantStage.Mature);
    // A fully grown crop reports no change rather than silently staying put,
    // so the caster can say so instead of spending a cast on nothing.
    expect(grid.growCrop(0, 0)).toBe(null);
    expect(grid.getCrop(0, 0)?.stage).toBe(PlantStage.Mature);
  });

  test("growing bare ground does nothing", () => {
    const grid = smallGrid();
    expect(grid.growCrop(0, 0)).toBe(null);
  });

  test("growing one crop leaves its neighbours alone", () => {
    const grid = smallGrid();
    grid.plant(0, 0, PlantType.Sunflower);
    grid.plant(1, 0, PlantType.Cactus); // the sand tile next to it
    grid.growCrop(0, 0);
    expect(grid.getCrop(1, 0)?.stage).toBe(PlantStage.Seedling);
  });

  test("growing keeps the crop it was", () => {
    const grid = smallGrid();
    grid.plant(0, 0, PlantType.Carrot);
    expect(grid.growCrop(0, 0)?.plant).toBe(PlantType.Carrot);
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

describe("WorldGrid placed objects", () => {
  function building(overrides: Partial<PlacedObject> = {}): PlacedObject {
    return {
      id: "school",
      type: "school",
      col: 1,
      row: 1,
      width: 2,
      height: 2,
      blocksMovement: true,
      anchorCol: 1,
      anchorRow: 1,
      ...overrides,
    };
  }

  test("a blocking object makes every tile of its footprint impassable", () => {
    const grid = WorldGrid.empty(5, 5, TerrainType.Grass);
    grid.placeObject(building());
    expect(grid.isPassable(1, 1)).toBe(false);
    expect(grid.isPassable(2, 2)).toBe(false);
    expect(grid.isPassable(0, 0)).toBe(true); // outside the footprint
    expect(grid.isPassable(3, 1)).toBe(true);
  });

  test("a non-blocking object leaves its footprint passable", () => {
    const grid = WorldGrid.empty(5, 5, TerrainType.Grass);
    grid.placeObject(building({ blocksMovement: false }));
    expect(grid.isPassable(1, 1)).toBe(true);
  });

  test("getObjectAt returns the object covering a tile, or null", () => {
    const grid = WorldGrid.empty(5, 5, TerrainType.Grass);
    const well = building({ id: "well", type: "well", col: 3, row: 3, width: 1, height: 1 });
    grid.placeObject(well);
    expect(grid.getObjectAt(3, 3)).toEqual(well);
    expect(grid.getObjectAt(0, 0)).toBe(null);
    expect(grid.getObjectAt(99, 99)).toBe(null); // out of bounds
  });

  test("listObjects enumerates every placed object exactly once", () => {
    const grid = WorldGrid.empty(10, 10, TerrainType.Grass);
    grid.placeObject(building({ id: "a", col: 0, row: 0 }));
    grid.placeObject(building({ id: "b", col: 5, row: 5 }));
    expect(
      grid
        .listObjects()
        .map((o) => o.id)
        .sort(),
    ).toEqual(["a", "b"]);
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

describe("WorldGrid harvesting", () => {
  function mature(grid: WorldGrid, col: number, row: number, plant: PlantType): void {
    grid.plant(col, row, plant);
    while (grid.growCrop(col, row)) {
      // grow until there is nothing left to grow
    }
  }

  test("a ripe crop can be picked, and comes off the tile", () => {
    const grid = smallGrid();
    mature(grid, 0, 0, PlantType.Sunflower);
    expect(grid.harvestCrop(0, 0)).toEqual({
      plant: PlantType.Sunflower,
      stage: PlantStage.Mature,
    });
    expect(grid.getCrop(0, 0)).toBe(null);
  });

  // The rule lives in the grid so a second thing that harvests cannot have
  // its own opinion about what "ready" means.
  test("a crop that is still growing is left alone", () => {
    const grid = smallGrid();
    grid.plant(0, 0, PlantType.Sunflower);
    expect(grid.harvestCrop(0, 0)).toBe(null);
    expect(grid.getCrop(0, 0)?.stage).toBe(PlantStage.Seedling);
    grid.growCrop(0, 0);
    expect(grid.harvestCrop(0, 0)).toBe(null);
    expect(grid.getCrop(0, 0)?.stage).toBe(PlantStage.Growing);
  });

  test("harvesting bare ground does nothing", () => {
    expect(smallGrid().harvestCrop(0, 0)).toBe(null);
  });

  test("the same crop cannot be picked twice", () => {
    const grid = smallGrid();
    mature(grid, 0, 0, PlantType.Sunflower);
    expect(grid.harvestCrop(0, 0)).not.toBe(null);
    expect(grid.harvestCrop(0, 0)).toBe(null);
  });

  test("a picked tile can be planted again", () => {
    const grid = smallGrid();
    mature(grid, 0, 0, PlantType.Sunflower);
    grid.harvestCrop(0, 0);
    expect(grid.canPlant(0, 0, PlantType.Sunflower)).toBe(true);
    expect(grid.plant(0, 0, PlantType.Sunflower)).toBe(true);
    expect(grid.getCrop(0, 0)?.stage).toBe(PlantStage.Seedling);
  });

  test("picking one crop leaves its neighbours alone", () => {
    const grid = smallGrid();
    mature(grid, 0, 0, PlantType.Sunflower);
    mature(grid, 1, 0, PlantType.Cactus);
    grid.harvestCrop(0, 0);
    expect(grid.getCrop(1, 0)?.plant).toBe(PlantType.Cactus);
  });
});

describe("a deck over the water", () => {
  const decked = () => {
    const grid = WorldGrid.empty(8, 8, TerrainType.Water);
    grid.setTerrain(0, 0, TerrainType.Sand);
    return grid;
  };

  test("makes ground you could not stand on walkable", () => {
    const grid = decked();
    expect(grid.isPassable(3, 3)).toBe(false);
    grid.setBridge(3, 3, true);
    expect(grid.isPassable(3, 3)).toBe(true);
    grid.setBridge(3, 3, false);
    expect(grid.isPassable(3, 3)).toBe(false);
  });

  // The one thing a plank must not do: hold up something standing on it and
  // then let the player walk through that thing anyway.
  test("does not lift whatever is standing on it", () => {
    const grid = decked();
    grid.setBridge(3, 3, true);
    grid.placeObject({
      id: "crate",
      type: "crate",
      col: 3,
      row: 3,
      anchorCol: 3,
      anchorRow: 3,
      width: 1,
      height: 1,
      blocksMovement: true,
    });
    expect(grid.isPassable(3, 3)).toBe(false);
  });

  test("is not soil — planks are not somewhere a crop grows", () => {
    const grid = decked();
    expect(grid.canPlant(0, 0, PlantType.Cactus)).toBe(true);
    grid.setBridge(0, 0, true);
    expect(grid.canPlant(0, 0, PlantType.Cactus)).toBe(false);
  });

  test("lists only the cells that have one, for the renderer", () => {
    const grid = decked();
    grid.setBridge(1, 2, true);
    grid.setBridge(4, 5, true);
    expect(grid.listBridges()).toEqual([
      { col: 1, row: 2 },
      { col: 4, row: 5 },
    ]);
  });

  test("refuses a cell off the edge of the world rather than growing one", () => {
    const grid = decked();
    expect(() => grid.setBridge(-1, 0, true)).toThrow();
    expect(grid.isBridged(-1, 0)).toBe(false);
  });
});
