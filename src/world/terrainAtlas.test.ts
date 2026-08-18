// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import { WorldGrid } from "./grid";
import { TERRAIN_TYPES, TerrainType } from "./terrain";
import {
  DUAL_OFFSET,
  DUAL_ORIGIN,
  buildVariationIndex,
  comboKey,
  cornerTerrainsFor,
  frameFor,
  frameName,
  variationFor,
} from "./terrainAtlas";
import { TILE_SIZE } from "./topdown";

const { Grass, Water, Sand, Dirt } = TerrainType;

function gridOf(rows: readonly (readonly TerrainType[])[]): WorldGrid {
  return new WorldGrid(rows);
}

describe("cornerTerrainsFor", () => {
  test("reads nw, ne, se, sw — the generator's corner order", () => {
    const grid = gridOf([
      [Grass, Water],
      [Sand, Dirt],
    ]);
    expect(cornerTerrainsFor(grid, 0, 0)).toEqual([Grass, Water, Dirt, Sand]);
  });

  test("clamps at the world edge so the outer ring of dual tiles still paints", () => {
    const grid = gridOf([
      [Grass, Water],
      [Sand, Dirt],
    ]);
    // The dual tile before the grid: all four corners clamp onto cell (0,0).
    expect(cornerTerrainsFor(grid, DUAL_ORIGIN, DUAL_ORIGIN)).toEqual([Grass, Grass, Grass, Grass]);
    // Past the far edge: everything clamps onto the last cell.
    expect(cornerTerrainsFor(grid, 1, 1)).toEqual([Dirt, Dirt, Dirt, Dirt]);
  });

  test("the dual grid's tiles between the edges mix real neighbours", () => {
    const grid = gridOf([
      [Grass, Water],
      [Sand, Dirt],
    ]);
    // Dual tile (-1, 0): west clamps to column 0, so nw/sw repeat it.
    expect(cornerTerrainsFor(grid, DUAL_ORIGIN, 0)).toEqual([Grass, Grass, Sand, Sand]);
  });
});

describe("frame naming", () => {
  test("is the four corners joined, then the variation", () => {
    expect(frameName([Grass, Water, Sand, Dirt], 3)).toBe("grass_water_sand_dirt_3");
  });

  test("comboKey drops the variation, matching what buildVariationIndex groups on", () => {
    expect(comboKey([Grass, Water, Sand, Dirt])).toBe("grass_water_sand_dirt");
  });
});

describe("buildVariationIndex", () => {
  test("counts the variants present per combination", () => {
    const index = buildVariationIndex(["grass_grass_grass_grass_0", "grass_grass_grass_grass_1"]);
    expect(index.get("grass_grass_grass_grass")).toBe(2);
  });

  test("derives the count from the highest index, not the number of names", () => {
    // Only the count matters to the renderer, and it must not undercount if
    // the loader ever hands frames back out of order or with a gap.
    const index = buildVariationIndex(["a_b_c_d_3", "a_b_c_d_0"]);
    expect(index.get("a_b_c_d")).toBe(4);
  });

  test("ignores names that carry no variation suffix", () => {
    const index = buildVariationIndex(["__BASE", "grass_grass_grass_grass_0"]);
    expect(index.has("__BASE")).toBe(false);
    expect(index.size).toBe(1);
  });
});

describe("variationFor", () => {
  test("is stable for a tile, so a chunk redraw never shimmers", () => {
    expect(variationFor(12, 34, 8)).toBe(variationFor(12, 34, 8));
  });

  test("stays in range", () => {
    for (let col = 0; col < 40; col++) {
      for (let row = 0; row < 40; row++) {
        const v = variationFor(col, row, 4);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(4);
      }
    }
  });

  test("does not degenerate to a single value across a field", () => {
    const seen = new Set<number>();
    for (let col = 0; col < 32; col++) {
      for (let row = 0; row < 32; row++) seen.add(variationFor(col, row, 8));
    }
    expect(seen.size).toBe(8);
  });

  test("is not the same for a tile and its neighbours", () => {
    // A hash that varied only with col + row would stripe the map diagonally.
    expect(variationFor(5, 5, 8) === variationFor(6, 4, 8)).toBe(false);
  });

  test("a single-variant combination always picks 0", () => {
    expect(variationFor(99, 17, 1)).toBe(0);
  });
});

describe("frameFor", () => {
  const variations = new Map([["grass_grass_grass_grass", 4]]);

  test("returns a name the atlas would contain", () => {
    const frame = frameFor([Grass, Grass, Grass, Grass], 3, 7, variations);
    expect(frame).not.toBeNull();
    expect(frame?.startsWith("grass_grass_grass_grass_")).toBe(true);
  });

  test("returns null for a combination the atlas has no art for", () => {
    expect(frameFor([Grass, Water, Sand, Dirt], 0, 0, variations)).toBeNull();
  });
});

describe("the dual grid's geometry", () => {
  test("a dual tile is drawn centred on its nw data cell", () => {
    // Its four corners are the centres of the four data cells around it, so
    // its own top-left lands on the centre of the nw one.
    expect(DUAL_OFFSET).toBe(TILE_SIZE / 2);
  });

  test("the grid starts one tile back, so the first data cell is fully covered", () => {
    expect(DUAL_ORIGIN).toBe(-1);
  });
});

describe("every terrain combination the game can produce", () => {
  test("is a combination of exactly the terrains the atlas was built from", () => {
    // 8 terrains, 4 corners — was 7 before the village square was paved. If
    // this number moves again, the shipped atlas is stale, and the contract
    // test in assets.test.ts will say so in the same breath.
    expect(TERRAIN_TYPES.length ** 4).toBe(4096);
  });
});
