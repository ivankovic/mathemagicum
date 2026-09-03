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

/** Go up the tower and get the geometer talking. */
async function askTheGeometer(game: Game, rung: number): Promise<Readout> {
  const door = await doorOf(game, "post-office");
  // `freezeNpcs` because the postman is otherwise on his way over with the
  // welcome, and a parchment open across the square is a parchment she
  // cannot walk out from under.
  await game.reload(
    `&learned=growth&freezeNpcs&hour=12&portalRung=${rung}&at=${door.col},${door.row + 1}`,
  );
  await game.settle(600);
  await game.walk("ArrowUp", 900);
  await game.stopped();
  const npcs = await game.seam<Record<string, { col: number; row: number }>>("npcs");
  const him = npcs.geometer;
  if (!him) {
    // Named rather than bare: "he is not there" is nearly always "she never
    // got through the door", and the two read identically from here.
    const inside = await game.seam<unknown>("inside");
    throw new Error(`nobody is under the map in this tower; she is in ${JSON.stringify(inside)}`);
  }
  await game.tapCell(him.col, him.row);
  await game.settle(600);
  const sheet = await game.seam<Readout | null>("geometry");
  if (!sheet) throw new Error("he said nothing");
  return sheet;
}

/**
 * Turn to the nth page and say which one it is.
 *
 * Counted from the front on every call rather than stepping on from
 * wherever the last one left it: a scenario that walked forward would
 * assert the same thing whichever page it had reached, which is how the
 * first draft of this passed with the bug put back.
 */
async function turnTo(game: Game, page: number): Promise<string> {
  for (let back = 0; back < 6; back++) await game.press("ArrowLeft");
  for (let on = 0; on < page; on++) await game.press("ArrowRight");
  await game.settle(400);
  const sheet = await game.seam<Readout | null>("geometry");
  if (!sheet) throw new Error("the parchment closed while it was being read");
  return sheet.page;
}

interface Readout {
  title: string;
  body: string;
  page: string;
  pages: number;
}

/**
 * And what he teaches, which is not the same lesson for every child.
 *
 * Reported twice from playtests, the second time as *the tower still says
 * the wrong tutorial, it does not match the difficulty level*. The first
 * report was him working through the crow's flight — squares and roots — at
 * a five-year-old; cutting his deck to the tier fixed three rungs of four
 * and left the bottom one handing a counting child a **ruler**, which is the
 * instrument belonging to the rung above hers. Her map has no numerals on it
 * at all.
 *
 * `geometryLesson.test.ts` holds the deck. What only a browser can say is
 * that the panel is wired to the child's own rung and draws every page it
 * now claims to have — the stepping stones are new art on a new page, and a
 * page that threw would leave the parchment blank with nothing failing.
 */
describe("the geometer under the map", () => {
  test(
    "shows a counting child the stones and a squaring one the crow",
    async () => {
      await play({ seams: AT_NOON }, async (game) => {
        // The bottom rung. Two pages, and both of them hers: her spell lays
        // stepping stones and asks how many there are, so the second page is
        // the stones. It was the *ruler* — an instrument her map does not
        // draw, for a question she is not asked — and that is the report.
        const counting = await askTheGeometer(game, 0);
        expect(counting.pages).toBe(2);
        expect(counting.page).toBe("rune");
        expect(await turnTo(game, 1)).toBe("stones");
        await game.press("Escape");
        await game.settle(300);

        // And the top rung, which is the first report and has to stay
        // fixed: four pages, no stones anywhere in them, ending on the
        // straight line.
        const squaring = await askTheGeometer(game, 9);
        expect(squaring.pages).toBe(4);
        expect(squaring.page).toBe("rune");
        expect(await turnTo(game, 1)).toBe("ruler");
        expect(await turnTo(game, 2)).toBe("legs");
        expect(await turnTo(game, 3)).toBe("crow");
      });
    },
    5 * MINUTES,
  );
});

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
