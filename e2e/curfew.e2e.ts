// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { afterAll, describe, expect, test } from "bun:test";
import { Spell } from "../src/spells/spellbook";
import { OPENS_AT, SHUTS_AT } from "../src/world/time";
import { type Game, play, runeButton, shutDown } from "./harness";

const MINUTES = 60_000;

afterAll(shutDown);

/**
 * The hours the village keeps.
 *
 * Between six in the evening and eight in the morning the doors are locked
 * and the streets are empty. Which makes this the first thing in the game
 * that a child cannot simply *do* — and the reason it is bearable is the
 * hourglass: the spell stops being about arithmetic and becomes the way you
 * get into a building.
 *
 * Every scenario here pins `&hour=`, on both sides of the boundary. The
 * world's clock follows the wall clock unless it is wound, so a scenario
 * that did not pin it would pass all afternoon and fail after supper.
 */

interface Hours {
  open: boolean;
  hour: number;
  opensIn: number;
}

interface Inside {
  room: string;
  building: string | null;
}

/** Where a building's door is, by the world's own name for it. */
async function doorOf(game: Game, wanted: string): Promise<{ col: number; row: number }> {
  const doors = await game.seam<Record<string, { col: number; row: number }>>("doors");
  const id = Object.keys(doors).find((name) => name.includes(wanted));
  const door = id ? doors[id] : undefined;
  if (!door) throw new Error(`no ${wanted} in this world`);
  return door;
}

/**
 * Stand her on the doorstep and walk her at it.
 *
 * Answered by `inside` rather than by `house`: that one carries the room's
 * plan and only her own house has one, so it says null for the school
 * whether she got in or not — which is a check that passes either way.
 */
async function tryTheDoor(game: Game, hour: number, wanted: string): Promise<Inside | null> {
  const door = await doorOf(game, wanted);
  await game.reload(`&learned=all&hour=${hour}&at=${door.col},${door.row + 1}`);
  await game.press("ArrowUp");
  await game.settle(800);
  return game.seam<Inside | null>("inside");
}

describe("the village shuts for the night", () => {
  test(
    "the school is open in the afternoon and shut in the evening",
    async () => {
      await play({ seams: "&learned=all&hour=12" }, async (game) => {
        expect((await game.seam<Hours>("openHours")).open).toBe(true);
        expect(await tryTheDoor(game, 12, "school")).not.toBeNull();

        // The same door, the same child, four hours later.
        expect(await tryTheDoor(game, SHUTS_AT + 1, "school")).toBeNull();
        const shut = await game.seam<Hours>("openHours");
        expect(shut.open).toBe(false);
        expect(shut.opensIn).toBe(24 - (SHUTS_AT + 1) + OPENS_AT);
      });
    },
    5 * MINUTES,
  );

  /**
   * And her own front door is not one of them.
   *
   * The house a child lives in is reached through the same function every
   * other building is, so a curfew put a line too early would lock her out
   * of it at seven in the evening — with her bed, her stove and everything
   * she owns on the other side.
   */
  test(
    "but she can always get into her own house",
    async () => {
      await play({ seams: "&learned=all&hour=12" }, async (game) => {
        for (const hour of [12, SHUTS_AT + 1, 2, OPENS_AT - 1]) {
          const inside = await tryTheDoor(game, hour, "player-house");
          expect({ hour, inside: inside?.building ?? null }).toEqual({
            hour,
            inside: "player-house",
          });
        }
      });
    },
    5 * MINUTES,
  );

  /**
   * And the village follows the world's clock, wherever the glass puts it.
   *
   * The one scenario here that must *not* pin `&hour=`, and the reason is
   * the same one `clock.e2e.ts` gives: the pin overrides the hour outright,
   * so a wound clock changes the offset underneath it and the village goes
   * on reading the pinned hour. Pinned, this would pass while testing
   * nothing.
   *
   * So it winds from wherever the wall clock happens to be and checks the
   * *relationship* rather than a particular hour — that the doors follow the
   * clock she moved. Which hour is open is arithmetic, and `time.test.ts`
   * walks every one of them.
   */
  test(
    "and the doors follow the clock she wound, not the one she started on",
    async () => {
      await play({ seams: "&learned=all&clockRung=0" }, async (game) => {
        const before = await game.seam<Hours>("openHours");

        await game.tap("spellbook");
        await game.tap(runeButton(Spell.Hourglass));
        await game.settle(600);
        // Most of a face, so the world lands somewhere other than where it
        // started whatever time it is when this runs.
        await game.swipeClock(84);
        const asked = await game.seam<{
          hours: number;
          minutes: number;
          asksMinutes: boolean;
        }>("clock");
        await game.type(asked.hours);
        await game.press("Enter");
        if (asked.asksMinutes) {
          await game.type(asked.minutes);
          await game.press("Enter");
        }
        await game.settle(4500);

        // It really moved, and the village is reading the clock she moved.
        const wound = await game.seam<{ hour: number; offset: number }>("worldClock");
        expect(wound.offset).toBeGreaterThan(0);
        const after = await game.seam<Hours>("openHours");
        expect({ hour: after.hour, open: after.open }).toEqual({
          hour: after.hour,
          open: after.hour >= OPENS_AT && after.hour < SHUTS_AT,
        });
        expect(after.hour).toBeCloseTo(wound.hour, 5);
        // And it is a different world from the one she opened on, which is
        // what stops this passing on a clock that never budged.
        expect(after.hour).not.toBeCloseTo(before.hour, 3);
      });
    },
    5 * MINUTES,
  );
});
