// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { EN } from "../i18n/en";
import type { Phrases } from "../i18n/phrases";
import { type Rng, randInt } from "../world/rng";
import { type CastResult, castResult } from "./cast";
import { BareForm, HARDEST_RUNG, type Rung, rungAt } from "./difficulty";

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
    running: runningTotals(weights),
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
  const index = ticketAt(pairs.running, randInt(rng, 1, pairs.total));
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
 * Which of the three terms is the box.
 *
 * `A + B = C` has three numbers in it and only ever one of them missing,
 * and which one changes what is being asked. Finding `C` is adding. Finding
 * `A` or `B` is *undoing* an addition, which is the same thing subtraction
 * does and is the first time this game asks for it from the addition side.
 */
export const Unknown = {
  /** `A + B = ?` — the sum, where it always was. */
  Total: "total",
  /** `A + ? = C` — the second term. */
  Addend: "addend",
  /** `? + B = C` — the first. */
  Start: "start",
} as const;

export type Unknown = (typeof Unknown)[keyof typeof Unknown];

export const UNKNOWNS: readonly Unknown[] = Object.values(Unknown);

/**
 * A sum with the number line taken away, and one of its terms hidden.
 *
 * All three numbers are carried, whichever one is being asked for, because
 * *drawing* the equation needs the other two and there is no sense in which
 * the hidden one is unknown to the game. `start + addend === total` is an
 * invariant of this type, not something a caller arranges.
 */
export interface BareSum {
  readonly start: number;
  readonly addend: number;
  readonly total: number;
  readonly unknown: Unknown;
}

/** The number the child has to type. */
export function bareAnswer(sum: BareSum): number {
  if (sum.unknown === Unknown.Total) return sum.total;
  return sum.unknown === Unknown.Addend ? sum.addend : sum.start;
}

/**
 * The equation as it is written on the parchment.
 *
 * `filled` is what stands in the hidden term's place — a question mark while
 * it is being asked, the answer once it has been got. Built here rather than
 * in the panel that draws it so it can be tested, and because "which slot is
 * blank" is arithmetic about the sum rather than a fact about a font.
 *
 * No words in it, in any language: an equation is the same sentence
 * everywhere, which is the same reason `sumQuestion` is shared.
 */
export function bareSumText(sum: BareSum, filled: string): string {
  const start = sum.unknown === Unknown.Start ? filled : String(sum.start);
  const addend = sum.unknown === Unknown.Addend ? filled : String(sum.addend);
  const total = sum.unknown === Unknown.Total ? filled : String(sum.total);
  return `${start} + ${addend} = ${total}`;
}

/**
 * The one-box cast a bare sum is answered through.
 *
 * A *degenerate* number line, and deliberately so rather than a second
 * machinery beside the first. Everything that types digits, submits them,
 * counts missteps and knows when a cast is finished works by comparing what
 * was typed against `stops[index]` — it never asks what the line means. So a
 * one-jump line whose only stop is the answer gets all of it for nothing,
 * and what is genuinely new about a bare sum stays where it belongs, which
 * is in what gets *drawn*.
 *
 * It starts at nought because a bare sum has no journey. Reading the line
 * would say "from nothing, move by the answer, arrive at the answer", which
 * is true and is also why nothing draws it.
 */
export function bareLine(sum: BareSum): NumberLine {
  const answer = bareAnswer(sum);
  return { start: 0, jumps: [answer], stops: [answer] };
}

/** Whether a cast is being run on one of those rather than on a real line. */
export function isBareLine(problem: NumberLine): boolean {
  return problem.start === 0 && problem.jumps.length === 1;
}

/**
 * A bare sum at one difficulty.
 *
 * The pair is drawn exactly as the number line's is — same weighted table,
 * same reasoning about why an evenly drawn addend skews the start — because
 * what changes at these rungs is how a sum is *put*, not which sums exist.
 * A bare rung that drew its numbers some other way would be a different
 * ladder wearing the same one's name.
 *
 * `Total` asks for the sum. `Any` draws one of the three uniformly, so two
 * casts in three are the undoing kind — which is the point of that rung, and
 * why it is the harder of each pair.
 */
