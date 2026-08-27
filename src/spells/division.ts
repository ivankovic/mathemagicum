// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

/**
 * The division spell: a heap of crop, dealt out into equal shares.
 *
 * The fourth of the arithmetic spells and the answer to an asymmetry the
 * garden had grown. A child *ripens* a patch in one cast — that is the array
 * spell, and outdoors it is the only thing that one does in bulk — and then
 * picks it one tap at a time. This is the other end: cast on a ripe patch
 * and the whole of it comes up at once, shared out.
 *
 * Planting is by hand at both ends and stays that way. Putting a seed down
 * is the one gesture in the garden a child does *with* their hands rather
 * than through a rune, and a patch sown by spell would take that away to
 * save four taps.
 *
 * **The numbers are generated, not drawn by the player.** That is the one
 * place this parts company with the array spell, and the reason is worth
 * writing down because it is the first question anybody asks. The array
 * spell takes its numbers from the rectangle the child marked out, because a
 * rectangle *is* the shape multiplication draws — the picture on the
 * parchment and the patch in the garden are one object. A share is not a
 * shape. There is nothing on the ground for the child to point at that says
 * "into five", so the question is set the way addition, subtraction, the
 * bricks and the clock all set theirs.
 *
 * **The picture is dealing.** Rings, and the crop going round them one at a
 * time until it runs out. That is not an illustration of division, it is the
 * algorithm a child actually uses — and it is the one picture that makes a
 * remainder obvious rather than mysterious, because the leftovers are simply
 * the ones that would not go.
 *
 * **A remainder is a rung, not a rule.** The youngest child meets shares
 * that come out even, and nothing else; further up the ladder they do not.
 * Meeting two unknowns at once — how many each *and* how many over — is how
 * a child decides division is the hard one.
 *
 * **One box per thing the picture cannot say.** The array spell asks one
 * question because its picture answers everything else, and the number line
 * asks three because it has three landings. Here the rings show the
 * leftovers as soon as they are dealt, so the leftover is only ever *asked*
 * at the tier that draws nothing at all.
 *
 * **No fail state**, as everywhere: a wrong answer clears the box, offers
 * more help than it did last time, and lets the child go again.
 */

import type { Rng } from "../world/rng";
import { randInt } from "../world/rng";

export const ShareTier = {
  /** The rings are drawn and the first of them arrive already dealt out. */
  Dealt: "dealt",
  /** The rings are drawn and the heap is still whole. */
  Rings: "rings",
  /** Nothing is drawn. `23 ÷ 5`, and two boxes if it does not come out even. */
  Bare: "bare",
} as const;

export type ShareTier = (typeof ShareTier)[keyof typeof ShareTier];

export interface ShareRung {
  readonly tier: ShareTier;
  /**
   * How many rings arrive with their share already dealt into them.
   *
   * The same scaffolding the array spell hands out by counting rows for you:
   * a child shown two rings with three apples in each has been given the
   * method and left the answer. Never all of them — the last ring dealt
   * would *be* the answer.
   */
  readonly given: number;
  /** Whether a share may come out uneven at this rung. */
  readonly remainders: boolean;
  /** How big the heap may get, said as the two numbers that make it. */
  readonly mostEach: number;
  readonly mostParts: number;
  /** How many wrong answers before the parchment starts dealing for them. */
  readonly hintAfter: number;
}

/**
 * Every setting, easiest first.
 *
 * Two things climb and they climb alternately, which is deliberate: help is
 * taken away, then the numbers grow, then help is taken away again. A ladder
 * that did both at once would be a ladder with a step missing.
 *
 * The ring tiers keep their numbers small on purpose. Thirty apples in six
 * rings is a picture nobody can count at a glance, and a picture that has to
 * be counted twice is a picture that has stopped helping. Above them the
 * dealing goes and the numbers can be the times tables, because by then the
 * child is not counting anything.
 */
export const SHARE_RUNGS: readonly ShareRung[] = [
  { tier: ShareTier.Dealt, given: 2, remainders: false, mostEach: 4, mostParts: 3, hintAfter: 1 },
  { tier: ShareTier.Dealt, given: 1, remainders: false, mostEach: 5, mostParts: 4, hintAfter: 1 },
  { tier: ShareTier.Rings, given: 0, remainders: false, mostEach: 6, mostParts: 4, hintAfter: 1 },
  { tier: ShareTier.Rings, given: 0, remainders: true, mostEach: 6, mostParts: 5, hintAfter: 2 },
  { tier: ShareTier.Bare, given: 0, remainders: false, mostEach: 10, mostParts: 10, hintAfter: 2 },
  { tier: ShareTier.Bare, given: 0, remainders: true, mostEach: 12, mostParts: 10, hintAfter: 2 },
];

export const HARDEST_SHARE_RUNG = SHARE_RUNGS.length - 1;

export function shareRungAt(index: number): ShareRung {
  const at = Math.max(0, Math.min(HARDEST_SHARE_RUNG, Math.trunc(index)));
  return SHARE_RUNGS[at] as ShareRung;
}

