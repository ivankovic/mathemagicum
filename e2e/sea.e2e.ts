// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { afterAll, describe, expect, test } from "bun:test";
import { type Game, play, shutDown } from "./harness";

const MINUTES = 60_000;

afterAll(shutDown);

/**
 * The sea, which is the one thing on screen drawn *under* the ground.
 *
 * A chunk of terrain is baked into a texture once and never touched again —
 * rebaking the ones on screen measured at twenty-odd milliseconds, a dropped
 * frame every tick — so water cannot animate by being redrawn. It animates by
 * being a sprite the chunk is laid over, with the open water cut out of the
 * chunk and left transparent.
 *
 * That arrangement has an unusually quiet failure. Every half of it can be
 * right on its own — the generator asserts a wave frame plus its cutout is
 * the tile the atlas used to ship, pixel for pixel, and `assets.test.ts`
 * asserts both halves are in the shipped art — while the sea itself is never
 * laid down at all, and what a child sees is a hole in the world where the
 * ocean was. Nothing else in the suite looks at a sprite nobody can walk on.
 *
 * The quay is four hundred tiles from home, so this stands her on the
 * harbour's own doorstep with `?at=` rather than walking there.
 */
const QUAY = "&hour=12&learned=all&freezeNpcs";

interface Sea {
  tiles: number;
  phase: number;
  showing: readonly string[];
  sample: readonly string[];
}

async function toTheQuay(game: Game): Promise<void> {
  const doors = await game.seam<Record<string, { col: number; row: number }>>("doors");
  const door = Object.entries(doors).find(([id]) => id.startsWith("harbour-"))?.[1];
  if (!door) throw new Error("this world's harbour has no buildings on it");
  await game.reload(`${QUAY}&at=${door.col},${door.row + 1}`);
  await game.settle(1200);
}

describe("the sea", () => {
  test(
    "is laid under the harbour, and does not stand still",
    async () => {
      await play({ seams: QUAY }, async (game) => {
        // Home is inland, and the point of saying so is that the sea is not
        // simply always there — a chunk with no water in it lays none, which
        // is what keeps a meadow from paying for an ocean.
        expect((await game.seam<Sea>("sea")).tiles).toBe(0);

        await toTheQuay(game);
        const first = await game.seam<Sea>("sea");
        expect(first.tiles).toBeGreaterThan(50);

        // Not all on the same picture. A sea stepping in unison reads as the
        // screen flickering rather than as water, so each tile's phase is
        // offset by where it is — and a hash that collapsed would give a
        // sea that still moved and still looked wrong.
        expect(first.showing.length).toBeGreaterThan(1);
        for (const frame of first.showing) expect(frame).toMatch(/^wave_\d+_\d+$/);

        // And a second later those same tiles are showing something else.
        // Named tiles rather than the set of frames on screen: with this much
        // sea in view every frame there is is showing somewhere at any
        // moment, so the set is the same before and after and would go on
        // being the same if the whole ocean froze.
        //
        // Asserted on the frames rather than on the phase counter, too, since
        // a counter that ticked while nothing was repainted is the bug.
        await game.settle(1000);
        const later = await game.seam<Sea>("sea");
        expect(later.sample).not.toEqual(first.sample);
        expect(later.sample.length).toBe(first.sample.length);
      });
    },
    5 * MINUTES,
  );
});
