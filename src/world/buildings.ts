// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

// Which generated building sprite stands in for each role the village
// layout places. The layout thinks in roles ("the school"); the asset
// generator ships a small set of building shapes with no idea what a game
// uses them for, so the two need an explicit mapping rather than a shared
// name. See ~/src/asset-generator's "Objects and buildings".
export const BuildingSprite = {
  Cottage: "cottage",
  /**
   * The city's house: two tiles of frontage and half again the height.
   *
   * A city built from cottages is a large village. What says *city* at a
   * glance is not how many houses there are but that they are narrow and
   * tall and stand shoulder to shoulder, because land in a city is worth
   * something and a house grows upward instead of outward.
   */
  Townhouse: "townhouse",
  Barn: "barn",
  /**
   * The great ship, moored at the harbour.
   *
   * A building, to this game, is a footprint it blocks with a door in it and
   * a room behind. A ship is all three, so it is one — which is what let it
   * be added without a single new rule about walking into things. It only
   * looks nothing like the others, and that is the generator's business.
   *
   * Broadside on, because every door here is in the south wall: a ship you
   * could only board over the bow would be a ship with its gangway pointing
   * out to sea.
   */
  Ship: "ship",
  /**
   * The dome on the mountain: a drum of dressed stone under a lead cupola,
   * with the shutter open on the sky and a telescope sweeping in it.
   *
   * Deliberately nothing like the tower it replaced as a stand-in. The tower
   * is narrow, pointed and purple; this is wide, round and lead-grey, and
   * the two are the only tall things in the world that a child could
   * otherwise confuse.
   */
  Observatory: "observatory",
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
  [BuildingSprite.Townhouse]: { width: 2, height: 2 },
  [BuildingSprite.Ship]: { width: 5, height: 2 },
  [BuildingSprite.Observatory]: { width: 3, height: 3 },
  [BuildingSprite.Barn]: { width: 4, height: 3 },
  [BuildingSprite.Tower]: { width: 2, height: 2 },
  [BuildingSprite.Schoolhouse]: { width: 4, height: 3 },
};

// The village's roles, mapped onto the shapes that read most like them.
// Nothing about a building sprite is specific to its role — swapping these
// changes only what the village looks like.
export type BuildingRole =
  | "house"
  | "townhouse"
  | "school"
  | "post-office"
  | "store"
  | "ship"
  | "observatory";

export const ROLE_SPRITES: Record<BuildingRole, BuildingSprite> = {
  house: BuildingSprite.Cottage,
  // A house in the city rather than a different kind of thing. It is its own
  // role rather than the village's house drawn taller because the *layout*
  // has to know: a townhouse takes two tiles of frontage where a cottage
  // takes three, and a block laid out for one does not fit the other.
  townhouse: BuildingSprite.Townhouse,
  ship: BuildingSprite.Ship,
  observatory: BuildingSprite.Observatory,
  school: BuildingSprite.Schoolhouse,
  "post-office": BuildingSprite.Tower,
  store: BuildingSprite.Barn,
};

export function footprintFor(role: BuildingRole): Footprint {
  return BUILDING_FOOTPRINTS[ROLE_SPRITES[role]];
}

/**
 * How far to either side of the door a step still counts as going in.
 *
 * The door is one cell, and hitting one cell from a moving character is
 * fiddly: the player walks along the front of a building, has to stop on
 * exactly the right tile, and pressing up anywhere else bumps into a wall
 * that looks no different from the doorway. So the doorway is *three* cells
 * wide to walk into while staying one cell wide to look at — a target you
 * can miss by one and still hit.
 *
 * Clamped to the building's own footprint, which is the part that has to be
 * a rule rather than an offset: a door in the corner of a wall has ground
 * beside it, and a step onto ordinary grass must not put the player indoors.
 */
export const ENTRANCE_REACH = 1;

/** The run of cells a step into which enters a building. */
export interface Entrance {
  readonly row: number;
  readonly minCol: number;
  readonly maxCol: number;
}

export function entranceFor(
  door: { col: number; row: number },
  anchorCol: number,
  width: number,
): Entrance {
  return {
    row: door.row,
    minCol: Math.max(anchorCol, door.col - ENTRANCE_REACH),
    maxCol: Math.min(anchorCol + width - 1, door.col + ENTRANCE_REACH),
  };
}

/**
 * Whether stepping onto this cell, *coming this way*, goes indoors.
 *
 * The direction is the whole of what this fixes. Widening the doorway by a
 * cell each way made it forgiving to walk into, and the widening applied
 * whichever way the step came from — so a child walking sideways along the
 * front of a building, scraping the wall a cell to the side of the door, was
 * put indoors. On a building whose door sits near a corner the widened cell
 * *is* the corner, so what they walked into was the building's side.
 *
 * A doorway is approached from in front of it. `dRow` is the step being
 * taken, and only a step *into* the wall — northward, from the ground in
 * front — is an entrance. Sideways along the wall is a wall.
 */
export function isEntrance(
  entrance: Entrance,
  col: number,
  row: number,
  step?: { dCol: number; dRow: number },
): boolean {
  if (row !== entrance.row || col < entrance.minCol || col > entrance.maxCol) return false;
  // No step given means "is this cell part of the doorway at all", which is
  // what the map and the tests ask.
  if (!step) return true;
  return step.dRow < 0 && step.dCol === 0;
}

/**
 * The texture a building is drawn from.
 *
 * Takes a plain string rather than a `BuildingSprite`, because a repainted
 * house is registered under a name of its own — "cottage~2" is a real sheet
 * and not one of the four the generator ships.
 */
export function spriteSheetKey(sprite: string): string {
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
export function buildingAnimKey(sprite: string, state: DoorState): string {
  return `building-${sprite}-door_${state}`;
}
