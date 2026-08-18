// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import { createRng } from "../world/rng";
import { CROP_PRICE, MAX_TRADE } from "../world/shop";
import { Currency, coinsFor, currencyOf, totalOf } from "./currency";
import {
  MAX_OFFER_COINS,
  MISTAKE_IN,
  MISTAKE_MAX_COINS,
  judgeOffer,
  makeOffer,
  maxSaleCount,
} from "./payment";

const kuna = currencyOf(Currency.Kuna);
const SEEDS = Array.from({ length: 400 }, (_, i) => i * 7919 + 11);

function offers(owed = 250) {
  return SEEDS.map((seed) => makeOffer(kuna, owed, createRng(seed)));
}

describe("counting out a payment", () => {
  test("a correct offer is the coins the amount is made of", () => {
    const right = offers().find((offer) => offer.correct);
    expect(right?.coins).toEqual(coinsFor(kuna, 250));
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
    const right = coinsFor(kuna, 250).length;
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
    const wrong = SEEDS.map((seed) => makeOffer(kuna, 5, createRng(seed))).filter(
      (o) => !o.correct,
    );
    for (const offer of wrong) expect(offer.total).toBeGreaterThan(5);
  });

  test("the same seed always counts out the same coins", () => {
    expect(makeOffer(kuna, 1250, createRng(42))).toEqual(makeOffer(kuna, 1250, createRng(42)));
  });

  test("an amount the coins cannot make is refused rather than fudged", () => {
    const offer = makeOffer(kuna, 3, createRng(1));
    expect(offer.coins).toEqual([]);
  });
});

describe("judging the offer", () => {
  const correct = { owed: 250, coins: [200, 50], total: 250, correct: true } as const;
  const short = { owed: 250, coins: [200], total: 200, correct: false } as const;
  const over = { owed: 250, coins: [200, 50, 50], total: 300, correct: false } as const;

  test("saying a right offer is right", () => {
    const verdict = judgeOffer(kuna, correct, true);
    expect(verdict.right).toBe(true);
    expect(verdict.paid).toBe(250);
  });

  test("spotting a short offer", () => {
    const verdict = judgeOffer(kuna, short, false);
    expect(verdict.right).toBe(true);
    expect(verdict.message).toContain("short of");
  });

  test("spotting an over-payment says over, not short", () => {
    const verdict = judgeOffer(kuna, over, false);
    expect(verdict.right).toBe(true);
    expect(verdict.message).toContain("over");
  });

  // The whole bargain: getting the check wrong costs nothing but being told
  // so. A shop that pocketed the difference would make arithmetic a tax.
  test("she pays what is owed however the player answers", () => {
    for (const offer of [correct, short, over]) {
      for (const answer of [true, false]) {
        expect(judgeOffer(kuna, offer, answer).paid).toBe(250);
      }
    }
  });

  test("trusting a wrong offer is marked wrong, and corrected anyway", () => {
    const verdict = judgeOffer(kuna, short, true);
    expect(verdict.right).toBe(false);
    expect(verdict.paid).toBe(250);
    expect(verdict.message).toContain("Have another look");
  });

  test("doubting a right offer is marked wrong, and paid anyway", () => {
    const verdict = judgeOffer(kuna, correct, false);
    expect(verdict.right).toBe(false);
    expect(verdict.paid).toBe(250);
  });

  test("the message says the sums, so the player can see where they went", () => {
    expect(judgeOffer(kuna, short, false).message).toContain("2,00 kn");
    expect(judgeOffer(kuna, short, false).message).toContain("2,50 kn");
  });
});

describe("what she actually pays", () => {
  // The scene throws the judged amount away and books the sale from the price
  // list, which is only right because a wrong guess costs the player nothing.
  // If that ever changes, the purse and the message on screen would disagree.
  test("she pays what she owes whatever the player answers", () => {
    for (const offer of offers()) {
      for (const answer of [true, false]) {
        expect(judgeOffer(kuna, offer, answer).paid).toBe(offer.owed);
      }
    }
  });
});

describe("what fits on the counter", () => {
  // The shop screen lays her coins out in a fixed set of slots. If she could
  // count out more than there are slots, a correct payment would be drawn
  // short and a child counting it would be right to call it wrong.
  test("she never puts down more coins than the counter can show", () => {
    for (const code of [Currency.Kuna, Currency.Franc, Currency.Euro]) {
      const currency = currencyOf(code);
      const most = maxSaleCount(currency, CROP_PRICE, MAX_TRADE);
      for (let seed = 0; seed < 100; seed++) {
        const rng = createRng(seed);
        for (let count = 1; count <= most; count++) {
          const offer = makeOffer(currency, CROP_PRICE * count, rng);
          expect(offer.coins.length).toBeLessThanOrEqual(MAX_OFFER_COINS);
        }
      }
    }
  });

  // The picker steps up one at a time, so every count below the cap has to be
  // sellable too — a cap that skipped a number would be a dead button on it.
  test("every count up to the cap fits, and the next one does not", () => {
    for (const code of [Currency.Kuna, Currency.Franc, Currency.Euro]) {
      const currency = currencyOf(code);
      const most = maxSaleCount(currency, CROP_PRICE, MAX_TRADE);
      expect(most).toBeGreaterThanOrEqual(1);
      for (let count = 1; count <= most; count++) {
        expect(coinsFor(currency, CROP_PRICE * count).length).toBeLessThanOrEqual(
          MAX_OFFER_COINS - MISTAKE_MAX_COINS,
        );
      }
      if (most < MAX_TRADE) {
        expect(coinsFor(currency, CROP_PRICE * (most + 1)).length).toBeGreaterThan(
          MAX_OFFER_COINS - MISTAKE_MAX_COINS,
        );
      }
    }
  });

  // Small coins mean more of them: the euro's largest is 2 €, so it caps
  // lower than the other two. Named here so the difference is deliberate.
  test("the euro sells fewer at a time than the five-unit currencies", () => {
    const euro = maxSaleCount(currencyOf(Currency.Euro), CROP_PRICE, MAX_TRADE);
    const kn = maxSaleCount(currencyOf(Currency.Kuna), CROP_PRICE, MAX_TRADE);
    expect(kn).toBe(MAX_TRADE);
    expect(euro).toBeLessThan(kn);
  });
});
