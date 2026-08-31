// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { afterAll, describe, expect, test } from "bun:test";
import { Spell } from "../src/spells/spellbook";
import { ANIMAL_GLAD_MS } from "../src/world/animals";
import { FixtureType } from "../src/world/fixtures";
import { PatchAction } from "../src/world/selection";
import { type Game, patchButton, play, runeButton, shutDown, takeFromCrate } from "./harness";

const MINUTES = 60_000;

afterAll(shutDown);

/**
 * The village's chickens and rabbits, and what a tap on one does.
 *
 * Written for a playtest report — *tapping the rabbit didn't bring up any
 * food, just an empty rabbit. Same for chickens* — and there was nothing
 * here before it. The whole of the feeding is a tap on a sprite, which is
 * the one thing a unit test cannot reach: `feedAnimal` reads the basket, the
 * distance and the mood, and every one of those is scene state.
 *
 * **Every scenario freezes them.** They wander, and an animal that has taken
 * a step between the seam being read and the square being tapped is a
 * scenario that fails on a busy machine and passes on an idle one. `hungry`
 * holds them asking for the same reason: they ask on their own clocks, and a
 * script that waited for one to get hungry would pass at three in the
 * afternoon.
 */
const FROZEN = "&hour=12&crops=5&freezeNpcs&hungry";
/** The same village, with timber for a machine and every rune lit. */
const WITH_TIMBER = `${FROZEN}&materials=40&learned=all`;

/** Whether a square is clear enough to stand a machine on. */
function isFree(game: Game, col: number, row: number): Promise<boolean> {
  return game.tab.evaluate(
    ([c, r]) => {
      const handle = (globalThis as never as Record<string, Record<string, unknown>>)
        .__mathemagicum;
      if (!handle) throw new Error("the game has not put its handle out");
      const session = handle.session as {
        grid: {
          isPassable: (col: number, row: number) => boolean;
          getObjectAt: (col: number, row: number) => unknown;
        };
      };
      return (
        session.grid.isPassable(c as number, r as number) &&
        !session.grid.getObjectAt(c as number, r as number)
      );
    },
    [col, row] as const,
  );
}

interface Beast {
  id: string;
  kind: string;
  col: number;
  row: number;
  craves: string;
  mood: string;
  bubble: boolean;
  thinking: string[];
}

/** Whether she can be stood on this square. */
function standable(game: Game, col: number, row: number): Promise<boolean> {
  return game.tab.evaluate(
    ([c, r]) => {
      const handle = (globalThis as never as Record<string, Record<string, unknown>>)
        .__mathemagicum;
      if (!handle) throw new Error("the game has not put its handle out");
      const session = handle.session as {
        grid: { isPassable: (col: number, row: number) => boolean };
      };
      return session.grid.isPassable(c as number, r as number);
    },
    [col, row] as const,
  );
}

/**
 * Put her at the feet of one of the village's animals.
 *
 * Through a reload rather than by walking or by `standAt`. `standAt` moves
 * the session and leaves the sprite where it was, and the camera follows the
 * sprite — so the square a script then taps is a square off the side of the
 * screen, and the tap lands on nothing. This cost an afternoon: the feeding
 * looked broken and it was the scenario that was standing in the wrong
 * place. `at=` is read while the scene is being built, so she is put there
 * before there is a camera to be pointed anywhere else.
 *
 * The animals come back where they were: where one starts is a pure function
 * of the layout and the seed, and frozen they never leave it.
 */
async function beside(game: Game): Promise<Beast> {
  const village = await game.seam<Beast[]>("animals");
  for (const beast of village) {
    if (!(await standable(game, beast.col, beast.row + 1))) continue;
    await game.reload(`${FROZEN}&at=${beast.col},${beast.row + 1}`);
    await game.settle(900);
    const again = (await game.seam<Beast[]>("animals")).find((one) => one.id === beast.id);
    if (!again) continue;
    expect({ where: await game.where(), mood: again.mood }).toEqual({
      where: { col: again.col, row: again.row + 1 },
      mood: "asking",
    });
    return again;
  }
  throw new Error("no animal in this village has a square below it to stand on");
}

