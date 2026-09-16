// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { afterAll, describe, expect, test } from "bun:test";
import { uiTextureKey } from "../src/ui/assets";
import { itemIcon } from "../src/ui/assets";
import { DOME_OWES, owedAt } from "../src/ui/placeMarks";
import { RUNE_OF } from "../src/ui/runes";
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

/**
 * And what that map now says about the five places.
 *
 * It drew where everywhere was and never whether any of it was worth the
 * walk. That was hardest on the observatory: the one anchor area with no
 * spell to give, no guide pointing at it and no rune that names it, which
 * turns out to hold the blueprint the last of the mechanic's jobs cannot be
 * finished without. A child could stand in front of this map with nothing
 * left to do in the city and read no hint at all that the answer was up a
 * mountain.
 *
 * So each place wears what it still has for her, in the guide's own cyan —
 * the same colour and the same meaning as the rune over a teacher's head,
 * which is where she has already met *this one still has something for you*.
 * It has to be a browser scenario: `placeMarks.test.ts` proves which pictures
 * are owed, and what it cannot prove is that they are drawn.
 *
 * **It reloads twice, and that is where its time goes.** A reload re-boots
 * the whole game, so this one test is worth about forty seconds on its own.
 * Two are needed because what is being compared is the same map read by two
 * different children — one owed everything, one owed nothing — and a seam
 * cannot change who is playing. Anyone adding a third scenario to this file
 * should split it instead.
 */
describe("what the map says is left to do", () => {
  test(
    "marks every place for a newcomer, the dome included, and nothing for a child who has been everywhere",
    async () => {
      await play({ seams: `${AT_HOME}&learned=all&lampsLit`, firstTime: true }, async (game) => {
        const doors = await game.seam<Record<string, { col: number; row: number }>>("doors");
        const door = doors["post-office"];
        if (!door) throw new Error("this village has no post office");

        // A child who knows every spell and has lit the astronomer's path:
        // nothing anywhere is owed, so the map says nothing beyond where
        // things are — which is what makes the marks worth reading at all.
        await game.reload(`${AT_HOME}&learned=all&lampsLit&at=${door.col},${door.row + 1}`);
        await game.walk("ArrowUp", 700);
        await game.stopped();
        expect(await game.tap("wallMap")).toBe(true);
        await game.settle(600);
        expect(await game.seam<boolean>("mapOpen")).toBe(true);
        expect(await game.seam<string[]>("mapOwes")).toEqual([]);

        // And the same map for a newcomer, who is owed something in all five.
        // Five pictures, not four: the fifth is the dome's, and it is the
        // blueprint's own picture rather than a rune, because the astronomer
        // is the one teacher in the game who pays in a machine.
        await game.reload(`${AT_HOME}&at=${door.col},${door.row + 1}`);
        await game.walk("ArrowUp", 700);
        await game.stopped();
        expect(await game.tap("wallMap")).toBe(true);
        await game.settle(600);
        const owed = await game.seam<string[]>("mapOwes");
        // Five spells across four places — the city holds two — and the
        // dome's machine, so six pictures over the five places. Named by the
        // same functions the panel draws from, so a rune renamed cannot
        // leave this passing against a stale string.
        expect(new Set(owed)).toEqual(
          new Set([
            uiTextureKey(RUNE_OF.portal),
            uiTextureKey(RUNE_OF.array),
            uiTextureKey(RUNE_OF.share),
            uiTextureKey(RUNE_OF.hourglass),
            uiTextureKey(RUNE_OF.logic),
            uiTextureKey(itemIcon(DOME_OWES)),
          ]),
        );
        // And the dome really is marked, which is the whole reason for this.
        expect(owed).toContain(uiTextureKey(itemIcon(DOME_OWES)));
        expect(owedAt("observatory", () => true, false)).toHaveLength(1);
      });
    },
    5 * MINUTES,
  );
});
