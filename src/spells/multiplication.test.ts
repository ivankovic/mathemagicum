// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import { PATCH_REACH } from "../world/selection";
import {
  ARRAY_RUNGS,
  ArrayTier,
  HARDEST_ARRAY_RUNG,
  arrayHint,
  arrayProblemFor,
  arrayRungAt,
  backspaceArray,
  beginArrayCast,
  rowTotals,
  showsDots,
  submitArray,
  totalOf,
  typeArrayDigit,
} from "./multiplication";

const patch = (rows: number, columns: number, at = 0) =>
  arrayProblemFor(rows, columns, arrayRungAt(at));

describe("the ladder", () => {
  /**
   * The rule the whole redesign rests on. The child draws the rectangle, so
   * the child sets the numbers; a rung that also set the size would be
   * locking a *tool* behind arithmetic, which `difficulty.ts` rules out.
   */
  test("changes the help, never the size", () => {
    for (const [at] of ARRAY_RUNGS.entries()) {
      const problem = arrayProblemFor(6, 7, arrayRungAt(at));
      expect({ at, rows: problem.rows, columns: problem.columns }).toEqual({
        at,
        rows: 6,
        columns: 7,
      });
    }
  });

  test("takes something away at every step and gives nothing back", () => {
    const help = ARRAY_RUNGS.map((rung) => ({
      dots: rung.tier !== ArrayTier.Times,
      counted: rung.given,
      patience: rung.hintAfter,
    }));
    for (const [at, here] of help.entries()) {
      const before = help[at - 1];
      if (!before) continue;
      const easier =
        (before.dots ? 1 : 0) >= (here.dots ? 1 : 0) &&
        before.counted >= here.counted &&
        before.patience <= here.patience;
      expect({ at, easier }).toEqual({ at, easier: true });
    }
    // And it really does end with nothing drawn at all.
    expect(showsDots(patch(4, 4, HARDEST_ARRAY_RUNG))).toBe(false);
    expect(showsDots(patch(4, 4, 0))).toBe(true);
  });

  test("clamps a saved rung that is nonsense", () => {
    expect(arrayRungAt(-4)).toEqual(ARRAY_RUNGS[0] as never);
    expect(arrayRungAt(99)).toEqual(ARRAY_RUNGS[HARDEST_ARRAY_RUNG] as never);
  });
});

describe("the question a patch asks", () => {
  test("is the rectangle the player drew", () => {
    const problem = patch(3, 8);
    expect({ rows: problem.rows, columns: problem.columns }).toEqual({ rows: 3, columns: 8 });
    expect(totalOf(problem)).toBe(24);
  });

  // The last running total *is* the answer, so a rung that scaffolds three
  // rows has to hand back nothing at all on a patch two deep.
  test("never gives away every row, however much the rung wants to", () => {
    for (const [at] of ARRAY_RUNGS.entries()) {
      for (const rows of [1, 2, 3, 4]) {
        const problem = arrayProblemFor(rows, 5, arrayRungAt(at));
        expect({ at, rows, ok: problem.given < rows }).toEqual({ at, rows, ok: true });
      }
    }
  });

  test("counts along by rows, ending on the answer", () => {
    const totals = rowTotals(patch(4, 6));
    expect(totals).toEqual([6, 12, 18, 24]);
    expect(totals.at(-1)).toBe(totalOf(patch(4, 6)));
  });

  // A single row is a fine first times table; the patch geometry allows one,
  // so the spell has to answer for it.
  test("handles a patch one square deep", () => {
    const problem = patch(1, 5);
    expect(problem.given).toBe(0);
    expect(totalOf(problem)).toBe(5);
    expect(rowTotals(problem)).toEqual([5]);
  });

  test("handles the biggest patch the ground allows", () => {
    expect(totalOf(patch(PATCH_REACH, PATCH_REACH, HARDEST_ARRAY_RUNG))).toBe(100);
  });
});

