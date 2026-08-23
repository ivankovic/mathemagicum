// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { type Rng, pick, randInt } from "../world/rng";

/**
 * The wall a house is built out of: six bricks in a triangle, three of them
 * blank.
 *
 * Three along the bottom, two above, one on top. **Every brick is the sum of
 * the two it rests on**, which is the whole rule and the only thing a child
 * has to be told. Six numbers are worked out, three are rubbed off, and the
 * three that are left have to be enough to put the other three back.
 *
 * **Why a pyramid rather than another row of sums.** The garden's spell asks
 * a child to add two numbers it hands them. This asks something the garden
 * never can: *what goes here*. A gap in the bottom row cannot be filled by
 * adding — the child has the total and one of the parts, and the only way to
 * the answer is backwards. That is the same arithmetic seen from the other
 * end, it is the thing that becomes algebra later, and it is a genuinely
 * different skill from computing a sum. Hence its own ladder, like the
 * portal's and the tree's.
 *
 * **And the gaps are filled in a forced order.** Not every blank is fillable
 * at every moment: with the top and one middle brick showing, the other
 * middle brick has to go in before either of the bottom bricks under it can.
 * A panel that let a child tap any gap would let them tap one that nothing
 * yet determines, and the honest answer to what they typed would be "that
 * cannot be worked out yet" — which is a rule about the puzzle's plumbing
 * rather than about arithmetic. So the wall asks for its bricks in the order
 * they can actually be got, one at a time, and the chain from what is known
 * to what is wanted is the thing being taught.
 */

/**
 * The six bricks, and the order they are indexed in: bottom row left to
 * right, then the pair above it, then the top.
 *
 * Flat rather than nested, because every question asked of a wall — which
 * are blank, which is next, what does this one rest on — is a question about
 * one brick, and a `[row][col]` shape would mean converting to and from a
 * pair of coordinates at every one of them.
 */
export const BRICK_COUNT = 6;

/** Which bricks sit on which row, for a panel laying them out. */
export const BRICK_ROWS: readonly (readonly number[])[] = [[0, 1, 2], [3, 4], [5]];

/**
 * What each brick above the bottom row rests on.
 *
 * The single source of the rule. The solver, the generator and the panel's
 * hint all read it, so "the brick above sits on these two" is stated once
 * and cannot come apart.
 */
export const BRICK_PARENTS: Readonly<Record<number, readonly [number, number]>> = {
  3: [0, 1],
  4: [1, 2],
  5: [3, 4],
};

/** The topmost brick: the one every other brick adds up to. */
export const BRICK_TOP = 5;

/** A brick recovered by working, and which direction the working went. */
export interface BrickStep {
  /** Which brick was filled. */
  readonly brick: number;
  /**
   * Whether it took a subtraction.
   *
   * `false` is a brick got by adding the two under it. `true` is a brick got
   * from the one above and its neighbour, which is the harder half of this
   * and the axis the ladder climbs.
   */
  readonly backwards: boolean;
}

export interface BrickSolution {
  /** All six values, gaps filled in. */
  readonly values: readonly number[];
  /** The order the gaps can be got in, which is the order they are asked. */
  readonly steps: readonly BrickStep[];
}

/**
 * Fill in what the showing bricks force, and say in what order.
 *
 * Repeated forced substitution: a brick is filled either from the two under
 * it or from the one above it and its neighbour, and the pass runs again
 * until nothing more can be got. Returns null if it stalls, which means the
 * showing bricks do not determine the wall — see `SOLVABLE_HIDINGS`.
 *
 * The scan order is fixed, so the sequence of steps is a property of *which*
 * bricks are blank rather than of when this happened to be called. That
 * matters more than it looks: the panel asks for the gaps in this order, and
 * an order that varied between two calls would be a puzzle that reshuffled
 * itself while a child was looking at it.
 */
export function solveBricks(showing: readonly (number | null)[]): BrickSolution | null {
  const values = [...showing];
  const steps: BrickStep[] = [];
  const known = (at: number) => values[at] !== null && values[at] !== undefined;
  let moved = true;
  while (moved) {
    moved = false;
    for (const above of [3, 4, 5]) {
      const [left, right] = BRICK_PARENTS[above] as readonly [number, number];
      if (!known(above) && known(left) && known(right)) {
        values[above] = (values[left] as number) + (values[right] as number);
        steps.push({ brick: above, backwards: false });
        moved = true;
      } else if (known(above) && known(left) && !known(right)) {
        values[right] = (values[above] as number) - (values[left] as number);
        steps.push({ brick: right, backwards: true });
        moved = true;
      } else if (known(above) && !known(left) && known(right)) {
        values[left] = (values[above] as number) - (values[right] as number);
        steps.push({ brick: left, backwards: true });
        moved = true;
      }
    }
  }
  if (values.some((value) => value === null || value === undefined)) return null;
  return { values: values as number[], steps };
}

