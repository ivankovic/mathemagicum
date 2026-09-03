// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { afterAll, describe, expect, test } from "bun:test";
import { DecorType } from "../src/world/decor";
import { type Game, play, shutDown, takeFromCrate } from "./harness";

const MINUTES = 60_000;

afterAll(shutDown);

/**
 * Every stove in a room burns, not just the last one put down.
 *
 * Reported from a playtest: *only one stove per house lights up, they should
 * all glow.* Only one could. The scene held a single cell and a single halo,
 * and the routine that lit a stove put the previous one out on its way in —
 * so a room with three stoves drew three stoves and one fire.
 *
 * **A picture cannot settle this**, which is why it went unnoticed. A glow
 * is an additive sprite over the night tint: a room with three fires and a
 * room with one look like a warm room either way, and the difference is a
 * gradient nobody can measure by eye. So it asks the seam — which had to be
 * widened from one fire to a list, because *that* was the shape of the bug.
 *
 * Its own file rather than an eleventh scenario in `house.e2e.ts`: the
 * harness warns that a dozen scenarios in one process is near the edge on
 * four busy cores, and the crate scenario has already been moved out for it.
 */
const AT_NIGHT = "&hour=22&brickRung=1&furniture=3";

interface Fire {
  col: number;
  row: number;
  alpha: number;
}

/** The room she is in: its floor, and how its squares map onto hers. */
interface Room {
  floor: string[];
  origin: { col: number; row: number };
}

/** How far she can point, which is how far a thing can be put down. */
const AIM = 3;

/** Indoors, at her own front door. */
async function goHome(game: Game): Promise<void> {
  const doors = await game.seam<Record<string, { col: number; row: number }>>("doors");
  const door = doors["player-house"];
  if (!door) throw new Error("this village has no house for the player");
  await game.standAt(door.col, door.row + 2, "up");
  // Walked until she is *in*, rather than walked once and hoped.
  //
  // `stopped()` waits for her to stop moving, which she also does when she
  // has stopped short of the door — and this one failed exactly that way on
  // a loaded machine, reporting a room with no fire in it when the truth was
  // a child standing on the doorstep. Two more goes cost nothing on the runs
  // where the first was enough.
  for (let go = 0; go < 3; go++) {
    await game.walk("ArrowUp", 900);
    await game.stopped();
    if ((await game.seam<unknown>("house")) !== null) return;
  }
  throw new Error("walking through the front door did not go indoors");
}

describe("the fires in a room", () => {
  test(
    "every stove she puts down burns, not only the last",
    async () => {
      await play({ seams: AT_NIGHT }, async (game) => {
        await goHome(game);

        // The one the room ships with, alight because it is night.
        const first = await game.seam<Fire[]>("hearths");
        expect(first).toHaveLength(1);
        expect(first[0]?.alpha).toBeGreaterThan(0);

        // Two more out of the crate, put down where there is floor.
        //
        // **On squares read off the room's own plan**, which is what this
        // used to get wrong. It tapped one step right and two steps
        // right-and-down from wherever she happened to be standing, and
        // whether either of those is free floor depends on the cottage's
        // furniture — the scenario's own note two paragraphs below says as
        // much and then guessed anyway. When a tap landed on a wall the
        // piece was refused, she was left holding it, and the *next* round
        // opened the crate while she still had one in her hands: choosing
        // the colour she was already holding is "tapping the same thing
        // again", which is the gesture that puts it down. Two rounds, one
        // stove, and a failure that read as the colour menu being broken.
        //
        // So: squares off the plan, within her reach, tried until two of
        // them take. Nothing here asserts *which* — where a stove fits is
        // the floor plan's business and this scenario is about the fires.
        const start = await game.where();
        const room = await game.seam<Room>("house");
        if (!room) throw new Error("she is not in a room");
        const spots = room.floor
          .map((cell) => cell.split(",").map(Number))
          .map(([col, row]) => ({
            col: (col ?? 0) - room.origin.col,
            row: (row ?? 0) - room.origin.row,
          }))
          // Not the square she is standing on, and not one she cannot point
          // at: a tap outside the ring chooses nothing and leaves the rune
          // lit, which would spend a candidate for no reason.
          .filter((at) => !(at.col === start.col && at.row === start.row))
          .filter(
            (at) => Math.max(Math.abs(at.col - start.col), Math.abs(at.row - start.row)) <= AIM,
          )
          // Nearest first, so the two that take are usually the first two
          // tried. Every miss costs a tap and half a second, and a
          // seven-by-seven ring is forty-eight of them.
          .sort(
            (a, b) =>
              Math.abs(a.col - start.col) +
              Math.abs(a.row - start.row) -
              (Math.abs(b.col - start.col) + Math.abs(b.row - start.row)),
          );

        const standing = async () =>
          (await game.seam<{ piece: string }[]>("decor")).filter((one) => one.piece === "stove")
            .length;
        const was = await standing();
        for (const at of spots) {
          if ((await standing()) - was === 2) break;
          // Only when her hands are empty. A refused placement leaves her
          // holding the piece — deliberately, so a near miss costs one tap
          // rather than the whole thing — and going back to the crate then
          // is what put it down again.
          if ((await game.seam<string | null>("armed")) === null) {
            expect(await takeFromCrate(game, DecorType.Stove)).toBe(true);
            await game.settle(250);
            // A chooser of one is not a choice, so with a single colourway
            // owned there is no menu and she is armed already.
            if (await game.tap("colour.0")) await game.settle(250);
            expect(await game.seam<string | null>("armed")).toBe("stove~0");
          }
          await game.tapCell(at.col, at.row);
          await game.settle(500);
        }
        expect((await standing()) - was).toBe(2);

        // One fire per stove standing, whatever that number turns out to be.
        // This is the assertion the bug failed: the fires stayed at one
        // however many stoves were down.
        const stoves = (await game.seam<{ piece: string }[]>("decor")).filter(
          (one) => one.piece === "stove",
        );
        expect(stoves.length).toBeGreaterThan(1);
        const all = await game.seam<Fire[]>("hearths");
        expect(all).toHaveLength(stoves.length);
        for (const fire of all) expect(fire.alpha).toBeGreaterThan(0);
        // And each over its own square, so they are several fires rather
        // than one drawn several times.
        expect(new Set(all.map((f) => `${f.col},${f.row}`)).size).toBe(all.length);
      });
    },
    5 * MINUTES,
  );
});
