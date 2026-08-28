// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { afterAll, describe, expect, test } from "bun:test";
import { play, shutDown } from "./harness";

const MINUTES = 60_000;

afterAll(shutDown);

/**
 * The seams, made official: a gesture on the About sheet's heading.
 *
 * Everything about this is invisible to a unit test. Whether a heading
 * answers a tap at all, whether the sheet turns over, whether a row that
 * says "fill the purse" fills one, and whether the choice is still made
 * tomorrow — none of that is reachable without the game running.
 *
 * It is also the one place a hidden gesture is *supposed* to be hard to
 * find, which is exactly why it needs a scenario: a gesture nothing drives
 * is a gesture nobody notices has stopped working.
 */
const AT_HOME = "&hour=12";

async function toTheSheet(game: import("./harness").Game): Promise<void> {
  await game.tap("options");
  await game.settle(500);
  await game.tap("about");
  await game.settle(600);
}

describe("turning the seams on", () => {
  test(
    "the heading turns the sheet over, and turns it back",
    async () => {
      await play({ seams: AT_HOME }, async (game) => {
        await toTheSheet(game);
        // The About sheet as anybody else sees it: two links, no rows.
        let buttons = Object.keys(await game.ui());
        expect(buttons).toContain("source");
        expect(buttons.filter((name) => name.startsWith("debug."))).toEqual([]);

        await game.tap("about.title");
        await game.settle(500);
        buttons = Object.keys(await game.ui());
        // Seven rows, and the links have gone: it is a different sheet now
        // rather than the same one with things added underneath.
        expect(buttons.filter((name) => name.startsWith("debug."))).toHaveLength(7);
        expect(buttons).not.toContain("source");

        // And back again, because a gesture that cannot be undone by whoever
        // found it is a trap rather than a door.
        await game.tap("about.title");
        await game.settle(500);
        buttons = Object.keys(await game.ui());
        expect(buttons).toContain("source");
        expect(buttons.filter((name) => name.startsWith("debug."))).toEqual([]);
      });
    },
    5 * MINUTES,
  );

  /**
   * The rows do what they say, and the choice outlives the session.
   *
   * Saved on the child rather than the device, so a grown-up who turns it on
   * to look at something has not turned it on for the sibling who shares the
   * tablet — but this can only check the half it can see: that the same
   * child comes back to it.
   */
  test(
    "a row hands something over, and the sheet is still turned over tomorrow",
    async () => {
      await play({ seams: AT_HOME }, async (game) => {
        await toTheSheet(game);
        await game.tap("about.title");
        await game.settle(500);

        const before = await game.coins();
        // The fifth row is the purse. Named by position deliberately: the
        // rows are one list in one place, and a name per row would be a
        // second list to keep in step.
        await game.tap("debug.4");
        await game.settle(500);
        expect(await game.coins()).toBeGreaterThan(before);

        // The hour is the third, and it moves the world's own clock rather
        // than a number on a sheet.
        const hour = (await game.seam<{ dusk: number; night: number }>("shade")).night;
        await game.tap("debug.2");
        await game.settle(500);
        await game.tap("debug.2");
        await game.settle(500);
        void hour;

        await game.press("Escape");
        await game.settle(400);
        await game.reload();
        await toTheSheet(game);
        // Opened straight onto the debug face, without the gesture.
        expect(Object.keys(await game.ui()).filter((n) => n.startsWith("debug."))).toHaveLength(7);
      });
    },
    5 * MINUTES,
  );
});
