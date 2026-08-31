// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import { afterAll } from "bun:test";
import { SAND_MOST_MS } from "../src/spells/hourglass";
import { Spell } from "../src/spells/spellbook";
import { clockFace } from "../src/world/time";
import { type Game, play, runeButton, shutDown } from "./harness";

const MINUTES = 60_000;

// The dev server goes when this file is done with it, which is safe because
// `run.ts` gives every scenario file a process of its own.
afterAll(shutDown);

/**
 * Winding the world's clock.
 *
 * The hourglass is the one spell whose control is a *picture*: two hands on
 * a face, taken hold of and swung. There is no button for a script to press
 * and the hand is two pixels wide, so all of this goes through `grip` — the
 * same argument as the shop's counter.
 *
 * And the one spell whose effect is the *light*, which a script cannot see
 * at all. What it can see is the number behind the light, which is why the
 * world's clock is a seam.
 *
 * Deliberately no `&hour=`: every other scenario file pins the clock so that
 * night never falls in the middle of one, and a pinned clock is exactly what
 * this file must not have — it would mask the whole spell.
 */

interface Cast {
  from: { hour: number; minute: number };
  to: { hour: number; minute: number };
  hours: number;
  minutes: number;
  entry: string;
  asksMinutes: boolean;
  done: boolean;
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
 * What the world's clock reads, on a twelve-hour face.
 *
 * The seam gives the hour as a fraction of a day because that is what the
 * light is drawn from; this is the same number said the way a clock says it.
 */
function face(world: World): { hour: number; minute: number } {
  return { hour: Math.floor(world.hour) % 12, minute: Math.floor((world.hour % 1) * 60) };
}

/**
 * Wait for the sand to finish running.
 *
 * The clock is not written down until the last grain falls — so a scenario
 * that read the world a second after answering was reading it mid-pour, and
 * getting an offset of nought because nothing had settled yet. The longest
 * the glass ever runs is three seconds; this waits out that and the pause
 * the parchment takes before it closes.
 */
async function settled(game: Game): Promise<void> {
  await game.settle(SAND_MOST_MS + 900);
}

/** Open the spellbook at the hourglass. */
async function castHourglass(game: import("./harness").Game): Promise<Cast> {
  await game.tap("spellbook");
  await game.tap(runeButton(Spell.Hourglass));
  await game.settle(500);
  const cast = await game.seam<Cast | null>("clock");
  if (!cast) throw new Error("the hourglass did not open");
  return cast;
}

describe("winding the world's clock", () => {
  /**
   * The whole spell in one scenario.
   *
   * It used to be uncastable unless the child had been away *and* left
   * something planted *and* been away long enough for it to matter — three
   * gates on the one spell hardest to reach. Now it opens whenever it is
   * asked, and what it wants is the arithmetic.
   */
  test(
    "put the hands where you want them, say how far that is, and the day moves",
    async () => {
      await play({ seams: "&learned=all&clockRung=0" }, async (game) => {
        const before = await game.seam<World>("worldClock");
        expect(before.offset).toBe(0);

        const opened = await castHourglass(game);
        // It opens showing the time it actually is, not a puzzle somebody set.
        expect(opened.to).toEqual(opened.from);
        expect(opened.hours).toBe(0);

        // Three hours on. The hand is dragged; nothing is typed to move it.
        // Three hours is thirty-six ticks of five minutes, swiped down and
        // to the right — which is clockwise, which is forward.
        const wanted = (opened.from.hour + 3) % 12;
        await game.swipeClock(36);
        const asked = await game.seam<Cast>("clock");
        expect(asked.to.hour).toBe(wanted);
        expect(asked.hours).toBe(3);

        await game.type(asked.hours);
        await game.press("Enter");
        await settled(game);

        // The world is where she pointed, and it moved forward to get there.
        //
        // Deliberately not "the world hour went up by three": the three is
        // measured between two *rounded* faces, and the world winds to the
        // face she chose rather than by the span — so from a real 9:44 with
        // a face reading 9:00, a three-hour move lands on 12:00, which is
        // two and a quarter hours of actual winding.
        const after = await game.seam<World>("worldClock");
        expect(face(after).hour).toBe(asked.to.hour);
        expect(after.offset).toBeGreaterThan(0);
        // Forward, allowing for midnight.
        //
        // Not `after.hour > before.hour`, which is true for twenty-one hours
        // of the day and false for the other three: `hour` is the hour *of
        // the day*, so three hours wound on from ten past nine at night is
        // ten past midnight — a smaller number, and a day later. Run in the
        // evening, that assertion failed on a clock that had done exactly
        // what it was asked.
        expect((after.hour - before.hour + 24) % 24).toBeGreaterThan(0);
      });
    },
    5 * MINUTES,
  );

  /**
   * And a wrong answer moves nothing.
   *
   * The gate the whole spell rests on: winding is what you are paid for
   * being able to read the two faces, so a child who cannot must not get it
   * anyway by closing the parchment.
   */
  test(
    "but saying the wrong number winds nothing",
    async () => {
      await play({ seams: "&learned=all&clockRung=0" }, async (game) => {
        const opened = await castHourglass(game);
        await game.swipeClock(48);
        expect((await game.seam<Cast>("clock")).hours).toBe(4);

        // Two, against an answer of four.
        await game.type(2);
        await game.press("Enter");
        await game.settle(600);
        const still = await game.seam<Cast>("clock");
        expect(still.done).toBe(false);
        expect(still.entry).toBe("");

        // And walking away from it winds nothing either.
        await game.press("Escape");
        await game.settle(500);
        expect((await game.seam<World>("worldClock")).offset).toBe(0);
      });
    },
    5 * MINUTES,
  );

  /**
   * Further up the ladder the face can show a quarter, so the answer has two
   * halves and the parchment asks for both.
   */
  test(
    "and a move with minutes in it asks for those too",
    async () => {
      await play({ seams: "&learned=all&clockRung=4" }, async (game) => {
        const opened = await castHourglass(game);
        // Nothing moved yet, so there is nothing to ask about.
        expect(opened.asksMinutes).toBe(false);

        await game.swipeClock(24);
        // One tick past where the minute hand already was. At this rung the
        // face reads to the quarter, so the hand starts on one of four marks
        // and a single tick on never runs past the hour — which keeps the
        // answer two hours and five minutes whatever time it happens to be.
        await game.swipeClock(1);
        const asked = await game.seam<Cast>("clock");
        expect(asked.asksMinutes).toBe(true);
        expect(asked.hours * 60 + asked.minutes).toBe(125);

        await game.type(asked.hours);
        await game.press("Enter");
        await game.type(asked.minutes);
        await game.press("Enter");
        await settled(game);
        const landed = face(await game.seam<World>("worldClock"));
        expect(landed).toEqual({ hour: asked.to.hour, minute: asked.to.minute });
      });
    },
    5 * MINUTES,
  );

  /**
   * Swiping back turns the hands back, and asks for nearly a whole day.
   *
   * The clock only ever runs forward, so hands wound anticlockwise to an
   * hour already gone point at that hour tomorrow. Worth a scenario because
   * it is the thing about this control that surprises: back on the face is
   * not back in the world.
   */
  test(
    "swiping anticlockwise turns the hands back and asks for nearly a whole day",
    async () => {
      await play({ seams: "&learned=all&clockRung=4" }, async (game) => {
        const opened = await castHourglass(game);
        await game.swipeClock(-1);
        const asked = await game.seam<Cast>("clock");
        expect(asked.hours).toBe(11);
        expect(asked.minutes).toBe(55);
        const back = (opened.from.hour * 60 + opened.from.minute - 5 + 720) % 720;
        expect(asked.to).toEqual({ hour: Math.floor(back / 60) % 12, minute: back % 60 });
      });
    },
    5 * MINUTES,
  );

  /**
   * And what she pointed at is where the world ends up.
   *
   * The span she answers is measured between two *rounded* faces and the
   * world is not rounded, so winding by it would leave the clock a few
   * minutes short of the time she chose. Nobody would notice at the gentlest
   * rung; everybody would at the hardest, where the face shows quarters.
   */
  test(
    "and the world lands on the time she pointed at, not near it",
    async () => {
      await play({ seams: "&learned=all&clockRung=4" }, async (game) => {
        const opened = await castHourglass(game);
        await game.swipeClock(36);
        await game.swipeClock(8);
        const asked = await game.seam<Cast>("clock");

        await game.type(asked.hours);
        await game.press("Enter");
        if (asked.asksMinutes) {
          await game.type(asked.minutes);
          await game.press("Enter");
        }
        await settled(game);

        // To the minute, or the minute after it.
        //
        // Not slack for its own sake: the world's clock is the wall clock
        // plus an offset and it keeps running, so the real minute can turn
        // over between answering and reading — which it does about once in
        // fourteen runs, the sand taking up to three seconds of a sixty
        // second minute. What this is guarding against is a landing several
        // minutes short of the time she chose, which is what winding by the
        // rounded *span* rather than to the face used to do, and one minute
        // of tolerance still catches every bit of that.
        const landed = face(await game.seam<World>("worldClock"));
        const off =
          (landed.hour * 60 + landed.minute - (asked.to.hour * 60 + asked.to.minute) + 720) % 720;
        expect({ landed, off: off <= 1 }).toEqual({ landed, off: true });
      });
    },
    5 * MINUTES,
  );

  /**
   * The glass turns, and the day moves while you watch it.
   *
   * The only spell in the game whose size shows: every other cast lands in
   * the same instant whatever the answer, but this one moves the world by an
   * amount the child chose, so the sand runs for as long as the move was
   * worth. What makes it worth watching is that the light comes with it — a
   * child who winds the clock to dusk sees dusk arrive rather than being
   * handed it.
   */
  test(
    "the sand runs, and the world's light moves with it",
    async () => {
      await play({ seams: "&learned=all&clockRung=0" }, async (game) => {
        const before = await game.seam<World>("worldClock");
        const opened = await castHourglass(game);
        // Nearly a whole face, which is the longest the sand ever runs.
        await game.swipeClock(108);
        const asked = await game.seam<Cast>("clock");

        await game.type(asked.hours);
        await game.press("Enter");
        // Partway through: the clock has left where it was and has not
        // arrived, which is the whole of what "pouring" means.
        await game.settle(1200);
        const pouring = await game.seam<World>("worldClock");
        // Allowing for midnight, for the reason the first scenario spells
        // out: this one winds nearly a whole face, so it crosses midnight
        // from any evening at all.
        expect((pouring.hour - before.hour + 24) % 24).toBeGreaterThan(0);
        expect(face(pouring).hour).not.toBe(asked.to.hour);
        // And nothing is written down until it settles, so a page closed
        // mid-pour reopens on the hour it was wound to, not one in between.
        expect(pouring.offset).toBe(0);

        await game.settle(3000);
        const settled = await game.seam<World>("worldClock");
        expect(face(settled).hour).toBe(asked.to.hour);
        expect(settled.offset).toBeGreaterThan(0);
      });
    },
    5 * MINUTES,
  );

  /**
   * A wound clock is a wound clock tomorrow.
   *
   * The spell's whole reward is the world it leaves behind, and a world that
   * snapped back to the wall clock overnight would be a spell that undoes
   * itself while nobody is looking.
   */
  test(
    "the clock stays where she put it, even after the tab is closed",
    async () => {
      await play({ seams: "&learned=all&clockRung=0" }, async (game) => {
        const opened = await castHourglass(game);
        await game.swipeClock(60);
        const asked = await game.seam<Cast>("clock");
        await game.type(asked.hours);
        await game.press("Enter");
        await settled(game);
        const wound = await game.seam<World>("worldClock");
        expect(wound.offset).toBeGreaterThan(0);

        await game.reload();
        const back = await game.seam<World>("worldClock");
        expect(back.offset).toBe(wound.offset);
      });
    },
    5 * MINUTES,
  );
});

/**
 * The clock in the corner of the screen.
 *
 * Reported from a playtest: *the UI is missing a clock and date. It's hard
 * for the player to know if it is day or night.* Everything in this game
 * that turns on the hour had no face anywhere on the screen — so a child met
 * a locked door with nothing to check it against, and the only thing saying
 * it was night was a tint she had no baseline for.
 *
 * Here rather than in a file of its own because the interesting half is the
 * spell: this must read the world's clock and not the tablet's, or winding
 * the glass would move the sky and leave the one number on screen insisting
 * it was still the afternoon.
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
