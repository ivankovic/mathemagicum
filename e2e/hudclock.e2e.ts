// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { afterAll, describe, expect, test } from "bun:test";
import { SAND_MOST_MS } from "../src/spells/hourglass";
import { Spell } from "../src/spells/spellbook";
import { clockFace } from "../src/world/time";
import { type Game, play, runeButton, shutDown } from "./harness";

const MINUTES = 60_000;

afterAll(shutDown);

interface Cast {
  hours: number;
}

interface World {
  hour: number;
  offset: number;
}

/** What the corner of the screen is showing about the time. */
interface Corner {
  time: string;
  date: string;
  sky: string;
  shown: boolean;
}

/**
 * The corner clock, once it is back on screen.
 *
 * It is hidden while a panel is open, like everything else in the interface
 * — and while it is hidden it is not rewritten either, so what it holds is
 * whatever it last said out of doors.
 */
async function shown(game: Game): Promise<Corner> {
  for (let look = 0; look < 20; look++) {
    const corner = await game.seam<Corner>("hudClock");
    if (corner.shown) return corner;
    await game.settle(300);
  }
  throw new Error("the clock never came back out from behind the parchment");
}

/**
 * Wait for the sand to finish running.
 *
 * The clock is not written down until the last grain falls, so a reading
 * taken a second after answering is a reading taken mid-pour.
 */
async function settled(game: Game): Promise<void> {
  await game.settle(SAND_MOST_MS + 900);
}

/** Open the spellbook at the hourglass. */
async function castHourglass(game: Game): Promise<Cast> {
  await game.tap("spellbook");
  await game.tap(runeButton(Spell.Hourglass));
  await game.settle(500);
  const cast = await game.seam<Cast | null>("clock");
  if (!cast) throw new Error("the hourglass did not open");
  return cast;
}

/**
 * The clock in the corner of the screen.
 *
 * Reported from a playtest: *the UI is missing a clock and date. It's hard
 * for the player to know if it is day or night.* Everything in this game
 * that turns on the hour had no face anywhere on the screen — so a child met
 * a locked door with nothing to check it against, and the only thing saying
 * it was night was a tint she had no baseline for.
 *
 * **A file of its own, and it was not.** It lived at the foot of
 * `clock.e2e.ts` on the argument that the interesting half is the spell —
 * this has to read the world's clock and not the tablet's, or winding the
 * glass would move the sky and leave the one number on screen insisting it
 * was still the afternoon. That argument is about what the scenarios *say*
 * and says nothing about what they cost, and adding them took that file to
 * nine scenarios and eight minutes.
 *
 * It then failed the way `tower.e2e.ts` warns about in as many words: every
 * scenario here is a page reload, the suite gives a file one browser, and a
 * browser asked for enough pages in a row stops answering. The ninth
 * scenario sat through its five-minute budget and gave up — while all nine
 * pass in two and a half minutes when the file is run on its own. Splitting
 * the reloads across two processes is the fix; a longer timeout only makes
 * the hang cost more.
 *
 * The spell's own scenarios stay where they are. What moved is the two that
 * are about the *corner*, which is the natural seam and also the one that
 * makes both halves small enough.
 */
describe("the clock in the corner", () => {
  test(
    "says the hour on a face, the date, and whether the sun is up",
    async () => {
      await play({ seams: "&hour=13.5" }, async (game) => {
        // Half past one in the afternoon, on a twelve-hour face — the clock
        // this game teaches — with the sun beside it.
        const light = await game.seam<Corner>("hudClock");
        expect({ time: light.time, sky: light.sky, shown: light.shown }).toEqual({
          time: "1:30",
          sky: "ui-mark-day",
          shown: true,
        });
        // And a date, in whatever words this language writes one in. Which
        // day it is depends on when this runs, so only that there is one:
        // `31 Aug` is the shortest any of the three languages gets.
        expect(light.date.length).toBeGreaterThan(3);

        // Ten at night: the same face, the other picture.
        await game.reload("&hour=22");
        await game.settle(600);
        const dark = await game.seam<Corner>("hudClock");
        expect({ time: dark.time, sky: dark.sky }).toEqual({
          time: "10:00",
          sky: "ui-mark-night",
        });
      });
    },
    5 * MINUTES,
  );

  /**
   * And it is the world's clock, not the tablet's.
   *
   * The one rule that matters here and the reason this scenario is in this
   * file. Everything that asks the time goes through `worldNow`, so that
   * winding the glass moves the whole world; a clock drawn from `Date.now`
   * would be the single thing on screen contradicting the spell — the sky
   * going dark while the corner insisted it was the afternoon.
   *
   * Deliberately unpinned. `&hour=` overrides the hour outright, so a pinned
   * scenario would go on reading the pin however far the glass was wound and
   * would pass while testing nothing.
   */
  test(
    "and it follows the glass, not the tablet",
    async () => {
      await play({ seams: "&learned=all&clockRung=0" }, async (game) => {
        const before = await game.seam<Corner>("hudClock");

        const opened = await castHourglass(game);
        expect(opened.hours).toBe(0);
        // Five hours on, which changes the face whatever time it is now.
        await game.swipeClock(60);
        const asked = await game.seam<Cast>("clock");
        await game.type(asked.hours);
        await game.press("Enter");
        await settled(game);

        // The parchment is dismissed, which is what a child does: it holds
        // the finished face until somebody puts it away.
        await game.press("Escape");
        // Waited out rather than read straight away. The clock is part of
        // the interface and the interface stands down while a parchment is
        // up — so a reading taken the moment the sand stops is a reading of
        // a hidden clock, which is the last thing it wrote before the
        // spellbook opened. It failed exactly that way.
        const corner = await shown(game);
        const wound = await game.seam<World>("worldClock");
        expect(wound.offset).toBeGreaterThan(0);
        expect(corner.time).not.toBe(before.time);
        expect(corner.time).toBe(clockFace(wound.hour));
      });
    },
    5 * MINUTES,
  );
});
