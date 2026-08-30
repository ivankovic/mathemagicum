// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { afterAll, describe, expect, test } from "bun:test";
import { CRATE_GROUPS, CRATE_WIRE, thingsIn } from "../src/world/crate";
import { DECOR_TYPES } from "../src/world/decor";
import { FixtureType, PLACEABLE_FIXTURES } from "../src/world/fixtures";
import { type Game, play, shutDown, takeFromCrate } from "./harness";

const MINUTES = 60_000;

afterAll(shutDown);

/**
 * The crate in two levels, which is what stops twenty things being a wall.
 *
 * A playtest called the one-level crate clunky. It held twenty buttons and a
 * child looking for a chair had to read past a scarecrow, so it offers three
 * groups and then one group's things.
 *
 * **Its own file, and that is not tidiness.** It began as an eleventh
 * scenario in `house.e2e.ts`, where it timed out at five minutes while
 * passing in twenty seconds on its own — `harness.ts` says why in as many
 * words: *a dozen scenarios in one process is near the edge on four busy
 * cores*. Ten was under it and eleven was not.
 *
 * The failure worth guarding is not the happy path. It is a thing that ends
 * up in *no* group — invisible, unreachable, leaving nothing on screen to
 * notice — and a group that cannot be stepped back out of, which would trap
 * a child who opened the wrong one. `crate.test.ts` proves the first against
 * the lists; this proves both against the buttons that exist.
 */
/** What is standing on a square, by the world's own name for it. */
function objectOn(game: Game, col: number, row: number): Promise<string | null> {
  return game.tab.evaluate(
    ([c, r]) => {
      const handle = (globalThis as never as Record<string, Record<string, unknown>>)
        .__mathemagicum;
      if (!handle) throw new Error("the game has not put its handle out");
      const session = handle.session as {
        grid: { getObjectAt: (col: number, row: number) => { type: string } | null };
      };
      return session.grid.getObjectAt(c as number, r as number)?.type ?? null;
    },
    [col, row] as const,
  );
}

/** Whether a square will take something put down on it. */
function willTake(game: Game, col: number, row: number): Promise<boolean> {
  return game.tab.evaluate(
    ([c, r]) => {
      const handle = (globalThis as never as Record<string, Record<string, unknown>>)
        .__mathemagicum;
      if (!handle) throw new Error("the game has not put its handle out");
      const session = handle.session as {
        grid: {
          isPassable: (col: number, row: number) => boolean;
          getCrop: (col: number, row: number) => unknown;
        };
      };
      const col2 = c as number;
      const row2 = r as number;
      return session.grid.isPassable(col2, row2) && !session.grid.getCrop(col2, row2);
    },
    [col, row] as const,
  );
}

/**
 * A square next to her that will take a fence, and the way to look at it.
 *
 * Empty of *everything*, not merely of objects. She starts in the middle of
 * her own garden beds, so the square beside her is as likely to have a
 * carrot in it as anything, and `place` refuses a planted square exactly as
 * it refuses an occupied one.
 */
async function freeSquareBeside(
  game: Game,
  here: { col: number; row: number },
): Promise<{ col: number; row: number; facing: "left" | "right" | "up" | "down" }> {
  const ways = [
    { col: 1, row: 0, facing: "right" },
    { col: -1, row: 0, facing: "left" },
    { col: 0, row: 1, facing: "down" },
    { col: 0, row: -1, facing: "up" },
  ] as const;
  for (const way of ways) {
    const at = { col: here.col + way.col, row: here.row + way.row };
    if (await willTake(game, at.col, at.row)) return { ...at, facing: way.facing };
  }
  throw new Error("she is boxed in on all four sides");
}

