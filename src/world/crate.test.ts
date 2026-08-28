// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import { CRATE_GROUPS, CrateGroup, type CrateThing, faceOf, groupOf, thingsIn } from "./crate";
import { DECOR_TYPES } from "./decor";
import { PLACEABLE_FIXTURES } from "./fixtures";
import { MACHINE_TYPES } from "./machines";

const EVERYTHING: readonly CrateThing[] = [...PLACEABLE_FIXTURES, ...DECOR_TYPES];

describe("how the crate is divided", () => {
  /**
   * The property the whole design rests on: nothing is lost and nothing is
   * shown twice.
   *
   * A two-level crate hides everything that is not in the open group, so an
   * item in no group is an item a child can never reach again — and unlike
   * a mislaid button it leaves nothing on screen to notice. Counted rather
   * than eyeballed, because the crate has grown four times and will again.
   */
  test("every single thing is in exactly one group", () => {
    const gathered = CRATE_GROUPS.flatMap((group) => thingsIn(group));
    expect(gathered.length).toBe(EVERYTHING.length);
    expect([...gathered].sort()).toEqual([...EVERYTHING].sort());
  });

  test("and no group is empty, so no button opens onto nothing", () => {
    for (const group of CRATE_GROUPS) {
      expect({ group, held: thingsIn(group).length > 0 }).toEqual({ group, held: true });
    }
  });

  test("the machines are the makers, and nothing else is", () => {
    expect([...thingsIn(CrateGroup.Makers)].sort()).toEqual([...MACHINE_TYPES].sort());
  });

  test("furniture is the room, and fixtures never are", () => {
    expect([...thingsIn(CrateGroup.Room)].sort()).toEqual([...DECOR_TYPES].sort());
    for (const fixture of PLACEABLE_FIXTURES) {
      expect({ fixture, group: groupOf(fixture) }).not.toEqual({
        fixture,
        group: CrateGroup.Room,
      });
    }
  });

  /**
   * The garden is everything left over, which is deliberate and worth
   * stating: a fixture added to `PLACEABLE_FIXTURES` and to no list here
   * still turns up somewhere a child can reach it.
   */
  test("a new fixture lands in the garden without being told to", () => {
    const garden = thingsIn(CrateGroup.Garden);
    for (const fixture of PLACEABLE_FIXTURES) {
      const machine = (MACHINE_TYPES as readonly string[]).includes(fixture);
      expect({ fixture, inGarden: garden.includes(fixture) }).toEqual({
        fixture,
        inGarden: !machine,
      });
    }
  });

  test("each group's button wears the face of something it holds", () => {
    for (const group of CRATE_GROUPS) {
      const face = faceOf(group);
      expect(face).not.toBeNull();
      expect(thingsIn(group)).toContain(face as CrateThing);
    }
  });

  test("and no two groups wear the same face", () => {
    const faces = CRATE_GROUPS.map(faceOf);
    expect(new Set(faces).size).toBe(faces.length);
  });
});
