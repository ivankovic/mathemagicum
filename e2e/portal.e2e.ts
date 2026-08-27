// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { afterAll, describe, expect, test } from "bun:test";
import { PortalTier, portalRungAt, zoomsFor } from "../src/spells/portal";
import { Spell } from "../src/spells/spellbook";
import { play, runeButton, shutDown } from "./harness";

const MINUTES = 60_000;

afterAll(shutDown);

/**
 * The map is ruled afresh every time it is opened.
 *
 * The one thing about this spell that a unit test cannot show, because what
 * it is really about is *two casts*: the places do not move and the child
 * does not move, so if the ruler did not move either, the distance from here
 * to the harbour would be the same number every time it was ever asked. A
 * child does not have to measure something they have measured once — they
 * only have to remember it, which is the opposite of what the spell teaches.
 *
 * So this opens the same map, picks the same place, and reads what the game
 * says about it, over and over. Nothing is typed and nothing travels: the
 * parchment is dismissed each time, which leaves her standing exactly where
 * she was and makes the ruler the only thing that could have changed.
 */

interface Journey {
  place: string;
  league: number;
  tier: string;
  across: number;
  down: number;
  answer: number;
}

/** The rung this is cast at: read both legs and add them, on a coarse map. */
const RUNG = 3;

describe("the same journey, twice", () => {
  test(
    "the map is ruled differently each time it is opened",
    async () => {
      await play(
        { seams: `&learned=all&reached=all&freezeNpcs&hour=12&portalRung=${RUNG}` },
        async (game) => {
          const stood = await game.where();
          const seen: Journey[] = [];
          let place: string | null = null;
          for (let go = 0; go < 10; go++) {
            await game.tap("spellbook");
            await game.tap(runeButton(Spell.Portal));
            await game.settle(400);
            const marks = await game.seam<Record<string, { x: number; y: number }>>("portalMarks");
            // The same place every time, and the first one that is offered:
            // which place it is does not matter, that it is the *same* one
            // does. Read off the map rather than named here, because the
            // world is generated and a place written into a scenario is a
            // place that may not be on the map tomorrow.
            place ??= Object.keys(marks).find((one) => one !== "village") ?? null;
            const at = place ? marks[place] : undefined;
            if (!at) throw new Error("the map offered nowhere to go");
            await game.tab.mouse.click(at.x, at.y);
            await game.settle(400);
            const journey = await game.seam<Journey | null>("portal");
            if (!journey) throw new Error("nothing was measured");
            seen.push(journey);
            // Away without travelling, so she is where she started for the
            // next one and the ruler is the only thing that has moved.
            await game.press("Escape");
            await game.settle(400);
          }

          expect(await game.where()).toEqual(stood);
          expect(seen.every((one) => one.place === place)).toBe(true);

          // Every ruler is one this rung owns...
          const zooms = zoomsFor(portalRungAt(RUNG));
          for (const one of seen) expect(zooms).toContain(one.league);
          // ...more than one of them was reached in ten casts...
          expect(new Set(seen.map((one) => one.league)).size).toBeGreaterThan(1);
          // ...and the number the child has to say moved with it, which is
          // the whole point: the ruler changing without the answer changing
          // would be a cosmetic difference.
          expect(new Set(seen.map((one) => one.answer)).size).toBeGreaterThan(1);

          // And it is still the same question, measured on a different
          // ruler: this rung adds the two legs, at every zoom.
          for (const one of seen) {
            expect(one.tier).toBe(PortalTier.Add);
            expect(one.answer).toBe(one.across + one.down);
          }
        },
      );
    },
    5 * MINUTES,
  );
});
