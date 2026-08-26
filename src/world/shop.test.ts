// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import { CURRENCY, coinsFor, isPayable, stacksOf } from "../shop/currency";
import { makeOffer } from "../shop/payment";
import { BANDS } from "../spells/difficulty";
import { DecorType, decorItem } from "./decor";
import { FixtureType, PLACEABLE_FIXTURES } from "./fixtures";
import { Inventory } from "./inventory";
import { PLANT_TYPES, PlantType } from "./plants";
import { createRng } from "./rng";
import {
  CROP_PRICE,
  FURNITURE_STOCK,
  MAX_TRADE,
  MOST_PER_SHELF,
  Purse,
  SHELVES,
  SHOP_STOCK,
  buyStock,
  isOneCell,
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

  // About the counter rather than the purse: a hundred fences is a hundred
  // coins for the *player* to lay down by hand.
  test("and never more than the counter will take", () => {
    expect(mostBuyable(FixtureType.Fence, priceOf(FixtureType.Fence) * 1000)).toBe(MAX_TRADE);
  });

  // Selling has no such number, and used to. A sale is counted out by the
  // shopkeeper rather than by the child, so ten was a rule with no reason
  // anybody could see — a basket of forty carrots sold four at a time.
  test("but a whole basket can be sold at once", () => {
    expect(mostSellable(PlantType.Carrot, 40)).toBe(40);
    expect(mostSellable(PlantType.Carrot, 40)).toBeGreaterThan(MAX_TRADE);
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
  test("and by nothing else at all", () => {
    for (const held of [1, 2, 5, 10, 99, 400]) {
      const most = mostSellable(PlantType.Carrot, held);
      expect({ held, most }).toEqual({ held, most: Math.max(1, held) });
      // However big the sale, she lays it out in at most one pile per kind
      // of coin — which is why there is no ceiling left to hit. Counting
      // forty discs does not scale; four piles does.
      const coins = coinsFor(CURRENCY, sellPriceOf(PlantType.Carrot) * most);
      expect({ held, piles: stacksOf(coins).length <= CURRENCY.denominations.length }).toEqual({
        held,
        piles: true,
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

/**
 * The furniture the house is filled with, which the shop can now sell.
 *
 * It was in the game before it was in the shop: a child could pick up the
 * bed they were given, carry it and put it down again, but had no way to
 * come by a second one — so a room could be rearranged and never added to.
 */
describe("selling furniture", () => {
  test("every piece has a price, and it is payable", () => {
    for (const piece of FURNITURE_STOCK) {
      for (const band of BANDS) {
        const price = priceOf(piece, band.cropPrice);
        expect({ piece, cropPrice: band.cropPrice, payable: isPayable(CURRENCY, price) }).toEqual({
          piece,
          cropPrice: band.cropPrice,
          payable: true,
        });
      }
    }
  });

  // The same question the garden's things answer, so the counter, the
  // quantity picker and the heading need no branch for furniture.
  test("and is bought the same way a fence is", () => {
    const inventory = new Inventory();
    const purse = new Purse();
    purse.earn(priceOf(DecorType.Chair) * 3);
    const trade = buyStock(inventory, purse, DecorType.Chair, 3);
    expect(trade.ok).toBe(true);
    expect(purse.coins).toBe(0);
  });

  /**
   * What is paid for and what ends up in the basket are the same thing for a
   * fence and are not for a chair: furniture is bought *in a colour*, and
   * the colour is part of what she owns rather than a label on it.
   */
  test("but what lands in the basket carries the colour it was bought in", () => {
    const inventory = new Inventory();
    const purse = new Purse();
    purse.earn(priceOf(DecorType.Rug) * 2);
    buyStock(inventory, purse, DecorType.Rug, 1, CROP_PRICE, 3);
    buyStock(inventory, purse, DecorType.Rug, 1, CROP_PRICE, 0);
    expect(inventory.count(decorItem(DecorType.Rug, 3))).toBe(1);
    expect(inventory.count(decorItem(DecorType.Rug, 0))).toBe(1);
    // And never under the bare name, which nothing can place.
    expect(inventory.count(DecorType.Rug as never)).toBe(0);
  });

  test("a fence still lands under its own name, colour or no colour", () => {
    const inventory = new Inventory();
    const purse = new Purse();
    purse.earn(priceOf(FixtureType.Fence));
    buyStock(inventory, purse, FixtureType.Fence, 1);
    expect(inventory.count(FixtureType.Fence)).toBe(1);
  });

  test("and an empty purse buys nothing at all", () => {
    const inventory = new Inventory();
    const purse = new Purse();
    expect(buyStock(inventory, purse, DecorType.Bed, 1).ok).toBe(false);
    expect(inventory.count(decorItem(DecorType.Bed, 0))).toBe(0);
  });

  // Furniture is priced against the garden's rather than on its own scale.
  test("nothing in the house costs more than the lamp", () => {
    const dearest = Math.max(...FURNITURE_STOCK.map((piece) => priceOf(piece)));
    expect(dearest).toBeLessThanOrEqual(priceOf(FixtureType.Lamp));
  });
});

/**
 * The shelves, and the promise they make to the parchment.
 *
 * A shelf too long does not look wrong — it looks like a shop with its last
 * two things underneath the footer, which is how the single list got to
 * eighteen without anything failing.
 */
describe("the shop's shelves", () => {
  test("every shelf fits on the parchment", () => {
    for (const [at, shelf] of SHELVES.entries()) {
      expect({ at, tall: shelf.stock.length }).toEqual({
        at,
        tall: Math.min(shelf.stock.length, MOST_PER_SHELF),
      });
    }
  });

  test("between them they sell everything the shop has, once each", () => {
    // The check that matters. A thing left off every shelf is a thing that
    // exists, has a price, has a noun in three languages and cannot be
    // bought — and nothing else in the game would notice.
    const shelved = SHELVES.flatMap((shelf) => shelf.stock);
    expect([...shelved].sort()).toEqual([...SHOP_STOCK, ...FURNITURE_STOCK].sort());
  });

  test("and each tab stands one of its own things on itself", () => {
    for (const shelf of SHELVES) {
      expect({ icon: shelf.icon, its: shelf.stock.includes(shelf.icon) }).toEqual({
        icon: shelf.icon,
        its: true,
      });
    }
  });

  test("and it is a thing that stands in one cell", () => {
    // A tab is a square. A bed is drawn two cells tall and a bath two wide,
    // and either of them shrunk into a square is a stripe rather than a
    // picture of anything.
    for (const shelf of SHELVES) {
      expect({ icon: shelf.icon, square: isOneCell(shelf.icon) }).toEqual({
        icon: shelf.icon,
        square: true,
      });
    }
  });

  test("everything on a shelf has a price", () => {
    for (const shelf of SHELVES) {
      for (const thing of shelf.stock) {
        expect({ thing, price: priceOf(thing, CROP_PRICE) > 0 }).toEqual({ thing, price: true });
      }
    }
  });
});
