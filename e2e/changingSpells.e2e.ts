// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { afterAll, describe, expect, test } from "bun:test";
import { Spell } from "../src/spells/spellbook";
import { UiAsset, uiTextureKey } from "../src/ui/assets";
import { PlantType } from "../src/world/plants";
import { PatchAction } from "../src/world/selection";
import { patchButton, play, runeButton, seedButton, shutDown } from "./harness";

const MINUTES = 60_000;
const A_GARDEN = "&hour=12&freezeNpcs&learned=all";

afterAll(shutDown);

/**
 * What is lit, and what is still lit that should not be.
 *
 * `aiming.e2e.ts` next door is about *where* a spell lands and how long the
 * square she picked lasts. This file is the other half of the same tap: which
 * rune she is told she is holding, and whether the last one was really put
 * down before this one was picked up.
 *
 * Both of these came out of a playthrough on a phone, and neither is
 * arithmetic: they are the game telling a child the wrong thing about what
 * she is holding. Unit tests cannot reach either, because both are a picture
 * — the rune over her head, and the ground ruled off under her — and the
 * whole of the bug is which picture is on screen.
 *
 * They share a cause. Marking out ground and arming a rune are two different
 * ways of waiting for a tap, they were written at different times, and each
 * knew how to interrupt the other in one direction only.
 */
describe("the rune over her head", () => {
  test(
    "says divide when she casts the sharing spell, not times",
    async () => {
      await play({ seams: A_GARDEN }, async (game) => {
        const rune = () => game.seam<string | null>("armedRune");
        const marking = () => game.seam<string | null>("marking");

        // Nothing lit to begin with, so what shows up later got there by
        // being cast rather than by having been there all along.
        expect(await rune()).toBe(null);

        // The array spell, which asks *what is being multiplied* before it
        // asks where: the rune is not raised by tapping it, only by the
        // answer to that menu. Nothing is lit in between, which is right —
        // the menu is the thing on screen and it is over her head already.
        await game.tap("spellbook");
        await game.tap(runeButton(Spell.Array));
        await game.settle(500);
        expect(await rune()).toBe(null);

        // Answered, and now she is marking out ground. Times, and true:
        // clearing a rectangle is the minus spell multiplied.
        expect(await game.tap(patchButton(PatchAction.Clear))).toBe(true);
        await game.settle(500);
        expect(await marking()).not.toBe(null);
        expect(await rune()).toBe(uiTextureKey(UiAsset.RuneTimes));

        // Put out by casting it again, which is how a child changes her
        // mind about it, and the rune goes with it.
        await game.tap("spellbook");
        await game.tap(runeButton(Spell.Array));
        await game.settle(400);
        expect(await marking()).toBe(null);
        expect(await rune()).toBe(null);

        // And the sharing spell, which is division and shares nothing with
        // multiplication but the rectangle. It wore the times rune.
        await game.tap("spellbook");
        await game.tap(runeButton(Spell.Share));
        await game.settle(500);
        expect(await marking()).not.toBe(null);
        expect(await rune()).toBe(uiTextureKey(UiAsset.RuneDivide));
      });
    },
    5 * MINUTES,
  );
});

describe("changing her mind about a spell", () => {
  test(
    "puts the first one out, ground and all, before the second is marked",
    async () => {
      await play({ seams: A_GARDEN }, async (game) => {
        const armed = () => game.seam<string | null>("armed");
        const marking = () => game.seam<string | null>("marking");

        // Something to aim the growing spell at, so the arming is the
        // ordinary one rather than a rune lit over bare grass.
        await game.tap("seeds");
        await game.tap(seedButton(PlantType.Carrot));
        const at = await game.where();
        await game.tapCell(at.col, at.row + 1);
        await game.settle(400);

        // Plus, lit and waiting. `armed` is what rules the reach off on the
        // grass, which is the square a child sees and the thing that was
        // being left behind.
        await game.tap("spellbook");
        await game.tap(runeButton(Spell.Growth));
        await game.settle(400);
        expect(await armed()).not.toBe(null);

        // Then she changes her mind and casts the times rune instead. The
        // menu it opens is two taps from any marking at all, and for those
        // two taps the plus spell used to still own the world: a finger
        // anywhere beside the little menu cast it.
        await game.tap("spellbook");
        await game.tap(runeButton(Spell.Array));
        await game.settle(500);
        expect(await armed()).toBe(null);

        // Through the menu to the marking itself, and still nothing armed
        // underneath it.
        expect(await game.tap(patchButton(PatchAction.Clear))).toBe(true);
        await game.settle(500);
        expect(await armed()).toBe(null);
        expect(await marking()).not.toBe(null);
      });
    },
    5 * MINUTES,
  );
});

/**
 * And what the guides make of it, which is where the same gap did real harm.
 *
 * The tree's errand points at the times rune and then waits to be told she
 * has lit it, before it points at the beds. Nothing ever told it: that spell
 * is never *armed* — tapping its rune opens a menu — so the deed had no way
 * of happening and the last guide in the game stood pointing at the
 * spellbook for ever. The moment that counts is the choice off the menu,
 * because that is the one that starts the spell.
 */
describe("what the guides see of the times rune", () => {
  test(
    "is nothing while the menu is open, and the array spell once it is answered",
    async () => {
      await play({ seams: A_GARDEN }, async (game) => {
        const view = async () =>
          (await game.seam<{ view: { armed: string | null } }>("guide")).view.armed;

        expect(await view()).toBe(null);

        // The rune tapped: the menu is up and nothing is lit yet. This half
        // is the design decision — the tap is not the arming.
        await game.tap("spellbook");
        await game.tap(runeButton(Spell.Array));
        await game.settle(500);
        expect(await view()).toBe(null);

        // The choice made: marking begins, and now the guides can see it.
        expect(await game.tap(patchButton(PatchAction.Clear))).toBe(true);
        await game.settle(500);
        expect(await view()).toBe("array");

        // Given up on, and it goes back to nothing rather than sticking.
        await game.tap("spellbook");
        await game.tap(runeButton(Spell.Array));
        await game.settle(400);
        expect(await view()).toBe(null);
      });
    },
    5 * MINUTES,
  );
});
