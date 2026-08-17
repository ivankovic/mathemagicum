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

// How far open a building's door is drawn. The generator ships one row of
// frames per position (see its README's "Doors"), so this is a choice the
// game makes each frame rather than an animation it starts.
export const DoorState = {
  Closed: "closed",
  Half: "half",
  Open: "open",
} as const;

export type DoorState = (typeof DoorState)[keyof typeof DoorState];

export const DOOR_STATES: readonly DoorState[] = Object.values(DoorState);

/**
 * Which door position suits a player this far from the doorstep.
 *
 * Distance drives it directly instead of a timer or a state machine, so
 * walking up to a house swings the door open over the last two steps and
 * walking away closes it again, with no transition to get stuck in. It also
 * means the door is fully open exactly when the player is close enough to
 * step through it.
 */
export function doorStateForDistance(distance: number): DoorState {
  if (distance <= 1) return DoorState.Open;
  if (distance <= 2) return DoorState.Half;
  return DoorState.Closed;
}

// Matches the sidecar's own animation names: `door_{state}`.
export function buildingAnimKey(sprite: BuildingSprite, state: DoorState): string {
  return `building-${sprite}-door_${state}`;
}