/** Every way to rub out three of six bricks. */
function everyHiding(): readonly (readonly number[])[] {
  const all: number[][] = [];
  for (let a = 0; a < BRICK_COUNT; a++) {
    for (let b = a + 1; b < BRICK_COUNT; b++) {
      for (let c = b + 1; c < BRICK_COUNT; c++) all.push([a, b, c]);
    }
  }
  return all;
}

/**
 * The ways of rubbing out three bricks that leave exactly one wall standing,
 * grouped by how much of the working is backwards.
 *
 * Worked out here rather than typed in. Four of the twenty ways are
 * ambiguous — rub out the left brick, the middle one above it and the top,
 * and half a wall goes with them — and a list written by hand is a list that
 * agrees with the rule until somebody changes the rule.
 *
 * The grouping is the ladder. Rubbing out the three upper bricks asks a
 * child to build the wall upwards and is pure addition; rubbing out bottom
 * bricks asks them to come back down, and each one of those is a subtraction
 * they have to see for themselves. Nought through three, and every count in
 * between exists:
 *
 * - **none backwards**: one way, the three upper bricks. Add, add, add.
 * - **one**: four ways.
 * - **two**: five.
 * - **three**: six, and none of the bottom row survives to help.
 *
 * A representative wall is enough to classify them: which bricks force which
 * is a fact about the *shape*, and the numbers in it never enter into it.
 */
const CLASSIFY_ON: readonly number[] = [3, 5, 2, 8, 7, 15];

export const SOLVABLE_HIDINGS: Readonly<Record<number, readonly (readonly number[])[]>> = (() => {
  const byBackwards: Record<number, (readonly number[])[]> = { 0: [], 1: [], 2: [], 3: [] };
  for (const hidden of everyHiding()) {
    const showing = CLASSIFY_ON.map((value, at) => (hidden.includes(at) ? null : value));
    const solved = solveBricks(showing);
    if (!solved) continue;
    const backwards = solved.steps.filter((step) => step.backwards).length;
    byBackwards[backwards]?.push(hidden);
  }
  return byBackwards;
})();

/** How much backwards working a rung can ask for at most. */
export const MOST_BACKWARDS = 3;

export interface BrickRung {
  /**
   * The largest the top brick may be.
   *
   * The top is what the whole wall adds up to, so capping it caps every sum
   * in the puzzle at once — and capping it is not the same as capping the
   * bottom row. A bottom row of three-digit numbers tops out over three
   * thousand, because the middle brick is counted twice on the way up; a
   * ladder that set the bottom row's width would quietly ask for sums a
   * digit longer than the ladder it borrowed the width from.
   */
  readonly ceiling: number;
  /**
   * How many of the three gaps can only be got by working backwards.
   *
   * The real difficulty here, and the reason this is not the garden's spell
   * with a different picture. Nought is a wall built upwards by adding.
   * Three is a wall where every gap is a subtraction a child has to find for
   * themselves.
   */
  readonly backwards: number;
  /** How many wrong answers before the wall starts pointing at the working. */
  readonly hintAfter: number;
}

/**
 * Every setting, easiest first.
 *
 * Two things move and they move one at a time, which is the same shape the
 * number line's ladder has: bigger numbers, then a harder question, then
 * bigger numbers again. A child never meets a longer number and a new kind
 * of gap in the same step.
 *
 * The first two rungs rub out the same three bricks every time — there is
 * only one way to blank three bricks and leave nothing but addition — and
 * that repetition is the point of them rather than a shortcoming. It is the
 * rung where a child learns what the picture *means*, and the numbers in it
 * are different every cast.
 */
