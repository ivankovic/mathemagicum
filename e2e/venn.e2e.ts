// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { afterAll, describe, expect, test } from "bun:test";
import { Region, regionOf } from "../src/minigames/venn";
import { FixtureType } from "../src/world/fixtures";
import { type Game, crateGroup, play, shutDown } from "./harness";

const MINUTES = 60_000;
/** Enough parts to take a funnel out of the crate, and a still world. */
const WITH_PARTS = "&materials=40&made=12&crops=24&hour=12&freezeNpcs";

interface Venn {
  rings: number;
  waiting: number;
  placed: number;
  missteps: number;
  left: unknown;
  right: unknown;
  onTray: { id: string; hue: string; shape: string }[];
  board: {
    rings: { x: number; y: number; r: number }[];
    tray: { x: number; y: number; w: number; h: number };
    waiting: { x: number; y: number }[];
    placed: { x: number; y: number }[];
    spots: Record<string, { x: number; y: number }>;
  } | null;
}

const venn = (game: Game) => game.seam<Venn | null>("venn");

afterAll(shutDown);

/**
 * The funnel's own question, which is the first machine to have one.
 *
 * Logic used to be a spell, and seven machines shared its parchment: a
 * child could not wake a funnel without first walking to the city and
 * being taught a rune. Now every machine type has a category of its own
 * and waking one *is* answering its question — so this scenario never
 * learns a spell, never meets the mechanic, and puts a funnel down in the
 * garden and taps it.
 */
async function aSleepingFunnel(game: Game): Promise<{ col: number; row: number }> {
  await game.tap("crate");
  await game.tap(crateGroup(FixtureType.Funnel));
  await game.settle(300);
  await game.tap(`crate.${FixtureType.Funnel}`);
  await game.settle(400);
  const at = await game.squareBeside();
  await game.tapCell(at.col, at.row);
  await game.settle(500);
  return at;
}

describe("waking a funnel", () => {
  test(
    "asks about sets, and never asks for a spell",
    async () => {
      await play({ seams: WITH_PARTS }, async (game) => {
        // No `learned=all`: this child knows nothing anybody taught her.
        expect(await game.seam<string[]>("spells")).not.toContain("logic");

        const at = await aSleepingFunnel(game);
        await game.tapCell(at.col, at.row);
        await game.settle(600);

        const seen = await venn(game);
        if (!seen?.board) throw new Error("the funnel asked nothing");
        // A ring, things waiting, and nothing placed yet.
        expect(seen.rings).toBeGreaterThanOrEqual(1);
        expect(seen.waiting).toBe(seen.onTray.length);
        expect(seen.waiting).toBeGreaterThan(0);
        expect(seen.placed).toBe(0);
        expect(seen.board.waiting).toHaveLength(seen.waiting);
        // The diagram is on the paper, not off the side of it.
        for (const ring of seen.board.rings) {
          expect(ring.r).toBeGreaterThan(20);
        }
      });
    },
    5 * MINUTES,
  );

  test(
    "a wrong drop bounces back, and the right one stays",
    async () => {
      await play({ seams: `${WITH_PARTS}&vennRung=3` }, async (game) => {
        const at = await aSleepingFunnel(game);
        await game.tapCell(at.col, at.row);
        await game.settle(600);
        const seen = await venn(game);
        if (!seen?.board) throw new Error("the funnel asked nothing");
        // Two rings that cross, at this rung, so there is a wrong region to
        // aim at that is not merely "off the sheet".
        expect(seen.rings).toBe(2);

        const one = seen.onTray[0];
        const from = seen.board.waiting[0];
        if (!one || !from) throw new Error("the tray came up empty");
        const belongs = regionOf(
          { left: seen.left as never, right: seen.right as never, tokens: [] },
          one as never,
        );
        const wrong = [Region.Left, Region.Both, Region.Right, Region.Outside].find(
          (region) => region !== belongs,
        );
        if (!wrong) throw new Error("every region is the right one");

        // Wrong first: it goes home to the tray, and is counted.
        const missed = seen.board.spots[wrong];
        if (!missed) throw new Error(`the diagram has no ${wrong}`);
        await game.drag(from, missed);
        await game.settle(300);
        const after = await venn(game);
        if (!after?.board) throw new Error("the parchment closed on a wrong drop");
        expect(after.waiting).toBe(seen.waiting);
        expect(after.placed).toBe(0);
        expect(after.missteps).toBe(1);

        // Then right: it stays, and the tray is one shorter.
        const home = after.board.spots[belongs];
        const lifted = after.board.waiting[after.onTray.findIndex((t) => t.id === one.id)];
        if (!home || !lifted) throw new Error("the thing did not come back to the tray");
        await game.drag(lifted, home);
        await game.settle(300);
        const later = await venn(game);
        if (!later) throw new Error("the parchment closed too early");
        expect(later.placed).toBe(1);
        expect(later.waiting).toBe(seen.waiting - 1);
      });
    },
    5 * MINUTES,
  );

  test(
    "and every thing has to go somewhere before the funnel wakes",
    async () => {
      await play({ seams: WITH_PARTS }, async (game) => {
        const at = await aSleepingFunnel(game);
        await game.tapCell(at.col, at.row);
        await game.settle(600);
        const seen = await venn(game);
        if (!seen) throw new Error("the funnel asked nothing");

        // One short of the whole tray: the parchment must still be open,
        // which is what "every token" means. A version that closed when it
        // had seen enough would fail here.
        for (let n = 0; n < seen.waiting - 1; n++) {
          await game.solveVennOnce();
        }
        const nearly = await venn(game);
        expect(nearly).not.toBe(null);
        expect(nearly?.waiting).toBe(1);

        await game.solveVenn();
        await game.settle(600);
        expect(await venn(game)).toBe(null);
        // Awake, and woken by its own question rather than by a rune.
        const machines = await game.seam<{ where: string; awake: boolean }[]>("machines");
        expect(machines.find((one) => one.where === `${at.col},${at.row}`)?.awake).toBe(true);
      });
    },
    5 * MINUTES,
  );
});
