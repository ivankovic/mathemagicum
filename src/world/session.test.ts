// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import { Facing } from "./characters";
import { FixtureType } from "./fixtures";
import { WorldGrid } from "./grid";
import { PlantStage, PlantType } from "./plants";
import { sceneryType } from "./scenery";
import { type Patch, patchCells } from "./selection";
import {
  AIM_REACH,
  GameSession,
  Outcome,
  stepsBetween,
  stepsToSpeak,
  withinReach,
} from "./session";
import { CROP_PRICE, priceOf } from "./shop";
import { TerrainType } from "./terrain";

// A patch of ground with the player in the middle of it, facing down. Small
// and hand-built rather than generated: a scenario test wants to say "there
// is water to the south" without hunting a 500x500 world for a shore.
function field(terrain: TerrainType = TerrainType.Grass, size = 5): WorldGrid {
  return WorldGrid.empty(size, size, terrain);
}

function session(grid = field()): GameSession {
  return new GameSession({ grid, start: { col: 2, row: 2 }, facing: Facing.Down });
}

/** Plant ahead and cast until it is ripe, the way a player would. */
function growAhead(s: GameSession, plant = PlantType.Carrot): void {
  expect(s.plant(plant).ok).toBe(true);
  for (;;) {
    const target = s.checkGrowth();
    if (!target.ok || !target.tile) break;
    expect(s.growAt(target.tile.col, target.tile.row).ok).toBe(true);
  }
}

describe("facing", () => {
  test("the faced tile is one step in the direction she is looking", () => {
    const s = session();
    expect(s.facingTile()).toEqual({ col: 2, row: 3 });
    s.turnToward(-1, 0);
    expect(s.facing).toBe(Facing.Left);
    expect(s.facingTile()).toEqual({ col: 1, row: 2 });
  });

  test("a step that goes nowhere keeps the current facing", () => {
    const s = session();
    s.turnToward(0, -1);
    expect(s.turnToward(0, 0)).toBe(Facing.Up);
  });
});

describe("planting", () => {
  test("puts a seedling on the tile ahead, not underfoot", () => {
    const s = session();
    const result = s.plant(PlantType.Carrot);
    expect(result.ok).toBe(true);
    expect(result.tile).toEqual({ col: 2, row: 3 });
    expect(s.grid.getCrop(2, 3)?.stage).toBe(PlantStage.Seedling);
    expect(s.grid.getCrop(2, 2)).toBe(null);
  });

  test("refuses terrain the crop cannot take, and says which", () => {
    const s = session(field(TerrainType.Sand));
    const result = s.plant(PlantType.Sunflower);
    expect(result.ok).toBe(false);
    expect(result.outcome).toBe(Outcome.WrongGround);
    expect(s.grid.getCrop(2, 3)).toBe(null);
  });

  test("refuses a tile that is not walkable", () => {
    const grid = field();
    grid.setTerrain(2, 3, TerrainType.Water);
    const s = session(grid);
    expect(s.plant(PlantType.Carrot).ok).toBe(false);
  });

  // Off the edge of the world `getTerrain` throws, so the passability check
  // has to come before anything reads the tile.
  test("refuses the edge of the world without throwing", () => {
    const s = session();
    s.setPosition(2, 4);
    expect(() => s.plant(PlantType.Carrot)).not.toThrow();
    expect(s.plant(PlantType.Carrot).ok).toBe(false);
  });

  test("refuses a tile that already has something growing", () => {
    const s = session();
    s.plant(PlantType.Carrot);
    expect(s.plant(PlantType.Carrot).outcome).toBe(Outcome.AlreadyPlanted);
  });

  test("refuses indoors", () => {
    const s = session();
    s.indoors = true;
    expect(s.plant(PlantType.Carrot).ok).toBe(false);
    expect(s.plant(PlantType.Carrot).outcome).toBe(Outcome.Indoors);
  });
});

