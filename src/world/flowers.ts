// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import type { Rng } from "./rng";
import { randInt } from "./rng";

/**
 * Flowers: the things you plant because you want to look at them.
 *
 * Everything else a child puts in the ground here is *for* something. A crop
 * is two casts and a harvest, a fence keeps something in, a lamp lights a
 * path. These do nothing at all, and that is the whole of what they are for:
 * the children asked to be able to add to the place they live, and a garden
 * somebody has planted flowers in is theirs in a way a garden with a fence
 * round it is not.
 *
 * **Found, not bought.** The store sells things; these are three plants
 * growing wild somewhere on a five-hundred-square world, and a child has to
 * walk into them. That makes them the one thing in the game whose reward is
 * *having gone somewhere* — no sum, no money, no errand. The spellbook
 * already draws its unlearned runes dimmed on the argument that a book with
 * a gap in it says there is something to find; this is a seed pouch making
 * the same offer.
 *
 * **Finding one unlocks the kind, not a seed.** A child who has walked to
 * the far side of the world for a tulip has earned tulips, plural, in every
 * colour — being handed exactly one, to be spent once and hunted again,
 * would turn a discovery into an errand. It is the same shape as learning a
 * spell, and for the same reason.
 *
 * **The colour is chosen when it goes in the ground.** Which is the one
 * thing here that is not like a crop: a carrot is a carrot, and what makes a
 * flower bed a flower bed is that somebody picked the colours.
 */

export const FlowerType = {
  /** One tall cup on a straight stem. */
  Tulip: "tulip",
  /** A low clump of round heads. */
  Daisy: "daisy",
  /** A spike hung with bells down alternate sides. */
  Bellflower: "bellflower",
} as const;

export type FlowerType = (typeof FlowerType)[keyof typeof FlowerType];

export const FLOWER_TYPES: readonly FlowerType[] = Object.values(FlowerType);

/**
 * How many colours each of them comes in.
 *
 * Stated here as well as shipped in the sidecar, because the colour chooser
 * has to offer them before any art has loaded. Kept honest by a test against
 * what the generator actually ships.
 */
export const FLOWER_LOOKS = 5;

/**
 * A planted flower, as the world grid names it: the kind and its colour.
 *
 * The colour rides in the object's *type* rather than beside it, which is
 * not a trick — it is what makes a planted flower survive being saved. The
 * snapshot records the difference between the world as generated and the
 * world as played by comparing what each tile's object is called, so a
 * colour kept anywhere else would be a colour that came back as the default
 * on the next load. See `snapshotWorld`.
 */
export type PlantedFlower = `${FlowerType}~${number}`;

export function flowerObject(flower: FlowerType, look: number): PlantedFlower {
  return `${flower}~${look}`;
}

/** The kind and the colour a planted flower's name stands for, or nothing. */
export function flowerParts(objectType: string): { flower: FlowerType; look: number } | null {
  const parts = objectType.split("~");
  if (parts.length !== 2) return null;
  const [kind, look] = parts;
  const known = FLOWER_TYPES.find((one) => one === kind);
  if (!known || look === undefined || !/^\d+$/.test(look)) return null;
  const at = Number(look);
  if (at < 0 || at >= FLOWER_LOOKS) return null;
  return { flower: known, look: at };
}

/**
 * The wild one: what grows on its own and is picked rather than planted.
 *
 * A different object type from a planted one, deliberately. They are drawn
 * from the same sheet and a child cannot tell them apart by looking — which
 * is right, it is the same flower — but only one of them answers a tap by
 * being *found*, and the other answers by being dug up and carried off.
 * Telling them apart by name means nothing has to remember which cells the
 * world put flowers on.
 */
const WILD_PREFIX = "wild-";

export function wildFlowerObject(flower: FlowerType): string {
  return `${WILD_PREFIX}${flower}`;
}

export function wildFlowerFor(objectType: string): FlowerType | null {
  if (!objectType.startsWith(WILD_PREFIX)) return null;
  const kind = objectType.slice(WILD_PREFIX.length);
  return FLOWER_TYPES.find((one) => one === kind) ?? null;
}