describe("answering", () => {
  const problem = patch(4, 6);

  test("takes the total and finishes", () => {
    let cast = beginArrayCast(problem);
    cast = typeArrayDigit(cast, 2);
    cast = typeArrayDigit(cast, 4);
    cast = submitArray(cast);
    expect({ done: cast.done, missteps: cast.missteps }).toEqual({ done: true, missteps: 0 });
  });

  test("a wrong answer clears the box and never ends the cast", () => {
    let cast = submitArray(typeArrayDigit(typeArrayDigit(beginArrayCast(problem), 1), 0));
    expect({
      done: cast.done,
      entry: cast.entry,
      wrong: cast.wrong,
      missteps: cast.missteps,
    }).toEqual({ done: false, entry: "", wrong: true, missteps: 1 });
    cast = submitArray(typeArrayDigit(typeArrayDigit(cast, 2), 4));
    expect(cast.done).toBe(true);
  });

  test("the box takes no more digits than the answer has", () => {
    let cast = beginArrayCast(patch(2, 3));
    cast = typeArrayDigit(typeArrayDigit(cast, 6), 6);
    expect(cast.entry).toBe("6");
  });

  test("a leading zero is dropped rather than typed", () => {
    expect(typeArrayDigit(beginArrayCast(problem), 0).entry).toBe("");
  });

  test("backspace clears the mark on a wrong box", () => {
    let cast = submitArray(typeArrayDigit(beginArrayCast(problem), 9));
    expect(cast.wrong).toBe(true);
    cast = backspaceArray(typeArrayDigit(cast, 9));
    expect({ entry: cast.entry, wrong: cast.wrong }).toEqual({ entry: "", wrong: false });
  });

  // The right answer stays in the box rather than being wiped: the last
  // thing a child sees is the number they got right, under the patch that
  // explains it.
  test("nothing changes once it is solved, and the answer stays on the parchment", () => {
    const cast = submitArray(typeArrayDigit(typeArrayDigit(beginArrayCast(problem), 2), 4));
    expect(cast.entry).toBe("24");
    expect(submitArray(typeArrayDigit(cast, 1))).toEqual(cast);
    expect(backspaceArray(cast)).toEqual(cast);
  });
});

describe("the help a stuck child is given", () => {
  test("shows nothing beyond the scaffolding until something is wrong", () => {
    expect(arrayHint(beginArrayCast(arrayProblemFor(5, 3, arrayRungAt(0))))).toBe(3);
  });

  test("lights one more row per wrong answer, from where the rung left off", () => {
    let cast = beginArrayCast(arrayProblemFor(6, 3, arrayRungAt(2))); // given 1
    expect(arrayHint(cast)).toBe(1);
    cast = submitArray(typeArrayDigit(cast, 9));
    expect(arrayHint(cast)).toBe(2);
    cast = submitArray(typeArrayDigit(cast, 9));
    expect(arrayHint(cast)).toBe(3);
  });

  // The top rungs make a child sit with it for one wrong answer before the
  // parchment starts counting: the last thing the ladder takes away.
  test("waits longer at the top of the ladder", () => {
    let cast = beginArrayCast(arrayProblemFor(6, 3, arrayRungAt(HARDEST_ARRAY_RUNG)));
    expect(arrayHint(cast)).toBe(0);
    cast = submitArray(typeArrayDigit(cast, 9));
    expect(arrayHint(cast)).toBe(0);
    cast = submitArray(typeArrayDigit(cast, 9));
    expect(arrayHint(cast)).toBe(1);
  });

  test("never lights the last row — that one is the answer", () => {
    let cast = beginArrayCast(arrayProblemFor(3, 4, arrayRungAt(0)));
    for (let n = 0; n < 10; n++) cast = submitArray(typeArrayDigit(cast, 9));
    expect(arrayHint(cast)).toBe(2);
    expect(rowTotals(cast.problem)[arrayHint(cast) - 1]).toBe(8);
  });

  // Not a gap: a two-row patch with its first row given has one row left and
  // that row is the answer.
  test("has nothing more to offer on the smallest patches", () => {
    let cast = beginArrayCast(arrayProblemFor(2, 3, arrayRungAt(2)));
    expect(arrayHint(cast)).toBe(1);
    for (let n = 0; n < 5; n++) {
      cast = submitArray(typeArrayDigit(cast, 9));
      expect(arrayHint(cast)).toBe(1);
    }
  });
});
