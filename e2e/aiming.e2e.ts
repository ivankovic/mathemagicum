// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { afterAll, describe, expect, test } from "bun:test";
import { Spell } from "../src/spells/spellbook";
import { FixtureType } from "../src/world/fixtures";
import { type Game, PHONE, play, runeButton, shutDown, takeFromCrate } from "./harness";

const MINUTES = 60_000;

afterAll(shutDown);

/**
 * Where a spell lands, and how long the square she picked lasts.
 *
 * Both scenarios here come from one playtest, and they are the two halves of
 * the same thing: *the targeting tile got stuck*, and *minus doesn't pick up
 * machines*. Pointing is the newest thing in the game — the rune goes first
 * and the ground second — and these are the two places the rest of the game
 * had not caught up with it.
 *
 * Neither is visible in a screenshot. A ring on the grass a hundred tiles
 * from where it is drawn, and a subtraction solved for nothing, both look
 * from the outside like a game that is working.
 */
const WITH_TIMBER = "&materials=20&hour=12&freezeNpcs&learned=all";

/** What is standing on a square, by the world's own name for it. */
function objectOn(game: Game, col: number, row: number): Promise<string | null> {
  return game.tab.evaluate(
    ([c, r]) => {
      const handle = (globalThis as never as Record<string, Record<string, unknown>>)
        .__mathemagicum;
      if (!handle) throw new Error("the game has not put its handle out");
      const session = handle.session as {
        grid: { getObjectAt: (col: number, row: number) => { type: string } | null };
      };
      return session.grid.getObjectAt(c as number, r as number)?.type ?? null;
    },
    [col, row] as const,
  );
}

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
          getCrop: (col: number, row: number) => unknown;
        };
      };
      return (
        session.grid.isPassable(c as number, r as number) &&
        !session.grid.getCrop(c as number, r as number)
      );
    },
    [col, row] as const,
  );
}

/**
 * A square at her corner, which is the whole point of this file.
 *
 * Diagonal deliberately. She can *point* at a corner — pointing measures the
 * longest side, so a corner is one square away — and the rule for taking a
 * thing back measured the two sides added together, which makes the same
 * corner two. Every square that fails is one a child can see the ring on.
 */
async function corner(game: Game): Promise<{ col: number; row: number }> {
  const here = await game.where();
  for (const [dCol, dRow] of [
    [1, 1],
    [-1, 1],
    [1, -1],
    [-1, -1],
  ] as const) {
    const at = { col: here.col + dCol, row: here.row + dRow };
    if (await isFree(game, at.col, at.row)) return at;
  }
  throw new Error("she has nothing standing at any of her four corners");
}

