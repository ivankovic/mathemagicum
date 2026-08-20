// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import { BANDS } from "../spells/difficulty";
import { createRng } from "../world/rng";
import { CROP_PRICE, MAX_TRADE } from "../world/shop";
import { CURRENCY, coinsFor, totalOf } from "./currency";
import {
  MAX_OFFER_COINS,
  MISTAKE_IN,
  MISTAKE_MAX_COINS,
  judgeOffer,
  makeOffer,
  maxSaleCount,
} from "./payment";

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
    for (const owed of [5, 10, 25, 250, 1250]) {
      for (const offer of offers(owed)) {
        expect({ owed, coins: offer.coins.length > 0 }).toEqual({ owed, coins: true });
      }
    }
  });

  test("a one-coin payment can only ever be wrong by being too much", () => {
    const wrong = SEEDS.map((seed) => makeOffer(CURRENCY, 5, createRng(seed))).filter(
      (o) => !o.correct,
    );
    for (const offer of wrong) expect(offer.total).toBeGreaterThan(5);
  });

  test("the same seed always counts out the same coins", () => {
    expect(makeOffer(CURRENCY, 1250, createRng(42))).toEqual(
      makeOffer(CURRENCY, 1250, createRng(42)),
    );
  });

  // Half a mite is not money. The smallest coin is one, so the only amounts
  // with no decomposition are the ones that were never whole to begin with.
  test("an amount the coins cannot make is refused rather than fudged", () => {
    expect(makeOffer(CURRENCY, 2.5, createRng(1)).coins).toEqual([]);
    expect(makeOffer(CURRENCY, 0, createRng(1)).coins).toEqual([]);
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

describe("what fits on the counter", () => {
  // The shop screen lays her coins out in a fixed set of slots. If she could
  // count out more than there are slots, a correct payment would be drawn
  // short and a child counting it would be right to call it wrong.
  test("she never puts down more coins than the counter can show", () => {
    const most = maxSaleCount(CURRENCY, CROP_PRICE, MAX_TRADE);
    for (let seed = 0; seed < 100; seed++) {
      const rng = createRng(seed);
      for (let count = 1; count <= most; count++) {
        const offer = makeOffer(CURRENCY, CROP_PRICE * count, rng);
        expect(offer.coins.length).toBeLessThanOrEqual(MAX_OFFER_COINS);
      }
    }
  });

  // The picker steps up one at a time, so every count below the cap has to be
  // sellable too — a cap that skipped a number would be a dead button on it.
  test("every count up to the cap fits, and the next one does not", () => {
    const most = maxSaleCount(CURRENCY, CROP_PRICE, MAX_TRADE);
    expect(most).toBeGreaterThanOrEqual(1);
    for (let count = 1; count <= most; count++) {
      expect(coinsFor(CURRENCY, CROP_PRICE * count).length).toBeLessThanOrEqual(
        MAX_OFFER_COINS - MISTAKE_MAX_COINS,
      );
    }
    if (most < MAX_TRADE) {
      expect(coinsFor(CURRENCY, CROP_PRICE * (most + 1)).length).toBeGreaterThan(
        MAX_OFFER_COINS - MISTAKE_MAX_COINS,
      );
    }
  });

  // The cap is worked out from the coins rather than written down beside
  // them, which is what let the ladder change without anybody having to
  // remember this number: a set whose largest coin is small needs more of
  // them, and would sell fewer at a time.
  test("the cap follows the coins, not a constant", () => {
    const small: typeof CURRENCY = { ...CURRENCY, denominations: [1, 2, 5, 10, 20, 50] };
    expect(maxSaleCount(CURRENCY, CROP_PRICE, MAX_TRADE)).toBe(MAX_TRADE);
    expect(maxSaleCount(small, CROP_PRICE, MAX_TRADE)).toBeLessThan(MAX_TRADE);
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

  test("nothing she counts out overflows the counter, at any band", () => {
    for (const price of prices) {
      const most = maxSaleCount(CURRENCY, price, MAX_TRADE);
      expect({ price, sellable: most >= 1 }).toEqual({ price, sellable: true });
      for (let count = 1; count <= most; count++) {
        for (const offer of offersAt(price * count)) {
          expect({ price, count, fits: offer.coins.length <= MAX_OFFER_COINS }).toEqual({
            price,
            count,
            fits: true,
          });
        }
      }
    }
  });

  // The gentlest band exists so the money is money rather than a second
  // puzzle: every price a whole number of ducats, and every price payable.
  test("the gentlest band prices everything in whole ducats", () => {
    const price = BANDS[0]?.cropPrice ?? 0;
    expect(price % CURRENCY.minorPerMajor).toBe(0);
    for (let count = 1; count <= MAX_TRADE; count++) {
      expect(CURRENCY.format(price * count)).toContain(",00");
    }
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
