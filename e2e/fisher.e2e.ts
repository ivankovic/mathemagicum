// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { afterAll, describe, expect, test } from "bun:test";
import { play, shutDown } from "./harness";

const MINUTES = 60_000;

afterAll(shutDown);

/**
 * The fisherman on the quay, and the spell he hands over.
 *
 * The sixth teacher and the second who is met out of doors, which is the
 * half only a browser can check: an outdoor teacher answers a tap through
 * his own sprite while he walks a circuit, and an indoor one is simply
 * standing on a cell of a room. Wiring one up like the other is a man who
 * cannot be spoken to — which is exactly what happened first.
 */
const QUAY = "&hour=12&freezeNpcs";

describe("learning to share out a catch", () => {
  test(
    "he is on the quay, and speaking to him teaches it",
    async () => {
      await play({ seams: QUAY }, async (game) => {
        const npcs = await game.seam<Record<string, { col: number; row: number }>>("npcs");
        const him = npcs.fisher;
        if (!him) throw new Error("this harbour has no fisherman");

        await game.reload(`${QUAY}&at=${him.col},${him.row + 1}`);
        await game.settle(600);
        // Not learned yet: the rune is drawn in the book and refuses.
        await game.tap("spellbook");
        await game.settle(300);
        expect(await game.tap("spellbook.4")).toBe(true);
        await game.settle(400);
        expect(await game.seam("marking")).toBeNull();

        await game.press("Escape");
        await game.tapNear(0, -1);
        // Long enough for the rune to rise over her head and his lesson to
        // follow it.
        await game.settle(2600);
        expect(await game.seam<unknown>("share")).toBeNull();
        await game.press("Escape");
        await game.settle(400);

        // And now the rune arms, which is what "learned" looks like from
        // outside: marking begins and the ground is ruled off round her.
        // No menu, unlike the times rune — this spell does one thing.
        await game.tap("spellbook");
        await game.settle(300);
        await game.tap("spellbook.4");
        await game.settle(500);
        expect(await game.seam("marking")).toBe("pick");
      });
    },
    5 * MINUTES,
  );
});
