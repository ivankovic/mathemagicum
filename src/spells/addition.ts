// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { EN } from "../i18n/en";
import type { Phrases } from "../i18n/phrases";
import { type Rng, randInt } from "../world/rng";
import { type CastResult, castResult } from "./cast";
import { HARDEST_RUNG, type Rung, rungAt } from "./difficulty";

/**
 * The addition spell: column addition, worked on a number line.
 *
 * The spell adds, and what it adds to is a plant — one cast moves a crop one
 * stage further along. That mapping is the point rather than a skin: the
 * design doc's rule is that a spell's effect mirrors its mathematics, so the
 * spell that adds is the one that makes things grow.
 *
 * The method being taught is *partial sums, smallest place first*: to work
 * out 347 + 265, jump along the line by the ones (+5), then the tens (+60),
 * then the hundreds (+200), and read off where you land. Three jumps, three
 * landings, and each landing is a number the player has to state. That is
 * what the three arrows on the parchment are.
 *
 * Deliberately no carrying step and no vertical layout. A number line makes
 * a carry visible as "the jump crossed a hundred" rather than as a small
 * digit written above a column, which is the whole reason to teach it this
 * way round first.
 */

/**
 * The most jumps a problem is ever broken into.
 *
 * A ceiling rather than a fixed count — how many a given problem actually
 * has is `problem.jumps.length`, which the difficulty sets. This is what the
 * parchment reserves room for.
 *
 * Six since the six-digit band, and the parchment does not simply draw six
 * of what it drew three of: at that width the boxes and the labels are sized
 * against how many there are. See `SpellPopup`.
 */
export const PLACES = 6;

// Re-exported so a caller that already has the spell does not need a second
// import for the shape of its own result.
export { type CastResult, castResult };

/**
 * A journey along the number line, whichever way it runs.
 *
 * The cast machinery below — typing, submitting, hinting, knowing when it is
 * finished — never asks *what* the jumps mean. It reads the stops and the
 * jumps and nothing else, which is why the subtraction spell can use every
 * line of it without a word of it moving: the two spells differ in how a
 * problem is *made*, not in how one is answered.
 */
export interface NumberLine {
  readonly start: number;
  /** What each jump moves by, smallest place first. */
  readonly jumps: readonly number[];
  /** Where each jump lands. The last is the answer. */
  readonly stops: readonly number[];
}

export interface AdditionProblem extends NumberLine {
  /** The number jumped along the line. */
  readonly addend: number;
}

/**
 * How far the whole journey moves: the jumps added up.
 *
 * Derived rather than carried, so the number written above the line and the
 * arrows drawn under it cannot disagree — and so anything drawing a line
 * needs to know only that it *is* one, not which spell made it.
 */
export function movedBy(problem: NumberLine): number {
  return problem.jumps.reduce((total, jump) => total + jump, 0);
}

/**
 * Whether the line runs down the page rather than up.
 *
 * Read off the stops instead of being passed in. A flag could be set wrong
 * and would then draw a subtraction with a plus over it; this cannot, because
 * it is the same arithmetic the boxes are checked against.
 */
export function runsDown(problem: NumberLine): boolean {
  const first = problem.stops[0];
  return first !== undefined && first < problem.start;
}

/**
 * Every pair the spell may set at one difficulty, and how often each addend
 * should be drawn.
 *
 * Built per rung and cached, because the useful thing is not the list of
 * addends but *how many valid starts each one leaves*. Drawing addends
 * evenly and then picking a start inside whatever range is left skews the
 * start badly: a large addend leaves a narrow range, so an evenly drawn
 * addend squeezes every start into the low end. That happened once already —
 * it passed every correctness check and simply meant the player never saw a
 * large first number — and a no-crossing rule makes it far worse, since
 * `startDigit + addendDigit <= 9` leaves a big addend almost nowhere to
 * start from.
 *
 * So the weight *is* the number of valid starts, and the pair comes out
 * uniform over the problems that actually exist rather than over the
 * addends that happen to be legal.
 *
 * **Counted rather than listed.** This used to hold, for every addend, an
 * array of every start that worked — which is a table of every problem the
 * game can set, and at three places that is about half a million numbers and
 * nobody noticed. At six it is of the order of a hundred billion, and the
 * six-digit band could not have existed while this worked that way.
 *
 * It never needed the list. It needed the *count*, and a way to fetch the
 * k-th of them; both are arithmetic. See `startsFor` and `nthStart`.
 */
