// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { afterAll, describe, expect, test } from "bun:test";
import { type Game, play, shutDown } from "./harness";

/**
 * The loop that crosses the counter.
 *
 * `session.test.ts` already plays plant → grow → pick → sell → buy → place,
 * and plays it in eleven milliseconds — but it calls `sell()` and `buy()`
 * directly, which is not what a child does. A child stands in front of the
 * shopkeeper, picks a row, moves a quantity picker, and *counts out coins*.
 * All of that is in a seven-hundred-line panel that no test could reach until
 * it was given a seam, and the counting is the one arithmetic in this game a
 * child can be wrong about without being wrong about a sum.
 */

const MINUTES = 60_000;

// The dev server goes when this file is done with it, which is safe again
// now that `run.ts` gives every scenario file a process of its own: there is
// no next file in here to pull it out from under. Left to the process's own
// exit handler it did not go at all — a bun test that finishes does not run
// them reliably — and each run left a Vite behind.
afterAll(shutDown);

/**
 * Into the barn, and up to the shopkeeper.
 *
 * She stands at the back of the room and the room is not always laid out the
 * same way round, so this tries the squares beside the player rather than
 * assuming one — a tap on the wall behind her opens nothing, which is a
 * refusal, not a failure.
 */
async function goShopping(game: Game): Promise<void> {
  await game.walk("ArrowUp", 1000);
  await game.walk("ArrowUp", 450);
  for (const [dCol, dRow] of [
    [-1, 0],
    [1, 0],
    [0, -1],
    [-1, -1],
    [1, -1],
  ] as const) {
    await game.tapNear(dCol, dRow);
    if (await game.seam("shop")) return;
  }
  throw new Error("could not find the shopkeeper");
}

describe("standing at the counter", () => {
  test(
    "the picker never offers more than the purse will pay for",
    async () => {
      // Fences are 500; twelve hundred rays buys two of them.
      await play({ seams: "&hour=12&coins=1200&at=244,258" }, async (game) => {
        await goShopping(game);
        expect(await game.seam("shop")).toMatchObject({ mode: "menu" });

        await game.tap("shop.buy.fence");
        const counter = await game.seam<{ item: string; most: number; owed: number }>("shop");
        expect(counter.item).toBe("fence");
        expect(counter.most).toBe(2);
        expect(counter.owed).toBe(500);

        // Press "more" far past the cap. It stops where the money does.
        for (let go = 0; go < 20; go++) await game.tap("shop.more");
        expect(await game.seam("shop")).toMatchObject({ quantity: 2, most: 2, owed: 1000 });
      });
    },
    5 * MINUTES,
  );

  test(
    "and never more than the counter will count out",
    async () => {
      await play({ seams: "&hour=12&coins=100000&at=244,258" }, async (game) => {
        await goShopping(game);
        await game.tap("shop.buy.fence");
        for (let go = 0; go < 25; go++) await game.tap("shop.more");
        // A hundred carrots is a hundred coins to count: the counter has its
        // own limit, and a full purse does not lift it.
        const counter = await game.seam<{ quantity: number; most: number }>("shop");
        expect(counter.most).toBe(10);
        expect(counter.quantity).toBe(10);
      });
    },
    5 * MINUTES,
  );

  /**
   * The whole reason the shop is not a button that says "buy".
   *
   * A child pays by putting coins on the counter one at a time until they
   * add up. Counting out 5,00 in five one-ducat coins is the arithmetic, and
   * nothing tested that it *works* — only that `tender.ts` computes it.
   */
  test(
    "a fence is paid for by counting coins onto the counter",
    async () => {
      await play({ seams: "&hour=12&coins=100000&at=244,258" }, async (game) => {
        await goShopping(game);
        const before = await game.coins();
        await game.tap("shop.buy.fence");
        const owed = (await game.seam<{ owed: number }>("shop")).owed;
        expect(owed).toBe(500);

        // Five ducats, one at a time, watching the pile grow.
        for (let coin = 1; coin <= 5; coin++) {
          await game.tap("shop.coin.100");
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

  test(
    "and a pile that does not add up is not accepted",
    async () => {
      await play({ seams: "&hour=12&coins=100000&at=244,258" }, async (game) => {
        await goShopping(game);
        const before = await game.coins();
        await game.tap("shop.buy.fence");
        // Four ducats against a five-ducat fence.
        for (let coin = 0; coin < 4; coin++) await game.tap("shop.coin.100");
        await game.tap("shop.pay");
        await game.settle(600);

        // Nothing bought, nothing spent, and the coins are still on the
        // counter to be added to rather than swept away.
        expect(await game.held("fence")).toBe(0);
        expect(await game.coins()).toBe(before);
        expect(await game.seam("shop")).toMatchObject({ onCounter: 400 });

        // One more finishes it.
        await game.tap("shop.coin.100");
        await game.tap("shop.pay");
        await game.settle(800);
        expect(await game.held("fence")).toBe(1);
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
        await goShopping(game);
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
