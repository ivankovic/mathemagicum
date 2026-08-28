// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import { BANDS } from "../spells/difficulty";
import { createRng } from "../world/rng";
import { CROP_PRICE, MAX_TRADE, SHOP_STOCK, priceOf } from "../world/shop";
import { CURRENCY, coinsFor, smallestCoin, stacksOf, totalOf } from "./currency";
import { MISTAKE_IN, MISTAKE_MAX_COINS, judgeOffer, makeOffer } from "./payment";

const SEEDS = Array.from({ length: 400 }, (_, i) => i * 7919 + 11);

function offers(owed = 250) {
  return SEEDS.map((seed) => makeOffer(CURRENCY, owed, createRng(seed)));
}

/** The same, named for the places that vary the amount rather than the seed. */
const offersAt = offers;

describe("counting out a payment", () => {
  test("a correct offer is the coins the amount is made of", () => {
    const right = offers().find((offer) => offer.correct);
    expect(right?.coins).toEqual(coinsFor(CURRENCY, 250));
    expect(right?.total).toBe(250);
  });

  test("the pile always adds up to what it says it does", () => {
    for (const offer of offers()) {
      expect({ total: offer.total, sum: totalOf(offer.coins) }).toEqual({
        total: offer.total,
        sum: totalOf(offer.coins),
      });
      expect(offer.total).toBe(totalOf(offer.coins));
    }
  });

  test("correct means the pile equals what is owed, and nothing else", () => {
    for (const offer of offers()) {
      expect({ correct: offer.correct, equal: offer.total === offer.owed }).toEqual({
        correct: offer.correct,
        equal: offer.correct,
      });
    }
  });

  // Rarely enough that checking is a habit rather than a chore, often enough
  // that not checking eventually costs the player being right.
  test("she is wrong about one time in ten", () => {
    const wrong = offers().filter((offer) => !offer.correct).length;
    const rate = wrong / SEEDS.length;
    expect(rate).toBeGreaterThan(1 / MISTAKE_IN / 2);
    expect(rate).toBeLessThan((1 / MISTAKE_IN) * 2);
  });

  test("a wrong offer is out by between one and three coins", () => {
    const right = coinsFor(CURRENCY, 250).length;
    for (const offer of offers().filter((o) => !o.correct)) {
      expect(Math.abs(offer.coins.length - right)).toBeGreaterThanOrEqual(1);
      expect(Math.abs(offer.coins.length - right)).toBeLessThanOrEqual(MISTAKE_MAX_COINS);
    }
  });

  test("she is wrong in both directions, not only ever short", () => {
    const wrong = offers(1250).filter((offer) => !offer.correct);
    expect(wrong.some((offer) => offer.total < offer.owed)).toBe(true);
    expect(wrong.some((offer) => offer.total > offer.owed)).toBe(true);
  });

  // A pile that lost all its coins is no offer at all rather than a wrong
  // one, and a small pile is exactly where taking three away would do it.
  test("she never puts down nothing", () => {
    for (const owed of [50, 100, 250, 1250]) {
      for (const offer of offers(owed)) {
        expect({ owed, coins: offer.coins.length > 0 }).toEqual({ owed, coins: true });
      }
    }
  });

  test("a one-coin payment can only ever be wrong by being too much", () => {
    // Fifty, because that is what one coin is now. It was five, which stopped
    // being a coin when the ladder was trimmed — and the test went on passing
    // because every offer came back empty and nothing was left to loop over.
    const one = smallestCoin(CURRENCY);
    const offers = SEEDS.map((seed) => makeOffer(CURRENCY, one, createRng(seed)));
    const wrong = offers.filter((o) => !o.correct);
    expect(wrong.length).toBeGreaterThan(0);
    for (const offer of wrong) expect(offer.total).toBeGreaterThan(one);
  });

  test("the same seed always counts out the same coins", () => {
    expect(makeOffer(CURRENCY, 1250, createRng(42))).toEqual(
      makeOffer(CURRENCY, 1250, createRng(42)),
    );
  });

  // Half a mite is not money, and neither is seventy-five of them: the
  // smallest coin is fifty, so anything off the fifty has no decomposition.
  test("an amount the coins cannot make is refused rather than fudged", () => {
    expect(makeOffer(CURRENCY, 2.5, createRng(1)).coins).toEqual([]);
    expect(makeOffer(CURRENCY, 0, createRng(1)).coins).toEqual([]);
    expect(makeOffer(CURRENCY, 75, createRng(1)).coins).toEqual([]);
  });

  // And an empty counter is never the right money for something that costs
  // something. It used to say it was, which would have had the player agree
  // to be paid nothing and be told they were right to.
  test("and an empty counter is not called correct", () => {
    for (const owed of [75, 2.5, 1]) {
      expect({ owed, correct: makeOffer(CURRENCY, owed, createRng(1)).correct }).toEqual({
        owed,
        correct: false,
      });
    }
  });
});