interface Pairs {
  readonly places: number;
  readonly crossing: boolean;
  readonly addends: readonly number[];
  readonly weights: readonly number[];
  readonly total: number;
}

const PAIRS = new Map<string, Pairs>();

function digitsOf(value: number, places: number): number[] {
  const out: number[] = [];
  for (let at = 0; at < places; at++) out.push(Math.floor(value / 10 ** at) % 10);
  return out;
}

/**
 * How high the answer may go.
 *
 * At two and three places a carry is *internal*: the tens spill into the
 * hundreds and the answer is still the same width. At one place there is
 * nothing above the ones for a carry to go into, so `7 + 5` would be
 * impossible — and that rung exists precisely to teach bridging ten at that
 * size — so the answer is allowed its second digit, and only there.
 */
function sumCeiling(places: number, crossing: boolean): number {
  const most = 10 ** places - 1;
  return crossing && places === 1 ? most * 2 : most;
}

/**
 * How many starts an addend leaves, and what the k-th of them is.
 *
 * Two shapes, one per rule, and both are closed form.
 *
 * **Crossing** constrains nothing digit by digit — a jump may carry — so the
 * only rule left is that the answer fits. The starts are the whole run from
 * the smallest number of this width up to `ceiling - addend`: contiguous, so
 * the count is a subtraction and the k-th is an addition.
 *
 * **Not crossing** constrains each place on its own: `s + d <= 9` there and
 * nowhere else. The places are independent, so the count is their product,
 * and the k-th start in counting order is that product read as a mixed-radix
 * number — most significant place slowest, which is what makes the k-th here
 * the same start as the k-th of a list built by counting upwards.
 *
 * The top place is the one exception, and it is the same exception in both:
 * its digit cannot be nought, or the number would not be this wide.
 */
function startsFor(
  places: number,
  crossing: boolean,
  addend: number,
  addendDigits: readonly number[],
): number {
  const low = places === 1 ? 1 : 10 ** (places - 1);
  const high = 10 ** places - 1;
  if (crossing) {
    return Math.max(0, Math.min(high, sumCeiling(places, crossing) - addend) - low + 1);
  }
  let count = 1;
  for (let at = 0; at < places; at++) {
    const digit = addendDigits[at] ?? 0;
    // The top place may not start at nought; every other place may.
    count *= at === places - 1 ? 9 - digit : 10 - digit;
  }
  return Math.max(0, count);
}

/**
 * The k-th start, counting from the smallest. See `startsFor`.
 *
 * Exported under a second name for the test that checks it against counting,
 * which is the only thing outside this file with any business knowing that
 * starts have an order at all.
 */
function nthStart(
  places: number,
  crossing: boolean,
  addend: number,
  addendDigits: readonly number[],
  k: number,
): number {
  const low = places === 1 ? 1 : 10 ** (places - 1);
  if (crossing) return low + k;
  const span = (at: number) => (at === places - 1 ? 9 : 10) - (addendDigits[at] ?? 0);
  const first = (at: number) => (at === places - 1 ? 1 : 0);
  let rest = k;
  let start = 0;
  for (let at = places - 1; at >= 0; at--) {
    let below = 1;
    for (let under = at - 1; under >= 0; under--) below *= span(under);
    const step = Math.floor(rest / below);
    rest -= step * below;
    start += (first(at) + step) * 10 ** at;
  }
  return start;
}

function pairsFor(places: number, crossing: boolean): Pairs {
  const key = `${places}:${crossing}`;
  const cached = PAIRS.get(key);
  if (cached) return cached;

  const low = places === 1 ? 1 : 10 ** (places - 1);
  const high = 10 ** places - 1;
  const addends: number[] = [];
  const weights: number[] = [];

  for (let addend = low; addend <= high; addend++) {
    // No zero digit in the addend. A zero makes one of the jumps a `+0` that
    // lands where it started, and an arrow pointing back at the number it
    // came from reads as a piece missing from the puzzle rather than as an
    // easy one.
    const addendDigits = digitsOf(addend, places);
    if (addendDigits.some((digit) => digit === 0)) continue;
    const count = startsFor(places, crossing, addend, addendDigits);
    if (count === 0) continue;
    addends.push(addend);
    weights.push(count);
  }

  const pairs: Pairs = {
    places,
    crossing,
    addends,
    weights,
    total: weights.reduce((sum, weight) => sum + weight, 0),
  };
  PAIRS.set(key, pairs);
  return pairs;
}