export interface ShareProblem {
  /** The heap. */
  readonly total: number;
  /** How many ways it is going. */
  readonly parts: number;
  /** What goes in each — the answer. */
  readonly each: number;
  /** And what will not go. */
  readonly left: number;
  /**
   * Whether this rung allows a leftover at all — which is not the same as
   * whether this heap happens to have one.
   *
   * Carried rather than read off `left`, and the difference is a leak. The
   * bare tier asks for the leftover in a box of its own; if that box only
   * appeared when there *was* one, its appearing would answer the question.
   * A child would learn to look at the parchment rather than at the numbers,
   * and would be right to.
   */
  readonly remainders: boolean;
  readonly tier: ShareTier;
  readonly given: number;
  readonly hintAfter: number;
}

/**
 * Set a share.
 *
 * Built up from the answer rather than divided down from a heap, which is
 * the only way to keep a rung's promise: "no remainders" has to mean *no
 * remainders*, and a generator that picked a total and a divisor and hoped
 * would hand a five-year-old a remainder one time in three.
 *
 * At least two ways and at least one each, so that no cast is a question
 * about nothing. Sharing four apples one way is not sharing.
 */
export function shareProblemFor(rng: Rng, rung: ShareRung): ShareProblem {
  const parts = randInt(rng, 2, Math.max(2, rung.mostParts));
  const each = randInt(rng, 1, Math.max(1, rung.mostEach));
  // Nought is a legitimate remainder and it is drawn from the same range as
  // any other: a rung that promised leftovers *every* time would teach that
  // division never comes out even, which is the opposite mistake.
  const left = rung.remainders ? randInt(rng, 0, parts - 1) : 0;
  return {
    total: each * parts + left,
    parts,
    each,
    left,
    remainders: rung.remainders,
    tier: rung.tier,
    given: Math.max(0, Math.min(rung.given, parts - 1)),
    hintAfter: Math.max(1, rung.hintAfter),
  };
}

/** Whether this rung draws the rings at all. */
export function showsRings(problem: ShareProblem): boolean {
  return problem.tier !== ShareTier.Bare;
}

/**
 * Whether the child is asked what was left over, as well as what each got.
 *
 * Only where nothing is drawn. The rings show the leftovers the moment they
 * are dealt — asking for a number that is lying on the parchment already is
 * asking a child to read rather than to divide.
 *
 * A property of the rung and never of the heap: see `remainders`. A box that
 * turned up only when the answer was not nought would be a box that gave the
 * answer away by turning up.
 */
export function asksLeft(problem: ShareProblem): boolean {
  return !showsRings(problem) && problem.remainders;
}

/** The two boxes, or the one, in the order they are filled. */
export type ShareBox = "each" | "left";

export function boxesOf(problem: ShareProblem): readonly ShareBox[] {
  return asksLeft(problem) ? ["each", "left"] : ["each"];
}

export interface ShareCast {
  readonly problem: ShareProblem;
  readonly each: string;
  readonly left: string;
  /** Which box the keypad is filling. */
  readonly box: ShareBox;
  readonly done: boolean;
  readonly missteps: number;
  /** Set when the last submission was wrong, so the boxes can be marked. */
  readonly wrong: boolean;
}

export function beginShareCast(problem: ShareProblem): ShareCast {
  return { problem, each: "", left: "", box: "each", done: false, missteps: 0, wrong: false };
}

function entryOf(cast: ShareCast, box: ShareBox): string {
  return box === "each" ? cast.each : cast.left;
}

function withEntry(cast: ShareCast, box: ShareBox, value: string): ShareCast {
  return box === "each"
    ? { ...cast, each: value, wrong: false }
    : { ...cast, left: value, wrong: false };
}

function roomIn(cast: ShareCast, box: ShareBox): number {
  return String(box === "each" ? cast.problem.each : cast.problem.parts).length;
}

/** Move the keypad to a box. A tap on either is how a child goes back. */
export function focusShareBox(cast: ShareCast, box: ShareBox): ShareCast {
  if (cast.done || !boxesOf(cast.problem).includes(box)) return cast;
  return { ...cast, box };
}

/**
 * Type a digit into whichever box is filling.
 *
 * **Nought is allowed in the leftovers and not in the share**, which is not
 * a copy of the array spell's rule but its mirror image. No share is
 * nothing: a heap dealt into five ways puts at least something in each, so a
 * leading nought there can only be a slip. A *leftover* of nothing is the
 * commonest answer there is — it is what "it came out even" looks like — and
 * a box that refused to accept it would be a box that could not be answered.
 */
export function typeShareDigit(cast: ShareCast, digit: number): ShareCast {
  if (cast.done) return cast;
  if (!Number.isInteger(digit) || digit < 0 || digit > 9) return cast;
  const entry = entryOf(cast, cast.box);
  if (cast.box === "each" && entry === "" && digit === 0) return cast;
  if (entry.length >= roomIn(cast, cast.box)) return cast;
  return withEntry(cast, cast.box, entry + String(digit));
}

