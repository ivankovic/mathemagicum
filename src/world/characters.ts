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
 * Which way a step points.
 *
 * Vertical wins a tie because the art reads better that way: the up and down
 * poses show a whole body, the side poses a narrower profile, so a character
 * moving diagonally looks more natural facing the camera than edge-on. Only
 * reachable if diagonal movement is ever added — today's steps are cardinal.
 */
export function facingFor(dCol: number, dRow: number, current: Facing): Facing {
  if (dRow !== 0 && Math.abs(dRow) >= Math.abs(dCol)) {
    return dRow > 0 ? Facing.Down : Facing.Up;
  }
  if (dCol !== 0) return dCol > 0 ? Facing.Right : Facing.Left;
  return current;
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
export const CHARACTER_ANIMATIONS: readonly string[] = [IDLE, WALK];

// Fast enough that a four-frame cycle covers one tile-step without visibly
// stalling, slow enough not to read as a scurry.
export const WALK_FPS = 8;
export const IDLE_FPS = 3;
