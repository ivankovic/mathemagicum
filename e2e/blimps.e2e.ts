// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { afterAll, describe, expect, test } from "bun:test";
import { CITY_HOUSE_ID } from "../src/world/skyline";
import { type Game, play, shutDown } from "./harness";

const MINUTES = 60_000;

afterAll(shutDown);

/**
 * The airships over the city, and that each one is over a roof.
 *
 * `skyline.test.ts` proves which houses are picked and proves it in a
 * millisecond. What it cannot say is whether anything was drawn: a blimp is
 * a sprite hung off *another sprite's* rectangle, and every way that can go
 * wrong — an animation never registered, a pool built before the houses had
 * images, a sheet that did not load — produces exactly the same thing on
 * screen, which is a sky.
 *
 * A screenshot cannot settle it either, which is the unusual part. A sky is
 * the same colour as a sky whether the sprite is over the right house, over
 * the wrong one, or nowhere. So this asks the seam where they are and checks
 * that against where the houses are.
 */
const CITY = "&hour=12&learned=all&freezeNpcs";

interface Where {
  x: number;
  y: number;
}

/** How many houses this city has, which is what the count is measured against. */
async function cityHouses(game: Game): Promise<string[]> {
  const doors = await game.seam<Record<string, { col: number; row: number }>>("doors");
  return Object.keys(doors).filter((id) => id.startsWith(CITY_HOUSE_ID));
}

async function goToTheCity(game: Game): Promise<void> {
  const doors = await game.seam<Record<string, { col: number; row: number }>>("doors");
  const found = Object.entries(doors).find(([id]) => id.startsWith(CITY_HOUSE_ID));
  const door = found?.[1];
  if (!door) throw new Error("this world's city has no houses in it");
  await game.reload(`${CITY}&at=${door.col},${door.row + 3}`);
  await game.settle(1200);
}

describe("the airships over the city", () => {
  /**
   * That there are some, and that they are a few rather than a fleet.
   *
   * The count is asserted against the houses rather than written down: how
   * many townhouses a city has is world generation's business, and pinning a
   * number here would pin the city's size in a file that is not about it.
   */
  test(
    "hang over the city, one to every few houses",
    async () => {
      await play({ seams: CITY }, async (game) => {
        await goToTheCity(game);
        const blimps = await game.seam<Where[]>("blimps");
        const houses = await cityHouses(game);
        expect(houses.length).toBeGreaterThan(0);
        expect(blimps.length).toBeGreaterThan(0);
        // A few, not one each: the whole difference between a sky with
        // airships in it and a traffic jam.
        expect(blimps.length).toBeLessThan(houses.length);
      });
    },
    5 * MINUTES,
  );

  /**
   * And every one is *above* something, which is the failure that looks like
   * success.
   *
   * A sprite whose position was never set sits at the world's origin, which
   * is the top-left corner of the map — off in the far north-west, where
   * nothing is and nobody goes. It would draw perfectly, animate perfectly,
   * and be invisible for the whole of a game. Asserted as a distance from
   * that corner rather than as a coordinate, because where a city lands is
   * the seed's business.
   */
  test(
    "and none of them is parked at the origin",
    async () => {
      await play({ seams: CITY }, async (game) => {
        await goToTheCity(game);
        const blimps = await game.seam<Where[]>("blimps");
        expect(blimps.length).toBeGreaterThan(0);
        for (const at of blimps) {
          expect(at.x + at.y).toBeGreaterThan(500);
        }
        // And they are spread out: two airships at the same point is one
        // pool built twice, or every sprite hung off the same house.
        const spots = new Set(blimps.map((at) => `${Math.round(at.x)},${Math.round(at.y)}`));
        expect(spots.size).toBe(blimps.length);
      });
    },
    5 * MINUTES,
  );
});
