// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import type { AnchorPlacements, AreaPlacement } from "./anchors";
import { floodFillReachable, isReachable } from "./connectivity";
import { type HighCorner, highEdges } from "./elevation";
import type { Grove } from "./enchantedForest";
import type { WorldGrid } from "./grid";
import { LANDMARK_FOOTPRINT, LANDMARK_OVERHANG, LandmarkType } from "./landmarks";
import { TerrainType } from "./terrain";
import { generateWorld } from "./worldGenerator";

// Smaller than the real 500x500 target so a 20-seed sweep stays fast
// (~350ms observed); a single dedicated test below runs at full scale.
const SWEEP_SIZE = 150;
const SWEEP_SEEDS = Array.from({ length: 20 }, (_, i) => i);

function allAnchors(anchors: AnchorPlacements): AreaPlacement[] {
  return [
    anchors.village,
    anchors.harbour,
    anchors.bigCity,
    anchors.observatory,
    anchors.enchantedForest,
  ];
}

function centerOf(area: AreaPlacement): { col: number; row: number } {
  return {
    col: area.col + Math.floor(area.width / 2),
    row: area.row + Math.floor(area.height / 2),
  };
}

/**
 * The grove is walkable-to, and the tree is still standing in it.
 *
 * Both halves matter and they pull against each other: a path carved to the
 * middle of the clearing satisfies the first on its own by deleting the
 * thing worth walking to.
 */
function assertGroveIsReachedAndStandsThere(
  grid: WorldGrid,
  reachable: ReturnType<typeof floodFillReachable>,
  grove: Grove,
): void {
  expect(grid.isPassable(grove.doorstep.col, grove.doorstep.row)).toBe(true);
  expect(isReachable(reachable, grid, grove.doorstep)).toBe(true);
  const standing = grid.getObjectAt(grove.tree.col + 1, grove.tree.row + 1);
  expect(standing?.type).toBe(LandmarkType.GreatTree);
  for (let row = grove.tree.row; row < grove.tree.row + 3; row++) {
    for (let col = grove.tree.col; col < grove.tree.col + 3; col++) {
      expect(grid.isPassable(col, row)).toBe(false);
    }
  }
}

/**
 * A harbour with water in it, and land to build on.
 *
 * The world used to make neither reliably. Placement asked only that the
 * box's *mean* elevation sit in the sand-to-grass band, which a box entirely
 * above the waterline satisfies comfortably — and then the flatten pass
 * turned whatever sea was left into sand for being unwalkable. Most seeds
 * put the docks in a field, and nothing said so, because a field is a
 * perfectly valid piece of world.
 *
 * Checked as a fraction rather than as "at least one water tile": a harbour
 * with a puddle in the corner passes that and is the same field.
 */
function assertTheHarbourHasSeaInIt(grid: WorldGrid, harbour: AreaPlacement): void {
  let wet = 0;
  let cells = 0;
  for (let row = harbour.row; row < harbour.row + harbour.height; row++) {
    for (let col = harbour.col; col < harbour.col + harbour.width; col++) {
      if (grid.getTerrain(col, row) === TerrainType.Water) wet++;
      cells++;
    }
  }
  const sea = wet / cells;
  expect({ sea: sea > 0.08 }).toEqual({ sea: true });
  expect({ land: sea < 0.7 }).toEqual({ land: true });
}

/**
 * The harbour and the city can be walked into, and walked about in.
 *
 * Their *doorsteps*, not their middles — the city's middle is the clock
 * tower's square and the harbour's is frequently open sea, and connectivity
 * carves by removing whatever is in the way, so a pass aimed at either would
 * either delete something or fail. The village learned this the hard way
 * with its garden gate and the forest with its great tree.
 *
 * The piers are checked too, and they are the interesting half: a plank is
 * the only thing in the world that makes unwalkable ground walkable, so a
 * pier whose root is not reachable from the shore is a jetty in the middle
 * of a bay.
 */
