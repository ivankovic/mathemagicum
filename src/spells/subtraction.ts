// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { type Rng, randInt } from "../world/rng";
import { type NumberLine, PLACES } from "./addition";
import { HARDEST_RUNG, type Rung, rungAt } from "./difficulty";

/**
 * The subtraction spell: the same number line, walked the other way.
 *
 * The growth spell adds and makes things grow. This one takes away, and what
 * it takes away is whatever is in the way — a tree, a boulder, an outcrop of
 * rock. That is the theme rule the design applies to every spell, read
 * backwards: the spell that subtracts is the one that removes.
 *
 * The method is deliberately identical. Break the number being taken into
 * its ones, tens and hundreds, jump *back* along the line by each in turn,
 * and read off where you land. A child who can do one can do the other, and
 * the parchment they do it on is the same parchment — it reads the direction
 * off the stops rather than being told, so the sign over the line can never
 * disagree with the arithmetic underneath it.
 *
 * **Borrowing is what crossing means here.** On a number line, addition's
 * carry is "the jump crossed a ten going up"; subtraction's borrow is the
 * same crossing coming down. It is the same dial and the same rung, so a
 * child who is not being given carries is not given borrows either.
 */

export interface SubtractionProblem extends NumberLine {
  /** The number taken away from the start. */
  readonly taken: number;
}

/**
 * What each amount may be taken from, counted rather than listed.
 *
 * The mirror of addition's `Pairs`, and it lost its list of starts for the
 * same reason: the list is a table of every problem the spell can set, which
 * at three places nobody noticed and at six places cannot be built. The
 * weight is a count and the k-th start is arithmetic. See `startsFor`.
 */
