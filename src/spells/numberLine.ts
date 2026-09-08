// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { type Rng, randInt } from "../world/rng";

/**
 * How a problem on the number line is drawn, whichever way the line runs.
 *
 * The addition and subtraction spells share the parchment and every line of
 * the machinery that answers a cast — see `NumberLine` in `addition.ts`. They
 * share nearly all of the machinery that *sets* one as well: both draw a pair
 * uniformly over the problems that exist, both count those problems rather
 * than listing them, and both find the k-th start by the same mixed-radix
 * read. What each spell owns is its digit rule — what one place of the start
 * may be, given the same place of the amount — and the run of starts its
 * crossing rule leaves.
 *
 * This file is the part neither spell owns. It used to be written out twice,
 * once per spell, differing in variable names and in nothing a reader would
 * want to be different, so a fix to one copy never reached the other. The
 * digit rules stay in the spells, where a reader asking "what counts as a
 * carry here" expects to find them.
 */

/**
 * The smallest and largest number of this width.
 *
 * At one place the smallest is one rather than nought: a start of nothing is
 * not a number of any width, and the rule for two and up would give it.
 */
export function widthOf(places: number): { low: number; high: number } {
  return { low: places === 1 ? 1 : 10 ** (places - 1), high: 10 ** places - 1 };
}

/**
 * How high the biggest number on the line may go: the sum going up, the
 * start coming down.
 *
 * At two and three places a crossing is *internal*: the tens spill into the
 * hundreds and the answer is still the same width. At one place there is
 * nothing above the ones for a carry to go into or a borrow to come from, so
 * `7 + 5` would be impossible and `7 − 5` would borrow from nowhere — the
 * rung would be identical to the one below it. Those rungs exist precisely to
 * teach bridging ten at that size, and what bridging ten looks like coming
 * down is a start above ten, `12 − 5`, the exact reflection of `7 + 5 = 12`.
 * So the number is allowed its second digit, and only there.
 */
export function ceilingFor(places: number, crossing: boolean): number {
  const most = 10 ** places - 1;
  return crossing && places === 1 ? most * 2 : most;
}

/** The digits of a number, smallest place first, padded to `places`. */
export function digitsOf(value: number, places: number): number[] {
  const out: number[] = [];
  for (let at = 0; at < places; at++) out.push(Math.floor(value / 10 ** at) % 10);
  return out;
}

/**
 * A spell's digit rule, worked out for one amount: at each place, the
 * smallest digit the start may have there and how many digits it may have.
 *
 * The places are independent under a no-crossing rule, which is what makes
 * the count a product and the k-th start a mixed-radix number. See
 * `countWithin` and `nthWithin`.
 */
export interface PlaceRule {
  readonly first: readonly number[];
  readonly span: readonly number[];
}

/** How many starts a rule allows: one choice per place, multiplied up. */
export function countWithin(rule: PlaceRule): number {
  return rule.span.reduce((count, span) => count * span, 1);
}

/**
 * The k-th start a rule allows, counting from the smallest.
 *
 * The product of the spans read as a mixed-radix number — most significant
 * place slowest — which is what makes the k-th here the same start as the
 * k-th of a list built by counting upwards.
 */
export function nthWithin(rule: PlaceRule, k: number): number {
  let rest = k;
  let start = 0;
  for (let at = rule.span.length - 1; at >= 0; at--) {
    let below = 1;
    for (let under = at - 1; under >= 0; under--) below *= rule.span[under] ?? 1;
    const step = Math.floor(rest / below);
    rest -= step * below;
    start += ((rule.first[at] ?? 0) + step) * 10 ** at;
  }
  return start;
}

