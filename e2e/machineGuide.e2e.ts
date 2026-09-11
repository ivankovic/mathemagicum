// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { afterAll, describe, expect, test } from "bun:test";
import { Guide, MACHINE_GUIDES } from "../src/ui/guide";
import { CRATE_WIRE } from "../src/world/crate";
import { FixtureType } from "../src/world/fixtures";
import { type Game, play, shutDown, takeFromCrate } from "./harness";

const MINUTES = 60_000;

afterAll(shutDown);

/**
 * The machine tutorial: the crate to the square, the sleeping machine, its
 * mouth, and then the coil between two of them.
 *
 * Reported from a playthrough as *I am trying to build the machines and I
 * have no idea what I am supposed to do*. `guide.test.ts` proves the steps
 * come in the right order for the right deeds; what it cannot prove is that
 * the ring lands on the makers' button and not beside it, that tapping the
 * picture of a sorter is the deed the guide was waiting for, or that a
 * second machine built without the guide still leaves the coil pointed at
 * once there are two to join. Those are the scene's, and this is where the
 * scene is running.
 *
 * Opened with every guide *before* the machines already given, so the first
 * thing pointed at is the crate rather than the pouch, and with enough in
 * the basket for two sorters and something left to tip into one of them.
 * The spells are given too: a sorter asks to be shown the sharing sum, and a
 * child who has not been to the lighthouse is sent there instead of being
 * asked — which is right, and is a different scenario.
 */
const A_LINE_TO_BUILD =
  "&materials=40&hour=12&freezeNpcs&seed=7&learned=all&guided=plant,grow,pick,sell,learn,place,grove";

interface GuideSeam {
  running: string | null;
  step: number | null;
  cue: { kind: string; name?: string } | null;
  marks: {
    ring: { x: number; y: number } | null;
    arrow: { x: number; y: number } | null;
    trail: number;
  };
  done: string[];
}

interface Machine {
  awake: boolean;
  holding: string | null;
  heap: number;
}

const guide = (game: Game) => game.seam<GuideSeam>("guide");

/** Whether two screen points are the same place, to the pixel a ring breathes by. */
function near(
  a: { x: number; y: number } | null,
  b: { x: number; y: number } | undefined,
): boolean {
  return a !== null && b !== undefined && Math.abs(a.x - b.x) < 2 && Math.abs(a.y - b.y) < 2;
}

/** Wait until the guide is at a step, or say where it got stuck. */
async function reaches(game: Game, running: string, step: number): Promise<GuideSeam> {
  let seen = await guide(game);
  for (let tries = 0; tries < 20 && !(seen.running === running && seen.step === step); tries++) {
    await game.settle(150);
    seen = await guide(game);
  }
  if (seen.running !== running || seen.step !== step) {
    throw new Error(`the guide is at ${JSON.stringify(seen)}, not ${running} step ${step}`);
  }
  return seen;
}

/** Wake the machine on a square with the one sum it asks for. */
async function wake(game: Game, at: { col: number; row: number }): Promise<void> {
  await game.tapCell(at.col, at.row);
  await game.settle(400);
  await game.solveShare();
  await game.settle(500);
}

