// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { type Rng, randInt } from "../world/rng";
import {
  type AdditionCast,
  type BareSum,
  type NumberLine,
  UNKNOWNS,
  Unknown,
  bareLine,
} from "./addition";
import { BareForm, HARDEST_RUNG, type Rung, rungAt } from "./difficulty";
import {
  type PlaceRule,
  ceilingFor,
  countWithin,
  digitsOf,
  drawPair,
  nthWithin,
  pairTable,
  widthOf,
} from "./numberLine";

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
 * the k-th start is the (k+1)-th mixed-radix number. The reading is
 * `countWithin` and `nthWithin`; the rule they read is `noBorrow`.
 *
 * The top place needs no exception here. Its digit is at least the amount's,
 * which is never nought, so a number of the right width comes out for free.
 */
function noBorrow(places: number, takenDigits: readonly number[]): PlaceRule {
  const first: number[] = [];
  const span: number[] = [];
  for (let at = 0; at < places; at++) {
    const digit = takenDigits[at] ?? 0;
    first.push(digit);
    span.push(10 - digit);
  }
  return { first, span };
}

/** The smallest start a borrow may run from: this wide, and above the amount. */
function lowestFrom(places: number, amount: number): number {
  return Math.max(widthOf(places).low, amount + 1);
}

function startsFor(
  places: number,
  crossing: boolean,
  amount: number,
  takenDigits: readonly number[],
): number {
  if (crossing) {
    return Math.max(0, ceilingFor(places, crossing) - lowestFrom(places, amount) + 1);
  }
  // Less the amount itself, which is the one start that leaves nothing.
  return Math.max(0, countWithin(noBorrow(places, takenDigits)) - 1);
}

/** The k-th start, counting from the smallest. See `startsFor`. */
function nthStart(
  places: number,
  crossing: boolean,
  amount: number,
  takenDigits: readonly number[],
  k: number,
): number {
  if (crossing) return lowestFrom(places, amount) + k;
  // Shifted past the amount itself, which is the smallest and is struck out.
  return nthWithin(noBorrow(places, takenDigits), k + 1);
}

/** Every pair this spell may set, per rung. See `pairTable`. */
const pairsFor = pairTable(startsFor);

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
  const { amount, digits, k } = drawPair(rng, pairsFor(rung.places, rung.crossing), rung.places);
  const start = nthStart(rung.places, rung.crossing, amount, digits, k);
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

/**
 * One cast of the clearing spell, whichever form the rung asks for.
 *
 * The mirror of `additionCastFor`, and it exists for the reason that one
 * does: there are two forms of the problem now and the choice belongs in
 * one place rather than at each of the five sites that clear something.
 *
 * **`Rung.bare` used to be addition's alone**, and its own doc said why:
 * the two spells share this ladder — the same instrument walked two ways —
 * but taking the line off a subtraction was a separate decision nobody had
 * asked for. Somebody asked. Nothing about the ladder changes to allow it,
 * because the numbers were never the question: what a bare rung says is
 * *write it down instead of walking it*, and that sentence is as true of
 * taking away as of adding.
 */
export function subtractionCastFor(rng: Rng, rung: Rung): AdditionCast {
  if (rung.bare === undefined) {
    return { problem: makeSubtractionProblem(rng, rung), given: rung.given, bare: null };
  }
  const sum = makeBareSubtraction(rng, rung);
  return { problem: bareLine(sum), given: 0, bare: sum };
}

/**
 * A subtraction with the line taken off, out of the numbers this rung makes.
 *
 * Built from a real subtraction problem rather than by flipping an addition
 * one, so that what a child is shown here is drawn from the same table as
 * what she would have walked — a bare rung that invented its own numbers
 * would be a different ladder wearing this one's name.
 *
 * The triple is the problem read as an addition, because that is the form
 * `BareSum` keeps its invariant in: what is left, plus what was taken, is
 * what she started with. `takingAway` is what turns it back round on the
 * parchment.
 */
export function makeBareSubtraction(rng: Rng, rung: Rung): BareSum {
  const problem = makeSubtractionProblem(rng, rung);
  const end = problem.stops[problem.stops.length - 1] ?? problem.start - problem.taken;
  const unknown =
    rung.bare === BareForm.Any
      ? (UNKNOWNS[randInt(rng, 0, UNKNOWNS.length - 1)] as Unknown)
      : // `Total` in the addition reading is the number being taken *from*,
        // which is not the answer anybody means by "what is the result". The
        // result of a subtraction is what is left — `Start`.
        Unknown.Start;
  return { start: end, addend: problem.taken, total: problem.start, unknown, takingAway: true };
}
