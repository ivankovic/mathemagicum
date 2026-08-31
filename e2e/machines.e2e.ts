// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { afterAll, describe, expect, test } from "bun:test";
import { Spell } from "../src/spells/spellbook";
import { FixtureType } from "../src/world/fixtures";
import { MachineType, recipeFor } from "../src/world/machines";
import { PatchAction } from "../src/world/selection";
import { type Game, patchButton, play, runeButton, shutDown, takeFromCrate } from "./harness";

const MINUTES = 60_000;

afterAll(shutDown);

/**
 * Building the first machine, and finding it there tomorrow.
 *
 * `machines.test.ts` proves the recipe in a tenth of a second, and every
 * assertion in it is a function call. What a child does is open a crate, tap
 * a picture of a machine they do not own, and have one — and the whole of
 * that route is in the scene: the crate builds its slots from
 * `PLACEABLE_FIXTURES`, `armFixture` reaches for `build`, and the placement
 * and the save were written for things that came off a shelf.
 *
 * The route is also the part with the interesting failure in it. A machine
 * is the first placeable thing nobody sells, and `SHOP_STOCK` was
 * `PLACEABLE_FIXTURES` itself — so the first version of this put a sorter on
 * the village shelf at a price of infinity. The unit tests say that cannot
 * happen again; these say a child can actually get one.
 */

/*
 * The sorter is behind the crate's "makers" group now — `takeFromCrate`
 * opens it and taps the machine, which is the two taps a child makes.
 */

/**
 * Noon so nothing is dark, the village still so nobody walks through the
 * square being tapped, and a basket with enough in it to build one machine
 * and not two.
 *
 * Twenty of each is deliberate rather than generous: the sorter wants
 * fifteen wood and six stone, so a build leaves five and fourteen — two
 * different numbers, neither of them nought, which is the only way this
 * scenario can tell "spent the recipe" from "emptied the basket".
 */
const WITH_TIMBER = "&materials=20&hour=12&freezeNpcs";

/** What the recipe asks for, read from the recipe rather than written down. */
const COST = new Map(recipeFor(MachineType.Sorter));

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

/**
 * Three empty squares in a row, near enough to put machines on.
 *
 * A row rather than any three, because the point is a rectangle: the times
 * spell is cast on a block of ground, and three in a line is the smallest
 * block that is obviously more than one square.
 */
async function threeInARow(game: Game): Promise<{ col: number; row: number }[]> {
  const here = await game.where();
  for (const row of [here.row + 1, here.row - 1, here.row]) {
    const cells = [
      { col: here.col - 1, row },
      { col: here.col, row },
      { col: here.col + 1, row },
    ].filter((at) => at.col !== here.col || at.row !== here.row);
    if (cells.length < 3) continue;
    const free = await Promise.all(cells.map((at) => objectOn(game, at.col, at.row)));
    if (free.every((standing) => standing === null)) return cells;
  }
  throw new Error("there is no clear row of three squares beside her");
}

/** An empty square next to her, to put things down on. */
async function squareBeside(game: Game): Promise<{ col: number; row: number }> {
  const here = await game.where();
  for (const step of [
    { col: 1, row: 0 },
    { col: -1, row: 0 },
    { col: 0, row: 1 },
    { col: 0, row: -1 },
  ]) {
    const at = { col: here.col + step.col, row: here.row + step.row };
    if ((await objectOn(game, at.col, at.row)) === null) return at;
  }
  throw new Error("she is boxed in on all four sides");
}

