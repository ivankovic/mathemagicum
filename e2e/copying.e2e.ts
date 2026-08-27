// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { afterAll, describe, expect, test } from "bun:test";
import { type Game, play, shutDown } from "./harness";

const MINUTES = 60_000;

afterAll(shutDown);

/**
 * What the mirror spell *does*: the ground from there, put here.
 *
 * The other half of the mirror, and its own file rather than two more
 * scenarios at the end of `mirror.e2e.ts`. Everything in there is about the
 * parchment — whether the grid can be finished, what it refuses — and none
 * of it would notice if the world never changed. These two watch the ground
 * itself, and they are expensive: each one opens the game twice, because
 * finding two kinds of ground that meet takes a look at the world before it
 * knows where to stand. Seven scenarios of that in one process is over the
 * line the harness warns about, and the failure it produces — a navigation
 * that never finishes — says nothing about the spell.
 *
 * Cast where two kinds of ground meet, always. A copy that lands dirt on
 * dirt is a copy that would pass whether it happened or not.
 */

interface Spot {
  col: number;
  row: number;
}

interface Grid {
  wanted: string[];
  board: { left: number; top: number; step: number; cell: number; size: number } | null;
  done: boolean;
}

/** The world these are cast in, and the seams they are cast with. */
const OPEN_GROUND = "&learned=all&hour=12&freezeNpcs&symmetryRung=0";

/** What the world says is under each of these squares, right now. */
function groundUnder(game: Game, cells: readonly Spot[]): Promise<string[]> {
  return game.tab.evaluate((list) => {
    const handle = (globalThis as never as Record<string, Record<string, unknown>>).__mathemagicum;
    if (!handle) throw new Error("the game has not put its handle out");
    const session = handle.session as {
      grid: { getTerrain: (col: number, row: number) => string };
    };
    return (list as Spot[]).map((one) => session.grid.getTerrain(one.col, one.row));
  }, cells as Spot[]);
}

/**
 * Go and stand where two kinds of ground meet.
 *
 * Found rather than written down, because the world is generated: a column
 * and a row in a scenario would be a woodland edge until the day the
 * generator changed and then two squares of the same dirt, and the scenario
 * would go on passing. So the grid is read once, wide, in a single call, and
 * she is *reopened* standing between the two squares — reopened rather than
 * walked, because the camera does not follow a tile written into the session
 * and a tap needs the square it is aimed at to be on the screen.
 */
async function standAtABoundary(game: Game): Promise<{ source: Spot; dest: Spot }> {
  const start = await game.where();
  const wide = await game.tab.evaluate(
    ([col, row]) => {
      const handle = (globalThis as never as Record<string, Record<string, unknown>>)
        .__mathemagicum;
      if (!handle) throw new Error("the game has not put its handle out");
      const session = handle.session as {
        grid: { getTerrain: (col: number, row: number) => string };
      };
      const out: { col: number; row: number; terrain: string }[] = [];
      for (let down = -25; down <= 25; down++) {
        for (let across = -25; across <= 25; across++) {
          const at = { col: (col as number) + across, row: (row as number) + down };
          out.push({ ...at, terrain: session.grid.getTerrain(at.col, at.row) });
        }
      }
      return out;
    },
    [start.col, start.row] as const,
  );
  const byKey = new Map(wide.map((one) => [`${one.col},${one.row}`, one.terrain]));
  for (const one of wide) {
    const across = byKey.get(`${one.col + 2},${one.row}`);
    if (!across || across === one.terrain) continue;
    if (one.terrain === "water" || across === "water") continue;
    // Between them, so both ends are inside the spell's reach.
    await game.reload(`${OPEN_GROUND}&at=${one.col + 1},${one.row}`);
    await game.settle(600);
    return { source: one, dest: { col: one.col + 2, row: one.row } };
  }
  throw new Error("no boundary between two kinds of ground within sight");
}

/** Point the lit rune at a square. */
async function pointAt(game: Game, at: Spot): Promise<void> {
  await game.tapCell(at.col, at.row);
  await game.settle(300);
}

/** Colour in every square the grid wants, and expect it to be finished. */
async function colourItIn(game: Game): Promise<void> {
  const grid = await game.seam<Grid | null>("symmetry");
  if (!grid?.board) throw new Error("the mirror parchment did not open");
  const board = grid.board;
  let done: Grid | null = grid;
  for (const key of grid.wanted) {
    const [col, row] = key.split(",").map(Number);
    if (col === undefined || row === undefined) throw new Error(`not a square: ${key}`);
    await game.tab.mouse.click(
      board.left + col * board.step + board.cell / 2,
      board.top + row * board.step + board.cell / 2,
    );
    await game.settle(200);
    done = await game.seam<Grid | null>("symmetry");
  }
  if (done && !done.done) throw new Error("the grid was not finished");
  await game.settle(1200);
}