interface Pairs {
  readonly taken: readonly number[];
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

const PAIRS = new Map<string, Pairs>();

function digitsOf(value: number, places: number): number[] {
  const out: number[] = [];
  for (let at = 0; at < places; at++) out.push(Math.floor(value / 10 ** at) % 10);
  return out;
}

/**
 * How high the number being taken *from* may go.
 *
 * The mirror of addition's `sumCeiling`, and it exists for the same one
 * case. At a single place, "crossing" has nothing to cross: 7 − 5 borrows
 * from nowhere, so the rung would be identical to the one below it. What
 * bridging ten actually looks like coming down is a start above ten — 12 − 5
 * — which is exactly the reflection of addition's 7 + 5 = 12.
 */
function startCeiling(places: number, crossing: boolean): number {
  const most = 10 ** places - 1;
  return crossing && places === 1 ? most * 2 : most;
}

/**
 * Whether every jump lands without borrowing.
 *
 * Digit by digit: you can take this place's digit away without reaching into
 * the one above it. Far more restrictive than addition's rule, which only
 * asks that two digits not overflow — so the pair counts are checked in the
 * tests rather than assumed.
 */
function noJumpBorrows(startDigits: readonly number[], takenDigits: readonly number[]): boolean {
  return takenDigits.every((digit, at) => digit <= (startDigits[at] ?? 0));
}

/**
 * How many starts an amount may be taken from, and what the k-th of them is.
 *
 * Two shapes, one per rule, and both closed form — the mirror of addition's,
 * with the harder rule on the other side.
 *
 * **Borrowing** constrains nothing place by place, so what is left is the
 * run from the smallest number of this width up to the ceiling, with
 * anything that would land on nought or below cut off the bottom of it.
 * Contiguous, so the count is a subtraction and the k-th is an addition.
 *
 * **Not borrowing** constrains each place on its own — `s >= d` there, and
 * nowhere else — so the places are independent and the count is their
 * product. One start is then struck out: the one whose every digit equals
 * the amount's, which is the amount itself, and which would land on nought.
 * It is the *smallest* of them, so striking it out is a shift of one, and
 * the k-th start is the (k+1)-th mixed-radix number.
 *
 * The top place needs no exception here. Its digit is at least the amount's,
 * which is never nought, so a number of the right width comes out for free.
 */
function startsFor(
  places: number,
  crossing: boolean,
  amount: number,
  takenDigits: readonly number[],
): number {
  const low = places === 1 ? 1 : 10 ** (places - 1);
  const ceiling = startCeiling(places, crossing);
  if (crossing) return Math.max(0, ceiling - Math.max(low, amount + 1) + 1);
  let count = 1;
  for (let at = 0; at < places; at++) count *= 10 - (takenDigits[at] ?? 0);
  // Less the amount itself, which is the one start that leaves nothing.
  return Math.max(0, count - 1);
}

/** The k-th start, counting from the smallest. See `startsFor`. */
function nthStart(
  places: number,
  crossing: boolean,
  amount: number,
  takenDigits: readonly number[],
  k: number,
): number {
  const low = places === 1 ? 1 : 10 ** (places - 1);
  if (crossing) return Math.max(low, amount + 1) + k;
  // Shifted past the amount itself, which is the smallest and is struck out.
  let rest = k + 1;
  let start = 0;
  for (let at = places - 1; at >= 0; at--) {
    let below = 1;
    for (let under = at - 1; under >= 0; under--) below *= 10 - (takenDigits[under] ?? 0);
    const step = Math.floor(rest / below);
    rest -= step * below;
    start += ((takenDigits[at] ?? 0) + step) * 10 ** at;
  }
  return start;
}

function pairsFor(places: number, crossing: boolean): Pairs {
  const key = `${places}:${crossing}`;
  const cached = PAIRS.get(key);
  if (cached) return cached;

  const low = places === 1 ? 1 : 10 ** (places - 1);
  const high = 10 ** places - 1;
  const taken: number[] = [];
  const weights: number[] = [];

  for (let amount = low; amount <= high; amount++) {
    // No zero digit in what is taken, for the reason the addend has none: a
    // `−0` jump lands where it started, and an arrow pointing back at the
    // number it came from reads as a piece missing rather than as an easy one.
    const takenDigits = digitsOf(amount, places);
    if (takenDigits.some((digit) => digit === 0)) continue;
    const count = startsFor(places, crossing, amount, takenDigits);
    if (count === 0) continue;
    taken.push(amount);
    weights.push(count);
  }

  const pairs: Pairs = {
    taken,
    weights,
    running: runningTotals(weights),
    total: weights.reduce((sum, weight) => sum + weight, 0),
  };
  PAIRS.set(key, pairs);
  return pairs;
}

/** `nthStart`, for the test that checks the counting against counting. */
export function nthStartForTest(
  places: number,
  crossing: boolean,
  amount: number,
  k: number,
): number {
  return nthStart(places, crossing, amount, digitsOf(amount, places), k);
}

/** How many pairs a rung can draw from. Used by the tests, and worth asking. */
export function pairCountFor(places: number, crossing: boolean): number {
  return pairsFor(places, crossing).total;
}

/**
 * A problem at one difficulty.
 *
 * Drawn uniformly over the pairs that actually exist rather than over the
 * amounts that happen to be legal — the same correction addition needed, and
 * it matters more here: no-borrow leaves a large subtrahend almost nowhere to
 * start from, so weighting by amount would push every problem into the high
 * end of the range.
 */
export function makeSubtractionProblem(
  rng: Rng,
  rung: Rung = rungAt(HARDEST_RUNG),
): SubtractionProblem {
  const pairs = pairsFor(rung.places, rung.crossing);
  const index = ticketAt(pairs.running, randInt(rng, 1, pairs.total));
  const amount = pairs.taken[index] as number;
  // Uniform over the starts this amount leaves, without ever building the
  // list of them: the k-th is arithmetic. See `nthStart`.
  const count = pairs.weights[index] as number;
  const start = nthStart(
    rung.places,
    rung.crossing,
    amount,
    digitsOf(amount, rung.places),
    randInt(rng, 0, count - 1),
  );
  return subtractionFor(start, amount, rung.places);
}

/**
 * The same problem from a chosen pair — used by tests and worked examples.
 *
 * As wide as what is taken away, for the reason addition's is as wide as its
 * addend: one jump per digit. See `problemFor`.
 */
export function subtractionFor(
  start: number,
  taken: number,
  places = String(taken).length,
): SubtractionProblem {
  const jumps = Array.from(
    { length: places },
    (_, at) => (Math.floor(taken / 10 ** at) % 10) * 10 ** at,
  );
  const stops: number[] = [];
  let at = start;
  for (const jump of jumps) {
    at -= jump;
    stops.push(at);
  }
  return { start, taken, jumps, stops };
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
