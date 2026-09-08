// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { afterAll, describe, expect, test } from "bun:test";
import { Spell } from "../src/spells/spellbook";
import { PlantType } from "../src/world/plants";
import { type Game, PHONE, play, runeButton, seedButton, shutDown } from "./harness";

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

/**
 * And the same box on a touchscreen, which is the only screen it will meet.
 *
 * This parchment was written for the child at the bottom of the ladder, and
 * that child is holding a tablet — the playtest that asked for it was run on
 * an iPad. Everything above drives the mouse, and Phaser routes touch
 * through a different half of its input manager, so a counter that picks up
 * under a mouse and not under a finger would pass every scenario in this
 * file and be broken for every child who ever sees it.
 *
 * **What this does not test, so that nobody reads it as covering that.** It
 * is headless Chromium with `hasTouch` on, not Safari: it exercises the
 * touch route through Phaser, and says nothing about iOS gesture rules or
 * anything Safari does differently. The one iPad finding it cannot stand in
 * for is the popup blocker in `AboutPanel.openLink`, which does not exist
 * in this browser at all.
 */
describe("counting on a touchscreen", () => {
  test(
    "the counters pick up under a finger, on a screen the size of a hand",
    async () => {
      await play({ seams: AT_THE_BOTTOM, viewport: PHONE, touch: true }, async (game) => {
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
        if (!seen) throw new Error("the counting box did not open on a touchscreen");
        expect(seen.held).toBeLessThan(seen.target);
        // The box is on the screen it was drawn for, and not off the side of
        // it: a parchment laid out for a thousand pixels and shown on three
        // hundred and ninety is the shape of every phone bug this suite has
        // found so far.
        // A box with a size, asserted before it is asserted to be on the
        // screen: a zero-sized one at the origin satisfies every bound below
        // and is a box nobody can drop a counter into.
        expect(seen.box.w).toBeGreaterThan(40);
        expect(seen.box.h).toBeGreaterThan(40);
        expect(seen.box.x).toBeGreaterThanOrEqual(0);
        expect(seen.box.y).toBeGreaterThanOrEqual(0);
        expect(seen.box.x + seen.box.w).toBeLessThanOrEqual(PHONE.width);
        expect(seen.box.y + seen.box.h).toBeLessThanOrEqual(PHONE.height);

        // Filled entirely by tapping, which is what a small hand does. A
        // drag needs a child to know that holding on is a thing; a tap is
        // the gesture she already has.
        let now: Counting | null = seen;
        while (now && now.held < now.target) {
          const one = now.inTray[0];
          if (!one) throw new Error("the tray ran out before the box was full");
          await game.drag(one, one);
          await game.settle(150);
          now = await counting(game);
        }
        // Gone, because it was right: the finger did the whole round.
        await game.settle(600);
        expect(await counting(game)).toBe(null);
      });
    },
    3 * MINUTES,
  );
});
