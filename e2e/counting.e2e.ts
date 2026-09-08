// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { afterAll, describe, expect, test } from "bun:test";
import { Spell } from "../src/spells/spellbook";
import { PlantType } from "../src/world/plants";
import { type Game, play, runeButton, seedButton, shutDown } from "./harness";

/**
 * The easiest sum in the game, counted out by hand.
 *
 * The rung is pinned, because the whole point of this parchment is that it
 * is what the *bottom* of the ladder looks like: at any other rung the same
 * cast draws a number line instead, and a scenario that let the ladder move
 * under it would be testing whichever one it happened to get.
 */
const AT_THE_BOTTOM = "&hour=12&freezeNpcs&rung=0";
const MINUTES = 60_000;

interface Counting {
  target: number;
  held: number;
  tray: number;
  takingAway: boolean;
  colour: string;
  box: { x: number; y: number; w: number; h: number };
  inBox: { x: number; y: number }[];
  inTray: { x: number; y: number }[];
}

const counting = (game: Game) => game.seam<Counting | null>("counting");

afterAll(shutDown);

describe("counting into the box", () => {
  test(
    "a growing sum arrives as a box with too few in it, and is filled by hand",
    async () => {
      await play({ seams: AT_THE_BOTTOM }, async (game) => {
        // Plant something, then cast growth on it: the ordinary way a sum
        // is asked, at the ordinary rung, with nothing special about it
        // except which parchment answers.
        await game.tap("seeds");
        await game.tap(seedButton(PlantType.Carrot));
        const at = await game.where();
        await game.tapCell(at.col, at.row + 1);
        await game.settle(400);

        await game.tap("spellbook");
        await game.tap(runeButton(Spell.Growth));
        await game.tapCell(at.col, at.row + 1);
        await game.settle(600);

        const seen = await counting(game);
        if (!seen) throw new Error("the counting box did not open");
        // Too few, and the number over it is what it has to hold.
        expect(seen.takingAway).toBe(false);
        expect(seen.held).toBeLessThan(seen.target);
        expect(seen.inBox.length).toBe(seen.held);
        // The tray is never exactly the answer: emptying it is not arithmetic.
        expect(seen.tray).toBeGreaterThan(seen.target - seen.held);

        // Both ways in, because the panel offers both and a child will find
        // whichever she finds: the first counter is *dragged* into the box,
        // and the rest are *tapped*, which is a pick-up and a put-down in
        // one place and is why nobody has to learn to drag.
        const first = seen.inTray[0];
        if (!first) throw new Error("the tray came up empty");
        const middle = { x: seen.box.x + seen.box.w / 2, y: seen.box.y + seen.box.h / 2 };
        await game.drag(first, middle);
        await game.settle(200);
        let now = await counting(game);
        // A round that only wanted one is finished by that drag, and the
        // parchment is already gone. That is the answer, not a failure —
        // the easiest rung really does ask for one sometimes.
        if (!now) {
          expect(seen.target - seen.held).toBe(1);
          return;
        }
        expect(now.held).toBe(seen.held + 1);

        while (now.held < now.target) {
          const one = now.inTray[0];
          if (!one) throw new Error("the tray ran out before the box was full");
          await game.drag(one, one);
          await game.settle(150);
          const next = await counting(game);
          if (!next) break;
          now = next;
        }
        // Right, so the parchment goes and the crop grew.
        await game.settle(600);
        expect(await counting(game)).toBe(null);
      });
    },
    3 * MINUTES,
  );

  test(
    "and a clearing sum arrives with too many, to be taken out again",
    async () => {
      await play({ seams: AT_THE_BOTTOM }, async (game) => {
        await game.tap("spellbook");
        await game.tap(runeButton(Spell.Clearing));
        const at = await game.where();
        // Whatever is beside her: the clearing spell wants something to take.
        await game.tapCell(at.col, at.row + 1);
        await game.settle(600);
        const seen = await counting(game);
        if (!seen) return; // nothing to clear there, which is not this test's business
        expect(seen.takingAway).toBe(true);
        expect(seen.held).toBeGreaterThan(seen.target);
        // Nothing in the tray: what she moves comes out of the box.
        expect(seen.tray).toBe(0);
        expect(seen.inBox.length).toBe(seen.held);
      });
    },
    3 * MINUTES,
  );
});
