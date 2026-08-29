// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { afterAll, describe, expect, test } from "bun:test";
import { TURNS, Turn } from "../src/world/facing";
import { FixtureType } from "../src/world/fixtures";
import { type Game, play, shutDown, takeFromCrate } from "./harness";

const MINUTES = 60_000;

afterAll(shutDown);

/**
 * Turning a thing round before putting it down.
 *
 * Reported from a playtest: there is no way to rotate objects when placing
 * them. The control is the picture of what she is holding — tapping it turns
 * the thing, and the picture turns with it, so the preview *is* the answer.
 *
 * `facing.test.ts` proves the arithmetic of four ways round from three
 * drawings. What only a browser can say is that the tap reaches the control
 * at all, and that took two goes: a tap while something is armed is handled
 * before the "a button takes its own tap" check, so it fell straight through
 * to the placement and put the bench on the ground; and turning used to
 * destroy the picture and raise another, which meant the scene compared the
 * tap against a different object from the one the pointer had hit.
 */
const GARDEN = "&hour=12&freezeNpcs&learned=all";

/** A few benches to put down, without walking her to the shop for them. */
async function withBenches(game: Game): Promise<void> {
  await game.tab.evaluate(() => {
    const handle = (globalThis as never as Record<string, Record<string, unknown>>).__mathemagicum;
    if (!handle) throw new Error("the game has not put its handle out");
    (handle.session as { inventory: { add: (item: string, n: number) => void } }).inventory.add(
      "bench",
      8,
    );
  });
}

/** Every bench standing in the world, and which way round each went down. */
function benches(game: Game): Promise<{ col: number; turn: number }[]> {
  return game.tab.evaluate(() => {
    const handle = (globalThis as never as Record<string, Record<string, unknown>>).__mathemagicum;
    if (!handle) throw new Error("the game has not put its handle out");
    const session = handle.session as {
      grid: { listObjects: () => { type: string; col: number; turn?: number }[] };
    };
    return session.grid
      .listObjects()
      .filter((one) => one.type === "bench")
      .map((one) => ({ col: one.col, turn: one.turn ?? 0 }))
      .sort((a, b) => a.col - b.col);
  });
}

/** Tap the picture over her head until it is the way round we want. */
async function turnTo(game: Game, want: number): Promise<void> {
  for (let taps = 0; taps <= TURNS.length; taps++) {
    if ((await game.seam<number>("armedTurn")) === want) return;
    const at = (await game.ui()).armed;
    if (!at) throw new Error("nothing is in her hands to turn");
    await game.tab.mouse.click(at.x, at.y);
    await game.tab.waitForTimeout(200);
  }
  throw new Error(`the bench would not turn to ${want}`);
}

describe("turning a thing before putting it down", () => {
  test(
    "the picture over her head turns, and turning it does not put it down",
    async () => {
      await play({ seams: GARDEN }, async (game) => {
        await withBenches(game);
        await takeFromCrate(game, FixtureType.Bench);
        await game.settle(250);
        expect(await game.seam<number>("armedTurn")).toBe(Turn.Toward);

        // Round once, a tap at a time, and still in her hands at the end.
        // That second half is the bug this scenario was written for: the tap
        // used to reach the ground and place it.
        const seen: number[] = [];
        for (let tap = 0; tap < TURNS.length; tap++) {
          const at = (await game.ui()).armed;
          if (!at) throw new Error("nothing is in her hands");
          await game.tab.mouse.click(at.x, at.y);
          await game.tab.waitForTimeout(200);
          seen.push(await game.seam<number>("armedTurn"));
          expect(await game.seam<string | null>("armed")).toBe(FixtureType.Bench);
        }
        // Every way round, and back where it started.
        expect(seen.slice(0, -1).sort()).toEqual([Turn.Away, Turn.Side, Turn.SideOther]);
        expect(seen.at(-1)).toBe(Turn.Toward);
        expect(await benches(game)).toEqual([]);
      });
    },
    5 * MINUTES,
  );

  test(
    "and the way round it went down is still true tomorrow",
    async () => {
      await play({ seams: GARDEN }, async (game) => {
        await withBenches(game);
        const me = await game.where();
        for (const turn of TURNS) {
          await takeFromCrate(game, FixtureType.Bench);
          await game.settle(200);
          await turnTo(game, turn);
          await game.tapCell(me.col - 2 + turn, me.row + 2);
          await game.settle(300);
        }
        const down = await benches(game);
        expect(down.map((one) => one.turn)).toEqual([...TURNS]);

        // The half that catches a save which drops it. A placed object is
        // stored as a difference against what the generator would have made,
        // and the turn only counts as a difference if the signature says so.
        await game.reload(GARDEN);
        await game.settle(600);
        expect(await benches(game)).toEqual(down);
      });
    },
    5 * MINUTES,
  );
});
