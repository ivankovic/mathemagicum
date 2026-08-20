// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import {
  COIN_TIERS,
  CURRENCY,
  CoinTier,
  MAJOR_NAME,
  MINOR_NAME,
  MOST_DENOMINATIONS,
  coinTier,
  coinsFor,
  isPayable,
  smallestCoin,
  totalOf,
} from "./currency";

describe("the coins", () => {
  // The game used to offer real money — kuna, francs, euros — and does not
  // any more: a children's game that shows a euro price and asks for euros on
  // a counter can be read as asking for money. What it keeps is the *shape*
  // of real money, which is the part being taught.
  test("are a complete 1-2-5 ladder", () => {
    expect(CURRENCY.denominations).toEqual([1, 2, 5, 10, 20, 50, 100, 200, 500]);
    for (const coin of CURRENCY.denominations) {
      let head = coin;
      while (head % 10 === 0) head /= 10;
      expect([1, 2, 5]).toContain(head);
    }
  });

  test("are listed smallest first, which coinsFor relies on", () => {
    expect([...CURRENCY.denominations].sort((a, b) => a - b)).toEqual([...CURRENCY.denominations]);
    expect(smallestCoin(CURRENCY)).toBe(1);
  });

  test("run a hundred to the ducat, so the decimal point behaves", () => {
    expect(CURRENCY.minorPerMajor).toBe(100);
    expect(CURRENCY.denominations).toContain(CURRENCY.minorPerMajor);
  });

  test("the pad is built for exactly as many as there are", () => {
    expect(MOST_DENOMINATIONS).toBe(CURRENCY.denominations.length);
  });
});

describe("writing an amount", () => {
  test("reads like a price tag: comma, two digits, unit", () => {
    expect(CURRENCY.format(250)).toBe("2,50 ducat");
    expect(CURRENCY.format(5)).toBe("0,05 ducat");
    expect(CURRENCY.format(1234)).toBe("12,34 ducat");
  });

  // Otherwise "0,5" reads as five mites rather than fifty.
  test("always pads the mites to two digits", () => {
    for (let minor = 0; minor < 500; minor++) {
      const written = CURRENCY.format(minor);
      expect(written.split(",")[1]?.slice(0, 2)).toMatch(/^\d\d$/);
    }
  });

  test("a coin says what it is worth in the unit it is worth it in", () => {
    expect(CURRENCY.coinLabel(1)).toBe("1 mite");
    expect(CURRENCY.coinLabel(50)).toBe("50 mite");
    expect(CURRENCY.coinLabel(100)).toBe("1 ducat");
    expect(CURRENCY.coinLabel(500)).toBe("5 ducat");
  });

  // The names changed once already: they were suns and rays, and the children
  // could not tell which was the coin. A money word is the requirement — but
  // it must not be *anybody's* money word, which is what this guards.
  test("no coin is named after real money", () => {
    const banned =
      /kuna|lipa|franc|rappen|euro|cent|dollar|pound|penny|krona|krone|koruna|shilling|florin|CHF|kn|[€$£¥₣]/i;
    for (const coin of CURRENCY.denominations) {
      expect(CURRENCY.coinLabel(coin)).not.toMatch(banned);
    }
    expect(CURRENCY.format(250)).not.toMatch(banned);
  });
});

describe("what can be paid", () => {
  test("any whole number of mites, and nothing else", () => {
    expect(isPayable(CURRENCY, 1)).toBe(true);
    expect(isPayable(CURRENCY, 250)).toBe(true);
    expect(isPayable(CURRENCY, 0)).toBe(false);
    expect(isPayable(CURRENCY, -5)).toBe(false);
    expect(isPayable(CURRENCY, 2.5)).toBe(false);
  });
});

describe("counting an amount out", () => {
  test("largest coin first, the way a person does it", () => {
    expect(coinsFor(CURRENCY, 250)).toEqual([200, 50]);
    expect(coinsFor(CURRENCY, 738)).toEqual([500, 200, 20, 10, 5, 2, 1]);
  });

  test("what it counts out is what was asked for", () => {
    for (let minor = 1; minor <= 1000; minor++) {
      expect(totalOf(coinsFor(CURRENCY, minor))).toBe(minor);
    }
  });

  // Greedy is only the fewest coins because the ladder is 1-2-5; proved here
  // against an exhaustive search rather than asserted.
  test("greedy really is the fewest coins", () => {
    const best = [0];
    for (let minor = 1; minor <= 1000; minor++) {
      let fewest = Number.POSITIVE_INFINITY;
      for (const coin of CURRENCY.denominations) {
        if (coin <= minor) fewest = Math.min(fewest, 1 + (best[minor - coin] as number));
      }
      best[minor] = fewest;
      expect(coinsFor(CURRENCY, minor).length).toBe(fewest);
    }
  });

  test("an amount the coins cannot express comes back empty, not nearly right", () => {
    expect(coinsFor(CURRENCY, 2.5)).toEqual([]);
    expect(coinsFor(CURRENCY, 0)).toEqual([]);
  });
});

describe("which coin a value is drawn as", () => {
  test("a whole ducat and up is gold, a tenth and up is silver, the rest copper", () => {
    for (const value of [1, 2, 5]) expect(coinTier(CURRENCY, value)).toBe(CoinTier.Copper);
    for (const value of [10, 20, 50]) expect(coinTier(CURRENCY, value)).toBe(CoinTier.Silver);
    for (const value of [100, 200, 500]) expect(coinTier(CURRENCY, value)).toBe(CoinTier.Gold);
  });

  // Three faces have to cover every coin, and the ladder has to climb: a
  // bigger coin never gets a lesser face than a smaller one.
  test("every coin has a face, and the faces never go backwards", () => {
    const tiers = CURRENCY.denominations.map((coin) =>
      COIN_TIERS.indexOf(coinTier(CURRENCY, coin)),
    );
    expect(tiers.every((tier) => tier >= 0)).toBe(true);
    expect(tiers).toEqual([...tiers].sort((a, b) => a - b));
    expect(new Set(tiers).size).toBe(COIN_TIERS.length);
  });
});

describe("what the coins are called", () => {
  // Suns and rays failed for a reason worth keeping written down: they were
  // *nature* words, so nothing about either said "money", and nothing said
  // which of the two was the small one. Both halves are checked here.
  test("both names read as money, and neither is anybody's money", () => {
    expect(MAJOR_NAME).toBe("ducat");
    expect(MINOR_NAME).toBe("mite");
    expect(CURRENCY.format(250)).toContain(MAJOR_NAME);
    expect(CURRENCY.coinLabel(1)).toContain(MINOR_NAME);
  });

  test("the small coin's name is not the big one's", () => {
    expect(MINOR_NAME).not.toBe(MAJOR_NAME);
    // Nor a prefix of it, which is how "sun"/"sunlet" schemes read at a
    // glance to a child who is still sounding words out.
    expect(MAJOR_NAME.startsWith(MINOR_NAME)).toBe(false);
    expect(MINOR_NAME.startsWith(MAJOR_NAME)).toBe(false);
  });

  test("a price is always written in the major unit, whatever it is called", () => {
    for (const amount of [1, 50, 99, 100, 250, 5000]) {
      expect(CURRENCY.format(amount)).toEndWith(` ${MAJOR_NAME}`);
    }
  });
});
