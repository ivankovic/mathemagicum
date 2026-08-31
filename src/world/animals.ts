// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import type { PlacedObject } from "./objects";
import { PlantType } from "./plants";
import type { Rng } from "./rng";
import { randInt } from "./rng";
import type { GridPoint } from "./topdown";

/**
 * The animals that live in the village, and where they live.
 *
 * Asked for by the children who play the game. They are creatures to *see*
 * rather than livestock to keep: nothing feeds them, nothing counts them,
 * and none of them is the subject of any arithmetic. That is deliberate for
 * now — animals to look after is a whole system, and animals that simply
 * exist is the half that answers what was actually asked.
 *
 * They wander like villagers do, because they are the same problem: a thing
 * that walks a short circuit near where it belongs.
 *
 * **Each of them is hungry for one thing, sometimes.** A thought bubble over
 * its head with a crop in it and a question mark, and a tap hands the crop
 * over if you are carrying it. Nothing is counted and no arithmetic is asked,
 * which is deliberate — what a child gets out of it is a reason to walk over
 * and a reason to have grown a second kind of crop.
 *
 * **Sometimes** is the word doing the work. Every animal asking at once is a
 * checklist: a child walks a lap, clears every bubble and is finished with
 * the village. They ask on their own clocks instead, so a couple are asking
 * at any moment and a lap is never the whole of it — and a fed animal says
 * nothing for ten minutes afterwards, because an animal that wanted a second
 * carrot straight away would be a well, not a chicken.
 *
 * They used to do nothing at all, on the argument that a creature which
 * answered a tap with silence is worse than one that plainly is not for
 * tapping. The bubble is what makes the tap obviously *offered* rather than
 * guessed at, which is the half that was missing.
 */

export const AnimalKind = {
  Chicken: "chicken",
  Duck: "duck",
  Cat: "cat",
  Rabbit: "rabbit",
} as const;

export type AnimalKind = (typeof AnimalKind)[keyof typeof AnimalKind];

export const ANIMAL_KINDS: readonly AnimalKind[] = Object.values(AnimalKind);

export function animalSheetKey(kind: AnimalKind): string {
  return `animal-${kind}`;
}

export function animalSidecarKey(kind: AnimalKind): string {
  return `animal-sidecar-${kind}`;
}

/**
 * How long an animal spends asking, and how long it spends thinking about
 * nothing, in milliseconds.
 *
 * Quiet is longer than asking on purpose: the ratio between them is what sets
 * how much of the village is asking at any moment. At these numbers it is
 * about three in ten, which is a village where there is usually something to
 * do and never a list to work through. Much lower and a child walks past
 * eleven animals with nothing to say; much higher and it is a checklist
 * again.
 */
export const ANIMAL_ASK_MIN_MS = 20_000;
export const ANIMAL_ASK_MAX_MS = 40_000;
export const ANIMAL_QUIET_MIN_MS = 40_000;
export const ANIMAL_QUIET_MAX_MS = 100_000;
/** How long the smile stays up after being fed. */
export const ANIMAL_GLAD_MS = 1_800;
/**
 * And how long it says nothing afterwards.
 *
 * Ten minutes, which is long enough that a child cannot farm one chicken and
 * short enough that an animal fed at the start of an afternoon is asking
 * again by the end of it.
 */
export const ANIMAL_FED_QUIET_MS = 10 * 60_000;

/**
 * How far each kind strays from where it was put down.
 *
 * Small numbers throughout. A villager's circuit is five tiles and the
 * postal worker's is sixteen; an animal that ranged as far as a person would
 * stop reading as *belonging* somewhere, which is most of what makes a
 * chicken near a house look like that house's chicken.
 */
export const ANIMAL_RANGE: Record<AnimalKind, number> = {
  [AnimalKind.Chicken]: 3,
  [AnimalKind.Duck]: 3,
  // Cats go further than birds, because cats go further than birds.
  [AnimalKind.Cat]: 6,
  // And rabbits keep to the edges, away from the houses.
  [AnimalKind.Rabbit]: 4,
};

/**
 * What each kind will ask for.
 *
 * Storybook menus rather than a zoologist's: what matters is that a child can
 * believe it, and that a rabbit asking for a carrot is the one pairing every
 * picture book has already taught them. Each kind has more than one so that
 * two chickens in the same village are not the same errand.
 *
 * **No cactus anywhere**, and that is a rule about the world rather than
 * about diet: a cactus only grows on sand, the village has none, and an
 * animal asking for something you cannot grow within a day's walk is a
 * bubble that never clears.
 */
