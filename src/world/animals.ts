// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import type { PlacedObject } from "./objects";
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
 * that walks a short circuit near where it belongs. What is different is
 * that nothing happens when you tap one. A creature that answered a tap with
 * silence would be worse than one that plainly is not for tapping, so they
 * are not interactive at all, and the design's own note about the villagers
 * with nothing behind them applies here twice over.
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

export interface AnimalSpot {
  readonly kind: AnimalKind;
  readonly at: GridPoint;
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
      spots.push({
        kind,
        at: {
          col: near.col + randInt(rng, -reach, reach),
          row: near.row + randInt(rng, -reach, reach),
        },
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
