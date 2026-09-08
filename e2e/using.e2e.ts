// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { afterAll, describe, expect, test } from "bun:test";
import { FixtureType } from "../src/world/fixtures";
import { Use } from "../src/world/uses";
import { type Game, play, shutDown, takeFromCrate } from "./harness";

const MINUTES = 60_000;

afterAll(shutDown);

/**
 * The ring over a tapped thing, and the two answers on it.
 *
 * A tap on a chair used to put it in the basket. Now it asks — *use it, or
 * take it* — in two pictures over the chair, and this file is about the
 * asking: that the ring comes up, that the glad face makes her sit without
 * moving the chair, that the basket takes it exactly as the tap used to,
 * and that a tap anywhere else is *neither*.
 *
 * **The failure this file exists for is the tap that used to pick things
 * up.** Every scenario that lifts furniture now goes through the basket
 * button, and if the ring quietly stopped opening those would all fail in
 * the same way at the same line — which is a lot of red for one cause.
 * This is the one place that cause is named.
 */
const AT_HOME = "&hour=12&materials=40&brickRung=1";
/**
 * Out of doors the villagers are held still. The postal worker otherwise
 * walks the welcome over to anyone standing in the garden for a quarter of
 * a minute, and the welcome is a parchment — modal — so the fence stopped
 * answering taps at exactly the moment the scenario got round to it.
 */
const IN_THE_GARDEN = "&hour=12&materials=40&freezeNpcs";

interface House {
  readonly id: string | null;
  readonly floor: string[];
  readonly origin: { col: number; row: number };
}

interface Piece {
  readonly piece: string;
  readonly col: number;
  readonly row: number;
  readonly look: number;
}

function grid(house: House, col: number, row: number): { col: number; row: number } {
  return { col: col - house.origin.col, row: row - house.origin.row };
}

/**
 * A floor square beside a piece with nothing standing on it.
 *
 * Every piece is treated as two squares by two from its corner, which is
 * bigger than most of them — but a bed is one by two and a rug two by two,
 * and the seam does not say which is which. Over-counting costs a candidate
 * or two; under-counting would stand her in the bath.
 */
function squareBeside(house: House, room: Piece[], at: Piece): { col: number; row: number } {
  const taken = new Set<string>();
  for (const piece of room) {
    for (let dCol = 0; dCol < 2; dCol++) {
      for (let dRow = 0; dRow < 2; dRow++) taken.add(`${piece.col + dCol},${piece.row + dRow}`);
    }
  }
  const floor = new Set(house.floor);
  for (const [dCol, dRow] of [
    [0, 1],
    [0, -1],
    [-1, 0],
    [1, 0],
    [-1, 1],
    [1, 1],
    [-1, -1],
    [1, -1],
  ]) {
    const key = `${at.col + (dCol ?? 0)},${at.row + (dRow ?? 0)}`;
    if (floor.has(key) && !taken.has(key)) {
      return grid(house, at.col + (dCol ?? 0), at.row + (dRow ?? 0));
    }
  }
  throw new Error(`nowhere to stand beside the ${at.piece}`);
}

/** Whether the ring is up, which is to say whether both of its buttons are. */
async function ringIsUp(game: Game): Promise<boolean> {
  const at = await game.ui();
  return Boolean(at["wheel.use"] && at["wheel.take"]);
}

