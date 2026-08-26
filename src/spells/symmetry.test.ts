// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import { createRng } from "../world/rng";
import { CLEAN_TO_CLIMB, STUMBLES_TO_EASE } from "./difficulty";
import {
  type Cell,
  HARDEST_SYMMETRY_RUNG,
  MirrorAxis,
  SYMMETRY_RUNGS,
  type SymmetryCast,
  beginSymmetryCast,
  cellFrom,
  cellKey,
  fillCell,
  isSymmetric,
  makePuzzle,
  mirrorOf,
  nextSymmetryRung,
  symmetryHint,
  symmetryRungAt,
} from "./symmetry";

const SEEDS = Array.from({ length: 120 }, (_, i) => i * 7919 + 11);

/** Every puzzle a rung can set, for the seeds above. */
function puzzlesAt(rung: number) {
  return SEEDS.map((seed) => makePuzzle(createRng(seed), symmetryRungAt(rung)));
}

/** Play a cast through to the end, taking the squares it asks for. */
function finish(cast: SymmetryCast): SymmetryCast {
  let at = cast;
  // A copy, because `wanted` shrinks as it is worked through.
  for (const key of [...cast.wanted]) {
    const cell = cellFrom(key);
    if (cell) at = fillCell(at, cell);
  }
  return at;
}

describe("naming a square", () => {
  test("survives being written down and read back", () => {
    for (const cell of [
      { col: 0, row: 0 },
      { col: 3, row: 7 },
      { col: 12, row: 1 },
    ]) {
      expect(cellFrom(cellKey(cell))).toEqual(cell);
    }
  });

  test("and nonsense reads back as nothing", () => {
    for (const junk of ["", "3", "a,2", "1,b", "1.5,2"]) {
      expect({ junk, cell: cellFrom(junk) }).toEqual({ junk, cell: null });
    }
  });
});

describe("the mirror", () => {
  /**
   * Every one of them is its own inverse, and that is what makes the puzzle
   * finite: colouring a square's reflection can never ask for another one.
   * The whole `done` condition rests on it.
   */
  test("is its own inverse, whichever way the line runs", () => {
    for (const axis of Object.values(MirrorAxis)) {
      for (let size = 2; size <= 8; size++) {
        for (let col = 0; col < size; col++) {
          for (let row = 0; row < size; row++) {
            const there = mirrorOf({ col, row }, size, axis);
            const back = mirrorOf(there, size, axis);
            expect({ axis, size, back }).toEqual({ axis, size, back: { col, row } });
          }
        }
      }
    }
  });

  test("and never sends a square off the grid", () => {
    for (const axis of Object.values(MirrorAxis)) {
      for (let size = 2; size <= 8; size++) {
        for (let col = 0; col < size; col++) {
          for (let row = 0; row < size; row++) {
            const there = mirrorOf({ col, row }, size, axis);
            expect({
              axis,
              inside: there.col >= 0 && there.col < size && there.row >= 0 && there.row < size,
            }).toEqual({ axis, inside: true });
          }
        }
      }
    }
  });

  // The two straight ones turn one number round and leave the other alone;
  // the corner one swaps them, which is why it is the hardest rung.
  test("turns one number round, or swaps them", () => {
    expect(mirrorOf({ col: 0, row: 1 }, 5, MirrorAxis.Down)).toEqual({ col: 4, row: 1 });
    expect(mirrorOf({ col: 0, row: 1 }, 5, MirrorAxis.Across)).toEqual({ col: 0, row: 3 });
    expect(mirrorOf({ col: 0, row: 1 }, 5, MirrorAxis.Corner)).toEqual({ col: 1, row: 0 });
  });

  // A square sitting on the line is its own reflection, which is true and is
  // also why a scatter can come back with almost nothing to do.
  test("leaves the squares on the line where they are", () => {
    expect(mirrorOf({ col: 2, row: 4 }, 5, MirrorAxis.Down)).toEqual({ col: 2, row: 4 });
    expect(mirrorOf({ col: 3, row: 3 }, 7, MirrorAxis.Corner)).toEqual({ col: 3, row: 3 });
  });
});

