// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { afterAll, describe, expect, test } from "bun:test";
import { AIRSHIP_BUILD, STAGE_COUNT } from "../src/world/airship";
import { type Game, play, shutDown } from "./harness";

const MINUTES = 60_000;

/**
 * Building the thing the whole tree is for.
 *
 * `made=5` hands over five of every made material, which is the seam the
 * machines' own scenarios use — it conjures nothing the tree does not
 * describe, it only saves the forty minutes of pressing that this scenario
 * is not about. `jobs=all` is the mechanic having finished teaching, which
 * is when she starts building instead.
 *
 * What this is really guarding is the *order*. The airship's stages are the
 * one place in the game where a child hands things over and the game has to
 * remember how far she has got across a save — and the failure that would
 * not show up in a unit test is the sheet offering a stage she cannot do,
 * or the parts surviving a reload as a number that no longer adds up.
 */
const READY = "&hour=12&freezeNpcs&made=5&jobs=all";

interface Airship {
  parts: string[];
  stage: string | null;
  done: number;
  wanted: [string, number][];
  flies: boolean;
  flown: boolean;
  flying: boolean;
  zoom: number;
  at: { col: number; row: number };
}

const airship = (game: Game) => game.seam<Airship>("airship");

afterAll(shutDown);

/** Into the garage, from the street outside its door. */
async function intoTheGarage(game: Game): Promise<string> {
  const doors = await game.seam<Record<string, { col: number; row: number }>>("doors");
  const garage = Object.keys(doors).find((id) => id.startsWith("city-garage"));
  if (!garage) throw new Error("this world's city has no garage");
  const door = doors[garage];
  if (!door) throw new Error("the garage has no door");
  await game.reload(`${READY}&at=${door.col},${door.row + 1}`);
  await game.standAt(door.col, door.row + 1, "up");
  for (let go = 0; go < 3; go++) {
    await game.walk("ArrowUp", 700);
    await game.stopped();
    const inside = await game.seam<{ room: string } | null>("inside");
    if (inside?.room === "garage") return garage;
  }
  throw new Error("walking through the garage door did not go indoors");
}

/**
 * Where she is standing, with the teaching already got out of the way.
 *
 * The first tap on her is always the lesson — `learnSpell` reads the
 * child's own list, so `learned=all`, which fills the dev seam's list
 * instead, does not skip it. Every tap after that is the sheet, which is
 * what this file is about.
 */
async function theMechanic(game: Game, garage: string): Promise<{ col: number; row: number }> {
  const npcs = await game.seam<Record<string, { col: number; row: number }>>("npcs");
  const her = npcs[`${garage}-mechanic`];
  if (!her) throw new Error("nobody is behind the bench");
  await game.tapCell(her.col, her.row);
  await game.settle(2200);
  await game.solveLogic();
  await game.settle(500);
  await game.press("Escape");
  await game.settle(400);
  return her;
}

/** One tap on her, and the sheet shut again after it. */
async function askHer(game: Game, her: { col: number; row: number }): Promise<void> {
  await game.tapCell(her.col, her.row);
  await game.settle(900);
  await game.press("Escape");
  await game.settle(300);
}

describe("building the airship", () => {
  test(
    "goes a stage at a time, in order, and then it flies",
    async () => {
      await play({ seams: READY }, async (game) => {
        const garage = await intoTheGarage(game);
        const her = await theMechanic(game, garage);

        // Nothing built, and the first thing she asks for is the keel.
        let seen = await airship(game);
        expect(seen.done).toBe(0);
        expect(seen.stage).toBe(AIRSHIP_BUILD[0]?.stage ?? "keel");
        expect(seen.flies).toBe(false);
        expect(seen.flown).toBe(false);

        // One tap per stage: she takes what the stage wants out of the
        // basket, so a child arriving with everything does not make four
        // journeys for one lesson.
        const stages: string[] = [];
        for (let tap = 0; tap < STAGE_COUNT; tap++) {
          stages.push(seen.stage ?? "nothing");
          await askHer(game, her);
          const after = await airship(game);
          // Forward, every time: a tap that took nothing would leave this
          // equal and the loop would pass by standing still.
          expect(after.done).toBeGreaterThan(seen.done);
          seen = after;
        }
        // And in the order the build lists them, not whichever she had most of.
        expect(stages).toEqual(AIRSHIP_BUILD.map((one) => one.stage));

        expect(seen.done).toBe(STAGE_COUNT);
        expect(seen.flies).toBe(true);
        expect(seen.stage).toBe(null);
        expect(seen.wanted).toEqual([]);
      });
    },
    6 * MINUTES,
  );

  test(
    "and what she has carried up to it is still there tomorrow",
    async () => {
      await play({ seams: READY }, async (game) => {
        const garage = await intoTheGarage(game);
        const her = await theMechanic(game, garage);
        await askHer(game, her);
        const before = await airship(game);
        expect(before.done).toBe(1);
        expect(before.parts.length).toBeGreaterThan(0);

        // The one thing a unit test cannot see: that handing parts over is
        // written down. A build that lived in the scene would come back
        // tomorrow as an empty keel and a basket full of nothing.
        await game.reload(READY);
        await game.settle(900);
        const tomorrow = await airship(game);
        expect(tomorrow.parts).toEqual(before.parts);
        expect(tomorrow.done).toBe(before.done);
        expect(tomorrow.stage).toBe(before.stage);
      });
    },
    6 * MINUTES,
  );
});

/**
 * The ending itself: up, and then home.
 *
 * A screenshot cannot settle any of this — a blimp against a sky looks the
 * same whether it is rising, stuck, or was never told to move — so this
 * asks the seam instead: that the world really is seen from further away
 * while she is up there, that the flight ends rather than parking her in
 * the sky with the controls off, and that she comes down somewhere other
 * than the city she took off from.
 */
describe("flying it", () => {
  test(
    "goes up, pulls the world back, and puts her down at home",
    async () => {
      await play({ seams: READY }, async (game) => {
        const garage = await intoTheGarage(game);
        const her = await theMechanic(game, garage);
        const tookOffAt = (await airship(game)).at;
        const groundZoom = (await airship(game)).zoom;

        for (let tap = 0; tap < STAGE_COUNT - 1; tap++) await askHer(game, her);
        expect((await airship(game)).done).toBe(STAGE_COUNT - 1);

        // The last part is the one that flies it.
        await game.tapCell(her.col, her.row);
        await game.settle(1200);
        const aloft = await airship(game);
        expect(aloft.flown).toBe(true);
        // Up: the world is seen from further away than it is from the ground.
        expect(aloft.flying).toBe(true);
        expect(aloft.zoom).toBeLessThan(groundZoom);

        // And it ends. This is the assertion the whole failsafe exists for:
        // a beat that ran long would leave a child in the sky with the
        // input switched off, which is worse than no ending at all.
        for (let waited = 0; waited < 20 && (await airship(game)).flying; waited++) {
          await game.settle(500);
        }
        const landed = await airship(game);
        expect(landed.flying).toBe(false);
        expect(landed.zoom).toBeGreaterThan(aloft.zoom);
        // Home, which is not the city she took off from.
        expect(landed.at).not.toEqual(tookOffAt);
        // And she can still play: the world takes her taps again.
        expect(await game.seam<{ room: string } | null>("inside")).toBe(null);
      });
    },
    6 * MINUTES,
  );
});
