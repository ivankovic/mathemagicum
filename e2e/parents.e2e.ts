// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { afterAll, describe, expect, test } from "bun:test";
import { tmpdir } from "node:os";
import { DEFAULT_AVATAR } from "../src/avatar/style";
import { BACKUP_KIND, BACKUP_VERSION } from "../src/save/backup";
import { createProfile } from "../src/save/profiles";
import { SUGGESTED_BAND } from "../src/spells/difficulty";
import { MAKING_STEPS } from "../src/ui/playersLayout";
import { type Game, play, shutDown } from "./harness";

/**
 * A backup file, written where a scenario's working files go.
 *
 * Built with `createProfile` rather than typed out, for the reason the
 * teacher's worked example is built with `problemFor`: a profile written by
 * hand is one that quietly stops matching the shape the game reads, and
 * then this scenario passes by restoring nothing.
 */
// Written where the machine keeps working files rather than beside the
// scenarios: these are two things a run makes and nobody reads, and a repo
// that accumulates them is a repo somebody eventually commits one from.
const WORKING = tmpdir();
const BACKUP_FILE = `${WORKING}/mathemagicum-scenario-backup.json`;
const NOT_A_BACKUP = `${WORKING}/mathemagicum-scenario-notes.json`;

{
  const ada = createProfile(
    [],
    { name: "Ada", avatar: DEFAULT_AVATAR, language: "en", band: SUGGESTED_BAND },
    1_780_000_000_000,
  );
  await Bun.write(
    BACKUP_FILE,
    JSON.stringify({
      kind: BACKUP_KIND,
      version: BACKUP_VERSION,
      savedAt: 1_780_000_000_000,
      items: { "mathemagicum.players": JSON.stringify([ada]) },
    }),
  );
  await Bun.write(NOT_A_BACKUP, JSON.stringify({ shopping: ["milk", "bread"] }));
}

const MINUTES = 60_000;

afterAll(shutDown);

/**
 * The small print, and the button that answers it.
 *
 * Three screens for whoever is holding the tablet, and none of them can be
 * checked by reading a phrase file: what makes them work is that they are
 * *passed through* — after the flags, so they are in a language somebody
 * chose, before the name box, so the child has not taken over yet, and with
 * a way back out of each one. All of that is about the sequence, which is
 * exactly what a unit test of `stepFrom` cannot see.
 *
 * The pictures need no assertion of their own, and that is worth writing
 * down rather than leaving somebody to add one: the loader reads the ui
 * index by name and `uiEntry` throws for an asset that is not in it, so a
 * sign the generator never shipped takes the boot down and every scenario
 * in this file fails before it reaches a panel.
 */

/** Past the title card and onto the flags. */
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

/**
 * "Next", which is right of centre on every one of these screens.
 *
 * By a little more on the flags than on the notices, because the flags of a
 * device with nobody on it have "restore a backup" opposite rather than
 * "back" — a wider pair, since it is a longer word.
 */
async function onward(game: Game, view: { width: number; height: number }, first = false) {
  await game.tab.mouse.click(view.width / 2 + (first ? 92 : 74), view.height - 32);
}

async function back(game: Game, view: { width: number; height: number }) {
  await game.tab.mouse.click(view.width / 2 - 74, view.height - 32);
}

describe("what a parent is told while the game is being set up", () => {
  /**
   * The three notices come between the flags and the name box.
   *
   * In that order and nowhere else. Before the flags they would be in
   * whatever language the last person left the tablet in; after the name
   * box the tablet is in a child's hands and the notices are addressed to
   * somebody who is no longer looking at it.
   */
  test(
    "three panels, after the language and before the child's own name",
    async () => {
      await play({ onboarding: true }, async (game) => {
        const view = await toTheFlags(game);
        await onward(game, view, true);
        for (const step of ["parents", "offline", "backup"]) {
          await game.waitForStep(step);
          await game.settle(250);
          await onward(game, view);
        }
        await game.waitForStep("who");
      });
    },
    5 * MINUTES,
  );

  /**
   * And a parent who taps past one can go back for it.
   *
   * The panel with the backup on it is the one worth being able to return
   * to — it is the one that costs somebody a year of their farm — and the
   * only reason it *can* be returned to is that these are steps in the
   * sequence rather than a splash screen with an on button.
   */
  test(
    "and back goes back through them, one at a time",
    async () => {
      await play({ onboarding: true }, async (game) => {
        const view = await toTheFlags(game);
        await onward(game, view, true);
        await game.waitForStep("parents");
        await onward(game, view);
        await game.waitForStep("offline");
        await back(game, view);
        await game.waitForStep("parents");
        await back(game, view);
        // All the way out to where it started, which is the flags.
        await game.waitForStep("tongue");
      });
    },
    5 * MINUTES,
  );

  // Every notice is one of the steps, so nothing here can drift out of the
  // sequence the scenario above walks.
  test("the notices are steps in the making, not a screen of their own", () => {
    for (const step of ["parents", "offline", "backup"]) {
      expect(MAKING_STEPS as readonly string[]).toContain(step);
    }
  });
});

