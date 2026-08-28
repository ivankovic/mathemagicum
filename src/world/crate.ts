// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { DECOR_TYPES, type DecorType } from "./decor";
import { type FixtureType, PLACEABLE_FIXTURES } from "./fixtures";
import { isMachine } from "./machines";

/**
 * How the crate is divided up, and why it had to be divided at all.
 *
 * It held three things once. It holds twenty — seven for a garden, twelve
 * for a room, and a machine — and a playtest called the result clunky, which
 * it is: twenty buttons in two columns is a wall to be scanned rather than a
 * thing to be chosen from. A child looking for a chair should not have to
 * read past a scarecrow.
 *
 * **The split is one the game already draws.** Things that go on the ground
 * outdoors and things that go on a floor indoors are not a tidy-up of one
 * list; they are two lists that were being shown as one. Nothing can be put
 * down in the wrong one — the placing rules already refuse it — so the
 * grouping only says out loud what the game would have said with a cross.
 *
 * **The makers are their own group with one thing in it, on purpose.** A
 * sorter is not garden furniture and putting it with the benches would say
 * it was. It is also the group that is going to grow, and a group of one
 * that becomes a group of four is a shelf that never has to be rearranged
 * under a child who has learned where things live.
 */

export const CrateGroup = {
  /** Fences, gates, lamps, benches: what goes on the ground outdoors. */
  Garden: "garden",
  /** Beds, chairs, rugs, stoves: what goes on a floor indoors. */
  Room: "room",
  /** Things that do something. Built rather than bought — see `machines.ts`. */
  Makers: "makers",
} as const;

export type CrateGroup = (typeof CrateGroup)[keyof typeof CrateGroup];

export const CRATE_GROUPS: readonly CrateGroup[] = Object.values(CrateGroup);

/** Everything the crate can hold, whichever group it is in. */
export type CrateThing = FixtureType | DecorType;

/**
 * Which group a thing belongs to.
 *
 * Derived from what the thing *is* rather than listed, so a fixture or a
 * piece of furniture added anywhere else lands in a group without anybody
 * remembering to put it in one. A list here would be a second place for the
 * crate's contents to be written down, and the first one to go stale.
 */
export function groupOf(thing: CrateThing): CrateGroup {
  if ((DECOR_TYPES as readonly string[]).includes(thing)) return CrateGroup.Room;
  return isMachine(thing as FixtureType) ? CrateGroup.Makers : CrateGroup.Garden;
}

/** Everything in one group, in the order the crate shows it. */
export function thingsIn(group: CrateGroup): readonly CrateThing[] {
  return [...PLACEABLE_FIXTURES, ...DECOR_TYPES].filter((thing) => groupOf(thing) === group);
}

/**
 * The picture on a group's own button: the first thing in it.
 *
 * Rather than a drawing of its own, which would be a fourth icon to keep in
 * step with what the group holds. A group whose first thing changes gets a
 * new face, which is honest — the button is a way in to those things, and
 * looking like one of them is the plainest way to say so.
 */
export function faceOf(group: CrateGroup): CrateThing | null {
  return thingsIn(group)[0] ?? null;
}