export function backspaceShare(cast: ShareCast): ShareCast {
  if (cast.done) return cast;
  const entry = entryOf(cast, cast.box);
  // An empty box steps back to the one before it rather than doing nothing:
  // a child who has filled the share and started the leftovers has no other
  // way of getting back, and a key that does nothing reads as a broken key.
  if (entry === "") {
    const boxes = boxesOf(cast.problem);
    const at = boxes.indexOf(cast.box);
    const before = boxes[at - 1];
    return before ? { ...cast, box: before, wrong: false } : cast;
  }
  return withEntry(cast, cast.box, entry.slice(0, -1));
}

/**
 * Answer.
 *
 * With two boxes, the first press of the key moves on rather than answering:
 * a child who has typed the share and pressed go has said half of it, and
 * marking that wrong would be marking them wrong for being half done.
 */
export function submitShare(cast: ShareCast): ShareCast {
  if (cast.done) return cast;
  const boxes = boxesOf(cast.problem);
  if (entryOf(cast, cast.box) === "") return cast;
  const at = boxes.indexOf(cast.box);
  const next = boxes[at + 1];
  if (next && entryOf(cast, next) === "") return { ...cast, box: next, wrong: false };
  const right =
    Number(cast.each) === cast.problem.each &&
    (!asksLeft(cast.problem) || Number(cast.left) === cast.problem.left);
  if (!right) {
    return { ...cast, each: "", left: "", box: "each", missteps: cast.missteps + 1, wrong: true };
  }
  return { ...cast, done: true, wrong: false };
}

/**
 * How much of the dealing is done for a stuck child.
 *
 * Rings, never the answer. The first wrong answer deals out the rings the
 * rung already gave plus one more, and every wrong answer after that deals
 * another — but never the last, because the last ring dealt is the answer
 * written out.
 *
 * At the bare tier there are no rings to deal, so the help is a sentence
 * instead: count up in shares until you reach the heap. That is the same
 * ladder the array spell's hint climbs, and it stops one step short for the
 * same reason.
 */
export function shareHint(cast: ShareCast): number {
  const { given, parts, hintAfter } = cast.problem;
  if (cast.missteps < hintAfter) return given;
  return Math.min(parts - 1, given + 1 + (cast.missteps - hintAfter));
}

/** What the leftovers look like once this many rings have been dealt. */
export function heapLeft(problem: ShareProblem, dealt: number): number {
  return problem.total - Math.max(0, Math.min(problem.parts, dealt)) * problem.each;
}

/**
 * The share the fisherman works through, for a child on this rung.
 *
 * Chosen rather than rolled, which is the difference between an example and
 * a sample. The generator is right to hand a *cast* whatever the ladder
 * allows — one each into two baskets is a perfectly good question — and
 * quite wrong to teach on it: a lesson whose picture is two baskets with one
 * thing in each has demonstrated nothing that could not be seen without it.
 *
 * So: three baskets where the rung has room for three, four things in each
 * where it has room for four, and a leftover if the rung is one that has
 * them. `lessonFor` cuts a fixed sum down to size for exactly this reason,
 * and `geometryLessonFor` walks a fixed journey.
 */
export function shareLessonFor(rung: ShareRung): ShareProblem {
  const parts = Math.max(2, Math.min(rung.mostParts, 3));
  const each = Math.max(2, Math.min(rung.mostEach, 4));
  const left = rung.remainders ? Math.min(parts - 1, 2) : 0;
  return {
    total: each * parts + left,
    parts,
    each,
    left,
    remainders: rung.remainders,
    tier: rung.tier,
    given: 0,
    hintAfter: rung.hintAfter,
  };
}

/**
 * What the fisherman shows you, one idea per page.
 *
 * The same four-beat shape the other teachers keep: what the spell is, then
 * the thing it acts on, then the method, then the one idea a picture cannot
 * carry on its own.
 */
export const ShareBeat = {
  /** What it is and where it lives: the spellbook and the obelus. */
  Rune: "rune",
  /** The heap. One pile, and the question of what to do with it. */
  Heap: "heap",
  /** Dealing. The baskets, filled one at a time — the method. */
  Deal: "deal",
  /** And what will not go: the leftovers, named. */
  Over: "over",
} as const;

export type ShareBeat = (typeof ShareBeat)[keyof typeof ShareBeat];

const SHARE_BEATS: readonly ShareBeat[] = [
  ShareBeat.Rune,
  ShareBeat.Heap,
  ShareBeat.Deal,
  ShareBeat.Over,
];

/**
 * The pages he actually turns, for a child on this rung.
 *
 * Cut the way the geometer's is, and for the reason a playtest gave him:
 * a method demonstrated on a question a child has not been asked is a method
 * they cannot check. The bottom rungs deal shares that come out even and
 * never meet a leftover in the spell — so they do not meet one here either.
 * The page arrives with the thing it is about.
 */
export function shareBeatsFor(rung: ShareRung): readonly ShareBeat[] {
  return rung.remainders ? SHARE_BEATS : SHARE_BEATS.filter((beat) => beat !== ShareBeat.Over);
}
