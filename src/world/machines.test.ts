// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import { FIXTURE_TYPES, type FixtureType, PLACEABLE_FIXTURES } from "./fixtures";
import { Inventory } from "./inventory";
import {
  MACHINE_TYPES,
  type MachineType,
  RECIPES,
  build,
  canBuild,
  isMachine,
  recipeFor,
} from "./machines";
import { MATERIAL_TYPES, type MaterialType } from "./materials";
import { PLANT_TYPES } from "./plants";
import { SHOP_STOCK, isSellable } from "./shop";

/** A basket with the given materials in it and nothing else. */
function carrying(materials: Partial<Record<MaterialType, number>>): Inventory {
  const held = new Inventory();
  for (const [material, count] of Object.entries(materials)) {
    if (count > 0) held.add(material as MaterialType, count);
  }
  return held;
}

/** Exactly what one machine asks for, and not a splinter more. */
function exactly(machine: MachineType): Inventory {
  const held = new Inventory();
  for (const [material, count] of recipeFor(machine)) held.add(material, count);
  return held;
}

describe("what a machine is made of", () => {
  test("every machine has a recipe, and every recipe asks for something", () => {
    for (const machine of MACHINE_TYPES) {
      const recipe = recipeFor(machine);
      expect(recipe.length).toBeGreaterThan(0);
      for (const [, count] of recipe) expect(count).toBeGreaterThan(0);
    }
  });

  test("and asks only for what the world actually gives up", () => {
    for (const machine of MACHINE_TYPES) {
      for (const [material] of recipeFor(machine)) {
        expect(MATERIAL_TYPES).toContain(material);
      }
    }
  });

  /**
   * The rule the recipes are sized by, and the one worth pinning: a machine
   * costs *two* materials, so building one is a plan rather than a number.
   * The wood is in the woodland and the stone is up the hills, and a recipe
   * that quietly collapsed to one of them would take that walk away without
   * anything else in the game noticing.
   */
  test("a machine wants more than one kind of material", () => {
    for (const machine of MACHINE_TYPES) {
      expect(recipeFor(machine).length).toBeGreaterThanOrEqual(2);
    }
  });

  test("the recipe comes back in a stable order, whatever the table's is", () => {
    for (const machine of MACHINE_TYPES) {
      const materials = recipeFor(machine).map(([material]) => material);
      expect(materials).toEqual([...materials].sort());
      expect(new Set(materials).size).toBe(materials.length);
    }
  });
});

describe("building one", () => {
  test("cannot be built out of nothing", () => {
    for (const machine of MACHINE_TYPES) {
      const empty = new Inventory();
      expect(canBuild(empty, machine)).toBe(false);
      expect(build(empty, machine)).toBe(false);
    }
  });

  test("can be built out of exactly what it asks for, and eats all of it", () => {
    for (const machine of MACHINE_TYPES) {
      const held = exactly(machine);
      expect(canBuild(held, machine)).toBe(true);
      expect(build(held, machine)).toBe(true);
      expect(held.isEmpty).toBe(true);
    }
  });

  test("takes what it asks for and leaves the rest", () => {
    for (const machine of MACHINE_TYPES) {
      const held = exactly(machine);
      held.add("carrot", 4);
      for (const [material] of recipeFor(machine)) held.add(material, 3);
      expect(build(held, machine)).toBe(true);
      expect(held.count("carrot")).toBe(4);
      for (const [material] of recipeFor(machine)) expect(held.count(material)).toBe(3);
    }
  });

  /**
   * The one that would be a real bug and would only ever show up as a child
   * losing their timber.
   *
   * `Inventory.remove` is all-or-nothing per *item*, which is not the same
   * promise: a build that spent the wood and then discovered it was a rock
   * short would have taken the wood and given nothing back. So every recipe
   * is tried one material short of each of its ingredients in turn, and the
   * basket has to come out untouched every time.
   */
  test("a build that is one short of anything takes nothing at all", () => {
    for (const machine of MACHINE_TYPES) {
      for (const [short] of recipeFor(machine)) {
        const held = new Inventory();
        for (const [material, count] of recipeFor(machine)) {
          const put = material === short ? count - 1 : count;
          if (put > 0) held.add(material, put);
        }
        const before = held.entries();
        expect(canBuild(held, machine)).toBe(false);
        expect(build(held, machine)).toBe(false);
        expect(held.entries()).toEqual(before);
      }
    }
  });

  test("plenty of one material does not pay for another", () => {
    for (const machine of MACHINE_TYPES) {
      const [first] = recipeFor(machine);
      if (!first) throw new Error(`${machine} has no recipe`);
      const held = carrying({ [first[0]]: first[1] * 10 });
      expect(canBuild(held, machine)).toBe(recipeFor(machine).length === 1);
    }
  });

  test("two of them cost twice", () => {
    for (const machine of MACHINE_TYPES) {
      const held = exactly(machine);
      for (const [material, count] of recipeFor(machine)) held.add(material, count);
      expect(build(held, machine)).toBe(true);
      expect(build(held, machine)).toBe(true);
      expect(build(held, machine)).toBe(false);
    }
  });
});

describe("a machine among the other things a player can put down", () => {
  test("is a fixture, and one the player may put down", () => {
    for (const machine of MACHINE_TYPES) {
      expect(FIXTURE_TYPES).toContain(machine);
      expect(PLACEABLE_FIXTURES).toContain(machine);
    }
  });

  /**
   * The whole of the "built, not bought" rule, stated where it can fail.
   *
   * `SHOP_STOCK` used to be `PLACEABLE_FIXTURES` itself, so a machine added
   * to the one list landed on the shelf priced at infinity — a button that
   * can only refuse. This is the assertion that a later machine cannot make
   * that mistake again by doing nothing.
   */
  test("is never on the shelf", () => {
    for (const machine of MACHINE_TYPES) expect(SHOP_STOCK).not.toContain(machine);
  });

  test("and is not something the store buys either", () => {
    for (const machine of MACHINE_TYPES) expect(isSellable(machine)).toBe(false);
  });

  test("is told from everything that is not one", () => {
    for (const fixture of FIXTURE_TYPES) {
      expect(isMachine(fixture)).toBe((MACHINE_TYPES as readonly FixtureType[]).includes(fixture));
    }
    for (const plant of PLANT_TYPES) expect(isMachine(plant as never)).toBe(false);
  });

  test("the recipe table names every machine and nothing else", () => {
    expect(Object.keys(RECIPES).sort()).toEqual([...MACHINE_TYPES].sort());
  });
});