describe("the machine tutorial", () => {
  test(
    "walks the crate to a machine, wakes it, feeds it, and joins it to a second",
    async () => {
      await play({ seams: A_LINE_TO_BUILD, firstTime: true }, async (game) => {
        // The crate, lit: she can pay for a sorter and has never opened
        // the makers. The ring is on the crate's own button, read off the
        // same seam a script taps it by.
        let seen = await reaches(game, Guide.Build, 0);
        expect(seen.cue).toEqual({ kind: "button", name: "crate" });
        expect(near(seen.marks.ring, (await game.ui()).crate)).toBe(true);
        await game.tap("crate");
        await game.settle(300);

        // Then the makers, which is the group nobody opened.
        seen = await reaches(game, Guide.Build, 1);
        expect(seen.cue).toEqual({ kind: "crate-makers" });
        expect(near(seen.marks.ring, (await game.ui())["crate.makers"])).toBe(true);
        await game.tap("crate.makers");
        await game.settle(300);

        // Then the machine itself. Tapping the picture is what builds it.
        seen = await reaches(game, Guide.Build, 2);
        expect(seen.cue).toEqual({ kind: "crate-machine" });
        expect(near(seen.marks.ring, (await game.ui())[`crate.${FixtureType.Sorter}`])).toBe(true);
        await game.tap(`crate.${FixtureType.Sorter}`);
        await game.settle(400);
        expect(await game.held(FixtureType.Sorter)).toBe(1);

        // And the square in front of her, with an arrow over it.
        seen = await reaches(game, Guide.Build, 3);
        expect(seen.cue).toEqual({ kind: "ahead" });
        expect(seen.marks.arrow).not.toBeNull();
        const first = await game.squareBeside();
        await game.tapCell(first.col, first.row);
        await game.settle(500);
        expect(await game.objectOn(first.col, first.row)).toBe(FixtureType.Sorter);
        expect((await guide(game)).done).toContain(Guide.Build);

        // Asleep, and pointed at until it is woken with its sum.
        seen = await reaches(game, Guide.Wake, 0);
        expect(seen.cue).toEqual({ kind: "sleeping-machine" });
        expect(seen.marks.arrow).not.toBeNull();
        await wake(game, first);
        expect((await guide(game)).done).toContain(Guide.Wake);

        // Awake with an empty mouth, and she is carrying timber it takes.
        seen = await reaches(game, Guide.Feed, 0);
        expect(seen.cue).toEqual({ kind: "hungry-machine" });
        expect(seen.marks.arrow).not.toBeNull();

        // A second machine, built without any guide: building was given
        // once, and a child who has made one knows how. The feeding errand
        // is not pushed aside by it either — one guide at a time.
        expect(await takeFromCrate(game, FixtureType.Sorter)).toBe(true);
        await game.settle(400);
        const second = await game.squareBeside();
        await game.tapCell(second.col, second.row);
        await game.settle(500);
        expect(await game.objectOn(second.col, second.row)).toBe(FixtureType.Sorter);
        await wake(game, second);
        expect((await guide(game)).running).toBe(Guide.Feed);

        // Fed: the biggest heap she carries goes in, and the errand is done.
        await game.tapCell(first.col, first.row);
        await game.settle(500);
        const machines = await game.seam<Machine[]>("machines");
        expect(machines.some((one) => one.awake && one.heap > 0)).toBe(true);
        expect((await guide(game)).done).toContain(Guide.Feed);

        // Two awake machines beside each other and nothing between them:
        // the coil. The crate may already be open on the makers from the
        // second sorter, in which case those steps are skipped as done, so
        // the walk follows whichever cue is up rather than assuming.
        for (let taps = 0; taps < 4; taps++) {
          seen = await guide(game);
          if (seen.running !== Guide.Wire) {
            await game.settle(200);
            continue;
          }
          if (seen.cue?.kind === "button") await game.tap("crate");
          else if (seen.cue?.kind === "crate-makers") await game.tap("crate.makers");
          else break;
          await game.settle(300);
        }
        seen = await reaches(game, Guide.Wire, 2);
        expect(seen.cue).toEqual({ kind: "crate-coil" });
        expect(near(seen.marks.ring, (await game.ui())[`crate.${CRATE_WIRE}`])).toBe(true);
        await game.tap(`crate.${CRATE_WIRE}`);
        await game.settle(300);

        // One end, then the other, an arrow for each.
        seen = await reaches(game, Guide.Wire, 3);
        expect(seen.cue).toEqual({ kind: "wire-from" });
        expect(seen.marks.arrow).not.toBeNull();
        await game.tapCell(first.col, first.row);
        await game.settle(400);
        seen = await reaches(game, Guide.Wire, 4);
        expect(seen.cue).toEqual({ kind: "wire-to" });
        expect(seen.marks.arrow).not.toBeNull();
        await game.tapCell(second.col, second.row);
        await game.settle(500);

        const wires = await game.seam<{ from: string; to: string }[]>("wires");
        expect(wires).toHaveLength(1);
        const after = await guide(game);
        expect(after.done).toContain(Guide.Wire);
        // Nothing has been dealt yet, so there is nothing to take out, and
        // the guide for taking waits for that rather than pointing at an
        // empty crate.
        expect(after.done).not.toContain(Guide.Take);
        expect(after.running).toBe(null);
      });
    },
    5 * MINUTES,
  );
});

/**
 * The row on the debug sheet that gives the machines again, and only them.
 *
 * The row above it forgets every guide, which is right for a younger
 * sibling and wrong for the child stuck at the sorter: what she needs shown
 * again is the machines, and starting from the pouch would be a walk through
 * everything she already knows first.
 */
describe("asking for the machine tutorial again", () => {
  test(
    "forgets the machine guides, keeps the rest, and starts the machines again",
    async () => {
      await play(
        {
          seams:
            "&materials=20&hour=12&freezeNpcs&seed=7&learned=all&guided=grow,pick,sell,learn,place,grove",
          firstTime: true,
        },
        async (game) => {
          // Planting, for real, so the child has one guide of her own that
          // is not about machines.
          await reaches(game, Guide.Plant, 0);
          await game.tap("seeds");
          await game.settle(300);
          await game.tap("seeds.0");
          await game.settle(300);
          const bed = await game.squareBeside();
          await game.tapCell(bed.col, bed.row);
          await game.settle(600);
          expect((await guide(game)).done).toContain(Guide.Plant);

          // And building, for real, so there is a machine guide to forget.
          // Not on the bed: a seedling is not an *object*, so the square
          // beside her still counts as empty, and a sorter put down on a
          // seedling is refused.
          await reaches(game, Guide.Build, 0);
          expect(await takeFromCrate(game, FixtureType.Sorter)).toBe(true);
          await game.settle(400);
          const here = await game.where();
          const at = { col: here.col - 1, row: here.row };
          expect(at).not.toEqual(bed);
          expect(await game.objectOn(at.col, at.row)).toBe(null);
          await game.tapCell(at.col, at.row);
          await game.settle(600);
          expect(await game.objectOn(at.col, at.row)).toBe(FixtureType.Sorter);
          expect((await guide(game)).done).toEqual([Guide.Plant, Guide.Build]);

          await game.tap("options");
          await game.settle(500);
          await game.tap("about");
          await game.settle(600);
          await game.tap("about.title");
          await game.settle(500);
          // The ninth row, by position, the way the whole tutorial is the
          // eighth.
          expect(await game.tap("debug.8")).toBe(true);
          await game.settle(400);
          await game.press("Escape");
          await game.settle(600);

          const after = await guide(game);
          expect(after.done).toEqual([Guide.Plant]);
          for (const machine of MACHINE_GUIDES) expect(after.done).not.toContain(machine);
          // Started again from wherever the machines are: she cannot pay for
          // another sorter, so the first errand worth giving is the one
          // standing asleep beside her.
          expect(after.running).toBe(Guide.Wake);
        },
      );
    },
    5 * MINUTES,
  );
});