export const BRICK_RUNGS: readonly BrickRung[] = [
  { ceiling: 10, backwards: 0, hintAfter: 1 }, //   build it up, within ten
  { ceiling: 20, backwards: 0, hintAfter: 1 }, //   build it up, over ten
  { ceiling: 20, backwards: 1, hintAfter: 1 }, //   one gap has to be come back to
  { ceiling: 100, backwards: 1, hintAfter: 1 }, //  two places
  { ceiling: 100, backwards: 2, hintAfter: 2 }, //  and most of it is backwards
  { ceiling: 100, backwards: 3, hintAfter: 2 }, //  none of the bottom row given
  { ceiling: 1000, backwards: 3, hintAfter: 2 }, // three places, and all of it
];

export const HARDEST_BRICK_RUNG = BRICK_RUNGS.length - 1;

export function brickRungAt(index: number): BrickRung {
  const at = Math.max(0, Math.min(HARDEST_BRICK_RUNG, Math.trunc(index)));
  return BRICK_RUNGS[at] as BrickRung;
}

export interface BrickProblem {
  /** All six bricks, the answer included. Indexed as `BRICK_ROWS` says. */
  readonly values: readonly number[];
  /** Which three are blank. */
  readonly hidden: readonly number[];
  /** The order the blanks can be got in — what the panel asks for, in turn. */
  readonly steps: readonly BrickStep[];
}

/**
 * A wall to build.
 *
 * **Drawn from the top down.** The top brick is picked first, inside the
 * rung's ceiling and in its upper half, and the bottom row is chosen to add
 * up to it. Drawing the bottom row first and letting the top fall where it
 * may would put most of a rung's problems in the bottom of its range — the
 * top is a sum of three draws, so it clusters — and a rung whose ceiling is
 * a thousand would spend most of its time in the low hundreds.
 *
 * Every brick is at least one. A wall with a nought in it is legal
 * arithmetic and a poor question: `0 + 7 = 7` is a brick a child copies
 * rather than works out.
 *
 * The answer is never checked for validity afterwards and does not need to
 * be. A wall is built whole and *then* has bricks taken out of it, so what a
 * child recovers is what was there — no negative number and no fraction can
 * appear, whichever gaps were rubbed out. Generating three numbers and
 * hoping they make a wall is the version of this that needs a validity
 * check, and it is the version that hands a child `4 - 9`.
 */
export function makeBrickProblem(rng: Rng, rung: BrickRung): BrickProblem {
  const values = drawWall(rng, rung.ceiling);
  const ways = SOLVABLE_HIDINGS[clampBackwards(rung.backwards)] ?? [];
  const hidden = pick(rng, ways);
  const showing = values.map((value, at) => (hidden.includes(at) ? null : value));
  // Never null: every hiding in the table solved when it was classified, and
  // solvability is a fact about which bricks are blank rather than about the
  // numbers. The throw is here because a silent `[]` would reach the panel
  // as a wall with no questions in it.
  const solved = solveBricks(showing);
  if (!solved) throw new Error(`a hiding in the table did not solve: ${hidden.join(",")}`);
  return { values, hidden, steps: solved.steps };
}

function clampBackwards(backwards: number): number {
  return Math.max(0, Math.min(MOST_BACKWARDS, Math.trunc(backwards)));
}

/**
 * Three bricks along the bottom whose wall tops out inside the ceiling.
 *
 * The top is `b0 + 2·b1 + b2` — the middle brick carries into both bricks
 * above it — so it is picked first and the row is fitted to it: the middle
 * brick takes whatever is left after the outer two have their one each, and
 * the outer two split the remainder.
 */
function drawWall(rng: Rng, ceiling: number): readonly number[] {
  // The smallest wall there is, `1 + 1 + 1` along the bottom, tops out at
  // four; a ceiling under that has no walls in it at all.
  const smallest = 4;
  const top = randInt(rng, Math.max(smallest, Math.ceil(ceiling / 2)), Math.max(smallest, ceiling));
  const middle = randInt(rng, 1, Math.floor((top - 2) / 2));
  const outer = top - 2 * middle;
  const left = randInt(rng, 1, outer - 1);
  const right = outer - left;
  return [left, middle, right, left + middle, middle + right, top];
}

/**
 * What a child has typed into the wall so far.
 *
 * The same shape as the array spell's cast and for the same reason: the
 * rules of answering are arithmetic rather than drawing, so they live here
 * where they can be tested without a browser, and the panel is a renderer
 * over them.
 */
export interface BrickCast {
  readonly problem: BrickProblem;
  /** How many gaps have been filled: also which step is being asked. */
  readonly at: number;
  readonly entry: string;
  readonly done: boolean;
  readonly missteps: number;
  /** Set when the last submission was wrong, so the brick can be marked. */
  readonly wrong: boolean;
}

