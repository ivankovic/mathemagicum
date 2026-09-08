// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { type Rng, randInt } from "../world/rng";
import { type NumberLine, runsDown } from "./addition";

/**
 * The same sum as the number line, counted out in things instead of drawn.
 *
 * The line is already the scaffold under a bare sum — it breaks `7 + 5` into
 * a start and a jump and asks where the jump lands. This is the scaffold
 * under *that*, for a child who cannot yet read a line at all: the start is
 * a box with that many counters already in it, and the jump is counters
 * going in or coming out, one at a time, by hand.
 *
 * **It is not a new kind of problem, and deliberately not.** A round is made
 * out of a `NumberLine` the ordinary generator produced, at the ordinary
 * rung, on the ordinary ladder. That matters for a reason that is not
 * tidiness: a rung index is written into every saved profile — `band` and
 * `rung` in `profiles.ts` are positions in `RUNGS` — so a new easiest rung
 * would renumber the ladder under every child who has already played, and
 * quietly change what the band somebody chose for them means. Nothing here
 * touches the ladder. It is a way of *showing* the easiest rungs, the way
 * `Rung.bare` is a way of showing the hardest.
 *
 * **What a round asks.** The box holds `from` and has to hold `to`. Adding
 * puts too few in it to start with and subtracting puts too many, which is
 * not a rule this file invents — it is what a line running up and a line
 * running down already are, read as a quantity rather than as a position.
 * Either way the child moves `moves` counters and the direction is the one
 * fact she has to work out for herself.
 */

/**
 * What colour the counters are this round.
 *
 * **They mean nothing.** A colour that meant *add* or *take away* would be a
 * second thing to learn before the first one can be started, and this is the
 * easiest thing in the game — the round says which way it goes by how full
 * the box is, which is the whole idea. So the colour is picked fresh each
 * round for no reason except that a child does forty of these and eight of
 * them being red is worth the four lines it costs.
 *
 * Named rather than numbered, because the panel draws them and the words
 * that describe one are the words a child would use.
 */
export const CounterColour = {
  Blue: "blue",
  Red: "red",
  Green: "green",
  Yellow: "yellow",
  Purple: "purple",
} as const;

export type CounterColour = (typeof CounterColour)[keyof typeof CounterColour];

export const COUNTER_COLOURS: readonly CounterColour[] = [
  CounterColour.Blue,
  CounterColour.Red,
  CounterColour.Green,
  CounterColour.Yellow,
  CounterColour.Purple,
];

/** One round of it: a box that starts wrong and the counters to put it right. */
export interface CountingRound {
  /** How many are in the box when she arrives. */
  readonly from: number;
  /** How many it has to hold. */
  readonly to: number;
  /** How many she has to move, always more than nought. */
  readonly moves: number;
  /** Whether they come out rather than go in. */
  readonly takingAway: boolean;
  readonly colour: CounterColour;
}

/**
 * Read a round off a number line.
 *
 * The *first* jump and not the whole journey: a line with two jumps in it is
 * a sum in two places, and a child counting single counters into a box is
 * not doing one of those. The rungs this is shown at have one jump — see
 * `RUNGS`, where `places: 1` is the bottom of the ladder — so the first jump
 * is the only jump, and taking it explicitly is what keeps this honest if it
 * is ever pointed at a longer line.
 */
export function countingRound(problem: NumberLine, rng: Rng): CountingRound {
  const to = problem.stops[0];
  const jump = problem.jumps[0];
  if (to === undefined || jump === undefined) {
    throw new Error("a counting round wants a line with at least one jump");
  }
  return {
    from: problem.start,
    to,
    moves: jump,
    takingAway: runsDown(problem),
    colour: pickColour(rng),
  };
}

/** A colour for this round, meaning nothing. See `CounterColour`. */
export function pickColour(rng: Rng): CounterColour {
  const at = randInt(rng, 0, COUNTER_COLOURS.length - 1);
  const colour = COUNTER_COLOURS[at];
  if (!colour) throw new Error("there are no counter colours");
  return colour;
}

/**
 * Whether the box is right.
 *
 * A count and not a running tally of what she did, so a child who takes one
 * too many out and puts it back has done nothing wrong — which is the whole
 * difference between this and a test. The only question a box can answer is
 * how many things are in it.
 */
export function boxIsRight(round: CountingRound, held: number): boolean {
  return held === round.to;
}

/**
 * How many counters the tray beside the box starts with.
 *
 * Enough to finish with some left over, so the tray is never a hint: a tray
 * holding exactly the answer would let a child empty it without counting
 * anything, and emptying a tray is not arithmetic. Never fewer than the
 * round needs, for the obvious reason.
 *
 * Taking away needs none at all — the counters she moves come out of the
 * box — but the tray is still drawn, because it is where they go.
 */
export function trayFor(round: CountingRound): number {
  return round.takingAway ? 0 : round.moves + SPARE_COUNTERS;
}

/** How many more than she needs are in the tray. See `trayFor`. */
export const SPARE_COUNTERS = 3;