describe("growing", () => {
  test("two casts take a seedling to ripe", () => {
    const s = session();
    s.plant(PlantType.Carrot);
    expect(s.grid.getCrop(2, 3)?.stage).toBe(PlantStage.Seedling);
    const first = s.checkGrowth();
    expect(first.ok).toBe(true);
    s.growAt(2, 3);
    expect(s.grid.getCrop(2, 3)?.stage).toBe(PlantStage.Growing);
    s.growAt(2, 3);
    expect(s.grid.getCrop(2, 3)?.stage).toBe(PlantStage.Mature);
  });

  // The scene asks before opening the minigame and applies after solving it.
  // Both halves have to name the same tile, or a cast lands somewhere other
  // than where it was aimed.
  test("the tile checked is the tile grown", () => {
    const s = session();
    s.plant(PlantType.Carrot);
    const target = s.checkGrowth();
    expect(target.tile).toEqual({ col: 2, row: 3 });
    expect(s.growAt(2, 3).tile).toEqual({ col: 2, row: 3 });
  });

  test("refuses a crop that is already grown, and says so", () => {
    const s = session();
    growAhead(s);
    const target = s.checkGrowth();
    expect(target.ok).toBe(false);
    expect(target.outcome).toBe(Outcome.AlreadyGrown);
  });

  test("refuses bare ground", () => {
    expect(session().checkGrowth().ok).toBe(false);
  });

  test("refuses indoors", () => {
    const s = session();
    s.plant(PlantType.Carrot);
    s.indoors = true;
    expect(s.checkGrowth().outcome).toBe(Outcome.Indoors);
  });
});

describe("harvesting", () => {
  test("picks a ripe crop ahead and puts it in the basket", () => {
    const s = session();
    growAhead(s);
    const result = s.harvest();
    expect(result.ok).toBe(true);
    expect(result.tile).toEqual({ col: 2, row: 3 });
    expect(s.inventory.count(PlantType.Carrot)).toBe(1);
    expect(s.grid.getCrop(2, 3)).toBe(null);
  });

  // One rule, two routes: the H key applies it where she stands, a tap turns
  // her toward the crop first. Both have to reach a crop underfoot.
  test("picks a ripe crop underfoot when there is nothing ahead", () => {
    const s = session();
    growAhead(s);
    s.setPosition(2, 3);
    s.turnToward(0, 1); // facing empty ground beyond it
    const result = s.harvest();
    expect(result.ok).toBe(true);
    expect(result.tile).toEqual({ col: 2, row: 3 });
  });

  test("prefers the tile ahead when both have something ripe", () => {
    const s = session();
    growAhead(s); // (2,3)
    s.setPosition(2, 3);
    s.turnToward(0, -1);
    growAhead(s); // (2,2), which she is now facing
    const result = s.harvest();
    expect(result.tile).toEqual({ col: 2, row: 2 });
    expect(s.grid.getCrop(2, 3)).not.toBe(null);
  });

  test("refuses a crop that is not ready, and names it", () => {
    const s = session();
    s.plant(PlantType.Carrot);
    const result = s.harvest();
    expect(result.ok).toBe(false);
    expect(result.outcome).toBe(Outcome.AlreadyPlanted);
    expect(s.grid.getCrop(2, 3)).not.toBe(null);
  });

  test("refuses bare ground", () => {
    expect(session().harvest().outcome).toBe(Outcome.NothingThere);
  });

  test("a picked tile can be planted again", () => {
    const s = session();
    growAhead(s);
    s.harvest();
    expect(s.plant(PlantType.Carrot).ok).toBe(true);
  });
});