export const ANIMAL_MENU: Record<AnimalKind, readonly PlantType[]> = {
  [AnimalKind.Chicken]: [PlantType.Wheat, PlantType.Sunflower, PlantType.Tomato],
  [AnimalKind.Duck]: [PlantType.Wheat, PlantType.Sunflower, PlantType.Carrot],
  [AnimalKind.Rabbit]: [PlantType.Carrot, PlantType.Wheat, PlantType.Sunflower],
  [AnimalKind.Cat]: [PlantType.Tomato, PlantType.Pepper, PlantType.Carrot],
};

export interface AnimalSpot {
  readonly kind: AnimalKind;
  readonly at: GridPoint;
  /**
   * The crop this one is hungry for.
   *
   * Drawn here rather than in the scene, so it is a pure function of the
   * layout and the seed like the position is: the same village grows the
   * same animals wanting the same things, and the game needs to record
   * nothing to have that survive a reload.
   */
  readonly wants: PlantType;
}

/**
 * How many of each kind a village gets.
 *
 * Chickens outnumber everything, which is what a village with chickens in it
 * looks like. One cat, because two cats near one house read as a pair rather
 * than as a cat.
 */
const FLOCK: Record<AnimalKind, number> = {
  [AnimalKind.Chicken]: 4,
  [AnimalKind.Duck]: 2,
  [AnimalKind.Cat]: 2,
  [AnimalKind.Rabbit]: 3,
};

/** How far from the thing they are placed near. */
const NEAR = 4;

/**
 * Where the village's animals start.
 *
 * Birds and cats near the buildings, because that is where a person would
 * expect to find them; rabbits out beyond the last house, because a rabbit
 * sitting on somebody's doorstep is a pet, and these are not pets.
 *
 * Positions are *suggestions*: the scene drops any that land on something
 * solid. Doing it that way round keeps this a pure function of the layout
 * and a seed — which is what makes it testable, and what makes a village
 * grow the same animals every time it is generated from the same number.
 */
export function animalSpots(
  well: PlacedObject,
  buildings: readonly PlacedObject[],
  rng: Rng,
): readonly AnimalSpot[] {
  const spots: AnimalSpot[] = [];
  const anchors = buildings.length > 0 ? buildings : [well];

  for (const kind of ANIMAL_KINDS) {
    for (let index = 0; index < FLOCK[kind]; index++) {
      const near =
        kind === AnimalKind.Rabbit
          ? { col: well.col, row: well.row }
          : nearestAnchor(anchors, index);
      const reach = kind === AnimalKind.Rabbit ? ANIMAL_RANGE[kind] * 4 : NEAR;
      const menu = ANIMAL_MENU[kind];
      spots.push({
        kind,
        at: {
          col: near.col + randInt(rng, -reach, reach),
          row: near.row + randInt(rng, -reach, reach),
        },
        wants: menu[randInt(rng, 0, menu.length - 1)] as PlantType,
      });
    }
  }
  return spots;
}

function nearestAnchor(anchors: readonly PlacedObject[], index: number): GridPoint {
  const anchor = anchors[index % anchors.length];
  if (!anchor) throw new Error("a village with nothing in it has nowhere to put a chicken");
  return { col: anchor.col, row: anchor.row };
}

/**
 * What an animal is thinking about, if anything.
 *
 * Moved here from the scene along with the clock below. Which face a
 * creature is wearing and how long it wears it are facts about the animal;
 * the cloud drawn over its head is the scene's.
 */
export const AnimalMood = {
  /** Nothing. No bubble. */
  Quiet: "quiet",
  /** A crop and a question mark. */
  Asking: "asking",
  /** A smile, for a moment after being fed. */
  Glad: "glad",
} as const;

export type AnimalMood = (typeof AnimalMood)[keyof typeof AnimalMood];

/** What a mood is, and when it runs out. */
export interface Mood {
  readonly mood: AnimalMood;
  readonly moodUntil: number;
}

/**
 * Somewhere between two numbers.
 *
 * Handed in rather than reached for, which is the whole reason this can be
 * tested: Phaser's own is a static on a class that cannot be loaded outside
 * a browser, and the *timing* is the thing worth pinning.
 */
export type Roll = (min: number, max: number) => number;

