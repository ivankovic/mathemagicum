// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { CLEAN_TO_CLIMB, type Recent, STUMBLES_TO_EASE } from "../spells/difficulty";
import { HUES, type Hue, type Rule, SHAPES, type Shape, type Token, passes } from "../spells/logic";
import { type Rng, randInt } from "../world/rng";

/**
 * The funnel's own minigame: two rings on the ground, and what goes where.
 *
 * **A machine is not woken by a spell any more.** Every machine type has a
 * category of its own, and solving one from that category is what wakes a
 * machine of that type — so the thing a child is asked is about *that
 * machine*, and asking is the machine wanting to be shown the idea it is
 * about to spend its life embodying. Seven machines used to share one logic
 * parchment between them, which is why its ladder changed shape halfway up
 * and why `machines.ts` had a comment saying "the three machines that
 * decide" over a list of seven.
 *
 * **The funnel's idea is the union, so the funnel's category is sets.** Two
 * mouths, one spout, and it never waits: whatever arrives at either goes on
 * down. Drawn on the ground that is two rings that overlap — a thing in
 * either ring goes down the spout, and the lens where they cross is the part
 * a child has to *see* rather than be told, because it is the one place a
 * thing is in both rings at once and still only goes down the spout once.
 *
 * **Nothing new to read.** The rings are labelled with the swatches the
 * logic tray already used — a red swatch, a round swatch — and the things
 * are the same coloured shapes. A child who has met the machines has met
 * this vocabulary, and a Venn diagram is then only a new *place to put*
 * something rather than a new thing to learn. Still no numerals: a shape is
 * red or it is not.
 */

/**
 * Where a thing belongs, once there are two rings.
 *
 * Four regions and not three: the outside is a region, and it is the one
 * most worth having. A diagram whose things all land inside it teaches that
 * everything belongs somewhere, which is not what a set is.
 */
export const Region = {
  /** In the left ring only. */
  Left: "left",
  /** In both: the lens where they cross. */
  Both: "both",
  /** In the right ring only. */
  Right: "right",
  /** In neither, on the ground around them. */
  Outside: "outside",
} as const;

export type Region = (typeof Region)[keyof typeof Region];

export const REGIONS: readonly Region[] = Object.values(Region);

/** One round: the rings, and the things waiting to be put in them. */
export interface VennRound {
  /** What the left ring holds. Always present, even on a one-ring rung. */
  readonly left: Rule;
  /**
   * What the right ring holds, or null while there is only one ring.
   *
   * A rung with one ring is a rung about *belonging* and nothing else, and
   * it is where the ladder starts: a child puts the red things in the ring
   * before anything overlaps, because "in or out" is the whole of what a
   * set is and the lens is a second idea on top of it.
   */
  readonly right: Rule | null;
  readonly tokens: readonly Token[];
}

/**
 * Which region a thing belongs in.
 *
 * The only judgement in the file, and it is a lookup rather than a rule the
 * child has to be told: a thing is in a ring when the ring's swatch
 * describes it. With one ring the right-hand regions cannot arise, and a
 * thing the ring does not describe is outside it — which is why `Outside`
 * is answered rather than `Right`.
 */
export function regionOf(round: VennRound, token: Token): Region {
  const inLeft = passes(round.left, token);
  const inRight = round.right !== null && passes(round.right, token);
  if (inLeft && inRight) return Region.Both;
  if (inLeft) return Region.Left;
  if (inRight) return Region.Right;
  return Region.Outside;
}

/** Whether she put it where it goes. */
export function placedRight(round: VennRound, token: Token, region: Region): boolean {
  return regionOf(round, token) === region;
}

/**
 * What goes down the spout: the union, which is what a funnel does.
 *
 * Not asked of the child on every rung — she is sorting, and the sorting is
 * the lesson — but it is what the diagram is *for*, and the last rung asks
 * for it directly. Stated here as a function so that the machine and the
 * parchment cannot disagree about what a funnel passes.
 */
export function goesThrough(round: VennRound, token: Token): boolean {
  return regionOf(round, token) !== Region.Outside;
}

/** Which regions exist to be dropped into, this round. */
export function regionsOf(round: VennRound): readonly Region[] {
  return round.right === null ? [Region.Left, Region.Outside] : REGIONS;
}

export interface VennRung {
  /** Whether the second ring is drawn at all. */
  readonly rings: 1 | 2;
  /** Whether the two rings may describe the same things, making a lens. */
  readonly overlaps: boolean;
  /** How many things are waiting to be sorted. */
  readonly tokens: number;
  /** How many stumbles before the parchment starts helping. */
  readonly hintAfter: number;
}