describe("putting things down", () => {
  function stocked(): GameSession {
    const s = session();
    s.inventory.add(FixtureType.Fence, 2);
    return s;
  }

  test("puts a fence on the tile ahead and blocks it", () => {
    const s = stocked();
    const result = s.place(FixtureType.Fence);
    expect(result.ok).toBe(true);
    expect(result.tile).toEqual({ col: 2, row: 3 });
    expect(s.grid.isPassable(2, 3)).toBe(false);
    expect(s.inventory.count(FixtureType.Fence)).toBe(1);
  });

  test("refuses when she has none", () => {
    const s = session();
    expect(s.place(FixtureType.Fence).ok).toBe(false);
    expect(s.grid.getObjectAt(2, 3)).toBe(null);
  });

  test("refuses a tile that already has something on it", () => {
    const s = stocked();
    s.place(FixtureType.Fence);
    expect(s.place(FixtureType.Fence).outcome).toBe(Outcome.NoRoom);
    expect(s.inventory.count(FixtureType.Fence)).toBe(1);
  });

  test("refuses a tile with a crop growing on it", () => {
    const s = stocked();
    s.plant(PlantType.Carrot);
    expect(s.place(FixtureType.Fence).outcome).toBe(Outcome.AlreadyPlanted);
  });

  // The well is placed by world generation and is not hers to move.
  test("refuses to put down something that is not stock", () => {
    const s = session();
    s.inventory.add(FixtureType.Fence, 1);
    expect(s.place(FixtureType.Well).ok).toBe(false);
  });

  test("what she puts down she can pick back up", () => {
    const s = stocked();
    s.place(FixtureType.Fence);
    const back = s.takeBack(FixtureType.Fence, 2, 3);
    expect(back.ok).toBe(true);
    expect(s.inventory.count(FixtureType.Fence)).toBe(2);
    expect(s.grid.isPassable(2, 3)).toBe(true);
  });

  test("cannot pick up something out of reach", () => {
    const s = stocked();
    s.place(FixtureType.Fence);
    s.setPosition(0, 0);
    expect(s.takeBack(FixtureType.Fence, 2, 3).outcome).toBe(Outcome.TooFar);
    expect(s.grid.isPassable(2, 3)).toBe(false);
  });

  /**
   * And a machine at her corner is one of them, which it was not.
   *
   * Reported from a playtest as *minus doesn't pick up machines*. It was
   * every machine she was not directly beside: the spell's tap is accepted
   * anywhere she can point, and this measured the two sides added together
   * and refused anything past one — so a corner square that is one away to
   * her and to `withinReach` is two here. She answered the subtraction and
   * the sorter stayed standing.
   *
   * Both measures, in one test, because the bug was the gap between them.
   */
  test("a spell takes back what it can be aimed at, a hand only what is beside her", () => {
    const s = session();
    s.inventory.add(FixtureType.Sorter, 1);
    expect(s.place(FixtureType.Sorter).tile).toEqual({ col: 2, row: 3 });
    // At its corner: one step diagonally, which she can point at.
    s.setPosition(1, 2);
    expect(withinReach(s.tile, { col: 2, row: 3 })).toBe(true);

    expect(s.takeBack(FixtureType.Sorter, 2, 3).outcome).toBe(Outcome.TooFar);
    expect(s.takeBack(FixtureType.Sorter, 2, 3, withinReach).ok).toBe(true);
    expect(s.inventory.count(FixtureType.Sorter)).toBe(1);
    expect(s.grid.isPassable(2, 3)).toBe(true);
  });

  // The reason there is no connectivity check before placing: whatever she
  // walls herself in with is adjacent, so it is always within reach.
  test("she can always undo walling herself in", () => {
    const s = session();
    s.inventory.add(FixtureType.Fence, 4);
    for (const [dCol, dRow] of [
      [0, 1],
      [0, -1],
      [1, 0],
      [-1, 0],
    ] as const) {
      s.turnToward(dCol, dRow);
      expect(s.place(FixtureType.Fence).ok).toBe(true);
    }
    // Boxed in on all four sides...
    for (const [col, row] of [
      [2, 3],
      [2, 1],
      [3, 2],
      [1, 2],
    ] as const) {
      expect(s.grid.isPassable(col, row)).toBe(false);
    }
    // ...and every one of them is still one step away.
    s.turnToward(0, 1);
    expect(s.takeBack(FixtureType.Fence, 2, 3).ok).toBe(true);
    expect(s.grid.isPassable(2, 3)).toBe(true);
  });
});

