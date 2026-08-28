// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { afterAll, describe, expect, test } from "bun:test";
import { play, shutDown } from "./harness";

const MINUTES = 60_000;

afterAll(shutDown);

/**
 * The mark on the map on the post office wall.
 *
 * Reported from a playtest on an iPad: *the player is drawn upper left,
 * because they are not in the world.* Indoors her tile is a **room**
 * coordinate — three across and four down a post office floor — and the map
 * drew that as world cell 3,4, which is up in the far north-west corner of a
 * five-hundred-tile world.
 *
 * The bite is that the one world map a child can reach is the one hanging in
 * that building, so this was true of every time it was ever looked at.
 *
 * It has to be a browser scenario. What is wrong is which *coordinate space*
 * a number is in, and both spaces are grid cells of small integers — nothing
 * about the value says which world it belongs to. Only walking through the
 * door produces the disagreement.
 */
const AT_HOME = "&hour=12&freezeNpcs";

describe("the you-are-here mark", () => {
  test(
    "is on the building she is inside, not on a room coordinate",
    async () => {
      await play({ seams: AT_HOME }, async (game) => {
        const doors = await game.seam<Record<string, { col: number; row: number }>>("doors");
        const door = doors["post-office"];
        if (!door) throw new Error("this village has no post office");

        // Outside, the mark is simply where she is standing.
        const step = { col: door.col, row: door.row + 1 };
        await game.reload(`${AT_HOME}&at=${step.col},${step.row}`);
        expect(await game.seam<{ col: number; row: number }>("mapMark")).toEqual(step);

        // In through the door, and the mark stays on the building.
        await game.walk("ArrowUp", 700);
        await game.stopped();
        const inside = await game.seam<{ room: string } | null>("inside");
        if (!inside) throw new Error("walking through the door did not go indoors");

        // Her tile is now a room coordinate, and it is *not* the answer —
        // asserted, because a mark that happened to agree with it would be
        // the bug back again on a different floor plan.
        const roomCell = await game.where();
        const mark = await game.seam<{ col: number; row: number }>("mapMark");
        expect(mark).toEqual(step);
        expect(mark).not.toEqual(roomCell);
        // And a world cell rather than a corner of the map: the failure drew
        // it within a handful of cells of nought.
        expect(mark.col + mark.row).toBeGreaterThan(50);
      });
    },
    5 * MINUTES,
  );
});
