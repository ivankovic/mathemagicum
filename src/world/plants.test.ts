// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import {
  PLANTED_STAGE,
  PLANT_DEFINITIONS,
  PLANT_STAGES,
  PLANT_TYPES,
  PlantStage,
  PlantType,
  canPlantOn,
  plantAnimKey,
  plantSheetKey,
} from "./plants";
import { TERRAIN_TYPES, TerrainType } from "./terrain";

describe("canPlantOn", () => {
  test("allows each crop only on the terrain it is defined for", () => {
    expect(canPlantOn(PlantType.Cactus, TerrainType.Sand)).toBe(true);
    expect(canPlantOn(PlantType.Cactus, TerrainType.Grass)).toBe(false);
    expect(canPlantOn(PlantType.Sunflower, TerrainType.Grass)).toBe(true);
  });

  test("no crop grows on terrain the player cannot stand on", () => {
    // Planting happens on the tile the player occupies, so a crop allowed on
    // water or mountain could never be planted anyway — and listing one would
    // be a promise the game silently breaks.
    for (const plant of PLANT_TYPES) {
      expect(canPlantOn(plant, TerrainType.Water)).toBe(false);
      expect(canPlantOn(plant, TerrainType.Mountain)).toBe(false);
    }
  });

  test("every crop grows somewhere", () => {
    for (const plant of PLANT_TYPES) {
      expect(TERRAIN_TYPES.some((t) => canPlantOn(plant, t))).toBe(true);
    }
  });

  test("terrain choice actually distinguishes the crops", () => {
    // If every crop grew everywhere, "pick a plant suited to the terrain"
    // would not be a decision.
    const signatures = new Set(
      PLANT_TYPES.map((p) => TERRAIN_TYPES.filter((t) => canPlantOn(p, t)).join(",")),
    );
    expect(signatures.size).toBeGreaterThan(1);
  });

  test("every definition lists only real terrain types", () => {
    for (const definition of Object.values(PLANT_DEFINITIONS)) {
      for (const terrain of definition.allowedTerrain) {
        expect(TERRAIN_TYPES).toContain(terrain);
      }
    }
  });
});

describe("growth stages", () => {
  test("run from seedling to mature", () => {
    expect(PLANT_STAGES).toEqual([PlantStage.Seedling, PlantStage.Growing, PlantStage.Mature]);
  });

  test("a newly planted crop is drawn at a stage that exists", () => {
    expect(PLANT_STAGES).toContain(PLANTED_STAGE);
  });

  test("planting shows the finished crop while there is no tending loop", () => {
    // Deliberate, not an oversight: a seedling that never grew would promise
    // a mechanic the game does not have yet.
    expect(PLANTED_STAGE).toBe(PlantStage.Mature);
  });
});

describe("asset keys", () => {
  test("name a distinct sheet per crop", () => {
    expect(new Set(PLANT_TYPES.map(plantSheetKey)).size).toBe(PLANT_TYPES.length);
  });

  test("name a distinct animation per crop and stage", () => {
    const keys = new Set(PLANT_TYPES.flatMap((p) => PLANT_STAGES.map((s) => plantAnimKey(p, s))));
    expect(keys.size).toBe(PLANT_TYPES.length * PLANT_STAGES.length);
  });

  test("match the sidecar's own animation naming", () => {
    expect(plantAnimKey(PlantType.Carrot, PlantStage.Mature)).toContain("stage_mature");
  });
});
