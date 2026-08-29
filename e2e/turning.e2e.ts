// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { afterAll, describe, expect, test } from "bun:test";
import { DecorType, decorItem } from "../src/world/decor";
import { TURNS, Turn } from "../src/world/facing";
import { FixtureType, PLACEABLE_FIXTURES } from "../src/world/fixtures";
import { type Game, play, shutDown, takeFromCrate } from "./harness";

const MINUTES = 60_000;

afterAll(shutDown);

/**
 * Turning a thing round before putting it down.
 *
 * Reported from a playtest: there is no way to rotate objects when placing
 * them. The control is the picture of what she is holding — tapping it turns
 * the thing, and the picture turns with it, so the preview *is* the answer.
 *
 * `facing.test.ts` proves the arithmetic of four ways round from three
 * drawings. What only a browser can say is that the tap reaches the control
 * at all, and that took two goes: a tap while something is armed is handled
 * before the "a button takes its own tap" check, so it fell straight through
 * to the placement and put the bench on the ground; and turning used to
 * destroy the picture and raise another, which meant the scene compared the
 * tap against a different object from the one the pointer had hit.
 */
const GARDEN = "&hour=12&freezeNpcs&learned=all";

/** A few of something to put down, without walking her to the shop for them. */
async function withSome(game: Game, item: string, count = 8): Promise<void> {
  await game.tab.evaluate(
    ([name, many]) => {
      const handle = (globalThis as never as Record<string, Record<string, unknown>>)
        .__mathemagicum;
      if (!handle) throw new Error("the game has not put its handle out");
      (handle.session as { inventory: { add: (item: string, n: number) => void } }).inventory.add(
        name as string,
        many as number,
      );
    },
    [item, count] as const,
  );
}

/** A few benches to put down, without walking her to the shop for them. */
function withBenches(game: Game): Promise<void> {
  return withSome(game, FixtureType.Bench);
}

/** Every bench standing in the world, and which way round each went down. */
function benches(game: Game): Promise<{ col: number; turn: number }[]> {
  return game.tab.evaluate(() => {
    const handle = (globalThis as never as Record<string, Record<string, unknown>>).__mathemagicum;
    if (!handle) throw new Error("the game has not put its handle out");
    const session = handle.session as {
      grid: { listObjects: () => { type: string; col: number; turn?: number }[] };
    };
    return session.grid
      .listObjects()
      .filter((one) => one.type === "bench")
      .map((one) => ({ col: one.col, turn: one.turn ?? 0 }))
      .sort((a, b) => a.col - b.col);
  });
}

/** Tap the picture over her head until it is the way round we want. */
/** One thing standing in the room she is in, as the seam reports it. */
interface Furnishing {
  piece: string;
  col: number;
  row: number;
  look: number;
  turn: number;
}

/** The room she lives in, in the coordinates its own sidecar uses. */
interface House {
  origin: { col: number; row: number };
}

/**
 * In through her own front door, which is where the furniture is.
 *
 * Put down on the doorstep rather than walked from the spawn, for the reason
 * `house.e2e.ts` gives: a child starts eight rows off in their own garden,
 * and walking that is eight seconds of nothing being tested.
 */
async function goHome(game: Game): Promise<House> {
  const door = (await game.seam<Record<string, { col: number; row: number }>>("doors"))[
    "player-house"
  ];
  if (!door) throw new Error("the village has no house for the player");
  await game.standAt(door.col, door.row + 2, "up");
  await game.walk("ArrowUp", 900);
  await game.stopped();
  const house = await game.seam<House | null>("house");
  if (!house) throw new Error("walking through the front door did not go indoors");
  return house;
}

/** A square named the way the room's own sidecar names it. */
async function tapPlan(game: Game, house: House, col: number, row: number): Promise<void> {
  await game.tapCell(col - house.origin.col, row - house.origin.row);
}

async function turnTo(game: Game, want: number): Promise<void> {
  for (let taps = 0; taps <= TURNS.length; taps++) {
    if ((await game.seam<number>("armedTurn")) === want) return;
    const at = (await game.ui()).armed;
    if (!at) throw new Error("nothing is in her hands to turn");
    await game.tab.mouse.click(at.x, at.y);
    await game.tab.waitForTimeout(200);
  }
  throw new Error(`it would not turn to ${want}`);
}

