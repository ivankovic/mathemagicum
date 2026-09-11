// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { afterAll, describe, expect, test } from "bun:test";
import { FixtureType } from "../src/world/fixtures";
import { SHELVED } from "../src/world/jobs";
import { type Game, crateGroup, play, shutDown, takeFromCrate } from "./harness";

const MINUTES = 60_000;

afterAll(shutDown);

/**
 * The machines that decide: the funnel and the bell.
 *
 * Built from what a press made — `?made=` is the seam that spares this file
 * ten minutes of pressing — and woken by the logic parchment. Two promises
 * about the crate and two about the machines. The crate offers the funnel
 * from the start and holds the bell back until the mechanic's first job is
 * done. A woken funnel takes what it is handed and passes it on; a woken
 * bell rings once for each thing through it, which is what a job counts.
 */

interface Machine {
  where: string;
  awake: boolean;
  holding: string | null;
  heap: number;
  crates: number[];
  made: string | null;
  bin: number;
  rung: number;
}

const machines = (game: Game) => game.seam<Machine[]>("machines");

const WITH_PARTS = "&materials=40&made=12&crops=24&hour=12&freezeNpcs&learned=all";

/** Put one down beside her, wake it with the parchment, and hand it a heap. */
async function running(game: Game, machine: FixtureType): Promise<{ col: number; row: number }> {
  expect(await takeFromCrate(game, machine)).toBe(true);
  await game.settle(400);
  const at = await game.squareBeside();
  await game.tapCell(at.col, at.row);
  await game.settle(500);
  // Asleep: the first tap asks the sum. Which parchment that is depends on
  // the machine — the funnel has moved onto a category of its own and asks
  // about sets, the rest still share the logic spell.
  await game.tapCell(at.col, at.row);
  await game.settle(400);
  if (machine === FixtureType.Funnel) await game.solveVenn();
  else await game.solveLogic();
  await game.settle(400);
  const woken = (await machines(game)).find((one) => one.where === `${at.col},${at.row}`);
  expect(woken?.awake).toBe(true);
  // Awake: the next tap tips in the biggest heap she is carrying.
  await game.tapCell(at.col, at.row);
  await game.settle(400);
  return at;
}

describe("what the crate offers", () => {
  test(
    "the funnel from the start, and the bell only once the first job is done",
    async () => {
      await play({ seams: WITH_PARTS }, async (game) => {
        await game.tap("crate");
        await game.tap(crateGroup(FixtureType.Funnel));
        await game.settle(300);
        const buttons = Object.keys(await game.ui());
        expect(buttons).toContain(`crate.${FixtureType.Funnel}`);
        expect(buttons).not.toContain(`crate.${FixtureType.Bell}`);
      });
      await play({ seams: `${WITH_PARTS}&jobs=all` }, async (game) => {
        await game.tap("crate");
        await game.tap(crateGroup(FixtureType.Bell));
        await game.settle(300);
        expect(Object.keys(await game.ui())).toContain(`crate.${FixtureType.Bell}`);
      });
    },
    5 * MINUTES,
  );
});

describe("the machines that decide", () => {
  test(
    "a funnel passes on what it is handed, and a bell rings for each thing through it",
    async () => {
      await play({ seams: `${WITH_PARTS}&jobs=all` }, async (game) => {
        const funnel = await running(game, FixtureType.Funnel);
        const fed = (await machines(game)).find(
          (one) => one.where === `${funnel.col},${funnel.row}`,
        );
        if (!fed?.holding) throw new Error("the funnel took nothing");
        expect(fed.heap).toBeGreaterThan(0);

        const bell = await running(game, FixtureType.Bell);
        const rung = (await machines(game)).find((one) => one.where === `${bell.col},${bell.row}`);
        if (!rung?.holding) throw new Error("the bell took nothing");
        expect(rung.rung).toBe(0);

        // Minutes she was there for: the clock spell is how a child hurries
        // a machine, and twelve hours is thirty-six rounds.
        await game.windClock(12);
        await game.settle(1500);
        const later = await machines(game);
        const passed = later.find((one) => one.where === `${funnel.col},${funnel.row}`);
        const ringing = later.find((one) => one.where === `${bell.col},${bell.row}`);
        // What went in came out the spout, unchanged: the crates hold the
        // kind the mouth was handed.
        expect(passed?.crates.reduce((sum, n) => sum + n, 0)).toBeGreaterThan(0);
        expect(passed?.made).toBe(fed.holding);
        // And the bell rang once for each thing through it.
        expect(ringing?.rung).toBeGreaterThan(0);
        expect(ringing?.rung).toBe(ringing?.crates.reduce((sum, n) => sum + n, 0));
      });
    },
    6 * MINUTES,
  );
});

