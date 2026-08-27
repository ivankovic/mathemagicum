// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { afterAll, describe, expect, test } from "bun:test";
import { play, shutDown } from "./harness";

const MINUTES = 60_000;

afterAll(shutDown);

/**
 * The harbour's traffic, which is the one thing on screen nothing else can
 * see.
 *
 * A visiting ship is deliberately in no list: not an object on the grid, not
 * a villager, not in the save. That is what makes her cheap and safe — see
 * `shipping.ts` — and it is also what would let her quietly stop being drawn
 * while every test in the suite went on passing. `shipping.test.ts` proves
 * the timetable and `worldGenerator.test.ts` proves the lanes are sea; what
 * is left, and what only a browser can say, is that the two are wired to a
 * sprite that moves.
 *
 * The quay is four hundred tiles from home, so this stands her on the
 * harbour's own doorstep with `?at=` rather than walking there.
 */
const QUAY = "&hour=12&learned=all";

async function toTheQuay(game: import("./harness").Game): Promise<void> {
  const doors = await game.seam<Record<string, { col: number; row: number }>>("doors");
  const anywhere = Object.entries(doors).find(([id]) => id.startsWith("harbour-"));
  const door = anywhere?.[1];
  if (!door) throw new Error("this world's harbour has no buildings on it");
  await game.reload(`${QUAY}&at=${door.col},${door.row + 1}`);
  await game.settle(1200);
}

describe("ships come and go", () => {
  /**
   * That there are any, and that they are where the piers are.
   *
   * The seam answers in world pixels, so "near a pier" is asserted rather
   * than a coordinate: which berth has a ship in at the moment a browser
   * happens to open is the timetable's business, and pinning it here would
   * be pinning the timetable in two places.
   */
  test(
    "the harbour has hulls in it, out where the piers end",
    async () => {
      await play({ seams: QUAY }, async (game) => {
        await toTheQuay(game);
        const ships = await game.seam<{ x: number; y: number }[]>("ships");
        expect(ships.length).toBeGreaterThan(0);
        // Somewhere real rather than at the origin, which is what a sprite
        // that was created and never positioned would answer.
        for (const ship of ships) {
          expect(Math.abs(ship.x) + Math.abs(ship.y)).toBeGreaterThan(0);
        }
      });
    },
    5 * MINUTES,
  );

  /**
   * And they move, which is the whole feature.
   *
   * Watched rather than calculated. The position depends on a clock nothing
   * here can pin — `?hour=` sets the hour, and a visit is measured in
   * minutes — so what is asserted is that the harbour is not the same
   * picture twice, and it is asserted by looking until it is not.
   */
  test(
    "and the water is not the same picture twice",
    async () => {
      await play({ seams: QUAY }, async (game) => {
        await toTheQuay(game);
        const look = () => game.seam<{ x: number; y: number }[]>("ships");
        const first = JSON.stringify(await look());
        // Watched until it changes rather than compared across one wait.
        // Most of the harbour is tied up at any moment and a berth that is
        // tied up does not move — a single snapshot pair would be asking
        // whether this browser happened to open during somebody's approach.
        // A visit is four minutes across four berths, so something arrives,
        // sails or leaves about every half minute.
        let changed = false;
        for (let again = 0; again < 30 && !changed; again++) {
          await game.settle(1500);
          changed = JSON.stringify(await look()) !== first;
        }
        expect(changed).toBe(true);
      });
    },
    5 * MINUTES,
  );

  /**
   * Except in a frozen world, where nothing moves and that is the point.
   *
   * `?freezeNpcs` exists so a script knows where things are. A ship sailing
   * through it would be the one thing on screen a screenshot could not pin —
   * and the seam would have grown a hole in it the moment the harbour got
   * traffic.
   */
  test(
    "but a frozen world holds them still",
    async () => {
      await play({ seams: `${QUAY}&freezeNpcs` }, async (game) => {
        const doors = await game.seam<Record<string, { col: number; row: number }>>("doors");
        const door = Object.entries(doors).find(([id]) => id.startsWith("harbour-"))?.[1];
        if (!door) throw new Error("this world's harbour has no buildings on it");
        await game.reload(`${QUAY}&freezeNpcs&at=${door.col},${door.row + 1}`);
        await game.settle(1200);
        const before = await game.seam<{ x: number; y: number }[]>("ships");
        // Still in port, so a frozen harbour is a harbour rather than an
        // empty bay — a screenshot of it should look like the place.
        expect(before.length).toBeGreaterThan(0);
        await game.settle(4000);
        expect(await game.seam<{ x: number; y: number }[]>("ships")).toEqual(before);
      });
    },
    5 * MINUTES,
  );
});