/** How many pairs a rung can draw from. Worth asking, and worth testing. */
export function additionPairCount(places: number, crossing: boolean): number {
  return pairsFor(places, crossing).total;
}

/**
 * Whether every jump lands without carrying.
 *
 * On a number line a carry is "the jump crossed a ten", which is exactly
 * what makes column addition hard — and it is a step a child takes long
 * after they can add two digits at all. So it is a dial of its own rather
 * than something bundled into how big the numbers are.
 */
function noJumpCrosses(startDigits: readonly number[], addendDigits: readonly number[]): boolean {
  return startDigits.every((digit, at) => digit + (addendDigits[at] ?? 0) <= 9);
}

/**
 * A problem at one difficulty.
 *
 * The rung says how many places, and whether the jumps may carry. What it
 * does *not* change is the method: the same partial sums in the same order,
 * on a number line that is simply shorter.
 */
export function makeAdditionProblem(rng: Rng, rung: Rung = rungAt(HARDEST_RUNG)): AdditionProblem {
  const pairs = pairsFor(rung.places, rung.crossing);
  let ticket = randInt(rng, 1, pairs.total);
  let index = pairs.addends.length - 1;
  for (const [at, weight] of pairs.weights.entries()) {
    ticket -= weight;
    if (ticket <= 0) {
      index = at;
      break;
    }
  }
  const addend = pairs.addends[index] as number;
  // Uniform over the starts this addend leaves, without ever building the
  // list of them: the k-th is arithmetic. See `nthStart`.
  const count = pairs.weights[index] as number;
  const start = nthStart(
    rung.places,
    rung.crossing,
    addend,
    digitsOf(addend, rung.places),
    randInt(rng, 0, count - 1),
  );
  return problemFor(start, addend, rung.places);
}

/**
 * The same problem from a chosen pair — used by tests and worked examples.
 *
 * How many places it has comes from the addend by default, because that is
 * what the addend *is*: one jump per digit of it. It used to default to
 * `PLACES`, which was the same number for as long as the parchment's ceiling
 * and the shipped example's width were both three — and the moment the
 * ceiling went to six, every worked example in the game silently grew three
 * empty jumps of `+0` on the front.
 */
export function problemFor(
  start: number,
  addend: number,
  places = String(addend).length,
): AdditionProblem {
  const jumps = Array.from(
    { length: places },
    (_, at) => (Math.floor(addend / 10 ** at) % 10) * 10 ** at,
  );
  const stops: number[] = [];
  let at = start;
  for (const jump of jumps) {
    at += jump;
    stops.push(at);
  }
  return { start, addend, jumps, stops };
}

/**
 * How far the player has got, and what they have typed into the box they are
 * on.
 *
 * One box is live at a time and the entry only advances on a correct answer,
 * which is what enforces "ones first, then tens, then hundreds" — the order
 * is the lesson, so being able to fill in the hundreds box first would skip
 * it. `attempts` is counted per box and never used to punish: it exists so
 * the parchment can offer the next hint, in the spirit of the design doc's
 * "learning over gating".
 */
export interface CastState {
  readonly problem: NumberLine;
  /** Which jump is being answered. Equal to the number of jumps when solved. */
  readonly index: number;
  /** The digits typed into the live box, as typed. */
  readonly entry: string;
  /** Answers already accepted, one per solved jump. */
  readonly solved: readonly number[];
  /** Wrong answers submitted for the live box. Reset when it is solved. */
  readonly attempts: number;
  /**
   * Wrong answers submitted across the whole cast, never reset.
   *
   * `attempts` cannot answer "did they get this one straight away" because
   * it is cleared every time a box is solved, so a cast that took four tries
   * on the tens and then sailed through looks identical to a perfect one by
   * the time it ends. This is the number the difficulty listens to — and,
   * like `attempts`, it is never used to punish: nothing about a cast fails,
   * and a run of clean ones only ever makes the next sums a little bigger.
   */
  readonly missteps: number;
  /** Set when the last submission was wrong, so the box can be marked. */
  readonly wrong: boolean;
}

