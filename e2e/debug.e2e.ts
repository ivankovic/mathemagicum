// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { afterAll, describe, expect, test } from "bun:test";
import { Guide } from "../src/ui/guide";
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
        // Eight rows, and the links have gone: it is a different sheet now
        // rather than the same one with things added underneath.
        expect(buttons.filter((name) => name.startsWith("debug."))).toHaveLength(8);
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
        expect(Object.keys(await game.ui()).filter((n) => n.startsWith("debug."))).toHaveLength(8);
      });
    },
    5 * MINUTES,
  );
});

/**
 * Giving the tutorial back, which is the row with a story behind it.
 *
 * It used to happen by accident: talking to the postman reset the guide, and
 * a playtest found that the way you find that sort of thing — halfway
 * through the tutorial, having just said hello to somebody. Taking the
 * accident out took the only way of replaying it with it, and a tutorial
 * that can be seen once per child is one a parent cannot show a younger
 * sibling.
 *
 * Asserted on what the guide is doing rather than on the row existing,
 * because clearing the saved list is only half of it: the run holds the list
 * it was built with, so a version that forgot and did not start again would
 * pass a check on the save file and show a child nothing at all.
 */
describe("asking for the tutorial again", () => {
  test(
    "a guide already finished comes back, and is running from the top",
    async () => {
      await play({ seams: AT_HOME, firstTime: true }, async (game) => {
        // Four taps, which is the whole first guide: pouch, seed, square.
        await game.tap("seeds");
        await game.settle(300);
        await game.tap("seeds.0");
        await game.settle(300);
        const bed = await game.squareBeside();
        await game.tapCell(bed.col, bed.row);
        await game.settle(600);
        const before = await game.seam<{ done: string[] }>("guide");
        expect(before.done).toContain(Guide.Plant);

        await toTheSheet(game);
        await game.tap("about.title");
        await game.settle(500);
        // The eighth row, by position, the way the purse is the fifth.
        expect(await game.tap("debug.7")).toBe(true);
        await game.settle(400);
        await game.press("Escape");
        await game.settle(600);

        const after = await game.seam<{
          done: string[];
          running: string | null;
          step: number | null;
        }>("guide");
        // Forgotten, and started again: nothing done, and the pouch being
        // pointed at once more.
        expect(after.done).toEqual([]);
        expect(after.running).toBe(Guide.Plant);
        expect(after.step).toBe(0);

        // And still forgotten tomorrow, which is the case the row is for: a
        // grown-up taps it and hands the tablet to a younger child, and that
        // is a different session by the time anybody plays. An empty list
        // has to survive `readGuided` the same way a full one does, and a
        // reader that treated empty as "nothing saved, use the default"
        // would put the finished tutorial back and pass every assertion
        // above.
        await game.reload();
        await game.settle(800);
        const tomorrow = await game.seam<{ done: string[]; running: string | null }>("guide");
        expect(tomorrow.done).toEqual([]);
        expect(tomorrow.running).toBe(Guide.Plant);
      });
    },
    5 * MINUTES,
  );
});
