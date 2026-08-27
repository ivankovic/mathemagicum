// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { afterAll, describe, expect, test } from "bun:test";
import { Spell } from "../src/spells/spellbook";
import { play, runeButton, shutDown } from "./harness";

const MINUTES = 60_000;
/** An hour at which everyone else has gone home. See the scenario below. */
const NIGHT = 22;

// The dev server goes when this file is done with it, which is safe because
// `run.ts` gives every scenario file a process of its own.
afterAll(shutDown);

/**
 * Who teaches the hourglass, and where he stands.
 *
 * Its own file, and the reason is cost rather than tidiness. This is the
 * only scenario in the suite that opens the game *twice* and the second
 * time four hundred tiles from home, so it generates the city, streams a
 * long way into it, and stands up a second Phaser game in the same browser.
 * Run at the end of `clock.e2e.ts` it left the scenario after it unable to
 * reload at all — a plain `page.reload` that had never once been slow sat
 * through its ninety second budget and gave up, every run, deterministically.
 *
 * Nothing was wrong with that scenario, which is the worst shape a failure
 * has. `run.ts` gives every file its own process for exactly this, so the
 * expensive one gets a process of its own.
 */

describe("learning to wind the clock", () => {
  /**
   * Who teaches it, and where.
   *
   * The spell used to be the astronomer's, up a mountain behind an errand.
   * It is the clockmaker's now, in the plaza under the city's tower, and he
   * teaches it for being spoken to — so this walks to him from nowhere near
   * him, which is what `?at=` is for.
   *
   * Two things at once on purpose: that meeting him hands over the spell,
   * and that he then opens the parchment. A teacher who says hello and
   * nothing else reads as broken, and the check for "nothing else" is that
   * the cast is on screen a moment later.
   */
  test(
    "the clockmaker under the city's tower is who teaches it",
    async () => {
      // Nowhere near him, and nothing learned but the portal spell — which
      // is the state a child is in when they first reach the city.
      // Pinned to the middle of the night on purpose.
      //
      // The village keeps hours now — everybody else walks home at six and
      // the doors lock — and he is the one person exempt from it: a
      // clockmaker beside the clock, at all hours. That is a character note
      // and it is also load-bearing, because the spell he teaches is what a
      // child uses to get past a shut door. Unpinned this passed every
      // afternoon while proving nothing about the exemption at all.
      await play({ seams: `&learned=portal&freezeNpcs&hour=${NIGHT}` }, async (game) => {
        // Shut, and he is still out in it.
        expect((await game.seam<{ open: boolean }>("openHours")).open).toBe(false);
        const npcs = await game.seam<Record<string, { col: number; row: number }>>("npcs");
        const stands = npcs["city-clockmaker"];
        if (!stands) throw new Error("nobody is keeping the city's clock");

        // The spellbook has the rune in it, dimmed, and it does not open.
        await game.tap("spellbook");
        // Tapped, and refused. The rune is drawn dimmed rather than left
        // out, so it is still a button — and a check that only asked
        // whether the parchment stayed shut would pass if the tap had
        // missed the book altogether.
        expect(await game.tap(runeButton(Spell.Hourglass))).toBe(true);
        await game.settle(400);
        expect(await game.seam<unknown>("clock")).toBeNull();

        // Opened again standing under the tower. Where he is depends on
        // where the tower landed in the plaza, so it is read off the world
        // and handed back to the world as `?at=`.
        await game.press("Escape");
        await game.reload(
          `&learned=portal&freezeNpcs&hour=${NIGHT}&at=${stands.col},${stands.row + 1}`,
        );
        await game.tapNear(0, -1);
        // Long enough for the rune to rise over her head and the parchment
        // to follow it.
        await game.settle(2600);
        expect(await game.seam<unknown>("clock")).not.toBeNull();

        // And it is hers to keep: closing the page leaves the spell learned.
        await game.press("Escape");
        await game.settle(400);
        await game.tap("spellbook");
        await game.tap(runeButton(Spell.Hourglass));
        await game.settle(500);
        expect(await game.seam<unknown>("clock")).not.toBeNull();
      });
    },
    5 * MINUTES,
  );
});
