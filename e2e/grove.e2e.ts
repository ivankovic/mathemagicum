// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { afterAll, describe, expect, test } from "bun:test";
import { Spell } from "../src/spells/spellbook";
import { PlantType } from "../src/world/plants";
import { PatchAction } from "../src/world/selection";
import { type Game, patchButton, play, runeButton, seedButton, shutDown } from "./harness";

const MINUTES = 60_000;

afterAll(shutDown);

/**
 * The great tree's errand, and the argument it is making.
 *
 * The errand used to pay at the wrong end. A child cleared the wood off the
 * beds, filled sixteen squares by hand, and was *then* given the spell that
 * would have filled them in one cast — a reward handed over after the work
 * it saves, for a lesson nobody had been shown. Now the tree pays for the
 * clearing, which is twelve subtractions one square at a time, and asks for
 * the beds afterwards. Those sixteen go in on a single answer.
 *
 * Twelve, then one, ten seconds apart. That is the whole of what these two
 * scenarios are about: the gate moved, and the thing it now hands over can
 * really do the job it was handed over for.
 */
const AT_THE_TREE = "&hour=12&freezeNpcs";

interface Grove {
  col: number;
  row: number;
  tree: { col: number; row: number };
  thicket: { col: number; row: number }[];
}

/** What is growing on a square, or nothing. */
function cropOn(game: Game, col: number, row: number): Promise<string | null> {
  return game.tab.evaluate(
    ([c, r]) => {
      const handle = (globalThis as never as Record<string, Record<string, unknown>>)
        .__mathemagicum;
      if (!handle) throw new Error("the game has not put its handle out");
      const session = handle.session as {
        grid: { getCrop: (col: number, row: number) => { plant: string } | null };
      };
      return session.grid.getCrop(c as number, r as number)?.plant ?? null;
    },
    [col, row] as const,
  );
}

/**
 * Take the wood off the beds without casting twelve subtractions.
 *
 * The clearing spell itself is not what these scenarios are about — twelve
 * parchments and twelve walks across a clearing is four minutes of browser
 * to prove a thing `sums.e2e.ts` already casts once. What is under test is
 * the *gate*: which side of the wood the tree pays on. So the wood is lifted
 * off the grid directly, and the tree is asked the same question before and
 * after.
 */
function takeTheWoodAway(game: Game, thicket: { col: number; row: number }[]): Promise<void> {
  return game.tab.evaluate((cells) => {
    const handle = (globalThis as never as Record<string, Record<string, unknown>>).__mathemagicum;
    if (!handle) throw new Error("the game has not put its handle out");
    const session = handle.session as {
      grid: { removeObjectAt: (col: number, row: number) => unknown };
    };
    for (const at of cells as { col: number; row: number }[]) {
      session.grid.removeObjectAt(at.col, at.row);
    }
  }, thicket);
}

/** Stand on the tree's doorstep and tap its trunk. */
async function askTheTree(game: Game, grove: Grove): Promise<void> {
  // The trunk's middle cell. The footprint is three by three with its anchor
  // at the top-left, and a tap has to land on the sprite rather than on the
  // grass it stands in.
  await game.tapCell(grove.tree.col + 1, grove.tree.row + 1);
  await game.settle(700);
}

describe("what the great tree asks for", () => {
  /**
   * The spell is paid for the clearing, and not for the beds.
   *
   * Both halves in one scenario, because either alone passes on a tree that
   * gives the spell away to anybody who walks up to it, or on one that never
   * gives it at all.
   */
  test(
    "pays for the wood, and asks for the beds afterwards",
    async () => {
      await play({ seams: AT_THE_TREE }, async (game) => {
        const grove = await game.seam<Grove>("grove");
        expect(grove.thicket.length).toBeGreaterThan(8);

        await game.reload(`${AT_THE_TREE}&at=${grove.col},${grove.row}`);
        await game.settle(900);
        expect(await game.seam<string[]>("spells")).not.toContain(Spell.Array);

        // Asked while the wood is still standing: it says what it wants and
        // hands over nothing.
        await askTheTree(game, grove);
        await game.press("Escape");
        await game.settle(300);
        expect(await game.seam<string[]>("spells")).not.toContain(Spell.Array);

        // And asked again with the beds clear, it pays — before a single
        // sunflower has been planted in them.
        await takeTheWoodAway(game, grove.thicket);
        await askTheTree(game, grove);
        expect(await game.seam<string[]>("spells")).toContain(Spell.Array);
      });
    },
    5 * MINUTES,
  );

  /**
   * And the spell it hands over fills a bed in one cast.
   *
   * The other half of the argument, and the reason planting was added to the
   * patch at all: what she has just done twelve times one square at a time,
   * she now does to four squares with one answer. Cast on ordinary ground
   * rather than in the grove, because what is being checked is the spell and
   * not the errand — and a rectangle of garden is the same rectangle.
   *
   * Four squares rather than sixteen: two by two is the array spell's own
   * smallest shape, it is one of the tree's four beds, and it is the largest
   * block that is certainly clear ground beside her.
   */
  test(
    "and the spell it gives plants a whole bed at once",
    async () => {
      await play({ seams: `${AT_THE_TREE}&learned=all` }, async (game) => {
        const here = await game.where();
        const bed = [
          { col: here.col - 1, row: here.row + 1 },
          { col: here.col, row: here.row + 1 },
          { col: here.col - 1, row: here.row + 2 },
          { col: here.col, row: here.row + 2 },
        ];
        expect(await Promise.all(bed.map((at) => cropOn(game, at.col, at.row)))).toEqual([
          null,
          null,
          null,
          null,
        ]);

        // The seed first, from the pouch, which is what the button on the
        // menu will show — a patch that chose its own crop would be a second
        // way of picking a seed.
        await game.tap("seeds");
        await game.tap(seedButton(PlantType.Sunflower));
        await game.settle(300);

        await game.tap("spellbook");
        await game.tap(runeButton(Spell.Array));
        expect(await game.tap(patchButton(PatchAction.Plant))).toBe(true);
        await game.settle(300);
        await game.tapCell(bed[0]?.col ?? 0, bed[0]?.row ?? 0);
        await game.settle(300);
        await game.tapCell(bed[3]?.col ?? 0, bed[3]?.row ?? 0);
        await game.settle(700);

        // No spell to cast once by hand — planting is a tap and costs no
        // arithmetic — so the multiplication is the whole price of it.
        await game.solveArray();
        await game.settle(700);

        expect(await Promise.all(bed.map((at) => cropOn(game, at.col, at.row)))).toEqual([
          PlantType.Sunflower,
          PlantType.Sunflower,
          PlantType.Sunflower,
          PlantType.Sunflower,
        ]);
      });
    },
    5 * MINUTES,
  );
});
