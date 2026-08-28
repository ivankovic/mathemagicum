// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { afterAll, describe, expect, test } from "bun:test";
import { Spell, TAUGHT_BESIDE } from "../src/spells/spellbook";
import { UiAsset } from "../src/ui/assets";
import { RUNE_OF } from "../src/ui/runes";
import { FLOWER_LOOKS, FLOWER_TYPES, type FlowerType } from "../src/world/flowers";
import { PlantType, groundFor } from "../src/world/plants";
import { TerrainType } from "../src/world/terrain";
import { type Game, play, runeButton, seedButton, shutDown } from "./harness";

const MINUTES = 60_000;

afterAll(shutDown);

/**
 * Flowers: found on the map, then planted in a colour.
 *
 * The one thing in this game whose reward is having *gone somewhere*. No
 * sum, no money, no errand — three plants grow wild on a five-hundred-square
 * world and a child has to walk into them.
 *
 * Which is also why every one of these scenarios reads where they are off
 * the world rather than knowing it: the spots are drawn from the world's
 * seed out of every cell the connectivity pass proved walkable, so they are
 * a different answer in every world and a hard-coded one would be a
 * scenario that passed on one seed.
 */

interface Flowers {
  wild: { flower: string; col: number; row: number }[];
  found: string[];
  planted: { flower: string; look: number; col: number; row: number }[];
}

/** The first of the three, and where it grew. */
async function aWildOne(game: Game): Promise<{ flower: string; col: number; row: number }> {
  const seen = await game.seam<Flowers>("flowers");
  const first = seen.wild[0];
  if (!first) throw new Error("this world grew no flowers");
  return first;
}

describe("finding a flower", () => {
  /**
   * Walk into it, and the kind of it is yours.
   *
   * Not one seed: a child who has walked to the far side of the world for a
   * tulip has earned tulips, plural, and being handed exactly one to spend
   * once would turn a discovery into an errand. So the check is that the
   * pouch opens on colours afterwards, and keeps doing so.
   */
  test(
    "picking the wild one unlocks planting that kind",
    async () => {
      await play({ seams: "&hour=12&freezeNpcs" }, async (game) => {
        const wild = await aWildOne(game);
        expect((await game.seam<Flowers>("flowers")).found).toEqual([]);

        // `?at=` rather than walking: it is four hundred tiles away, and
        // that it is reachable at all is what `assets.test.ts` checks.
        await game.reload(`&hour=12&freezeNpcs&at=${wild.col},${wild.row + 1}`);
        await game.tapNear(0, -1);
        await game.settle(700);
        expect((await game.seam<Flowers>("flowers")).found).toEqual([wild.flower]);

        // And it is still standing there. Picking it would make the world a
        // little emptier every time somebody explored it.
        const still = await game.seam<Flowers>("flowers");
        expect(still.wild.map((one) => one.flower)).toEqual([...FLOWER_TYPES]);

        // Kept, too: a discovery that had to be made again after a reload
        // would be a discovery worth nothing.
        await game.reload();
        expect((await game.seam<Flowers>("flowers")).found).toEqual([wild.flower]);
      });
    },
    5 * MINUTES,
  );

  /**
   * And until she has, the button is drawn and does nothing.
   *
   * Drawn rather than left out, which is the offer the spellbook makes with
   * its unlearned runes: a pouch with a gap in it says there is something to
   * find. So the tap has to *land* — asserted, because a check that only
   * looked at whether the colours opened would pass just as well if the tap
   * had missed the pouch altogether.
   */
  test(
    "but the pouch offers nothing to plant before that",
    async () => {
      await play({ seams: "&hour=12&freezeNpcs" }, async (game) => {
        await game.tap("seeds");
        expect(await game.tap(seedButton(FLOWER_TYPES[0] as FlowerType))).toBe(true);
        await game.settle(500);
        const menu = await game.ui();
        expect(Object.keys(menu).filter((name) => name.startsWith("bloom."))).toEqual([]);
        expect((await game.seam<Flowers>("flowers")).planted).toEqual([]);
      });
    },
    5 * MINUTES,
  );
});