describe("trading", () => {
  test("selling a crop pays for it", () => {
    const s = session();
    s.inventory.add(PlantType.Carrot, 1);
    expect(s.sell(PlantType.Carrot).ok).toBe(true);
    expect(s.purse.coins).toBe(CROP_PRICE);
    expect(s.inventory.count(PlantType.Carrot)).toBe(0);
  });

  test("buying takes the coins and hands over the goods", () => {
    const s = session();
    s.purse.earn(priceOf(FixtureType.Fence));
    expect(s.buy(FixtureType.Fence).ok).toBe(true);
    expect(s.purse.coins).toBe(0);
    expect(s.inventory.count(FixtureType.Fence)).toBe(1);
  });

  test("buying what she cannot afford changes nothing", () => {
    const s = session();
    expect(s.buy(FixtureType.Lamp).ok).toBe(false);
    expect(s.inventory.count(FixtureType.Lamp)).toBe(0);
  });
});

describe("reach", () => {
  test("gardening reaches one orthogonal step, not a diagonal one", () => {
    expect(stepsBetween({ col: 2, row: 2 }, { col: 2, row: 3 })).toBe(1);
    expect(stepsBetween({ col: 2, row: 2 }, { col: 3, row: 3 })).toBe(2);
  });

  // Talking needs no facing, so a diagonal neighbour is still next to you.
  test("talking reaches a diagonal neighbour", () => {
    expect(stepsToSpeak({ col: 2, row: 2 }, { col: 3, row: 3 })).toBe(1);
    expect(stepsToSpeak({ col: 2, row: 2 }, { col: 4, row: 2 })).toBe(2);
  });
});

// The reason this file exists: the whole loop, in one place, in milliseconds.
describe("the full loop", () => {
  test("plant, grow, pick, sell, buy, put down", () => {
    const s = session();
    const needed = priceOf(FixtureType.Fence) / CROP_PRICE;

    for (let i = 0; i < needed; i++) {
      growAhead(s);
      expect(s.harvest().ok).toBe(true);
    }
    expect(s.inventory.count(PlantType.Carrot)).toBe(needed);

    for (let i = 0; i < needed; i++) expect(s.sell(PlantType.Carrot).ok).toBe(true);
    expect(s.purse.coins).toBe(priceOf(FixtureType.Fence));
    expect(s.inventory.count(PlantType.Carrot)).toBe(0);

    expect(s.buy(FixtureType.Fence).ok).toBe(true);
    expect(s.purse.coins).toBe(0);

    const placed = s.place(FixtureType.Fence);
    expect(placed.ok).toBe(true);
    expect(s.grid.isPassable(2, 3)).toBe(false);
    expect(s.inventory.isEmpty).toBe(true);
  });

  test("a crop in the way is not something you can fence over", () => {
    const s = session();
    s.inventory.add(FixtureType.Fence, 1);
    s.plant(PlantType.Carrot);
    expect(s.place(FixtureType.Fence).ok).toBe(false);
    // ...but pick it first and the tile is free.
    for (;;) {
      const target = s.checkGrowth();
      if (!target.ok || !target.tile) break;
      s.growAt(target.tile.col, target.tile.row);
    }
    expect(s.harvest().ok).toBe(true);
    expect(s.place(FixtureType.Fence).ok).toBe(true);
  });
});

