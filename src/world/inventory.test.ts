// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import { FixtureType, PLACEABLE_FIXTURES } from "./fixtures";
import { ITEM_TYPES, Inventory, describeItem } from "./inventory";
import { PLANT_TYPES, PlantType } from "./plants";

describe("Inventory", () => {
  test("starts empty", () => {
    const bag = new Inventory();
    expect(bag.isEmpty).toBe(true);
    expect(bag.total).toBe(0);
    expect(bag.kinds).toBe(0);
    expect(bag.count(PlantType.Carrot)).toBe(0);
    expect(bag.entries()).toEqual([]);
  });

  test("adding accumulates and reports the new count", () => {
    const bag = new Inventory();
    expect(bag.add(PlantType.Carrot)).toBe(1);
    expect(bag.add(PlantType.Carrot, 3)).toBe(4);
    expect(bag.count(PlantType.Carrot)).toBe(4);
    expect(bag.total).toBe(4);
    expect(bag.kinds).toBe(1);
  });

  test("counts each kind separately", () => {
    const bag = new Inventory();
    bag.add(PlantType.Carrot, 2);
    bag.add(PlantType.Cactus);
    expect(bag.count(PlantType.Carrot)).toBe(2);
    expect(bag.count(PlantType.Cactus)).toBe(1);
    expect(bag.count(PlantType.Sunflower)).toBe(0);
    expect(bag.total).toBe(3);
    expect(bag.kinds).toBe(2);
  });

  // Not a quirk: `add` that could subtract is a bug waiting for a caller who
  // forgot to clamp a harvest yield.
  test("adding nothing or less than nothing does nothing", () => {
    const bag = new Inventory();
    bag.add(PlantType.Carrot, 2);
    expect(bag.add(PlantType.Carrot, 0)).toBe(2);
    expect(bag.add(PlantType.Carrot, -5)).toBe(2);
    expect(bag.add(PlantType.Carrot, 1.5)).toBe(2);
    expect(bag.total).toBe(2);
  });

  test("removing takes items out", () => {
    const bag = new Inventory();
    bag.add(PlantType.Carrot, 3);
    expect(bag.remove(PlantType.Carrot)).toBe(true);
    expect(bag.count(PlantType.Carrot)).toBe(2);
  });

  // All or nothing, so a caller cannot half-spend something and then fail.
  test("removing more than is carried removes nothing", () => {
    const bag = new Inventory();
    bag.add(PlantType.Carrot, 2);
    expect(bag.remove(PlantType.Carrot, 3)).toBe(false);
    expect(bag.count(PlantType.Carrot)).toBe(2);
  });

  test("removing from an empty bag fails rather than going negative", () => {
    const bag = new Inventory();
    expect(bag.remove(PlantType.Carrot)).toBe(false);
    expect(bag.count(PlantType.Carrot)).toBe(0);
    expect(bag.total).toBe(0);
  });

  test("an item removed down to nothing stops being carried at all", () => {
    const bag = new Inventory();
    bag.add(PlantType.Carrot);
    bag.remove(PlantType.Carrot);
    expect(bag.kinds).toBe(0);
    expect(bag.isEmpty).toBe(true);
    expect(bag.entries()).toEqual([]);
  });

  test("entries lists only what is carried, in the item order", () => {
    const bag = new Inventory();
    bag.add(PlantType.Cactus, 5);
    bag.add(PlantType.Carrot, 1);
    expect(bag.entries()).toEqual([
      [PlantType.Carrot, 1],
      [PlantType.Cactus, 5],
    ]);
  });

  // No slot limit and no stack size, deliberately: a basket that filled up
  // would turn "help a villager" into "walk home first".
  test("nothing caps how much can be carried", () => {
    const bag = new Inventory();
    bag.add(PlantType.Carrot, 9999);
    expect(bag.count(PlantType.Carrot)).toBe(9999);
    expect(bag.add(PlantType.Carrot)).toBe(10000);
  });

  // Both halves of the shop's trade have to have somewhere to land: crops
  // she sells, fixtures she buys.
  test("items cover every crop and every thing the store stocks", () => {
    for (const plant of PLANT_TYPES) expect(ITEM_TYPES).toContain(plant);
    for (const fixture of PLACEABLE_FIXTURES) expect(ITEM_TYPES).toContain(fixture);
    expect(new Set(ITEM_TYPES).size).toBe(ITEM_TYPES.length);
  });

  test("holds a bought fixture alongside a picked crop", () => {
    const bag = new Inventory();
    bag.add(PlantType.Carrot, 2);
    bag.add(FixtureType.Fence, 5);
    expect(bag.count(FixtureType.Fence)).toBe(5);
    expect(bag.total).toBe(7);
    expect(bag.kinds).toBe(2);
  });
});

describe("describeItem", () => {
  test("says one of a thing without pluralising it", () => {
    expect(describeItem(PlantType.Carrot, 1)).toBe("1 carrot");
  });

  test("pluralises more than one", () => {
    expect(describeItem(PlantType.Carrot, 3)).toBe("3 carrots");
    expect(describeItem(PlantType.Sunflower, 2)).toBe("2 sunflowers");
  });

  // The one irregular ending the item list actually contains.
  test("handles a name that already ends in s", () => {
    expect(describeItem(PlantType.Cactus, 2)).toBe("2 cactuses");
    expect(describeItem(PlantType.Cactus, 1)).toBe("1 cactus");
  });

  test("reads for the things the store sells too", () => {
    expect(describeItem(FixtureType.Fence, 3)).toBe("3 fences");
    expect(describeItem(FixtureType.Lamp, 1)).toBe("1 lamp");
  });

  test("says none of a thing rather than nothing at all", () => {
    expect(describeItem(PlantType.Carrot, 0)).toBe("0 carrots");
  });
});
