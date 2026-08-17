// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

// Which generated building sprite stands in for each role the village
// layout places. The layout thinks in roles ("the school"); the asset
// generator ships a small set of building shapes with no idea what a game
// uses them for, so the two need an explicit mapping rather than a shared
// name. See ~/src/asset-generator's "Objects and buildings".
export const BuildingSprite = {
  Cottage: "cottage",
  Barn: "barn",
  Tower: "tower",
  Schoolhouse: "schoolhouse",
} as const;

export type BuildingSprite = (typeof BuildingSprite)[keyof typeof BuildingSprite];

export const BUILDING_SPRITES: readonly BuildingSprite[] = Object.values(BuildingSprite);

// Footprint in cells, mirroring each sprite's JSON sidecar. Duplicated here
// because world generation runs before any asset is loaded — the layout has
// to know how much room a building takes while placing it, and the sidecars
// only arrive through Phaser's loader. buildings.test.ts reads the shipped
// sidecars and fails if this table drifts from them, so the duplication is
// checked rather than merely hoped for.
export interface Footprint {
  width: number;
  height: number;
}

export const BUILDING_FOOTPRINTS: Record<BuildingSprite, Footprint> = {
  [BuildingSprite.Cottage]: { width: 3, height: 2 },
  [BuildingSprite.Barn]: { width: 4, height: 3 },
  [BuildingSprite.Tower]: { width: 2, height: 2 },
  [BuildingSprite.Schoolhouse]: { width: 4, height: 3 },
};

// The village's roles, mapped onto the shapes that read most like them.
// Nothing about a building sprite is specific to its role — swapping these
// changes only what the village looks like.
export type BuildingRole = "house" | "school" | "post-office" | "store";

export const ROLE_SPRITES: Record<BuildingRole, BuildingSprite> = {
  house: BuildingSprite.Cottage,
  school: BuildingSprite.Schoolhouse,
  "post-office": BuildingSprite.Tower,
  store: BuildingSprite.Barn,
};

export function footprintFor(role: BuildingRole): Footprint {
  return BUILDING_FOOTPRINTS[ROLE_SPRITES[role]];
}

export function spriteSheetKey(sprite: BuildingSprite): string {
  return `building-${sprite}`;
}

export function buildingAnimKey(sprite: BuildingSprite): string {
  return `building-${sprite}-idle`;
}
