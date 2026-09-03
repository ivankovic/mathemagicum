// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { afterAll, describe, expect, test } from "bun:test";
import { type Game, play, shutDown } from "./harness";

const MINUTES = 60_000;

afterAll(shutDown);

/**
 * The gateway into the citadel, which is now three cells wide.
 *
 * *The city wall gates are way too small and hard to go through — three
 * characters, three tiles at least.* One cell is a target a child walking
 * along a wall has to hit exactly, and every miss looks the same as walking
 * into stone.
 *
 * `worldGenerator.test.ts` holds the shape of the thing — twelve gate cells,
 * three to a side, contiguous, in the middle of each run, with the ground
 * under them all cobble. What it cannot say is whether a *player* gets
 * through one, because walking is the scene's: a step is refused by the
 * grid, and a gate that generated correctly and blocked anyway would pass
 * every assertion in that file.
 *
 * So this walks her at the wall three times — through the middle of the
 * gateway and through both of its side arches — and once at the stone beside
 * it, which is the control. Without the last one the scenario passes on a
 * wall made entirely of gates.
 */
const CITY = "&hour=12&freezeNpcs&learned=all";

interface Ramparts {
  gates: { col: number; row: number }[];
  wall: number;
}

/** Stand her below a cell of the south wall and press north. */
async function walkAt(game: Game, at: { col: number; row: number }): Promise<boolean> {
  await game.reload(`${CITY}&at=${at.col},${at.row + 2}`);
  await game.settle(700);
  await game.walk("ArrowUp", 1400);
  await game.stopped();
  const where = await game.where();
  return where.row < at.row;
}

describe("the way into the citadel", () => {
  test(
    "she walks through any of the three arches, and not through the stone",
    async () => {
      await play({ seams: CITY }, async (game) => {
        const city = await game.seam<Ramparts>("city");
        expect(city.wall).toBeGreaterThan(0);
        expect(city.gates.length).toBe(12);

        // The south run, which is the one she can walk at from open ground:
        // every door in the city faces this way and so does the approach.
        const bottom = Math.max(...city.gates.map((gate) => gate.row));
        const south = city.gates
          .filter((gate) => gate.row === bottom)
          .sort((a, b) => a.col - b.col);
        expect(south.length).toBe(3);

        for (const arch of south) {
          expect({ at: `${arch.col},${arch.row}`, through: await walkAt(game, arch) }).toEqual({
            at: `${arch.col},${arch.row}`,
            through: true,
          });
        }

        // And the stone two cells to the left of the leftmost arch, which is
        // the same walk into a wall. A gateway proves nothing on its own —
        // this is what says the wall is still a wall.
        const first = south[0] as { col: number; row: number };
        const stone = { col: first.col - 2, row: first.row };
        expect({ at: `${stone.col},${stone.row}`, through: await walkAt(game, stone) }).toEqual({
          at: `${stone.col},${stone.row}`,
          through: false,
        });
      });
    },
    5 * MINUTES,
  );
});
