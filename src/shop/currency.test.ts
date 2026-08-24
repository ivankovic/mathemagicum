// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import { coinIcon } from "../ui/assets";
import {
  CURRENCY,
  MAJOR_NAME,
  MINOR_NAME,
  MOST_DENOMINATIONS,
  coinsFor,
  isPayable,
  smallestCoin,
  stacksOf,
  totalOf,
} from "./currency";

describe("the coins", () => {
  // The game used to offer real money — kuna, francs, euros — and does not
  // any more: a children's game that shows a euro price and asks for euros on
  // a counter can be read as asking for money. What it keeps is the *shape*
  // of real money, which is the part being taught.
  // Four rungs of that ladder rather than all nine. Every amount in this
  // game is a whole number of fifty mites — everything is priced in crops
  // and a crop fetches 100, 150 or 250 — so the five coins below the fifty
  // could not come up in any transaction. They were harmless as buttons and
  // are not harmless as piles on a table a child drags from.
  test("are four consecutive rungs of a 1-2-5 ladder", () => {
    expect(CURRENCY.denominations).toEqual([50, 100, 200, 500]);
    for (const coin of CURRENCY.denominations) {
      let head = coin;
      while (head % 10 === 0) head /= 10;
      expect([1, 2, 5]).toContain(head);
    }
  });

  test("are listed smallest first, which coinsFor relies on", () => {
    expect([...CURRENCY.denominations].sort((a, b) => a - b)).toEqual([...CURRENCY.denominations]);
    expect(smallestCoin(CURRENCY)).toBe(50);
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
  // A whole number of the *smallest coin*, which is fifty mites now rather
  // than one. The price table's own test enforces the other half of this:
  // nothing in the shop may cost 2,75, because nobody could put it down.
  test("any whole number of the smallest coin, and nothing else", () => {
    expect(isPayable(CURRENCY, 50)).toBe(true);
    expect(isPayable(CURRENCY, 250)).toBe(true);
    expect(isPayable(CURRENCY, 1)).toBe(false);
    expect(isPayable(CURRENCY, 275)).toBe(false);
    expect(isPayable(CURRENCY, 0)).toBe(false);
    expect(isPayable(CURRENCY, -50)).toBe(false);
    expect(isPayable(CURRENCY, 2.5)).toBe(false);
  });
});

describe("counting an amount out", () => {
  test("largest coin first, the way a person does it", () => {
    expect(coinsFor(CURRENCY, 250)).toEqual([200, 50]);
    expect(coinsFor(CURRENCY, 1250)).toEqual([500, 500, 200, 50]);
  });

  test("what it counts out is what was asked for", () => {
    for (let minor = 50; minor <= 20_000; minor += 50) {
      expect(totalOf(coinsFor(CURRENCY, minor))).toBe(minor);
    }
  });

  // Greedy is only the fewest coins because the ladder is 1-2-5; proved here
  // against an exhaustive search rather than asserted.
  test("greedy really is the fewest coins", () => {
    const step = smallestCoin(CURRENCY);
    const best = [0];
    for (let minor = step; minor <= 20_000; minor += step) {
      let fewest = Number.POSITIVE_INFINITY;
      for (const coin of CURRENCY.denominations) {
        if (coin <= minor) fewest = Math.min(fewest, 1 + (best[(minor - coin) / step] as number));
      }
      best[minor / step] = fewest;
      expect(coinsFor(CURRENCY, minor).length).toBe(fewest);
    }
  });

  test("an amount the coins cannot express comes back empty, not nearly right", () => {
    expect(coinsFor(CURRENCY, 2.5)).toEqual([]);
    expect(coinsFor(CURRENCY, 0)).toEqual([]);
  });
});

describe("gathering coins into piles", () => {
  test("one pile per kind, largest first, and every coin in one", () => {
    const coins = coinsFor(CURRENCY, 6000);
    const stacks = stacksOf(coins);
    expect(stacks).toEqual([{ value: 500, count: 12 }]);
    expect(stacksOf(coinsFor(CURRENCY, 1250))).toEqual([
      { value: 500, count: 2 },
      { value: 200, count: 1 },
      { value: 50, count: 1 },
    ]);
  });

  // The piles have to be the same money as the coins, or the check a child
  // does on them is a check of the wrong sum.
  test("the piles come to what the coins came to", () => {
    for (let minor = 50; minor <= 30_000; minor += 50) {
      const coins = coinsFor(CURRENCY, minor);
      const summed = stacksOf(coins).reduce((sum, s) => sum + s.value * s.count, 0);
      expect({ minor, summed }).toEqual({ minor, summed: minor });
    }
  });

  test("and there is never a pile of nothing", () => {
    expect(stacksOf([])).toEqual([]);
    for (const stack of stacksOf(coinsFor(CURRENCY, 4750))) {
      expect(stack.count).toBeGreaterThan(0);
    }
  });

  // Four coins means at most four piles, however much money there is —
  // which is why a sale no longer needs a limit at all.
  test("never more piles than there are kinds of coin", () => {
    for (let minor = 50; minor <= 100_000; minor += 50) {
      expect(stacksOf(coinsFor(CURRENCY, minor)).length).toBeLessThanOrEqual(
        CURRENCY.denominations.length,
      );
    }
  });
});

describe("which picture a coin is drawn with", () => {
  // One face per coin, named by what it is worth. It was one per *metal* —
  // three of them for nine coins — because the value was written on the
  // button beside the icon. Money is laid out on a table now and there is no
  // room beside a coin for a caption, so the picture has to carry the whole
  // of it. Which metal each one is struck from is the art's business, and
  // lives where the art is drawn.
  test("every coin has a picture, and no two share one", () => {
    const faces = CURRENCY.denominations.map(coinIcon);
    expect(new Set(faces).size).toBe(CURRENCY.denominations.length);
    expect(faces).toEqual(["coin-50", "coin-100", "coin-200", "coin-500"]);
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
