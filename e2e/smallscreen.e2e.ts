// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { afterAll, describe, expect, test } from "bun:test";
import { Spell } from "../src/spells/spellbook";
import { PatchAction } from "../src/world/selection";
import { PATCH_REACH, markingZoom } from "../src/world/selection";
import { TILE_SIZE } from "../src/world/topdown";
import { type Game, PHONE, patchButton, play, runeButton, shutDown } from "./harness";

const MINUTES = 60_000;

afterAll(shutDown);

/**
 * The array spell on a screen the size of a phone.
 *
 * The one scenario in the suite that opens at anything but a desktop, and
 * the reason is a bug that could not be seen from one. The spell lets a
 * child draw ten squares across; at the world's zoom ten squares are wider
 * than an iPhone, so the far corner of anything but a small rectangle was
 * off the screen. Indoors it was worse still: a cottage fills a phone wall
 * to wall, and the squares this spell *builds* on are the ones beyond those
 * walls — the child was being asked to draw round ground they could not see.
 *
 * A playtest put it as *they can only pick one row or one column*.
 *
 * `markingZoom` is proved in `selection.test.ts` and this does not re-prove
 * it. What this proves is that the camera actually moves, that it moves at
 * the right moment, and — the half a unit test cannot reach — that it comes
 * back.
 */
async function intoTheHouse(game: Game): Promise<void> {
  const doors = await game.seam<Record<string, { col: number; row: number }>>("doors");
  const id = Object.keys(doors).find((name) => name.includes("player-house"));
  const door = doors[id ?? ""];
  if (!door) throw new Error("no house in this world");
  await game.reload(`&learned=all&hour=12&at=${door.col},${door.row + 1}`);
  await game.walk("ArrowUp", 700);
  await game.stopped();
}

/**
 * Arm the times rune and get as far as waiting for a corner.
 *
 * Two taps, not one. The rune only *arms* the spell; indoors it then asks
 * whether the patch is being built or taken up, and nothing is marked — and
 * so nothing moves the camera — until that is answered.
 */
async function markOutFloor(game: Game): Promise<void> {
  await game.tap("spellbook");
  await game.settle(300);
  await game.tap(runeButton(Spell.Array));
  await game.settle(500);
  // Build: the first of the two the menu offers indoors.
  await game.tap(patchButton(PatchAction.Build));
  await game.settle(700);
}

describe("marking out a patch on a phone", () => {
  test(
    "the camera pulls out far enough to hold the whole reach, and goes back",
    async () => {
      await play({ seams: "&learned=all&hour=12", viewport: PHONE }, async (game) => {
        await intoTheHouse(game);
        const resting = await game.zoomNow();

        await markOutFloor(game);
        const marking = await game.zoomNow();
        expect(marking).toBeLessThan(resting);
        expect(marking).toBe(markingZoom(PHONE, TILE_SIZE, resting));
        // The point of the whole change, said as the thing it has to be: ten
        // squares of reach, on the screen at once.
        expect(PATCH_REACH * TILE_SIZE * marking).toBeLessThanOrEqual(PHONE.width);

        // And it comes back. Tapping the lit rune again is one of the five
        // ways marking ends and the cheapest to drive; they all go through
        // `stopMarking`, which is where the camera is put back.
        await game.tap("spellbook");
        await game.settle(300);
        await game.tap(runeButton(Spell.Array));
        await game.settle(700);
        expect(await game.zoomNow()).toBe(resting);
      });
    },
    5 * MINUTES,
  );

  test(
    "and a desktop is left exactly as it was",
    async () => {
      // The other half, and the one that would go unnoticed: a fix for
      // phones that quietly halved every other screen would be a worse bug
      // than the one it fixed.
      await play({ seams: "&learned=all&hour=12" }, async (game) => {
        await intoTheHouse(game);
        const resting = await game.zoomNow();
        await markOutFloor(game);
        expect(await game.zoomNow()).toBe(resting);
      });
    },
    5 * MINUTES,
  );
});

/**
 * And the trays stay on the screen they are drawn on.
 *
 * Reported from a phone: *items popup goes outside the screen border, to the
 * left.* The crate wraps into fresh columns to its left as it fills, which
 * was settled when it held twelve things and had no edge to run into. It
 * holds twenty now, and on a 390-wide screen its own button sits a hundred
 * and twenty pixels from the left edge — two columns fit, three were wanted,
 * and the third was drawn centred at minus twenty-four.
 *
 * `IconTray.test.ts` proves the arithmetic with those numbers. This is the
 * half that cannot be reasoned about: how many things are in the crate, and
 * how far from the edge it lands, are the game's business rather than the
 * tray's, and both have changed under it before.
 */
describe("the trays on a phone", () => {
  test(
    "open without running off the side of the screen",
    async () => {
      await play({ seams: "&learned=all&hour=12&freezeNpcs", viewport: PHONE }, async (game) => {
        for (const tray of ["crate", "seeds", "basket", "spellbook"]) {
          expect(await game.tap(tray)).toBe(true);
          await game.settle(250);
          const open = Object.entries(await game.ui()).filter(([name]) =>
            name.startsWith(`${tray}.`),
          );
          expect({ tray, any: open.length > 0 }).toEqual({ tray, any: true });
          for (const [name, at] of open) {
            // Centres, so a button whose centre is on screen can still have
            // an edge off it — which is why the margin is half a button
            // rather than nothing.
            expect({ name, onScreen: at.x > 20 && at.y > 20 }).toEqual({ name, onScreen: true });
            expect({ name, inside: at.x < PHONE.width && at.y < PHONE.height }).toEqual({
              name,
              inside: true,
            });
          }
          await game.tap(tray);
          await game.settle(150);
        }
      });
    },
    5 * MINUTES,
  );
});
