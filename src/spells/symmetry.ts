// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { type Rng, randInt } from "../world/rng";
import { CLEAN_TO_CLIMB, type Recent, STUMBLES_TO_EASE } from "./difficulty";

/**
 * The mirror spell: colour the squares that make the picture match.
 *
 * A grid, a few squares already coloured in, and a line ruled through it.
 * What the child does is colour the squares that are missing — the ones that
 * would make the picture the same on both sides of the line.
 *
 * **This replaced a drawing.** The first version put a shape on the
 * parchment and asked for a line through it: draw the fold. It was the right
 * *idea* and the wrong *hands*. Judging a dragged line means a tolerance,
 * and a tolerance is either so tight that a child with an unsteady finger is
 * told they are wrong when they are right, or so loose that a line vaguely
 * down the middle passes. Worse, a wrong answer left nothing on the
 * parchment to think about: the line was rubbed out and the shape sat there
 * exactly as before.
 *
 * Squares fix all of it. A tap is either on a square or on another square,
 * so there is nothing to judge and nothing to forgive; the picture builds up
 * as she works, so a half-finished answer is *visible*; and what she is
 * doing is the thing being taught — putting a square where its reflection
 * has to be — rather than reporting a conclusion about it.
 *
 * **The line always runs through the middle.** A mirror off to one side
 * would reflect half the picture off the edge of the grid, and a square with
 * nowhere to go is a puzzle with no answer. Which line it is — down, across,
 * or corner to corner — is what the ladder climbs.
 */

/** Which way the line runs. */
export const MirrorAxis = {
  /** Straight down the middle: left and right have to match. */
  Down: "down",
  /** Straight across it: top and bottom. */
  Across: "across",
  /**
   * Corner to corner, top-left to bottom-right.
   *
   * The hardest by some distance, and the reason is that the other two
   * reflect along one number and leave the other alone. This one swaps them,
   * so the answer to "where does this square go" stops being something a
   * child can see by sliding their eye along a row.
   */
  Corner: "corner",
} as const;

export type MirrorAxis = (typeof MirrorAxis)[keyof typeof MirrorAxis];

export interface Cell {
  readonly col: number;
  readonly row: number;
}

/** A square, as one string, so a set of them is a set of strings. */
export function cellKey(cell: Cell): string {
  return `${cell.col},${cell.row}`;
}

export function cellFrom(key: string): Cell | null {
  const [col, row] = key.split(",").map(Number);
  if (col === undefined || row === undefined) return null;
  if (!Number.isInteger(col) || !Number.isInteger(row)) return null;
  return { col, row };
}

/**
 * Where a square lands when the picture is folded along the line.
 *
 * The two straight mirrors turn one number round and leave the other alone;
 * the corner one swaps them. All three are their own inverse, which is what
 * makes the puzzle finite: colouring in a square's reflection never creates
 * a new square that needs one.
 */
export function mirrorOf(cell: Cell, size: number, axis: MirrorAxis): Cell {
  if (axis === MirrorAxis.Down) return { col: size - 1 - cell.col, row: cell.row };
  if (axis === MirrorAxis.Across) return { col: cell.col, row: size - 1 - cell.row };
  return { col: cell.row, row: cell.col };
}

/** How hard a grid is to finish, and what makes it so. */
export interface SymmetryRung {
  /** The grid is this many squares each way. */
  readonly size: number;
  /** Which lines this rung may rule. One is drawn per cast. */
  readonly axes: readonly MirrorAxis[];
  /** How many squares are coloured in before she starts. */
  readonly seeds: number;
  /** How many wrong squares before the grid starts helping. */
  readonly hintAfter: number;
}

/**
 * Every setting, easiest first.
 *
 * Three things make one of these harder, and the ladder adds them one at a
 * time: how big the grid is, which way the line runs, and how much of the
 * picture is already there.
 *
 * Size first, because a four-by-four is small enough to hold in the eye all
 * at once. Then the line across as well as down — the same idea turned
 * ninety degrees, which is a smaller step than it looks but is the first
 * time she cannot assume. The corner line comes last on its own: the two
 * straight mirrors move a square along a row or down a column, and that one
 * moves it to the *other* number entirely.
 */
