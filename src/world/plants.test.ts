// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import { PlantType, canPlantOn } from "./plants";
import { TerrainType } from "./terrain";

describe("canPlantOn", () => {
  test("carrot grows on dirt and grass, not sand", () => {
    expect(canPlantOn(PlantType.Carrot, TerrainType.Dirt)).toBe(true);
    expect(canPlantOn(PlantType.Carrot, TerrainType.Grass)).toBe(true);
    expect(canPlantOn(PlantType.Carrot, TerrainType.Sand)).toBe(false);
  });

  test("cactus only grows on sand", () => {
    expect(canPlantOn(PlantType.Cactus, TerrainType.Sand)).toBe(true);
    expect(canPlantOn(PlantType.Cactus, TerrainType.Grass)).toBe(false);
  });

  test("nothing grows on water or rock", () => {
    for (const plant of Object.values(PlantType)) {
      expect(canPlantOn(plant, TerrainType.Water)).toBe(false);
      expect(canPlantOn(plant, TerrainType.Mountain)).toBe(false);
    }
  });
});
