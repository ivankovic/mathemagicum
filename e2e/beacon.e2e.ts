// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { afterAll, describe, expect, test } from "bun:test";
import { type Game, play, shutDown } from "./harness";

const MINUTES = 60_000;

afterAll(shutDown);

/**
 * Standing behind the tallest thing in the world.
 *
 * A playtest reported this as a big bug and reported it as the wrong thing:
 * *I got stuck behind the lighthouse. I wandered in and stopped moving.* She
 * was moving the whole time. The beacon's art is seven and a half tiles tall
 * over the two cells it stands on, so six cells of quay behind it are
 * painted over — a child walked in there, pressed a key, and watched a
 * picture of a tower not change.
 *
 * Two things came out of that and both are here, because either one alone
 * leaves the report true. The tower has to **get out of the way**, and it
 * has to **stop swallowing taps**: a game object under the pointer stops the
 * click reaching the ground, so every attempt to walk out landed on the
 * beacon and was answered with a red cross. That is the other half of the
 * same sentence — *you need to tap way outside of the lighthouse*.
 */
const QUAY = "&hour=12&freezeNpcs";

interface Point {
  col: number;
  row: number;
}

interface Tall {
  id: string;
  col: number;
  row: number;
  alpha: number;
}

/** The beacon, as the scene has it. */
async function beacon(game: Game): Promise<Tall> {
  const tall = await game.seam<Tall[]>("hiding");
  const it = tall.find(({ id }) => id === "harbour-lighthouse");
  if (!it) throw new Error("this world's harbour has no beacon on its headland");
  return it;
}

/** How faint it is now. */
async function fadedTo(game: Game, id: string): Promise<number> {
  const tall = await game.seam<Tall[]>("hiding");
  return tall.find((thing) => thing.id === id)?.alpha ?? 1;
}

describe("the beacon on the headland", () => {
  /**
   * It gives way when she is under it, and closes again when she is not.
   *
   * Both halves, because a tower that faded and stayed faded would pass the
   * first and be a worse picture than the bug: the point is that the world
   * is solid and gets out of the way, not that it is made of glass.
   *
   * She is put *behind* it — one row above the anchor, which is inside the
   * six tiles of art rising off it — rather than walked there, because the
   * headland is four hundred tiles from home and how she arrives is not what
   * this is about.
   */
  test(
    "gets out of the way of somebody standing behind it",
    async () => {
      await play({ seams: QUAY }, async (game) => {
        const it = await beacon(game);

        await game.reload(`${QUAY}&at=${it.col},${it.row - 1}`);
        await game.settle(900);
        expect(await fadedTo(game, it.id)).toBeLessThan(0.6);

        // And three rows below its feet, where nothing covers her, it is
        // whole again.
        await game.reload(`${QUAY}&at=${it.col},${it.row + 4}`);
        await game.settle(900);
        expect(await fadedTo(game, it.id)).toBe(1);
      });
    },
    5 * MINUTES,
  );

  /**
   * And a click on it reaches the ground, instead of being eaten.
   *
   * The other half of the report — *you need to tap way outside of the
   * lighthouse* — and the half that made being invisible unrecoverable: a
   * game object under the pointer stops the click ever reaching the world,
   * so the six cells of quay under the tower's art answered nothing at all.
   *
   * What is asserted is the *aim*, not a walk. She is standing right beside
   * the square she clicks, and a click inside her own reach points at a
   * square rather than walking to it — which is exactly the answer wanted
   * here, because pointing is the thing that proves the tap arrived. The
   * square is her own row beside the beacon's foot, chosen so it is quay
   * rather than sea on every seed and squarely under the tower's old hit
   * area.
   */
  test(
    "and a click through it is a click on the ground behind it",
    async () => {
      await play({ seams: QUAY }, async (game) => {
        const it = await beacon(game);
        const from = { col: it.col, row: it.row - 1 };
        await game.reload(`${QUAY}&at=${from.col},${from.row}`);
        await game.settle(900);
        expect(await game.seam<Point | null>("aimed")).toBe(null);

        // One row up from her, inside the art and outside the footprint.
        const at = { col: it.col, row: it.row - 2 };
        await game.tapCell(at.col, at.row);
        await game.settle(700);
        expect(await game.seam<Point | null>("aimed")).toEqual(at);
      });
    },
    5 * MINUTES,
  );
});