describe("the puzzles the spell sets", () => {
  /**
   * The one that must never fail. A grid whose answer is already on it is
   * not an easy puzzle, it is a cast that finishes before the child has
   * touched anything.
   */
  test("every one of them asks for at least one square", () => {
    for (let rung = 0; rung <= HARDEST_SYMMETRY_RUNG; rung++) {
      for (const puzzle of puzzlesAt(rung)) {
        expect({ rung, asks: puzzle.wanted.length > 0 }).toEqual({ rung, asks: true });
      }
    }
  });

  test("and every square it asks for is on the grid and not already coloured", () => {
    for (let rung = 0; rung <= HARDEST_SYMMETRY_RUNG; rung++) {
      const size = symmetryRungAt(rung).size;
      for (const puzzle of puzzlesAt(rung)) {
        for (const key of puzzle.wanted) {
          const cell = cellFrom(key) as Cell;
          expect({ rung, key, on: puzzle.given.includes(key) }).toEqual({ rung, key, on: false });
          expect(cell.col).toBeGreaterThanOrEqual(0);
          expect(cell.col).toBeLessThan(size);
          expect(cell.row).toBeGreaterThanOrEqual(0);
          expect(cell.row).toBeLessThan(size);
        }
      }
    }
  });

  /**
   * And the answer is exactly the reflections, which is the whole rule.
   *
   * Checked against the mirror rather than against how the puzzle was made,
   * so a generator that started scattering squares some other way would
   * still have to produce a picture that folds.
   */
  test("and colouring exactly those squares makes the picture match", () => {
    for (let rung = 0; rung <= HARDEST_SYMMETRY_RUNG; rung++) {
      for (const seed of SEEDS.slice(0, 40)) {
        const done = finish(beginSymmetryCast(createRng(seed), symmetryRungAt(rung)));
        expect({ rung, seed, done: done.done }).toEqual({ rung, seed, done: true });
        expect({ rung, seed, matches: isSymmetric(done) }).toEqual({ rung, seed, matches: true });
      }
    }
  });

  // Nothing is symmetric before she starts, or there would be nothing to do.
  test("and the picture does not match to begin with", () => {
    for (let rung = 0; rung <= HARDEST_SYMMETRY_RUNG; rung++) {
      for (const seed of SEEDS.slice(0, 40)) {
        const cast = beginSymmetryCast(createRng(seed), symmetryRungAt(rung));
        expect({ rung, seed, matches: isSymmetric(cast) }).toEqual({ rung, seed, matches: false });
      }
    }
  });

  test("and the grid is the size its rung asked for", () => {
    for (let rung = 0; rung <= HARDEST_SYMMETRY_RUNG; rung++) {
      const wanted = symmetryRungAt(rung);
      for (const puzzle of puzzlesAt(rung)) {
        expect({ rung, size: puzzle.size }).toEqual({ rung, size: wanted.size });
        expect({ rung, allowed: wanted.axes.includes(puzzle.axis) }).toEqual({
          rung,
          allowed: true,
        });
      }
    }
  });

  // The complaint that ended the last version of this spell was that it was
  // always the same picture. A grid has far more to vary than a shape did,
  // and this is what says so out loud.
  test("and it is not the same picture every time", () => {
    for (let rung = 0; rung <= HARDEST_SYMMETRY_RUNG; rung++) {
      const seen = new Set(puzzlesAt(rung).map((one) => `${one.axis}|${[...one.given].sort()}`));
      expect({ rung, many: seen.size > 20 }).toEqual({ rung, many: true });
    }
  });
});

describe("colouring squares in", () => {
  const cast = () => beginSymmetryCast(createRng(5), symmetryRungAt(2));

  test("a wanted square is taken and stops being wanted", () => {
    const before = cast();
    const key = before.wanted[0] as string;
    const after = fillCell(before, cellFrom(key) as Cell);
    expect(after.filled).toContain(key);
    expect(after.wanted).not.toContain(key);
    expect(after.missteps).toBe(0);
    expect(after.wrong).toBeNull();
  });

  /**
   * And anything else is refused rather than coloured.
   *
   * Which is what keeps the grid readable: everything showing is either the
   * picture she was handed or an answer she got right, so a half-finished
   * grid is a half-finished thought rather than a mixture of working and
   * mistakes.
   */
  test("and anything else is a misstep, and is not coloured", () => {
    const before = cast();
    const wrong = { col: 0, row: 0 };
    // A square that is neither given nor wanted, found rather than assumed.
    const empty = allCells(before.size).find(
      (one) => !before.given.includes(cellKey(one)) && !before.wanted.includes(cellKey(one)),
    );
    const after = fillCell(before, empty ?? wrong);
    expect(after.missteps).toBe(1);
    expect(after.filled).toEqual([]);
    expect(after.wrong).toBe(cellKey(empty ?? wrong));
    expect(after.wanted).toEqual(before.wanted);
  });

  // A child who changes their mind takes it back, and it is wanted again.
  test("and one she coloured herself can be taken back", () => {
    const before = cast();
    const key = before.wanted[0] as string;
    const on = fillCell(before, cellFrom(key) as Cell);
    const off = fillCell(on, cellFrom(key) as Cell);
    expect(off.filled).not.toContain(key);
    expect(off.wanted).toContain(key);
    // Changing your mind is not a mistake.
    expect(off.missteps).toBe(on.missteps);
  });

  // The picture she was handed is not hers to rub out.
  test("but a square she was given is not", () => {
    const before = cast();
    const given = before.given[0] as string;
    const after = fillCell(before, cellFrom(given) as Cell);
    expect(after.given).toEqual(before.given);
    expect(after.missteps).toBe(1);
  });

  test("and a finished grid takes nothing more", () => {
    const done = finish(cast());
    expect(done.done).toBe(true);
    const after = fillCell(done, { col: 0, row: 0 });
    expect(after).toBe(done);
  });
});

