// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { afterAll, describe, expect, test } from "bun:test";
import { Spell } from "../src/spells/spellbook";
import { CRATE_WIRE } from "../src/world/crate";
import { FixtureType } from "../src/world/fixtures";
import { MINUTES_PER_ROUND, SHARES } from "../src/world/machines";
import { type Game, play, runeButton, shutDown, takeFromCrate } from "./harness";

const MINUTES = 60_000;

afterAll(shutDown);

/**
 * Machines joined into a line, which is the half that needs two of them.
 *
 * **Its own file, and that is not tidiness.** These began as four more
 * scenarios in `sorter.e2e.ts`, where the last of them timed out at five
 * minutes while passing in ninety seconds on its own — `harness.ts` says why
 * in as many words: *a dozen scenarios in one process is near the edge on
 * four busy cores*, and these are the heaviest in the suite. Each one winds
 * a twelve-hour clock once or twice, and every wind is a sand animation and
 * a parchment. Seven of them in one process was over the line; `crate.e2e.ts`
 * was split out of `house.e2e.ts` for exactly this, at exactly this size.
 */

/**
 * The first machine that does anything, end to end.
 *
 * `machines.test.ts` proves the dealing in a fraction of a second and every
 * assertion in it is a function call. What a child does is tap a sorter, be
 * shown one sum, tip a heap in and come back to three equal piles — and none
 * of that route is in the model. The waking is a parchment, the tipping
 * reaches into the basket, the dealing is driven by a clock nothing else in
 * the game measures, and the whole of it has to survive being written down.
 *
 * It is also the piece with the quietest failure mode in the game. A
 * machine's state is not an object on the grid, not in the basket, and not
 * on screen beyond three little heaps in three crates: a sorter that had
 * stopped dealing, or one dealing without ever having been woken, looks
 * exactly like one that works.
 */
const WITH_TIMBER = "&materials=60&hour=12&freezeNpcs&learned=all";

interface Strung {
  from: string;
  to: string;
  moved: number;
}

interface Machine {
  where: string;
  awake: boolean;
  holding: string | null;
  heap: number;
  crates: number[];
  made: string | null;
  passes: string | null;
  binned: string | null;
  bin: number;
  mark: number;
}

const machines = (game: Game) => game.seam<Machine[]>("machines");

/** An empty square next to her, to stand a machine on. */
async function squareBeside(game: Game): Promise<{ col: number; row: number }> {
  const here = await game.where();
  for (const step of [
    { col: 1, row: 0 },
    { col: -1, row: 0 },
    { col: 0, row: 1 },
    { col: 0, row: -1 },
  ]) {
    const at = { col: here.col + step.col, row: here.row + step.row };
    const on = await game.tab.evaluate(
      ([c, r]) => {
        const handle = (globalThis as never as Record<string, Record<string, unknown>>)
          .__mathemagicum;
        if (!handle) throw new Error("the game has not put its handle out");
        const session = handle.session as {
          grid: { getObjectAt: (col: number, row: number) => unknown };
        };
        return session.grid.getObjectAt(c as number, r as number) !== null;
      },
      [at.col, at.row] as const,
    );
    if (!on) return at;
  }
  throw new Error("she is boxed in on all four sides");
}

/** Build one, put it down beside her, and give back the square it is on. */
async function aMachineBeside(
  game: Game,
  machine: FixtureType,
): Promise<{ col: number; row: number }> {
  expect(await takeFromCrate(game, machine)).toBe(true);
  await game.settle(400);
  const at = await squareBeside(game);
  await game.tapCell(at.col, at.row);
  await game.settle(500);
  return at;
}