describe("the square she is pointing at", () => {
  /**
   * The minus rune takes a machine back from anywhere it can be aimed.
   *
   * Reported from a playtest as *minus doesn't pick up machines*, and it was
   * true of every machine that was not directly beside her. The cast is
   * gated on `withinReach` — three squares, diagonals free — and `takeBack`
   * measured the two sides added together and refused anything past one. So
   * a sorter at her corner passed the gate at a distance of one, opened the
   * parchment, took the answer, spent the cast on the difficulty ladder, and
   * then refused to be lifted.
   *
   * A corner rather than three squares out, because a corner is the nastiest
   * case: to a child it is *next to her*, and it was the near miss that made
   * the whole thing read as "minus doesn't work on machines" rather than as
   * a range.
   */
  test(
    "the minus rune takes back a machine standing at her corner",
    async () => {
      await play({ seams: WITH_TIMBER }, async (game) => {
        const at = await corner(game);

        // Built out of the crate and put down on the corner square, which is
        // a placement the game already allows: pointing reaches it.
        expect(await takeFromCrate(game, FixtureType.Sorter)).toBe(true);
        await game.settle(400);
        await game.tapCell(at.col, at.row);
        await game.settle(500);
        expect(await objectOn(game, at.col, at.row)).toBe(FixtureType.Sorter);
        expect(await game.held(FixtureType.Sorter)).toBe(0);

        // And now the rune that undoes things, aimed at the same square she
        // was just allowed to put it on.
        expect(await game.tap("spellbook")).toBe(true);
        expect(await game.tap(runeButton(Spell.Clearing))).toBe(true);
        await game.settle(400);
        await game.tapCell(at.col, at.row);
        await game.settle(400);
        await game.solveNumberLine();

        // The sum was answered, so the machine is hers again and the square
        // is empty. This is what failed: the parchment closed on a correct
        // answer and the sorter was still standing there.
        expect({
          standing: await objectOn(game, at.col, at.row),
          held: await game.held(FixtureType.Sorter),
        }).toEqual({ standing: null, held: 1 });
      });
    },
    5 * MINUTES,
  );

  /**
   * And putting a thing down leaves no ring behind on a phone.
   *
   * The other way the same report happens, and the likelier one on the
   * device it was reported from. Pointing at a square by tapping it is the
   * mouse's route — on touch a press is the joystick and never reaches it —
   * so on a phone the *only* thing that ever set an aim was putting
   * something down, which points at the square on the child's behalf so that
   * the four placement routes need not know a tap happened.
   *
   * It pointed and did not stop. A ring on the square she had just built on,
   * with no tap that would put it out, until she walked four squares away
   * from it. Everything she did next landed there too.
   *
   * At phone size and with a touchscreen, because that is the whole claim:
   * Phaser takes a different road through its input manager for touch, and
   * the road it takes is the one where nothing else can clear an aim.
   */
  test(
    "and putting a thing down leaves no ring behind her on a phone",
    async () => {
      await play({ seams: WITH_TIMBER, viewport: PHONE, touch: true }, async (game) => {
        const at = await corner(game);
        expect(await takeFromCrate(game, FixtureType.Sorter)).toBe(true);
        await game.settle(400);
        await game.tapCell(at.col, at.row);
        await game.settle(500);

        // It is standing where she tapped, and she is pointing at nothing:
        // the square was the answer to *this* placement and not a mode she
        // has been put into and cannot leave.
        expect({
          standing: await objectOn(game, at.col, at.row),
          aimed: await game.seam<unknown>("aimed"),
        }).toEqual({ standing: FixtureType.Sorter, aimed: null });
      });
    },
    5 * MINUTES,
  );

  /**
   * And a square she pointed at outdoors is not still pointed at indoors.
   *
   * The other half of the same report: *the targeting tile got stuck*. The
   * aim is a fact about the grid she is standing on, and crossing a doorway
   * changes the grid — the marker the times spell draws is dropped at the
   * door for exactly that reason, and the aim was not.
   *
   * Two things went wrong at once, and this asks about the one that can be
   * asked. The ring is carried through the door on a layer that follows her
   * and is drawn at pixels that mean nothing in a room; and `targetTile`
   * goes on answering with a square in the village, so the first chair she
   * puts down in the room is placed at a coordinate out in the garden.
   */
  test(
    "and it does not follow her through the front door",
    async () => {
      await play({ seams: "&hour=12&freezeNpcs&furniture=3" }, async (game) => {
        const doors = await game.seam<Record<string, { col: number; row: number }>>("doors");
        const door = doors["player-house"];
        if (!door) throw new Error("this village has no house for the player");

        // Put down a few squares short of the doorstep and walked the rest.
        //
        // `standAt` moves the session and nothing else: the sprite is still
        // where she was and the camera is following the sprite, so a square
        // named on screen before she has walked is a square off the side of
        // it. Walking is what brings the picture to where she has been put.
        // Short holds, because the door is one step from the doorstep and a
        // long one walks her through it before she has pointed at anything.
        await game.standAt(door.col, door.row + 3, "up");
        for (let go = 0; go < 12; go++) {
          if ((await game.where()).row <= door.row + 2) break;
          await game.walk("ArrowUp", 150);
          await game.stopped();
        }
        expect(await game.where()).toEqual({ col: door.col, row: door.row + 2 });

        // Pointing at the square under her feet, which is a square she may
        // point at like any other and — this is the point — one she is still
        // standing next to when she steps onto the doorstep. Nothing between
        // here and the door can let the aim go for the ordinary reason that
        // she walked out of range of it.
        const chosen = await game.where();
        await game.tapCell(chosen.col, chosen.row);
        await game.settle(250);
        expect(await game.seam<unknown>("aimed")).toEqual(chosen);

        for (let go = 0; go < 4; go++) {
          await game.walk("ArrowUp", 400);
          await game.stopped();
          if ((await game.seam<unknown>("house")) !== null) break;
        }
        expect(await game.seam<unknown>("house")).not.toBeNull();

        // Through the door, and she is pointing at nothing: the village
        // square she chose is not a square in this room.
        expect(await game.seam<unknown>("aimed")).toBeNull();
      });
    },
    5 * MINUTES,
  );
});
