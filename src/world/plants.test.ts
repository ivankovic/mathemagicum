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
  nextStage,
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

  // The garden crops are the ones a player can act on the moment they start:
  // they spawn standing in their own beds, and a seed in the pouch that the
  // ground underfoot refuses is a button that does nothing for no visible
  // reason. The cactus is the deliberate exception, and it is why the rule
  // exists at all.
  test("every crop but the cactus grows on both garden grounds", () => {
    for (const plant of PLANT_TYPES) {
      const garden = canPlantOn(plant, TerrainType.Dirt) && canPlantOn(plant, TerrainType.Grass);
      expect({ plant, garden }).toEqual({ plant, garden: plant !== PlantType.Cactus });
    }
  });

  test("the cactus wants sand, and is the only one that does", () => {
    for (const plant of PLANT_TYPES) {
      expect({ plant, sand: canPlantOn(plant, TerrainType.Sand) }).toEqual({
        plant,
        sand: plant === PlantType.Cactus,
      });
    }
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

  test("planting starts a crop at the beginning, now that it can grow", () => {
    // This used to be Mature, on the grounds that a seedling which could
    // never become anything promised a mechanic the game did not have. The
    // addition spell is that mechanic — one cast, one stage.
    expect(PLANTED_STAGE).toBe(PlantStage.Seedling);
  });

  test("each stage leads to the next, and the last leads nowhere", () => {
    expect(nextStage(PlantStage.Seedling)).toBe(PlantStage.Growing);
    expect(nextStage(PlantStage.Growing)).toBe(PlantStage.Mature);
    expect(nextStage(PlantStage.Mature)).toBe(null);
  });

  test("growing from what is planted reaches maturity in a countable number of casts", () => {
    let stage: PlantStage | null = PLANTED_STAGE;
    let casts = 0;
    while (stage !== null) {
      const next: PlantStage | null = nextStage(stage);
      if (next === null) break;
      stage = next;
      casts++;
    }
    expect(stage).toBe(PlantStage.Mature);
    expect(casts).toBe(PLANT_STAGES.length - 1);
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