describe("moving the ground", () => {
  /**
   * One square, and it stays moved.
   *
   * The *second* reload is the half that is easy to leave out and the only
   * one that catches anything. Terrain was never written down before this
   * spell existed, so a world that comes back with the ground restored but
   * without remembering that it was moved will write itself down again four
   * seconds later with the memory gone — and the copy is there all afternoon
   * and gone in the morning. Waiting for that second write is what tells the
   * two apart.
   */
  test(
    "the ground from there ends up here, and is still here tomorrow",
    async () => {
      await play({ seams: OPEN_GROUND }, async (game) => {
        const { source, dest } = await standAtABoundary(game);
        const before = await groundUnder(game, [source, dest]);
        expect(before[0]).not.toBe(before[1]);

        await game.tap("spellbook");
        await game.tap("spellbook.5");
        await game.settle(300);
        await pointAt(game, source);
        await pointAt(game, dest);
        await colourItIn(game);

        const after = await groundUnder(game, [source, dest]);
        // The far square becomes the near one and the near one is left
        // alone: this is a copy rather than a swap.
        expect(after[1]).toBe(before[0]);
        expect(after[0]).toBe(before[0]);

        await game.reload();
        expect(await groundUnder(game, [source, dest])).toEqual(after);
        // Long enough for the world to write itself down once more.
        await game.settle(6000);
        await game.reload();
        expect(await groundUnder(game, [source, dest])).toEqual(after);
      });
    },
    5 * MINUTES,
  );

  /**
   * A whole block of it, which is the times spell's doing.
   *
   * And the order is the thing being checked as much as the ground is: the
   * mirror's own grid first, the multiplication second. Every other action
   * on the times menu asks the spell it is multiplying once by hand and only
   * then asks how many times — a copy that jumped straight to the rectangle
   * would be the one place where the times rune was a shortcut rather than a
   * lesson.
   */
  test(
    "and a whole block of it, once the times spell has been asked",
    async () => {
      await play({ seams: OPEN_GROUND }, async (game) => {
        const { source, dest } = await standAtABoundary(game);
        // Two squares by two, with its far corner on the boundary square.
        const from: Spot[] = [
          { col: source.col - 1, row: source.row },
          { col: source.col, row: source.row },
          { col: source.col - 1, row: source.row + 1 },
          { col: source.col, row: source.row + 1 },
        ];
        // Its corner lands on the square across the boundary, so the whole
        // block moves three columns to the right.
        const onto = from.map((one) => ({ col: one.col + 3, row: one.row }));
        const before = await groundUnder(game, [...from, ...onto]);
        if (before.includes("water")) throw new Error("this boundary runs along the sea");
        const wasThere = before.slice(0, from.length);
        const wasHere = before.slice(from.length);
        // The one square the scan actually promised is different.
        expect(wasHere[0]).not.toBe(wasThere[1]);

        await game.tap("spellbook");
        await game.tap("spellbook.3");
        // Grow, clear, copy — copy is the one the mirror put on the menu.
        expect(await game.tap("patch.2")).toBe(true);
        await pointAt(game, from[0] as Spot);
        await pointAt(game, from[3] as Spot);
        // A beat on the finished rectangle before anything is asked.
        await game.settle(900);

        // Lit and waiting for the far corner, exactly as one square is.
        await pointAt(game, dest);
        await colourItIn(game);
        // And only now the multiplication.
        expect(await game.seam<{ answer: number } | null>("array")).not.toBeNull();
        await game.solveArray();
        await game.settle(900);

        expect(await groundUnder(game, onto)).toEqual(wasThere);

        // And a block she marked out and then thought better of does not
        // follow her into the next cast.
        //
        // Cheap to check here and nowhere else to check it: the times rune
        // hands the marked rectangle to the mirror spell to find somewhere
        // to put, and if giving up on it left the rectangle behind, the very
        // next copy — of one square — would ask her a multiplication about
        // four. Tapping the mirror rune while it is already lit is how a
        // child gives up, so that is what this does.
        await game.tap("spellbook");
        await game.tap("spellbook.3");
        expect(await game.tap("patch.2")).toBe(true);
        await pointAt(game, from[0] as Spot);
        await pointAt(game, from[3] as Spot);
        await game.settle(900);
        await game.tap("spellbook");
        await game.tap("spellbook.5");
        await game.settle(300);

        // Lit again, and this time pointed at one square.
        await game.tap("spellbook");
        await game.tap("spellbook.5");
        await game.settle(300);
        await pointAt(game, source);
        await pointAt(game, dest);
        await colourItIn(game);
        expect(await game.seam<{ answer: number } | null>("array")).toBeNull();
      });
    },
    5 * MINUTES,
  );
});