/**
 * The mood an animal turns to when the one it is in runs out.
 *
 * A round trip and nothing else: asking goes quiet, glad goes quiet, and
 * quiet goes back to asking. There is no state it can be in that has no next
 * one, which is what keeps a village from filling up with creatures that
 * asked once and never spoke again.
 *
 * `alwaysHungry` is the `?hungry` seam. They ask on their own clocks, which
 * is the point of them and the one thing a script cannot wait out — a test
 * standing in the village hoping a chicken would get hungry would be a test
 * that passes at three in the afternoon. Held asking for ever, it is a test.
 */
export function moodAfter(mood: AnimalMood, now: number, roll: Roll, alwaysHungry: boolean): Mood {
  if (mood === AnimalMood.Asking) {
    return {
      mood: AnimalMood.Quiet,
      moodUntil: now + roll(ANIMAL_QUIET_MIN_MS, ANIMAL_QUIET_MAX_MS),
    };
  }
  if (mood === AnimalMood.Glad) {
    // A fed animal says nothing for a good while afterwards: one that wanted
    // a second carrot straight away would be a well, not a chicken.
    return { mood: AnimalMood.Quiet, moodUntil: now + ANIMAL_FED_QUIET_MS };
  }
  return {
    mood: AnimalMood.Asking,
    moodUntil: alwaysHungry
      ? Number.POSITIVE_INFINITY
      : now + roll(ANIMAL_ASK_MIN_MS, ANIMAL_ASK_MAX_MS),
  };
}

/**
 * What goes in the cloud over an animal's head.
 *
 * Named rather than drawn: the pictures live in `src/ui/assets`, and the
 * rule about which of them belongs over a chicken is a fact about the
 * chicken. The scene turns these three into textures — the food is whatever
 * that animal craves — and this is the one place that decides how many there
 * are and in what order.
 */
export const AnimalThought = {
  /** The crop this one is hungry for. */
  Food: "food",
  /** And the mark that turns it into a question. */
  Question: "question",
  /** A smile, for the moment after it has been fed. */
  Smile: "smile",
} as const;

export type AnimalThought = (typeof AnimalThought)[keyof typeof AnimalThought];

/**
 * What an animal is showing, from its mood and whether it was just tapped.
 *
 * The interesting line is the last one. **A tap on an animal that is not
 * asking says what it likes.** It used to put up an empty cloud, on the
 * argument that a creature thinking about nothing should say so — and that
 * is exactly how it was reported from a playtest: *tapping the rabbit didn't
 * bring up any food, just an empty rabbit*. Which is fair. Five of the seven
 * animals in a village are quiet at any moment, so a child who taps two or
 * three of them meets nothing but empty clouds and concludes the creatures
 * are scenery.
 *
 * The crop without the question mark is the answer, because the question
 * mark is the *ask* and the crop is the animal. It is a stable fact — what
 * one craves comes out of the world seed and never changes — so a child who
 * taps the rabbit today learns something that will still be true when it
 * does ask, which is the whole of what the empty cloud was failing to give
 * them.
 *
 * It gives nothing away that matters, either: **only an animal that is
 * asking can be fed**, and that rule is untouched. A child cannot pre-empt a
 * bubble by learning what is behind it, and the quiet ten minutes after a
 * meal are still ten quiet minutes.
 */
export function thoughtFor(mood: AnimalMood, tapped: boolean): readonly AnimalThought[] {
  if (mood === AnimalMood.Asking) return [AnimalThought.Food, AnimalThought.Question];
  if (mood === AnimalMood.Glad) return [AnimalThought.Smile];
  return tapped ? [AnimalThought.Food] : [];
}

/**
 * Where in its own round an animal starts.
 *
 * Dropped into the middle of one rather than started at the beginning.
 * Started at the beginning they are all quiet when the player arrives and
 * then, a minute later, all asking together — which is the very thing the
 * separate clocks exist to avoid. Picking a random point in the whole
 * ask-then-quiet round puts the village in its steady state from the first
 * frame.
 */
export function firstMood(now: number, roll: Roll, alwaysHungry: boolean): Mood {
  if (alwaysHungry) return { mood: AnimalMood.Asking, moodUntil: Number.POSITIVE_INFINITY };
  const at = roll(0, ANIMAL_ASK_MAX_MS + ANIMAL_QUIET_MAX_MS);
  return at < ANIMAL_ASK_MAX_MS
    ? { mood: AnimalMood.Asking, moodUntil: now + at }
    : { mood: AnimalMood.Quiet, moodUntil: now + at - ANIMAL_ASK_MAX_MS };
}
