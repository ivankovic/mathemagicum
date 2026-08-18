// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

/**
 * Money the player counts out by hand.
 *
 * Two real currencies, chosen by the language the game is being read in:
 * Croatian kuna for English, Swiss francs for German. Real coins, because
 * the point of the shop is practice at handling actual money and a made-up
 * set of denominations would teach a made-up skill.
 *
 * **Amounts are always in the minor unit** — lipa, rappen — and never in
 * fractions of the major one. A price is `1250`, not `12.5`: money is
 * counted in whole coins, and floating point has no business anywhere near a
 * total the player is being asked to check.
 *
 * The two coin sets turned out to be the same shape, which was worth
 * checking rather than assuming. Both run 5, 10, 20, 50, 100, 200, 500.
 * Switzerland withdrew its 1 rappen in 2007 and its 2 rappen in 1978, so
 * five is genuinely the smallest coin there. Croatia kept 1 and 2 lipa as
 * legal tender to the end but stopped minting them for circulation in 2009,
 * and they are listed among the coins nobody used — as is the 25 kuna, a
 * commemorative piece. Including them would make the game teach a handful of
 * change a Croatian would never have been given.
 *
 * The consequence is a rule rather than a coincidence: **every price must be
 * a whole number of the smallest coin.** `isPayable` states it and the price
 * table's own test enforces it.
 */

export const Currency = {
  Kuna: "kuna",
  Franc: "franc",
  Euro: "euro",
} as const;

export type Currency = (typeof Currency)[keyof typeof Currency];

export interface CurrencyDefinition {
  readonly code: Currency;
  /** Coin values in the minor unit, smallest first. */
  readonly denominations: readonly number[];
  readonly minorPerMajor: number;
  /** How a total is written: "12,50 kn", "CHF 12.50". */
  readonly format: (minor: number) => string;
  /** How one coin is labelled on its own face: "20 lp", "2 Fr.". */
  readonly coinLabel: (minor: number) => string;
}

// Kuna and francs, smallest first. Identical by coincidence of how coin
// systems are designed, not by copying one from the other.
const COINS: readonly number[] = [5, 10, 20, 50, 100, 200, 500];

/**
 * The euro, which is a different shape and worth having for it.
 *
 * It keeps its 1 and 2 cent pieces, so the smallest coin is a single minor
 * unit and a price can be any whole number of them — the other two round to
 * five. And it stops at 2 €, because 5 € is a note: paying 25 € in coins
 * means counting out thirteen of them, which is why the shop works out how
 * many of a thing it can sell rather than assuming ten always fits.
 */
const EURO_COINS: readonly number[] = [1, 2, 5, 10, 20, 50, 100, 200];

function split(minor: number, per: number): { major: number; rest: number } {
  return { major: Math.floor(minor / per), rest: minor % per };
}

export const CURRENCIES: Record<Currency, CurrencyDefinition> = {
  [Currency.Kuna]: {
    code: Currency.Kuna,
    denominations: COINS,
    minorPerMajor: 100,
    // Croatian writes the decimal with a comma and the unit after the
    // number, which is the form a player would see on a price tag.
    format: (minor) => {
      const { major, rest } = split(minor, 100);
      return `${major},${String(rest).padStart(2, "0")} kn`;
    },
    coinLabel: (minor) => (minor >= 100 ? `${minor / 100} kn` : `${minor} lp`),
  },
  [Currency.Franc]: {
    code: Currency.Franc,
    denominations: COINS,
    minorPerMajor: 100,
    format: (minor) => {
      const { major, rest } = split(minor, 100);
      return `CHF ${major}.${String(rest).padStart(2, "0")}`;
    },
    coinLabel: (minor) => (minor >= 100 ? `${minor / 100} Fr.` : `${minor} Rp.`),
  },
  [Currency.Euro]: {
    code: Currency.Euro,
    denominations: EURO_COINS,
    minorPerMajor: 100,
    // Comma and a trailing symbol: the form used across most of the euro
    // area, and the one a child in a German-speaking country would see on a
    // price tag. Not varied by the interface language — a coin looks the
    // same whichever language you are reading.
    format: (minor) => {
      const { major, rest } = split(minor, 100);
      return `${major},${String(rest).padStart(2, "0")} €`;
    },
    coinLabel: (minor) => (minor >= 100 ? `${minor / 100} €` : `${minor} ct`),
  },
};