describe("the rest of the tree", () => {
  test(
    "a trapdoor bins what it was shown and passes the rest, and a seesaw deals each way",
    async () => {
      await play({ seams: `${WITH_PARTS}&jobs=all` }, async (game) => {
        const trap = await running(game, FixtureType.Inverter);
        const shown = (await machines(game)).find((one) => one.where === `${trap.col},${trap.row}`);
        if (!shown?.holding) throw new Error("the trapdoor took nothing");
        const seesaw = await running(game, FixtureType.Seesaw);
        await game.windClock(12);
        await game.settle(1500);
        const later = await machines(game);
        const dropped = later.find((one) => one.where === `${trap.col},${trap.row}`);
        // The first kind it was shown went in the bin, and nothing through.
        expect(dropped?.bin).toBeGreaterThan(0);
        expect(dropped?.crates).toEqual([0, 0, 0]);
        const dealt = later.find((one) => one.where === `${seesaw.col},${seesaw.row}`);
        // One this way, one that way: the crates and the bin within one of
        // each other.
        const through = dealt?.crates.reduce((sum, n) => sum + n, 0) ?? 0;
        expect(through).toBeGreaterThan(0);
        expect(Math.abs(through - (dealt?.bin ?? 0))).toBeLessThanOrEqual(1);
      });
    },
    6 * MINUTES,
  );

  test(
    "a strongbox holds by day and lets out at night",
    async () => {
      // `?hour=` pins the clock the lid reads, so the two halves are two
      // worlds: one held at noon, one held at ten at night. Winding the
      // glass moves the minutes the machines work by, not the pinned hour.
      await play({ seams: `${WITH_PARTS}&jobs=all` }, async (game) => {
        const chest = await running(game, FixtureType.Latch);
        await game.windClock(6);
        await game.settle(1200);
        const day = (await machines(game)).find((one) => one.where === `${chest.col},${chest.row}`);
        expect(day?.crates).toEqual([0, 0, 0]);
        expect(day?.heap).toBeGreaterThan(0);
      });
      await play(
        { seams: `${WITH_PARTS.replace("hour=12", "hour=22")}&jobs=all` },
        async (game) => {
          const chest = await running(game, FixtureType.Latch);
          await game.windClock(6);
          await game.settle(1500);
          const night = (await machines(game)).find(
            (one) => one.where === `${chest.col},${chest.row}`,
          );
          expect(night?.crates.reduce((sum, n) => sum + n, 0)).toBeGreaterThan(0);
        },
      );
    },
    8 * MINUTES,
  );

  // Skipped only while the blueprint is on the shelf, and skipped *by
  // asking* rather than by being commented out, so that taking it off the
  // shelf starts this scenario running again on its own. See `world/jobs.ts`.
  const drawing = (SHELVED as readonly string[]).includes(FixtureType.Blueprint) ? test.skip : test;
  drawing(
    "a blueprint draws the line beside it and builds it again where it is stamped",
    async () => {
      // More crops than wood, so the funnel — which is handed the biggest
      // heap she is carrying — eats carrots and leaves the wood for the
      // blueprint's paper. Every job but the last counted as done, so the
      // last is the one the stamping finishes; and the climb to the dome
      // counted as lit, which is what puts a blueprint in the crate.
      await play(
        {
          seams:
            "&materials=40&made=12&crops=90&hour=12&freezeNpcs&learned=all&lampsLit&jobs=either,ring,else,parity,hold",
        },
        async (game) => {
          // A line of one: a funnel, woken and fed, beside her.
          const funnel = await running(game, FixtureType.Funnel);
          // The blueprint beside it, woken with the fold: it draws the funnel.
          expect(await takeFromCrate(game, FixtureType.Blueprint)).toBe(true);
          await game.settle(400);
          const easel = await game.squareBeside();
          await game.tapCell(easel.col, easel.row);
          await game.settle(500);
          await game.tapCell(easel.col, easel.row);
          await game.settle(400);
          await game.solveSymmetry();
          await game.settle(400);
          const drawings =
            await game.seam<Record<string, { machines: { type: string }[] }>>("blueprints");
          const drawn = drawings[`${easel.col},${easel.row}`];
          expect({ drawings, types: drawn?.machines.map((one) => one.type) }).toEqual({
            drawings,
            types: [FixtureType.Funnel],
          });

          // Picked up with a tap, and stamped down far enough away that the
          // copy's square is free: the drawing's funnel stands at the same
          // offset from the stamp as the real one does from the easel.
          await game.tapCell(easel.col, easel.row);
          await game.settle(400);
          expect(await game.seam<string | null>("armed")).toBe(FixtureType.Blueprint);
          // A square within reach whose copy would land on bare ground: the
          // garden has a fence round it, and a copy stamped onto the fence
          // is refused whole, which is right and is not what this is about.
          const here = await game.where();
          const offset = { col: funnel.col - easel.col, row: funnel.row - easel.row };
          let stamp: { col: number; row: number } | null = null;
          for (const [dCol, dRow] of [
            [0, -3],
            [0, 3],
            [-3, 0],
            [3, 0],
            [-2, -2],
            [2, 2],
          ] as const) {
            const at = { col: here.col + dCol, row: here.row + dRow };
            const free = await game.objectOn(at.col + offset.col, at.row + offset.row);
            if (free === null) {
              stamp = at;
              break;
            }
          }
          if (!stamp) throw new Error("nowhere within reach to stamp the drawing");
          const beams = await game.held("beam");
          await game.tapCell(stamp.col, stamp.row);
          await game.settle(600);
          const copyAt = { col: stamp.col + offset.col, row: stamp.row + offset.row };
          expect(await game.objectOn(copyAt.col, copyAt.row)).toBe(FixtureType.Funnel);
          // Paid for out of the basket, and counted by the drawing.
          expect(await game.held("beam")).toBeLessThan(beams);
          const stamped = (await machines(game)).find(
            (one) => one.where === `${easel.col},${easel.row}`,
          );
          expect(stamped?.rung).toBe(1);
          // The mechanic's last job is done by it.
          expect((await game.seam<{ done: string[] }>("jobs")).done).toContain("twice");
        },
      );
    },
    6 * MINUTES,
  );
});
