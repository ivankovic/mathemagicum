// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { afterAll, describe, expect, test } from "bun:test";
import { DecorType } from "../src/world/decor";
import { type Game, play, shutDown, takeFromCrate } from "./harness";

const MINUTES = 60_000;

afterAll(shutDown);

/**
 * Every stove in a room burns, not just the last one put down.
 *
 * Reported from a playtest: *only one stove per house lights up, they should
 * all glow.* Only one could. The scene held a single cell and a single halo,
 * and the routine that lit a stove put the previous one out on its way in —
 * so a room with three stoves drew three stoves and one fire.
 *
 * **A picture cannot settle this**, which is why it went unnoticed. A glow
 * is an additive sprite over the night tint: a room with three fires and a
 * room with one look like a warm room either way, and the difference is a
 * gradient nobody can measure by eye. So it asks the seam — which had to be
 * widened from one fire to a list, because *that* was the shape of the bug.
 *
 * Its own file rather than an eleventh scenario in `house.e2e.ts`: the
 * harness warns that a dozen scenarios in one process is near the edge on
 * four busy cores, and the crate scenario has already been moved out for it.
 */
const AT_NIGHT = "&hour=22&brickRung=1&furniture=3";

interface Fire {
  col: number;
  row: number;
  alpha: number;
}

/** Indoors, at her own front door. */
async function goHome(game: Game): Promise<void> {
  const doors = await game.seam<Record<string, { col: number; row: number }>>("doors");
  const door = doors["player-house"];
  if (!door) throw new Error("this village has no house for the player");
  await game.standAt(door.col, door.row + 2, "up");
  await game.walk("ArrowUp", 900);
  await game.stopped();
}

describe("the fires in a room", () => {
  test(
    "every stove she puts down burns, not only the last",
    async () => {
      await play({ seams: AT_NIGHT }, async (game) => {
        await goHome(game);

        // The one the room ships with, alight because it is night.
        const first = await game.seam<Fire[]>("hearths");
        expect(first).toHaveLength(1);
        expect(first[0]?.alpha).toBeGreaterThan(0);

        // Two more out of the crate, put down where there is floor.
        //
        // Three taps each, not two: a piece of furniture asks which colour
        // before it is armed, which is a menu of its own and not something
        // `takeFromCrate` should know about.
        const before = await game.where();
        for (const [at, step] of [1, 2].entries()) {
          expect(await takeFromCrate(game, DecorType.Stove)).toBe(true);
          await game.settle(250);
          expect(await game.tap("colour.0")).toBe(true);
          await game.settle(250);
          expect(await game.seam<string | null>("armed")).toBe("stove~0");
          await game.tapCell(before.col + step, before.row + at);
          await game.settle(500);
        }

        // Three stoves, three fires. This is the assertion the bug failed:
        // it stayed at one however many were standing.
        // One fire per stove standing, whatever that number turns out to be.
        //
        // Counted against the room rather than against a number written here
        // — where a tapped square is free floor depends on the cottage's own
        // furniture, and a scenario that insisted on three would be testing
        // the floor plan. What matters is that the two counts agree: before
        // this fix the fires stayed at one however many stoves were down.
        const stoves = (await game.seam<{ piece: string }[]>("decor")).filter(
          (one) => one.piece === "stove",
        );
        expect(stoves.length).toBeGreaterThan(1);
        const all = await game.seam<Fire[]>("hearths");
        expect(all).toHaveLength(stoves.length);
        for (const fire of all) expect(fire.alpha).toBeGreaterThan(0);
        // And each over its own square, so they are several fires rather
        // than one drawn several times.
        expect(new Set(all.map((f) => `${f.col},${f.row}`)).size).toBe(all.length);
      });
    },
    5 * MINUTES,
  );
});
