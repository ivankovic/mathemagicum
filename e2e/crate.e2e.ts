// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { afterAll, describe, expect, test } from "bun:test";
import { CRATE_GROUPS, thingsIn } from "../src/world/crate";
import { DECOR_TYPES } from "../src/world/decor";
import { PLACEABLE_FIXTURES } from "../src/world/fixtures";
import { play, shutDown } from "./harness";

const MINUTES = 60_000;

afterAll(shutDown);

/**
 * The crate in two levels, which is what stops twenty things being a wall.
 *
 * A playtest called the one-level crate clunky. It held twenty buttons and a
 * child looking for a chair had to read past a scarecrow, so it offers three
 * groups and then one group's things.
 *
 * **Its own file, and that is not tidiness.** It began as an eleventh
 * scenario in `house.e2e.ts`, where it timed out at five minutes while
 * passing in twenty seconds on its own — `harness.ts` says why in as many
 * words: *a dozen scenarios in one process is near the edge on four busy
 * cores*. Ten was under it and eleven was not.
 *
 * The failure worth guarding is not the happy path. It is a thing that ends
 * up in *no* group — invisible, unreachable, leaving nothing on screen to
 * notice — and a group that cannot be stepped back out of, which would trap
 * a child who opened the wrong one. `crate.test.ts` proves the first against
 * the lists; this proves both against the buttons that exist.
 */
describe("the crate's two levels", () => {
  test(
    "offers groups, then one group's things, and steps back out",
    async () => {
      await play({ seams: "&hour=12&materials=40&freezeNpcs" }, async (game) => {
        const named = async (): Promise<string[]> =>
          Object.keys(await game.ui())
            .filter((name) => name.startsWith("crate."))
            .map((name) => name.slice("crate.".length));

        await game.tap("crate");
        await game.settle(250);
        expect((await named()).sort()).toEqual([...CRATE_GROUPS].sort());

        // Every group opens onto something, and onto its own things only.
        const seen: string[] = [];
        for (const group of CRATE_GROUPS) {
          expect(await game.tap(`crate.${group}`)).toBe(true);
          await game.settle(250);
          const things = await named();
          expect({ group, any: things.length > 0 }).toEqual({ group, any: true });
          expect([...things].sort()).toEqual([...thingsIn(group)].sort());
          seen.push(...things);

          // Its own button steps back out rather than shutting the crate.
          expect(await game.tap("crate")).toBe(true);
          await game.settle(250);
          expect((await named()).sort()).toEqual([...CRATE_GROUPS].sort());
        }

        // And between them the groups hold everything, so nothing is lost
        // behind a level it is not in.
        expect(seen.sort()).toEqual([...PLACEABLE_FIXTURES, ...DECOR_TYPES].sort());
      });
    },
    5 * MINUTES,
  );
});