describe("a refusal says where", () => {
  // The property the on-screen mark rests on. A line of small type along the
  // top of the display is unreadable to the child it is for — their eyes are
  // on the square they just tried to plant — so a refusal about a square has
  // to name that square, and only the rule that refused knows which it is.

  test("planting on ground that will not take the seed", () => {
    const grid = WorldGrid.empty(6, 6, TerrainType.Water);
    grid.setTerrain(2, 2, TerrainType.Grass);
    const session = new GameSession({ grid, start: { col: 2, row: 2 }, facing: Facing.Right });
    const result = session.plant(PlantType.Carrot);
    expect(result.ok).toBe(false);
    expect(result.tile).toEqual({ col: 3, row: 2 });
  });

  test("planting where something already grows", () => {
    const grid = WorldGrid.empty(6, 6, TerrainType.Grass);
    grid.plant(3, 2, PlantType.Carrot);
    const session = new GameSession({ grid, start: { col: 2, row: 2 }, facing: Facing.Right });
    const result = session.plant(PlantType.Wheat);
    expect(result.ok).toBe(false);
    expect(result.tile).toEqual({ col: 3, row: 2 });
  });

  test("casting on bare ground", () => {
    const grid = WorldGrid.empty(6, 6, TerrainType.Grass);
    const session = new GameSession({ grid, start: { col: 2, row: 2 }, facing: Facing.Right });
    const result = session.checkGrowth();
    expect(result.ok).toBe(false);
    expect(result.tile).toEqual({ col: 3, row: 2 });
  });

  test("picking something that is not ripe", () => {
    const grid = WorldGrid.empty(6, 6, TerrainType.Grass);
    grid.plant(3, 2, PlantType.Carrot);
    const session = new GameSession({ grid, start: { col: 2, row: 2 }, facing: Facing.Right });
    const result = session.harvest();
    expect(result.ok).toBe(false);
    expect(result.tile).toEqual({ col: 3, row: 2 });
  });

  test("putting a fence where one cannot go", () => {
    const grid = WorldGrid.empty(6, 6, TerrainType.Grass);
    grid.plant(3, 2, PlantType.Carrot);
    const session = new GameSession({ grid, start: { col: 2, row: 2 }, facing: Facing.Right });
    session.inventory.add(FixtureType.Fence, 1);
    const result = session.place(FixtureType.Fence);
    expect(result.ok).toBe(false);
    expect(result.tile).toEqual({ col: 3, row: 2 });
  });

  // The other half of the rule, and the reason `tile` is optional: a refusal
  // that is not about a square has nowhere to point, and marking one anyway
  // would put a cross on a tile that is perfectly fine.
  test("but not when the refusal is about the player rather than a square", () => {
    const grid = WorldGrid.empty(6, 6, TerrainType.Grass);
    const session = new GameSession({ grid, start: { col: 2, row: 2 }, facing: Facing.Right });
    expect(session.place(FixtureType.Fence).tile).toBeUndefined();
    session.indoors = true;
    expect(session.plant(PlantType.Carrot).tile).toBeUndefined();
    expect(session.harvest().tile).toBeUndefined();
    expect(session.checkGrowth().tile).toBeUndefined();
  });
});

describe("clearing what is in the way", () => {
  const tree = (grid: WorldGrid, col: number, row: number) =>
    grid.placeObject({
      id: `tree-${col}-${row}`,
      type: sceneryType("woodland"),
      col,
      row,
      width: 1,
      height: 1,
      blocksMovement: true,
      anchorCol: col,
      anchorRow: row,
    });

  test("the tile in front, the same one planting and growing use", () => {
    const grid = field();
    tree(grid, 2, 3);
    const game = session(grid);
    const target = game.checkClearing();
    expect(target.ok).toBe(true);
    expect(target.tile).toEqual({ col: 2, row: 3 });
  });

  test("bare ground has nothing to take", () => {
    const target = session().checkClearing();
    expect(target.ok).toBe(false);
    expect(target.outcome).toBe(Outcome.NothingThere);
  });

  // A fence you bought is yours, and a spell that unmade it would undo an
  // afternoon's shopping from one mis-aimed cast.
  test("it will not unmake something the player put there", () => {
    const grid = field();
    grid.placeObject({
      id: "fence-2-3",
      type: FixtureType.Fence,
      col: 2,
      row: 3,
      width: 1,
      height: 1,
      blocksMovement: true,
      anchorCol: 2,
      anchorRow: 3,
    });
    const game = session(grid);
    expect(game.checkClearing()).toEqual({
      ok: false,
      outcome: Outcome.NotYours,
      tile: { col: 2, row: 3 },
    });
    // And asking it to anyway changes nothing.
    expect(game.clearAt(2, 3)).toBeNull();
    expect(grid.getObjectAt(2, 3)).not.toBeNull();
  });

  test("taking one away leaves the ground walkable", () => {
    const grid = field();
    tree(grid, 2, 3);
    const game = session(grid);
    expect(grid.isPassable(2, 3)).toBe(false);
    const taken = game.clearAt(2, 3);
    expect(taken?.kind).toBe("scenery");
    expect(taken?.kind === "scenery" && taken.object.type).toBe(sceneryType("woodland"));
    expect(grid.getObjectAt(2, 3)).toBeNull();
    expect(grid.isPassable(2, 3)).toBe(true);
  });

  test("indoors there is nothing the ground grew", () => {
    const grid = field();
    tree(grid, 2, 3);
    const game = session(grid);
    game.indoors = true;
    expect(game.checkClearing()).toEqual({ ok: false, outcome: Outcome.NothingThere });
  });
});