export const SYMMETRY_RUNGS: readonly SymmetryRung[] = [
  { size: 4, axes: [MirrorAxis.Down], seeds: 3, hintAfter: 1 },
  { size: 5, axes: [MirrorAxis.Down], seeds: 4, hintAfter: 1 },
  { size: 5, axes: [MirrorAxis.Down, MirrorAxis.Across], seeds: 5, hintAfter: 1 },
  { size: 6, axes: [MirrorAxis.Down, MirrorAxis.Across], seeds: 6, hintAfter: 2 },
  { size: 7, axes: [MirrorAxis.Down, MirrorAxis.Across], seeds: 8, hintAfter: 2 },
  { size: 7, axes: [MirrorAxis.Corner], seeds: 8, hintAfter: 2 },
];

export const HARDEST_SYMMETRY_RUNG = SYMMETRY_RUNGS.length - 1;

export function symmetryRungAt(index: number): SymmetryRung {
  const at = Math.max(0, Math.min(HARDEST_SYMMETRY_RUNG, Math.trunc(index)));
  return SYMMETRY_RUNGS[at] as SymmetryRung;
}

/** The fewest squares a puzzle may ask for before it is worth setting. */
const LEAST_WANTED = 2;

export interface Puzzle {
  readonly size: number;
  readonly axis: MirrorAxis;
  /** The squares that are coloured in to begin with. */
  readonly given: readonly string[];
  /** The ones she has to colour to finish it. */
  readonly wanted: readonly string[];
}

/**
 * A grid to finish.
 *
 * Squares are scattered, and then the answer is worked out from them rather
 * than the other way round: every coloured square's reflection has to be
 * coloured too, so what is *wanted* is those reflections less the ones that
 * happen to be coloured already. A square sitting on the line is its own
 * reflection and asks for nothing, which is true and is also why a scatter
 * can come back with almost nothing to do.
 *
 * So a thin one is thrown away and drawn again. Bounded, and it keeps the
 * last draw either way: a puzzle with one square missing is an easy puzzle
 * rather than a broken one, and looping for ever to avoid it would be the
 * worse failure.
 */
export function makePuzzle(rng: Rng, rung: SymmetryRung): Puzzle {
  let best = onePuzzle(rng, rung);
  for (let again = 0; again < 8 && best.wanted.length < LEAST_WANTED; again++) {
    best = onePuzzle(rng, rung);
  }
  return best;
}

function onePuzzle(rng: Rng, rung: SymmetryRung): Puzzle {
  const size = Math.max(2, rung.size);
  const axes = rung.axes.length > 0 ? rung.axes : [MirrorAxis.Down];
  const axis = axes[randInt(rng, 0, axes.length - 1)] as MirrorAxis;

  const given = new Set<string>();
  // Drawn one at a time rather than shuffled: the count is small against the
  // grid, so a repeat is rare and a repeat simply means one square fewer.
  for (let seed = 0; seed < rung.seeds; seed++) {
    given.add(cellKey({ col: randInt(rng, 0, size - 1), row: randInt(rng, 0, size - 1) }));
  }

  const wanted = new Set<string>();
  for (const key of given) {
    const cell = cellFrom(key);
    if (!cell) continue;
    const mirrored = cellKey(mirrorOf(cell, size, axis));
    if (!given.has(mirrored)) wanted.add(mirrored);
  }
  return { size, axis, given: [...given], wanted: [...wanted] };
}

/**
 * How far she has got: the grid, and what she has coloured in.
 *
 * `wanted` shrinks as she works, which is what makes "done" a length rather
 * than a comparison — and it can only shrink, because a reflection's
 * reflection is the square it came from, so colouring one in never asks for
 * another.
 */
export interface SymmetryCast {
  readonly size: number;
  readonly axis: MirrorAxis;
  readonly given: readonly string[];
  readonly wanted: readonly string[];
  /** The squares she has coloured in herself. */
  readonly filled: readonly string[];
  readonly done: boolean;
  readonly missteps: number;
  /** The square she got wrong, for as long as it takes to say so. */
  readonly wrong: string | null;
  readonly rung: SymmetryRung;
}

