// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

// Placeholder flat colors standing in for pixel art. Swap for real tile/
// sprite assets later without touching anything that reads these maps.
import { PlantType } from "./plants";
import { TerrainType } from "./terrain";

export const TERRAIN_COLORS: Record<TerrainType, number> = {
  [TerrainType.Grass]: 0x4caf50,
  [TerrainType.Dirt]: 0x8d6e63,
  [TerrainType.Sand]: 0xe0c68c,
  [TerrainType.Water]: 0x4fa8d8,
  [TerrainType.Rock]: 0x9e9e9e,
};

export const PLANT_COLORS: Record<PlantType, number> = {
  [PlantType.Carrot]: 0xff9800,
  [PlantType.Sunflower]: 0xffeb3b,
  [PlantType.Cactus]: 0x2e7d32,
};

// Keyed by PlacedObject.type (see src/world/villageLayout.ts) rather than a
// closed union — new story-area object types will accrete over time.
export const OBJECT_COLORS: Record<string, number> = {
  well: 0x78909c,
  house: 0xa1887f,
  school: 0x7986cb,
  "post-office": 0xe57373,
  store: 0xffb74d,
};
export const DEFAULT_OBJECT_COLOR = 0xbdbdbd;