describe("pointing at a square", () => {
  const pointing = () =>
    new GameSession({
      grid: WorldGrid.empty(12, 12, TerrainType.Dirt),
      start: { col: 5, row: 5 },
      facing: Facing.Down,
    });

  /**
   * The reported fault: *spell targeting is hard*. Every action worked on
   * the square she was facing, which is one rule for planting, growing,
   * clearing and picking — and lining a character up with a square is a
   * thing an adult does without noticing and a six-year-old cannot do.
   */
  test("everything acts on the square she pointed at", () => {
    const s = pointing();
    expect(s.targetTile()).toEqual({ col: 5, row: 6 });
    s.aimAt({ col: 7, row: 3 });
    expect(s.targetTile()).toEqual({ col: 7, row: 3 });
    expect(s.plant(PlantType.Carrot).tile).toEqual({ col: 7, row: 3 });
    expect(s.grid.getCrop(7, 3)).not.toBeNull();
  });

  // The facing tile is the fallback rather than being replaced: it is what
  // the keyboard route has, and a child who has not learned to point yet
  // should still be able to plant something.
  test("and on the square she faces when she has not pointed", () => {
    const s = pointing();
    s.face(Facing.Right);
    s.aimAt({ col: 7, row: 3 });
    s.aimAt(null);
    expect(s.targetTile()).toEqual({ col: 6, row: 5 });
  });

  // Three in any direction, diagonals included — a seven-by-seven patch with
  // her in the middle. Far enough to point at what she meant without walking
  // there; near enough that it is still her own garden square.
  test("she can point three squares in any direction and no further", () => {
    const here = { col: 5, row: 5 };
    expect(withinReach(here, { col: 5 + AIM_REACH, row: 5 + AIM_REACH })).toBe(true);
    expect(withinReach(here, { col: 5 - AIM_REACH, row: 5 })).toBe(true);
    expect(withinReach(here, { col: 5 + AIM_REACH + 1, row: 5 })).toBe(false);
    expect(withinReach(here, { col: 5, row: 5 - AIM_REACH - 1 })).toBe(false);
  });

  // Held as a copy. An aim that was the caller's own object would move when
  // they moved it, which is a square that quietly changes under her.
  test("holds the square rather than a reference to it", () => {
    const s = pointing();
    const at = { col: 6, row: 6 };
    s.aimAt(at);
    at.col = 19;
    expect(s.aimed).toEqual({ col: 6, row: 6 });
  });
});

/**
 * A spell asks *where* once, and the answer is about that cast only.
 *
 * The rune is lit first and the ground named second, so the scene has a
 * square in hand before either spell is checked. It passes it rather than
 * aiming with it, and these are the two halves of why: the cast has to land
 * where the tap said, and nothing afterwards may still be pointing there.
 */
