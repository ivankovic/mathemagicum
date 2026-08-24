// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

// Which generated character sheet each person in the world is drawn with.
// The village layout names NPCs by the job they do (see villageLayout.ts);
// the asset generator ships a cast with no idea what a game uses them for,
// so the two are joined here rather than by a shared naming convention.

export const PLAYER_CHARACTER = "player";

/**
 * Every sheet the player can be drawn with.
 *
 * Six silhouettes: the child picks one when their profile is made, and
 * their colours are swapped into whichever they picked at load time (see
 * src/avatar/). They differ only in hair, hem and build, and every one of
 * them keeps the wide-brimmed hat, which is what makes the player findable
 * in a street of villagers drawn from the same palette — and which is why
 * the two that read as a boy do it with shoulders and a haircut rather than
 * with a cap, since the cap in this set is the postal worker's.
 *
 * The catalogue that says which of these a chooser may offer ships beside
 * the art in `characters/avatar.json`; this list exists so the loader knows
 * what to fetch, and a test checks the two agree.
 */
export const PLAYER_BODIES: readonly string[] = [
  PLAYER_CHARACTER,
  "player-bun",
  "player-trousers",
  "player-short",
  // Two that read as a boy, differing by build. See the note above: what
  // carries at this size is a wider, squarer torso and a crop that shows
  // below the brim, and both of them keep the brim.
  "player-broad",
  "player-crop",
];

// Generic villagers are rolled from a seed upstream, so they are numbered
// rather than named. Only the ones actually placed are shipped — see the
// README's asset sync — and characters.test.ts checks this list against
// what the village asks for.
export const VILLAGER_CHARACTERS: readonly string[] = ["villager-0", "villager-1", "villager-2"];

const NAMED_ROLES: Record<string, string> = {
  teacher: "teacher",
  // The geometry teacher, in the tower. A separate role rather than a second
  // villager because the player has to know on sight which of the two
  // teachers they have walked in on — see the generator's note on the robe.
  geometer: "geometer",
  "postal-worker": "postal-worker",
  shopkeeper: "shopkeeper",
  // Up in the dome. The fourth teacher, and told apart from the other three
  // by outline rather than colour, as they are from each other: the tallest
  // of the cast, long hair, and a spyglass held to the eye — a horizontal
  // shape where the geometer's square is a triangle and the schoolteacher's
  // book is an upright block.
  astronomer: "astronomer",
  // Beside the tower in the city. The fifth teacher, told apart by the one
  // round thing anybody here carries: a clock face held out flat, where the
  // book is an upright block, the square a triangle and the spyglass a
  // horizontal bar. Broad and cropped, which is the one build no other
  // teacher has, and bare-headed, because all three hats are spoken for.
  clockmaker: "clockmaker",
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
  // A player body is never anybody else's. They all wear the player's hat,
  // so a villager handed one would read as a second protagonist standing in
  // the road — and the four bodies live in the same folder as the cast,
  // which is exactly the sort of neighbouring list something reaches into
  // by accident.
  if (PLAYER_BODIES.includes(npcId)) {
    throw new Error(`${npcId} is the player's own sheet, not an NPC's`);
  }
  const named = NAMED_ROLES[npcId];
  if (named) return named;
  const villager = VILLAGER_CHARACTERS[index % VILLAGER_CHARACTERS.length];
  if (!villager) throw new Error("VILLAGER_CHARACTERS is empty");
  return villager;
}

export const ALL_CHARACTERS: readonly string[] = [
  ...PLAYER_BODIES,
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

/**
 * The way somebody would be facing if they turned right around.
 *
 * The portal wants it: you walk into one and come out of the other with your
 * back to it, so the far end stands on the cell behind you.
 */
export function oppositeFacing(facing: Facing): Facing {
  switch (facing) {
    case Facing.Up:
      return Facing.Down;
    case Facing.Down:
      return Facing.Up;
    case Facing.Left:
      return Facing.Right;
    case Facing.Right:
      return Facing.Left;
  }
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
