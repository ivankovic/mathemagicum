// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { afterAll, describe, expect, test } from "bun:test";
import { EN } from "../src/i18n/en";
import { NEWS_BEATS } from "../src/ui/news";
import { type Game, play, shutDown } from "./harness";

const MINUTES = 60_000;

afterAll(shutDown);

/**
 * The postman's two arrivals.
 *
 * He has always walked the welcome over, and that was the whole of it while
 * the only thing he ever delivered was the welcome — which is given in the
 * first minute, in a garden twenty tiles from his own door. The letter (see
 * `ui/news.ts`) is owed to a child who may be anywhere: up the tower, out on
 * the quay. So there are two arrivals now, and the rule that picks between
 * them is whether the player is inside the village.
 *
 * **Both halves need a browser and neither can be reached without one.** The
 * gate is a getter over the session's tile, the walk is sixty steps of a
 * pathfinder, and the arrival is a portal, a tween and a sprite — the last
 * of which does not exist outside Phaser at all. What a unit test can check
 * here is that a list has no repeats in it.
 *
 * The village half is run frozen, which holds every other villager on their
 * home tile and leaves *him* free to walk: `?intro` and `?news` are the one
 * exception `updateNpcs` makes to `?freezeNpcs`, without which the two seams
 * cancel and nobody arrives at all.
 */
const STILL = "&hour=12&freezeNpcs";

interface Post {
  owed: string | null;
  arriving: boolean;
  here: boolean;
  sheet: { title: string; body: string; page: string; pages: number } | null;
}

const post = (game: Game) => game.seam<Post>("post");

/** Wait until he has got wherever he is going, or say what he was doing. */
async function delivered(game: Game, what: string): Promise<Post> {
  for (let tries = 0; tries < 40; tries++) {
    const seen = await post(game);
    if (seen.sheet) return seen;
    await game.settle(250);
  }
  throw new Error(`${what}: ${JSON.stringify(await post(game))}`);
}

/**
 * Whether the door was ever seen open with him coming out of it.
 *
 * Polled without a wait between reads on purpose: the tear and the step out
 * take a little over half a second together, and a poll that slept a quarter
 * of a second between samples could walk straight past them. That is not a
 * hypothetical — the first version of this file asserted only that the sheet
 * came up, and the picture taken to check it showed the parchment already
 * open, which is to say the arrival had happened and been missed. The seam
 * exists to catch a tween that never completes, and a check that never sees
 * `arriving` true cannot catch one.
 */
async function sawTheDoor(game: Game): Promise<boolean> {
  for (let tries = 0; tries < 400; tries++) {
    const seen = await post(game);
    if (seen.arriving) return true;
    // Already out and holding the letter: the arrival happened and this
    // missed it, which is a failure of the check rather than of the game —
    // and reporting it as a pass would be the check quietly stopping.
    if (seen.sheet) return false;
  }
  // Neither ever happened, which is a different failure again and the one
  // an `expect(...).toBe(true)` describes worst: the gate held him back, or
  // the reload landed somewhere the door may not open. Thrown with the seam
  // in it, the way `delivered` does, because "expected true, got false" is
  // not something anybody can act on.
  throw new Error(`no door ever opened: ${JSON.stringify(await post(game))}`);
}

/**
 * Take the welcome, so what is under test is a child who has already met him.
 *
 * It is owed on every fresh save and it outranks the letter, which is right
 * — and it is also why the first version of the quay scenario below proved
 * nothing. It asserted that a door opened and somebody came out of it, and
 * one did, and he handed over the *welcome*. Nothing in the scenario looked
 * at what was written on the sheet, so a letter that could not be delivered
 * from a script at all read as four passing tests.
 *
 * Hence `EN.newsTitle` on every assertion here. The heading is the one thing
 * that tells his two parchments apart from outside.
 */
async function welcomed(game: Game): Promise<void> {
  // Every caller opens with `&intro`: `?freezeNpcs` holds the village still
  // and the two delivery seams are the only exception `updateNpcs` makes to
  // it, so a frozen world without one of them is one he never sets off in.
  const seen = await delivered(game, "he never arrived with the welcome");
  expect(seen.sheet?.title).toBe(EN.introTitle);
  await game.press("Escape");
  await game.settle(400);
}