describe("a spell told where to land", () => {
  const garden = () =>
    new GameSession({
      grid: WorldGrid.empty(12, 12, TerrainType.Dirt),
      start: { col: 5, row: 5 },
      facing: Facing.Down,
    });

  test("checks the square it was given, not the one in front", () => {
    const s = garden();
    s.aimAt({ col: 8, row: 8 });
    expect(s.plant(PlantType.Carrot).ok).toBe(true);
    // Facing (5,6) and pointing at (8,8); the cast was told (8,8).
    const target = s.checkGrowth({ col: 8, row: 8 });
    expect(target.ok).toBe(true);
    expect(target.tile).toEqual({ col: 8, row: 8 });
  });

  test("and refuses a square that has nothing on it, whatever she faces", () => {
    const s = garden();
    expect(s.plant(PlantType.Carrot).ok).toBe(true); // grows at (5,6)
    expect(s.checkGrowth({ col: 3, row: 3 }).outcome).toBe(Outcome.FacingNothing);
  });

  test("the clearing spell takes one the same way", () => {
    const s = garden();
    s.grid.placeObject({
      id: "tree-7-4",
      type: sceneryType("woodland"),
      col: 7,
      row: 4,
      width: 1,
      height: 1,
      blocksMovement: true,
      anchorCol: 7,
      anchorRow: 4,
    });
    const target = s.checkClearing({ col: 7, row: 4 });
    expect(target.ok).toBe(true);
    expect(target.tile).toEqual({ col: 7, row: 4 });
  });

  /**
   * The reason it is a parameter and not an aim. If a cast left the square
   * behind in `aim`, the next seed she pressed would be planted on it —
   * which is a carrot appearing three squares away for no reason she can
   * see.
   */
  test("leaves nothing pointing at it afterwards", () => {
    const s = garden();
    expect(s.plant(PlantType.Carrot).ok).toBe(true);
    s.checkGrowth({ col: 8, row: 8 });
    expect(s.aimed).toBeNull();
    expect(s.targetTile()).toEqual({ col: 5, row: 6 });
  });
});

describe("pulling a crop back out of the ground", () => {
  /**
   * The undo planting never had.
   *
   * A carrot dropped on the wrong square used to stay there until it was
   * ripe enough to pick — which for a child who has just learned what the
   * seed pouch does is a mistake the game gives them no way to take back.
   * It is also more for the minus spell to do, which is the spell this game
   * under-uses.
   */
  test("the minus spell takes a seedling out", () => {
    const grid = WorldGrid.empty(8, 8, TerrainType.Grass);
    const game = session(grid);
    expect(grid.plant(2, 3, PlantType.Carrot)).toBe(true);
    expect(game.checkClearing({ col: 2, row: 3 })).toEqual({
      ok: true,
      outcome: Outcome.Cleared,
      tile: { col: 2, row: 3 },
    });
    const taken = game.clearAt(2, 3);
    expect(taken?.kind).toBe("crop");
    expect(taken?.kind === "crop" && taken.crop.plant).toBe(PlantType.Carrot);
    expect(grid.getCrop(2, 3)).toBeNull();
  });

  // Whatever stage it is at. A seedling pulled up and a ripe carrot pulled
  // up are the same act — see `removeCrop`, which is deliberately not
  // `harvestCrop` with the maturity rule relaxed.
  test("and a ripe one too, at every stage in between", () => {
    for (const grows of [0, 1, 2]) {
      const grid = WorldGrid.empty(8, 8, TerrainType.Grass);
      const game = session(grid);
      grid.plant(2, 3, PlantType.Carrot);
      for (let n = 0; n < grows; n++) grid.growCrop(2, 3);
      expect({ grows, taken: game.clearAt(2, 3)?.kind }).toEqual({ grows, taken: "crop" });
      expect({ grows, left: grid.getCrop(2, 3) }).toEqual({ grows, left: null });
    }
  });

  /**
   * And nothing goes in the basket for it.
   *
   * Clearing a tree pays wood, because taking a tree out of the ground is
   * work somebody did. Pulling up your own carrot is undoing something, and
   * paying for it would make the minus spell a second way to harvest — one
   * that works before the crop is ripe.
   */
  test("but nothing is picked up for it", () => {
    const grid = WorldGrid.empty(8, 8, TerrainType.Grass);
    const game = session(grid);
    grid.plant(2, 3, PlantType.Carrot);
    for (let n = 0; n < 3; n++) grid.growCrop(2, 3);
    const before = game.inventory.total;
    game.clearAt(2, 3);
    expect(game.inventory.total).toBe(before);
  });

  test("a bare square still has nothing to clear", () => {
    const grid = WorldGrid.empty(8, 8, TerrainType.Grass);
    const game = session(grid);
    expect(game.checkClearing({ col: 2, row: 3 })).toEqual({
      ok: false,
      outcome: Outcome.NothingThere,
      tile: { col: 2, row: 3 },
    });
    expect(game.clearAt(2, 3)).toBeNull();
  });

  // The times spell clears a whole patch, and it has to agree with the one
  // that clears a square — otherwise a rectangle full of seedlings offers
  // nothing to do while every square in it can be cleared one at a time.
  test("and a marked patch offers the crops in it", () => {
    const grid = WorldGrid.empty(12, 12, TerrainType.Grass);
    const game = session(grid);
    grid.plant(3, 3, PlantType.Carrot);
    grid.plant(4, 3, PlantType.Carrot);
    const patch = { col: 2, row: 2, width: 4, height: 3 };
    const offered = game.clearableIn(patch);
    expect(offered.map((at) => `${at.col},${at.row}`).sort()).toEqual(["3,3", "4,3"]);
    for (const at of offered) {
      expect(game.checkClearing(at).ok).toBe(true);
    }
  });
});

