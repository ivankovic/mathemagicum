// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { afterAll, describe, expect, test } from "bun:test";
import { FLOWER_LOOKS, FLOWER_TYPES } from "../src/world/flowers";
import { type Game, play, shutDown } from "./harness";

const MINUTES = 60_000;

afterAll(shutDown);

/**
 * Flowers: found on the map, then planted in a colour.
 *
 * The one thing in this game whose reward is having *gone somewhere*. No
 * sum, no money, no errand — three plants grow wild on a five-hundred-square
 * world and a child has to walk into them.
 *
 * Which is also why every one of these scenarios reads where they are off
 * the world rather than knowing it: the spots are drawn from the world's
 * seed out of every cell the connectivity pass proved walkable, so they are
 * a different answer in every world and a hard-coded one would be a
 * scenario that passed on one seed.
 */

interface Flowers {
  wild: { flower: string; col: number; row: number }[];
  found: string[];
  planted: { flower: string; look: number; col: number; row: number }[];
}

/** The first of the three, and where it grew. */
async function aWildOne(game: Game): Promise<{ flower: string; col: number; row: number }> {
  const seen = await game.seam<Flowers>("flowers");
  const first = seen.wild[0];
  if (!first) throw new Error("this world grew no flowers");
  return first;
}

describe("finding a flower", () => {
  /**
   * Walk into it, and the kind of it is yours.
   *
   * Not one seed: a child who has walked to the far side of the world for a
   * tulip has earned tulips, plural, and being handed exactly one to spend
   * once would turn a discovery into an errand. So the check is that the
   * pouch opens on colours afterwards, and keeps doing so.
   */
  test(
    "picking the wild one unlocks planting that kind",
    async () => {
      await play({ seams: "&hour=12&freezeNpcs" }, async (game) => {
        const wild = await aWildOne(game);
        expect((await game.seam<Flowers>("flowers")).found).toEqual([]);

        // `?at=` rather than walking: it is four hundred tiles away, and
        // that it is reachable at all is what `assets.test.ts` checks.
        await game.reload(`&hour=12&freezeNpcs&at=${wild.col},${wild.row + 1}`);
        await game.tapNear(0, -1);
        await game.settle(700);
        expect((await game.seam<Flowers>("flowers")).found).toEqual([wild.flower]);

        // And it is still standing there. Picking it would make the world a
        // little emptier every time somebody explored it.
        const still = await game.seam<Flowers>("flowers");
        expect(still.wild.map((one) => one.flower)).toEqual([...FLOWER_TYPES]);

        // Kept, too: a discovery that had to be made again after a reload
        // would be a discovery worth nothing.
        await game.reload();
        expect((await game.seam<Flowers>("flowers")).found).toEqual([wild.flower]);
      });
    },
    5 * MINUTES,
  );

  /**
   * And until she has, the button is drawn and does nothing.
   *
   * Drawn rather than left out, which is the offer the spellbook makes with
   * its unlearned runes: a pouch with a gap in it says there is something to
   * find. So the tap has to *land* — asserted, because a check that only
   * looked at whether the colours opened would pass just as well if the tap
   * had missed the pouch altogether.
   */
  test(
    "but the pouch offers nothing to plant before that",
    async () => {
      await play({ seams: "&hour=12&freezeNpcs" }, async (game) => {
        await game.tap("seeds");
        expect(await game.tap("seeds.6")).toBe(true);
        await game.settle(500);
        const menu = await game.ui();
        expect(Object.keys(menu).filter((name) => name.startsWith("bloom."))).toEqual([]);
        expect((await game.seam<Flowers>("flowers")).planted).toEqual([]);
      });
    },
    5 * MINUTES,
  );
});

describe("planting one", () => {
  /**
   * Two taps: which flower, then which colour.
   *
   * The same order the store settled on — a child decides what they are
   * doing and then goes and does it — and it means the five colours are
   * offered as five pictures of the flower rather than as a colour chart.
   */
  test(
    "in whichever of the five colours she picks",
    async () => {
      await play({ seams: "&hour=12&freezeNpcs&flowers=all" }, async (game) => {
        await game.tap("seeds");
        // Six crops, then the three flowers — appended, so no crop moved.
        await game.tap("seeds.6");
        await game.settle(400);
        const menu = await game.ui();
        expect(Object.keys(menu).filter((name) => name.startsWith("bloom."))).toHaveLength(
          FLOWER_LOOKS,
        );

        await game.tap("bloom.3");
        await game.settle(700);
        const seen = await game.seam<Flowers>("flowers");
        expect(seen.planted).toHaveLength(1);
        expect(seen.planted[0]?.flower).toBe(FLOWER_TYPES[0] as string);
        expect(seen.planted[0]?.look).toBe(3);
      });
    },
    5 * MINUTES,
  );

  /**
   * As many as she likes, and they stay planted.
   *
   * Finding earns the kind rather than a seed, so a bed can be as long as
   * she wants it — and a bed that vanished overnight would be a bed nobody
   * would plant twice.
   */
  test(
    "as many as she likes, and they are there tomorrow",
    async () => {
      await play({ seams: "&hour=12&freezeNpcs&flowers=all" }, async (game) => {
        // Two, in two directions. One would prove nothing about there being
        // no seed to run out of.
        for (const facing of ["ArrowDown", "ArrowUp"]) {
          await game.press(facing);
          await game.settle(300);
          await game.tap("seeds");
          await game.tap("seeds.7");
          await game.settle(350);
          await game.tap("bloom.0");
          await game.settle(600);
        }
        const before = await game.seam<Flowers>("flowers");
        expect(before.planted).toHaveLength(2);
        // Both the same kind and the same colour, which is the point: there
        // was never a seed to spend.
        for (const one of before.planted) {
          expect({ flower: one.flower, look: one.look }).toEqual({
            flower: FLOWER_TYPES[1] as string,
            look: 0,
          });
        }

        // And a bed that vanished overnight is a bed nobody plants twice.
        await game.reload();
        expect((await game.seam<Flowers>("flowers")).planted).toEqual(before.planted);
      });
    },
    5 * MINUTES,
  );
});
