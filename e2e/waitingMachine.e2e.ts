// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { afterAll, describe, expect, test } from "bun:test";
import { FixtureType } from "../src/world/fixtures";
import { type Game, play, shutDown, takeFromCrate } from "./harness";

const MINUTES = 60_000;

/**
 * A machine standing asleep for want of a spell says which one, unasked.
 *
 * The crate offers a sorter from the first minute and the sorter is woken by
 * the sharing spell, which is taught on a quay most children will not see for
 * several afternoons. So the machine tutorial can hand a child a machine she
 * cannot wake, and until now the only thing that said so was a cloud she got
 * by tapping it — which is no use to a child who does not think to tap.
 *
 * Now it wears the rune it is waiting for, breathing, the way the great
 * tree's wood wears the minus rune and for the same reason: a thing in the
 * world that is *about* a rune, which cannot be asked because it is not
 * somebody.
 *
 * Both halves are asserted here, because either alone passes on a game that
 * marks every machine or none: marked while the spell is owed, and not marked
 * once it is known.
 */
const A_NEW_CHILD =
  "&materials=40&hour=12&freezeNpcs&seed=7" +
  "&guided=plant,grow,pick,sell,learn,place,grove,build,wake,feed,take,wire";

/**
 * The marks that are up, by the thing wearing them.
 *
 * Filtered to machines throughout. A brand-new child is owed every spell in
 * the game, so the schoolteacher and the geometer are wearing runes of their
 * own the whole time this scenario runs, and they are not the subject.
 */
async function machineMarks(game: Game): Promise<string[]> {
  const all = await game.seam<string[]>("teaching");
  return all.filter((one) => one.startsWith("machine:"));
}

/** Put a sorter on the first clear square beside her, and say where it went. */
async function buildASorter(game: Game): Promise<{ col: number; row: number }> {
  expect(await takeFromCrate(game, FixtureType.Sorter)).toBe(true);
  await game.settle(400);
  const at = await game.squareBeside();
  await game.tapCell(at.col, at.row);
  await game.settle(600);
  expect(await game.objectOn(at.col, at.row)).toBe(FixtureType.Sorter);
  return at;
}

afterAll(shutDown);

describe("a machine waiting on a spell", () => {
  test(
    "wears the rune that would wake it, and only the nearest one does",
    async () => {
      await play({ seams: A_NEW_CHILD, firstTime: true }, async (game) => {
        // A brand-new child knows the two spells she starts with and nothing
        // else, so the sharing spell is owed and the quay is a long way off.
        // No machine is marked before she has built one.
        expect(await machineMarks(game)).toEqual([]);

        const first = await buildASorter(game);
        await game.settle(600);
        expect(await machineMarks(game)).toEqual([`machine:${first.col},${first.row}`]);

        // A second one, and still one mark: a garden where every waiting
        // machine pleaded would be a chore list rather than an invitation.
        const second = await buildASorter(game);
        await game.settle(600);
        const both = await machineMarks(game);
        expect(both).toHaveLength(1);
        const only = both[0] ?? "";
        expect([
          `machine:${first.col},${first.row}`,
          `machine:${second.col},${second.row}`,
        ]).toContain(only);
      });
    },
    5 * MINUTES,
  );

  test(
    "wears nothing once she has been taught the spell",
    async () => {
      // The same child and the same sorter, except that she has been to the
      // quay. Nothing is owed, so nothing is asked for.
      // `?learned=` is a dev seam and does not show up in the `spells` seam,
      // which reports the profile only — so the mark itself is the assertion.
      await play({ seams: `${A_NEW_CHILD}&learned=share`, firstTime: true }, async (game) => {
        const at = await buildASorter(game);
        await game.settle(800);
        expect(await machineMarks(game)).toEqual([]);
        expect(at).toBeTruthy();
      });
    },
    5 * MINUTES,
  );
});
