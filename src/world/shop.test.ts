// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import { CURRENCY, isPayable } from "../shop/currency";
import { makeOffer } from "../shop/payment";
import { FixtureType, PLACEABLE_FIXTURES } from "./fixtures";
import { Inventory } from "./inventory";
import { PLANT_TYPES, PlantType } from "./plants";
import { createRng } from "./rng";
import {
  CROP_PRICE,
  MAX_TRADE,
  Purse,
  SHOP_STOCK,
  buyStock,
  isSellable,
  mostBuyable,
  mostSellable,
  priceOf,
  sellCrops,
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

  // The bridge between the price list and the two counting games: a sum that
  // no set of coins adds up to is a sum a child cannot pay, and every price
  // here is multiplied by up to MAX_TRADE before it reaches the counter.
  test("every sum the counter can ask for is payable in coins", () => {
    for (let count = 1; count <= MAX_TRADE; count++) {
      for (const fixture of SHOP_STOCK) {
        expect(isPayable(CURRENCY, priceOf(fixture) * count)).toBe(true);
      }
      for (const plant of PLANT_TYPES) {
        expect(isPayable(CURRENCY, sellPriceOf(plant) * count)).toBe(true);
      }
    }
  });

  test("a fence is the cheapest thing on the shelf", () => {
    // Not `.map(priceOf)`: the second argument is the crop price now, and a
    // point-free map would hand it the array index instead — which quietly
    // priced the first fixture at nothing.
    const prices = SHOP_STOCK.map((fixture) => priceOf(fixture));
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
    const trade = sellCrops(bag, purse, PlantType.Carrot, 1);
    expect(trade.ok).toBe(true);
    expect(bag.count(PlantType.Carrot)).toBe(1);
    expect(purse.coins).toBe(CROP_PRICE);
  });

  test("one unit per call, so the basket empties a crop at a time", () => {
    const bag = new Inventory();
    const purse = new Purse();
    bag.add(PlantType.Carrot, 3);
    for (let i = 0; i < 3; i++) sellCrops(bag, purse, PlantType.Carrot, 1);
    expect(bag.count(PlantType.Carrot)).toBe(0);
    expect(purse.coins).toBe(3 * CROP_PRICE);
  });

  test("selling what you do not have pays nothing", () => {
    const bag = new Inventory();
    const purse = new Purse();
    const trade = sellCrops(bag, purse, PlantType.Carrot, 1);
    expect(trade.ok).toBe(false);
    expect(purse.coins).toBe(0);
  });

  test("selling something the shop does not want takes nothing from the bag", () => {
    const bag = new Inventory();
    const purse = new Purse();
    bag.add(FixtureType.Fence, 1);
    const trade = sellCrops(bag, purse, FixtureType.Fence, 1);
    expect(trade.ok).toBe(false);
    expect(bag.count(FixtureType.Fence)).toBe(1);
    expect(purse.coins).toBe(0);
  });
});

describe("buying", () => {
  function rich(): { bag: Inventory; purse: Purse } {
    const purse = new Purse();
    purse.earn(100_000); // plenty, in minor units
    return { bag: new Inventory(), purse };
  }

  test("takes the coins and hands over the goods", () => {
    const { bag, purse } = rich();
    const trade = buyStock(bag, purse, FixtureType.Fence, 1);
    expect(trade.ok).toBe(true);
    expect(bag.count(FixtureType.Fence)).toBe(1);
    expect(purse.coins).toBe(100_000 - priceOf(FixtureType.Fence));
  });

  // Refuses rather than going into debt, and leaves both sides untouched.
  test("buying what you cannot afford changes nothing", () => {
    const bag = new Inventory();
    const purse = new Purse();
    purse.earn(1);
    const trade = buyStock(bag, purse, FixtureType.Lamp, 1);
    expect(trade.ok).toBe(false);
    expect(bag.count(FixtureType.Lamp)).toBe(0);
    expect(purse.coins).toBe(1);
  });

  test("buying several at once costs several times as much", () => {
    const { bag, purse } = rich();
    const trade = buyStock(bag, purse, FixtureType.Fence, 3);
    expect(trade.ok).toBe(true);
    expect(trade.amount).toBe(priceOf(FixtureType.Fence) * 3);
    expect(bag.count(FixtureType.Fence)).toBe(3);
  });

  test("a quantity that is not a whole positive number buys nothing", () => {
    const { bag, purse } = rich();
    for (const count of [0, -1, 1.5]) {
      expect(buyStock(bag, purse, FixtureType.Fence, count).ok).toBe(false);
    }
    expect(bag.count(FixtureType.Fence)).toBe(0);
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
    for (let i = 0; i < needed; i++) sellCrops(bag, purse, PlantType.Carrot, 1);
    expect(buyStock(bag, purse, dearest, 1).ok).toBe(true);
    expect(purse.coins).toBe(0);
    expect(bag.count(dearest)).toBe(1);
  });
});