describe("the animals of the village", () => {
  /**
   * The tap that hands over what is being asked for.
   *
   * One crop out of the basket, a smile where the question was, and nothing
   * else: no arithmetic, no counting, no parchment. What a child gets out of
   * it is a reason to walk over and a reason to have grown a second kind of
   * crop.
   */
  test(
    "one that is asking takes the crop it asks for",
    async () => {
      await play({ seams: FROZEN }, async (game) => {
        const beast = await beside(game);
        const before = await game.held(beast.craves);
        expect({ crops: before > 0, asking: beast.thinking }).toEqual({
          crops: true,
          asking: ["food", "question"],
        });

        await game.tapCell(beast.col, beast.row);
        await game.settle(400);
        const fed = (await game.seam<Beast[]>("animals")).find((one) => one.id === beast.id);

        expect({
          held: await game.held(beast.craves),
          mood: fed?.mood,
          thinking: fed?.thinking,
        }).toEqual({ held: before - 1, mood: "glad", thinking: ["smile"] });
      });
    },
    5 * MINUTES,
  );

  /**
   * And a tap on one that is not asking says what it likes.
   *
   * The report itself: *tapping the rabbit didn't bring up any food, just an
   * empty rabbit*. It was a cloud with nothing in it, and with five of a
   * village's seven animals quiet at any moment that is what most taps got
   * — so the creatures read as scenery.
   *
   * Reached by feeding one and waiting for the smile to run out, which is
   * the only way to a quiet animal that a script can rely on: their clocks
   * are their own, but a fed one is quiet for ten minutes on the dot.
   *
   * And the basket is untouched, which is the other half of it. Saying what
   * an animal likes must not become a way of feeding one that is not asking
   * — otherwise a child clears the village in one lap and there is nothing
   * left in it.
   */
  test(
    "and one that is not asking says what it likes, rather than nothing",
    async () => {
      await play({ seams: FROZEN }, async (game) => {
        const beast = await beside(game);
        await game.tapCell(beast.col, beast.row);
        await game.settle(400);
        const full = await game.held(beast.craves);

        // The smile runs out into the ten quiet minutes a fed animal keeps.
        await game.settle(ANIMAL_GLAD_MS + 800);
        const quiet = (await game.seam<Beast[]>("animals")).find((one) => one.id === beast.id);
        expect({ mood: quiet?.mood, thinking: quiet?.thinking }).toEqual({
          mood: "quiet",
          thinking: [],
        });

        // Tapped again: the crop it likes, on its own. The question mark is
        // the ask, and it is not asking.
        // Read straight after the tap. The cloud is a beat rather than a
        // mood — it fades and puts `thinking` back to what the animal is
        // actually thinking, which is nothing — and a tap already carries
        // half a second of settling inside it.
        await game.tapCell(beast.col, beast.row);
        const tapped = (await game.seam<Beast[]>("animals")).find((one) => one.id === beast.id);
        expect({
          thinking: tapped?.thinking,
          mood: tapped?.mood,
          held: await game.held(beast.craves),
        }).toEqual({ thinking: ["food"], mood: "quiet", held: full });
      });
    },
    5 * MINUTES,
  );

  /**
   * And a spell cast over one does not pick it up.
   *
   * Raised alongside a playtest report about the times spell: *there was
   * also an animal in the target rectangle, but I didn't expect to pick it
   * up.* Nor should she — and the reason it is safe is worth pinning rather
   * than trusting, because it is an accident of where an animal lives. A
   * chicken is a sprite in a list; it was never put on the grid, so nothing
   * that asks the ground what is standing on a square can see one.
   *
   * That accident is exactly the kind that stops being true. The patch's
   * minus has just learned to take *machines* back — things that do stand on
   * squares — and the next step from "machines" to "anything standing here"
   * is a short one. This is the test that would fail on it.
   */
  test(
    "and a rectangle drawn round one takes the machine and leaves the animal",
    async () => {
      await play({ seams: WITH_TIMBER }, async (game) => {
        // A beast with a free square to its right to stand a sorter on, and
        // one below it for her to stand on and reach both.
        const village = await game.seam<Beast[]>("animals");
        let chosen: Beast | undefined;
        for (const beast of village) {
          if (!(await isFree(game, beast.col + 1, beast.row))) continue;
          if (!(await isFree(game, beast.col, beast.row + 1))) continue;
          chosen = beast;
          break;
        }
        if (!chosen) throw new Error("no animal in this village has room beside it");

        const beast = chosen;
        const machine = { col: beast.col + 1, row: beast.row };
        await game.reload(`${WITH_TIMBER}&at=${beast.col},${beast.row + 1}`);
        await game.settle(900);

        expect(await takeFromCrate(game, FixtureType.Sorter)).toBe(true);
        await game.settle(350);
        await game.tapCell(machine.col, machine.row);
        await game.settle(400);

        // A rectangle two squares wide: the animal on one, the machine on
        // the other. A tap on a square an animal is standing on reaches the
        // ground while a spell is being aimed — which is what
        // `pointerIsSpokenFor` is for, and is why the corner can be marked
        // at all.
        await game.tap("spellbook");
        await game.tap(runeButton(Spell.Array));
        expect(await game.tap(patchButton(PatchAction.Clear))).toBe(true);
        await game.settle(300);
        await game.tapCell(beast.col, beast.row);
        await game.settle(300);
        await game.tapCell(machine.col, machine.row);
        await game.settle(700);
        await game.solveNumberLine();
        await game.solveArray();
        await game.settle(900);

        // The machine is hers again and the animal is exactly where it was,
        // still itself, still on its own square.
        const after = (await game.seam<Beast[]>("animals")).find((one) => one.id === beast.id);
        expect({
          held: await game.held(FixtureType.Sorter),
          standing: after ? { col: after.col, row: after.row } : null,
        }).toEqual({ held: 1, standing: { col: beast.col, row: beast.row } });
      });
    },
    5 * MINUTES,
  );
});
