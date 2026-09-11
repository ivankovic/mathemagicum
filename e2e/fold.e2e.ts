// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { afterAll, describe, expect, test } from "bun:test";
import { HARDEST_SYMMETRY_RUNG, SYMMETRY_RUNGS } from "../src/spells/symmetry";
import { FixtureType } from "../src/world/fixtures";
import { type Game, play, shutDown, takeFromCrate } from "./harness";

const MINUTES = 60_000;

// The dev server goes when this file is done with it, which is safe because
// `run.ts` gives every scenario file a process of its own.
afterAll(shutDown);

/**
 * Colouring a grid until both sides of the line match: the fold, which is
 * what wakes a blueprint.
 *
 * It was the mirror spell's parchment. The spell moved ground about and
 * nobody wanted ground moved; the parchment asks a child to make one half
 * of a picture match the other, and the machine that builds the same line
 * twice is the thing in this game that verb is actually for. So the grid is
 * opened by tapping a sleeping blueprint now, and everything below is about
 * the grid rather than about what wakes it.
 *
 * The one parchment with nothing to type. Every other one ends in a number
 * going into a box, and a script drives those by pressing keys; this one
 * ends in *taps on a picture*, so there is nothing to press and nothing on
 * screen with a name. What makes it drivable is that the picture is
 * published: the grid comes back with the squares it was given, the squares
 * it still wants and where it is drawn. The scenario taps the squares the
 * *game* worked out rather than ones it guessed — the same discipline the
 * shop scenarios landed on, where the price is read off the counter.
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
 * Paper and cord for a blueprint, the climb to the dome counted as lit so the
 * crate offers one, the village still, and the rung the scenario wants.
 */
function withABlueprint(rung: number): string {
  return `&materials=40&made=12&hour=12&freezeNpcs&lampsLit&symmetryRung=${rung}`;
}

/**
 * Build a blueprint, put it down beside her, and tap it: it is asleep, so
 * the tap opens the fold.
 */
async function wakeABlueprint(game: Game): Promise<Grid> {
  expect(await takeFromCrate(game, FixtureType.Blueprint)).toBe(true);
  await game.settle(400);
  const at = await game.squareBeside();
  await game.tapCell(at.col, at.row);
  await game.settle(500);
  await game.tapCell(at.col, at.row);
  await game.settle(500);
  const seen = await game.seam<Grid | null>("symmetry");
  if (!seen) throw new Error("the fold did not open");
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
   * The whole question, at the hardest rung, and the machine awake after it.
   *
   * Deliberately the corner line on a seven-by-seven: the two straight
   * lines move a square along a row or down a column, and this one sends it
   * to the other number entirely. If the arithmetic behind the grid were
   * wrong anywhere, it would be wrong here.
   */
  test(
    "colour the squares it asks for, the picture matches, and the blueprint wakes",
    async () => {
      await play({ seams: withABlueprint(HARDEST_SYMMETRY_RUNG) }, async (game) => {
        const opened = await wakeABlueprint(game);
        // Read out rather than indexed inline: the ladder's top rung is a
        // fact this test rests on, and `?.size` quietly compares against
        // `undefined` if it ever stops being there.
        const hardest = SYMMETRY_RUNGS[HARDEST_SYMMETRY_RUNG];
        if (!hardest) throw new Error("the symmetry ladder has no top rung");
        expect(opened.size).toBe(hardest.size);
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

        // Finished parchments close themselves after a beat, and the
        // machine that asked is awake.
        await game.settle(1400);
        expect(await game.seam<Grid | null>("symmetry")).toBeNull();
        const machines = await game.seam<{ awake: boolean }[]>("machines");
        expect(machines.some((one) => one.awake)).toBe(true);
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
      await play({ seams: withABlueprint(2) }, async (game) => {
        const opened = await wakeABlueprint(game);
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
      await play({ seams: withABlueprint(2) }, async (game) => {
        const opened = await wakeABlueprint(game);
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
      await play({ seams: withABlueprint(HARDEST_SYMMETRY_RUNG) }, async (game) => {
        const opened = await wakeABlueprint(game);
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
   * And a child who has not lit the climb to the dome has no blueprint to
   * wake.
   *
   * The crate does not draw the slot until the astronomer's errand is done,
   * so there is nothing to tap: the group opens, and the machine is not in
   * it. Asserted through the crate rather than through the parchment
   * staying shut, because a check that only looked at whether the grid
   * opened would pass just as well if the tap had missed the crate.
   */
  test(
    "but not before the climb to the dome is lit",
    async () => {
      await play({ seams: "&materials=40&made=12&hour=12&freezeNpcs" }, async (game) => {
        expect(await takeFromCrate(game, FixtureType.Blueprint)).toBe(false);
        expect(await game.held(FixtureType.Blueprint)).toBe(0);
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