describe("judging the offer", () => {
  const correct = { owed: 250, coins: [200, 50], total: 250, correct: true } as const;
  const short = { owed: 250, coins: [200], total: 200, correct: false } as const;
  const over = { owed: 250, coins: [200, 50, 50], total: 300, correct: false } as const;

  test("saying a right offer is right", () => {
    const verdict = judgeOffer(CURRENCY, correct, true);
    expect(verdict.right).toBe(true);
    expect(verdict.paid).toBe(250);
  });

  test("spotting a short offer", () => {
    const verdict = judgeOffer(CURRENCY, short, false);
    expect(verdict.right).toBe(true);
    expect(verdict.message).toContain("short of");
  });

  test("spotting an over-payment says over, not short", () => {
    const verdict = judgeOffer(CURRENCY, over, false);
    expect(verdict.right).toBe(true);
    expect(verdict.message).toContain("over");
  });

  // The whole bargain: getting the check wrong costs nothing but being told
  // so. A shop that pocketed the difference would make arithmetic a tax.
  test("she pays what is owed however the player answers", () => {
    for (const offer of [correct, short, over]) {
      for (const answer of [true, false]) {
        expect(judgeOffer(CURRENCY, offer, answer).paid).toBe(250);
      }
    }
  });

  test("trusting a wrong offer is marked wrong, and corrected anyway", () => {
    const verdict = judgeOffer(CURRENCY, short, true);
    expect(verdict.right).toBe(false);
    expect(verdict.paid).toBe(250);
    expect(verdict.message).toContain("Have another look");
  });

  test("doubting a right offer is marked wrong, and paid anyway", () => {
    const verdict = judgeOffer(CURRENCY, correct, false);
    expect(verdict.right).toBe(false);
    expect(verdict.paid).toBe(250);
  });

  test("the message says the sums, so the player can see where they went", () => {
    expect(judgeOffer(CURRENCY, short, false).message).toContain("2,00 ducat");
    expect(judgeOffer(CURRENCY, short, false).message).toContain("2,50 ducat");
  });
});

describe("what she actually pays", () => {
  // The scene throws the judged amount away and books the sale from the price
  // list, which is only right because a wrong guess costs the player nothing.
  // If that ever changes, the purse and the message on screen would disagree.
  test("she pays what she owes whatever the player answers", () => {
    for (const offer of offers()) {
      for (const answer of [true, false]) {
        expect(judgeOffer(CURRENCY, offer, answer).paid).toBe(offer.owed);
      }
    }
  });
});

describe("what she lays on the table", () => {
  // She used to be limited to what the shop screen had slots for, and the
  // shop screen had slots because it drew her coins one by one. Past a
  // handful it draws piles instead — one per kind of coin, each saying how
  // many — so the only bound left is that there are four kinds of coin.
  test("however much she owes, it is never more than four piles", () => {
    for (const owed of [250, 2500, 6000, 24_750, 100_000]) {
      for (let seed = 0; seed < 50; seed++) {
        const offer = makeOffer(CURRENCY, owed, createRng(seed));
        expect({ owed, piles: stacksOf(offer.coins).length }).toEqual({
          owed,
          piles: stacksOf(offer.coins).length,
        });
        expect(stacksOf(offer.coins).length).toBeLessThanOrEqual(CURRENCY.denominations.length);
      }
    }
  });

  // The piles have to be the same money as the coins, right or wrong: a
  // child checking six piles of five ducats is checking her actual offer.
  test("and the piles are worth what the coins were worth", () => {
    for (const owed of [250, 6000, 24_750]) {
      for (let seed = 0; seed < 50; seed++) {
        const offer = makeOffer(CURRENCY, owed, createRng(seed));
        const summed = stacksOf(offer.coins).reduce((sum, s) => sum + s.value * s.count, 0);
        expect({ owed, seed, summed }).toEqual({ owed, seed, summed: offer.total });
      }
    }
  });
});

