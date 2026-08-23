// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import { createRng } from "../world/rng";
import {
  BRICK_COUNT,
  BRICK_PARENTS,
  BRICK_ROWS,
  BRICK_RUNGS,
  BRICK_TOP,
  type BrickCast,
  HARDEST_BRICK_RUNG,
  MOST_BACKWARDS,
  SOLVABLE_HIDINGS,
  backspaceBrick,
  beginBrickCast,
  brickBeingAsked,
  brickFace,
  brickHintShowing,
  brickRungAt,
  brickWorkingFrom,
  makeBrickProblem,
  solveBricks,
  submitBrick,
  typeBrickDigit,
} from "./bricks";

/** Every rung, drawn over and over — the invariants are about all of them. */
const DRAWS = 400;

function everyDraw(): { rung: number; problem: ReturnType<typeof makeBrickProblem> }[] {
  const drawn: { rung: number; problem: ReturnType<typeof makeBrickProblem> }[] = [];
  for (const [rung, setting] of BRICK_RUNGS.entries()) {
    const rng = createRng(rung * 7919 + 1);
    for (let draw = 0; draw < DRAWS; draw++) {
      drawn.push({ rung, problem: makeBrickProblem(rng, setting) });
    }
  }
  return drawn;
}

/** Type a number in one digit at a time, the way the keypad does. */
function typeNumber(cast: BrickCast, value: number): BrickCast {
  let next = cast;
  for (const digit of String(value)) next = typeBrickDigit(next, Number(digit));
  return next;
}

