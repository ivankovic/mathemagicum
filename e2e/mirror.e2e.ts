// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { afterAll, describe, expect, test } from "bun:test";
import { HARDEST_SYMMETRY_RUNG, SYMMETRY_RUNGS } from "../src/spells/symmetry";
import { type Game, play, shutDown } from "./harness";

const MINUTES = 60_000;

// The dev server goes when this file is done with it, which is safe because
// `run.ts` gives every scenario file a process of its own.
afterAll(shutDown);

/**
 * Colouring a grid until both sides of the line match.
 *
 * The one spell with nothing to type. Every other parchment ends in a number
 * going into a box, and a script drives those by pressing keys; this one
 * ends in *taps on a picture*, so there is nothing to press and nothing on
 * screen with a name.
 *
 * What makes it drivable is that the picture is published: the grid comes
 * back with the squares it was given, the squares it still wants and where
 * it is drawn. The scenario taps the squares the *game* worked out rather
 * than ones it guessed — the same discipline the shop scenarios landed on,
 * where the price is read off the counter.
 */

interface Grid {
  size: number;
  axis: string;
  given: string[];
  wanted: string[];
  filled: string[];
  board: { left: number; top: number; step: number; cell: number; size: number } | null;
  done: boolean;
  missteps: number;
  wrong: string | null;
  hinting: boolean;
}

/**
 * Open the spellbook at the mirror, which is the last rune in it, and point
 * the spell at two squares.
 *
 * The rune alone does not open anything any more: the mirror asks *from*
 * and *to* before it asks the child anything, so a scenario that wants the
 * parchment has to answer both. The two squares either side of her are the
 * nearest ones there are, and every scenario in this half of the file cares
 * about the grid rather than about the ground it lands on.
 */
async function castMirror(game: Game): Promise<Grid> {
  const here = await game.where();
  await game.tap("spellbook");
  await game.tap("spellbook.5");
  await game.settle(300);
  await game.tapCell(here.col - 1, here.row);
  await game.settle(300);
  await game.tapCell(here.col + 1, here.row);
  await game.settle(500);
  const seen = await game.seam<Grid | null>("symmetry");
  if (!seen) throw new Error("the mirror parchment did not open");
  return seen;
}

/** Tap the middle of one square, by the grid's own name for it. */
async function tapSquare(game: Game, grid: Grid, key: string): Promise<Grid | null> {
  const board = grid.board;
  if (!board) throw new Error("the parchment published no grid");
  const [col, row] = key.split(",").map(Number);
  if (col === undefined || row === undefined) throw new Error(`not a square: ${key}`);
  await game.tab.mouse.click(
    board.left + col * board.step + board.cell / 2,
    board.top + row * board.step + board.cell / 2,
  );
  await game.settle(200);
  return game.seam<Grid | null>("symmetry");
}

/** A square that is neither part of the picture nor part of the answer. */
function anEmptyOne(grid: Grid): string {
  for (let row = 0; row < grid.size; row++) {
    for (let col = 0; col < grid.size; col++) {
      const key = `${col},${row}`;
      if (!grid.given.includes(key) && !grid.wanted.includes(key)) return key;
    }
  }
  throw new Error("this grid has no empty square");
}

