// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import type { AreaPlacement } from "./anchors";
import { generateBorder } from "./border";
import { WorldGrid } from "./grid";
import { HABITAT_DEFINITIONS, Habitat } from "./habitat";
import { fillTerrainFromHabitats, growHabitats } from "./habitatGrowth";
import { createRng } from "./rng";
import { TerrainType, isPassable } from "./terrain";

const SIZE = 200;

function setup(seed: number): { grid: WorldGrid; forestSeed: { col: number; row: number } } {
  const grid = WorldGrid.empty(SIZE, SIZE, TerrainType.Grass);
  generateBorder(grid, createRng(seed));
  return { grid, forestSeed: { col: Math.floor(SIZE / 2), row: Math.floor(SIZE / 2) } };
}

describe("growHabitats", () => {
  test("every non-reserved tile ends up with a valid habitat assignment", () => {
    const { grid, forestSeed } = setup(1);
    growHabitats(grid, [], forestSeed, createRng(1));
    const allHabitats: Habitat[] = Object.values(Habitat);
    for (let row = 0; row < grid.height; row += 17) {
      for (let col = 0; col < grid.width; col += 17) {
        expect(allHabitats).toContain(grid.getHabitat(col, row));
      }
    }
  });

  test("the forest seed tile and its immediate area become Woodland", () => {
    const { grid, forestSeed } = setup(2);
    growHabitats(grid, [], forestSeed, createRng(2));
    expect(grid.getHabitat(forestSeed.col, forestSeed.row)).toBe(Habitat.Woodland);
  });

  test("border ring habitat is unchanged by growth", () => {
    const { grid, forestSeed } = setup(3);
    const beforeTop = grid.getHabitat(10, 0);
    const beforeLeft = grid.getHabitat(0, 10);
    growHabitats(grid, [], forestSeed, createRng(3));
    expect(grid.getHabitat(10, 0)).toBe(beforeTop);
    expect(grid.getHabitat(0, 10)).toBe(beforeLeft);
  });

  test("reserved boxes are left untouched", () => {
    const { grid, forestSeed } = setup(4);
    const box: AreaPlacement = { id: "test-area", col: 90, row: 90, width: 20, height: 20 };
    growHabitats(grid, [box], forestSeed, createRng(4));
    // Interior of the box (not overlapping the border) should stay at the
    // grid's default habitat, since growth never claimed it.
    expect(grid.getHabitat(100, 100)).toBe(Habitat.Meadow);
  });

  test("is deterministic for the same seed", () => {
    const a = setup(5);
    const b = setup(5);
    growHabitats(a.grid, [], a.forestSeed, createRng(5));
    growHabitats(b.grid, [], b.forestSeed, createRng(5));
    for (let row = 0; row < SIZE; row += 13) {
      for (let col = 0; col < SIZE; col += 13) {
        expect(a.grid.getHabitat(col, row)).toBe(b.grid.getHabitat(col, row));
      }
    }
  });
});

describe("fillTerrainFromHabitats", () => {
  test("every tile's terrain is one its habitat's weights actually allow", () => {
    const { grid, forestSeed } = setup(6);
    growHabitats(grid, [], forestSeed, createRng(6));
    fillTerrainFromHabitats(grid, [], createRng(6));

    for (let row = 1; row < grid.height - 1; row += 11) {
      for (let col = 1; col < grid.width - 1; col += 11) {
        const habitat = grid.getHabitat(col, row);
        const allowed = [...HABITAT_DEFINITIONS[habitat].terrainWeights.keys()];
        expect(allowed).toContain(grid.getTerrain(col, row));
      }
    }
  });

  test("border ring terrain stays impassable after fill", () => {
    const { grid, forestSeed } = setup(7);
    growHabitats(grid, [], forestSeed, createRng(7));
    fillTerrainFromHabitats(grid, [], createRng(7));
    expect(isPassable(grid.getTerrain(0, 50))).toBe(false);
    expect(isPassable(grid.getTerrain(50, 0))).toBe(false);
  });

  test("reserved box interiors are left at the default terrain", () => {
    const { grid, forestSeed } = setup(8);
    const box: AreaPlacement = { id: "test-area", col: 90, row: 90, width: 20, height: 20 };
    growHabitats(grid, [box], forestSeed, createRng(8));
    fillTerrainFromHabitats(grid, [box], createRng(8));
    expect(grid.getTerrain(100, 100)).toBe(TerrainType.Grass);
  });
});