function assertYouCanGetIntoTheSettlements(
  grid: WorldGrid,
  reachable: ReturnType<typeof floodFillReachable>,
  world: ReturnType<typeof generateWorld>,
): void {
  expect(isReachable(reachable, grid, world.city.doorstep)).toBe(true);
  assertTheWallIsAWall(grid, world.city);
  // The middle of the city, not merely its gate: a gate that opened onto a
  // block walled in by its own buildings would pass a doorstep check. A cell
  // of the square rather than the tower on it, because the tower is a
  // building and you cannot walk into a building.
  expect(isReachable(reachable, grid, world.city.plazaCell)).toBe(true);
  expect(world.city.clockTower?.type).toBe(LandmarkType.ClockTower);
  assertNothingHidesBehindTheClock(world.city);
  assertSomebodyLivesThere(world);

  const harbour = world.harbour;
  if (!harbour) return;
  // The beacon stands on land at the end of the shore, on every cell it
  // blocks. A tower with a foot in the sea is the failure this catches, and
  // it is not one a screenshot of the other end of the harbour would show.
  if (harbour.lighthouse) {
    const tower = harbour.lighthouse;
    expect(tower.type).toBe(LandmarkType.Lighthouse);
    expect({ width: tower.width, height: tower.height }).toEqual({
      width: LANDMARK_FOOTPRINT,
      height: LANDMARK_FOOTPRINT,
    });
    for (let row = tower.row; row < tower.row + tower.height; row++) {
      for (let col = tower.col; col < tower.col + tower.width; col++) {
        expect(grid.getTerrain(col, row)).not.toBe(TerrainType.Water);
        expect(grid.isBridged(col, row)).toBe(false);
        expect(grid.isPassable(col, row)).toBe(false);
      }
    }
  }
  expect(grid.isPassable(harbour.doorstep.col, harbour.doorstep.row)).toBe(true);
  expect(isReachable(reachable, grid, harbour.doorstep)).toBe(true);
  expect(grid.isBridged(harbour.doorstep.col, harbour.doorstep.row)).toBe(false);
  const ship = harbour.ship;
  if (ship) {
    // She floats. Every cell of her footprint is open water, or she is a
    // ship aground — which nothing else in the game would notice, because a
    // building on a beach is a perfectly ordinary building.
    for (let row = ship.row; row < ship.row + ship.height; row++) {
      for (let col = ship.col; col < ship.col + ship.width; col++) {
        expect(grid.getTerrain(col, row)).toBe(TerrainType.Water);
        expect(grid.isBridged(col, row)).toBe(false);
      }
    }
    // And you can board her. Her door is the middle of her southern row —
    // every door in this game is in the south wall — so the cell a player
    // stands on is the one directly below it, and it has to be planked and
    // walkable and connected to everywhere else.
    //
    // This is the check that caught the first gangway: it was laid back
    // along the line the search walked out on, which moors her perfectly and
    // leaves her unboardable on any coast that does not happen to face
    // north.
    const board = { col: ship.col + Math.floor(ship.width / 2), row: ship.row + ship.height };
    expect(grid.isBridged(board.col, board.row) || grid.isPassable(board.col, board.row)).toBe(
      true,
    );
    expect(isReachable(reachable, grid, board)).toBe(true);
    for (const plank of harbour.gangway) {
      expect(grid.isBridged(plank.col, plank.row)).toBe(true);
      expect(isReachable(reachable, grid, plank)).toBe(true);
    }
  }

  for (const pier of harbour.piers) {
    for (const plank of pier) {
      expect(grid.isBridged(plank.col, plank.row)).toBe(true);
      expect(grid.isPassable(plank.col, plank.row)).toBe(true);
      expect(isReachable(reachable, grid, plank)).toBe(true);
    }
  }
}

/**
 * The city wall is unbroken, and there is exactly one way through it.
 *
 * The failure this exists for is the one the village's garden gate had:
 * `ensureConnectivity` carves by *removing whatever is in the way*, so a
 * route aimed anywhere inside the walls reaches it by knocking a hole in
 * them — and a hole is invisible to every check that only asks whether the
 * city can be walked into, because a hole is a perfectly good way in.
 *
 * So this counts the pieces. One gap, at the gate, and it is passable;
 * everything else on the ring is wall, and it is not.
 */
