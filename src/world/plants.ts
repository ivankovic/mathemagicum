// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { TerrainType } from "./terrain";

export const PlantType = {
  Carrot: "carrot",
  Sunflower: "sunflower",
  Cactus: "cactus",
} as const;

export type PlantType = (typeof PlantType)[keyof typeof PlantType];

interface PlantDefinition {
  allowedTerrain: readonly TerrainType[];
}

export const PLANT_DEFINITIONS: Record<PlantType, PlantDefinition> = {
  [PlantType.Carrot]: { allowedTerrain: [TerrainType.Dirt, TerrainType.Grass] },
  [PlantType.Sunflower]: { allowedTerrain: [TerrainType.Grass] },
  [PlantType.Cactus]: { allowedTerrain: [TerrainType.Sand] },
};

export function canPlantOn(plant: PlantType, terrain: TerrainType): boolean {
  return PLANT_DEFINITIONS[plant].allowedTerrain.includes(terrain);
}

export const PLANT_TYPES: readonly PlantType[] = Object.values(PlantType);

// How grown a crop is. The generator ships one row of frames per stage (see
// its README's "Plants"), so growing is switching which row is playing.
export const PlantStage = {
  Seedling: "seedling",
  Growing: "growing",
  Mature: "mature",
} as const;

export type PlantStage = (typeof PlantStage)[keyof typeof PlantStage];

export const PLANT_STAGES: readonly PlantStage[] = Object.values(PlantStage);

/**
 * The stage a newly planted crop is drawn at.
 *
 * Mature, because there is no tending loop yet: planting is still the direct
 * placeholder action the design doc describes, and a seedling that never
 * became anything would promise growth the game does not have. The earlier
 * stages ship anyway, so the art is ready when the growing spells are.
 */
export const PLANTED_STAGE: PlantStage = PlantStage.Mature;

export function plantSheetKey(plant: PlantType): string {
  return `plant-${plant}`;
}

export function plantSidecarKey(plant: PlantType): string {
  return `plant-sidecar-${plant}`;
}

// Matches the sidecar's own animation names: `stage_{name}`.
export function plantAnimKey(plant: PlantType, stage: PlantStage): string {
  return `plant-${plant}-stage_${stage}`;
}