/** A tile on the quay, which is as far from his round as the world goes. */
async function onTheQuay(game: Game): Promise<{ col: number; row: number }> {
  const tall = await game.seam<{ id: string; col: number; row: number }[]>("hiding");
  const beacon = tall.find(({ id }) => id === "harbour-lighthouse");
  if (!beacon) throw new Error("this world's harbour has no beacon on its headland");
  return { col: beacon.col, row: beacon.row + 3 };
}

describe("the welcome, in the village", () => {
  test(
    "he walks it over, and the sheet is the one he brought",
    async () => {
      await play({ seams: `${STILL}&intro` }, async (game) => {
        const seen = await delivered(game, "he never arrived with the welcome");
        expect(seen.sheet?.title).toBe(EN.introTitle);
        // The walk, and not a door: the whole point of the gate is that a
        // child standing in her own garden is somebody he can reach on foot,
        // and a portal tearing open twenty tiles from the post office would
        // be spectacle bought at the price of the one arrival the design
        // already argues for.
        expect(seen.here).toBe(false);
        expect(seen.arriving).toBe(false);
        // Five pages: seed, spell, pick, sell, map.
        expect(seen.sheet?.pages).toBe(5);
        // And he has nothing left to give once it is up — marked on the way
        // in, so a child who shuts it halfway is not offered it again.
        expect(seen.owed).toBe(null);
      });
    },
    5 * MINUTES,
  );
});

describe("the letter, from wherever she is", () => {
  test(
    "he walks it over too, while she is somewhere he can walk to",
    async () => {
      await play({ seams: `${STILL}&intro` }, async (game) => {
        await welcomed(game);
        await game.reload(`${STILL}&news`);
        const seen = await delivered(game, "he never arrived with the letter");
        expect(seen.sheet?.title).toBe(EN.newsTitle);
        // Every beat there is, because `?news` asks for the whole list. A
        // deck cut to a count that is already at the end of it renders as a
        // blank sheet rather than as nothing, which is the shape of failure
        // a title check alone would walk straight past.
        expect(seen.sheet?.pages).toBe(NEWS_BEATS.length);
        expect(seen.here).toBe(false);
        expect(seen.owed).toBe(null);
      });
    },
    5 * MINUTES,
  );

  test(
    "a door opens on the quay, he steps out of it, and it shuts behind him",
    async () => {
      await play({ seams: `${STILL}&intro` }, async (game) => {
        await welcomed(game);
        const quay = await onTheQuay(game);
        // Opened again out there with the letter owed. This is also the case
        // that used to send him walking: the welcome is owed on every load
        // until it is given, and a child who skipped it and wandered here
        // had him routing at them across four hundred tiles of grid.
        await game.reload(`${STILL}&news&at=${quay.col},${quay.row}`);
        expect(await sawTheDoor(game)).toBe(true);
        const seen = await delivered(game, "no letter reached the quay");
        expect(seen.sheet?.title).toBe(EN.newsTitle);
        // He is *here*, which is the half a sheet appearing does not prove:
        // a letter that opened with nobody standing in front of it would be
        // the panel working and the arrival not.
        expect(seen.here).toBe(true);
        // And the door is his, not hers — she has not gone anywhere.
        expect(await game.where()).toEqual(quay);

        await game.press("Escape");
        // Long enough for him to step back through and the hole to shut.
        await game.settle(2000);
        const after = await post(game);
        expect(after.here).toBe(false);
        expect(after.arriving).toBe(false);
        expect(after.sheet).toBe(null);
      });
    },
    5 * MINUTES,
  );

  test(
    "it is remembered, so the next morning nobody comes",
    async () => {
      await play({ seams: `${STILL}&intro` }, async (game) => {
        // The welcome catches a child up on the whole list, which is the
        // rule worth pinning on its own: somebody being told what the game
        // *is* must not then be handed a letter about what changed in it.
        await welcomed(game);
        await game.reload(STILL);
        await game.settle(1500);
        expect((await post(game)).owed).toBe(null);

        // Now the letter, asked for; and then gone for good, because the
        // count was moved past the list the moment it was handed over.
        await game.reload(`${STILL}&news`);
        await delivered(game, "he never arrived with the letter");
        await game.press("Escape");
        await game.settle(500);
        await game.reload(STILL);
        await game.settle(1500);
        const after = await post(game);
        expect(after.owed).toBe(null);
        expect(after.here).toBe(false);
        expect(after.sheet).toBe(null);
      });
    },
    5 * MINUTES,
  );
});
