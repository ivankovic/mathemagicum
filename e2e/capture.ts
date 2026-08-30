// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

/**
 * Freeze a real save, so a later build can be made to read it.
 *
 * **Run by hand, never by the suite.** `run.ts` globs `e2e/*.e2e.ts` and this
 * is deliberately not one: a capture that ran with the tests would rewrite
 * the very fixtures they check, which is a corpus that always passes and
 * proves nothing.
 *
 *     bun e2e/capture.ts
 *
 * The point of doing it this way rather than writing the JSON out by hand is
 * that a handmade fixture tests what somebody *believed* the format was. This
 * plays the game — the real crate, the real spells, the real autosave — and
 * keeps whatever came out. The first time it was run it found a bug: a wire
 * was missing from the file because walking indoors had deleted it.
 *
 * What it writes is every `mathemagicum.` key, because a save is not only the
 * world: the games index, who is playing, and each child's progress are all
 * things a later build has to keep reading.
 */

import { Spell } from "../src/spells/spellbook";
import { CRATE_WIRE } from "../src/world/crate";
import { DecorType, decorItem } from "../src/world/decor";
import { FixtureType } from "../src/world/fixtures";
import { type Game, play, runeButton, shutDown, takeFromCrate } from "./harness";

/** Where the frozen saves live. Named for the day and the shape they are. */
const OUT = "src/save/fixtures";

const SEAMS = "&hour=12&freezeNpcs&learned=all&materials=99&coins=999";

/** Put something in her basket without walking her to a shop for it. */
function give(game: Game, item: string, count: number): Promise<void> {
  return game.tab.evaluate(
    ([of, many]) => {
      const handle = (globalThis as never as Record<string, Record<string, unknown>>)
        .__mathemagicum;
      if (!handle) throw new Error("the game has not put its handle out");
      (handle.session as { inventory: { add: (of: string, n: number) => void } }).inventory.add(
        of as string,
        many as number,
      );
    },
    [item, count] as const,
  );
}

/** Squares beside her that will take something put down on them. */
function freeBeside(game: Game, at: { col: number; row: number }) {
  return game.tab.evaluate(
    ([c, r]) => {
      const handle = (globalThis as never as Record<string, Record<string, unknown>>)
        .__mathemagicum;
      if (!handle) throw new Error("the game has not put its handle out");
      const session = handle.session as {
        grid: {
          isPassable: (col: number, row: number) => boolean;
          getCrop: (col: number, row: number) => unknown;
          getObjectAt: (col: number, row: number) => unknown;
        };
      };
      const out: { col: number; row: number }[] = [];
      for (const [dc, dr] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
        [1, 1],
        [-1, -1],
        [1, -1],
        [-1, 1],
      ] as const) {
        const col = (c as number) + dc;
        const row = (r as number) + dr;
        const clear =
          session.grid.isPassable(col, row) &&
          !session.grid.getCrop(col, row) &&
          !session.grid.getObjectAt(col, row);
        if (clear) out.push({ col, row });
      }
      return out;
    },
    [at.col, at.row] as const,
  );
}

/** Tap the picture over her head, which is how a thing is turned. */
async function turnOnce(game: Game): Promise<void> {
  const rune = (await game.ui()).armed;
  if (!rune) return;
  await game.tab.mouse.click(rune.x, rune.y);
  await game.tab.waitForTimeout(200);
}