// Every band quotes a crop differently, and the shopkeeper has to be a
// sensible opponent at all of them. These only ever ran at 2,50 before —
// which is one of four settings, and the one a six-year-old never sees.
describe("counting out at every band", () => {
  const prices = BANDS.map((band) => band.cropPrice);

  test("she is still wrong about one time in ten, whatever a crop costs", () => {
    for (const price of prices) {
      const wrong = SEEDS.map((seed) => makeOffer(CURRENCY, price * 3, createRng(seed))).filter(
        (offer) => !offer.correct,
      ).length;
      const rate = wrong / SEEDS.length;
      expect({ price, low: rate > 1 / MISTAKE_IN / 2 }).toEqual({ price, low: true });
      expect({ price, high: rate < (1 / MISTAKE_IN) * 2 }).toEqual({ price, high: true });
    }
  });

  test("a right pile is always the coins the amount is made of", () => {
    for (const price of prices) {
      for (let count = 1; count <= MAX_TRADE; count++) {
        const owed = price * count;
        const right = offersAt(owed).find((offer) => offer.correct);
        if (!right) continue;
        expect({ price, count, coins: right.coins }).toEqual({
          price,
          count,
          coins: coinsFor(CURRENCY, owed),
        });
      }
    }
  });

  // A one-coin price cannot be short by a coin without being empty, and an
  // empty counter is no offer at all rather than a wrong one.
  test("she never puts down nothing, even where a price is a single coin", () => {
    for (const price of prices) {
      for (let count = 1; count <= MAX_TRADE; count++) {
        for (const offer of offersAt(price * count)) {
          expect({ price, count, any: offer.coins.length > 0 }).toEqual({
            price,
            count,
            any: true,
          });
        }
      }
    }
  });

  // However big the basket and whatever a crop is worth, her money goes on
  // the table as at most one pile per kind of coin. There is no size of sale
  // that cannot be shown, which is why a sale has no limit any more.
  test("nothing she counts out overflows the table, at any band", () => {
    for (const price of prices) {
      for (const count of [1, 3, 10, 40, 99]) {
        for (const offer of offersAt(price * count)) {
          expect({ price, count, fits: stacksOf(offer.coins).length <= 4 }).toEqual({
            price,
            count,
            fits: true,
          });
        }
      }
    }
  });

  // The gentlest band used to price everything in whole ducats, so that the
  // money was money rather than a second puzzle. It also meant the fifty
  // never came up and four of the eight prices were payable with one coin,
  // and a price you pay with one coin has no counting in it at all. So what
  // the gentlest band now guarantees is the opposite: never a single coin,
  // and never more than three.
  test("nothing at the gentlest band is paid with a single coin", () => {
    const price = BANDS[0]?.cropPrice ?? 0;
    // What is on the shelf, not everything she can put down: a machine is
    // built out of wood and stone and has no coin price to count out.
    for (const fixture of SHOP_STOCK) {
      const coins = coinsFor(CURRENCY, priceOf(fixture, price));
      expect({ fixture, coins: coins.length }).toEqual({
        fixture,
        coins: Math.min(3, Math.max(2, coins.length)),
      });
    }
    // And what a crop fetches is two coins, which is where counting starts.
    expect(coinsFor(CURRENCY, price)).toEqual([100, 50]);
  });

  test("every band's prices can actually be counted out", () => {
    for (const price of prices) {
      for (let count = 1; count <= MAX_TRADE; count++) {
        const owed = price * count;
        expect({ price, count, sum: totalOf(coinsFor(CURRENCY, owed)) }).toEqual({
          price,
          count,
          sum: owed,
        });
      }
    }
  });
});
