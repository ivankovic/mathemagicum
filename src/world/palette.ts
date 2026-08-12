// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

// Terrain now renders from the real tileset (tools/tileset-gen, loaded via
// BootScene, drawn in GameScene.activateChunk) — these are the remaining
// placeholder flat colors, for things that don't have real art yet.
import { PlantType } from "./plants";

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