function assertTheWallIsAWall(
  grid: WorldGrid,
  city: ReturnType<typeof generateWorld>["city"],
): void {
  const ways = city.wall.filter((piece) => !piece.blocksMovement);
  expect(ways.length).toBe(1);
  const gate = ways[0] as (typeof city.wall)[number];
  expect(grid.isPassable(gate.col, gate.row)).toBe(true);

  // Every piece the layout laid is still standing where it laid it. A wall
  // that came back with three of its stones missing would still enclose a
  // city everywhere this test looked if it only sampled.
  for (const piece of city.wall) {
    const standing = grid.getObjectAt(piece.col, piece.row);
    expect({ at: `${piece.col},${piece.row}`, type: standing?.type }).toEqual({
      at: `${piece.col},${piece.row}`,
      type: piece.type,
    });
    expect(grid.isPassable(piece.col, piece.row)).toBe(piece === gate);
  }

  // And the ring really is a ring: four corners and four runs, so the count
  // is the perimeter of the box it was laid on rather than however many
  // cells happened to be free when it was built.
  const width =
    city.wall.reduce((most, p) => Math.max(most, p.col), 0) -
    city.wall.reduce((least, p) => Math.min(least, p.col), Number.POSITIVE_INFINITY) +
    1;
  const height =
    city.wall.reduce((most, p) => Math.max(most, p.row), 0) -
    city.wall.reduce((least, p) => Math.min(least, p.row), Number.POSITIVE_INFINITY) +
    1;
  expect(city.wall.length).toBe(2 * width + 2 * height - 4);

  // Laid stone from wall to wall, with nothing growing between the houses.
  //
  // It was the streets and the ring road only, and a playtest called it a
  // set of houses standing in a muddy field: the wall and the street grid
  // were doing all the work of saying *city* and the ground was arguing
  // with them. Swept rather than sampled, because the failure this is
  // guarding against is exactly a patch that got missed.
  //
  // It follows from this that nothing inside the walls can be planted —
  // cobble is not soil — and that is intended. The garden is at home.
  const left = city.wall.reduce((least, p) => Math.min(least, p.col), Number.POSITIVE_INFINITY);
  const top = city.wall.reduce((least, p) => Math.min(least, p.row), Number.POSITIVE_INFINITY);
  for (let row = top; row < top + height; row++) {
    for (let col = left; col < left + width; col++) {
      if (!grid.inBounds(col, row)) continue;
      expect({ at: `${col},${row}`, ground: grid.getTerrain(col, row) }).toEqual({
        at: `${col},${row}`,
        ground: TerrainType.Cobble,
      });
    }
  }
}

/**
 * The city and the harbour have people in them, and shops with somebody in.
 *
 * A playtest said it plainly — *the city has no people*, and *the harbour and
 * city should have shops*. Twenty-four buildings and nobody on the street is
 * a model of a city; a shop with nobody behind the counter is a room with a
 * door.
 *
 * Two properties rather than a count. Every outdoor person stands somewhere
 * that can be walked on, or they are a villager inside a lamp post; and
 * every id in the world is its own, or the second shopkeeper overwrites the
 * first in every map the scene keeps them in.
 */
function assertSomebodyLivesThere(world: ReturnType<typeof generateWorld>): void {
  const everybody = [...world.village.npcs, ...world.city.npcs, ...(world.harbour?.npcs ?? [])];
  const ids = everybody.map((npc) => npc.id);
  expect(new Set(ids).size).toBe(ids.length);

  // The city always has shops, whatever the dice say. It used to be a roll
  // per block, which came out at none often enough to matter — and a city
  // with no shop fails the thing the shops were asked for, on a seed nobody
  // could predict.
  expect(world.city.buildings.filter((b) => b.type === "store").length).toBeGreaterThan(0);

  for (const place of [world.city.npcs, world.harbour?.npcs ?? []]) {
    expect(place.some((npc) => !npc.indoors)).toBe(true);
    for (const npc of place) {
      if (npc.indoors) continue;
      const standable = world.grid.isPassable(npc.home.col, npc.home.row);
      expect({ npc: npc.id, standable }).toEqual({ npc: npc.id, standable: true });
    }
  }
  // Every shop has exactly one keeper, and every keeper a shop.
  for (const buildings of [world.city.buildings, world.harbour?.buildings ?? []]) {
    for (const shop of buildings.filter((building) => building.type === "store")) {
      const keepers = everybody.filter((npc) => npc.homeBuildingId === shop.id);
      expect({ shop: shop.id, keepers: keepers.length }).toEqual({ shop: shop.id, keepers: 1 });
    }
  }
}

