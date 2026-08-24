// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { afterAll, describe, expect, test } from "bun:test";
import { SYMMETRY_RUNGS } from "../src/spells/symmetry";
import { type Game, play, shutDown } from "./harness";

const MINUTES = 60_000;

// The dev server goes when this file is done with it, which is safe because
// `run.ts` gives every scenario file a process of its own.
afterAll(shutDown);

/**
 * Folding a shape in half.
 *
 * The one spell with nothing to type. Every other parchment in the game ends
 * in a number going into a box, and a script drives those by pressing keys;
 * this one ends in a *line drawn across a picture*, so there is nothing to
 * press and nothing on screen with a name.
 *
 * What makes it drivable at all is that the picture is published: the shape
 * comes back in screen pixels and the folds come back as angles, both worked
 * out by the game rather than assumed here. That is the same discipline the
 * shop scenarios landed on — read the price off the counter, do not hard-code
 * it — and it is what lets these run at any rung without knowing which shape
 * the generator happened to make.
 */

interface Board {
  centreX: number;
  centreY: number;
  reach: number;
}

interface Seen {
  board: Board | null;
  axes: { angle: number }[];
  rung: { corners: number[]; regular: boolean; oblique: boolean; reflex: boolean };
  drawn: number;
  done: boolean;
  missteps: number;
  wrong: boolean;
  hinting: boolean;
}

/** Open the spellbook at the mirror, which is the last rune in it. */
async function castMirror(game: Game): Promise<Seen> {
  await game.tap("spellbook");
  await game.tap("spellbook.5");
  await game.settle(500);
  const seen = await game.seam<Seen | null>("symmetry");
  if (!seen) throw new Error("the mirror parchment did not open");
  return seen;
}

/** The two ends of a line at this angle through the middle of the shape. */
function lineAt(board: Board, angle: number): [{ x: number; y: number }, { x: number; y: number }] {
  // The game's own convention: measured from straight up, turning clockwise,
  // on a screen whose y grows downwards.
  const dx = Math.sin(angle);
  const dy = -Math.cos(angle);
  const run = board.reach * 1.1;
  return [
    { x: board.centreX - dx * run, y: board.centreY - dy * run },
    { x: board.centreX + dx * run, y: board.centreY + dy * run },
  ];
}

/** Draw a line across the shape, at an angle measured off its first fold. */
async function drawLine(game: Game, seen: Seen, offBy = 0): Promise<Seen | null> {
  const board = seen.board;
  if (!board) throw new Error("the parchment published no shape");
  const [from, to] = lineAt(board, (seen.axes[0]?.angle ?? 0) + offBy);
  await game.drag(from, to);
  return game.seam<Seen | null>("symmetry");
}

