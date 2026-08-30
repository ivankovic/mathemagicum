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

describe("the first machine that does something", () => {
  test(
    "is shown one sum, then deals in silence for ever",
    async () => {
      await play({ seams: WITH_TIMBER }, async (game) => {
        const at = await aMachineBeside(game, FixtureType.Sorter);
        // Standing there and asleep: a sculpture until it has been shown the
        // arithmetic it is about to spend its life doing.
        expect(await machines(game)).toEqual([]);

        // One tap opens the division parchment. Answered, and the machine is
        // awake — and that is the only sum it will ever ask for.
        await game.tapCell(at.col, at.row);
        await game.settle(400);
        await game.solveShare();
        await game.settle(500);
        const woken = await machines(game);
        expect(woken).toHaveLength(1);
        expect(woken[0]).toMatchObject({ awake: true, holding: null, heap: 0 });

        // A second tap tips in the biggest heap she is carrying. No sum: this
        // is the whole point of the design, and a second parchment here would
        // make the machine a spell with a worse interface.
        //
        // *Which* heap is not written down here, because the machine decides
        // — the biggest, since choosing would be a menu and a menu is what
        // this interaction is trying not to be. She is carrying wood and
        // stone in different amounts, so pinning it to one of them would be
        // pinning the tie-break rather than the behaviour.
        await game.tapCell(at.col, at.row);
        await game.settle(500);
        const fed = (await machines(game))[0];
        if (!fed?.holding) throw new Error("the sorter took nothing at all");
        expect(fed.heap).toBeGreaterThanOrEqual(SHARES);
        expect(fed.crates).toEqual([0, 0, 0]);
        // And it came out of the basket rather than being conjured.
        expect(await game.held(fed.holding)).toBe(0);
      });
    },
    5 * MINUTES,
  );

  /**
   * And the clock spell is how a child hurries it.
   *
   * The machine's minutes are minutes she was *there* for — see
   * `workMachines`, and the reason: a machine paid by elapsed time would pay
   * a child for having the tab shut. Winding the clock moves the world's
   * hour while she watches, so it moves the machine too, and that is the one
   * way to make a sorter deal a heap in the time anybody would sit still for.
   */
  test(
    "and winding the clock is what hurries it",
    async () => {
      await play({ seams: WITH_TIMBER }, async (game) => {
        const at = await aMachineBeside(game, FixtureType.Sorter);
        await game.tapCell(at.col, at.row);
        await game.settle(400);
        await game.solveShare();
        await game.settle(400);
        await game.tapCell(at.col, at.row);
        await game.settle(400);

        const filled = (await machines(game))[0];
        const heap = filled?.heap ?? 0;
        const item = filled?.holding;
        if (!item) throw new Error("the sorter took nothing at all");
        expect(heap).toBeGreaterThanOrEqual(SHARES * 2);
        // Nothing dealt yet: a round is twenty minutes of work and she has
        // been standing here for seconds.
        expect((await machines(game))[0]?.crates).toEqual([0, 0, 0]);

        await game.windClock(12);
        await game.settle(1500);

        // Twelve hours is seven hundred and twenty minutes, which is far
        // more rounds than the heap has in it — so it deals the lot, and
        // what is left in the mouth is the remainder and nothing else.
        const dealt = (await machines(game))[0];
        if (!dealt) throw new Error("the sorter went missing");
        expect(dealt.crates).toEqual(Array(SHARES).fill(Math.floor(heap / SHARES)));
        expect(dealt.heap).toBe(heap % SHARES);
        expect(MINUTES_PER_ROUND * Math.floor(heap / SHARES)).toBeLessThanOrEqual(720);

        // One more tap takes one share — not the lot, which is the use of
        // the thing: an exact third, counted out by something that cannot
        // miscount.
        await game.tapCell(at.col, at.row);
        await game.settle(500);
        expect(await game.held(item)).toBe(Math.floor(heap / SHARES));
        const left = (await machines(game))[0];
        expect(left?.crates.filter((count) => count > 0)).toHaveLength(SHARES - 1);

        // And all of it is still true tomorrow. A machine is not an object
        // on the grid and not in the basket; if the save forgot it, a child
        // would come back to a sorter that had never been woken and a heap
        // of wood that had never existed.
        await game.reload(WITH_TIMBER);
        await game.settle(800);
        const remembered = (await machines(game))[0];
        expect(remembered).toMatchObject({
          awake: true,
          holding: item,
          heap: left?.heap ?? -1,
        });
        expect(remembered?.crates).toEqual(left?.crates ?? []);
      });
    },
    5 * MINUTES,
  );

  /**
   * And the minus rune takes it back, with everything that was in it.
   *
   * Tapping a machine is how it is *used*, so it cannot also be how a
   * machine is picked up — which left putting one down with no undo at all,
   * the same complaint that got crops theirs. This is the rune that unmakes
   * things and it already lifts a carrot out of the ground it was dropped
   * on.
   *
   * The contents coming back is the half worth asserting. Everything in
   * there was put there by casting, so a sorter that ate a child's heap when
   * they moved it would be punishing them for changing their mind about
   * where a thing stands.
   */
  test(
    "and the minus rune takes it back, heap and all",
    async () => {
      await play({ seams: WITH_TIMBER }, async (game) => {
        const at = await aMachineBeside(game, FixtureType.Sorter);
        await game.tapCell(at.col, at.row);
        await game.settle(400);
        await game.solveShare();
        await game.settle(400);
        await game.tapCell(at.col, at.row);
        await game.settle(500);

        const filled = (await machines(game))[0];
        if (!filled?.holding) throw new Error("the sorter took nothing at all");
        expect(await game.held(filled.holding)).toBe(0);
        expect(await game.held(FixtureType.Sorter)).toBe(0);

        await game.tap("spellbook");
        await game.tap(runeButton(Spell.Clearing));
        await game.tapCell(at.col, at.row);
        await game.settle(400);
        expect(await game.seam("spell")).not.toBeNull();
        await game.solveNumberLine();
        await game.settle(600);

        // The machine is back in the basket, the heap is back in the basket,
        // and nothing of it is left standing in the garden.
        expect(await game.held(FixtureType.Sorter)).toBe(1);
        expect(await game.held(filled.holding)).toBe(filled.heap);
        expect(await machines(game)).toEqual([]);
      });
    },
    5 * MINUTES,
  );

  /**
   * And the second machine, which turns one thing into another.
   *
   * The sorter *deals*: what comes out of it is what went in, counted into
   * three piles. This one *turns*, and that difference is the reason there
   * are two machines rather than one with a setting — a crop goes into the
   * mouth and timber comes out of the crates.
   *
   * The failure it is here for is the one that looks like success. Every
   * line of code that moves work along is shared, so a hothouse wired up
   * wrong runs perfectly and hands a child their carrots back — a machine
   * that appears to work and does nothing at all.
   */
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
});
