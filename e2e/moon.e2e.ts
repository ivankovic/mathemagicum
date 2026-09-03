// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { afterAll, describe, expect, test } from "bun:test";
import { SHUTS_AT } from "../src/world/time";
import { type Game, play, shutDown } from "./harness";

const MINUTES = 60_000;

afterAll(shutDown);

/**
 * The moon that comes up when a door will not open.
 *
 * **A file of its own, and it was not.** It lived in `curfew.e2e.ts`, which
 * is where the shut door comes from — but what it is *about* is the refusal
 * mark, and that is the seam. The move is not tidiness: that file walks her
 * at six doors, every one of them a page reload, and a reload re-boots the
 * whole game. Adding this took it over the budget one browser has, and it
 * failed the way `tower.e2e.ts` and `hudclock.e2e.ts` describe — the
 * *fourth* scenario sat through its five-minute timeout, on a run where this
 * one had just started passing. The failure lands on whoever is unlucky, not
 * on whoever caused it.
 */

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

describe("leaning on a shut door", () => {
  /**
   * And the moon comes up once, however long she leans on the door.
   *
   * Reported from a playtest: *trying to enter the tower during daytime
   * brings up the moon many times*. Walking at a door is a held key rather
   * than one press — `tryMove` runs again for every step she tries to take
   * — and each of those put another moon over her head. Half a dozen of
   * them rising in a column reads as a fault in the game rather than as the
   * reason the door will not open.
   *
   * Counted off the layer while they are still on screen, because a mark
   * lives less than a second and a half: let go and wait for her to settle
   * and the one that should be there has faded, so a count taken afterwards
   * reads nothing whether the game is right or wrong.
   *
   * **Watched rather than sampled once.** It held the key for nine tenths of
   * a second and read exactly then, which assumes the walk started at all —
   * and a reload is not one load. The page boots, reads what was saved and
   * boots again, and a key sent into the gap between the two goes nowhere.
   * On a loaded machine that came back as nought moons, which is the same
   * reading as a game that had stopped drawing them. So the key is held and
   * the sky watched until something rises, and then watched a while longer:
   * the *most* seen at any one instant is the number that matters, and a
   * stack builds over the second after the first one appears.
   */
  test(
    "and the moon comes up once, however long she leans on a shut door",
    async () => {
      const hour = SHUTS_AT + 1;
      // **`freezeNpcs`, and it is the whole difference between this passing
      // and not.** The postman walks the welcome over on a child's first
      // minute and is deliberately not gated on the hour, so he sets off
      // even at ten at night; the parchment he opens is modal, and `update`
      // returns before it reads a key while one is up. She stands at the
      // door pressing north and the game never hears it — no step, no
      // refusal, no moon, which reads exactly like a game that had stopped
      // drawing them.
      //
      // This scenario used to beat him by accident: it held the key for nine
      // tenths of a second and read once. Making it *wait longer* to stop it
      // flaking is what let him arrive, so the more patient version failed
      // every time while the impatient one passed most of the time.
      await play({ seams: `&learned=all&freezeNpcs&hour=${hour}` }, async (game) => {
        const door = await doorOf(game, "school");
        const step = { col: door.col, row: door.row + 1 };
        await game.reload(`&learned=all&freezeNpcs&hour=${hour}&at=${step.col},${step.row}`);
        await game.settle(900);
        // Standing where she was put, said as its own assertion. Everything
        // below reads nought moons when she is anywhere else, and nought is
        // also what a game that had stopped drawing them would read — so
        // without this the two are one failure with two causes.
        expect(await game.where()).toEqual(step);

        let marks = 0;
        const look = async () => {
          await game.settle(250);
          marks = Math.max(marks, await game.seam<number>("floatingMarks"));
        };
        /**
         * Hold the key and watch the sky, and be willing to try again.
         *
         * A press sent at a page that has just reloaded can land before the
         * scene is listening — the reason `tryTheDoor` holds its key rather
         * than tapping it, and the reason `goHome` walks three times. Held
         * once and watched for four seconds, this still came back empty
         * about one run in three.
         */
        for (let go = 0; go < 3 && marks === 0; go++) {
          await game.tab.keyboard.down("ArrowUp");
          for (let again = 0; again < 12 && marks === 0; again++) await look();
          if (marks === 0) {
            await game.tab.keyboard.up("ArrowUp");
            await game.settle(400);
          }
        }
        // And a second longer with the key still down, which is where a
        // stack would show: the old bug put one up per step, and a step is
        // about a fifth of a second.
        for (let again = 0; again < 5; again++) await look();
        await game.tab.keyboard.up("ArrowUp");
        await game.stopped();

        // She is still outside — this is a shut door — and one moon says so,
        // never two at once. Eight of them was the reading before this was
        // fixed; nought would mean she never reached the door at all.
        expect({ marks, inside: await game.seam<Inside | null>("inside") }).toEqual({
          marks: 1,
          inside: null,
        });
      });
    },
    5 * MINUTES,
  );
});
