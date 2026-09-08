// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { DECOR_TYPES, DecorType } from "./decor";
import { Turn, turnFrom } from "./facing";
import { FixtureType, PLACEABLE_FIXTURES } from "./fixtures";
import { isMachine } from "./machines";
import type { GridPoint } from "./topdown";

/**
 * What she does with a thing when she is not carrying it off.
 *
 * Everything a child puts down used to answer a tap one way: it went into
 * the basket. That made the furniture a kind of luggage — a bench was a
 * thing to have, never a thing to sit on — and a playtest asked, more or
 * less, *what is it for*. So every placed thing has a **use** now: a small
 * gesture she makes at it, or a place she settles on it for as long as she
 * is left there — see `LASTING` — and either way it changes nothing about
 * the world. It is the answer to *what is it for* in the only
 * language this game speaks, which is showing.
 *
 * **Every thing, not most things.** A fence is leaned on and a gate is
 * swung on, which is a stretch, and it is a deliberate one: the alternative
 * was a bench that asked *sit or take?* beside a fence that was simply
 * taken, and a child who has learned that tapping a thing asks what to do
 * with it should not find that some things skip the question. The rule for
 * turning says the same — "a child who taps a thing to turn it and finds
 * that this one cannot has learned nothing except that the rule has
 * exceptions."
 *
 * Machines are the exception that is not one: a tap on a machine wakes it,
 * which has always been its use, so they never reach the question.
 *
 * A move is a name rather than a description, because the description is
 * tweens and frames in the scene: the same six or seven little moves are
 * shared out over twenty things, and what this file settles is only which
 * gets which.
 */
export const Use = {
  /** Hop onto it and sit. Benches, chairs, rugs — anything she sits on. */
  Sit: "sit",
  /** Hop onto it, lie down, and let a moon or two rise. The bed. */
  Nap: "nap",
  /** Hop in and bob about. The bath. */
  Splash: "splash",
  /** Face it and bend to it, twice. The sink and the washstand. */
  Wash: "wash",
  /** Face it and wriggle with pleasure. Anything warm or bright. */
  Warm: "warm",
  /** Spin right round, twice, and hop. The dresser and the scarecrow. */
  Twirl: "twirl",
  /** Face it and tilt toward it. Tables and the fence. */
  Lean: "lean",
  /** Face it, reach in, and come up glad. Shelves and flowerpots. */
  Peek: "peek",
  /** Hop through and hop back. The gate. */
  Swing: "swing",
} as const;

export type Use = (typeof Use)[keyof typeof Use];

/**
 * The moves that put her *on* the thing rather than beside it.
 *
 * The scene wants to know, because being on a thing means hopping over to
 * its square — which she could not walk to, the thing being in the way —
 * and hopping back afterwards. Everything else is done from where she
 * stands, facing it.
 */
export const ON_THE_THING: readonly Use[] = [Use.Sit, Use.Nap, Use.Splash, Use.Swing];

/** Whether this move hops her onto the thing's own square. */
export function isOnTheThing(use: Use): boolean {
  return ON_THE_THING.includes(use);
}

/**
 * The moves she stays in until she is told otherwise.
 *
 * Two kinds of use, because there are two kinds of thing. A sink is used
 * and walked away from; a chair is *sat on*, and a child who sat her down
 * did not ask for her to get up again a second later. So sitting, lying
 * and bathing last: she settles, and stays settled — breathing, bobbing, a
 * moon now and then — until the next tap anywhere on the screen, or a
 * direction key, gets her up. Everything else plays once and is over.
 *
 * The rule under the split is *on or beside*: what she has got onto she
 * stays on, and what she does standing beside a thing is a gesture. The
 * gate is the one on-the-thing move that does not last, because going
 * through a gate is not a place to be.
 */
export const LASTING: readonly Use[] = [Use.Sit, Use.Nap, Use.Splash];

/** Whether this move keeps her until a tap, rather than for a second. */
export function isLasting(use: Use): boolean {
  return LASTING.includes(use);
}

/**
 * Which of a bed's two squares the pillow is on.
 *
 * She sleeps with her head on the pillow, which is a fact about the *art*:
 * the sheet draws the pillow at the top of a bed facing the camera, at the
 * bottom of one turned away, and at the left end of one lying side-on —
 * so the mirrored side-on bed has it at the right. `corner` is the bed's
 * anchor, its top-left square however it lies.
 */
export function pillowOf(turn: unknown, corner: GridPoint): GridPoint {
  switch (turnFrom(turn)) {
    case Turn.Away:
      return { col: corner.col, row: corner.row + 1 };
    case Turn.SideOther:
      return { col: corner.col + 1, row: corner.row };
    default:
      return corner;
  }
}

/** Anything she can put down and take back: a garden thing or a house thing. */
export type UsableThing = FixtureType | DecorType;

const USES: Partial<Record<string, Use>> = {
  // The garden.
  [FixtureType.Bench]: Use.Sit,
  [FixtureType.Table]: Use.Lean,
  [FixtureType.Lamp]: Use.Warm,
  [FixtureType.Fence]: Use.Lean,
  [FixtureType.Gate]: Use.Swing,
  [FixtureType.Scarecrow]: Use.Twirl,
  [FixtureType.Flowerpot]: Use.Peek,
  // The house.
  [DecorType.Bed]: Use.Nap,
  [DecorType.Chair]: Use.Sit,
  [DecorType.Rug]: Use.Sit,
  [DecorType.Privy]: Use.Sit,
  [DecorType.Table]: Use.Lean,
  [DecorType.Bookshelf]: Use.Peek,
  [DecorType.Dresser]: Use.Twirl,
  [DecorType.Stove]: Use.Warm,
  [DecorType.Kettle]: Use.Warm,
  [DecorType.Sink]: Use.Wash,
  [DecorType.Washstand]: Use.Wash,
  [DecorType.Bath]: Use.Splash,
};

/**
 * What she does with one thing, or nothing for a thing that has no use —
 * which is every machine and everything the village put down itself.
 */
export function useOf(thing: UsableThing): Use | null {
  return USES[thing] ?? null;
}

/**
 * Everything a child can put down that is not a machine.
 *
 * Named here because it is the list `useOf` promises to cover, and the test
 * that holds it to that promise should not have to derive the list again.
 */
export const USABLE_THINGS: readonly UsableThing[] = [
  ...PLACEABLE_FIXTURES.filter((fixture) => !isMachine(fixture)),
  ...DECOR_TYPES,
];

/**
 * How long each move takes, in milliseconds.
 *
 * For a brief move, from the tap to her standing back where she was. For a
 * lasting one, from the tap to her being *settled* — on the chair, sunk
 * into it, and ready to be got up by the next tap; before that a tap is
 * nothing, because she is in the air.
 *
 * Short on purpose either way. Nothing can be tapped while a move plays
 * — she is mid-hop — so a long one is a game that has stopped listening.
 * A brief move is long enough to be seen, which for a child who tapped to
 * see what would happen is about two seconds.
 */
export const USE_MS: Record<Use, number> = {
  [Use.Sit]: 500,
  [Use.Nap]: 500,
  [Use.Splash]: 400,
  [Use.Wash]: 1300,
  [Use.Warm]: 1300,
  [Use.Twirl]: 1500,
  [Use.Lean]: 1300,
  [Use.Peek]: 1300,
  [Use.Swing]: 1100,
};
