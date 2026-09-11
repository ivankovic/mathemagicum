// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { afterAll, describe, expect, test } from "bun:test";
import { Spell, TAUGHT_BESIDE } from "../src/spells/spellbook";
import { UiAsset } from "../src/ui/assets";
import { RUNE_OF } from "../src/ui/runes";
import { FLOWER_TYPES } from "../src/world/flowers";
import { play, runeButton, seedButton, shutDown } from "./harness";

const MINUTES = 60_000;

afterAll(shutDown);

/**
 * Saying no by saying where, which is the only kind of no a child can use.
 *
 * These three lived at the bottom of `flowers.e2e.ts` and were split out of
 * it, for a reason that is about the runner rather than about them: `run.ts`
 * gives every file its own process, and nine scenarios in one process is one
 * more than this machine finishes. The ninth — whichever it happened to be —
 * spent three minutes waiting for a scene that never started, and it was the
 * ninth and not the wrong one. Two files of four and five each is the whole
 * fix, and it costs a build that was already shared.
 *
 * They belong together in any case: a crossed-out picture says *no* and
 * stops, which to a child who cannot read is a button that does not work.
 * Both of these say where instead — the spell points at the thing you walk
 * towards to be taught it, and the flower shows what it looks like growing
 * so she knows what she is looking for.
 *
 * Through the seam and not a screenshot, for the reason the ground hint in
 * `flowers.e2e.ts` is: the cloud fades in four hundred milliseconds and
 * every tap helper in the harness waits five hundred before it looks, so a
 * picture taken the obvious way is a picture of an empty field.
 */
describe("being told where to go", () => {
  test(
    "a spell nobody has taught her points at where she can be",
    async () => {
      await play({ seams: "&hour=12&freezeNpcs" }, async (game) => {
        await game.tap("spellbook");
        await game.tap(runeButton(Spell.Logic));

        const thought = await game.seam<{ icons: string[]; crossed: boolean } | null>("thought");
        if (!thought) throw new Error("the unlearned rune said nothing");
        expect(thought.crossed).toBe(false);
        const sight = TAUGHT_BESIDE[Spell.Logic];
        if (!sight) throw new Error("the logic spell has nowhere to be learned");
        expect(thought.icons).toEqual([sight, UiAsset.MarkQuestion]);
        // Not the rune she just tapped, which is the thing she already knows.
        expect(thought.icons).not.toContain(RUNE_OF[Spell.Logic]);
      });
    },
    5 * MINUTES,
  );

  test(
    "and each spell points somewhere of its own",
    async () => {
      await play({ seams: "&hour=12&freezeNpcs" }, async (game) => {
        const seen: string[] = [];
        for (const spell of [Spell.Share, Spell.Hourglass, Spell.Array]) {
          await game.tap("spellbook");
          await game.tap(runeButton(spell));
          const thought = await game.seam<{ icons: string[] } | null>("thought");
          seen.push(thought?.icons[0] ?? "nothing");
          await game.settle(700);
        }
        // Three different sights. A single fallback picture for every
        // unlearned spell would satisfy the test above and tell a child
        // nothing, which is the failure worth guarding.
        expect(new Set(seen).size).toBe(seen.length);
        expect(seen).not.toContain("nothing");
      });
    },
    5 * MINUTES,
  );

  test(
    "and a flower she has not found shows what to look for",
    async () => {
      await play({ seams: "&hour=12&freezeNpcs" }, async (game) => {
        const flower = FLOWER_TYPES[0];
        if (!flower) throw new Error("no flowers in this game");
        await game.tap("seeds");
        await game.tap(seedButton(flower));

        const thought = await game.seam<{ icons: string[]; crossed: boolean } | null>("thought");
        if (!thought) throw new Error("the unfound flower said nothing");
        expect(thought.crossed).toBe(false);
        expect(thought.icons).toEqual([flower, UiAsset.MarkQuestion]);
      });
    },
    5 * MINUTES,
  );
});
