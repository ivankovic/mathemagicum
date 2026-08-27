// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { afterAll, describe, expect, test } from "bun:test";
import { play, shutDown } from "./harness";

const MINUTES = 60_000;

afterAll(shutDown);

/**
 * The division spell's parchment, driven by a finger.
 *
 * `division.test.ts` proves the rules — what a rung sets, which boxes are
 * asked, how the help climbs — and none of that says the keypad reaches
 * them. This is the half only a browser can answer: that the parchment opens,
 * that typing goes into the box the child is looking at, and that answering
 * ends the cast.
 *
 * Opened by `?share=`, because nothing in the game casts it yet: the spell's
 * world half is not written. That seam is the whole reason the parchment can
 * be tested at all before there is a garden behind it.
 */
interface Share {
  readonly total: number;
  readonly parts: number;
  readonly each: number;
  readonly left: number;
  readonly box: string;
  readonly boxes: string[];
  readonly typed: { each: string; left: string };
  readonly done: boolean;
  readonly missteps: number;
}

const WATCH = "&hour=12&freezeNpcs";

describe("sharing a heap out", () => {
  test(
    "the parchment opens on the rung it was asked for, and the numbers agree",
    async () => {
      await play({ seams: `${WATCH}&share=2` }, async (game) => {
        await game.settle(700);
        const asked = await game.seam<Share>("share");
        // The heap is the shares and the leftovers, which is the one thing
        // that has to hold whatever the generator picked.
        expect(asked.each * asked.parts + asked.left).toBe(asked.total);
        // Rung two draws baskets, so the leftovers are on the parchment and
        // are not asked for.
        expect(asked.boxes).toEqual(["each"]);
        expect(asked.left).toBe(0);
      });
    },
    5 * MINUTES,
  );

  test(
    "answering it finishes the cast",
    async () => {
      await play({ seams: `${WATCH}&share=2` }, async (game) => {
        await game.settle(700);
        const asked = await game.seam<Share>("share");
        await game.type(asked.each);
        await game.press("Enter");
        // The parchment holds a beat with every basket filled and then goes.
        // Which side of that beat this lands on is a race — the beat is
        // shorter than a settle — so it is read as "if it is still up, it
        // says it is done", and the closing is asserted below.
        const beat = await game.seam<Share | null>("share");
        if (beat)
          expect({ done: beat.done, missteps: beat.missteps }).toEqual({
            done: true,
            missteps: 0,
          });
        await game.settle(900);
        // And it is gone. Nothing else here closes it: a wrong answer never
        // does, and nobody pressed escape — so a shut parchment is a solved
        // one.
        expect(await game.seam<Share | null>("share")).toBeNull();
      });
    },
    5 * MINUTES,
  );

  /**
   * A wrong answer costs nothing but is not free either.
   *
   * Nothing fails — the box clears and the child goes again — and one more
   * basket is dealt out for them. What this cannot check from here is that
   * the *last* basket is never dealt; that is `division.test.ts`'s, and it
   * checks it over every rung.
   */
  test(
    "a wrong answer clears the box and deals another basket",
    async () => {
      await play({ seams: `${WATCH}&share=2` }, async (game) => {
        await game.settle(700);
        const asked = await game.seam<Share>("share");
        const wrong = asked.each === 9 ? 8 : 9;
        await game.type(wrong);
        await game.press("Enter");
        const after = await game.seam<Share>("share");
        expect({ done: after.done, typed: after.typed.each, missteps: after.missteps }).toEqual({
          done: false,
          typed: "",
          missteps: 1,
        });
        // And it is still answerable. Read the way the closing is read above:
        // the beat the finished parchment holds is shorter than a settle.
        await game.type(asked.each);
        await game.press("Enter");
        await game.settle(900);
        expect(await game.seam<Share | null>("share")).toBeNull();
      });
    },
    5 * MINUTES,
  );

  /**
   * The top rung asks both, and the leftovers box takes a nought.
   *
   * Two boxes and two different rules about the digit nought — no share is
   * nothing, a leftover very often is — which is the one place this spell's
   * keypad is not the array spell's with a different name on it.
   */
  test(
    "where nothing is drawn, the leftovers are asked for too",
    async () => {
      await play({ seams: `${WATCH}&share=5` }, async (game) => {
        await game.settle(700);
        const asked = await game.seam<Share>("share");
        expect(asked.boxes).toEqual(["each", "left"]);

        await game.type(asked.each);
        await game.press("Enter");
        // Answering the share moves on rather than answering the question: a
        // child who has said half of it has not been wrong about anything.
        const half = await game.seam<Share>("share");
        expect({ done: half.done, box: half.box, missteps: half.missteps }).toEqual({
          done: false,
          box: "left",
          missteps: 0,
        });

        await game.type(asked.left);
        await game.press("Enter");
        await game.settle(900);
        expect(await game.seam<Share | null>("share")).toBeNull();
      });
    },
    5 * MINUTES,
  );
});