/**
 * Start a cast, with the first `given` jumps already worked out.
 *
 * Scaffolding is done by pre-solving rather than by drawing a hint: the
 * boxes the child is not being asked for hold the right answer, in the same
 * ink as the ones they have solved themselves, so a partially solved problem
 * looks like a problem they are part-way through rather than like a problem
 * with pieces missing.
 */
export function beginCast(problem: NumberLine, given = 0): CastState {
  const ahead = Math.max(0, Math.min(given, problem.jumps.length - 1));
  return {
    problem,
    index: ahead,
    entry: "",
    solved: problem.stops.slice(0, ahead),
    attempts: 0,
    missteps: 0,
    wrong: false,
  };
}

export function isSolved(state: CastState): boolean {
  return state.index >= state.problem.jumps.length;
}

/**
 * How many digits the live box will take.
 *
 * Measured from the answer rather than fixed at three: at one place the
 * biggest stop is 18, and a box that accepted `184` there would let a child
 * type a number the line has no room for. Capping is friendlier than
 * accepting and failing — the box simply stops taking digits while what they
 * meant is still readable.
 */
function maxDigits(state: CastState): number {
  // The *biggest* stop, not the last one. Going up the line they are the
  // same; coming down they are not, and a subtraction that ends in single
  // figures would have stopped taking the third digit of its first answer
  // half way along.
  const widest = Math.max(0, ...state.problem.stops);
  return String(widest).length;
}

export function typeDigit(state: CastState, digit: number): CastState {
  if (isSolved(state)) return state;
  if (!Number.isInteger(digit) || digit < 0 || digit > 9) return state;
  // A leading zero is dropped rather than rejected: no stop on this line
  // starts with one, and silently swallowing the keystroke reads as a broken
  // button.
  if (state.entry === "" && digit === 0) return state;
  if (state.entry.length >= maxDigits(state)) return state;
  // Clearing `wrong` on the next keystroke is what makes the mark on the box
  // read as "that answer was wrong" rather than as a permanent state.
  return { ...state, entry: state.entry + String(digit), wrong: false };
}

export function backspace(state: CastState): CastState {
  if (isSolved(state) || state.entry === "") return state;
  return { ...state, entry: state.entry.slice(0, -1), wrong: false };
}

/**
 * Check the live box.
 *
 * A wrong answer clears the box and counts an attempt; it never ends the
 * cast. There is no fail state here on purpose — the spell is how the player
 * gardens, and a garden that locks you out for arithmetic would make the
 * math a gate, which is the one thing the design pillars rule out.
 */
export function submit(state: CastState): CastState {
  if (isSolved(state) || state.entry === "") return state;
  const expected = state.problem.stops[state.index];
  if (expected === undefined) return state;
  if (Number(state.entry) !== expected) {
    return {
      ...state,
      entry: "",
      attempts: state.attempts + 1,
      missteps: state.missteps + 1,
      wrong: true,
    };
  }
  return {
    ...state,
    index: state.index + 1,
    entry: "",
    solved: [...state.solved, expected],
    attempts: 0,
    wrong: false,
  };
}

/**
 * A nudge for the box the player is stuck on, or null while they are doing
 * fine.
 *
 * Escalates with attempts and stops short of the answer: the second hint
 * names the two numbers being added, which is the whole of the method, and
 * saying the result outright would turn the spell into a button.
 */
export function hintFor(state: CastState, words: Phrases = EN): string | null {
  if (isSolved(state) || state.attempts === 0) return null;
  const from = state.index === 0 ? state.problem.start : state.problem.stops[state.index - 1];
  const jump = state.problem.jumps[state.index];
  if (from === undefined || jump === undefined) return null;
  if (state.attempts === 1) return words.addPlace(state.index, from);
  return words.sumQuestion(from, jump);
}

/** `nthStart`, for the test that checks the counting against counting. */
export function nthStartForTest(
  places: number,
  crossing: boolean,
  addend: number,
  k: number,
): number {
  return nthStart(places, crossing, addend, digitsOf(addend, places), k);
}
