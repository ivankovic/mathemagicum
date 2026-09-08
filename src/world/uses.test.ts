// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import { DECOR_TYPES } from "./decor";
import { Turn } from "./facing";
import { FixtureType, PLACEABLE_FIXTURES } from "./fixtures";
import { MACHINE_TYPES } from "./machines";
import {
  LASTING,
  USABLE_THINGS,
  USE_MS,
  Use,
  isLasting,
  isOnTheThing,
  pillowOf,
  useOf,
} from "./uses";

describe("what a thing is for", () => {
  test("everything she can put down has a use, so the question is never one-sided", () => {
    for (const thing of USABLE_THINGS) {
      expect(useOf(thing)).not.toBeNull();
    }
  });

  test("the list covers every garden thing that is not a machine, and every house thing", () => {
    for (const fixture of PLACEABLE_FIXTURES) {
      if ((MACHINE_TYPES as readonly string[]).includes(fixture)) continue;
      expect(USABLE_THINGS).toContain(fixture);
    }
    for (const piece of DECOR_TYPES) expect(USABLE_THINGS).toContain(piece);
  });

  test("a machine has no use here: a tap on one wakes it, which it always did", () => {
    for (const machine of MACHINE_TYPES) expect(useOf(machine)).toBeNull();
  });

  test("the village's own things have no use, because they are not hers to tap", () => {
    expect(useOf(FixtureType.Well)).toBeNull();
    expect(useOf(FixtureType.Stall)).toBeNull();
  });

  test("every move has a length, and none keeps her longer than a breath", () => {
    for (const use of Object.values(Use)) {
      expect(USE_MS[use]).toBeGreaterThan(0);
      expect(USE_MS[use]).toBeLessThanOrEqual(2500);
    }
  });

  test("what lasts is what she has got onto, and a gate is not a place to be", () => {
    for (const use of LASTING) expect(isOnTheThing(use)).toBe(true);
    expect(isLasting(Use.Sit)).toBe(true);
    expect(isLasting(Use.Nap)).toBe(true);
    expect(isLasting(Use.Splash)).toBe(true);
    expect(isLasting(Use.Swing)).toBe(false);
    expect(isLasting(Use.Lean)).toBe(false);
  });

  test("the pillow follows the way the bed lies", () => {
    const corner = { col: 4, row: 7 };
    expect(pillowOf(Turn.Toward, corner)).toEqual({ col: 4, row: 7 });
    expect(pillowOf(Turn.Away, corner)).toEqual({ col: 4, row: 8 });
    expect(pillowOf(Turn.Side, corner)).toEqual({ col: 4, row: 7 });
    expect(pillowOf(Turn.SideOther, corner)).toEqual({ col: 5, row: 7 });
    // A bed put down before beds could turn has no turn written on it.
    expect(pillowOf(undefined, corner)).toEqual(corner);
  });

  test("sitting puts her on the thing; leaning does not", () => {
    expect(isOnTheThing(Use.Sit)).toBe(true);
    expect(isOnTheThing(Use.Nap)).toBe(true);
    expect(isOnTheThing(Use.Lean)).toBe(false);
    expect(isOnTheThing(Use.Wash)).toBe(false);
  });
});
