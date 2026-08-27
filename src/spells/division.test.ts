// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import { createRng } from "../world/rng";
import {
  HARDEST_SHARE_RUNG,
  SHARE_RUNGS,
  type ShareProblem,
  ShareTier,
  asksLeft,
  backspaceShare,
  beginShareCast,
  boxesOf,
  focusShareBox,
  heapLeft,
  shareHint,
  shareProblemFor,
  shareRungAt,
  showsRings,
  submitShare,
  typeShareDigit,
} from "./division";

const SEEDS = Array.from({ length: 40 }, (_, n) => n * 7919 + 13);

/** Every rung, over enough seeds that a rare shape cannot hide. */
function everyProblem(): { rung: number; problem: ShareProblem }[] {
  const out: { rung: number; problem: ShareProblem }[] = [];
  for (const [rung] of SHARE_RUNGS.entries()) {
    for (const seed of SEEDS) {
      out.push({ rung, problem: shareProblemFor(createRng(seed), shareRungAt(rung)) });
    }
  }
  return out;
}

describe("setting a share", () => {
  test("the numbers always add up to the heap", () => {
    for (const { problem } of everyProblem()) {
      expect(problem.each * problem.parts + problem.left).toBe(problem.total);
    }
  });

  /**
   * The one promise a rung makes that a generator could quietly break.
   *
   * Built up from the answer rather than divided down from a heap for
   * exactly this: pick a total and a divisor and hope, and a five-year-old
   * on the bottom rung meets a remainder one time in three.
   */
  test("a rung that promises no leftovers has none, over and over", () => {
    for (const { rung, problem } of everyProblem()) {
      if (SHARE_RUNGS[rung]?.remainders) continue;
      expect({ rung, left: problem.left }).toEqual({ rung, left: 0 });
    }
  });

  test("and one that allows them is not always uneven either", () => {
    // Both outcomes turn up on the rungs that allow leftovers. A rung that
    // was uneven every single time would teach that division never comes out
    // right, which is the opposite mistake to the one above.
    const lefts = new Set(
      everyProblem()
        .filter(({ rung }) => SHARE_RUNGS[rung]?.remainders)
        .map(({ problem }) => problem.left),
    );
    expect(lefts.has(0)).toBe(true);
    expect(lefts.size).toBeGreaterThan(1);
  });

  test("nothing is ever shared fewer than two ways, or none each", () => {
    for (const { problem } of everyProblem()) {
      expect(problem.parts).toBeGreaterThanOrEqual(2);
      expect(problem.each).toBeGreaterThanOrEqual(1);
      // A leftover is always less than the number of ways, or it would have
      // gone round again — which is what division *means*.
      expect(problem.left).toBeLessThan(problem.parts);
    }
  });

  test("the rungs stay inside their own numbers", () => {
    for (const { rung, problem } of everyProblem()) {
      const setting = SHARE_RUNGS[rung];
      if (!setting) throw new Error("no such rung");
      expect(problem.each).toBeLessThanOrEqual(setting.mostEach);
      expect(problem.parts).toBeLessThanOrEqual(setting.mostParts);
    }
  });

  test("and asking past either end of the ladder gives its ends", () => {
    expect(shareRungAt(-5)).toEqual(SHARE_RUNGS[0] as never);
    expect(shareRungAt(99)).toEqual(SHARE_RUNGS[HARDEST_SHARE_RUNG] as never);
  });

  /**
   * Scaffolding never reaches the answer.
   *
   * The last ring dealt out *is* what each one gets, written in apples. A
   * rung that dealt every ring would be a rung that answered itself.
   */
  test("never every ring dealt for you", () => {
    for (const { problem } of everyProblem()) {
      expect(problem.given).toBeLessThan(problem.parts);
    }
  });
});

describe("which boxes are asked", () => {
  const bare = (remainders: boolean, left: number): ShareProblem => ({
    total: 23,
    parts: 5,
    each: 4,
    left,
    remainders,
    tier: ShareTier.Bare,
    given: 0,
    hintAfter: 2,
  });

  test("the rings are drawn everywhere but the top", () => {
    for (const { problem } of everyProblem()) {
      expect(showsRings(problem)).toBe(problem.tier !== ShareTier.Bare);
    }
  });

  /**
   * The leak this is here to stop.
   *
   * The leftover has a box of its own at the bare tier. If that box only
   * appeared when there was something to put in it, then its appearing would
   * answer the question — and a child would learn to read the parchment
   * rather than the numbers, and would be right to.
   */
  test("a leftover box that only showed for real leftovers would give it away", () => {
    expect(boxesOf(bare(true, 3))).toEqual(["each", "left"]);
    expect(boxesOf(bare(true, 0))).toEqual(["each", "left"]);
    expect(boxesOf(bare(false, 0))).toEqual(["each"]);
  });

  test("and where the rings are drawn the leftovers are never asked for", () => {
    for (const { problem } of everyProblem()) {
      if (!showsRings(problem)) continue;
      expect(asksLeft(problem)).toBe(false);
      expect(boxesOf(problem)).toEqual(["each"]);
    }
  });
});