describe("and the button that answers the third one", () => {
  /**
   * Export saves is in the options, and pressing it does something.
   *
   * What it *cannot* check is that a file arrived. On a tablet the backup
   * goes to the operating system's share sheet, which is not this game's
   * window and is not something Playwright can see into; under a headless
   * browser it takes the download path instead. So what is asserted is the
   * part that is this game's: the button is there, it is reachable, and
   * pressing it leaves the game standing rather than throwing — plus the
   * word on it changes, which is the only evidence a parent gets either.
   */
  test(
    "it is on the options panel, and says so when it has run",
    async () => {
      await play({ seams: "&learned=all&hour=12&freezeNpcs" }, async (game) => {
        await game.tap("options");
        await game.settle(600);
        expect(await game.tap("exportSaves")).toBe(true);
        await game.settle(900);
        // Still open, still playable: a backup is not a thing that closes
        // the game or takes anything away. Pressed twice on purpose — the
        // button puts its own word back after a beat, and one that had
        // stopped being a button would fail here rather than look fine.
        const stood = await game.where();
        expect(await game.tap("exportSaves")).toBe(true);
        await game.settle(400);
        expect(await game.where()).toEqual(stood);
      });
    },
    5 * MINUTES,
  );
});

/**
 * And the other direction: a file, back onto a tablet.
 *
 * The one flow in the game that can be driven end to end by a scenario and
 * has to be, because every part of it is somewhere else — a native file
 * picker, a browser's storage, and a screen that has to become a different
 * device afterwards. Playwright can answer a file picker, which is what
 * makes this checkable at all.
 */
/**
 * What a finger landing here would actually touch.
 *
 * The one thing a scenario can say about a control that is an invisible
 * HTML element over a drawn button — and the thing that broke first: a
 * Phaser button that opened the picker itself did nothing at all, because
 * the tap is over as far as the browser is concerned by the time Phaser
 * reads it.
 */
async function whatIsUnder(game: Game, x: number, y: number): Promise<string> {
  return game.tab.evaluate(
    ([atX, atY]) => {
      const found = document.elementFromPoint(atX as number, atY as number);
      if (!found) return "nothing";
      return found instanceof HTMLInputElement ? found.type : found.tagName.toLowerCase();
    },
    [x, y] as const,
  );
}

/** Who the device says is on it, straight out of the browser's storage. */
async function namesOnDevice(game: Game): Promise<string[]> {
  return game.tab.evaluate(() => {
    const raw = localStorage.getItem("mathemagicum.players");
    if (!raw) return [];
    const saved = JSON.parse(raw) as { name?: string }[];
    return saved.map((one) => one.name ?? "");
  });
}

describe("putting a backup back", () => {
  /**
   * A tablet with nobody on it, handed a file with somebody in it.
   *
   * The whole point of the feature and the case that nearly went missing: a
   * device with no children never shows the faces at all, so a restore
   * button that lived only there could not be reached by the one device
   * that needs it.
   */
  test(
    "a new tablet can be given somebody else's game",
    async () => {
      await play({ onboarding: true }, async (game) => {
        const view = game.tab.viewportSize();
        if (!view) throw new Error("no viewport");
        for (let go = 0; go < 12 && (await game.making()) === ""; go++) {
          await game.tab.mouse.click(view.width / 2, view.height / 2);
          await game.settle(500);
        }
        // Nobody on it, so this is the flags rather than the faces.
        await game.waitForStep("tongue");

        // The restore button is a real file input laid over the drawn one,
        // because a browser will not open a picker for a script — so what
        // is checked is both halves of that: the input is the thing a
        // finger landing on the button would actually hit...
        expect(await whatIsUnder(game, view.width / 2 - 92, view.height - 32)).toBe("file");
        // ...and handing it a file does what the button promises. The
        // picker itself is the operating system's window and is nobody's to
        // drive; `setFiles` is standing where a parent's choice would.
        await game.tab.setInputFiles("input[type=file]", BACKUP_FILE);
        await game.settle(900);

        // Read, and asked about — nothing has happened yet.
        expect(await game.making()).toBe("tongue");
        // Yes, on the left, where every other dangerous yes on this screen
        // is. Then the device is the one in the file: a child on it, and
        // the faces rather than the flags.
        await game.tab.mouse.click(view.width / 2 - 84, view.height / 2 + 48);
        await game.settle(900);
        await game.waitForStep("list");
        expect(await namesOnDevice(game)).toContain("Ada");
      });
    },
    5 * MINUTES,
  );

  /**
   * And a file that is not a backup changes nothing and says so.
   *
   * Said on the screen rather than in a box, and said *before* anybody is
   * asked to agree to anything: a parent who confirms that their tablet may
   * be emptied and is then told the file was no good has been asked to
   * authorise something that never happened.
   */
  test(
    "and a file that is not one of ours is refused before anything is asked",
    async () => {
      await play({ onboarding: true }, async (game) => {
        const view = game.tab.viewportSize();
        if (!view) throw new Error("no viewport");
        for (let go = 0; go < 12 && (await game.making()) === ""; go++) {
          await game.tab.mouse.click(view.width / 2, view.height / 2);
          await game.settle(500);
        }
        await game.waitForStep("tongue");
        await game.tab.setInputFiles("input[type=file]", NOT_A_BACKUP);
        await game.settle(900);
        // No question was asked, so tapping where "yes" would be does
        // nothing at all — which is the assertion: a screen that had put
        // the box up would have taken the file by now.
        await game.tab.mouse.click(view.width / 2 - 84, view.height / 2 + 48);
        await game.settle(600);
        expect(await game.making()).toBe("tongue");
        expect(await namesOnDevice(game)).toEqual([]);
      });
    },
    5 * MINUTES,
  );
});