describe("asking what to do with a thing", () => {
  test(
    "the chair asks; the glad face sits her on it and the basket takes it",
    async () => {
      await play({ seams: AT_HOME }, async (game) => {
        const house = await game.goHome();
        const room = await game.seam<Piece[]>("decor");
        const chair = room.find((one) => one.piece === "chair");
        if (!chair) throw new Error("the room she starts in has no chair");
        const beside = squareBeside(house, room, chair);
        await game.standAt(beside.col, beside.row, "down");
        await game.settle(200);

        // The tap asks rather than answers: the ring is up, and nothing has
        // moved. This is the assertion the old behaviour would fail.
        const where = grid(house, chair.col, chair.row);
        await game.tapCell(where.col, where.row);
        await game.settle(300);
        expect(await ringIsUp(game)).toBe(true);
        expect(await game.held("chair~0")).toBe(0);
        expect((await game.seam<Piece[]>("decor")).some((one) => one.piece === "chair")).toBe(true);

        // The glad face: she sits, and stays sat. A chair is a place to be
        // rather than a thing to do, so nothing but the next tap gets her
        // up — read after a wait long enough that a brief use would have
        // been over twice.
        expect(await game.tap("wheel.use")).toBe(true);
        await game.settle(400);
        expect(await game.seam<string | null>("using")).toBe(Use.Sit);
        expect(await ringIsUp(game)).toBe(false);
        await game.settle(2500);
        expect(await game.seam<string | null>("using")).toBe(Use.Sit);
        expect(await game.seam<boolean>("resting")).toBe(true);
        // The tap that gets her up is only that: the square it landed on
        // is not aimed at, walked to or anything else.
        await game.tapCell(where.col - 1, where.row - 1);
        await game.settle(700);
        expect(await game.seam<string | null>("using")).toBeNull();
        expect(await game.seam<boolean>("resting")).toBe(false);
        expect(await game.seam("aimed")).toBeNull();
        // Back where she was, with the chair where it was.
        expect(await game.where()).toEqual(beside);
        expect((await game.seam<Piece[]>("decor")).some((one) => one.piece === "chair")).toBe(true);
        expect(await game.held("chair~0")).toBe(0);

        // A tap away from the ring is neither answer. The floor square she
        // tapped is not aimed at either: a tap that closes a question must
        // not also be a tap on the world.
        await game.tapCell(where.col, where.row);
        await game.settle(300);
        expect(await ringIsUp(game)).toBe(true);
        const elsewhere = grid(house, chair.col, chair.row);
        await game.tapCell(elsewhere.col - 1, elsewhere.row - 1);
        await game.settle(300);
        expect(await ringIsUp(game)).toBe(false);
        expect(await game.seam("aimed")).toBeNull();
        expect(await game.held("chair~0")).toBe(0);

        // The basket: exactly what the tap alone used to do.
        await game.tapCell(where.col, where.row);
        await game.settle(300);
        expect(await game.tap("wheel.take")).toBe(true);
        await game.settle(600);
        expect(await game.held("chair~0")).toBe(1);
        expect((await game.seam<Piece[]>("decor")).some((one) => one.piece === "chair")).toBe(
          false,
        );
        expect(await ringIsUp(game)).toBe(false);
      });
    },
    5 * MINUTES,
  );

  /**
   * Out of doors it is the same ring on a fence, and a use is a thing done
   * from beside it: asked from two squares off, she is shown the way rather
   * than pulled across the garden. Leaning is the *brief* kind — a gesture,
   * over on its own — where sitting above is the kind that lasts.
   */
  test(
    "a fence is leaned on from beside it, and only from beside it",
    async () => {
      await play({ seams: IN_THE_GARDEN }, async (game) => {
        const here = await game.where();
        // A fence needs a square that will take one, and `takeFromCrate`
        // answers for the tap rather than for what came of it — so the
        // basket is filled directly, the way `crate.e2e.ts` does.
        await game.give(FixtureType.Fence, 1);
        await game.settle(200);
        // Two squares down: she starts among her own beds, and a square
        // with a seedling in it refuses a fence. Found by trying, the way
        // the crate scenario does, rather than assumed.
        let at: { col: number; row: number } | null = null;
        for (const [dCol, dRow] of [
          [0, 2],
          [2, 0],
          [0, -2],
          [-2, 0],
          [1, 2],
          [2, 1],
        ]) {
          const square = { col: here.col + (dCol ?? 0), row: here.row + (dRow ?? 0) };
          expect(await takeFromCrate(game, FixtureType.Fence)).toBe(true);
          await game.settle(300);
          await game.tapCell(square.col, square.row);
          await game.settle(500);
          if ((await game.held(FixtureType.Fence)) === 0) {
            at = square;
            break;
          }
          // Refused, and still in her hands: put the rune out and try again.
          await game.tap("armed");
          await game.settle(200);
        }
        if (!at) throw new Error("no square near her would take a fence");

        // From two squares off: the ring opens — taking works from that
        // far — but the use is refused, and she stays put.
        await game.tapCell(at.col, at.row);
        await game.settle(300);
        expect(await ringIsUp(game)).toBe(true);
        expect(await game.tap("wheel.use")).toBe(true);
        await game.settle(400);
        expect(await game.seam<string | null>("using")).toBeNull();
        expect(await game.where()).toEqual(here);

        // From beside it: she leans.
        const step = { col: Math.sign(at.col - here.col), row: Math.sign(at.row - here.row) };
        const beside = { col: at.col - step.col, row: at.row - step.row };
        await game.standAt(beside.col, beside.row, "down");
        await game.settle(200);
        await game.tapCell(at.col, at.row);
        await game.settle(300);
        expect(await game.tap("wheel.use")).toBe(true);
        await game.settle(300);
        expect(await game.seam<string | null>("using")).toBe(Use.Lean);
        await game.settle(1500);
        expect(await game.seam<string | null>("using")).toBeNull();
        expect(await game.held(FixtureType.Fence)).toBe(0);
        expect(await game.where()).toEqual(beside);
      });
    },
    5 * MINUTES,
  );
});
