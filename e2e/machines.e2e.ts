// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { afterAll, describe, expect, test } from "bun:test";
import { FixtureType } from "../src/world/fixtures";
import { MachineType, recipeFor } from "../src/world/machines";
import { type Game, play, shutDown, takeFromCrate } from "./harness";

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
});