describe("making both sides match", () => {
  /**
   * The whole spell, at the hardest rung.
   *
   * Deliberately the corner mirror on a seven-by-seven: the two straight
   * lines move a square along a row or down a column, and this one sends it
   * to the other number entirely. If the arithmetic behind the grid were
   * wrong anywhere, it would be wrong here.
   */
  test(
    "colour the squares it asks for and the picture matches",
    async () => {
      await play({ seams: `&learned=all&symmetryRung=${HARDEST_SYMMETRY_RUNG}` }, async (game) => {
        const opened = await castMirror(game);
        expect(opened.size).toBe(SYMMETRY_RUNGS[HARDEST_SYMMETRY_RUNG]?.size);
        expect(opened.axis).toBe("corner");
        expect(opened.wanted.length).toBeGreaterThan(0);
        expect(opened.done).toBe(false);

        let grid: Grid | null = opened;
        for (const key of opened.wanted) {
          grid = await tapSquare(game, opened, key);
          // Every one of them is taken, and none of them is a misstep.
          if (grid) expect(grid.missteps).toBe(0);
        }
        if (grid) expect(grid.done).toBe(true);

        // Finished parchments close themselves after a beat.
        await game.settle(1400);
        expect(await game.seam<Grid | null>("symmetry")).toBeNull();
      });
    },
    5 * MINUTES,
  );

  /**
   * And a square that is not part of the answer is refused, not coloured.
   *
   * Which is the whole of what keeps the grid readable: everything showing
   * is either the picture she was handed or an answer she got right, so a
   * half-finished grid is a half-finished thought rather than a mixture of
   * working and mistakes.
   */
  test(
    "a square that does not belong is refused rather than coloured",
    async () => {
      await play({ seams: "&learned=all&symmetryRung=2" }, async (game) => {
        const opened = await castMirror(game);
        const after = await tapSquare(game, opened, anEmptyOne(opened));
        expect(after?.missteps).toBe(1);
        expect(after?.filled).toEqual([]);
        expect(after?.done).toBe(false);
        // Still open, still the same picture, still answerable.
        expect(after?.given).toEqual(opened.given);
        expect(after?.wanted).toEqual(opened.wanted);
      });
    },
    5 * MINUTES,
  );

  /**
   * And she can change her mind.
   *
   * A square she coloured herself comes back off; a square she was handed
   * does not, because that is the picture she was given rather than her
   * working.
   */
  test(
    "and one she coloured can be taken back, but not one she was given",
    async () => {
      await play({ seams: "&learned=all&symmetryRung=2" }, async (game) => {
        const opened = await castMirror(game);
        const key = opened.wanted[0] as string;
        const on = await tapSquare(game, opened, key);
        expect(on?.filled).toContain(key);

        const off = await tapSquare(game, opened, key);
        expect(off?.filled).not.toContain(key);
        expect(off?.wanted).toContain(key);
        // Changing your mind is not a mistake.
        expect(off?.missteps).toBe(on?.missteps);

        // And the picture is not hers to rub out.
        const given = opened.given[0] as string;
        const after = await tapSquare(game, opened, given);
        expect(after?.given).toEqual(opened.given);
      });
    },
    5 * MINUTES,
  );

  /**
   * Wrong often enough and the grid gives a square away.
   *
   * One square, outlined rather than coloured — she still puts it in
   * herself — and it is one she actually needs, which is the part worth
   * checking: a hint the game invented would be worse than no hint.
   */
  test(
    "wrong enough times and one square is given away",
    async () => {
      await play({ seams: `&learned=all&symmetryRung=${HARDEST_SYMMETRY_RUNG}` }, async (game) => {
        const opened = await castMirror(game);
        const rung = SYMMETRY_RUNGS[HARDEST_SYMMETRY_RUNG];
        if (!rung) throw new Error("no rung");
        expect(opened.hinting).toBe(false);

        let grid: Grid | null = opened;
        const empties: string[] = [];
        for (let row = 0; row < opened.size && empties.length < rung.hintAfter; row++) {
          for (let col = 0; col < opened.size && empties.length < rung.hintAfter; col++) {
            const key = `${col},${row}`;
            if (!opened.given.includes(key) && !opened.wanted.includes(key)) empties.push(key);
          }
        }
        for (const key of empties) grid = await tapSquare(game, opened, key);
        expect(grid?.hinting).toBe(true);
        expect(grid?.done).toBe(false);

        // Being shown one does not answer it: the grid is still waiting.
        const finished = await finishIt(game, opened, grid);
        expect(finished?.done).toBe(true);
      });
    },
    5 * MINUTES,
  );

  /**
   * And a child who has not been up the mountain cannot cast it.
   *
   * The rune is drawn in the book, dimmed, because a book with a gap in it
   * says there is something to find. It is still a button — asserted,
   * because a check that only looked at whether the parchment stayed shut
   * would pass just as well if the tap had missed the book altogether.
   */
  test(
    "but not before the astronomer has taught it",
    async () => {
      await play({ seams: "&learned=portal" }, async (game) => {
        await game.tap("spellbook");
        expect(await game.tap("spellbook.5")).toBe(true);
        await game.settle(500);
        expect(await game.seam<Grid | null>("symmetry")).toBeNull();
      });
    },
    5 * MINUTES,
  );
});

/** Take every square the grid still wants. */
async function finishIt(game: Game, board: Grid, from: Grid | null): Promise<Grid | null> {
  let grid = from;
  for (const key of from?.wanted ?? []) {
    grid = await tapSquare(game, board, key);
  }
  return grid;
}
