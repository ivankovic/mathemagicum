// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import { generateStubWorld } from "./stubWorld";
import { TerrainType } from "./terrain";

describe("generateStubWorld", () => {
  test("border is impassable water, interior is grass", () => {
    const { grid } = generateStubWorld(10);
    expect(grid.getTerrain(0, 5)).toBe(TerrainType.Water);
    expect(grid.getTerrain(9, 5)).toBe(TerrainType.Water);
    expect(grid.getTerrain(5, 0)).toBe(TerrainType.Water);
    expect(grid.getTerrain(5, 9)).toBe(TerrainType.Water);
    expect(grid.isPassable(0, 5)).toBe(false);
    expect(grid.getTerrain(5, 5)).toBe(TerrainType.Grass);
    expect(grid.isPassable(5, 5)).toBe(true);
  });

  test("player starts on a passable interior tile", () => {
    const { grid, playerStart } = generateStubWorld(500);
    expect(grid.isPassable(playerStart.col, playerStart.row)).toBe(true);
  });
});