/**
 * Nothing is built where the clock tower's own art would cover it.
 *
 * A playtest reported "buildings behind the clocktower are blocked". Nothing
 * was blocked — every door was reachable and every cell inside the walls
 * could be walked to — but the tower is five tiles taller than the two it
 * stands on, so the block behind it was drawn over completely, and a
 * building nobody can see is a building that is not there.
 *
 * Swept over every building rather than checking the one nearest the tower:
 * the plaza is chosen from wherever the blocks fall, so which block sits
 * behind it is a fact about the seed.
 */
function assertNothingHidesBehindTheClock(city: ReturnType<typeof generateWorld>["city"]): void {
  const tower = city.clockTower;
  if (!tower) return;
  const above = LANDMARK_OVERHANG[LandmarkType.ClockTower];
  for (const building of city.buildings) {
    const overlaps =
      building.col < tower.col + tower.width &&
      tower.col < building.col + building.width &&
      building.row < tower.row + tower.height &&
      tower.row - above < building.row + building.height;
    expect({ building: building.id, overlaps }).toEqual({ building: building.id, overlaps: false });
  }
}

/**
 * The harbour's water is south of its town, in every world.
 *
 * The world rises to the north-west and falls to the south-east, so a box
 * that straddles the waterline can find its water on its eastern side as
 * easily as its southern. Both are coasts; only one of them is the coast
 * this game is built around — every door is in the south wall, so a quay
 * laid along an eastern shore puts the warehouses' fronts to the sea and
 * their backs to the town, and the great ship moors with her entry port
 * facing open water.
 *
 * It is also the half of "the world always faces the same way" a child can
 * actually use: the harbour is *down* the map, in this world and the next.
 */
function assertTheSeaIsSouthOfTheHarbour(grid: WorldGrid, harbour: AreaPlacement): void {
  const half = harbour.row + harbour.height / 2;
  let north = 0;
  let south = 0;
  for (let row = harbour.row; row < harbour.row + harbour.height; row++) {
    for (let col = harbour.col; col < harbour.col + harbour.width; col++) {
      if (grid.getTerrain(col, row) !== TerrainType.Water) continue;
      if (row >= half) south++;
      else north++;
    }
  }
  const southward = south / Math.max(1, south + north);
  expect({ southward: southward > 0.6 }).toEqual({ southward: true });
}

function boxesOverlap(a: AreaPlacement, b: AreaPlacement): boolean {
  return !(
    a.col + a.width <= b.col ||
    b.col + b.width <= a.col ||
    a.row + a.height <= b.row ||
    b.row + b.height <= a.row
  );
}

/**
 * The world's two far edges are open water along their whole length.
 *
 * Only two: the world slopes down from one corner, so the two edges *at*
 * that corner are the high ground it descends from. They are meant to be
 * walled by rock and forest rather than by sea, and are checked separately.
 */
function assertFarEdgesAreWater(grid: WorldGrid, corner: HighCorner): void {
  const edges = highEdges(corner);
  const farCol = edges.left ? grid.width - 1 : 0;
  const farRow = edges.top ? grid.height - 1 : 0;
  for (let col = 0; col < grid.width; col++) {
    expect({ col, passable: grid.isPassable(col, farRow) }).toEqual({ col, passable: false });
  }
  for (let row = 0; row < grid.height; row++) {
    expect({ row, passable: grid.isPassable(farCol, row) }).toEqual({ row, passable: false });
  }
}

/**
 * The high corner really is the top of the slope.
 *
 * Cheap to state and the thing most likely to break silently: get the
 * corner's axes crossed and the world still generates, still connects, and
 * is simply upside down.
 */
function assertHighCornerIsHighest(grid: WorldGrid, corner: HighCorner): void {
  const edges = highEdges(corner);
  const cornerCol = edges.left ? 0 : grid.width - 1;
  const cornerRow = edges.top ? 0 : grid.height - 1;
  expect(grid.getTerrain(cornerCol, cornerRow)).toBe("mountain");
  // ...and the corner diagonally opposite is the bottom of it.
  expect(grid.getTerrain(grid.width - 1 - cornerCol, grid.height - 1 - cornerRow)).toBe("water");
}

