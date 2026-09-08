// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { afterAll, describe, expect, test } from "bun:test";
import { Spell } from "../src/spells/spellbook";
import { GUIDES, Guide } from "../src/ui/guide";
import { type Game, play, runeButton, shutDown } from "./harness";

const MINUTES = 60_000;

/** Noon, and the village held still — see the note on `freezeNpcs` in the harness. */
const STILL = "&hour=12&freezeNpcs&seed=7";

afterAll(shutDown);

/**
 * The guide: a glow on the next button and an arrow over the next square,
 * until she has done the thing.
 *
 * The one scenario file opened with `firstTime`. Every other file is spared
 * the guide by the harness, because a glow on the pouch changes every
 * screenshot and a guide finishing writes to the child's progress.
 *
 * What this walks is the core loop as a child meets it, with the guide
 * pointing: pouch, seed, square; spellbook, rune, crop, twice; the ripe
 * crop; and then an arrow towards the store. Three promises. The marks are
 * *where the buttons are* — read off the same seam a script taps them by,
 * so a glow beside the pouch rather than on it would fail here. A step she
 * has done is skipped. And what she has been walked through survives a
 * reload, so the guide does not start over every morning.
 */

interface GuideSeam {
  running: string | null;
  step: number | null;
  cue: { kind: string; name?: string; ripe?: boolean; building?: string } | null;
  marks: { ring: { x: number; y: number } | null; arrow: { x: number; y: number } | null };
  done: string[];
}

const guide = (game: Game) => game.seam<GuideSeam>("guide");

/** Whether two screen points are the same place, to the pixel a ring breathes by. */
function near(
  a: { x: number; y: number } | null,
  b: { x: number; y: number } | undefined,
): boolean {
  return a !== null && b !== undefined && Math.abs(a.x - b.x) < 2 && Math.abs(a.y - b.y) < 2;
}

/** Wait until the guide is at a step, or say where it got stuck. */
async function reaches(
  game: Game,
  running: string | null,
  step: number | null,
): Promise<GuideSeam> {
  let seen = await guide(game);
  for (let tries = 0; tries < 20 && !(seen.running === running && seen.step === step); tries++) {
    await game.settle(150);
    seen = await guide(game);
  }
  if (seen.running !== running || seen.step !== step) {
    throw new Error(`the guide is at ${JSON.stringify(seen)}, not ${running} step ${step}`);
  }
  return seen;
}

describe("the guide", () => {
  test(
    "points through planting, growing and picking, and then towards the store",
    async () => {
      await play({ seams: STILL, firstTime: true }, async (game) => {
        // --- Planting: the pouch glows, then a seed, then the square ahead.
        let seen = await reaches(game, Guide.Plant, 0);
        expect(seen.cue).toEqual({ kind: "button", name: "seeds" });
        expect(near(seen.marks.ring, (await game.ui()).seeds)).toBe(true);
        expect(seen.marks.arrow).toBe(null);

        expect(await game.tap("seeds")).toBe(true);
        seen = await reaches(game, Guide.Plant, 1);
        expect(near(seen.marks.ring, (await game.ui())["seeds.0"])).toBe(true);

        expect(await game.tap("seeds.0")).toBe(true);
        seen = await reaches(game, Guide.Plant, 2);
        expect(seen.cue).toEqual({ kind: "ahead" });
        expect(seen.marks.ring).toBe(null);
        expect(seen.marks.arrow).not.toBe(null);

        const bed = await game.squareBeside();
        await game.tapCell(bed.col, bed.row);
        // Planted: the guide moves on to growing, which starts at once
        // because there is now something to grow.
        seen = await reaches(game, Guide.Grow, 0);
        expect(seen.done).toEqual([Guide.Plant]);
        expect(near(seen.marks.ring, (await game.ui()).spellbook)).toBe(true);

        // --- Growing, twice round: spellbook, rune, crop.
        for (let cast = 0; cast < 2; cast++) {
          expect(await game.tap("spellbook")).toBe(true);
          seen = await reaches(game, Guide.Grow, 1);
          expect(near(seen.marks.ring, (await game.ui())[runeButton(Spell.Growth)])).toBe(true);
          expect(await game.tap(runeButton(Spell.Growth))).toBe(true);
          seen = await reaches(game, Guide.Grow, 2);
          expect(seen.cue).toEqual({ kind: "crop", ripe: false });
          // The arrow hangs over the crop she planted: same column, above it.
          const over = await game.seam<{ x: number; y: number }>("screenOf", bed.col, bed.row);
          const arrow = seen.marks.arrow;
          expect(arrow).not.toBe(null);
          expect(arrow && Math.abs(arrow.x - over.x) < 2 && arrow.y < over.y).toBe(true);
          await game.tapCell(bed.col, bed.row);
          await game.solveNumberLine();
          await game.settle(400);
        }
        // Ripe: growing is done, and the ripe crop is pointed at.
        seen = await reaches(game, Guide.Pick, 0);
        expect(seen.done).toEqual([Guide.Plant, Guide.Grow]);
        expect(seen.marks.arrow).not.toBe(null);

        // --- Picking, then the store.
        await game.tapCell(bed.col, bed.row);
        seen = await reaches(game, Guide.Sell, 0);
        expect(seen.done).toEqual([Guide.Plant, Guide.Grow, Guide.Pick]);
        expect(seen.cue).toEqual({ kind: "door", building: "store" });
        // The store is off the screen from her garden, so the arrow hangs
        // over the last square of the way to it that is still on the screen
        // — on the screen, not off it.
        const arrow = seen.marks.arrow;
        expect(arrow).not.toBe(null);
        expect(arrow && arrow.x >= 0 && arrow.x <= 1000 && arrow.y >= 0 && arrow.y <= 760).toBe(
          true,
        );

        // --- Tomorrow: what she was walked through stays walked through.
        await game.reload();
        seen = await reaches(game, Guide.Sell, 0);
        expect(seen.done).toEqual([Guide.Plant, Guide.Grow, Guide.Pick]);
      });
    },
    5 * MINUTES,
  );

  test(
    "follows the keys as well as the taps",
    async () => {
      await play({ seams: STILL, firstTime: true }, async (game) => {
        await reaches(game, Guide.Plant, 0);
        // The pouch opened from the keyboard is the pouch opened: the glow
        // moves on to the seed rather than staying on a button already
        // pressed.
        await game.press("p");
        const seen = await reaches(game, Guide.Plant, 1);
        expect(near(seen.marks.ring, (await game.ui())["seeds.0"])).toBe(true);
      });
    },
    2 * MINUTES,
  );

  test(
    "is spared to every scenario that did not ask for it",
    async () => {
      await play({ seams: STILL }, async (game) => {
        await game.settle(500);
        const seen = await guide(game);
        expect(seen.running).toBe(null);
        expect(seen.marks).toEqual({ ring: null, arrow: null });
        // Counted as given by the seam, not written to the child.
        expect(seen.done).toEqual([]);
        expect(GUIDES.length).toBeGreaterThan(0);
      });
    },
    2 * MINUTES,
  );
});
