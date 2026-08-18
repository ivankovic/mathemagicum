// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import { Facing } from "./characters";
import { FixtureType } from "./fixtures";
import { WorldGrid } from "./grid";
import { PlantStage, PlantType } from "./plants";
import { GameSession, stepsBetween, stepsToSpeak } from "./session";
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
    expect(result.message).toContain("sand");
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
    expect(s.plant(PlantType.Carrot).message).toContain("already planted");
  });

  test("refuses indoors", () => {
    const s = session();
    s.indoors = true;
    expect(s.plant(PlantType.Carrot).ok).toBe(false);
    expect(s.plant(PlantType.Carrot).message).toBe("Nothing grows indoors");
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
    expect(target.message).toContain("already fully grown");
  });

  test("refuses bare ground", () => {
    expect(session().checkGrowth().ok).toBe(false);
  });

  test("refuses indoors", () => {
    const s = session();
    s.plant(PlantType.Carrot);
    s.indoors = true;
    expect(s.checkGrowth().message).toBe("Nothing grows indoors");
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
    expect(result.message).toContain("not ready");
    expect(s.grid.getCrop(2, 3)).not.toBe(null);
  });

  test("refuses bare ground", () => {
    expect(session().harvest().message).toContain("Face something you planted");
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
    expect(s.place(FixtureType.Fence).message).toContain("no room");
    expect(s.inventory.count(FixtureType.Fence)).toBe(1);
  });

  test("refuses a tile with a crop growing on it", () => {
    const s = stocked();
    s.plant(PlantType.Carrot);
    expect(s.place(FixtureType.Fence).message).toContain("growing");
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
    expect(s.takeBack(FixtureType.Fence, 2, 3).message).toContain("Too far");
    expect(s.grid.isPassable(2, 3)).toBe(false);
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
