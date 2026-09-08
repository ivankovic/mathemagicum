// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import { createRng } from "../world/rng";
import { makeAdditionProblem } from "./addition";
import {
  COUNTER_COLOURS,
  SPARE_COUNTERS,
  boxIsRight,
  countingRound,
  pickColour,
  trayFor,
} from "./counting";
import { RUNGS, rungAt } from "./difficulty";
import { makeSubtractionProblem } from "./subtraction";

/** The bottom of the ladder, which is what this is shown at. */
const EASIEST = rungAt(0);

describe("a counting round", () => {
  test("is the line's own arithmetic, read as a quantity", () => {
    const problem = makeAdditionProblem(createRng(7), EASIEST);
    const round = countingRound(problem, createRng(1));
    expect(round.from).toBe(problem.start);
    expect(round.to).toBe(problem.stops[0] ?? -1);
    expect(round.moves).toBe(problem.jumps[0] ?? -1);
    // Nothing invented: the box ends where the line lands.
    expect(round.from + (round.takingAway ? -round.moves : round.moves)).toBe(round.to);
  });

  test("starts with too few to add to, over every seed the rung has", () => {
    for (let seed = 0; seed < 200; seed++) {
      const round = countingRound(makeAdditionProblem(createRng(seed), EASIEST), createRng(seed));
      expect(round.takingAway).toBe(false);
      expect(round.from).toBeLessThan(round.to);
      expect(round.moves).toBeGreaterThan(0);
    }
  });

  test("and with too many to take from, over every seed", () => {
    for (let seed = 0; seed < 200; seed++) {
      const round = countingRound(
        makeSubtractionProblem(createRng(seed), EASIEST),
        createRng(seed),
      );
      expect(round.takingAway).toBe(true);
      expect(round.from).toBeGreaterThan(round.to);
      expect(round.moves).toBeGreaterThan(0);
    }
  });

  test("never asks for a box that cannot be filled by hand", () => {
    // The counters are things a child moves one at a time. If the easiest
    // rung ever grew past what a small hand and a small screen can hold,
    // this is where it would say so rather than in a playtest.
    for (let seed = 0; seed < 200; seed++) {
      for (const problem of [
        makeAdditionProblem(createRng(seed), EASIEST),
        makeSubtractionProblem(createRng(seed), EASIEST),
      ]) {
        const round = countingRound(problem, createRng(seed));
        expect(round.moves).toBeLessThanOrEqual(10);
        expect(Math.max(round.from, round.to)).toBeLessThanOrEqual(20);
      }
    }
  });

  test("refuses a line with no jump in it rather than inventing one", () => {
    expect(() => countingRound({ start: 3, jumps: [], stops: [] }, createRng(1))).toThrow();
  });
});

describe("the box", () => {
  const round = {
    from: 2,
    to: 5,
    moves: 3,
    takingAway: false,
    colour: COUNTER_COLOURS[0] ?? "blue",
  } as const;

  test("is right when it holds what was asked for, however it got there", () => {
    expect(boxIsRight(round, 5)).toBe(true);
    expect(boxIsRight(round, 4)).toBe(false);
    expect(boxIsRight(round, 6)).toBe(false);
    // Started at two, went to six, came back to five: right. A child who
    // overshoots and fixes it has not been wrong, and nothing here counts
    // how many times she moved one.
    expect(boxIsRight(round, round.to)).toBe(true);
  });
});

describe("the tray", () => {
  test("holds more than she needs, so emptying it is not the answer", () => {
    const adding = { from: 2, to: 5, moves: 3, takingAway: false, colour: "blue" } as const;
    expect(trayFor(adding)).toBe(3 + SPARE_COUNTERS);
    expect(trayFor(adding)).toBeGreaterThan(adding.moves);
  });

  test("is empty when the counters come out of the box instead", () => {
    const taking = { from: 8, to: 5, moves: 3, takingAway: true, colour: "red" } as const;
    expect(trayFor(taking)).toBe(0);
  });
});

describe("the colour", () => {
  test("is one of the ones there are", () => {
    for (let seed = 0; seed < 50; seed++) {
      expect(COUNTER_COLOURS).toContain(pickColour(createRng(seed)));
    }
  });

  test("is not always the same one", () => {
    const seen = new Set(Array.from({ length: 200 }, (_, seed) => pickColour(createRng(seed))));
    expect(seen.size).toBeGreaterThan(1);
  });

  test("means nothing, so the same sum can come up in any of them", () => {
    // Stated as a test because it is a design decision somebody could
    // undo by accident: if a colour ever started meaning `take away`, this
    // is what would catch it.
    const problem = makeAdditionProblem(createRng(3), EASIEST);
    const colours = new Set(
      Array.from({ length: 200 }, (_, seed) => countingRound(problem, createRng(seed)).colour),
    );
    expect(colours.size).toBeGreaterThan(1);
  });

  test("every rung the ladder starts with is one jump, which is what this draws", () => {
    const first = RUNGS[0];
    expect(first?.places).toBe(1);
  });
});