describe("folding a shape in half", () => {
  /**
   * The whole spell in one scenario.
   *
   * Deliberately at the hardest rung, where the shape leans, turns back on
   * itself and has exactly one fold in it. At the easiest a line drawn
   * anywhere near the middle of a square is right about one of four axes, so
   * a broken judge would still pass; here there is one answer and it is not
   * upright, which is what makes this worth running.
   */
  test(
    "draw the line it folds along and the shape folds",
    async () => {
      await play({ seams: "&learned=all&symmetryRung=5" }, async (game) => {
        const opened = await castMirror(game);
        // One fold, and it leans: the hardest shape the ladder makes.
        expect(opened.axes.length).toBe(1);
        expect(opened.done).toBe(false);
        expect(opened.missteps).toBe(0);
        expect(opened.rung.reflex).toBe(true);

        const after = await drawLine(game, opened);
        // The parchment is gone by now or going, and either way the cast is
        // finished: a shape that folded closes itself after a beat.
        if (after) {
          expect(after.done).toBe(true);
          expect(after.missteps).toBe(0);
        }
        await game.settle(1500);
        expect(await game.seam<Seen | null>("symmetry")).toBeNull();
      });
    },
    5 * MINUTES,
  );

  /**
   * And a line that is not a fold is cleared rather than argued with.
   *
   * The angle is far enough off that no tolerance forgives it, and it still
   * goes through the middle — which is the case worth pinning: a judge that
   * only looked at where the line passed would wave this through.
   */
  test(
    "a line at the wrong angle does not fold it, and is rubbed out",
    async () => {
      await play({ seams: "&learned=all&symmetryRung=4" }, async (game) => {
        const opened = await castMirror(game);
        const after = await drawLine(game, opened, 0.6);
        expect(after).not.toBeNull();
        expect(after?.done).toBe(false);
        expect(after?.wrong).toBe(true);
        expect(after?.missteps).toBe(1);

        // Still open, still the same shape, and still answerable.
        const again = await drawLine(game, opened);
        if (again) expect(again.done).toBe(true);
        await game.settle(1500);
        expect(await game.seam<Seen | null>("symmetry")).toBeNull();
      });
    },
    5 * MINUTES,
  );

  /**
   * The right slope in the wrong place is not a fold either.
   *
   * A line parallel to the true fold but drawn off at the edge of the shape.
   * It is the mistake a child actually makes — they can see which way the
   * fold leans before they can see where it goes — and the one a judge that
   * checked only the angle would call right.
   */
  test(
    "and neither is the right slope drawn off to one side",
    async () => {
      await play({ seams: "&learned=all&symmetryRung=4" }, async (game) => {
        const opened = await castMirror(game);
        const board = opened.board;
        if (!board) throw new Error("the parchment published no shape");
        const angle = opened.axes[0]?.angle ?? 0;
        const [from, to] = lineAt(board, angle);
        // Shifted perpendicular to the fold, so the slope is untouched and
        // only the place is wrong.
        const offX = Math.cos(angle) * board.reach * 0.55;
        const offY = Math.sin(angle) * board.reach * 0.55;
        await game.drag({ x: from.x + offX, y: from.y + offY }, { x: to.x + offX, y: to.y + offY });
        const after = await game.seam<Seen | null>("symmetry");
        expect(after?.done).toBe(false);
        expect(after?.wrong).toBe(true);
      });
    },
    5 * MINUTES,
  );

  /**
   * Get it wrong often enough and the parchment shows the fold.
   *
   * The help is the whole line rather than a nudge towards it, and what this
   * checks is that it is a line the shape actually folds along — a hint the
   * game made up would be worse than no hint.
   */
  test(
    "wrong enough times and the fold is drawn for her",
    async () => {
      await play({ seams: "&learned=all&symmetryRung=5" }, async (game) => {
        const opened = await castMirror(game);
        // The hardest rung waits for two, which is what makes this a check
        // on the rung rather than on the first miss.
        expect(opened.hinting).toBe(false);
        const once = await drawLine(game, opened, 0.7);
        expect(once?.hinting).toBe(false);
        const twice = await drawLine(game, opened, -0.7);
        expect(twice?.hinting).toBe(true);
        expect(twice?.done).toBe(false);

        // And being shown it does not answer it: the shape is still waiting.
        const drawn = await drawLine(game, opened);
        if (drawn) expect(drawn.done).toBe(true);
      });
    },
    5 * MINUTES,
  );

  /**
   * Four folds found first time, and the shapes get harder.
   *
   * The ladder is the one thing about this spell no unit test can see end to
   * end: the rung lives on the profile, the profile is written by the scene,
   * and what a child actually gets handed is the shape. So this counts in
   * casts and checks the shape that comes back.
   */
  test(
    "four found first time and the next shape is a harder one",
    async () => {
      await play({ seams: "&learned=all" }, async (game) => {
        // No `?symmetryRung=`: the seam holds the ladder still on purpose,
        // so a scenario about climbing it must not be using one.
        const first = await castMirror(game);
        expect(first.rung.corners).toEqual([...(SYMMETRY_RUNGS[0]?.corners ?? [])]);
        // And the shape it actually drew is one of the ones that rung allows.
        expect(SYMMETRY_RUNGS[0]?.corners.includes(first.drawn)).toBe(true);

        let seen: Seen = first;
        for (let cast = 0; cast < 4; cast++) {
          await drawLine(game, seen);
          await game.settle(1500);
          if (cast < 3) seen = await castMirror(game);
        }

        const climbed = await castMirror(game);
        expect(climbed.rung.corners).toEqual([...(SYMMETRY_RUNGS[1]?.corners ?? [])]);
      });
    },
    5 * MINUTES,
  );

  /**
   * And a child who has not been up the mountain cannot cast it at all.
   *
   * The rune is drawn in the book, dimmed, because a book with a gap in it
   * says there is something to find. Tapping it says no rather than opening
   * a parchment she has not been taught to read.
   */
  test(
    "but not before the astronomer has taught it",
    async () => {
      await play({ seams: "&learned=portal" }, async (game) => {
        await game.tap("spellbook");
        // The rune *is* tapped — it is drawn dimmed, not left out, and a
        // dimmed rune is still a button. Asserted, because a scenario that
        // only checked the parchment stayed shut would pass just as well if
        // the tap had missed the book entirely.
        expect(await game.tap("spellbook.5")).toBe(true);
        await game.settle(500);
        expect(await game.seam<Seen | null>("symmetry")).toBeNull();
      });
    },
    5 * MINUTES,
  );
});
