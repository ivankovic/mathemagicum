// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { FixtureType } from "./fixtures";
import type { Inventory } from "./inventory";
import { MaterialType } from "./materials";

/**
 * The things a player builds rather than buys.
 *
 * The playtesters asked for machines and for the ability to build things
 * that do something, and the second half of that is the half with a design
 * decision in it. Everything a child can put down today came off a shelf:
 * they earned coins, the shopkeeper took them, a fence came back. A machine
 * built the same way would be one more line on that shelf.
 *
 * So a machine is made out of **what the world gave up** — the wood and
 * stone the clearing spell pays. That is not decoration on the economy. The
 * design doc says in as many words that subtraction is *"the spell this game
 * under-uses"*, and the only thing wood and stone could be used for until
 * now was to be sold, which makes them coins with an extra step. Giving them
 * somewhere else to go is what turns clearing a wood into building
 * something, and it is the cheapest honest reason to cast the spell.
 *
 * **The recipe is the whole of the mechanic here, and it is deliberately
 * not a puzzle.** No assembly minigame, no parts to fabricate, no stages.
 * A child who has the materials walks to a square and the machine is there.
 * The arithmetic in a machine belongs to what it *does* — the sorter deals a
 * heap into equal shares, and that is the share spell — and a sum standing
 * between a child and the machine that teaches the sum would be a lock on
 * the door of the classroom.
 */

/** Which fixtures are machines. Every one of these is built, never sold. */
export const MachineType = {
  /**
   * A hopper, a wheel and three crates.
   *
   * The first, and chosen first because it is a picture of its own
   * arithmetic: one heap in at the top, equal shares out at the bottom. It
   * also has the least new machinery behind it — the share spell and its
   * parchment already exist, so what this needs is a reason to open them.
   */
  Sorter: FixtureType.Sorter,
} as const;

export type MachineType = (typeof MachineType)[keyof typeof MachineType];

export const MACHINE_TYPES: readonly MachineType[] = Object.values(MachineType);

/** Whether a fixture is one of them. */
export function isMachine(fixture: FixtureType): fixture is MachineType {
  return (MACHINE_TYPES as readonly FixtureType[]).includes(fixture);
}

/** What one machine is made of, as a count per material. */
export type Recipe = Readonly<Partial<Record<MaterialType, number>>>;

/**
 * What each costs, in what the world gives up.
 *
 * **Sized against a walk, not against a wallet.** A conifer is three wood
 * and a boulder is two stone, so a sorter is about five trees and three
 * rocks — an afternoon in a wood, which a five-hundred-cell world has
 * thirteen thousand scattered objects to supply. Small enough that a child
 * who wants one can have one; large enough that they will have cast the
 * clearing spell a dozen times on the way, which is the point.
 *
 * **Both materials, on purpose.** A recipe in one material is a number; a
 * recipe in two is a *plan*, because the wood and the stone are in different
 * places — the trees are in the woodland and the boulders are up the hills.
 * That is the first time this game has asked a child to go to two places for
 * one thing, and it is the cheapest way to make the world's terrain matter
 * to something other than what will grow on it.
 */
export const RECIPES: Readonly<Record<MachineType, Recipe>> = {
  [MachineType.Sorter]: { [MaterialType.Wood]: 15, [MaterialType.Stone]: 6 },
};

/** What a machine is made of, as pairs, in a stable order. */
export function recipeFor(machine: MachineType): readonly (readonly [MaterialType, number])[] {
  const recipe = RECIPES[machine];
  return Object.entries(recipe)
    .filter((entry): entry is [MaterialType, number] => typeof entry[1] === "number")
    .sort(([left], [right]) => left.localeCompare(right));
}

/**
 * Whether everything the recipe asks for is in the basket.
 *
 * The question the crate asks to decide whether to draw the slot lit or
 * dimmed — the spellbook's dimmed rune, one tray along. A machine a child
 * cannot build yet is still *shown*, because a crate with a gap in it says
 * there is something to go and fetch.
 */
export function canBuild(held: Inventory, machine: MachineType): boolean {
  return recipeFor(machine).every(([material, count]) => held.count(material) >= count);
}

/**
 * Take the materials out, and say whether it happened.
 *
 * **All or nothing across every material**, which `Inventory.remove` cannot
 * promise on its own: it is all-or-nothing per item, so a build that spent
 * the wood and then found there was not enough stone would have eaten the
 * wood. Checked first, then spent — the two-line version of a transaction,
 * and enough of one when nothing else is writing to the basket in between.
 */
export function build(held: Inventory, machine: MachineType): boolean {
  if (!canBuild(held, machine)) return false;
  for (const [material, count] of recipeFor(machine)) held.remove(material, count);
  return true;
}