/**
 * Every pair a spell may set at one difficulty, and how often each amount
 * should be drawn.
 *
 * Built per rung and cached, because the useful thing is not the list of
 * amounts but *how many valid starts each one leaves*. Drawing amounts
 * evenly and then picking a start inside whatever range is left skews the
 * start badly: a large addend leaves a narrow range, so an evenly drawn
 * addend squeezes every start into the low end. That happened once already —
 * it passed every correctness check and simply meant the player never saw a
 * large first number — and a no-crossing rule makes it far worse, since
 * `startDigit + addendDigit <= 9` leaves a big addend almost nowhere to
 * start from. Coming down it matters more still: no-borrow leaves a large
 * subtrahend almost nowhere to start from, so weighting by amount would push
 * every problem into the high end of the range.
 *
 * So the weight *is* the number of valid starts, and the pair comes out
 * uniform over the problems that actually exist rather than over the
 * amounts that happen to be legal.
 *
 * **Counted rather than listed.** This used to hold, for every amount, an
 * array of every start that worked — which is a table of every problem the
 * game can set, and at three places that is about half a million numbers and
 * nobody noticed. At six it is of the order of a hundred billion, and the
 * six-digit band could not have existed while this worked that way.
 *
 * It never needed the list. It needed the *count*, and a way to fetch the
 * k-th of them; both are arithmetic. See each spell's `startsFor` and
 * `nthStart`.
 */
export interface Pairs {
  /** Every amount the spell may jump by at this rung, ascending. */
  readonly amounts: readonly number[];
  /** How many starts each amount leaves. */
  readonly weights: readonly number[];
  /**
   * The weights added up as we go, for finding one without walking them.
   *
   * A running total rather than a scan. The scan was fine while a rung held
   * a few hundred addends and became half a million of them at six places —
   * every problem set walked the lot, in the tests and on a tablet.
   */
  readonly running: Float64Array;
  readonly total: number;
}

/** How many starts one amount leaves at a rung, in a spell's own counting. */
export type StartsFor = (
  places: number,
  crossing: boolean,
  amount: number,
  digits: readonly number[],
) => number;

/**
 * A spell's table of pairs, one per rung, built on first use and kept.
 *
 * Each spell gets its own table rather than a shared one keyed by spell,
 * because the same rung means a different set of problems in each — and a
 * cache that could hand addition's pairs to subtraction is a bug waiting for
 * a typo in a key.
 */
export function pairTable(startsFor: StartsFor): (places: number, crossing: boolean) => Pairs {
  const cache = new Map<string, Pairs>();
  return (places, crossing) => {
    const key = `${places}:${crossing}`;
    const cached = cache.get(key);
    if (cached) return cached;

    const { low, high } = widthOf(places);
    const amounts: number[] = [];
    const weights: number[] = [];

    for (let amount = low; amount <= high; amount++) {
      // No zero digit in the amount, whichever way it is jumped. A zero makes
      // one of the jumps a `+0` or `−0` that lands where it started, and an
      // arrow pointing back at the number it came from reads as a piece
      // missing from the puzzle rather than as an easy one.
      const digits = digitsOf(amount, places);
      if (digits.some((digit) => digit === 0)) continue;
      const count = startsFor(places, crossing, amount, digits);
      if (count === 0) continue;
      amounts.push(amount);
      weights.push(count);
    }

    const pairs: Pairs = {
      amounts,
      weights,
      running: runningTotals(weights),
      total: weights.reduce((sum, weight) => sum + weight, 0),
    };
    cache.set(key, pairs);
    return pairs;
  };
}

/**
 * One pair from the table: an amount drawn by weight, and which of its starts
 * to take.
 *
 * Uniform over the starts the amount leaves, without ever building the list
 * of them: `k` is an index and the k-th start is arithmetic. See each spell's
 * `nthStart`.
 */
export function drawPair(
  rng: Rng,
  pairs: Pairs,
  places: number,
): { amount: number; digits: number[]; k: number } {
  const index = ticketAt(pairs.running, randInt(rng, 1, pairs.total));
  const amount = pairs.amounts[index] as number;
  const count = pairs.weights[index] as number;
  return { amount, digits: digitsOf(amount, places), k: randInt(rng, 0, count - 1) };
}

/**
 * Which entry a ticket falls in, by halving rather than by walking.
 *
 * `running[i]` is the weight of everything up to and including `i`, so the
 * answer is the first entry whose running total reaches the ticket.
 */
function ticketAt(running: Float64Array, ticket: number): number {
  let low = 0;
  let high = running.length - 1;
  while (low < high) {
    const middle = (low + high) >> 1;
    if ((running[middle] as number) < ticket) low = middle + 1;
    else high = middle;
  }
  return low;
}

/** The weights added up as we go. See `ticketAt`. */
function runningTotals(weights: readonly number[]): Float64Array {
  const running = new Float64Array(weights.length);
  let sum = 0;
  for (const [at, weight] of weights.entries()) {
    sum += weight;
    running[at] = sum;
  }
  return running;
}