export function beginSymmetryCast(rng: Rng, rung: SymmetryRung): SymmetryCast {
  const puzzle = makePuzzle(rng, rung);
  return {
    size: puzzle.size,
    axis: puzzle.axis,
    given: puzzle.given,
    wanted: puzzle.wanted,
    filled: [],
    done: puzzle.wanted.length === 0,
    missteps: 0,
    wrong: null,
    rung,
  };
}

/**
 * Colour a square in.
 *
 * A square that is wanted is taken; anything else is a misstep and is *not*
 * coloured. Refusing rather than colouring and then complaining is the whole
 * of what makes this readable: everything on the grid is either part of the
 * answer or not there, so a child looking at it is looking at their own
 * working rather than at a mixture of working and mistakes.
 *
 * A tap on a square she has already coloured takes it back, which is what a
 * child does when they change their mind. A tap on a *given* square does
 * not: those are the picture she was handed.
 */
export function fillCell(cast: SymmetryCast, cell: Cell): SymmetryCast {
  if (cast.done) return cast;
  const key = cellKey(cell);
  if (cast.filled.includes(key)) {
    return {
      ...cast,
      filled: cast.filled.filter((one) => one !== key),
      wanted: [...cast.wanted, key],
      wrong: null,
    };
  }
  if (!cast.wanted.includes(key)) {
    return { ...cast, missteps: cast.missteps + 1, wrong: key };
  }
  const wanted = cast.wanted.filter((one) => one !== key);
  return {
    ...cast,
    wanted,
    filled: [...cast.filled, key],
    done: wanted.length === 0,
    wrong: null,
  };
}

/**
 * One square shown to a child who cannot find one.
 *
 * One, not all of them. Being shown the whole answer is not help, it is the
 * end of the puzzle — and one square is enough to say *this* is the kind of
 * thing you are looking for, which is what a child stuck on the third rung
 * actually needs.
 */
export function symmetryHint(cast: SymmetryCast): string | null {
  if (cast.done) return null;
  if (cast.missteps < Math.max(1, cast.rung.hintAfter)) return null;
  return cast.wanted[0] ?? null;
}

/**
 * Whether the picture is symmetric as it stands.
 *
 * Worked out from the squares rather than read off `done`, because it is the
 * thing `done` *claims* — and a claim and a check that agree by construction
 * are one thing said twice. Used by the tests.
 */
export function isSymmetric(cast: SymmetryCast): boolean {
  const on = new Set([...cast.given, ...cast.filled]);
  for (const key of on) {
    const cell = cellFrom(key);
    if (!cell) return false;
    if (!on.has(cellKey(mirrorOf(cell, cast.size, cast.axis)))) return false;
  }
  return true;
}

/**
 * Where the mirror ladder goes next, on the same rules as every other one.
 *
 * Written here rather than reusing `nextRung` because that one keeps a child
 * inside their band, and this ladder has no bands. Every other spell scales
 * its floor to how old and able a child is; folding does not, because it is
 * a way of *looking* rather than a fluency, and the oldest child in the game
 * has very likely never been asked to do it. So this ladder runs from the
 * four-square grid to the corner mirror for everybody, and `nextRung`'s
 * fence — which would snap a nine year old off the first rung on their very
 * first cast — is exactly what has to be left out.
 *
 * The runs themselves are the shared ones: four clean to climb, two stumbles
 * to ease. A second opinion about how fast a child moves would be a second
 * thing to keep in step.
 */
export function nextSymmetryRung(rung: number, recent: Recent): number {
  const here = Math.max(0, Math.min(HARDEST_SYMMETRY_RUNG, Math.trunc(rung)));
  const clean = recent.slice(-CLEAN_TO_CLIMB);
  if (clean.length >= CLEAN_TO_CLIMB && clean.every(Boolean)) {
    return Math.min(HARDEST_SYMMETRY_RUNG, here + 1);
  }
  const stumbles = recent.slice(-STUMBLES_TO_EASE);
  if (stumbles.length >= STUMBLES_TO_EASE && stumbles.every((was) => !was)) {
    return Math.max(0, here - 1);
  }
  return here;
}