export function beginBrickCast(problem: BrickProblem): BrickCast {
  return { problem, at: 0, entry: "", done: false, missteps: 0, wrong: false };
}

/** The brick being asked for, or null once the wall is finished. */
export function brickBeingAsked(cast: BrickCast): number | null {
  return cast.problem.steps[cast.at]?.brick ?? null;
}

/** What is written on a brick right now: its number, or null for a gap. */
export function brickFace(cast: BrickCast, brick: number): number | null {
  if (!cast.problem.hidden.includes(brick)) return cast.problem.values[brick] ?? null;
  const filled = cast.problem.steps.slice(0, cast.at).some((step) => step.brick === brick);
  return filled ? (cast.problem.values[brick] ?? null) : null;
}

function longestAnswer(cast: BrickCast): number {
  // The top brick is the biggest number in any wall, so its width is the
  // widest answer any gap can want. Taken from this wall rather than from
  // the rung's ceiling: a child typing a fourth digit into a three-digit
  // wall has made a slip, and swallowing it is kinder than marking it wrong.
  return String(cast.problem.values[BRICK_TOP] ?? 0).length;
}

export function typeBrickDigit(cast: BrickCast, digit: number): BrickCast {
  if (cast.done) return cast;
  if (!Number.isInteger(digit) || digit < 0 || digit > 9) return cast;
  // A leading nought is dropped rather than rejected. No brick in a wall is
  // nought, so it can only be a slip, and a button that does nothing at all
  // reads as a button that is broken.
  if (cast.entry === "" && digit === 0) return cast;
  if (cast.entry.length >= longestAnswer(cast)) return cast;
  return { ...cast, entry: cast.entry + String(digit), wrong: false };
}

export function backspaceBrick(cast: BrickCast): BrickCast {
  if (cast.done || cast.entry === "") return cast;
  return { ...cast, entry: cast.entry.slice(0, -1), wrong: false };
}

/**
 * Put the number in, if it is the right one.
 *
 * A wrong answer stays on the same brick. There is no fail state and no
 * limit on tries — what a wrong answer costs is the cast's *cleanness*,
 * which is the only thing the difficulty reads, and a child who gets there
 * on the fourth go still builds their room.
 */
export function submitBrick(cast: BrickCast): BrickCast {
  if (cast.done || cast.entry === "") return cast;
  const brick = brickBeingAsked(cast);
  if (brick === null) return cast;
  if (Number(cast.entry) !== cast.problem.values[brick]) {
    return { ...cast, entry: "", missteps: cast.missteps + 1, wrong: true };
  }
  const at = cast.at + 1;
  return { ...cast, at, entry: "", wrong: false, done: at >= cast.problem.steps.length };
}

/**
 * Whether the wall should start showing its working.
 *
 * The hint is the two bricks the answer comes from, lit up. It is deliberately
 * not the answer: a child who has been wrong twice needs to be told *where to
 * look*, and being told the number instead ends the question.
 */
export function brickHintShowing(cast: BrickCast, rung: BrickRung): boolean {
  return cast.missteps >= rung.hintAfter;
}

/**
 * The two bricks the one being asked for is worked out from, or nothing.
 *
 * A brick can belong to more than one family — the middle brick of the
 * bottom row rests under both bricks above it — so this picks the family
 * whose other two members are *showing*. That is not a nicety: the first gap
 * of a wall with the whole bottom row rubbed out is reachable from exactly
 * one side, and pointing at the other would be pointing at two more gaps,
 * which is an instruction to work out the unknown from the unknown.
 */
export function brickWorkingFrom(cast: BrickCast): readonly number[] {
  const brick = brickBeingAsked(cast);
  if (brick === null) return [];
  const showing = (at: number) => brickFace(cast, at) !== null;
  for (const family of familiesOf(brick)) {
    if (family.every(showing)) return family;
  }
  return [];
}

/**
 * Every pair this brick could be got from: the two it rests on, and — for
 * each brick it helps hold up — that brick and its other child.
 */
function familiesOf(brick: number): readonly (readonly number[])[] {
  const families: number[][] = [];
  const under = BRICK_PARENTS[brick];
  if (under) families.push([...under]);
  for (const [parent, [left, right]] of Object.entries(BRICK_PARENTS)) {
    if (left === brick) families.push([Number(parent), right]);
    if (right === brick) families.push([Number(parent), left]);
  }
  return families;
}
