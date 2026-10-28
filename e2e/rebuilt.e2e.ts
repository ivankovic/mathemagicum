// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { afterAll, describe, expect, test } from "bun:test";
import { FixtureType } from "../src/world/fixtures";
import { retiredRecipe } from "../src/world/machines";
import { type Game, type Handles, play, shutDown, takeFromCrate } from "./harness";

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
      const handle = (globalThis as never as Handles).__mathemagicum;
      if (!handle) throw new Error("the game has not put its handle out");
      const session = handle.session;
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
        await game.give(FixtureType.Fence, 1);
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

  /**
   * And a machine the game no longer has comes back as what it was made of.
   *
   * The sorter was taken out after children had built them. Read back, its
   * type is a name this build has never heard of, and the guard on the way
   * in drops a name like that — which would have taken the fifteen wood and
   * six stone it cost with it, and the heap she had tipped into it.
   *
   * There is no sorter to build any more, so one is made the way a save from
   * before would have one: a hothouse put down, fed, written to storage, and
   * then renamed in the file before the game reads it back.
   */
  test(
    "a machine taken out of the game is paid back in wood and stone",
    async () => {
      await play({ seams: AT_HOME }, async (game) => {
        expect(await takeFromCrate(game, FixtureType.Hothouse)).toBe(true);
        await game.settle(300);
        const at = await roomBeside(game);
        await game.tapCell(at.col, at.row);
        await game.settle(500);
        await game.tapCell(at.col, at.row);
        await game.settle(400);
        await game.solveArray();
        await game.settle(400);
        await game.give("carrot", 7);
        await game.settle(200);
        await game.feed(at);
        expect(await game.held("carrot")).toBe(0);

        const wood = await game.held("wood");
        const stone = await game.held("stone");
        await game.settle(5000);

        // Renamed before the game has read anything, for the reason the
        // test above stamps its version this way: the page is still saving.
        await game.tab.addInitScript(
          ([col, row]) => {
            const key = Object.keys(localStorage).find((one) =>
              one.startsWith("mathemagicum.game."),
            );
            if (!key) return;
            const saved = JSON.parse(localStorage.getItem(key) as string);
            for (const object of saved?.world?.world?.placed ?? []) {
              if (object.col === col && object.row === row && object.type === "hothouse") {
                object.type = "sorter";
                object.id = `sorter-${col}-${row}`;
              }
            }
            localStorage.setItem(key, JSON.stringify(saved));
          },
          [at.col, at.row] as const,
        );
        // Without `materials`, which hands out more on every load and would
        // make the payback impossible to count.
        await game.reload("&hour=12&freezeNpcs&learned=all");
        await game.settle(1600);

        // Nothing standing, nothing remembered as a machine, and everything
        // it cost and held back in her basket.
        const cost = new Map(retiredRecipe("sorter"));
        expect({
          standing: await game.objectOn(at.col, at.row),
          machines: await game.seam<unknown[]>("machines"),
          wood: await game.held("wood"),
          stone: await game.held("stone"),
          carrots: await game.held("carrot"),
        }).toEqual({
          standing: null,
          machines: [],
          wood: wood + (cost.get("wood") ?? 0),
          stone: stone + (cost.get("stone") ?? 0),
          carrots: 7,
        });

        // And the cloud says what came back: the wood and the stone, which
        // is the only picture of a sorter there still is.
        const cloud = await game.seam<Cloud | null>("thought");
        expect(cloud?.icons).toEqual(expect.arrayContaining(["material-wood", "material-stone"]));
      });
    },
    5 * MINUTES,
  );
});
