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

/**
 * A phone held sideways, which is the tightest the options panel is ever laid
 * out in — and the case the panel's own comments keep worrying about without
 * anything ever checking.
 *
 * Turned over rather than upright on purpose. Upright, the panel gets its
 * whole four hundred and fifty pixels and every row fits with room to spare;
 * sideways it gets three hundred and sixty-six, which is about ten more than
 * its four rows need. That is where its two degradations live: a row whose
 * words will not fit is set smaller, and a row that has the height for it
 * takes a second line instead.
 *
 * The bug this was written for: the sums row is told how low it may reach by
 * measuring back from the foot of the panel, and that measurement counted
 * *the world row* rather than everything under it. A sound row went in
 * between the two and was not counted — so on this screen the sums were told
 * they had room to wrap, took it, and pushed the world row and the tick and
 * cross that throw a game away down through the About button at the bottom.
 *
 * Which is why this asserts about *positions* rather than about a
 * screenshot: two buttons drawn on top of each other both report a sensible
 * coordinate, and the one underneath still takes the tap.
 */
describe("the options panel on a phone turned over", () => {
  const SIDEWAYS = { width: PHONE.height, height: PHONE.width };

  test(
    "fits all four rows in without laying any of them over the footer",
    async () => {
      await play({ seams: "&hour=12&freezeNpcs", viewport: SIDEWAYS }, async (game) => {
        expect(await game.tap("options")).toBe(true);
        await game.settle(600);
        const at = await game.ui();

        // The rows come down the panel in the order they are written, and
        // the world row clears the footer. A gap of half a button, because
        // these are centres: two whose centres are thirty apart are two
        // buttons touching.
        const y = (name: string) => at[name]?.y ?? Number.NaN;
        expect(y("language.0")).toBeLessThan(y("band.0"));
        expect(y("band.0")).toBeLessThan(y("sound.on"));
        expect(y("sound.on")).toBeLessThan(y("newGame"));
        expect(y("newGame")).toBeLessThan(y("about") - 30);

        // And nothing on show has been pushed off the bottom of the screen.
        //
        // Named one at a time rather than swept, because the panel offers a
        // position for every button it *has* and not only for the ones it is
        // drawing: the tick and cross that throw a world away appear once
        // the world row has been tapped, and the games row keeps a slot per
        // save whether or not there is a save in it. Those sit wherever they
        // were made — off screen — and that is correct. Asked about all of
        // them, this failed twice on buttons nobody can see.
        for (const name of [
          "language.0",
          "language.2",
          "band.0",
          "band.3",
          "sound.on",
          "sound.off",
          "game.0",
          "newGame",
          "exportSaves",
          "about",
        ]) {
          const spot = at[name];
          expect({ name, drawn: spot !== undefined }).toEqual({ name, drawn: true });
          expect({
            name,
            onScreen: (spot?.y ?? -1) > 0 && (spot?.y ?? 0) < SIDEWAYS.height,
          }).toEqual({ name, onScreen: true });
        }

        // The two sound buttons are side by side on one line, which is what
        // makes this the one row that never needs a floor of its own.
        expect(y("sound.on")).toBe(y("sound.off"));
      });
    },
    5 * MINUTES,
  );
});