describe("planting one", () => {
  /**
   * Two taps: which flower, then which colour.
   *
   * The same order the store settled on — a child decides what they are
   * doing and then goes and does it — and it means the five colours are
   * offered as five pictures of the flower rather than as a colour chart.
   */
  test(
    "in whichever of the five colours she picks",
    async () => {
      await play({ seams: "&hour=12&freezeNpcs&flowers=all" }, async (game) => {
        await game.tap("seeds");
        // Six crops, then the three flowers — appended, so no crop moved.
        await game.tap(seedButton(FLOWER_TYPES[0] as FlowerType));
        await game.settle(400);
        const menu = await game.ui();
        expect(Object.keys(menu).filter((name) => name.startsWith("bloom."))).toHaveLength(
          FLOWER_LOOKS,
        );

        await game.tap("bloom.3");
        // Armed rather than planted: the colour chosen, and now the square.
        expect(await game.seam<string | null>("armed")).toBe("tulip~3");
        await game.tapNear(0, 1);
        await game.settle(700);
        const seen = await game.seam<Flowers>("flowers");
        expect(seen.planted).toHaveLength(1);
        expect(seen.planted[0]?.flower).toBe(FLOWER_TYPES[0] as string);
        expect(seen.planted[0]?.look).toBe(3);
      });
    },
    5 * MINUTES,
  );

  /**
   * As many as she likes, and they stay planted.
   *
   * Finding earns the kind rather than a seed, so a bed can be as long as
   * she wants it — and a bed that vanished overnight would be a bed nobody
   * would plant twice.
   */
  test(
    "as many as she likes, and they are there tomorrow",
    async () => {
      await play({ seams: "&hour=12&freezeNpcs&flowers=all" }, async (game) => {
        // Two, in two places. One would prove nothing about there being no
        // seed to run out of.
        //
        // Stood rather than walked between them: a step is a tween, and a
        // scenario that planted the second one while she was still finishing
        // the first step aimed at the square she had just planted — which is
        // refused, correctly, and looks exactly like running out of seeds.
        const here = await game.where();
        for (const step of [0, 2]) {
          await game.standAt(here.col + step, here.row, "down");
          await game.tap("seeds");
          await game.tap(seedButton(FLOWER_TYPES[1] as FlowerType));
          await game.settle(350);
          await game.tap("bloom.0");
          await game.tapNear(0, 1);
          await game.settle(600);
        }
        const before = await game.seam<Flowers>("flowers");
        expect(before.planted).toHaveLength(2);
        // Both the same kind and the same colour, which is the point: there
        // was never a seed to spend.
        for (const one of before.planted) {
          expect({ flower: one.flower, look: one.look }).toEqual({
            flower: FLOWER_TYPES[1] as string,
            look: 0,
          });
        }

        // And a bed that vanished overnight is a bed nobody plants twice.
        await game.reload();
        expect((await game.seam<Flowers>("flowers")).planted).toEqual(before.planted);
      });
    },
    5 * MINUTES,
  );
});

/**
 * A seed the ground will not take, asked as a question rather than refused.
 *
 * The cactus wants sand and the garden is dirt, so this is the one refusal
 * in the game whose answer is *go somewhere else* — and it says so with the
 * same cloud the animals ask for food in: the seed, and a question mark.
 *
 * **Asserted through a seam and not a screenshot, which cost me an
 * afternoon.** The cloud fades in four hundred milliseconds and every tap
 * helper in this harness waits five hundred before it looks, so a picture
 * taken the obvious way is a picture of an empty field. I read three of
 * those as "the bubble is broken" before catching one with a raw click.
 */
/** What is growing on the square she just aimed at, if anything. */
function plantedBeside(game: Game): Promise<string | null> {
  return game.tab.evaluate(() => {
    const handle = (globalThis as never as Record<string, Record<string, unknown>>).__mathemagicum;
    if (!handle) throw new Error("the game has not put its handle out");
    const session = handle.session as {
      tile: { col: number; row: number };
      grid: { getPlant: (col: number, row: number) => string | null };
    };
    return session.grid.getPlant(session.tile.col, session.tile.row + 1);
  });
}

