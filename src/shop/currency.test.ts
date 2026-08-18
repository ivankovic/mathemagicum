// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import {
  COIN_TIERS,
  CURRENCIES,
  CoinTier,
  Currency,
  MOST_DENOMINATIONS,
  coinTier,
  coinsFor,
  currencyForLanguage,
  currencyOf,
  isPayable,
  smallestCoin,
  totalOf,
} from "./currency";

const kuna = currencyOf(Currency.Kuna);
const franc = currencyOf(Currency.Franc);

describe("the coin sets", () => {
  // Checked against what actually circulated, not what the currencies
  // technically minted. Switzerland withdrew 1 rappen in 2007 and 2 rappen in
  // 1978; Croatia stopped minting 1 and 2 lipa for circulation in 2009 and
  // its 25 kuna was a commemorative nobody spent.
  test("kuna and francs both start at five and run 5/10/20/50/100/200/500", () => {
    for (const code of [Currency.Kuna, Currency.Franc]) {
      expect(currencyOf(code).denominations).toEqual([5, 10, 20, 50, 100, 200, 500]);
    }
  });

  // The euro is the odd one and that is the point of having it: it keeps its
  // 1 and 2 cent pieces, so a price need not be a round five, and it stops at
  // 2 € because 5 € is a note.
  test("the euro runs 1/2/5/10/20/50/100/200", () => {
    expect(currencyOf(Currency.Euro).denominations).toEqual([1, 2, 5, 10, 20, 50, 100, 200]);
  });

  test("coins are listed smallest first, which coinsFor relies on", () => {
    for (const currency of Object.values(CURRENCIES)) {
      const sorted = [...currency.denominations].sort((a, b) => a - b);
      expect(currency.denominations).toEqual(sorted);
      expect(smallestCoin(currency)).toBeGreaterThan(0);
    }
  });

  // Greedy change is only the fewest coins because every set is a 1-2-5
  // ladder; a set that broke it would silently make coinsFor wrong.
  test("every set is a 1-2-5 ladder, which is what makes greedy optimal", () => {
    for (const currency of Object.values(CURRENCIES)) {
      const heads = currency.denominations.map((coin) => {
        let value = coin;
        while (value % 10 === 0) value /= 10;
        return value;
      });
      for (const head of heads) expect([1, 2, 5]).toContain(head);
    }
  });
});

describe("choosing a currency", () => {
  test("German shops in francs", () => {
    expect(currencyForLanguage("de")).toBe(Currency.Franc);
    expect(currencyForLanguage("de-CH")).toBe(Currency.Franc);
    expect(currencyForLanguage("de-AT")).toBe(Currency.Franc);
    expect(currencyForLanguage("DE-ch")).toBe(Currency.Franc);
  });

  test("everything else shops in kuna", () => {
    expect(currencyForLanguage("en")).toBe(Currency.Kuna);
    expect(currencyForLanguage("en-GB")).toBe(Currency.Kuna);
    expect(currencyForLanguage("hr")).toBe(Currency.Kuna);
    expect(currencyForLanguage(undefined)).toBe(Currency.Kuna);
    expect(currencyForLanguage("")).toBe(Currency.Kuna);
  });

  // "de" has to match the subtag, not appear anywhere in the string, or
  // Swedish (`sv-DE`? no — but `nl-DE`, and plainly `xx-de`) would buy francs.
  test("a region that merely mentions Germany is not German", () => {
    expect(currencyForLanguage("en-DE")).toBe(Currency.Kuna);
    expect(currencyForLanguage("nl-DE")).toBe(Currency.Kuna);
  });
});

describe("writing money down", () => {
  test("kuna uses a comma, with the unit after the number", () => {
    expect(kuna.format(1250)).toBe("12,50 kn");
    expect(kuna.format(50)).toBe("0,50 kn");
    expect(kuna.format(500)).toBe("5,00 kn");
    expect(kuna.format(0)).toBe("0,00 kn");
  });

  test("francs use a point, with the code in front", () => {
    expect(franc.format(1250)).toBe("CHF 12.50");
    expect(franc.format(5)).toBe("CHF 0.05");
    expect(franc.format(2000)).toBe("CHF 20.00");
  });

  // A total of 1.05 written as "1,5 kn" would be read as one and a half.
  test("the minor part is always two digits", () => {
    expect(kuna.format(105)).toBe("1,05 kn");
    expect(franc.format(105)).toBe("CHF 1.05");
  });

  test("a coin is labelled in whichever unit it is a whole number of", () => {
    expect(kuna.coinLabel(20)).toBe("20 lp");
    expect(kuna.coinLabel(50)).toBe("50 lp");
    expect(kuna.coinLabel(100)).toBe("1 kn");
    expect(kuna.coinLabel(500)).toBe("5 kn");
    expect(franc.coinLabel(20)).toBe("20 Rp.");
    expect(franc.coinLabel(100)).toBe("1 Fr.");
    expect(franc.coinLabel(500)).toBe("5 Fr.");
  });
});