describe("machines joined into a line", () => {
  test(
    "and the hothouse turns a crop into timber",
    async () => {
      await play({ seams: WITH_TIMBER }, async (game) => {
        const at = await aMachineBeside(game, FixtureType.Hothouse);

        // Woken by the rows and columns it is about to do three at a time,
        // not by the sorter's division: each machine is shown its own sum.
        await game.tapCell(at.col, at.row);
        await game.settle(400);
        expect(await game.seam("array")).not.toBeNull();
        await game.solveArray();
        await game.settle(500);
        expect((await machines(game))[0]).toMatchObject({ awake: true });

        // A basket of carrots, and more wood than carrots on purpose: the
        // machine takes the biggest heap it *wants*, and a hothouse that
        // took timber would turn one wood into three and never stop.
        await game.tab.evaluate((crop) => {
          const handle = (globalThis as never as Record<string, Record<string, unknown>>)
            .__mathemagicum;
          if (!handle) throw new Error("the game has not put its handle out");
          (handle.session as { inventory: { add: (of: string, n: number) => void } }).inventory.add(
            crop as string,
            9,
          );
        }, "carrot");
        await game.settle(200);
        expect(await game.held("wood")).toBeGreaterThan(9);

        await game.tapCell(at.col, at.row);
        await game.settle(500);
        const fed = (await machines(game))[0];
        expect(fed).toMatchObject({ holding: "carrot", heap: 9 });
        expect(await game.held("carrot")).toBe(0);

        const wood = await game.held("wood");
        await game.windClock(12);
        await game.settle(1500);

        // Nine crops in, one to a round, three crates filling each time.
        const done = (await machines(game))[0];
        expect(done).toMatchObject({ heap: 0, made: "wood" });
        expect(done?.crates).toEqual([9, 9, 9]);

        // And what comes out is timber, not the carrots that went in.
        await game.tapCell(at.col, at.row);
        await game.settle(500);
        expect(await game.held("wood")).toBe(wood + 9);
        expect(await game.held("carrot")).toBe(0);
      });
    },
    5 * MINUTES,
  );

  /**
   * And a wire between the two, which is what makes it a system.
   *
   * A sorter deals a heap into three and a hothouse eats one crop a round.
   * On their own they are two machines a child walks between with a basket;
   * joined, the second is fed by the first and the garden does something
   * while she is standing in it.
   *
   * The failure worth guarding is the quiet one, and it is *two* failures
   * that look identical from outside: a wire that never carried and a wire
   * that is correctly backed up both sit there doing nothing. That is why
   * the seam reports how much moved rather than only what is joined to what.
   */

  test(
    "and a wire feeds one machine from another",
    async () => {
      await play({ seams: WITH_TIMBER }, async (game) => {
        // A sorter with carrots in it, dealt and waiting in the crates.
        const from = await aMachineBeside(game, FixtureType.Sorter);
        await game.tapCell(from.col, from.row);
        await game.settle(400);
        await game.solveShare();
        await game.settle(400);
        // More carrots than she has of anything else, and that matters: a
        // sorter takes *whatever* it is given — dealing cannot mint, so it
        // has no reason to be fussy — and it tips in the biggest heap she is
        // carrying. Given fewer carrots than stone it eats the stone, and
        // then there is none left to build the second machine out of.
        await game.tab.evaluate((crop) => {
          const handle = (globalThis as never as Record<string, Record<string, unknown>>)
            .__mathemagicum;
          if (!handle) throw new Error("the game has not put its handle out");
          (handle.session as { inventory: { add: (of: string, n: number) => void } }).inventory.add(
            crop as string,
            99,
          );
        }, "carrot");
        await game.settle(200);
        await game.tapCell(from.col, from.row);
        await game.settle(400);

        // And a hothouse beside it, woken and empty.
        const to = await aMachineBeside(game, FixtureType.Hothouse);
        await game.tapCell(to.col, to.row);
        await game.settle(400);
        await game.solveArray();
        await game.settle(400);

        // Both standing and both awake before any wire is strung, so a
        // failure below is about the wire rather than about the machines.
        const both = await machines(game);
        expect(both.map((one) => one.where).sort()).toEqual(
          [`${from.col},${from.row}`, `${to.col},${to.row}`].sort(),
        );
        expect(both.every((one) => one.awake)).toBe(true);

        // The coil takes two taps: one machine, then the other. In between
        // it stays lit and she still has hold of the first end.
        expect(await takeFromCrate(game, CRATE_WIRE)).toBe(true);
        await game.settle(300);
        await game.tapCell(from.col, from.row);
        await game.settle(300);
        expect(await game.seam<{ col: number; row: number } | null>("wiring")).toEqual({
          col: from.col,
          row: from.row,
        });
        expect(await game.seam<string | null>("armed")).toBe(CRATE_WIRE);

        await game.tapCell(to.col, to.row);
        await game.settle(400);
        expect(await game.seam<Strung[]>("wires")).toHaveLength(1);

        // Now wind the clock: the sorter deals its heap and the wire walks
        // it along to the hothouse, which turns it into timber.
        const wood = await game.held("wood");
        await game.windClock(12);
        await game.settle(1500);

        const strung = (await game.seam<Strung[]>("wires"))[0];
        expect(strung?.moved).toBeGreaterThan(0);

        const house = (await game.seam<Machine[]>("machines")).find(
          (one) => one.where === `${to.col},${to.row}`,
        );
        // Carrots arrived and became timber, which nothing but the wire
        // could have done — she never carried any of it across herself.
        expect(house?.made).toBe("wood");
        expect(house?.crates.some((count) => count > 0)).toBe(true);

        await game.tapCell(to.col, to.row);
        await game.settle(500);
        expect(await game.held("wood")).toBeGreaterThan(wood);

        // And the line is still there tomorrow.
        await game.reload(WITH_TIMBER);
        await game.settle(800);
        expect(await game.seam<Strung[]>("wires")).toHaveLength(1);
      });
    },
    5 * MINUTES,
  );

  /**
   * And the sieve, which decides rather than makes.
   *
   * A wire only carries, so this is where a line is gated: shown one thing,
   * it passes that and drops everything else into its bin. What it is
   * *for* is the case where a line would otherwise stop dead — a hothouse
   * only takes crops, so timber arriving at one backs the whole thing up
   * until somebody comes and sorts it out by hand.
   *
   * The failure worth guarding is that a jam and an idle machine look
   * identical from outside. Both sit there doing nothing.
   */

  test(
    "and the sieve keeps what it is shown and bins the rest",
    async () => {
      await play({ seams: WITH_TIMBER }, async (game) => {
        const at = await aMachineBeside(game, FixtureType.Sieve);

        // Woken by the minus rune's own arithmetic: what a sieve does to a
        // heap is take out what does not belong.
        await game.tapCell(at.col, at.row);
        await game.settle(400);
        expect(await game.seam("spell")).not.toBeNull();
        await game.solveNumberLine();
        await game.settle(500);
        expect((await machines(game))[0]).toMatchObject({ awake: true, passes: null });

        // Shown one thing by the first heap that goes in, and never asked
        // again. She is carrying more stone than anything, so stone is what
        // it learns — which is the machine deciding, not the scenario.
        await game.tapCell(at.col, at.row);
        await game.settle(400);
        const shown = (await machines(game))[0];
        if (!shown?.holding) throw new Error("the sieve took nothing at all");
        const passes = shown.holding;

        await game.windClock(12);
        await game.settle(1500);
        const sifted = (await machines(game))[0];
        expect(sifted).toMatchObject({ passes, bin: 0 });
        // What has come through is in the crates and none of it in the bin,
        // and nothing has been lost between the two. Not *all* of it: a
        // sieve takes one a round, so twelve hours is thirty-six of them and
        // a big heap outlasts a single cast — which is why a line feeds one
        // a few at a time rather than tipping a basket into it.
        const through = sifted?.crates.reduce((all, count) => all + count, 0) ?? 0;
        expect(through).toBeGreaterThan(0);
        expect(through + (sifted?.heap ?? 0)).toBe(shown.heap);

        // Wind again until the mouth runs dry. A sieve takes one kind at a
        // time like every other machine, so nothing else goes in until it
        // has finished what it has — and its mouth forgetting the moment it
        // empties is what lets a line pour a stream of mixed things through
        // it at all.
        await game.windClock(12);
        await game.settle(1500);
        expect((await machines(game))[0]).toMatchObject({ heap: 0, holding: null });

        // Now something else. It goes in the bin rather than the crates,
        // which is the whole of what a sieve is.
        await game.tab.evaluate((crop) => {
          const handle = (globalThis as never as Record<string, Record<string, unknown>>)
            .__mathemagicum;
          if (!handle) throw new Error("the game has not put its handle out");
          (handle.session as { inventory: { add: (of: string, n: number) => void } }).inventory.add(
            crop as string,
            99,
          );
        }, "carrot");
        await game.settle(200);
        // Empty its crates first, or a tap hands her a share instead of
        // filling it — the good ones come out before the rejects. Which
        // gives her back everything it passed, so the carrots have to
        // outnumber that too: a machine tips in the biggest heap she has.
        for (let go = 0; go < SHARES; go++) {
          await game.tapCell(at.col, at.row);
          await game.settle(300);
        }
        await game.tapCell(at.col, at.row);
        await game.settle(400);
        await game.windClock(12);
        await game.settle(1500);

        const caught = (await machines(game))[0];
        expect(caught).toMatchObject({ passes, binned: "carrot" });
        expect(caught?.bin).toBeGreaterThan(0);

        // And a tap tips the bin out — the carrots back, not a share of the
        // stone it kept. A bin is not a share.
        const held = await game.held("carrot");
        await game.tapCell(at.col, at.row);
        await game.settle(500);
        expect(await game.held("carrot")).toBeGreaterThan(held);

        // Not asserted: that the bin is empty afterwards. It is emptied, and
        // then it starts filling again, because the mouth is still full of
        // carrots and the machine has not stopped — which is right. A sieve
        // whose bin stayed empty after one tap would be a sieve that had
        // given up on the heap it was still holding.
        expect((await machines(game))[0]?.binned).toBe("carrot");
      });
    },
    5 * MINUTES,
  );

  /**
   * And the tally, which asks whether there is *enough*.
   *
   * The other three say how much of a thing there is. This one holds what it
   * is given until the heap reaches a mark and then tips the lot — so a heap
   * sitting under that mark, going nowhere however long a child waits, is
   * `≥` in a shape they can walk up to.
   *
   * The failure worth guarding is the one that looks like patience. A tally
   * that had quietly stopped and a tally correctly waiting under its mark
   * are the same picture, and the second is the whole point of the machine.
   */

  test(
    "and the tally holds a heap until there is enough of it",
    async () => {
      await play({ seams: WITH_TIMBER }, async (game) => {
        const at = await aMachineBeside(game, FixtureType.Tally);

        // Woken by the number line, which is what counting up to a mark is.
        await game.tapCell(at.col, at.row);
        await game.settle(400);
        expect(await game.seam("spell")).not.toBeNull();
        await game.solveNumberLine();
        await game.settle(500);
        expect((await machines(game))[0]).toMatchObject({ awake: true, mark: 0 });

        // The first heap sets the mark and goes straight through, since it
        // is by definition enough. Shown once, never asked again.
        await game.tapCell(at.col, at.row);
        await game.settle(400);
        const shown = (await machines(game))[0];
        if (!shown?.holding) throw new Error("the tally took nothing at all");
        await game.windClock(12);
        await game.settle(1500);

        const marked = (await machines(game))[0];
        expect(marked?.mark).toBe(shown.heap);
        expect(marked?.crates.reduce((all, count) => all + count, 0)).toBe(shown.heap);

        // Empty it, then give it less than the mark. Nothing happens — not
        // slowly, not at all, and not after a night of it either.
        for (let go = 0; go < SHARES; go++) {
          await game.tapCell(at.col, at.row);
          await game.settle(300);
        }
        await game.tab.evaluate(
          ([item, few]) => {
            const handle = (globalThis as never as Record<string, Record<string, unknown>>)
              .__mathemagicum;
            if (!handle) throw new Error("the game has not put its handle out");
            const purse = handle.session as {
              inventory: {
                add: (of: string, n: number) => void;
                remove: (of: string, n: number) => boolean;
                count: (of: string) => number;
              };
            };
            // Leave her holding a few and nothing else, so the machine takes
            // the short heap rather than some bigger pile of something.
            for (const of of ["wood", "stone", "carrot"]) {
              purse.inventory.remove(of as string, purse.inventory.count(of as string));
            }
            purse.inventory.add(item as string, few as number);
          },
          [shown.holding, 2] as const,
        );
        await game.settle(200);
        await game.tapCell(at.col, at.row);
        await game.settle(400);
        expect((await machines(game))[0]).toMatchObject({ heap: 2 });

        await game.windClock(12);
        await game.settle(1500);
        const waiting = (await machines(game))[0];
        expect(waiting).toMatchObject({ heap: 2 });
        expect(waiting?.crates.reduce((all, count) => all + count, 0)).toBe(0);
      });
    },
    5 * MINUTES,
  );

  /**
   * And a line survives her walking indoors, which it did not.
   *
   * `machineAt` read `this.grid`, and indoors that is the *room's* grid —
   * where a machine's outdoor square is out of bounds or some square of
   * somebody's floor. So it answered "no machine here" for every machine in
   * the world the moment she stepped through a door, `runWires` dropped
   * every wire whose ends were no longer machines, and the autosave that
   * followed made it permanent.
   *
   * Quiet, too: she walks into her own house, walks out, and the lines she
   * strung are gone with nothing to say why. Found by capturing a real save
   * and noticing the wire was not in it.
   */
  test(
    "and a wire is still there after she goes indoors",
    async () => {
      await play({ seams: WITH_TIMBER }, async (game) => {
        const from = await aMachineBeside(game, FixtureType.Sorter);
        await game.tapCell(from.col, from.row);
        await game.settle(400);
        await game.solveShare();
        await game.settle(400);
        const to = await aMachineBeside(game, FixtureType.Hothouse);
        await game.tapCell(to.col, to.row);
        await game.settle(400);
        await game.solveArray();
        await game.settle(400);

        expect(await takeFromCrate(game, CRATE_WIRE)).toBe(true);
        await game.settle(300);
        await game.tapCell(from.col, from.row);
        await game.settle(300);
        await game.tapCell(to.col, to.row);
        await game.settle(400);
        expect(await game.seam<Strung[]>("wires")).toHaveLength(1);

        // In through her own front door, a moment inside, and out again.
        const doors = await game.seam<Record<string, { col: number; row: number }>>("doors");
        const door = doors["player-house"];
        if (!door) throw new Error("the village has no house for the player");
        await game.standAt(door.col, door.row + 2, "up");
        await game.walk("ArrowUp", 900);
        await game.stopped();
        expect(await game.seam<unknown>("house")).not.toBeNull();
        await game.settle(800);

        // Still strung. And still strung tomorrow, which is the half that
        // says the autosave did not write the loss down.
        expect(await game.seam<Strung[]>("wires")).toHaveLength(1);
        await game.reload(WITH_TIMBER);
        await game.settle(800);
        expect(await game.seam<Strung[]>("wires")).toHaveLength(1);
      });
    },
    5 * MINUTES,
  );
});
