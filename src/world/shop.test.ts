// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import { FixtureType, PLACEABLE_FIXTURES } from "./fixtures";
import { Inventory } from "./inventory";
import { PLANT_TYPES, PlantType } from "./plants";
import {
  CROP_PRICE,
  Purse,
  SHOP_STOCK,
  buyOne,
  isSellable,
  priceOf,
  sellOne,
  sellPriceOf,
} from "./shop";

describe("prices", () => {
  // Not because it is obviously right, but because nothing today makes one
  // crop harder to grow than another. Pricing them apart would invent a
  // difficulty the game does not have.
  test("every crop fetches the same, because every crop costs the same effort", () => {
    for (const plant of PLANT_TYPES) expect(sellPriceOf(plant)).toBe(CROP_PRICE);
  });

  test("everything in stock is priced in whole crops", () => {
    for (const fixture of SHOP_STOCK) {
      expect(priceOf(fixture) % CROP_PRICE).toBe(0);
      expect(priceOf(fixture)).toBeGreaterThan(0);
    }
  });

  test("stock is exactly what the player can put down", () => {
    expect(SHOP_STOCK).toEqual(PLACEABLE_FIXTURES);
  });

  // The village has the one well and it is not merchandise.
  test("the well is not for sale", () => {
    expect(() => priceOf(FixtureType.Well)).toThrow();
    expect(SHOP_STOCK).not.toContain(FixtureType.Well);
  });

  test("the shop does not buy back what it sells", () => {
    for (const fixture of SHOP_STOCK) {
      expect(sellPriceOf(fixture)).toBe(0);
      expect(isSellable(fixture)).toBe(false);
    }
  });

  test("a fence is the cheapest thing on the shelf", () => {
    const prices = SHOP_STOCK.map(priceOf);
    expect(priceOf(FixtureType.Fence)).toBe(Math.min(...prices));
  });
});

describe("Purse", () => {
  test("starts empty and takes earnings", () => {
    const purse = new Purse();
    expect(purse.coins).toBe(0);
    expect(purse.earn(5)).toBe(5);
    expect(purse.earn(3)).toBe(8);
  });

  test("earning nothing or less than nothing does nothing", () => {
    const purse = new Purse();
    purse.earn(10);
    expect(purse.earn(0)).toBe(10);
    expect(purse.earn(-4)).toBe(10);
    expect(purse.earn(2.5)).toBe(10);
  });

  test("spending what is there succeeds and what is not fails", () => {
    const purse = new Purse();
    purse.earn(10);
    expect(purse.spend(4)).toBe(true);
    expect(purse.coins).toBe(6);
    expect(purse.spend(7)).toBe(false);
    expect(purse.coins).toBe(6);
  });

  // All or nothing, so nothing can be half-paid-for.
  test("a refused payment leaves the purse untouched", () => {
    const purse = new Purse();
    expect(purse.spend(1)).toBe(false);
    expect(purse.coins).toBe(0);
  });
});

describe("selling", () => {
  test("turns a crop into coins", () => {
    const bag = new Inventory();
    const purse = new Purse();
    bag.add(PlantType.Carrot, 2);
    const trade = sellOne(bag, purse, PlantType.Carrot);
    expect(trade.ok).toBe(true);
    expect(bag.count(PlantType.Carrot)).toBe(1);
    expect(purse.coins).toBe(CROP_PRICE);
  });

  test("one unit per call, so the basket empties a crop at a time", () => {
    const bag = new Inventory();
    const purse = new Purse();
    bag.add(PlantType.Carrot, 3);
    for (let i = 0; i < 3; i++) sellOne(bag, purse, PlantType.Carrot);
    expect(bag.count(PlantType.Carrot)).toBe(0);
    expect(purse.coins).toBe(3 * CROP_PRICE);
  });

  test("selling what you do not have pays nothing", () => {
    const bag = new Inventory();
    const purse = new Purse();
    const trade = sellOne(bag, purse, PlantType.Carrot);
    expect(trade.ok).toBe(false);
    expect(purse.coins).toBe(0);
  });

  test("selling something the shop does not want takes nothing from the bag", () => {
    const bag = new Inventory();
    const purse = new Purse();
    bag.add(FixtureType.Fence, 1);
    const trade = sellOne(bag, purse, FixtureType.Fence);
    expect(trade.ok).toBe(false);
    expect(bag.count(FixtureType.Fence)).toBe(1);
    expect(purse.coins).toBe(0);
  });
});

describe("buying", () => {
  function rich(): { bag: Inventory; purse: Purse } {
    const purse = new Purse();
    purse.earn(1000);
    return { bag: new Inventory(), purse };
  }

  test("takes the coins and hands over the goods", () => {
    const { bag, purse } = rich();
    const trade = buyOne(bag, purse, FixtureType.Fence);
    expect(trade.ok).toBe(true);
    expect(bag.count(FixtureType.Fence)).toBe(1);
    expect(purse.coins).toBe(1000 - priceOf(FixtureType.Fence));
  });

  // Refuses rather than going into debt, and leaves both sides untouched.
  test("buying what you cannot afford changes nothing", () => {
    const bag = new Inventory();
    const purse = new Purse();
    purse.earn(1);
    const trade = buyOne(bag, purse, FixtureType.Lamp);
    expect(trade.ok).toBe(false);
    expect(bag.count(FixtureType.Lamp)).toBe(0);
    expect(purse.coins).toBe(1);
  });

  test("says the price and what you have when it refuses", () => {
    const bag = new Inventory();
    const purse = new Purse();
    const trade = buyOne(bag, purse, FixtureType.Lamp);
    expect(trade.message).toContain(String(priceOf(FixtureType.Lamp)));
    expect(trade.message).toContain("0");
  });
});

describe("the loop closes", () => {
  // What the shop is for: the maths turns into crops, the crops into coins,
  // the coins into something to put in the garden.
  test("enough harvests buy the most expensive thing in stock", () => {
    const bag = new Inventory();
    const purse = new Purse();
    const dearest = SHOP_STOCK.reduce((a, b) => (priceOf(a) >= priceOf(b) ? a : b));
    const needed = priceOf(dearest) / CROP_PRICE;
    bag.add(PlantType.Carrot, needed);
    for (let i = 0; i < needed; i++) sellOne(bag, purse, PlantType.Carrot);
    expect(buyOne(bag, purse, dearest).ok).toBe(true);
    expect(purse.coins).toBe(0);
    expect(bag.count(dearest)).toBe(1);
  });
});
