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
 * Paying for something, coin by coin.
 *
 * The half of the shop where the child does the arithmetic: pick a thing,
 * pick how many, then carry the exact sum across the table one coin at a
 * time. `tender.ts` proves the rules in eleven milliseconds and cannot touch
 * any of this — the piles, the dragging, the counter that refuses a pile
 * that does not add up — which is seven hundred lines of panel.
 *
 * Split from the selling scenarios because they are two different games, and
 * because a browser suite has a ceiling: somewhere past the eighth game
 * booted in one process the browser dies without saying so, and Playwright
 * waits on it forever. Two files is two processes.
 */

describe("standing at the counter", () => {
  test(
    "the picker never offers more than the purse will pay for",
    async () => {
      await play({ seams: "&hour=12&coins=1500&at=244,258" }, async (game) => {
        await game.goShopping();
        expect(await game.seam("shop")).toMatchObject({ mode: "menu" });

        await game.tap("shop.buy.fence");
        const one = await game.seam<{ item: string; owed: number }>("shop");
        expect(one.item).toBe("fence");
        const purse = await game.coins();

        // Press "more" far past the cap. It stops where the money does.
        for (let go = 0; go < 20; go++) await game.tap("shop.more");
        const counter = await game.seam<{ quantity: number; most: number; owed: number }>("shop");
        expect(counter.quantity).toBe(counter.most);
        expect(counter.owed).toBe(one.owed * counter.most);
        // All of them affordable, and one more than that not.
        expect(counter.owed).toBeLessThanOrEqual(purse);
        expect(one.owed * (counter.most + 1)).toBeGreaterThan(purse);
      });
    },
    5 * MINUTES,
  );

  test(
    "and never more than the counter will count out",
    async () => {
      await play({ seams: "&hour=12&coins=100000&at=244,258" }, async (game) => {
        await game.goShopping();
        await game.tap("shop.buy.fence");
        const one = (await game.seam<{ owed: number }>("shop")).owed;
        for (let go = 0; go < 25; go++) await game.tap("shop.more");
        // Ten fences is more coins than anybody lays down one at a time: the
        // counter has its own limit and a full purse does not lift it.
        const counter = await game.seam<{ quantity: number; most: number }>("shop");
        expect(counter.quantity).toBe(counter.most);
        expect(coinsFor(CURRENCY, one * counter.most).length).toBeLessThanOrEqual(
          MOST_COUNTER_COINS,
        );
        if (counter.most < MAX_TRADE) {
          expect(coinsFor(CURRENCY, one * (counter.most + 1)).length).toBeGreaterThan(
            MOST_COUNTER_COINS,
          );
        }
      });
    },
    5 * MINUTES,
  );

  /**
   * The whole reason the shop is not a button that says "buy".
   *
   * A child pays by carrying coins across the table one at a time until they
   * add up. Five one-ducat coins for a five-ducat fence is the arithmetic —
   * and it is the arithmetic on purpose, because one five-ducat coin would
   * do and choosing the harder way is allowed.
   */
  test(
    "a fence is paid for by carrying coins across the table",
    async () => {
      await play({ seams: "&hour=12&coins=100000&at=244,258" }, async (game) => {
        await game.goShopping();
        const before = await game.coins();
        await game.tap("shop.buy.fence");
        const owed = (await game.seam<{ owed: number }>("shop")).owed;
        const ducats = owed / 100;
        expect(Number.isInteger(ducats)).toBe(true);

        // One-ducat coins, dragged one at a time, watching the pile grow —
        // the long way round on purpose, when a coin or two of the big ones
        // would do. Choosing the harder way is allowed, and is the exercise.
        for (let coin = 1; coin <= ducats; coin++) {
          await game.dragCoin(100);
          expect(await game.seam("shop")).toMatchObject({ onCounter: coin * 100 });
        }
        await game.tap("shop.pay");
        await game.settle(800);

        expect(await game.held("fence")).toBe(1);
        expect(await game.coins()).toBe(before - owed);
      });
    },
    5 * MINUTES,
  );

  /**
   * A coin let go of anywhere else is a coin she did not spend.
   *
   * The rule that only exists because paying is a drag: half of learning a
   * new gesture is finding out what *undoes* it, and a coin that counted
   * wherever it landed would mean a child could never change their mind
   * once they had picked one up.
   */
  test(
    "but a coin dropped back on the piles is not spent",
    async () => {
      await play({ seams: "&hour=12&coins=100000&at=244,258" }, async (game) => {
        await game.goShopping();
        await game.tap("shop.buy.fence");
        await game.dragCoin(200);
        expect(await game.seam("shop")).toMatchObject({ onCounter: 200 });

        // Picked up and put back down where it came from.
        await game.dragCoin(500, "shop.pile.50");
        expect(await game.seam("shop")).toMatchObject({ onCounter: 200 });

        // And tapping a coin already on the counter takes it off again.
        await game.dragCoin(100);
        expect(await game.seam("shop")).toMatchObject({ onCounter: 300 });
      });
    },
    5 * MINUTES,
  );

  test(
    "and a pile that does not add up is not accepted",
    async () => {
      await play({ seams: "&hour=12&coins=100000&at=244,258" }, async (game) => {
        await game.goShopping();
        const before = await game.coins();
        await game.tap("shop.buy.fence");
        const short = (await game.seam<{ owed: number }>("shop")).owed / 100 - 1;
        // One ducat short of the price, whatever the price is.
        for (let coin = 0; coin < short; coin++) await game.dragCoin(100);
        await game.tap("shop.pay");
        await game.settle(600);

        // Nothing bought, nothing spent, and the coins are still on the
        // counter to be added to rather than swept away.
        expect(await game.held("fence")).toBe(0);
        expect(await game.coins()).toBe(before);
        expect(await game.seam("shop")).toMatchObject({ onCounter: short * 100 });

        // One more finishes it.
        await game.dragCoin(100);
        await game.tap("shop.pay");
        await game.settle(800);
        expect(await game.held("fence")).toBe(1);
      });
    },
    5 * MINUTES,
  );

  /**
   * Furniture, bought in a colour, and carried home.
   *
   * The furniture was in the game before it was in the shop: a child could
   * pick up the bed they were given and put it down again, but had no way to
   * come by a second one. So a room could be rearranged and never added to.
   *
   * Buying it is two taps like the crate's — the piece, then the colour —
   * except that the shop offers all five where the crate offers only what
   * she owns. Here she owns none, so filtering by ownership would sell
   * nothing at all.
   */
  test(
    "a chair is bought in a colour, and it is that colour she carries away",
    async () => {
      await play({ seams: "&hour=12&coins=100000&at=244,258" }, async (game) => {
        await game.goShopping();
        expect(await game.held("chair~3")).toBe(0);

        await game.tap("shop.buy.chair");
        const counter = await game.seam<{ item: string; owed: number; look: number }>("shop");
        expect(counter.item).toBe("chair");
        expect(counter.look).toBe(0);

        // The fourth colourway rather than the first, so a chair that came
        // back in the shipped paint would fail rather than pass by default.
        expect(await game.tap("shop.look.3")).toBe(true);
        expect(await game.seam("shop")).toMatchObject({ look: 3 });

        const owed = (await game.seam<{ owed: number }>("shop")).owed;
        for (const coin of [500, 200, 50]) {
          while ((await game.seam<{ onCounter: number }>("shop")).onCounter + coin <= owed) {
            await game.dragCoin(coin);
          }
        }
        await game.tap("shop.pay");
        await game.settle(800);

        expect(await game.held("chair~3")).toBe(1);
        // And never under the bare name, which nothing can put down.
        expect(await game.held("chair")).toBe(0);
      });
    },
    5 * MINUTES,
  );

  /**
   * The heading has to say what the counter is asking for.
   *
   * It did not. It asked for the price without saying which child was
   * paying, so it got the default band's price — the heading read 12,50 over
   * a counter that wanted 17,50, for every child not on the one band whose
   * price matched the constant. Nothing could see the heading, so nothing
   * caught it; this is what that costs to fix.
   */
  test(
    "the heading says the same sum the counter is waiting for",
    async () => {
      await play({ seams: "&hour=12&coins=100000&at=244,258" }, async (game) => {
        await game.goShopping();
        for (const item of ["fence", "table", "lamp"]) {
          await game.tap(`shop.buy.${item}`);
          const counter = await game.seam<{ owed: number; title: string }>("shop");
          const ducats = Math.floor(counter.owed / 100);
          const mites = String(counter.owed % 100).padStart(2, "0");
          expect({ item, title: counter.title }).toEqual({
            item,
            title: expect.stringContaining(`${ducats},${mites}`) as unknown as string,
          });
          await game.tap("shop.back");
        }
      });
    },
    5 * MINUTES,
  );
});