/**
 * Which colour a wild one is drawn in.
 *
 * Fixed per kind rather than rolled, so the tulip a child finally finds is
 * the tulip they have been told about — and so two children playing the same
 * world are looking at the same flower. Spread across the five so the three
 * wild patches are not all one colour.
 */
export function wildLook(flower: FlowerType): number {
  return (FLOWER_TYPES.indexOf(flower) * 2) % FLOWER_LOOKS;
}

export function flowerSheetKey(flower: FlowerType): string {
  return `fixture-${flower}`;
}

export function flowerSidecarKey(flower: FlowerType): string {
  return `fixture-sidecar-${flower}`;
}

/**
 * One colour's animation.
 *
 * The sheet is colourway-major — every frame of the red one, then every
 * frame of the yellow — so a look is a run of frames rather than every fifth
 * one. See the generator's `render_frames`.
 */
export function flowerAnimKey(flower: FlowerType, look: number): string {
  return `fixture-${flower}-${look}`;
}

export function flowerFrames(look: number, framesPerLook: number): number[] {
  return Array.from({ length: framesPerLook }, (_, at) => look * framesPerLook + at);
}

/**
 * The flowers a child has found, read back from a save.
 *
 * Unknown names are dropped, the way learned spells are: the set is fixed,
 * and a name that is not in it can only come from a different build.
 */
export function readFound(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value.filter(
        (name): name is FlowerType =>
          typeof name === "string" && (FLOWER_TYPES as readonly string[]).includes(name),
      ),
    ),
  ];
}

export function hasFound(found: Iterable<string>, flower: FlowerType): boolean {
  for (const name of found) if (name === flower) return true;
  return false;
}

/** Add one to what somebody has found, giving back the same list if it is there. */
export function findFlower(found: readonly string[], flower: FlowerType): readonly string[] {
  if (found.includes(flower)) return found;
  return [...found, flower];
}

/**
 * How far apart the wild patches are made to stand, in tiles.
 *
 * Three flowers dropped independently on one world can land within sight of
 * each other, and then the reward for walking to the second one is nothing:
 * a child who found all three in the same meadow has not explored anything.
 * Far enough apart to be three journeys, and the placer widens its search
 * rather than giving up if a world cannot manage it.
 */
export const WILD_APART = 60;

export interface WildSpot {
  readonly flower: FlowerType;
  readonly col: number;
  readonly row: number;
}

/**
 * Where the three wild patches grow.
 *
 * **Somewhere a child can actually reach.** A flower is a quest that can be
 * finished or a quest that cannot, and the difference is one seed in a
 * hundred — which is the worst shape a failure has, because it works every
 * time anybody checks. So the caller hands in the cells it already knows are
 * walkable and unoccupied, and this only chooses between them.
 *
 * **From the world's own seed.** A patch that moved between runs would be a
 * patch no scenario could ever be pointed at, and two children comparing
 * worlds would be comparing nothing.
 */
export function wildSpots(rng: Rng, open: readonly { col: number; row: number }[]): WildSpot[] {
  if (open.length === 0) return [];
  const taken: WildSpot[] = [];
  for (const flower of FLOWER_TYPES) {
    const spot = chooseSpot(rng, open, taken);
    if (spot) taken.push({ flower, col: spot.col, row: spot.row });
  }
  return taken;
}

/**
 * One cell, as far from the ones already used as this world can manage.
 *
 * Tries for `WILD_APART` and settles for the best of a sample rather than
 * failing: a small world, or one that is mostly water, would otherwise get
 * two flowers instead of three — and two thirds of a quest is worse than
 * three flowers standing closer together than they were meant to.
 */
function chooseSpot(
  rng: Rng,
  open: readonly { col: number; row: number }[],
  taken: readonly WildSpot[],
): { col: number; row: number } | null {
  let best: { col: number; row: number } | null = null;
  let bestGap = -1;
  for (let attempt = 0; attempt < 64; attempt++) {
    const at = open[randInt(rng, 0, open.length - 1)];
    if (!at) continue;
    const gap = taken.reduce(
      (least, one) => Math.min(least, Math.hypot(one.col - at.col, one.row - at.row)),
      Number.POSITIVE_INFINITY,
    );
    if (gap >= WILD_APART) return at;
    if (gap > bestGap) {
      bestGap = gap;
      best = at;
    }
  }
  return best;
}
