// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

// Which generated character sheet each person in the world is drawn with.
// The village layout names NPCs by the job they do (see villageLayout.ts);
// the asset generator ships a cast with no idea what a game uses them for,
// so the two are joined here rather than by a shared naming convention.

export const PLAYER_CHARACTER = "player";

// Generic villagers are rolled from a seed upstream, so they are numbered
// rather than named. Only the ones actually placed are shipped — see the
// README's asset sync — and characters.test.ts checks this list against
// what the village asks for.
export const VILLAGER_CHARACTERS: readonly string[] = ["villager-0", "villager-1", "villager-2"];

const NAMED_ROLES: Record<string, string> = {
  teacher: "teacher",
  "postal-worker": "postal-worker",
  shopkeeper: "shopkeeper",
};

/**
 * The sheet for one NPC id.
 *
 * Named roles map to their own art, because the design has the player
 * recognise them on sight. Everyone else is assigned a generic villager by
 * position in the list rather than at random: an NPC has to look the same
 * every time the world is generated from the same seed, and the village
 * always produces its NPCs in the same order.
 */
export function characterFor(npcId: string, index: number): string {
  const named = NAMED_ROLES[npcId];
  if (named) return named;
  const villager = VILLAGER_CHARACTERS[index % VILLAGER_CHARACTERS.length];
  if (!villager) throw new Error("VILLAGER_CHARACTERS is empty");
  return villager;
}

export const ALL_CHARACTERS: readonly string[] = [
  PLAYER_CHARACTER,
  ...Object.values(NAMED_ROLES),
  ...VILLAGER_CHARACTERS,
];

// The four facings the art is drawn for. A character always faces one of
// these; there are no diagonals, which is also all the movement code needs.
export const Facing = {
  Down: "down",
  Up: "up",
  Left: "left",
  Right: "right",
} as const;

export type Facing = (typeof Facing)[keyof typeof Facing];

export const DEFAULT_FACING: Facing = Facing.Down;

/**
 * The facing a direction vector points at, or null for a zero vector.
 *
 * Snaps to four directions because that is all the art has and all the
 * movement does. Takes any vector, not just a unit step: the same rule reads
 * a joystick's offset as reads a grid step, which is why the two cannot
 * disagree about which way "up and slightly left" is.
 *
 * Vertical wins a tie because of the art: the up and down poses show a whole
 * body, the side poses a narrower profile, so something moving diagonally
 * looks more natural facing the camera than edge-on.
 */
export function facingForVector(dx: number, dy: number): Facing | null {
  if (dy !== 0 && Math.abs(dy) >= Math.abs(dx)) {
    return dy > 0 ? Facing.Down : Facing.Up;
  }
  if (dx !== 0) return dx > 0 ? Facing.Right : Facing.Left;
  return null;
}

// Which way a step points, holding the current facing if it doesn't move.
export function facingFor(dCol: number, dRow: number, current: Facing): Facing {
  return facingForVector(dCol, dRow) ?? current;
}

// The grid step for a facing — the inverse of facingFor, and what turns a
// held joystick direction into a move.
export function stepForFacing(facing: Facing): { dCol: number; dRow: number } {
  switch (facing) {
    case Facing.Up:
      return { dCol: 0, dRow: -1 };
    case Facing.Down:
      return { dCol: 0, dRow: 1 };
    case Facing.Left:
      return { dCol: -1, dRow: 0 };
    case Facing.Right:
      return { dCol: 1, dRow: 0 };
  }
}

export function characterSheetKey(character: string): string {
  return `character-${character}`;
}

export function characterSidecarKey(character: string): string {
  return `character-sidecar-${character}`;
}

// Matches the sidecar's own animation names, which are what the generator
// writes: `{animation}_{facing}`.
export function characterAnimKey(character: string, animation: string, facing: Facing): string {
  return `character-${character}-${animation}_${facing}`;
}

export const IDLE = "idle";
export const WALK = "walk";
export const PLANT = "plant";
export const CHARACTER_ANIMATIONS: readonly string[] = [IDLE, WALK, PLANT];

// The one animation that is not a loop. It is a gesture with a beginning and
// an end, so it plays once and the character returns to whatever they would
// otherwise be doing — which is why the scene has to know it is different
// rather than just picking it as a third state.
export const ONE_SHOT_ANIMATIONS: readonly string[] = [PLANT];

// Fast enough that a four-frame cycle covers one tile-step without visibly
// stalling, slow enough not to read as a scurry.
export const WALK_FPS = 8;
export const IDLE_FPS = 3;
// Six frames at this rate is about half a second — long enough to read as
// deliberate, short enough that it never feels like the game stopped
// listening.
export const PLANT_FPS = 12;
