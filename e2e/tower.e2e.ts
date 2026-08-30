// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { afterAll, describe, expect, test } from "bun:test";
import { type Game, play, shutDown } from "./harness";

const MINUTES = 60_000;

afterAll(shutDown);

/**
 * The one door in the village that does not shut at night.
 *
 * Reported from a playtest: start the game after six in the evening and the
 * map cannot be reached at all. The map hangs in the post office tower, the
 * tower kept the village's hours, and a five-year-old sitting down at
 * bedtime could not see where anything in the world was.
 *
 * The answer the game would like to give is the hourglass, and it is
 * circular: winding the clock is a spell, spells are learned in buildings,
 * and finding a building is what the map is for. So the door that holds the
 * map is open until she has the portal — the spell that crosses the world,
 * and the point at which one shut door stops being the end of the matter.
 *
 * A file of its own rather than three more scenarios in `curfew.e2e.ts`.
 * Every door tried here is a page reload, the suite runs one browser per
 * file, and a browser asked for enough pages in a row stops answering — a
 * failure that arrives as a test timing out several tests later, on
 * whichever one happened to be unlucky. Splitting the reloads across two
 * processes is the fix; a longer timeout only makes the hang cost more.
 */
const AT_NOON = "&hour=12";

/** The hour the report was about, and the darkest reading of it. */
const NIGHT = 2;

interface Inside {
  room: string;
  building: string | null;
}

/** Where a building's door is, by the world's own name for it. */
async function doorOf(game: Game, wanted: string): Promise<{ col: number; row: number }> {
  const doors = await game.seam<Record<string, { col: number; row: number }>>("doors");
  const door = doors[wanted];
  if (!door) throw new Error(`no ${wanted} in this world`);
  return door;
}

/**
 * Walk at a door at a given hour and say what is behind it, or nothing.
 *
 * `learned` is a parameter rather than always "all", and that matters for
 * exactly one door in the game: the tower keeps open hours *until a child
 * has the portal*, so a scenario that knows every spell can never see it
 * open. It cost one confused failure before that was noticed.
 */
async function tryTheDoor(
  game: Game,
  hour: number,
  wanted: string,
  learned: string,
): Promise<Inside | null> {
  const door = await doorOf(game, wanted);
  await game.reload(`&learned=${learned}&hour=${hour}&at=${door.col},${door.row + 1}`);
  // A reload is not one load: the page boots, reads what was saved and boots
  // again, and a walk sent into the gap between the two goes nowhere at all
  // — which reads from here as a door that would not open.
  await game.settle(600);
  await game.walk("ArrowUp", 900);
  await game.stopped();
  return game.seam<Inside | null>("inside");
}

describe("the tower keeps its own hours", () => {
  test(
    "it is open at two in the morning, when the school is not",
    async () => {
      await play({ seams: AT_NOON }, async (game) => {
        // The school, as the thing the tower is being compared against: a
        // door that does keep the village's hours, so this pair says "the
        // tower is special" rather than "it is not really night".
        const school = await tryTheDoor(game, NIGHT, "school", "growth");
        expect(school?.room ?? null).toBeNull();

        // Read by the room she is standing in, not by the building she came
        // through: only the house a child lives in names its building on the
        // way in, so `building` is null for every other door and asserting
        // on it here would pass whether she got in or not.
        const tower = await tryTheDoor(game, NIGHT, "post-office", "growth");
        expect(tower?.room ?? null).toBe("tower");

        // And the thing she came for opens. The report was not "a door is
        // shut", it was "the map cannot be reached at all" — and an open
        // door is only half of that. The map is a picture hanging on this
        // wall, tapped like any other, and nothing else in the game opens
        // it.
        const wall = (await game.ui()).wallMap;
        if (!wall) throw new Error("no map on the tower wall");
        expect(await game.seam<boolean>("mapOpen")).toBe(false);
        await game.tab.mouse.click(wall.x, wall.y);
        await game.settle(500);
        expect(await game.seam<boolean>("mapOpen")).toBe(true);
      });
    },
    5 * MINUTES,
  );

  /**
   * And it shuts like everything else once she can find her own way.
   *
   * A village where one door never shuts is a village with a rule that has
   * an exception nobody can see the shape of. This one has a shape, and it
   * ends. Without this the change is not "the tower waits for her", it is
   * "the tower has no hours", and nothing would ever have said so.
   */
  test(
    "and it shuts at the same hour once she has the portal",
    async () => {
      await play({ seams: AT_NOON }, async (game) => {
        const tower = await tryTheDoor(game, NIGHT, "post-office", "all");
        expect(tower?.room ?? null).toBeNull();
      });
    },
    5 * MINUTES,
  );
});