describe("how many the picker will offer", () => {
  /**
   * The cap is what somebody can *pay for*, and this is not a tidiness rule.
   *
   * Offering a quantity a child cannot afford leaves them on a screen where
   * the coin pad refuses every coin they own, with nothing on it saying why.
   */
  test("never more of a thing than there is money for", () => {
    const each = priceOf(FixtureType.Fence);
    expect(mostBuyable(FixtureType.Fence, each * 3)).toBe(3);
    expect(mostBuyable(FixtureType.Fence, each * 3 - 1)).toBe(2);
    expect(mostBuyable(FixtureType.Fence, 0)).toBe(1);
  });

  // A picker that starts at nought is a picker with nothing to press: the
  // refusal belongs on the button that buys, not on the one that counts.
  test("but never fewer than one, however empty the purse", () => {
    for (const coins of [0, 1, 5]) {
      expect({ coins, most: mostBuyable(FixtureType.Fence, coins) }).toEqual({
        coins,
        most: Math.max(1, mostBuyable(FixtureType.Fence, coins)),
      });
      expect(mostBuyable(FixtureType.Fence, coins)).toBeGreaterThanOrEqual(1);
    }
  });

  // About the counter rather than the purse: a hundred carrots is a hundred
  // coins to count out.
  test("and never more than the counter will take", () => {
    expect(mostBuyable(FixtureType.Fence, priceOf(FixtureType.Fence) * 1000)).toBe(MAX_TRADE);
    expect(mostSellable(PlantType.Carrot, 1000)).toBeLessThanOrEqual(MAX_TRADE);
  });

  test("selling is capped by the basket", () => {
    expect(mostSellable(PlantType.Carrot, 3)).toBeLessThanOrEqual(3);
    expect(mostSellable(PlantType.Carrot, 0)).toBe(1);
  });

  /**
   * And by what the shopkeeper can count out of her own drawer.
   *
   * The half that surprises: a payment she cannot make in coins is a payment
   * that cannot happen, however many carrots are on the counter.
   */
  test("and by what she can actually pay in coins", () => {
    for (const held of [1, 2, 5, 10]) {
      const most = mostSellable(PlantType.Carrot, held);
      expect({ held, within: most <= Math.max(1, Math.min(MAX_TRADE, held)) }).toEqual({
        held,
        within: true,
      });
      // Whatever it comes back with, she really can pay for that many.
      expect(
        makeOffer(CURRENCY, sellPriceOf(PlantType.Carrot) * most, createRng(1)).owed,
      ).toBeGreaterThan(0);
    }
  });

  // The price of a crop moves with the band. The cap has to move with it, or
  // a child on the gentlest sums is offered quantities the purse cannot meet.
  test("the cap follows the price a band sets", () => {
    const cheap = mostBuyable(FixtureType.Fence, 600, 100);
    const dear = mostBuyable(FixtureType.Fence, 600, 250);
    expect(cheap).toBeGreaterThan(dear);
  });
});