describe("generateWorld seed sweep", () => {
  for (const seed of SWEEP_SEEDS) {
    test(`seed ${seed}: every invariant holds`, () => {
      const world = generateWorld(SWEEP_SIZE, SWEEP_SIZE, seed);
      const { grid, anchors, playerStart } = world;

      expect(grid.width).toBe(SWEEP_SIZE);
      expect(grid.height).toBe(SWEEP_SIZE);

      const areas = allAnchors(anchors);
      for (const area of areas) {
        expect(area.col).toBeGreaterThanOrEqual(0);
        expect(area.row).toBeGreaterThanOrEqual(0);
        expect(area.col + area.width).toBeLessThanOrEqual(grid.width);
        expect(area.row + area.height).toBeLessThanOrEqual(grid.height);
      }
      for (let i = 0; i < areas.length; i++) {
        for (let j = i + 1; j < areas.length; j++) {
          const a = areas[i];
          const b = areas[j];
          if (!a || !b) continue;
          expect(boxesOverlap(a, b)).toBe(false);
        }
      }

      assertFarEdgesAreWater(grid, world.highCorner);
      assertHighCornerIsHighest(grid, world.highCorner);

      // Stronger invariant than "playerStart is the village box's centre"
      // (no longer true — the well sits there now): playerStart must
      // actually be somewhere the player can stand.
      expect(grid.isPassable(playerStart.col, playerStart.row)).toBe(true);
      const reachable = floodFillReachable(grid, playerStart);
      // The observatory is still asked about its middle: nothing is built
      // there yet, so its middle is open ground.
      expect(isReachable(reachable, grid, centerOf(anchors.observatory))).toBe(true);
      assertYouCanGetIntoTheSettlements(grid, reachable, world);
      // The forest is asked about its doorstep rather than its centre,
      // because its centre is the great tree and a tree you can walk into is
      // not a tree. This is the invariant that caught the tree being carved
      // away: connectivity used to aim at the centre and simply removed
      // whatever stood in the way of getting there.
      assertGroveIsReachedAndStandsThere(grid, reachable, world.grove);
      assertTheHarbourHasSeaInIt(grid, anchors.harbour);
      assertTheSeaIsSouthOfTheHarbour(grid, anchors.harbour);
    });
  }

  test("the same seed reproduces an identical world", () => {
    const a = generateWorld(SWEEP_SIZE, SWEEP_SIZE, 999);
    const b = generateWorld(SWEEP_SIZE, SWEEP_SIZE, 999);
    expect(a.anchors).toEqual(b.anchors);
    expect(a.playerStart).toEqual(b.playerStart);
    for (let row = 0; row < SWEEP_SIZE; row += 7) {
      for (let col = 0; col < SWEEP_SIZE; col += 7) {
        expect(a.grid.getTerrain(col, row)).toBe(b.grid.getTerrain(col, row));
        expect(a.grid.getHabitat(col, row)).toBe(b.grid.getHabitat(col, row));
      }
    }
  });

  test("different seeds produce different worlds", () => {
    const a = generateWorld(SWEEP_SIZE, SWEEP_SIZE, 1);
    const b = generateWorld(SWEEP_SIZE, SWEEP_SIZE, 2);
    expect(a.anchors).not.toEqual(b.anchors);
  });
});

describe("generateWorld at full target scale", () => {
  test("500x500 generates successfully with all invariants holding", () => {
    const world = generateWorld(500, 500, 42);
    const { grid, anchors, playerStart } = world;

    expect(grid.width).toBe(500);
    expect(grid.height).toBe(500);
    assertFarEdgesAreWater(grid, world.highCorner);
    assertHighCornerIsHighest(grid, world.highCorner);

    const reachable = floodFillReachable(grid, playerStart);
    expect(isReachable(reachable, grid, centerOf(anchors.observatory))).toBe(true);
    assertYouCanGetIntoTheSettlements(grid, reachable, world);
    assertGroveIsReachedAndStandsThere(grid, reachable, world.grove);
  });
});
