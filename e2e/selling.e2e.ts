// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { afterAll, describe, expect, test } from "bun:test";
// The game's own price list and coin table, rather than numbers copied in
// here. What a fence costs depends on which band a child is on, and a
// scenario holding its own copy of that would be checking the copy.
import { CURRENCY, coinsFor } from "../src/shop/currency";
import { MOST_COUNTER_COINS } from "../src/shop/tender";
import { MAX_TRADE } from "../src/world/shop";
import { play, shutDown } from "./harness";

const MINUTES = 60_000;

// The dev server goes when this file is done with it, which is safe because
// `run.ts` gives every scenario file a process of its own.
afterAll(shutDown);

/**
 * Being paid, and saying whether it is right.
 *
 * The other half of the shop, and the other skill: the shopkeeper counts a
 * payment out and the child checks it. She is wrong about one time in ten,
 * so checking is the whole exercise — and past a handful of coins she stacks
 * them into piles, which turns the check from counting into multiplying and
 * is what lets a sale have no limit at all.
 */

describe("being paid at the counter", () => {
  /**
   * A whole basket, in one sale.
   *
   * It used to be ten and no more, which is the buying limit wearing the
   * wrong hat: a purchase is coins the *child* lays down one at a time, and
   * ten of anything is already a lot of them. A sale is counted out by the
   * shopkeeper, so the only real question is whether the pile fits on the
   * table — and twenty-four carrots is twelve coins, which it does.
   */
  test(
    "a whole basket goes in one sale, however many that is",
    async () => {
      await play({ seams: "&hour=12&crops=24&coins=0&at=244,258" }, async (game) => {
        await game.goShopping();
        expect(await game.held("carrot")).toBe(24);

        await game.tap("shop.sell.carrot");
        // The picker opens at all of them rather than at one: stepping up to
        // twenty-four is twenty-four taps to reach the obvious thing.
        expect(await game.seam("shop")).toMatchObject({ quantity: 24, most: 24 });

        await game.tap("shop.yes");
        await game.settle(900);
        expect(await game.held("carrot")).toBe(0);
        expect(await game.coins()).toBeGreaterThan(0);
      });
    },
    5 * MINUTES,
  );

  /**
   * Past a handful, her money goes into piles instead of loose coins.
   *
   * The thing that makes an unlimited sale *checkable*. Counting does not
   * scale — she is a coin or two out one time in ten, and one coin missing
   * from forty is invisible — so past the point where counting works she
   * stacks them and writes how many. Twenty fives is checked by multiplying,
   * and multiplying does not get harder as the pile grows.
   */
  test(
    "a big sale is counted out in piles, a small one in coins",
    async () => {
      await play({ seams: "&hour=12&crops=40&coins=0&at=244,258" }, async (game) => {
        await game.goShopping();
        await game.tap("shop.sell.carrot");
        // Forty carrots is more coins than anybody could check by counting,
        // so they go into piles — however much a carrot happens to fetch.
        const big = await game.seam<{ quantity: number; owed: number; piles: number }>("shop");
        expect(big.quantity).toBe(40);
        expect(coinsFor(CURRENCY, big.owed).length).toBeGreaterThan(MOST_COUNTER_COINS);
        expect(big.piles).toBeGreaterThan(0);
        expect(big.piles).toBeLessThanOrEqual(CURRENCY.denominations.length);

        // And down at three carrots it is loose coins again, because a
        // handful is exactly what a child should be counting.
        for (let step = 0; step < 37; step++) await game.tap("shop.fewer");
        const small = await game.seam<{ quantity: number; owed: number; piles: number }>("shop");
        expect(small.quantity).toBe(3);
        expect(small.owed).toBe((big.owed / big.quantity) * 3);
        expect(coinsFor(CURRENCY, small.owed).length).toBeLessThanOrEqual(MOST_COUNTER_COINS);
        expect(small.piles).toBe(0);
      });
    },
    5 * MINUTES,
  );

  /**
   * And the other direction: she is paid, and has to say whether it is right.
   *
   * The shopkeeper is "not always right, mind" — the offer she counts out is
   * sometimes short, and a child who accepts a short one loses the
   * difference. That is the whole point of the sell side and it has never
   * been played through.
   */
  test(
    "selling crops pays out what was agreed",
    async () => {
      await play({ seams: "&hour=12&crops=9&coins=0&at=244,258" }, async (game) => {
        await game.goShopping();
        await game.tap("shop.sell.carrot");
        const counter = await game.seam<{ item: string; owed: number; most: number }>("shop");
        expect(counter.item).toBe("carrot");
        expect(counter.owed).toBeGreaterThan(0);
        expect(counter.most).toBeGreaterThanOrEqual(1);

        const carrots = await game.held("carrot");
        const purse = await game.coins();
        // Take whatever she has laid out. Whether it was right is the
        // child's judgement; what must hold is that saying yes pays it.
        await game.tap("shop.yes");
        await game.settle(800);
        expect(await game.held("carrot")).toBeLessThan(carrots);
        expect(await game.coins()).toBeGreaterThan(purse);
      });
    },
    5 * MINUTES,
  );
});
