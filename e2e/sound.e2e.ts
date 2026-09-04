// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { afterAll, describe, expect, test } from "bun:test";
import { PlantType } from "../src/world/plants";
import { play, seedButton, shutDown } from "./harness";

const MINUTES = 60_000;

afterAll(shutDown);

interface SoundReport {
  tune: string | null;
  notes: number;
  effects: number;
  knows: number;
  enabled: boolean;
  state: string;
}

/**
 * The sound, which is the one thing in this game a scenario cannot check by
 * looking at it.
 *
 * Everything else in `e2e/` ends up as pixels, and a screenshot is the
 * backstop when an assertion is wrong about what it is asserting. There is
 * no screenshot of a sound. So the game is asked instead — how many notes it
 * has actually handed to the sound card — and that number is the whole point
 * of the file: a tune that loaded, parsed, chose itself correctly and played
 * *nothing* looks identical from the outside to one that is playing, and
 * that is the failure this is most likely to have.
 *
 * It is also the failure that is hardest to catch anywhere else, because it
 * is a rule of the browser rather than of this code: audio does not start
 * until somebody has touched the page. Every unit test in `src/audio/` runs
 * without a browser and so cannot see that rule at all.
 */
const AT_HOME = "&hour=12&freezeNpcs";

async function sound(game: import("./harness").Game): Promise<SoundReport> {
  return game.seam<SoundReport>("sound");
}

describe("the music", () => {
  test(
    "starts once the page has been touched, and plays the place she is in",
    async () => {
      await play({ seams: AT_HOME }, async (game) => {
        // A real tap, which is what a browser wants before it will make a
        // sound. Opening the options and shutting them again is the one
        // gesture in this game that changes nothing.
        await game.tap("options");
        await game.settle(400);
        await game.press("Escape");
        await game.settle(1200);

        const playing = await sound(game);
        expect(playing.state).toBe("running");
        expect(playing.enabled).toBe(true);
        // Noon in the village, which is where every child starts.
        expect(playing.tune).toBe("village_day");
        // The assertion this file exists for.
        expect(playing.notes).toBeGreaterThan(0);

        // And it keeps going, rather than laying down one window and
        // stopping — which is what a scheduler whose cursor does not
        // advance looks like from here.
        const later = await (async () => {
          await game.settle(2500);
          return sound(game);
        })();
        expect(later.notes).toBeGreaterThan(playing.notes);
      });
    },
    3 * MINUTES,
  );

  test(
    "is the same place after dark, and stops when it is switched off",
    async () => {
      await play({ seams: "&hour=23&freezeNpcs" }, async (game) => {
        await game.tap("options");
        await game.settle(400);
        await game.press("Escape");
        await game.settle(1200);

        // Eleven at night: the same village, the other tune.
        expect((await sound(game)).tune).toBe("village_night");

        await game.tap("options");
        await game.settle(500);
        expect(await game.tap("sound.off")).toBe(true);
        await game.settle(600);
        const quiet = await sound(game);
        expect(quiet.enabled).toBe(false);
        expect(quiet.tune).toBeNull();

        // Nothing more is handed over. Notes already on the sound card play
        // themselves out under a gain being taken away, which is why this
        // waits well past the crossfade before counting.
        await game.settle(2500);
        expect((await sound(game)).notes).toBe(quiet.notes);

        // And the choice belongs to the device, so it is still off tomorrow.
        await game.reload();
        await game.settle(800);
        expect((await sound(game)).enabled).toBe(false);
      });
    },
    3 * MINUTES,
  );
});

/**
 * The world's own noises, which are the other half of the sound and are not
 * checked the same way at all.
 *
 * The music proves itself by *keeping going* — a count that climbs while
 * nobody does anything. An effect proves itself the opposite way: nothing at
 * all until the moment it belongs to, and then exactly one more. So this
 * counts before and after a single action rather than watching a number
 * grow, and the action it picks is one a child does in the first minute.
 */
describe("the world's own noises", () => {
  test(
    "the whole set arrives at the first touch, and acting makes a noise",
    async () => {
      await play({ seams: AT_HOME }, async (game) => {
        await game.tap("options");
        await game.settle(400);
        await game.press("Escape");
        await game.settle(900);

        // All twelve, in one file, fetched at the gesture that unlocked the
        // audio rather than lazily like a tune — the first coin a child
        // earns must not be the silent one.
        const ready = await sound(game);
        expect(ready.knows).toBe(12);

        // Opening the options was itself paper being turned, so something
        // has already been struck by now.
        expect(ready.effects).toBeGreaterThan(0);

        // And doing something in the world is audible. Deliberately not
        // asserted as *which* sound: whether a seed goes into this
        // particular square or the square refuses it is a fact about where
        // she happens to be standing, and a scenario that pinned it would be
        // testing the village layout. Which sound belongs to which moment is
        // settled in `src/audio/sfx.test.ts`, where it can be asked exactly.
        const before = (await sound(game)).effects;
        await game.tap("seeds");
        await game.settle(250);
        await game.tap(seedButton(PlantType.Carrot));
        await game.settle(400);
        const at = await game.where();
        await game.tapCell(at.col, at.row);
        await game.settle(500);
        expect((await sound(game)).effects).toBeGreaterThan(before);
      });
    },
    3 * MINUTES,
  );

  test(
    "and nothing is struck once the sound is switched off",
    async () => {
      await play({ seams: AT_HOME }, async (game) => {
        await game.tap("options");
        await game.settle(500);
        expect(await game.tap("sound.off")).toBe(true);
        await game.settle(500);
        await game.press("Escape");
        await game.settle(400);

        const quiet = (await sound(game)).effects;
        await game.tap("seeds");
        await game.settle(250);
        await game.tap(seedButton(PlantType.Carrot));
        await game.settle(400);
        const at = await game.where();
        await game.tapCell(at.col, at.row);
        await game.settle(500);
        expect((await sound(game)).effects).toBe(quiet);
      });
    },
    3 * MINUTES,
  );
});
