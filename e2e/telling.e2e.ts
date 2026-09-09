// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { afterAll, describe, expect, test } from "bun:test";
import { FixtureType } from "../src/world/fixtures";
import { SHELVED } from "../src/world/jobs";
import { MACHINE_TYPES, recipeFor } from "../src/world/machines";
import { PHONE, crateButton, crateGroup, play, shutDown, takeFromCrate } from "./harness";

const MINUTES = 60_000;

afterAll(shutDown);

/**
 * The little cloud on a machine's button, and the page it opens.
 *
 * A child looking at a picture of a machine they have never built has two
 * questions — what is it, and what does it cost — and the crate could answer
 * neither: dimming a slot says *not yet*, never *how much*. The cloud is
 * where both answers now live, next to the picture that raised them.
 *
 * **The failure this file exists for is the tap, not the page.** The tray's
 * own note says a badge that swallowed taps "would make the fullest slot the
 * hardest one to press" — so the cloud is the one thing in a tray allowed to
 * swallow, and everything about whether that was a good idea is decided by
 * whether a tap on the *button* still reaches the button. Two taps a few
 * pixels apart, and they have to do different things.
 */
// `jobs=all`: the crate holds the bell back until the mechanic's first job is
// done — see `world/jobs.ts` — and this file is about the clouds on the
// machines, not about which of them the crate is offering yet.
const AT_HOME = "&hour=12&materials=60&freezeNpcs&learned=all&jobs=all";

/** The machines a child can actually meet in the crate. See `SHELVED`. */
const ON_THE_SHELF = MACHINE_TYPES.filter(
  (machine) => !(SHELVED as readonly string[]).includes(machine),
);

describe("asking what a thing is", () => {
  test(
    "the cloud opens the page, and the button beside it still builds",
    async () => {
      await play({ seams: AT_HOME }, async (game) => {
        expect(await game.tap("crate")).toBe(true);
        await game.settle(300);
        expect(await game.tap(crateGroup(FixtureType.Press))).toBe(true);
        await game.settle(300);

        // Both taps exist and are not the same tap.
        const at = await game.ui();
        const button = at[crateButton(FixtureType.Press)];
        const cloud = at[`${crateButton(FixtureType.Press)}.tell`];
        if (!button || !cloud) throw new Error("the press has no button, or no cloud on it");
        expect(cloud).not.toEqual(button);

        // The cloud opens the page and does *not* arm the press: a child
        // asking what a thing is has not asked for one.
        expect(await game.tap(`${crateButton(FixtureType.Press)}.tell`)).toBe(true);
        await game.settle(500);
        expect(await game.seam<string | null>("armed")).toBeNull();
        // The page is up, and it is up on the thing that was asked about.
        expect(await game.seam<string | null>("telling")).toBe(FixtureType.Press);

        await game.press("Escape");
        await game.settle(400);

        // And the button underneath still does what it always did. This is
        // the assertion the cloud was a risk to: a swallowed tap here would
        // be a crate that had quietly stopped working.
        //
        // Through `takeFromCrate` rather than tapping the group by hand,
        // because the crate stays *inside* the group it was left in — so on
        // the way back the group button is not there to press, and the
        // helper is the thing that already knows that.
        expect(await takeFromCrate(game, FixtureType.Press)).toBe(true);
        await game.settle(400);
        expect(await game.seam<string | null>("armed")).toBe(FixtureType.Press);
      });
    },
    5 * MINUTES,
  );

  /**
   * And it is there on a phone, which is where it is least likely to be.
   *
   * The crate wraps into fresh columns as it fills, the buttons are smaller,
   * and the cloud is a fraction of a button — so this is the size at which a
   * mark tucked into a corner either survives or quietly stops being drawn.
   */
  test(
    "and the cloud is still on the button at phone size",
    async () => {
      await play({ seams: AT_HOME, viewport: PHONE }, async (game) => {
        expect(await game.tap("crate")).toBe(true);
        await game.settle(300);
        expect(await game.tap(crateGroup(FixtureType.Press))).toBe(true);
        await game.settle(300);
        const at = await game.ui();
        for (const machine of [FixtureType.Press, FixtureType.Sorter]) {
          const cloud = at[`${crateButton(machine)}.tell`];
          expect({ machine, drawn: cloud !== undefined }).toEqual({ machine, drawn: true });
          expect({
            machine,
            onScreen:
              (cloud?.x ?? -1) > 0 &&
              (cloud?.x ?? 0) < PHONE.width &&
              (cloud?.y ?? -1) > 0 &&
              (cloud?.y ?? 0) < PHONE.height,
          }).toEqual({ machine, onScreen: true });
        }
        // A fence has nothing to explain and carries no cloud. Absent rather
        // than empty: a cloud that opened a blank page would be worse than
        // no cloud at all.
        expect(at[`${crateButton(FixtureType.Fence)}.tell`]).toBeUndefined();
      });
    },
    5 * MINUTES,
  );

  /**
   * Every machine's cloud opens its own page, and shuts again.
   *
   * One machine proving the mechanism is not enough here: the cloud is built
   * per button from a closure over the fixture, and a closure captured
   * wrongly is a bug that shows up as *every* cloud explaining the same
   * thing — which one test cannot see.
   */
  test(
    "and every machine's cloud opens its own",
    async () => {
      await play({ seams: AT_HOME }, async (game) => {
        // Every machine the crate draws. A shelved one is still a machine —
        // the world can hold one and a save can load one — and it has no
        // button in the crate, so it has no cloud on a button either.
        // Asking for its cloud failed on a missing button and read as "the
        // blueprint has nothing to say".
        for (const machine of ON_THE_SHELF) {
          expect(await game.tap("crate")).toBe(true);
          await game.settle(250);
          // Only if it is there: after the first machine the crate is
          // already standing inside the makers group.
          if (await game.tap(crateGroup(machine))) await game.settle(250);
          expect(await game.tap(`${crateButton(machine)}.tell`)).toBe(true);
          await game.settle(400);
          expect(await game.seam<string | null>("telling")).toBe(machine);
          await game.press("Escape");
          await game.settle(300);
          expect(await game.seam<string | null>("telling")).toBeNull();
        }
        // And the recipe every page is drawn from is two materials, which is
        // every recipe in the game — a machine is wood and stone, because a
        // recipe in one material is a number and a recipe in two is a plan.
        for (const machine of ON_THE_SHELF) expect(recipeFor(machine)).toHaveLength(2);
      });
    },
    5 * MINUTES,
  );
});