describe("the shape of a wall", () => {
  test("six bricks, three then two then one", () => {
    expect(BRICK_ROWS.map((row) => row.length)).toEqual([3, 2, 1]);
    expect(BRICK_ROWS.flat().sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(BRICK_ROWS.flat().length).toBe(BRICK_COUNT);
  });

  // The rule a child is told, checked against the rule the code uses. Every
  // brick above the bottom rests on the two nearest below it, and the top
  // rests on the pair — stated once in `BRICK_PARENTS` and read from there
  // by the solver, the generator and the hint.
  test("every brick above the bottom rests on the two under it", () => {
    expect(BRICK_PARENTS[3]).toEqual([0, 1]);
    expect(BRICK_PARENTS[4]).toEqual([1, 2]);
    expect(BRICK_PARENTS[5]).toEqual([3, 4]);
    expect(BRICK_PARENTS[0]).toBeUndefined();
    expect(BRICK_TOP).toBe(5);
  });
});

describe("which bricks may be rubbed out", () => {
  // Twenty ways to blank three of six; four of them take half the wall with
  // them. Rub out the left brick, the middle brick above it and the top, and
  // nothing left standing says what any of the three were.
  test("the ambiguous ways are left out, and the rest are all there", () => {
    const kept = Object.values(SOLVABLE_HIDINGS).flat();
    expect(kept.length).toBe(16);
    const named = new Set(kept.map((hiding) => hiding.join(",")));
    for (const ambiguous of ["0,1,2", "0,3,5", "1,3,4", "2,4,5"]) {
      expect({ ambiguous, kept: named.has(ambiguous) }).toEqual({ ambiguous, kept: false });
    }
  });

  test("and every one that is kept really does leave exactly one wall", () => {
    const wall = [3, 5, 2, 8, 7, 15];
    for (const hiding of Object.values(SOLVABLE_HIDINGS).flat()) {
      const showing = wall.map((value, at) => (hiding.includes(at) ? null : value));
      const solved = solveBricks(showing);
      expect({ hiding: hiding.join(","), values: solved?.values }).toEqual({
        hiding: hiding.join(","),
        values: wall,
      });
    }
  });

  // The ladder's axis. Every count from none to all three has to exist, or a
  // rung asking for it would have nothing to draw from.
  test("every amount of backwards working is available", () => {
    for (let backwards = 0; backwards <= MOST_BACKWARDS; backwards++) {
      const ways = SOLVABLE_HIDINGS[backwards] ?? [];
      expect({ backwards, any: ways.length > 0 }).toEqual({ backwards, any: true });
    }
    // One way to blank three bricks and leave nothing but addition: the three
    // upper ones. The first two rungs live here, and the repetition is the
    // point of them.
    expect(SOLVABLE_HIDINGS[0]).toEqual([[3, 4, 5]]);
  });

  test("and a hiding is filed under the amount of backwards working it needs", () => {
    const wall = [3, 5, 2, 8, 7, 15];
    for (const [backwards, ways] of Object.entries(SOLVABLE_HIDINGS)) {
      for (const hiding of ways) {
        const showing = wall.map((value, at) => (hiding.includes(at) ? null : value));
        const steps = solveBricks(showing)?.steps ?? [];
        const went = steps.filter((step) => step.backwards).length;
        expect({ hiding: hiding.join(","), went }).toEqual({
          hiding: hiding.join(","),
          went: Number(backwards),
        });
      }
    }
  });

  // Not a decoration: the panel asks for the gaps in this order, and an
  // order that depended on when it was asked would be a puzzle that
  // reshuffled itself while a child was looking at it.
  test("the order the gaps come in is the same every time it is asked", () => {
    const wall = [3, 5, 2, 8, 7, 15];
    for (const hiding of Object.values(SOLVABLE_HIDINGS).flat()) {
      const showing = wall.map((value, at) => (hiding.includes(at) ? null : value));
      const once = solveBricks(showing)?.steps.map((step) => step.brick);
      const twice = solveBricks(showing)?.steps.map((step) => step.brick);
      expect(once).toEqual(twice as never);
    }
  });

  test("a wall that is not determined says so rather than guessing", () => {
    // The bottom row rubbed out, with only the two middle bricks and the top
    // left: two equations, three unknowns, and any number of walls fit.
    expect(solveBricks([null, null, null, 8, 7, 15])).toBeNull();
  });
});

describe("the wall a cast is given", () => {
  const drawn = everyDraw();

  // The invariant the whole generator exists for. A wall is built whole and
  // then has bricks taken out, so what a child recovers is what was there —
  // and no gap can ask them for a negative number or a fraction, whichever
  // three were rubbed out.
  test("every wall is a real wall: whole numbers, one or more, adding up", () => {
    for (const { rung, problem } of drawn) {
      const { values } = problem;
      for (const [at, value] of values.entries()) {
        expect({ rung, at, ok: Number.isInteger(value) && value >= 1 }).toEqual({
          rung,
          at,
          ok: true,
        });
      }
      for (const [above, [left, right]] of Object.entries(BRICK_PARENTS)) {
        expect({ rung, above, sum: values[Number(above)] }).toEqual({
          rung,
          above,
          sum: (values[left] as number) + (values[right] as number),
        });
      }
    }
  });

  test("three bricks are rubbed out, and the gaps have exactly one answer", () => {
    for (const { rung, problem } of drawn) {
      expect({ rung, blanks: problem.hidden.length }).toEqual({ rung, blanks: 3 });
      const showing = problem.values.map((value, at) =>
        problem.hidden.includes(at) ? null : value,
      );
      const solved = solveBricks(showing);
      expect({ rung, recovered: solved?.values }).toEqual({ rung, recovered: problem.values });
    }
  });

  test("and the gaps asked for are the gaps that were rubbed out", () => {
    for (const { rung, problem } of drawn) {
      const asked = problem.steps.map((step) => step.brick).sort((a, b) => a - b);
      expect({ rung, asked }).toEqual({ rung, asked: [...problem.hidden].sort((a, b) => a - b) });
    }
  });
});

describe("the ladder", () => {
  const drawn = everyDraw();

  test("no wall tops out over its rung's ceiling", () => {
    for (const { rung, problem } of drawn) {
      const ceiling = brickRungAt(rung).ceiling;
      const top = problem.values[BRICK_TOP] as number;
      expect({ rung, ok: top <= ceiling }).toEqual({ rung, ok: true });
    }
  });

  /**
   * And no rung spends its time in the bottom of its own range.
   *
   * The top is a sum of three draws, so drawing the bottom row and letting
   * the top fall where it may clusters it low: a rung whose ceiling is a
   * thousand would set most of its walls in the low hundreds and a child
   * would never meet the sums it is named for. Drawn from the top down
   * instead, which this checks the consequence of.
   */
  test("and none of them sits in the bottom half of it either", () => {
    for (const { rung, problem } of drawn) {
      const ceiling = brickRungAt(rung).ceiling;
      const top = problem.values[BRICK_TOP] as number;
      expect({ rung, ok: top * 2 >= ceiling || top >= 4 * 2 }).toEqual({ rung, ok: true });
    }
  });

  test("a rung asks for exactly the amount of backwards working it names", () => {
    for (const { rung, problem } of drawn) {
      const went = problem.steps.filter((step) => step.backwards).length;
      expect({ rung, went }).toEqual({ rung, went: brickRungAt(rung).backwards });
    }
  });

  // One thing at a time, the way the number line's ladder climbs: a child
  // never meets a longer number and a new kind of gap in the same step.
  test("each step up changes the numbers or the working, never both", () => {
    for (let at = 1; at <= HARDEST_BRICK_RUNG; at++) {
      const under = brickRungAt(at - 1);
      const over = brickRungAt(at);
      const bigger = over.ceiling > under.ceiling;
      const harder = over.backwards > under.backwards;
      expect({ at, moved: bigger !== harder }).toEqual({ at, moved: true });
      expect({
        at,
        back: over.ceiling >= under.ceiling && over.backwards >= under.backwards,
      }).toEqual({ at, back: true });
    }
  });

  test("the easiest rung is pure addition and the hardest is all backwards", () => {
    expect(brickRungAt(0).backwards).toBe(0);
    expect(brickRungAt(HARDEST_BRICK_RUNG).backwards).toBe(MOST_BACKWARDS);
    expect(brickRungAt(-4)).toEqual(BRICK_RUNGS[0] as never);
    expect(brickRungAt(99)).toEqual(BRICK_RUNGS[HARDEST_BRICK_RUNG] as never);
  });
});

describe("filling the gaps in", () => {
  const problem = makeBrickProblem(createRng(11), brickRungAt(HARDEST_BRICK_RUNG));

  test("a fresh cast asks for the first gap and shows the rest as blank", () => {
    const cast = beginBrickCast(problem);
    expect(cast.done).toBe(false);
    expect(brickBeingAsked(cast)).toBe(problem.steps[0]?.brick as number);
    for (const brick of problem.hidden) expect(brickFace(cast, brick)).toBeNull();
    for (let brick = 0; brick < BRICK_COUNT; brick++) {
      if (problem.hidden.includes(brick)) continue;
      expect(brickFace(cast, brick)).toBe(problem.values[brick] as number);
    }
  });

  test("the right number fills the brick and moves on to the next gap", () => {
    let cast = beginBrickCast(problem);
    for (const step of problem.steps) {
      cast = submitBrick(typeNumber(cast, problem.values[step.brick] as number));
      expect(brickFace(cast, step.brick)).toBe(problem.values[step.brick] as number);
    }
    expect(cast.done).toBe(true);
    expect(cast.missteps).toBe(0);
    expect(brickBeingAsked(cast)).toBeNull();
  });

  // There is no fail state anywhere in this game. A wrong answer costs the
  // cast its cleanness, which is what the difficulty reads, and nothing else.
  test("a wrong number stays on the same brick and costs a misstep", () => {
    const first = problem.steps[0]?.brick as number;
    const answer = problem.values[first] as number;
    let cast = submitBrick(typeNumber(beginBrickCast(problem), answer + 1));
    expect(cast.wrong).toBe(true);
    expect(cast.entry).toBe("");
    expect(cast.missteps).toBe(1);
    expect(brickBeingAsked(cast)).toBe(first);
    expect(brickFace(cast, first)).toBeNull();
    // And getting there on the second go still builds the wall.
    cast = submitBrick(typeNumber(cast, answer));
    expect(brickFace(cast, first)).toBe(answer);
  });

  test("typing rules: no leading nought, no more digits than the top brick", () => {
    const cast = beginBrickCast(problem);
    expect(typeBrickDigit(cast, 0).entry).toBe("");
    expect(typeBrickDigit(cast, 12).entry).toBe("");
    const width = String(problem.values[BRICK_TOP] as number).length;
    let typed = cast;
    for (let at = 0; at < width + 3; at++) typed = typeBrickDigit(typed, 7);
    expect(typed.entry.length).toBe(width);
    expect(backspaceBrick(typed).entry.length).toBe(width - 1);
    expect(backspaceBrick(cast)).toBe(cast);
  });

  test("nothing happens once the wall is finished", () => {
    let cast = beginBrickCast(problem);
    for (const step of problem.steps) {
      cast = submitBrick(typeNumber(cast, problem.values[step.brick] as number));
    }
    expect(typeBrickDigit(cast, 5)).toBe(cast);
    expect(submitBrick(cast)).toBe(cast);
    expect(backspaceBrick(cast)).toBe(cast);
  });

  test("an empty entry is not a submission", () => {
    const cast = beginBrickCast(problem);
    expect(submitBrick(cast)).toBe(cast);
  });
});

describe("the help, when it comes", () => {
  test("it waits for as many wrong answers as the rung says", () => {
    const rung = brickRungAt(4);
    const cast = beginBrickCast(makeBrickProblem(createRng(3), rung));
    expect(brickHintShowing(cast, rung)).toBe(false);
    expect(brickHintShowing({ ...cast, missteps: 1 }, rung)).toBe(false);
    expect(brickHintShowing({ ...cast, missteps: 2 }, rung)).toBe(true);
  });

  /**
   * And it points at the working rather than saying the number.
   *
   * Two bricks, always: the pair underneath for a brick being added up to,
   * and the brick above plus its other child for one being worked back to.
   * The second is the one that matters — a child stuck on a bottom gap is
   * stuck because they are looking for two numbers to add, and what they
   * need shown is that the answer is above them.
   */
  test("it lights the two bricks the answer comes from, both ways round", () => {
    for (const { problem } of everyDraw()) {
      const cast = beginBrickCast(problem);
      const asked = brickBeingAsked(cast) as number;
      const from = brickWorkingFrom(cast);
      expect({ asked, pair: from.length }).toEqual({ asked, pair: 2 });
      // Whichever direction it goes, the two lit bricks and the asked one
      // are always one brick and the two it rests on — the rule itself,
      // pointed at. Found by looking for the member whose own two children
      // are the other two, rather than by assuming which one that is: all
      // three of the upper bricks rest on something.
      const family = [...from, asked].sort((a, b) => a - b);
      const holds = family.filter((brick) => {
        return BRICK_PARENTS[brick]?.every((child) => family.includes(child)) ?? false;
      });
      expect({ asked, from: [...from], holds: holds.length }).toEqual({
        asked,
        from: [...from],
        holds: 1,
      });
      // And never a brick that is itself still blank: a hint that pointed at
      // two gaps would be an instruction to work out the unknown from the
      // unknown.
      for (const lit of from) expect(brickFace(cast, lit)).not.toBeNull();
    }
  });

  test("and there is nothing to point at once the wall is done", () => {
    const problem = makeBrickProblem(createRng(9), brickRungAt(2));
    let cast = beginBrickCast(problem);
    for (const step of problem.steps) {
      cast = submitBrick(typeNumber(cast, problem.values[step.brick] as number));
    }
    expect(brickWorkingFrom(cast)).toEqual([]);
  });
});
