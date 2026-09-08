// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { afterAll, describe, expect, test } from "bun:test";
import { Job } from "../src/world/jobs";
import { type Game, play, shutDown } from "./harness";

const MINUTES = 60_000;

afterAll(shutDown);

/**
 * The mechanic, in the garage in the city.
 *
 * The seventh teacher, and the one whose spell is not arithmetic: talking
 * to her teaches the logic spell and opens its parchment, the way the
 * clockmaker's does. Three promises. The city has a garage and it can be
 * walked into. She is behind her bench in it, and the first tap on her is
 * the spell — the rune goes into the book and the parchment opens on a
 * tray. And the second tap is a job: the sheet on her bench, with the
 * first line she wants built on it.
 */

interface Logic {
  puzzle: string;
  done: boolean;
}

interface Jobs {
  next: string | null;
  progress: number;
  wanted: number;
  done: string[];
}

/** Into the garage, from the street outside its door. */
async function intoTheGarage(game: Game): Promise<string> {
  const doors = await game.seam<Record<string, { col: number; row: number }>>("doors");
  const garage = Object.keys(doors).find((id) => id.startsWith("city-garage"));
  if (!garage) throw new Error("this world's city has no garage");
  const door = doors[garage];
  if (!door) throw new Error("the garage has no door");
  // Opened again on its doorstep: the city is a long way from her garden,
  // and `standAt` moves the number, not the world.
  // The street is the row under the door: a city building stands at the
  // foot of its block with its door on the street, and the next row down
  // is somebody else's yard.
  await game.reload(`&hour=12&freezeNpcs&at=${door.col},${door.row + 1}`);
  await game.standAt(door.col, door.row + 1, "up");
  for (let go = 0; go < 3; go++) {
    await game.walk("ArrowUp", 700);
    await game.stopped();
    const inside = await game.seam<{ room: string } | null>("inside");
    if (inside?.room === "garage") return garage;
  }
  throw new Error("walking through the garage door did not go indoors");
}

describe("the mechanic", () => {
  test(
    "teaches the logic spell on the first tap, and hands out a job on the second",
    async () => {
      await play({ seams: "&hour=12&freezeNpcs" }, async (game) => {
        const garage = await intoTheGarage(game);
        expect(await game.seam<string[]>("spells")).not.toContain("logic");

        const npcs = await game.seam<Record<string, { col: number; row: number }>>("npcs");
        const her = npcs[`${garage}-mechanic`];
        if (!her) throw new Error("nobody is behind the bench");
        await game.tapCell(her.col, her.row);
        // The rune rises over her head first, and then the parchment.
        await game.settle(2200);
        expect(await game.seam<string[]>("spells")).toContain("logic");
        const opened = await game.seam<Logic | null>("logic");
        expect(opened?.puzzle).toBe("sort");
        expect(opened?.done).toBe(false);
        await game.solveLogic();
        expect(await game.seam<Logic | null>("logic")).toBe(null);

        // Taught already: what she has now is a job, and the first is the
        // funnel's.
        await game.tapCell(her.col, her.row);
        await game.settle(500);
        const jobs = await game.seam<Jobs>("jobs");
        expect(jobs.next).toBe(Job.Either);
        expect(jobs.progress).toBe(0);
        expect(jobs.wanted).toBe(2);
        expect(jobs.done).toEqual([]);
        await game.press("Escape");
        await game.settle(300);
      });
    },
    5 * MINUTES,
  );
});