describe("the help, when it comes", () => {
  test("waits for as many wrong squares as the rung says", () => {
    const rung = symmetryRungAt(HARDEST_SYMMETRY_RUNG);
    let cast = beginSymmetryCast(createRng(11), rung);
    const empty = allCells(cast.size).filter(
      (one) => !cast.given.includes(cellKey(one)) && !cast.wanted.includes(cellKey(one)),
    );
    expect(symmetryHint(cast)).toBeNull();
    for (let miss = 0; miss < rung.hintAfter; miss++) {
      cast = fillCell(cast, empty[miss] as Cell);
    }
    expect(symmetryHint(cast)).not.toBeNull();
  });

  // One square, not the answer. Being shown all of it is the end of the
  // puzzle rather than help with it.
  test("and gives away one square, which is one she still needs", () => {
    let cast = beginSymmetryCast(createRng(12), symmetryRungAt(0));
    const empty = allCells(cast.size).find(
      (one) => !cast.given.includes(cellKey(one)) && !cast.wanted.includes(cellKey(one)),
    );
    cast = fillCell(cast, empty as Cell);
    const shown = symmetryHint(cast);
    expect(shown).not.toBeNull();
    expect(cast.wanted).toContain(shown as string);
  });

  test("and says nothing once it is finished", () => {
    expect(symmetryHint(finish(beginSymmetryCast(createRng(13), symmetryRungAt(0))))).toBeNull();
  });
});

describe("the ladder", () => {
  test("climbs by grid, then by which way the line runs", () => {
    expect(SYMMETRY_RUNGS[0]?.size).toBe(4);
    expect(SYMMETRY_RUNGS[0]?.axes).toEqual([MirrorAxis.Down]);
    expect(SYMMETRY_RUNGS[HARDEST_SYMMETRY_RUNG]?.axes).toEqual([MirrorAxis.Corner]);
    // Never smaller than the rung below it.
    for (let at = 1; at <= HARDEST_SYMMETRY_RUNG; at++) {
      const under = symmetryRungAt(at - 1);
      const over = symmetryRungAt(at);
      expect({ at, grows: over.size >= under.size }).toEqual({ at, grows: true });
    }
  });

  test("and asking past either end gives the end", () => {
    expect(symmetryRungAt(-5)).toEqual(SYMMETRY_RUNGS[0] as never);
    expect(symmetryRungAt(99)).toEqual(SYMMETRY_RUNGS[HARDEST_SYMMETRY_RUNG] as never);
  });
});

describe("climbing the mirror ladder", () => {
  const clean = Array.from({ length: CLEAN_TO_CLIMB }, () => true);

  test("four found first time moves a child up", () => {
    expect(nextSymmetryRung(0, clean)).toBe(1);
  });

  test("and two in a row that took several goes moves them back down", () => {
    expect(
      nextSymmetryRung(
        3,
        Array.from({ length: STUMBLES_TO_EASE }, () => false),
      ),
    ).toBe(2);
  });

  test("but one of each leaves them where they are", () => {
    expect(nextSymmetryRung(2, [true, false, true])).toBe(2);
  });

  /**
   * And no band ever lifts anybody off the bottom of it.
   *
   * The whole reason this is not `nextRung`. Bands are counted in addition
   * rungs, and every other ladder fences a child inside theirs — which here
   * would put a nine year old on the corner mirror before they had ever been
   * shown a four-square grid.
   */
  test("and no band ever lifts anybody off the bottom of it", () => {
    expect(nextSymmetryRung(0, [])).toBe(0);
    expect(nextSymmetryRung(0, [true, false])).toBe(0);
    expect(nextSymmetryRung(0, [false, false])).toBe(0);
  });

  test("and neither end of the ladder can be walked off", () => {
    expect(nextSymmetryRung(HARDEST_SYMMETRY_RUNG, clean)).toBe(HARDEST_SYMMETRY_RUNG);
    expect(nextSymmetryRung(99, clean)).toBe(HARDEST_SYMMETRY_RUNG);
    expect(nextSymmetryRung(-4, [false, false])).toBe(0);
  });
});

/** Every square of a grid that size. */
function allCells(size: number): Cell[] {
  const out: Cell[] = [];
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) out.push({ col, row });
  }
  return out;
}
