// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

/**
 * Money the player counts out by hand — and money that exists nowhere else.
 *
 * This used to be real: Croatian kuna, Swiss francs, euros, on the argument
 * that practice with actual coins is worth more than practice with invented
 * ones. That argument loses to a simpler one. A game for children that shows
 * a euro price and asks them to put euros on a counter can be *read* as
 * asking for money, by a child or by an adult glancing over their shoulder,
 * and no amount of context inside the game undoes that reading. So the coins
 * here are **ducats and mites**, which are not anybody's money.
 *
 * They were suns and rays first, and playtesting said the children found
 * that confusing. The fault was picking *nature* words instead of *money*
 * words: "ray" does not read as a coin, so nothing about the pair says which
 * of the two is the small one, or that either of them is money at all. A
 * ducat and a mite both read as coins on sight, which is the whole job the
 * name has to do before a child can start counting with it — and both are
 * long dead everywhere, so neither is anybody's pocket money.
 *
 * What is deliberately kept is the *shape* of real money, because that is
 * the part being taught:
 *
 * - **a hundred minor units to the major one**, so the decimal point behaves
 *   the way it does on a real price tag;
 * - **a 1-2-5 ladder** of coins, which every real coin system uses and which
 *   is what makes counting out a sum greedily give the fewest coins;
 * - **amounts always in the minor unit**, never in fractions of the major
 *   one. A price is `1250`, not `12.5`: money is counted in whole coins, and
 *   floating point has no business anywhere near a total a child is being
 *   asked to check.
 *
 * The consequence is a rule rather than a coincidence: **every price must be
 * a whole number of the smallest coin.** `isPayable` states it and the price
 * table's own test enforces it.
 */

export interface CurrencyDefinition {
  /** Coin values in the minor unit, smallest first. */
  readonly denominations: readonly number[];
  readonly minorPerMajor: number;
  /** How a total is written: "12,50 sun". */
  readonly format: (minor: number) => string;
  /** How one coin is labelled on its own face: "20 mite", "2 ducat". */
  readonly coinLabel: (minor: number) => string;
}

/**
 * The whole ladder, and nothing missing from it.
 *
 * Real sets have gaps — a country drops its smallest coins to inflation, or
 * stops at two of the major unit because the next one up is a note. Those
 * gaps were worth honouring while the money was real. This money is not, so
 * it gets the complete 1-2-5 run: three coppers, three silvers, three golds,
 * and every price expressible down to the last ray.
 */
const COINS: readonly number[] = [1, 2, 5, 10, 20, 50, 100, 200, 500];

const MITES_PER_DUCAT = 100;

/**
 * What the coins are called.
 *
 * The same word in both languages, deliberately: a currency's name is a
 * proper noun, and translating it would mean two siblings on one tablet
 * looking at the same coin and calling it different things.
 */
export const MAJOR_NAME = "ducat";
export const MINOR_NAME = "mite";

function split(minor: number, per: number): { major: number; rest: number } {
  return { major: Math.floor(minor / per), rest: minor % per };
}

/**
 * Ducats and mites: a hundred mites to the ducat.
 *
 * Written the way a price tag is — the comma, then two digits, then the
 * unit — so the arithmetic looks like the arithmetic on a shelf.
 *
 * "Mite" carries its own size in the word: a mite of something is a tiny
 * amount of it, in ordinary English and in German's `Heller`, so a child can
 * work out which coin is the small one from the name rather than being told.
 */
export const CURRENCY: CurrencyDefinition = {
  denominations: COINS,
  minorPerMajor: MITES_PER_DUCAT,
  format: (minor) => {
    const { major, rest } = split(minor, MITES_PER_DUCAT);
    return `${major},${String(rest).padStart(2, "0")} ${MAJOR_NAME}`;
  },
  coinLabel: (minor) =>
    minor >= MITES_PER_DUCAT
      ? `${minor / MITES_PER_DUCAT} ${MAJOR_NAME}`
      : `${minor} ${MINOR_NAME}`,
};

/**
 * The three kinds of coin the art draws.
 *
 * A reading aid, not a claim about what any of these is struck from: a child
 * sorting change sorts it by size and colour before reading the number, and
 * three tiers is what a picture can carry.
 */
export const CoinTier = {
  Copper: "copper",
  Silver: "silver",
  Gold: "gold",
} as const;

export type CoinTier = (typeof CoinTier)[keyof typeof CoinTier];

export const COIN_TIERS: readonly CoinTier[] = [CoinTier.Copper, CoinTier.Silver, CoinTier.Gold];

/**
 * Which coin a value is drawn as: coppers below a tenth of a sun, gold from
 * a whole one up, silver in between.
 *
 * Stated as fractions of the major unit rather than as a list, so the ladder
 * means the same thing at every level: the gold coins are the ones worth a
 * whole sun or more.
 */
export function coinTier(currency: CurrencyDefinition, value: number): CoinTier {
  if (value >= currency.minorPerMajor) return CoinTier.Gold;
  if (value >= currency.minorPerMajor / 10) return CoinTier.Silver;
  return CoinTier.Copper;
}

/**
 * The most coins the money has.
 *
 * The shop's coin pad builds this many buttons once, so it has to come from
 * the coin table rather than from a number typed into the panel: a coin the
 * player cannot put down is a price they cannot reach.
 */
export const MOST_DENOMINATIONS: number = CURRENCY.denominations.length;

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
 * Greedy, which is optimal for a 1-2-5 ladder — and is how a person counts
 * out money anyway, biggest coin first. Returns an empty list for an amount
 * the coins cannot express, rather than a pile that is nearly right.
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
