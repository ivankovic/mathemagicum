// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import { createRng } from "../world/rng";
import { beginCast, isSolved, submit, typeDigit } from "./addition";
import { BANDS, RUNGS, rungAt } from "./difficulty";
import {
  PLACE_FROM,
  type PlaceRound,
  asksPlace,
  digitsOfNumber,
  placeIsRight,
  placeLine,
  placeRound,
  placeValue,
} from "./place";

/** `4372`, with the 3 lit: three hundred. */
const HUNDREDS: PlaceRound = { number: 4372, at: 1, digit: 3, zeros: 2 };

describe("what a digit is worth", () => {
  test("is the digit and then its zeros", () => {
    expect(placeValue(HUNDREDS)).toBe(300);
    expect(placeValue({ number: 472, at: 1, digit: 7, zeros: 1 })).toBe(70);
    expect(placeValue({ number: 5138, at: 0, digit: 5, zeros: 3 })).toBe(5000);
    // The units, which is the rung where a child finds out the question is
    // about position at all.
    expect(placeValue({ number: 472, at: 2, digit: 2, zeros: 0 })).toBe(2);
  });

  test("and the answer is the value, not the digit", () => {
    expect(placeIsRight(HUNDREDS, "300")).toBe(true);
    expect(placeIsRight(HUNDREDS, "3")).toBe(false);
    expect(placeIsRight(HUNDREDS, "30")).toBe(false);
    expect(placeIsRight(HUNDREDS, "3000")).toBe(false);
  });

  test("nought is nought, however many of them she writes", () => {
    // The one rule that had to be said out loud. A nought in the hundreds
    // is worth nothing, and a child who answers `0` and a child who writes
    // the digit out with its zeros as `000` have both said the same true
    // thing. Reading the answer as a number accepts both without either
    // being a special case.
    const none: PlaceRound = { number: 4072, at: 1, digit: 0, zeros: 2 };
    expect(placeValue(none)).toBe(0);
    for (const said of ["0", "00", "000", "0000"]) {
      expect({ said, right: placeIsRight(none, said) }).toEqual({ said, right: true });
    }
    // And it is still nought and not anything else.
    expect(placeIsRight(none, "1")).toBe(false);
    expect(placeIsRight(none, "")).toBe(false);
  });

  test("and a nought in the units is the same nought", () => {
    const none: PlaceRound = { number: 470, at: 2, digit: 0, zeros: 0 };
    expect(placeIsRight(none, "0")).toBe(true);
    expect(placeIsRight(none, "00")).toBe(true);
  });
});

describe("a round", () => {
  const RUNGS_ASKED = RUNGS.map((rung, at) => ({ rung, at })).filter(({ rung, at }) =>
    asksPlace(rung, at),
  );

  test("is a number of the size the rung is already adding", () => {
    for (let seed = 0; seed < 200; seed++) {
      for (const { rung } of RUNGS_ASKED) {
        const round = placeRound(createRng(seed), rung);
        const digits = digitsOfNumber(round.number);
        expect(digits).toHaveLength(Math.max(3, rung.places));
        // A number does not start with a nought.
        expect(digits[0]).toBeGreaterThan(0);
      }
    }
  });

  test("lights a digit that is really there, in the place it really is", () => {
    // The join between the drawing and the arithmetic: `at` counts from the
    // left because that is how it is read, `zeros` counts from the right
    // because that is what it is worth, and a round where those two
    // disagreed would light one digit and mark another one right.
    for (let seed = 0; seed < 300; seed++) {
      for (const { rung } of RUNGS_ASKED) {
        const round = placeRound(createRng(seed), rung);
        const digits = digitsOfNumber(round.number);
        expect(digits[round.at]).toBe(round.digit);
        expect(round.zeros).toBe(digits.length - 1 - round.at);
        // And the value really is a slice of the number it came from.
        expect(placeValue(round)).toBeLessThanOrEqual(round.number);
      }
    }
  });

  test("asks about every place, the units included", () => {
    const rung = rungAt(PLACE_FROM);
    const seen = new Set(
      Array.from({ length: 200 }, (_, seed) => placeRound(createRng(seed), rung).zeros),
    );
    expect(seen.size).toBe(Math.max(3, rung.places));
    expect(seen.has(0)).toBe(true);
  });

  test("and does meet a nought, which is the case worth meeting", () => {
    const rung = rungAt(PLACE_FROM);
    const noughts = Array.from({ length: 400 }, (_, seed) =>
      placeRound(createRng(seed), rung),
    ).filter((round) => round.digit === 0);
    expect(noughts.length).toBeGreaterThan(0);
  });

  test("runs on a one-box line whose stop is the value", () => {
    const line = placeLine(HUNDREDS);
    expect(line.stops).toEqual([300]);
    expect(line.jumps).toEqual([300]);
  });
});

