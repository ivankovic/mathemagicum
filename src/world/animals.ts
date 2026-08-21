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