describe("building a machine", () => {
  /**
   * The whole route, and the reload is the half that catches anything.
   *
   * A machine placed and standing is a machine the scene drew; a machine
   * still standing after the world has been written down and read back is
   * one the *save* understood. Placed objects are stored as a difference
   * against what the generator would have made, and a fixture type the
   * baseline has never heard of is exactly the shape of thing that can go
   * into that diff and not come out.
   */
  test(
    "costs what the world gave up, and is still standing tomorrow",
    async () => {
      await play({ seams: WITH_TIMBER }, async (game) => {
        const wood = await game.held("wood");
        const stone = await game.held("stone");
        expect(wood).toBeGreaterThanOrEqual(COST.get("wood") ?? 0);
        expect(await game.held(FixtureType.Sorter)).toBe(0);

        // The slot is in the crate before she owns one — the spellbook's
        // dimmed rune, one tray along — and tapping it is what builds it.
        expect(await takeFromCrate(game, FixtureType.Sorter)).toBe(true);
        await game.settle(400);

        // One machine in hand, and the timber gone out of the basket.
        expect(await game.held(FixtureType.Sorter)).toBe(1);
        expect(await game.held("wood")).toBe(wood - (COST.get("wood") ?? 0));
        expect(await game.held("stone")).toBe(stone - (COST.get("stone") ?? 0));
        // Lit and waiting for a square, exactly as a bought fence is.
        expect(await game.seam<string | null>("armed")).toContain(FixtureType.Sorter);

        const at = await squareBeside(game);
        await game.tapCell(at.col, at.row);
        await game.settle(500);
        expect(await objectOn(game, at.col, at.row)).toBe(FixtureType.Sorter);
        expect(await game.held(FixtureType.Sorter)).toBe(0);

        await game.reload(WITH_TIMBER);
        await game.settle(600);
        expect(await objectOn(game, at.col, at.row)).toBe(FixtureType.Sorter);
      });
    },
    5 * MINUTES,
  );

  /**
   * And a build she cannot pay for takes nothing.
   *
   * The failure this is here for is not "she gets a free machine" — it is
   * the quiet one, where the wood is spent and the stone is short and the
   * timber is simply gone. `Inventory.remove` is all-or-nothing per item and
   * not across a recipe, so that bug is one refactor away at all times.
   */
  test(
    "and one she cannot pay for costs her nothing at all",
    async () => {
      await play({ seams: "&materials=3&hour=12&freezeNpcs" }, async (game) => {
        expect(await game.held("wood")).toBe(3);
        expect(await game.held("stone")).toBe(3);

        expect(await takeFromCrate(game, FixtureType.Sorter)).toBe(true);
        await game.settle(400);

        expect(await game.held(FixtureType.Sorter)).toBe(0);
        expect(await game.held("wood")).toBe(3);
        expect(await game.held("stone")).toBe(3);
        // And nothing is lit, so the next tap on the ground is a tap on the
        // ground rather than a machine appearing out of an empty basket.
        expect(await game.seam<string | null>("armed")).toBeNull();
      });
    },
    5 * MINUTES,
  );

  /**
   * Three machines, one rectangle, one cast.
   *
   * Reported from a playtest: *why wasn't I able to use multiplication with
   * minus to pick up three machines?* Because the patch's minus knew about
   * trees and crops and nothing else, while a tap with the same rune has
   * taken a machine back for as long as machines have been placeable. One
   * rune, one garden, two answers — and which one a child got depended on
   * whether the times spell had drawn a box first.
   *
   * Worse than a missing feature, because of the order the game asks in: the
   * rectangle holding nothing but machines counted as an empty one, so minus
   * was refused with a cross *before* any sum. From the child's side the
   * spell simply did not work on the things she could see inside it.
   *
   * Three of them and not one, because one machine in a rectangle is a
   * rectangle a single tap could have handled. What the times spell is for
   * is doing the same thing three times without doing it three times.
   */
  test(
    "and the times spell takes three of them back in one cast",
    async () => {
      await play({ seams: "&materials=60&hour=12&freezeNpcs&learned=all" }, async (game) => {
        const row = await threeInARow(game);
        for (const at of row) {
          expect(await takeFromCrate(game, FixtureType.Sorter)).toBe(true);
          await game.settle(350);
          await game.tapCell(at.col, at.row);
          await game.settle(400);
        }
        const standing = await Promise.all(row.map((at) => objectOn(game, at.col, at.row)));
        expect(standing).toEqual([FixtureType.Sorter, FixtureType.Sorter, FixtureType.Sorter]);
        expect(await game.held(FixtureType.Sorter)).toBe(0);

        // The times spell, then the minus it is multiplying, then the two
        // corners of the block: exactly the order the game asks in.
        await game.tap("spellbook");
        await game.tap(runeButton(Spell.Array));
        expect(await game.tap(patchButton(PatchAction.Clear))).toBe(true);
        await game.settle(300);
        await game.tapCell(row[0]?.col ?? 0, row[0]?.row ?? 0);
        await game.settle(300);
        await game.tapCell(row[2]?.col ?? 0, row[2]?.row ?? 0);
        await game.settle(700);

        // The spell once by hand, and then how many times over.
        await game.solveNumberLine();
        await game.solveArray();
        await game.settle(900);

        // Every square bare, and all three machines back in the basket.
        expect({
          standing: await Promise.all(row.map((at) => objectOn(game, at.col, at.row))),
          held: await game.held(FixtureType.Sorter),
        }).toEqual({ standing: [null, null, null], held: 3 });
      });
    },
    5 * MINUTES,
  );
});
