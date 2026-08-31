// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { afterAll, describe, expect, test } from "bun:test";
import { type Game, PHONE, play, shutDown } from "./harness";

const MINUTES = 60_000;

afterAll(shutDown);

/**
 * The software keyboard, and where it leaves the screen.
 *
 * From an iPhone playtest, in Safari: tap "next" on the last of the notices
 * for parents, the name box comes up with the colours and the shapes, iOS
 * puts the keyboard up because the box has taken focus — *and the whole
 * page shifts upwards, taking the heading and the box itself off the top of
 * the screen.* The second report of the same shape; the first one was an
 * iPad and is what `boxTopWithin` was written for.
 *
 * **No browser here has a software keyboard**, headless or not, and no
 * device emulator adds one: what a phone emulator changes is the size of
 * the screen, the pixel ratio and the user agent, none of which is the
 * thing that goes wrong. So a scenario that waited for a keyboard would
 * wait forever, and one that faked a keyboard would be checking a model of
 * iOS rather than this game.
 *
 * What *can* be measured, in any browser, is the fact the keyboard then
 * acts on. A browser raises the keyboard for whatever has focus and scrolls
 * to reveal it — that is not a Safari quirk, it is what focus means — so
 * everything downstream is decided by **where the box is standing at the
 * moment it takes focus**. Measure that, and the keyboard is somebody
 * else's business.
 *
 * Which is the whole of this file: walk in the way the report describes,
 * and watch what the box's own rectangle says when it is focused.
 */

/** Past the title card and onto the flags, as `parents.e2e.ts` does. */
async function toTheFlags(game: Game): Promise<{ width: number; height: number }> {
  const view = game.tab.viewportSize();
  if (!view) throw new Error("no viewport");
  for (let go = 0; go < 12 && (await game.making()) === ""; go++) {
    await game.tab.mouse.click(view.width / 2, view.height / 2);
    await game.settle(500);
  }
  await game.waitForStep("tongue");
  return view;
}

/** Where a thing was standing when the keyboard would have come up for it. */
interface Focused {
  tag: string;
  top: number;
  bottom: number;
  left: number;
  right: number;
  /** What the game had positioned it at, which on the first focus is nothing. */
  styleTop: string;
  screen: { width: number; height: number };
}

/**
 * Watch for anything taking focus, from here on.
 *
 * A `focusin` listener rather than a patched `HTMLElement.prototype.focus`:
 * the same measurement either way, and this one also catches a focus the
 * browser decided on by itself — which is half of what a keyboard does.
 *
 * Installed at the notice before the name box exists, because the box is
 * built, positioned and focused inside one call and there is no moment
 * between them for a scenario to look.
 */
function watchFocus(): void {
  const seen: unknown[] = [];
  (globalThis as never as Record<string, unknown>).__focused = seen;
  document.addEventListener("focusin", (event) => {
    const on = event.target as HTMLElement;
    const box = on.getBoundingClientRect();
    seen.push({
      tag: on.tagName,
      top: box.top,
      bottom: box.bottom,
      left: box.left,
      right: box.right,
      styleTop: on.style.top,
      screen: { width: window.innerWidth, height: window.innerHeight },
    });
  });
}

describe("the name box and the keyboard it calls up", () => {
  /**
   * It has to be on the screen before it asks for the keyboard.
   *
   * A `position: fixed` element with no `top` sits at its static position,
   * and this one is appended to a body whose only child is a canvas exactly
   * one screen tall — so an unplaced box stands at the very bottom edge, out
   * of sight. Focus it there and a phone does the one thing that follows:
   * raises the keyboard and scrolls the page up to reveal what is focused,
   * which is a page with nothing on it below the fold and a heading at the
   * top that goes off it. Then the game moves the box back where it belongs,
   * which is now above what is visible.
   *
   * Both halves of the report, from the order of two lines. So this asserts
   * nothing about keyboards at all — only that when the box takes focus, the
   * box is somewhere a person can see.
   */
  test(
    "it is already on screen when it takes focus, not below the fold",
    async () => {
      await play({ onboarding: true, viewport: PHONE, touch: true }, async (game) => {
        const view = await toTheFlags(game);
        const onward = async (first = false) => {
          // Right of centre on every one of these screens, and by more on
          // the flags, where the opposite button says "restore a backup".
          await game.tab.mouse.click(view.width / 2 + (first ? 92 : 74), view.height - 32);
        };

        await onward(true);
        for (const step of ["parents", "offline", "backup"]) {
          await game.waitForStep(step);
          await game.settle(250);
          // The last notice is the last moment before the box is made.
          if (step === "backup") await game.tab.evaluate(watchFocus);
          await onward();
        }
        await game.waitForStep("who");
        await game.settle(600);

        const focused = await game.tab.evaluate(
          () => (globalThis as never as Record<string, Focused[]>).__focused ?? [],
        );
        // Nothing took focus at all would pass every check below while
        // testing the opposite of this scenario.
        const box = focused.find((one) => one.tag === "INPUT");
        if (!box) throw new Error("the name box never took focus, so this proved nothing");

        expect({
          where: `${box.top}..${box.bottom} of ${box.screen.height}`,
          onScreen: box.top >= 0 && box.bottom <= box.screen.height,
        }).toEqual({
          where: `${box.top}..${box.bottom} of ${box.screen.height}`,
          onScreen: true,
        });
      });
    },
    5 * MINUTES,
  );
});