describe("a seed that will not go in here", () => {
  test(
    "is wondered about, not crossed out",
    async () => {
      await play({ seams: "&hour=12&learned=all&freezeNpcs&crops=5" }, async (game) => {
        await game.tap("seeds");
        await game.tap(seedButton(PlantType.Cactus));
        await game.tapNear(0, 1);

        const thought = await game.seam<{ icons: string[]; crossed: boolean } | null>("thought");
        if (!thought) throw new Error("nothing was thought about the cactus");
        // The *ground it wants*, not the seed she picked. She knows which
        // seed — she has just tapped it — and what she does not know is
        // where to take it. A question rather than a cross, because carrots
        // are fine here and a cactus is fine somewhere, which is not what a
        // cross says.
        expect(thought.crossed).toBe(false);
        expect(thought.icons).toEqual([...groundFor(PlantType.Cactus), UiAsset.MarkQuestion]);
        // And that really is a different square of ground from the one she
        // is standing on, or the hint would be telling her to stay put.
        expect(thought.icons).not.toContain(TerrainType.Dirt);
        // And nothing went in the ground.
        //
        // Asked of the square rather than of the basket: planting spends no
        // seed — they are free, by design — so a basket count is the same
        // number whether the cactus went in or not, and would have passed
        // this test without testing anything.
        expect(await plantedBeside(game)).toBeNull();
      });
    },
    5 * MINUTES,
  );

  /**
   * And a crop that *does* belong here is not wondered about at all.
   *
   * The half that stops the assertion above being satisfied by a game that
   * puts a cloud over her head whatever happens.
   */
  test(
    "while one that will go in simply goes in",
    async () => {
      await play({ seams: "&hour=12&learned=all&freezeNpcs&crops=5" }, async (game) => {
        await game.tap("seeds");
        await game.tap(seedButton(PlantType.Carrot));
        await game.tapNear(0, 1);
        expect(await game.seam("thought")).toBeNull();
        expect(await plantedBeside(game)).toBe(PlantType.Carrot);
      });
    },
    5 * MINUTES,
  );
});

/**
 * The two other things a child can be told no about, and where to go for them.
 *
 * A crossed-out picture says *no* and stops, which to a child who cannot read
 * is a button that does not work. Both of these say where instead: the spell
 * points at the thing you walk towards to be taught it, and the flower shows
 * what it looks like growing so she knows what she is looking for.
 *
 * Through the seam, for the reason the ground hint is: a cloud fades in four
 * hundred milliseconds and every tap helper here waits five hundred.
 */
describe("being told where to go", () => {
  test(
    "a spell nobody has taught her points at where she can be",
    async () => {
      await play({ seams: "&hour=12&freezeNpcs" }, async (game) => {
        await game.tap("spellbook");
        await game.tap(runeButton(Spell.Mirror));

        const thought = await game.seam<{ icons: string[]; crossed: boolean } | null>("thought");
        if (!thought) throw new Error("the unlearned rune said nothing");
        expect(thought.crossed).toBe(false);
        const sight = TAUGHT_BESIDE[Spell.Mirror];
        if (!sight) throw new Error("the mirror spell has nowhere to be learned");
        expect(thought.icons).toEqual([sight, UiAsset.MarkQuestion]);
        // Not the rune she just tapped, which is the thing she already knows.
        expect(thought.icons).not.toContain(RUNE_OF[Spell.Mirror]);
      });
    },
    5 * MINUTES,
  );

  test(
    "and each spell points somewhere of its own",
    async () => {
      await play({ seams: "&hour=12&freezeNpcs" }, async (game) => {
        const seen: string[] = [];
        for (const spell of [Spell.Share, Spell.Hourglass, Spell.Array]) {
          await game.tap("spellbook");
          await game.tap(runeButton(spell));
          const thought = await game.seam<{ icons: string[] } | null>("thought");
          seen.push(thought?.icons[0] ?? "nothing");
          await game.settle(700);
        }
        // Three different sights. A single fallback picture for every
        // unlearned spell would satisfy the test above and tell a child
        // nothing, which is the failure worth guarding.
        expect(new Set(seen).size).toBe(seen.length);
        expect(seen).not.toContain("nothing");
      });
    },
    5 * MINUTES,
  );

  test(
    "and a flower she has not found shows what to look for",
    async () => {
      await play({ seams: "&hour=12&freezeNpcs" }, async (game) => {
        const flower = FLOWER_TYPES[0];
        if (!flower) throw new Error("no flowers in this game");
        await game.tap("seeds");
        await game.tap(seedButton(flower));

        const thought = await game.seam<{ icons: string[]; crossed: boolean } | null>("thought");
        if (!thought) throw new Error("the unfound flower said nothing");
        expect(thought.crossed).toBe(false);
        expect(thought.icons).toEqual([flower, UiAsset.MarkQuestion]);
      });
    },
    5 * MINUTES,
  );
});
