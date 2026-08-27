// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { afterAll, describe, expect, test } from "bun:test";
import { zoomSteps } from "../src/input/pinch";
import { Spell } from "../src/spells/spellbook";
import { PHONE, play, runeButton, shutDown } from "./harness";

const MINUTES = 60_000;

afterAll(shutDown);

/**
 * Two fingers on the glass, and what the camera does about them.
 *
 * The only scenario in the suite that opens a browser with a touchscreen,
 * and it has to: a pinch is two pointers at once, and Phaser reaches them
 * through a different half of its input manager from the one every other
 * file here drives with a mouse. `pinch.ts` proves the arithmetic; nothing
 * but a real browser can prove that two fingers ever reach it.
 *
 * Its own file rather than a third scenario in `smallscreen.e2e.ts`, whose
 * two are deliberately mouse-driven — the desktop half of that pair is the
 * check that a phone fix did not move every other screen, and running it
 * under touch would quietly stop it being that check.
 */
const APART = 240;
const TOGETHER = 80;

describe("pinching the world smaller", () => {
  test(
    "two fingers drawn together halve the zoom, and drawn apart put it back",
    async () => {
      await play({ seams: "&hour=12&freezeNpcs", viewport: PHONE, touch: true }, async (game) => {
        const steps = zoomSteps(await game.zoomNow());
        const [out, normal] = [steps[0], steps[steps.length - 1]];
        expect(await game.zoomNow()).toBe(normal as number);

        const centre = { x: PHONE.width / 2, y: PHONE.height / 2 };
        await game.pinch(centre, APART, TOGETHER);
        expect(await game.zoomNow()).toBe(out as number);

        // Both ways, because a gesture that only worked outward would be
        // a child stuck at half size with no way of saying so.
        await game.pinch(centre, TOGETHER, APART);
        expect(await game.zoomNow()).toBe(normal as number);
      });
    },
    5 * MINUTES,
  );

  /**
   * And it stays where it was put.
   *
   * The half that breaks quietly. The camera is asked for its zoom at every
   * viewport change and at both ends of the array spell, and each of those
   * used to answer with the world's constant — so a pinch could be undone by
   * arming a rune, or by turning the phone.
   */
  test(
    "the spell that pulls the camera out does not push it back in",
    async () => {
      // On a desktop-sized screen on purpose, though the gesture is a
      // phone's. A phone is narrow enough that the spell pulls the camera
      // out to a half by itself, so a scenario run there would pass whether
      // her pinch was remembered or thrown away. Here the spell would be
      // happy at the world's own zoom — so if her choice were being
      // forgotten, arming the rune would visibly zoom her back in.
      await play({ seams: "&learned=all&hour=12&freezeNpcs", touch: true }, async (game) => {
        const centre = { x: 500, y: 380 };
        await game.pinch(centre, APART, TOGETHER);
        const chosen = await game.zoomNow();
        expect(chosen).toBe(1);

        await game.tap("spellbook");
        await game.settle(300);
        await game.tap(runeButton(Spell.Array));
        await game.settle(700);
        // Out of doors the times rune arms straight away, with no menu.
        expect(await game.zoomNow()).toBe(chosen);

        await game.tap("spellbook");
        await game.settle(300);
        await game.tap(runeButton(Spell.Array));
        await game.settle(700);
        // And putting the rune out leaves it at *her* zoom, not the world's.
        expect(await game.zoomNow()).toBe(chosen);
      });
    },
    5 * MINUTES,
  );

  /**
   * And the finger left over at the end of a pinch is not a joystick.
   *
   * A pinch ends when one of the two fingers lifts, and the other is
   * normally still down. Without a rule about it, that finger becomes a
   * steering stick the instant its partner leaves — so every zoom would end
   * with the child walking off across the world.
   */
  test(
    "letting go of a pinch does not send her walking",
    async () => {
      await play({ seams: "&hour=12&freezeNpcs", viewport: PHONE, touch: true }, async (game) => {
        const before = await game.where();
        const centre = { x: PHONE.width / 2, y: PHONE.height / 2 };
        await game.pinch(centre, APART, TOGETHER);
        await game.settle(900);
        expect(await game.where()).toEqual(before);
      });
    },
    5 * MINUTES,
  );
});