describe("picking a whole patch", () => {
  /** Plant every square of a rectangle and bring some of them on to ripe. */
  function bed(grid: WorldGrid, patch: Patch, ripe: number): void {
    for (const [n, at] of patchCells(patch).entries()) {
      expect(grid.plant(at.col, at.row, PlantType.Carrot)).toBe(true);
      if (n >= ripe) continue;
      // Grown rather than staged by hand, so the crop reaches ripe the way
      // the game gets it there.
      while (grid.getCrop(at.col, at.row)?.stage !== PlantStage.Mature) {
        if (!grid.growCrop(at.col, at.row)) break;
      }
    }
  }

  /**
   * `growableIn`'s exact opposite, and the pair is the point: the array
   * spell ripens what is not ripe and the sharing spell picks what is. A
   * patch cast that took the unripe ones too would be a spell that threw
   * half a bed away.
   */
  test("only the ripe squares, and never the unripe ones", () => {
    const patch: Patch = { col: 1, row: 1, width: 2, height: 2 };
    const bare = field(TerrainType.Dirt);
    bed(bare, patch, 0);
    expect(session(bare).pickableIn(patch)).toEqual([]);
    expect(session(bare).growableIn(patch)).toHaveLength(4);

    const half = field(TerrainType.Dirt);
    bed(half, patch, 2);
    expect(session(half).pickableIn(patch)).toHaveLength(2);
    expect(session(half).growableIn(patch)).toHaveLength(2);
  });

  test("picking one square puts it in the basket and leaves the ground bare", () => {
    const grid = field(TerrainType.Dirt);
    bed(grid, { col: 3, row: 3, width: 1, height: 1 }, 1);
    const s = session(grid);
    const before = s.inventory.count(PlantType.Carrot);
    expect(s.harvestAt(3, 3).ok).toBe(true);
    expect(s.inventory.count(PlantType.Carrot)).toBeGreaterThan(before);
    expect(grid.getCrop(3, 3)).toBeNull();
  });

  test("and picking bare ground says so rather than pretending", () => {
    expect(session(field(TerrainType.Dirt)).harvestAt(4, 4).ok).toBe(false);
  });
});