describe("where on the ladder it is asked", () => {
  test("nowhere the two gentlest bands can reach", () => {
    // What "only the two highest difficulties" means, as arithmetic. The
    // bands overlap by a rung, so the test is that no rung either of the
    // lower two spans is ever asked — not merely that the index looks high
    // enough.
    for (const band of BANDS.slice(0, 2)) {
      for (let rung = band.from; rung <= band.to; rung++) {
        expect({ rung, asks: asksPlace(rungAt(rung), rung) }).toEqual({ rung, asks: false });
      }
    }
  });

  test("and somewhere both of the hardest two can", () => {
    for (const [at, band] of BANDS.entries()) {
      if (at < 2) continue;
      const asked = [];
      for (let rung = band.from; rung <= band.to; rung++) {
        if (asksPlace(rungAt(rung), rung)) asked.push(rung);
      }
      expect({ band: at, any: asked.length > 0 }).toEqual({ band: at, any: true });
    }
  });

  test("and never of a number too short to have places", () => {
    // Two digits is barely a question and one is not one at all.
    for (const [at, rung] of RUNGS.entries()) {
      if (!asksPlace(rung, at)) continue;
      expect(rung.places).toBeGreaterThanOrEqual(3);
      expect(rung.counted).toBeUndefined();
    }
  });
});

describe("typing a written answer", () => {
  /** The nought in `4072`, whose value is nothing and whose writing is `000`. */
  const NONE: PlaceRound = { number: 4072, at: 1, digit: 0, zeros: 2 };

  test("takes a leading nought, which no sum does", () => {
    // The keypad used to swallow it: a leading zero is dropped everywhere
    // else because no stop on a number line starts with one. Here it is the
    // answer, and a button that did nothing would read as broken.
    const sum = beginCast(placeLine({ number: 472, at: 1, digit: 7, zeros: 1 }));
    expect(typeDigit(sum, 0).entry).toBe("");

    const written = beginCast(placeLine(NONE), 0, NONE.zeros + 1);
    expect(typeDigit(written, 0).entry).toBe("0");
  });

  test("and takes the digit with all of its zeros", () => {
    // `maxDigits` is the width of the biggest stop, which for a value of
    // nothing is one — so `000` would have been cut off after the first
    // keystroke. `asWritten` is what makes the box as wide as the writing.
    let state = beginCast(placeLine(NONE), 0, NONE.zeros + 1);
    for (const digit of [0, 0, 0]) state = typeDigit(state, digit);
    expect(state.entry).toBe("000");
    // And no wider than the writing: a fourth would be a number she was
    // never asked for.
    expect(typeDigit(state, 0).entry).toBe("000");
  });

  test("and both spellings are accepted by the cast itself", () => {
    for (const spelling of ["0", "000"]) {
      let state = beginCast(placeLine(NONE), 0, NONE.zeros + 1);
      for (const digit of spelling) state = typeDigit(state, Number(digit));
      expect({ spelling, solved: isSolved(submit(state)) }).toEqual({ spelling, solved: true });
    }
  });

  test("while a wrong value is still wrong, however it is spelled", () => {
    const round: PlaceRound = { number: 4372, at: 1, digit: 3, zeros: 2 };
    let state = beginCast(placeLine(round), 0, round.zeros + 1);
    for (const digit of "030") state = typeDigit(state, Number(digit));
    expect(isSolved(submit(state))).toBe(false);
  });
});

describe("and never where a rung already has a form", () => {
  test("not on a written rung, and not on a counted one", () => {
    // A rung is a number line unless it says otherwise, and the ones that
    // say otherwise each say it for a reason. A third question inside those
    // is the top of the ladder sometimes not being the top of the ladder.
    for (const [at, rung] of RUNGS.entries()) {
      if (rung.bare === undefined && !rung.counted) continue;
      expect({ at, asks: asksPlace(rung, at) }).toEqual({ at, asks: false });
    }
  });

  test("but on plenty of plain ones, so it is really asked", () => {
    const asked = RUNGS.filter((rung, at) => asksPlace(rung, at));
    expect(asked.length).toBeGreaterThanOrEqual(4);
  });
});