describe("turning a thing before putting it down", () => {
  test(
    "the picture over her head turns, and turning it does not put it down",
    async () => {
      await play({ seams: GARDEN }, async (game) => {
        await withBenches(game);
        await takeFromCrate(game, FixtureType.Bench);
        await game.settle(250);
        expect(await game.seam<number>("armedTurn")).toBe(Turn.Toward);

        // Round once, a tap at a time, and still in her hands at the end.
        // That second half is the bug this scenario was written for: the tap
        // used to reach the ground and place it.
        const seen: number[] = [];
        for (let tap = 0; tap < TURNS.length; tap++) {
          const at = (await game.ui()).armed;
          if (!at) throw new Error("nothing is in her hands");
          await game.tab.mouse.click(at.x, at.y);
          await game.tab.waitForTimeout(200);
          seen.push(await game.seam<number>("armedTurn"));
          expect(await game.seam<string | null>("armed")).toBe(FixtureType.Bench);
        }
        // Every way round, and back where it started.
        expect(seen.slice(0, -1).sort()).toEqual([Turn.Away, Turn.Side, Turn.SideOther]);
        expect(seen.at(-1)).toBe(Turn.Toward);
        expect(await benches(game)).toEqual([]);
      });
    },
    5 * MINUTES,
  );

  /**
   * And it is the rule rather than the bench.
   *
   * Everything a child can put down turns now, and the failure this is here
   * for is one item quietly not doing it — a placeable that shipped a single
   * drawing, so the tap on its picture does nothing and reads as a broken
   * control rather than as a thing that does not turn. `assets.test.ts`
   * holds the sidecars and the game's table together; what only a browser
   * can say is that the tap actually turns each of them.
   *
   * One tap each rather than the full round, which the bench does above.
   * What is being asked here is "does this one turn at all", and asking it
   * eight times over would be paying four hundred taps to learn the same
   * thing eight times.
   */
  test(
    "and everything in the crate turns, not only the bench",
    async () => {
      await play({ seams: GARDEN }, async (game) => {
        for (const fixture of PLACEABLE_FIXTURES) {
          await withSome(game, fixture, 1);
          expect(await takeFromCrate(game, fixture)).toBe(true);
          await game.settle(250);
          expect(await game.seam<number>("armedTurn")).toBe(Turn.Toward);

          const at = (await game.ui()).armed;
          if (!at) throw new Error(`nothing in her hands after taking a ${fixture}`);
          await game.tab.mouse.click(at.x, at.y);
          await game.tab.waitForTimeout(200);

          expect({ fixture, turn: await game.seam<number>("armedTurn") }).toEqual({
            fixture,
            turn: Turn.Away,
          });
          // And it is still in her hands: the tap that turns must not be a
          // tap that puts it down. That is the bug the bench found, and a
          // new placeable is exactly where it could come back.
          expect(await game.seam<string | null>("armed")).toBe(fixture);
          // No need to put it down again: taking the next thing out of the
          // crate arms that instead. See `arm`, which disarms whatever was
          // waiting before it raises the new rune.
        }
      });
    },
    5 * MINUTES,
  );

  /**
   * And indoors, where the same gesture turns a chair.
   *
   * A chair and a bench are the same verb — pick it up, tap its picture,
   * put it down — and the whole point of doing it with one method is that
   * they cannot drift apart. What could still drift is the *save*: a room
   * nobody has rearranged has no stored arrangement and is rebuilt from the
   * sidecar every time, so a turn only survives if `same` counts it as a
   * difference. It did not, at first, and a chair turned and put back where
   * it came from registered as no change at all.
   */
  test(
    "and a chair indoors turns by the same tap, and stays turned",
    async () => {
      await play({ seams: GARDEN }, async (game) => {
        const house = await goHome(game);
        await withSome(game, decorItem(DecorType.Chair, 0), 2);

        // Clear floor, facing clear floor, the way `house.e2e.ts` does it.
        await game.standAt(2 - house.origin.col, 2 - house.origin.row, "down");
        expect(await takeFromCrate(game, DecorType.Chair)).toBe(true);
        await game.settle(300);
        expect(await game.seam<number>("armedTurn")).toBe(Turn.Toward);

        await turnTo(game, Turn.Side);
        // Still in her hands, exactly as outdoors: the tap that turns must
        // never be the tap that puts it down.
        expect(await game.seam<string | null>("armed")).toContain(DecorType.Chair);

        await tapPlan(game, house, 2, 3);
        await game.settle(700);
        expect(
          ((await game.seam<Furnishing[]>("decor")) ?? []).find(
            (one) => one.piece === DecorType.Chair && one.col === 2 && one.row === 3,
          ),
        ).toMatchObject({ turn: Turn.Side });

        // And tomorrow. This is the half a save forgets: everything about a
        // chair that a room *draws* comes back without the turn, so one that
        // went missing looks like a chair that untwisted itself overnight
        // rather than like a broken save.
        await game.reload(GARDEN);
        await game.settle(600);
        await goHome(game);
        expect(
          ((await game.seam<Furnishing[]>("decor")) ?? []).find(
            (one) => one.piece === DecorType.Chair && one.col === 2 && one.row === 3,
          ),
        ).toMatchObject({ turn: Turn.Side });
      });
    },
    5 * MINUTES,
  );

  /**
   * A bed turned is a bed that takes different squares.
   *
   * The half of turning that is not about drawing. A one-by-two bed lying
   * across the room is two-by-one: it covers the cell to its right instead
   * of the cell below, and everything that asks what is standing where has
   * to get the turned answer. `decor.test.ts` proves the arithmetic and
   * `assets.test.ts` holds it against the art; what only a browser can say
   * is that a child turning a bed and putting it down gets a bed on the two
   * squares they were looking at.
   */
  test(
    "and a bed turned across the room takes the squares it is lying on",
    async () => {
      await play({ seams: GARDEN }, async (game) => {
        const house = await goHome(game);
        await withSome(game, decorItem(DecorType.Bed, 0), 2);

        // The clear strip along the top of the cottage: the stove is in one
        // corner and the bookshelf in the other, and the middle of that row
        // and the one under it are empty in every seeded cottage.
        await game.standAt(2 - house.origin.col, 1 - house.origin.row, "down");
        expect(await takeFromCrate(game, DecorType.Bed)).toBe(true);
        await game.settle(300);

        await turnTo(game, Turn.Side);
        await tapPlan(game, house, 2, 2);
        await game.settle(700);

        expect(
          ((await game.seam<Furnishing[]>("decor")) ?? []).find(
            (one) => one.piece === DecorType.Bed && one.col === 2 && one.row === 2,
          ),
        ).toMatchObject({ turn: Turn.Side });

        // And the square to its *right* is spoken for, which it would not be
        // if the bed were still standing on end. Asked by standing in front
        // of that square with a chair and being refused — a refusal leaves
        // the chair in her hands, which is a fact a script can read without
        // looking at pixels.
        //
        // A piece goes down on the square she is *facing* rather than the
        // one that was tapped, so where she stands is the question being
        // asked here and the tap is only how it is asked.
        await withSome(game, decorItem(DecorType.Chair, 0), 1);
        await game.standAt(3 - house.origin.col, 1 - house.origin.row, "down");
        expect(await takeFromCrate(game, DecorType.Chair)).toBe(true);
        await game.settle(300);
        await tapPlan(game, house, 3, 2);
        await game.settle(500);
        expect(
          ((await game.seam<Furnishing[]>("decor")) ?? []).some(
            (one) => one.piece === DecorType.Chair && one.col === 3 && one.row === 2,
          ),
        ).toBe(false);
        // And she still has it. A refusal is not a spending: turning is
        // exactly when a piece asks for a square it was not asking for
        // before, so losing what she was holding on every near miss would
        // make the long furniture the most annoying thing in the room.
        expect(await game.seam<string | null>("armed")).toContain(DecorType.Chair);
        expect(await game.held(decorItem(DecorType.Chair, 0))).toBe(1);
      });
    },
    5 * MINUTES,
  );

  test(
    "and the way round it went down is still true tomorrow",
    async () => {
      await play({ seams: GARDEN }, async (game) => {
        await withBenches(game);
        const me = await game.where();
        for (const turn of TURNS) {
          await takeFromCrate(game, FixtureType.Bench);
          await game.settle(200);
          await turnTo(game, turn);
          await game.tapCell(me.col - 2 + turn, me.row + 2);
          await game.settle(300);
        }
        const down = await benches(game);
        expect(down.map((one) => one.turn)).toEqual([...TURNS]);

        // The half that catches a save which drops it. A placed object is
        // stored as a difference against what the generator would have made,
        // and the turn only counts as a difference if the signature says so.
        await game.reload(GARDEN);
        await game.settle(600);
        expect(await benches(game)).toEqual(down);
      });
    },
    5 * MINUTES,
  );
});