const rung = (rings: 1 | 2, overlaps: boolean, tokens: number, hintAfter = 1): VennRung => ({
  rings,
  overlaps,
  tokens,
  hintAfter,
});

/**
 * The ladder: from one ring to two that cross.
 *
 * One ring twice, because the second time it is a shape rather than a
 * colour and that is the rung where a child finds out the ring's label is
 * *saying something* rather than being a decoration. Then two rings that
 * cannot cross — a colour and a colour, so nothing is ever both — which is
 * the honest way to introduce a second ring: the lens is empty because
 * nothing belongs in it, not because she has not found it. Only then a
 * colour and a shape, which can cross, and the lens has something in it for
 * the first time.
 */
export const VENN_RUNGS: readonly VennRung[] = [
  rung(1, false, 4, 2),
  rung(1, false, 5, 2),
  rung(2, false, 5),
  rung(2, true, 6),
  rung(2, true, 7),
  rung(2, true, 8, 0),
];

export const HARDEST_VENN_RUNG = VENN_RUNGS.length - 1;

export function vennRungAt(rung: number): VennRung {
  const at = Math.max(0, Math.min(HARDEST_VENN_RUNG, Math.trunc(rung)));
  return VENN_RUNGS[at] as VennRung;
}

const hueRule = (hue: Hue): Rule => ({ kind: "hue", hue });
const shapeRule = (shape: Shape): Rule => ({ kind: "shape", shape });

function pick<T>(rng: Rng, from: readonly T[]): T {
  const at = randInt(rng, 0, from.length - 1);
  const one = from[at];
  if (one === undefined) throw new Error("nothing to pick from");
  return one;
}

/**
 * What the second ring holds, or nothing where the rung draws only one.
 *
 * A shape against a colour can cross; a colour against a colour cannot,
 * because nothing is two colours at once. So the rung and not the dice
 * decides whether there is a lens to find, which is what lets the ladder
 * show a second ring one rung before it shows an overlap.
 */
function otherRing(rng: Rng, rung: VennRung, leftHue: Hue): Rule | null {
  if (rung.rings === 1) return null;
  if (rung.overlaps) return shapeRule(pick(rng, SHAPES));
  const others = HUES.filter((hue) => hue !== leftHue);
  return hueRule(pick(rng, others));
}

/**
 * A round at this rung.
 *
 * The tokens are drawn at random and then *checked*, because a random
 * handful is very often a handful that teaches nothing: seven things none
 * of which is in both rings makes the lens look like a place things never
 * go, and a rung whose whole point is the lens has then taught the opposite
 * of itself. So a round that can have a lens must use it, and every round
 * must leave something outside — that is what `Outside` is for.
 */
export function vennRound(rng: Rng, rung: VennRung): VennRound {
  const leftHue = pick(rng, HUES);
  const left = hueRule(leftHue);
  const right = otherRing(rng, rung, leftHue);

  for (let tries = 0; tries < 200; tries++) {
    const tokens = Array.from({ length: rung.tokens }, (_, n) => ({
      id: `t${n}`,
      hue: pick(rng, HUES),
      shape: pick(rng, SHAPES),
    }));
    const round = { left, right, tokens };
    const seen = new Set(tokens.map((token) => regionOf(round, token)));
    // Something outside, always: a diagram everything fits inside is not
    // teaching what a ring is for.
    if (!seen.has(Region.Outside)) continue;
    // Something in the ring, or she is asked to do nothing at all.
    if (!seen.has(Region.Left) && !seen.has(Region.Both)) continue;
    // And the lens used, on the rungs that have one to use.
    if (rung.overlaps && !seen.has(Region.Both)) continue;
    return round;
  }
  throw new Error("could not draw a round that uses its own rings");
}

/**
 * Where the ladder goes next.
 *
 * The same shape as every other ladder in the game — see `nextLogicRung`,
 * which this deliberately mirrors — because a child who is climbing one is
 * climbing all of them and a category that moved differently would be a
 * category that felt unfair without anybody being able to say why.
 */
export function nextVennRung(rung: number, recent: Recent): number {
  const here = Math.max(0, Math.min(HARDEST_VENN_RUNG, Math.trunc(rung)));
  const clean = recent.slice(-CLEAN_TO_CLIMB);
  if (clean.length >= CLEAN_TO_CLIMB && clean.every(Boolean)) {
    return Math.min(HARDEST_VENN_RUNG, here + 1);
  }
  const stumbles = recent.slice(-STUMBLES_TO_EASE);
  if (stumbles.length >= STUMBLES_TO_EASE && stumbles.every((was) => !was)) {
    return Math.max(0, here - 1);
  }
  return here;
}