export function makeBareSum(rng: Rng, rung: Rung = rungAt(HARDEST_RUNG)): BareSum {
  const problem = makeAdditionProblem(rng, rung);
  const total = problem.stops[problem.stops.length - 1] ?? problem.start + problem.addend;
  const unknown =
    rung.bare === BareForm.Any
      ? (UNKNOWNS[randInt(rng, 0, UNKNOWNS.length - 1)] as Unknown)
      : Unknown.Total;
  return { start: problem.start, addend: problem.addend, total, unknown };
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
 * One cast of the addition spell, whichever form the rung asks for.
 *
 * Both places that cast this spell used to build a problem and read
 * `rung.given` themselves, which was fine while there was one form of a
 * problem. There are two now, and the second needs a different `given`, a
 * different line and an extra thing handed to the parchment — so the choice
 * is made once, here, and a third form later changes one function rather
 * than two call sites and whatever the next one is.
 */
export interface AdditionCast {
  readonly problem: NumberLine;
  readonly given: number;
  /** Set when this rung asks for a bare sum; null when it asks for a line. */
  readonly bare: BareSum | null;
}

export function additionCastFor(rng: Rng, rung: Rung): AdditionCast {
  if (rung.bare === undefined) {
    return { problem: makeAdditionProblem(rng, rung), given: rung.given, bare: null };
  }
  const sum = makeBareSum(rng, rung);
  // Nought given, always: a bare sum is one box, and there is nothing to
  // arrive already done. `beginCast` would clamp it anyway; saying it here
  // is what stops a reader wondering whether the rung's `given` was missed.
  return { problem: bareLine(sum), given: 0, bare: sum };
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
  // A bare sum is answered through a degenerate line whose one jump *is* the
  // answer, so the second hint here would have read `0 + 612538 = ?` and
  // handed it over. Refused rather than patched: this function reads a line
  // and a bare sum has none. `bareHintFor` is the one that knows the three
  // numbers and can say something useful about them.
  if (isBareLine(state.problem)) return null;
  const from = state.index === 0 ? state.problem.start : state.problem.stops[state.index - 1];
  const jump = state.problem.jumps[state.index];
  if (from === undefined || jump === undefined) return null;
  if (state.attempts === 1) return words.addPlace(state.index, from);
  return words.sumQuestion(from, jump);
}

/**
 * The hint for a bare sum, which needs the numbers rather than the line.
 *
 * Two, like the line's own. The first says how to start; the second turns
 * the question into one the child can already answer.
 *
 * **For a missing addend that second hint is a subtraction**, and showing it
 * is the whole lesson: `? + 265382 = 612538` is undone by taking the term
 * you have off the total. It is also the only place in this spell that draws
 * a minus sign, which is right — undoing an addition is what the clearing
 * spell does, and a child who sees the two are the same instrument can do
 * every version of this.
 *
 * The first hint for a missing addend is deliberately *not* "break it into
 * places". That is the method for adding, and a child who applies it to a
 * subtraction gets the wrong answer confidently.
 */
export function bareHintFor(sum: BareSum, attempts: number, words: Phrases = EN): string | null {
  if (attempts <= 0) return null;
  if (sum.unknown === Unknown.Total) {
    // The method, then the sum restated. Both are true of a bare total and
    // neither gives it away.
    return attempts === 1 ? words.addPlace(0, sum.start) : words.sumQuestion(sum.start, sum.addend);
  }
  const known = sum.unknown === Unknown.Addend ? sum.start : sum.addend;
  // The first attempt gets the same subtraction as the second. There is no
  // gentler true thing to say about a missing addend — every step of the
  // method *is* the subtraction — and a first hint that only said "think
  // about it" would be a hint the child learns to tap through.
  return words.takeQuestion(sum.total, known);
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