await play({ seams: SEAMS }, async (game) => {
  const here = await game.where();
  const free = await freeBeside(game, here);
  if (free.length < 3) throw new Error(`only ${free.length} free squares beside her`);
  const [fenceAt, sorterAt, houseAt] = free as { col: number; row: number }[];
  if (!fenceAt || !sorterAt || !houseAt) throw new Error("not enough room");

  // A fence she owns, turned before it went down — so the fixture carries
  // both `mine` and a `turn` on a placed object.
  await give(game, FixtureType.Fence, 3);
  await takeFromCrate(game, FixtureType.Fence);
  await game.settle(300);
  await turnOnce(game);
  await game.tapCell(fenceAt.col, fenceAt.row);
  await game.settle(400);

  // A crop in the ground, at whatever stage the growth spell leaves it.
  await game.tap("seeds");
  await game.settle(200);
  await game.tap("seeds.0");
  await game.settle(300);
  await game.tapCell(here.col, here.row);
  await game.settle(400);

  // Two machines, woken by their own arithmetic, one of them fed.
  await takeFromCrate(game, FixtureType.Sorter);
  await game.settle(300);
  await game.tapCell(sorterAt.col, sorterAt.row);
  await game.settle(400);
  await game.tapCell(sorterAt.col, sorterAt.row);
  await game.settle(400);
  await game.solveShare();
  await game.settle(400);
  // More carrots than she has of anything else, or the sorter — which takes
  // whatever it is given — eats the stone the next machine is built from.
  await give(game, "carrot", 250);
  await game.tapCell(sorterAt.col, sorterAt.row);
  await game.settle(400);

  await takeFromCrate(game, FixtureType.Hothouse);
  await game.settle(300);
  await game.tapCell(houseAt.col, houseAt.row);
  await game.settle(400);
  await game.tapCell(houseAt.col, houseAt.row);
  await game.settle(400);
  await game.solveArray();
  await game.settle(400);

  // And a line between them.
  await takeFromCrate(game, CRATE_WIRE);
  await game.settle(300);
  await game.tapCell(sorterAt.col, sorterAt.row);
  await game.settle(300);
  await game.tapCell(houseAt.col, houseAt.row);
  await game.settle(400);

  // Indoors: a room built out, and a chair moved and turned.
  const doors = await game.seam<Record<string, { col: number; row: number }>>("doors");
  const door = doors["player-house"];
  if (!door) throw new Error("this world has no house for the player");
  await game.standAt(door.col, door.row + 2, "up");
  await game.walk("ArrowUp", 900);
  await game.stopped();
  const house = await game.seam<{
    origin: { col: number; row: number };
    buildable: { col: number; row: number }[];
  } | null>("house");
  if (!house) throw new Error("walking through the front door did not go indoors");

  // Building costs materials, and she has just fed a machine — so she is
  // given them again here rather than being assumed to have any left.
  await give(game, "wood", 40);
  await give(game, "stone", 40);
  const grow = house.buildable[0];
  if (grow) {
    await game.tap("spellbook");
    await game.tap(runeButton(Spell.Growth));
    // `buildable` is already in the grid's own coordinates, not the plan's —
    // unlike `floor`, which is the room's. Subtracting the origin here sent
    // the tap several squares away and built nothing at all.
    await game.tapCell(grow.col, grow.row);
    await game.settle(400);
    // A square of house is paid for with a wall of bricks, not a number
    // line: the plus rune opens a different parchment indoors.
    await game.solveWall();
    await game.settle(600);
  }

  await give(game, decorItem(DecorType.Chair, 2), 2);
  await game.standAt(2 - house.origin.col, 1 - house.origin.row, "down");
  await takeFromCrate(game, DecorType.Chair);
  await game.settle(300);
  await turnOnce(game);
  await game.tapCell(2 - house.origin.col, 2 - house.origin.row);
  await game.settle(700);

  const saved = await game.tab.evaluate(() => {
    const out: Record<string, string> = {};
    for (let at = 0; at < localStorage.length; at++) {
      const key = localStorage.key(at);
      if (key?.startsWith("mathemagicum.")) out[key] = localStorage.getItem(key) ?? "";
    }
    return out;
  });

  const game_ = Object.entries(saved).find(([key]) => key.startsWith("mathemagicum.game."));
  if (!game_) throw new Error("nothing was saved at all");
  const world = (JSON.parse(game_[1]) as { world?: { world?: Record<string, unknown> } }).world
    ?.world;
  const held = Object.entries(world ?? {}).map(
    ([field, value]) =>
      `${field}=${Array.isArray(value) ? value.length : Object.keys(value as object).length}`,
  );
  console.error(`captured: ${held.join(" ")}`);

  const stamp = new Date().toISOString().slice(0, 10);
  const file = `${OUT}/${stamp}.json`;
  await Bun.write(file, `${JSON.stringify(saved, null, 2)}\n`);
  console.error(`wrote ${file}`);
});
await shutDown();
