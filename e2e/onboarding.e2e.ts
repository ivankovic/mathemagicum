// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { afterAll, describe, expect, test } from "bun:test";
import { type Game, play, shutDown } from "./harness";

const MINUTES = 60_000;

afterAll(shutDown);

/**
 * Making a player: the three screens before the game.
 *
 * They had no browser coverage at all, which is how a keyboard could carry
 * the whole game off the top of an iPad without anything noticing. `?skipTitle`
 * is why — it exists so a script does not wait at a grid of faces, and it
 * skips these screens along with the wait.
 *
 * **What these cannot prove.** There is no software keyboard in a headless
 * browser, and no way to make one appear. What is checked here is the
 * property the fix *rests on* — that the name box is drawn in the top part
 * of the screen, well clear of where a keyboard lands — and that the page
 * itself never scrolls. Whether iPadOS then behaves is a question only an
 * iPad can answer.
 */

/** Past the title card and the language step, onto "Who are you?". */
async function toTheNameStep(game: Game): Promise<void> {
  const view = game.tab.viewportSize();
  if (!view) throw new Error("no viewport");
  // The title card takes a tap anywhere — once it is listening, which is
  // not the moment the canvas first has something on it. Tapped until it
  // answers rather than after a delay somebody guessed: a card that says
  // "tap anywhere" cannot mind being tapped twice, and a fixed wait here is
  // exactly the flake these screens went uncovered to avoid.
  for (let go = 0; go < 12 && (await game.making()) === ""; go++) {
    await game.tab.mouse.click(view.width / 2, view.height / 2);
    await game.settle(500);
  }
  await game.waitForStep("tongue");
  // A device with nobody on it opens on the flags, with "next" on the right
  // and "restore a backup" where "back" would be — there is nothing behind
  // this screen to go back *to*, and a tablet being set up after a lost one
  // needs to be told it can put its old game on. Every step after it has an
  // ordinary "back", which sits a little closer in.
  await game.tab.mouse.click(view.width / 2 + 92, view.height - 32);
  // Then the three notices a parent is walked through before the tablet is
  // handed over. Stepped by name rather than by counting taps: a notice
  // added or moved should fail here saying which screen it stuck on.
  for (const step of ["parents", "offline", "backup"]) {
    await game.waitForStep(step);
    await game.tab.mouse.click(view.width / 2 + 74, view.height - 32);
  }
  await game.waitForStep("who");
}

describe("the box a child types their name into", () => {
  /**
   * Well clear of where a keyboard lands.
   *
   * On an iPad the software keyboard takes about half the screen. Under the
   * portrait — where this box used to be — it sat in the half the keyboard
   * covers, so Safari scrolled the page up to reveal it and took the game
   * with it, off the top of the screen with no way back.
   *
   * A third is the bound rather than a half, because a phone held in
   * landscape gives a keyboard more than half and the box still has to be
   * reachable there.
   */
  test(
    "is drawn in the top third of the screen",
    async () => {
      await play({ onboarding: true }, async (game) => {
        await toTheNameStep(game);
        const box = game.tab.locator("input");
        expect(await box.count()).toBe(1);
        const at = await box.boundingBox();
        const view = game.tab.viewportSize();
        if (!at || !view) throw new Error("the name box is not on screen");

        expect({ bottom: at.y + at.height, third: view.height / 3 }).toEqual({
          bottom: at.y + at.height,
          third: view.height / 3,
        });
        expect(at.y + at.height).toBeLessThan(view.height / 3);
        // And on screen at all, which the check above would also pass for a
        // box at a negative offset.
        expect(at.y).toBeGreaterThan(0);
      });
    },
    5 * MINUTES,
  );

  /**
   * And the page cannot scroll, whatever it is asked to do.
   *
   * The canvas is exactly the size of the viewport, so any offset at all is
   * the browser having moved the page — and every pixel of it is the game
   * gone off the top. Asked for explicitly rather than trusted: `overflow:
   * hidden` does *not* stop iOS doing this, which is why the body is pinned.
   */
  test(
    "and the page it sits on cannot be scrolled away",
    async () => {
      await play({ onboarding: true }, async (game) => {
        await toTheNameStep(game);
        await game.tab.locator("input").focus();
        await game.settle(400);
        const moved = await game.tab.evaluate(() => {
          // Everything a browser might do to reveal a focused input, asked
          // for on purpose.
          window.scrollTo(0, 400);
          document.querySelector("input")?.scrollIntoView();
          const root = document.scrollingElement;
          if (root) root.scrollTop = 400;
          return {
            windowY: window.scrollY,
            rootTop: document.scrollingElement?.scrollTop ?? 0,
            canvasTop: document.querySelector("canvas")?.getBoundingClientRect().top ?? 0,
          };
        });
        expect(moved).toEqual({ windowY: 0, rootTop: 0, canvasTop: 0 });
      });
    },
    5 * MINUTES,
  );

  /**
   * And typing into it still makes a player.
   *
   * The box moved up the screen to get out of the keyboard's way, and a
   * rearrangement that broke the form would be a worse bug than the one it
   * fixed.
   */
  test(
    "and a name typed into it still starts a game",
    async () => {
      await play({ onboarding: true }, async (game) => {
        await toTheNameStep(game);
        await game.tab.locator("input").fill("Mila");
        const view = game.tab.viewportSize();
        if (!view) throw new Error("no viewport");
        // On to the sums, and then into the world.
        await game.tab.mouse.click(view.width / 2 + 74, view.height - 32);
        await game.waitForStep("sums");
        // The box goes with the step. Left behind it would float over the
        // sums with a half-typed name in it.
        expect(await game.tab.locator("input").count()).toBe(0);
        await game.tab.mouse.click(view.width / 2 + 74, view.height - 32);
        await game.settle(9000);
        // Standing on a real square in a real world, which is the only
        // proof that the form actually finished.
        const at = await game.where();
        expect({ col: Number.isInteger(at.col), row: Number.isInteger(at.row) }).toEqual({
          col: true,
          row: true,
        });
      });
    },
    5 * MINUTES,
  );
});