describe("the crate's two levels", () => {
  test(
    "offers groups, then one group's things, and steps back out",
    async () => {
      await play({ seams: "&hour=12&materials=40&freezeNpcs" }, async (game) => {
        const named = async (): Promise<string[]> =>
          Object.keys(await game.ui())
            .filter((name) => name.startsWith("crate."))
            .map((name) => name.slice("crate.".length));

        await game.tap("crate");
        await game.settle(250);
        expect((await named()).sort()).toEqual([...CRATE_GROUPS].sort());

        // Every group opens onto something, and onto its own things only.
        const seen: string[] = [];
        for (const group of CRATE_GROUPS) {
          expect(await game.tap(`crate.${group}`)).toBe(true);
          await game.settle(250);
          const things = await named();
          expect({ group, any: things.length > 0 }).toEqual({ group, any: true });
          expect([...things].sort()).toEqual([...thingsIn(group)].sort());
          seen.push(...things);

          // Its own button steps back out rather than shutting the crate.
          expect(await game.tap("crate")).toBe(true);
          await game.settle(250);
          expect((await named()).sort()).toEqual([...CRATE_GROUPS].sort());
        }

        // And between them the groups hold everything, so nothing is lost
        // behind a level it is not in.
        // The coil is in here too, and it is the one entry that is not a
        // thing a child owns: a wire is a line between two machines rather
        // than an object, so what the crate holds is the gesture.
        expect(seen.sort()).toEqual([...PLACEABLE_FIXTURES, ...DECOR_TYPES, CRATE_WIRE].sort());
      });
    },
    5 * MINUTES,
  );

  /**
   * And a thing she put down yesterday is still hers today.
   *
   * The gap this is here for had nothing to do with the crate and
   * everything to do with what happens after it: a fixture was only ever
   * made tappable at the moment of placing, so a fence put down and then
   * slept on came back through the ordinary spawner with no handler on it
   * and stood in the garden for good. Nothing said so — it was drawn, it was
   * solid, it was in the save — and there was no coverage of picking a
   * fixture back up outdoors at all, which is how it survived.
   *
   * The village's own fences must stay put through the same code, which is
   * the other half and the reason the answer is a field on the object rather
   * than a guess about it. See `PlacedObject.mine`.
   */
  test(
    "and a fence put down yesterday can still be picked up today",
    async () => {
      const seams = "&hour=12&materials=40&freezeNpcs&learned=all";
      await play({ seams }, async (game) => {
        // A free square beside her, and her facing turned to it: a fixture
        // goes down on the square she is *looking at* rather than the one
        // that was tapped — see `session.place` — and her own garden has
        // beds and flowers in it, so which square is free is not something
        // to guess at from here.
        const here = await game.where();
        const at = await freeSquareBeside(game, here);
        await game.standAt(here.col, here.row, at.facing);

        // Two fences into the basket. `&materials=` pays wood and stone,
        // which is what a machine is built from and not what the crate holds
        // — and `takeFromCrate` answers for the *tap* rather than for what
        // came of it, so a crate she owns nothing in still says yes.
        await game.tab.evaluate((item) => {
          const handle = (globalThis as never as Record<string, Record<string, unknown>>)
            .__mathemagicum;
          if (!handle) throw new Error("the game has not put its handle out");
          (handle.session as { inventory: { add: (of: string, n: number) => void } }).inventory.add(
            item as string,
            2,
          );
        }, FixtureType.Fence);
        await game.settle(200);

        expect(await takeFromCrate(game, FixtureType.Fence)).toBe(true);
        await game.settle(300);
        await game.tapCell(at.col, at.row);
        await game.settle(600);
        const had = await game.held(FixtureType.Fence);
        // Down before anything else is asked, so a failure below is about
        // the reload rather than about the placing.
        expect(await objectOn(game, at.col, at.row)).toBe(FixtureType.Fence);

        await game.reload(seams);
        await game.settle(800);

        // Standing where she left it, and still hers: one tap and it is back
        // in the basket. Before this it was scenery she happened to own.
        expect(await objectOn(game, at.col, at.row)).toBe(FixtureType.Fence);

        await game.tapCell(at.col, at.row);
        await game.settle(600);
        expect(await game.held(FixtureType.Fence)).toBe(had + 1);
      });
    },
    5 * MINUTES,
  );
});