describe("answering", () => {
  const problem = shareProblemFor(createRng(4), shareRungAt(2));
  const typed = (digits: readonly number[]) =>
    digits.reduce((cast, digit) => typeShareDigit(cast, digit), beginShareCast(problem));

  test("the right number finishes it", () => {
    const done = submitShare(typed(String(problem.each).split("").map(Number)));
    expect(done.done).toBe(true);
    expect(done.missteps).toBe(0);
  });

  test("a wrong one clears the box and counts, and nothing fails", () => {
    const wrong = submitShare(typed([9]));
    expect(wrong.done).toBe(false);
    expect(wrong.each).toBe("");
    expect(wrong.wrong).toBe(true);
    expect(wrong.missteps).toBe(1);
  });

  // On a rung whose answers run to two digits, so there is a digit left to
  // see. The box is only ever as wide as the answer it is for, which is why
  // typing two into a one-digit box above would have proved nothing.
  test("backspace takes a digit back", () => {
    const roomy: ShareProblem = {
      total: 25,
      parts: 2,
      each: 12,
      left: 1,
      remainders: true,
      tier: ShareTier.Bare,
      given: 0,
      hintAfter: 2,
    };
    let cast = typeShareDigit(beginShareCast(roomy), 1);
    cast = typeShareDigit(cast, 2);
    expect(cast.each).toBe("12");
    expect(backspaceShare(cast).each).toBe("1");
  });
});

describe("answering with a leftover as well", () => {
  const problem: ShareProblem = {
    total: 23,
    parts: 5,
    each: 4,
    left: 3,
    remainders: true,
    tier: ShareTier.Bare,
    given: 0,
    hintAfter: 2,
  };

  /**
   * Nought is a leftover and is not a share.
   *
   * The mirror of the array spell's rule rather than a copy of it. No share
   * is nothing — a heap dealt five ways puts *something* in each — so a
   * leading nought there can only be a slip. A leftover of nothing is the
   * commonest answer there is, and a box that would not take it could not be
   * answered.
   */
  test("the share refuses a leading nought and the leftovers take one", () => {
    const cast = beginShareCast(problem);
    expect(typeShareDigit(cast, 0).each).toBe("");
    const atLeft = focusShareBox(cast, "left");
    expect(typeShareDigit(atLeft, 0).left).toBe("0");
  });

  test("answering the share moves on rather than answering the question", () => {
    const half = submitShare(typeShareDigit(beginShareCast(problem), 4));
    expect(half.done).toBe(false);
    expect(half.wrong).toBe(false);
    expect(half.box).toBe("left");
  });

  test("and both together finish it", () => {
    let cast = submitShare(typeShareDigit(beginShareCast(problem), 4));
    cast = submitShare(typeShareDigit(cast, 3));
    expect(cast.done).toBe(true);
    expect(cast.missteps).toBe(0);
  });

  test("a right share and a wrong leftover is still wrong, and clears both", () => {
    let cast = submitShare(typeShareDigit(beginShareCast(problem), 4));
    cast = submitShare(typeShareDigit(cast, 1));
    expect(cast.done).toBe(false);
    expect({ each: cast.each, left: cast.left, box: cast.box }).toEqual({
      each: "",
      left: "",
      box: "each",
    });
  });

  // An empty box steps back rather than doing nothing: a child who has filled
  // the share and started on the leftovers has no other way of getting back,
  // and a key that does nothing reads as a broken key.
  test("backspace on an empty leftovers box goes back to the share", () => {
    const cast = submitShare(typeShareDigit(beginShareCast(problem), 4));
    expect(backspaceShare(cast).box).toBe("each");
    // And on the first box with nothing in it, it stays put.
    expect(backspaceShare(beginShareCast(problem)).box).toBe("each");
  });
});

describe("help, when it comes", () => {
  const problem = shareProblemFor(createRng(11), shareRungAt(2));

  test("nothing before the rung says so", () => {
    expect(shareHint(beginShareCast(problem))).toBe(problem.given);
  });

  test("then one more ring dealt for every wrong answer", () => {
    let cast = beginShareCast(problem);
    let last = shareHint(cast);
    for (let go = 0; go < 6; go++) {
      cast = { ...cast, missteps: cast.missteps + 1 };
      const now = shareHint(cast);
      expect(now).toBeGreaterThanOrEqual(last);
      last = now;
    }
  });

  /**
   * And never the last ring.
   *
   * Dealing the last one out is writing the answer in apples. The hint
   * climbs and stops one short, the same way the array spell's does.
   */
  test("but never the last one, however long it takes", () => {
    for (const { problem: shape } of everyProblem()) {
      const stuck = { ...beginShareCast(shape), missteps: 50 };
      expect(shareHint(stuck)).toBeLessThan(shape.parts);
    }
  });
});

describe("what the heap looks like part way through", () => {
  const problem: ShareProblem = {
    total: 23,
    parts: 5,
    each: 4,
    left: 3,
    remainders: true,
    tier: ShareTier.Rings,
    given: 0,
    hintAfter: 2,
  };

  test("nothing dealt is the whole heap, and all of it dealt is the leftovers", () => {
    expect(heapLeft(problem, 0)).toBe(23);
    expect(heapLeft(problem, 5)).toBe(3);
  });

  test("and it comes down a share at a time", () => {
    expect(heapLeft(problem, 1)).toBe(19);
    expect(heapLeft(problem, 3)).toBe(11);
  });

  test("asking past the end is the same as asking at it", () => {
    expect(heapLeft(problem, 99)).toBe(problem.left);
    expect(heapLeft(problem, -4)).toBe(problem.total);
  });
});
