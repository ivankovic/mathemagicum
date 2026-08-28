// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { afterAll, describe, expect, test } from "bun:test";
import { STARGAZING_HOURS } from "../src/world/time";
import { type Game, play, shutDown } from "./harness";

const MINUTES = 60_000;

afterAll(shutDown);

/**
 * The one door in the world that is shut the other way round.
 *
 * An astronomer works when there is something to look at, so the dome keeps
 * the hours of the night sky while everything else keeps the village's. The
 * arithmetic of that is `time.test.ts`'s; what this proves is the *door* —
 * the hours are per-building now, and a rule that was right and wired to
 * nothing would pass every unit test there is.
 *
 * **Its own file, like the clockmaker's, and for the same reason.** The dome
 * is on a mountain four hundred tiles from home, so reaching it means
 * generating that end of the world and streaming into it — twice here, once
 * per hour. Run inside `curfew.e2e.ts` it made a file of quick village
 * scenarios into a slow one and starved the reloads after it.
 */
async function theDome(
  game: Game,
  hour: number,
): Promise<{ room: string | null; onTheDoorstep: boolean }> {
  const doors = await game.seam<Record<string, { col: number; row: number }>>("doors");
  const id = Object.keys(doors).find((name) => name.includes("observatory"));
  const door = id ? doors[id] : undefined;
  if (!door) throw new Error("no observatory in this world");

  const doorstep = { col: door.col, row: door.row + 1 };
  await game.reload(`&learned=all&hour=${hour}&at=${doorstep.col},${doorstep.row}`);
  // Held rather than tapped. A single `press` steps into the village's doors
  // and does not reliably step into this one — the climb is dirt on a
  // plateau and one keystroke's worth of movement lands short.
  await game.walk("ArrowUp", 700);
  await game.stopped();
  // The *room*, not the seam's `building`: that field is the house id and is
  // only ever set for somewhere a child lives, so it is null for the dome
  // whether she got in or not — which is a check that passes either way.
  const inside = await game.seam<{ room: string } | null>("inside");
  // `where()` rather than a seam: `tile` is a getter on the session's
  // prototype, and what crosses the wire from a seam is the fields without
  // the accessor.
  const tile = await game.where();
  return {
    room: inside?.room ?? null,
    onTheDoorstep: tile.col === doorstep.col && tile.row === doorstep.row,
  };
}

/**
 * One hour per scenario, and that is not tidiness either.
 *
 * Reaching the dome costs a reload four hundred tiles from home, and a
 * second one in the same page does not come back — the same wall
 * `clockmaker.e2e.ts` hit and gave a whole file to. `play` opens a browser
 * of its own each time, so an hour per test is an hour per page.
 */
describe("the observatory keeps the night's hours", () => {
  // Both halves, and the pairing is the point: one without the other would
  // pass on a door that was simply always shut, or always open.
  test(
    "shut in the afternoon, while the village is up",
    async () => {
      await play({ seams: "&learned=all&hour=12" }, async (game) => {
        // Both fields asserted, because "she is not in the dome" on its own
        // is also what a walk that never reached the door looks like. This
        // says she is standing on the doorstep having been refused.
        expect(await theDome(game, 12)).toEqual({ room: null, onTheDoorstep: true });
      });
    },
    5 * MINUTES,
  );

  test(
    "and open at an hour when every other door is locked",
    async () => {
      const midnight = 23;
      expect(midnight).toBeGreaterThanOrEqual(STARGAZING_HOURS.opensAt);
      await play({ seams: `&learned=all&hour=${midnight}` }, async (game) => {
        const inside = await theDome(game, midnight);
        // Off the doorstep and in a room, which together are "she went in".
        // The room's own name comes from the art's sidecar, so this asks
        // that there *is* one rather than spelling it.
        expect({ ...inside, room: inside.room !== null }).toEqual({
          room: true,
          onTheDoorstep: false,
        });
      });
    },
    5 * MINUTES,
  );
});
