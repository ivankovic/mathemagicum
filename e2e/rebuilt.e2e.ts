// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { afterAll, describe, expect, test } from "bun:test";
import { FixtureType } from "../src/world/fixtures";
import { type Game, play, shutDown, takeFromCrate } from "./harness";

const MINUTES = 60_000;

afterAll(shutDown);

/**
 * Coming back to a world the generator no longer builds the same way.
 *
 * A save is a seed and a handful of differences against what that seed grows,
 * and the generator is still being worked on — change a habitat rule and the
 * same seed grows a different coastline, at which point a fence saved on
 * grass is a fence in the sea.
 *
 * This used to be the end of a child's world: the whole snapshot was thrown
 * away when the versions disagreed, so every room, every machine and every
 * line went with the outdoor squares that were actually at risk. What only a
 * browser can say is that the rest of it comes back, that what cannot stand
 * is in her basket rather than gone, and that something on screen says so.
 *
 * The ground is moved from underneath rather than by editing the generator:
 * the seam paints water over the square her fence is on and marks the save
 * as written by a build that has since changed. That is exactly the state a
 * child arrives in after a release, without this file having to pin a
 * particular habitat rule that somebody may legitimately alter tomorrow.
 */
const AT_HOME = "&hour=12&freezeNpcs&learned=all&materials=99";

interface Cloud {
  icons: string[];
  crossed: boolean;
}

/** A square beside her that will take a fence. */
async function roomBeside(game: Game): Promise<{ col: number; row: number }> {
  const here = await game.where();
  const free = await game.tab.evaluate(
    ([c, r]) => {
      const handle = (globalThis as never as Record<string, Record<string, unknown>>)
        .__mathemagicum;
      if (!handle) throw new Error("the game has not put its handle out");
      const session = handle.session as {
        grid: {
          isPassable: (col: number, row: number) => boolean;
          getCrop: (col: number, row: number) => unknown;
          getObjectAt: (col: number, row: number) => unknown;
        };
      };
      const round: readonly (readonly [number, number])[] = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ];
      for (const [dc, dr] of round) {
        const col = (c as number) + dc;
        const row = (r as number) + dr;
        const clear =
          session.grid.isPassable(col, row) &&
          !session.grid.getCrop(col, row) &&
          !session.grid.getObjectAt(col, row);
        if (clear) return { col, row };
      }
      return null;
    },
    [here.col, here.row] as const,
  );
  if (!free) throw new Error("she is boxed in on all four sides");
  return free;
}

describe("coming back after the ground has moved", () => {
  test(
    "her things are in the basket, and the garden says so",
    async () => {
      await play({ seams: AT_HOME }, async (game) => {
        // A fence she owns, standing where she put it.
        const at = await roomBeside(game);
        await game.tab.evaluate((item) => {
          const handle = (globalThis as never as Record<string, Record<string, unknown>>)
            .__mathemagicum;
          if (!handle) throw new Error("the game has not put its handle out");
          (handle.session as { inventory: { add: (of: string, n: number) => void } }).inventory.add(
            item as string,
            1,
          );
        }, FixtureType.Fence);
        await game.settle(200);
        expect(await takeFromCrate(game, FixtureType.Fence)).toBe(true);
        await game.settle(300);
        await game.tapCell(at.col, at.row);
        await game.settle(600);
        expect(await game.held(FixtureType.Fence)).toBe(0);

        // Long enough for the autosave timer to come round: putting a fence
        // down does not write the world, the four-second tick does.
        await game.settle(5000);

        // Now the ground moves under it: her square becomes sea, and the
        // save is stamped as written by a build that has since changed.
        //
        // Stamped by an init script rather than by an ordinary evaluate,
        // because the running page is still autosaving on a four-second
        // timer — a version written into storage from the page itself is
        // written straight back out again by the next tick. This lands on
        // the reloaded page *before* the game has read anything.
        await game.tab.addInitScript(() => {
          const key = Object.keys(localStorage).find((one) => one.startsWith("mathemagicum.game."));
          if (!key) return;
          const saved = JSON.parse(localStorage.getItem(key) as string);
          if (!saved?.world) return;
          saved.world.generatorVersion += 1;
          localStorage.setItem(key, JSON.stringify(saved));
        });

        await game.reload(`${AT_HOME}&drown=${at.col},${at.row}`);
        await game.settle(1600);

        // The fence could not stand on water, so it is hers again.
        expect(await game.held(FixtureType.Fence)).toBe(1);

        // And something said so, without a word of it: a cloud over her head
        // with the thing that came back in it. Silent recovery and silent
        // loss look the same from where she is sitting.
        const cloud = await game.seam<Cloud | null>("thought");
        expect(cloud?.icons).toContain(`item-${FixtureType.Fence}`);
      });
    },
    5 * MINUTES,
  );
});