describe("what can be paid", () => {
  test("whole numbers of the smallest coin, and nothing else", () => {
    expect(isPayable(kuna, 5)).toBe(true);
    expect(isPayable(kuna, 250)).toBe(true);
    expect(isPayable(kuna, 3)).toBe(false);
    expect(isPayable(kuna, 12)).toBe(false);
  });

  test("nothing is not an amount, and neither is a fraction of a coin", () => {
    expect(isPayable(kuna, 0)).toBe(false);
    expect(isPayable(kuna, -5)).toBe(false);
    expect(isPayable(kuna, 2.5)).toBe(false);
  });
});

describe("counting out an amount", () => {
  test("largest coin first, which is how a person counts", () => {
    expect(coinsFor(kuna, 1250)).toEqual([500, 500, 200, 50]);
    expect(coinsFor(kuna, 5)).toEqual([5]);
    expect(coinsFor(kuna, 35)).toEqual([20, 10, 5]);
  });

  test("the pile always comes to the amount asked for", () => {
    for (let amount = 5; amount <= 2000; amount += 5) {
      expect({ amount, total: totalOf(coinsFor(kuna, amount)) }).toEqual({ amount, total: amount });
    }
  });

  // A 1-2-5 system is one of the ones greedy is optimal for, which is worth
  // pinning: a change of denominations could quietly make it not.
  test("greedy is the fewest coins, for every amount up to twenty francs", () => {
    const coins = [...franc.denominations].sort((a, b) => a - b);
    const fewest = new Array<number>(2001).fill(Number.POSITIVE_INFINITY);
    fewest[0] = 0;
    for (let amount = 5; amount <= 2000; amount += 5) {
      for (const coin of coins) {
        if (coin <= amount)
          fewest[amount] = Math.min(
            fewest[amount] as number,
            (fewest[amount - coin] as number) + 1,
          );
      }
    }
    for (let amount = 5; amount <= 2000; amount += 5) {
      expect({ amount, n: coinsFor(franc, amount).length }).toEqual({
        amount,
        n: fewest[amount] as number,
      });
    }
  });

  // Nearly right is worse than plainly refused: a caller handed a short pile
  // would pay the wrong amount and never know.
  test("an amount no coins can make is refused rather than approximated", () => {
    expect(coinsFor(kuna, 3)).toEqual([]);
    expect(coinsFor(kuna, 12)).toEqual([]);
    expect(coinsFor(kuna, 0)).toEqual([]);
  });

  test("totalOf an empty pile is nothing", () => {
    expect(totalOf([])).toBe(0);
  });
});

describe("what the coin pad has to hold", () => {
  // The pad builds this many buttons once and re-labels them; a currency
  // that needed more would lose its largest coins without saying so.
  test("it covers the widest coin set there is", () => {
    for (const currency of Object.values(CURRENCIES)) {
      expect(currency.denominations.length).toBeLessThanOrEqual(MOST_DENOMINATIONS);
    }
    const widest = Math.max(
      ...Object.values(CURRENCIES).map((currency) => currency.denominations.length),
    );
    expect(MOST_DENOMINATIONS).toBe(widest);
  });
});

describe("which coin a value is drawn as", () => {
  test("a whole unit and up is gold, a tenth and up is silver, the rest copper", () => {
    const kuna = currencyOf(Currency.Kuna);
    expect(coinTier(kuna, 5)).toBe(CoinTier.Copper);
    expect(coinTier(kuna, 10)).toBe(CoinTier.Silver);
    expect(coinTier(kuna, 50)).toBe(CoinTier.Silver);
    expect(coinTier(kuna, 100)).toBe(CoinTier.Gold);
    expect(coinTier(kuna, 500)).toBe(CoinTier.Gold);
  });

  test("the euro's small change is copper where the others have none", () => {
    const euro = currencyOf(Currency.Euro);
    for (const value of [1, 2, 5]) expect(coinTier(euro, value)).toBe(CoinTier.Copper);
    for (const value of [10, 20, 50]) expect(coinTier(euro, value)).toBe(CoinTier.Silver);
    for (const value of [100, 200]) expect(coinTier(euro, value)).toBe(CoinTier.Gold);
  });

  // Three faces have to cover every coin in every currency, and the ladder
  // has to climb: a bigger coin never gets a lesser face than a smaller one.
  test("every coin has a face, and the faces never go backwards", () => {
    for (const currency of Object.values(CURRENCIES)) {
      const tiers = currency.denominations.map((coin) =>
        COIN_TIERS.indexOf(coinTier(currency, coin)),
      );
      expect(tiers.every((tier) => tier >= 0)).toBe(true);
      expect(tiers).toEqual([...tiers].sort((a, b) => a - b));
      // And all three are actually used somewhere, or one would be dead art.
      expect(new Set(tiers).size).toBeGreaterThan(1);
    }
  });
});