/**
 * Which currency a language is shopping in.
 *
 * German gets francs, everything else gets kuna. Matched on the language
 * subtag alone, so `de-CH`, `de-AT` and a bare `de` all agree — a player
 * reading German in Austria is still reading the German the francs are
 * written in.
 */
export function currencyForLanguage(language: string | undefined): Currency {
  const tag = (language ?? "").toLowerCase();
  return tag === "de" || tag.startsWith("de-") ? Currency.Franc : Currency.Kuna;
}

/**
 * The three kinds of coin the art draws.
 *
 * A reading aid, not a claim about what any of these was really struck from:
 * a child sorting change sorts it by size and colour before reading the
 * number, and three tiers is what a picture can carry when one set of coins
 * has to serve three currencies.
 */
export const CoinTier = {
  Copper: "copper",
  Silver: "silver",
  Gold: "gold",
} as const;

export type CoinTier = (typeof CoinTier)[keyof typeof CoinTier];

export const COIN_TIERS: readonly CoinTier[] = [CoinTier.Copper, CoinTier.Silver, CoinTier.Gold];

/**
 * Which coin a value is drawn as: coppers below a tenth of the major unit,
 * gold from a whole one up, silver in between.
 *
 * Stated as fractions of the major unit rather than as a list per currency,
 * so a currency added later gets a sensible ladder without a table of its
 * own — and so the ladder means the same thing in each: the gold coins are
 * the ones worth a whole unit.
 */
export function coinTier(currency: CurrencyDefinition, value: number): CoinTier {
  if (value >= currency.minorPerMajor) return CoinTier.Gold;
  if (value >= currency.minorPerMajor / 10) return CoinTier.Silver;
  return CoinTier.Copper;
}

export function currencyOf(code: Currency): CurrencyDefinition {
  return CURRENCIES[code];
}

/**
 * The most coins any currency has.
 *
 * The shop's coin pad builds this many buttons once and re-labels them when
 * the currency changes, so it has to come from the coin tables rather than
 * from a number typed into the panel: a currency with one more denomination
 * than the pad expected would lose a coin, and a coin the player cannot put
 * down is a price they cannot reach.
 */
export const MOST_DENOMINATIONS: number = Math.max(
  ...Object.values(CURRENCIES).map((currency) => currency.denominations.length),
);

/** The smallest coin: the unit every price has to be a whole number of. */
export function smallestCoin(currency: CurrencyDefinition): number {
  return currency.denominations[0] as number;
}

/** Whether an amount can be paid at all with the coins that exist. */
export function isPayable(currency: CurrencyDefinition, minor: number): boolean {
  return Number.isInteger(minor) && minor > 0 && minor % smallestCoin(currency) === 0;
}

/**
 * The fewest coins that make an amount, largest first.
 *
 * Greedy, which is optimal for a 1-2-5 system like both of these — and is
 * how a person counts out money anyway, biggest coin first. Returns an empty
 * list for an amount the coins cannot express, rather than a pile that is
 * nearly right.
 */
export function coinsFor(currency: CurrencyDefinition, minor: number): number[] {
  if (!isPayable(currency, minor)) return [];
  const coins: number[] = [];
  let left = minor;
  for (const value of [...currency.denominations].reverse()) {
    while (left >= value) {
      coins.push(value);
      left -= value;
    }
  }
  return left === 0 ? coins : [];
}

/** What a pile of coins comes to. */
export function totalOf(coins: readonly number[]): number {
  return coins.reduce((sum, coin) => sum + coin, 0);
}
