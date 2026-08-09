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
