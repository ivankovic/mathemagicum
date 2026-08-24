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
 * Four coins: the ones the shop can actually ask for.
 *
 * It was nine — the complete 1-2-5 run from one mite to five ducats — on the
 * argument that a full ladder makes every price expressible. Then somebody
 * counted what the prices are. Everything in the store is priced in *crops*,
 * a crop fetches 100, 150 or 250 depending on the band, and so **every
 * amount that changes hands in this game is a whole number of fifty mites.**
 * The 1, the 2, the 5, the 10 and the 20 could not come up. Five of the nine
 * coins were furniture.
 *
 * That was survivable while paying was a keypad, where an unused button is
 * only an unused button. It is not survivable now that the coins are piles
 * on a table a child drags from: five piles that can never be part of any
 * answer are five wrong turns, and the table has only so much room for a
 * finger.
 *
 * So the ladder is trimmed to the top four rungs rather than rebuilt — these
 * are still four consecutive steps of the same 1-2-5 run, which is what
 * keeps counting out a sum greedily give the fewest coins. What is lost is
 * the ability to price something at 2,75; nothing does, and `isPayable` says
 * so out loud if anything ever tries.
 */
const COINS: readonly number[] = [50, 100, 200, 500];

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
 * The most coins the money has.
 *
 * The shop's table builds this many piles once, so it has to come from the
 * coin table rather than from a number typed into the panel: a coin the
 * player cannot put down is a price they cannot reach.
 */
export const MOST_DENOMINATIONS: number = CURRENCY.denominations.length;

/** The smallest coin: the unit every price has to be a whole number of. */
export function smallestCoin(currency: CurrencyDefinition): number {
  return currency.denominations[0] as number;
}

/** The biggest coin: the face the game shows when it means "money". */
export function largestCoin(currency: CurrencyDefinition): number {
  return currency.denominations[currency.denominations.length - 1] as number;
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

export interface Stack {
  readonly value: number;
  readonly count: number;
}

/**
 * A handful of coins gathered into piles, one per denomination.
 *
 * What a pile of money *is* once there is too much of it to count one coin
 * at a time. Forty coins laid out singly is a picture a child checks by
 * counting to forty, which is not the exercise and does not work anyway —
 * the shopkeeper is a coin or two out one time in ten, and one coin missing
 * from forty is invisible. The same money as "six piles of five ducats" is
 * checked by multiplying, which is arithmetic that holds at any size.
 *
 * Largest first, the order she counts them out in and the order the loose
 * coins they replace are already in.
 */
export function stacksOf(coins: readonly number[]): Stack[] {
  const counts = new Map<number, number>();
  for (const coin of coins) counts.set(coin, (counts.get(coin) ?? 0) + 1);
  return [...counts.entries()]
    .sort(([a], [b]) => b - a)
    .map(([value, count]) => ({ value, count }));
}

/** What a pile of coins comes to. */
export function totalOf(coins: readonly number[]): number {
  return coins.reduce((sum, coin) => sum + coin, 0);
}
