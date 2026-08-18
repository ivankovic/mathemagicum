// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import type { AreaPlacement } from "./anchors";
import { floodFillReachable, isReachable } from "./connectivity";
import { FixtureType } from "./fixtures";
import { WorldGrid } from "./grid";
import { TerrainType } from "./terrain";
import { VILLAGE_SIZE, gardenFenceRing, gardenGate, layoutVillage } from "./villageLayout";

function villageGrid(): { grid: WorldGrid; village: AreaPlacement } {
  const grid = WorldGrid.empty(VILLAGE_SIZE, VILLAGE_SIZE, TerrainType.Grass);
  const village: AreaPlacement = {
    id: "village",
    col: 0,
    row: 0,
    width: VILLAGE_SIZE,
    height: VILLAGE_SIZE,
  };
  return { grid, village };
}

describe("layoutVillage", () => {
  test("paves a square around the centre with the well at its middle", () => {
    const { grid, village } = villageGrid();
    const { well } = layoutVillage(grid, village);
    const center = {
      col: village.col + Math.floor(village.width / 2),
      row: village.row + Math.floor(village.height / 2),
    };

    expect(well.col).toBe(center.col);
    expect(well.row).toBe(center.row);
    expect(well.blocksMovement).toBe(true);
    expect(grid.isPassable(center.col, center.row)).toBe(false); // the well itself blocks

    // A tile a couple of steps off centre is inside the square and clear —
    // and paved, which is what tells the gathering place from the roads that
    // leave it.
    expect(grid.getTerrain(center.col + 2, center.row)).toBe(TerrainType.Cobble);
    expect(grid.isPassable(center.col + 2, center.row)).toBe(true);
  });

  test("places exactly 7 buildings, all blocking, all inside the anchor box", () => {
    const { grid, village } = villageGrid();
    const { buildings } = layoutVillage(grid, village);
    expect(buildings.length).toBe(7);
    for (const building of buildings) {
      expect(building.blocksMovement).toBe(true);
      expect(building.col).toBeGreaterThanOrEqual(village.col);
      expect(building.row).toBeGreaterThanOrEqual(village.row);
      expect(building.col + building.width).toBeLessThanOrEqual(village.col + village.width);
      expect(building.row + building.height).toBeLessThanOrEqual(village.row + village.height);
      for (let row = building.row; row < building.row + building.height; row++) {
        for (let col = building.col; col < building.col + building.width; col++) {
          expect(grid.isPassable(col, row)).toBe(false);
        }
      }
    }
  });

  test("no two buildings (or the well) overlap", () => {
    const { grid, village } = villageGrid();
    const { buildings, well } = layoutVillage(grid, village);
    const all = [well, ...buildings];
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const a = all[i];
        const b = all[j];
        if (!a || !b) continue;
        const overlaps = !(
          a.col + a.width <= b.col ||
          b.col + b.width <= a.col ||
          a.row + a.height <= b.row ||
          b.row + b.height <= a.row
        );
        expect(overlaps).toBe(false);
      }
    }
  });

  test("a building's anchor is its own front-facing cell, not its top-left or centre", () => {
    const { grid, village } = villageGrid();
    const { buildings } = layoutVillage(grid, village);
    const center = {
      col: village.col + Math.floor(village.width / 2),
      row: village.row + Math.floor(village.height / 2),
    };
    const playerHouse = buildings.find((b) => b.id === "player-house");
    expect(playerHouse).toBeDefined();
    if (!playerHouse) return;

    // Always inside the building's own footprint.
    expect(playerHouse.anchorCol).toBeGreaterThanOrEqual(playerHouse.col);
    expect(playerHouse.anchorCol).toBeLessThan(playerHouse.col + playerHouse.width);
    expect(playerHouse.anchorRow).toBeGreaterThanOrEqual(playerHouse.row);
    expect(playerHouse.anchorRow).toBeLessThan(playerHouse.row + playerHouse.height);

    // player-house sits due north of the square (see BUILDINGS), so its
    // front-facing (southernmost, i.e. largest-row) cell is its anchor —
    // not its top-left corner, and its column lines up with the centre
    // since a pure-north direction doesn't shift the footprint sideways.
    expect(playerHouse.anchorRow).toBe(playerHouse.row + playerHouse.height - 1);
    expect(playerHouse.anchorCol).toBe(center.col);
  });

  test("gardens are carved as Dirt and don't overlap their building", () => {
    const { grid, village } = villageGrid();
    const { buildings } = layoutVillage(grid, village);
    const playerHouse = buildings.find((b) => b.id === "player-house");
    expect(playerHouse).toBeDefined();
    // The garden sits further out along the house's own direction (north,
    // i.e. lower row) than the house itself.
    if (playerHouse) {
      expect(grid.getTerrain(playerHouse.col, playerHouse.row - 4)).toBe(TerrainType.Dirt);
    }
  });

  // The two with something to say are found inside their own building; the
  // rest wander. See VillageNpcSpec.indoors.
  test("the shopkeeper and the teacher are indoors, the others are not", () => {
    const { grid, village } = villageGrid();
    const { npcs } = layoutVillage(grid, village);
    const indoors = npcs.filter((npc) => npc.indoors).map((npc) => npc.id);
    expect(indoors.sort()).toEqual(["shopkeeper", "teacher"]);
    expect(npcs.filter((npc) => !npc.indoors).length).toBeGreaterThan(0);
  });

  test("every villager/teacher/postal-worker/shopkeeper gets a home point, player-house does not", () => {
    const { grid, village } = villageGrid();
    const { npcs, buildings } = layoutVillage(grid, village);
    const npcIds = npcs.map((n) => n.id).sort();
    expect(npcIds).toEqual(
      ["postal-worker", "shopkeeper", "teacher", "villager-1", "villager-2", "villager-3"].sort(),
    );
    expect(buildings.find((b) => b.id === "player-house")).toBeDefined();
    expect(npcs.some((n) => n.homeBuildingId === "player-house")).toBe(false);

    for (const npc of npcs) {
      expect(grid.isPassable(npc.home.col, npc.home.row)).toBe(true);
    }
  });

  // Where the game is about to ask them to stand anyway: the beds are the
  // subject of the whole thing, and starting at the front door made the
  // first move of every new game "walk round the house".
  test("playerSpawn is inside the player's own garden", () => {
    const { grid, village } = villageGrid();
    const { playerSpawn, well, buildings } = layoutVillage(grid, village);
    const playerHouse = buildings.find((b) => b.id === "player-house");
    expect(playerHouse).toBeDefined();
    if (!playerHouse) return;

    expect(grid.isPassable(playerSpawn.col, playerSpawn.row)).toBe(true);
    expect(grid.getObjectAt(playerSpawn.col, playerSpawn.row)).toBe(null);
    expect(playerSpawn).not.toEqual({ col: well.col, row: well.row });
    // Plantable ground, which is what a garden is for.
    expect(grid.getTerrain(playerSpawn.col, playerSpawn.row)).toBe(TerrainType.Dirt);

    // Beyond their own house rather than between it and the square: the
    // player house sits north, so the garden is further north again.
    const center = {
      col: village.col + Math.floor(village.width / 2),
      row: village.row + Math.floor(village.height / 2),
    };
    expect(playerSpawn.row).toBeLessThan(playerHouse.row);
    expect(playerSpawn.row).toBeLessThan(center.row);
    expect(Math.abs(playerSpawn.col - (playerHouse.col + playerHouse.width / 2))).toBeLessThan(3);

    // And fenced in, with exactly one way out.
    const fenced = ringAround(grid, playerSpawn);
    expect(fenced.fences).toBeGreaterThan(0);
    expect(fenced.gates).toBe(1);
  });
});

/** Walk out from a point until the fence, and count what the ring is made of. */
function ringAround(
  grid: WorldGrid,
  inside: { col: number; row: number },
): { fences: number; gates: number } {
  const seen = new Set<string>();
  const queue = [inside];
  let fences = 0;
  let gates = 0;
  while (queue.length > 0) {
    const at = queue.shift() as { col: number; row: number };
    const key = `${at.col},${at.row}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const object = grid.getObjectAt(at.col, at.row);
    if (object?.type === FixtureType.Fence) {
      fences++;
      continue;
    }
    if (object?.type === FixtureType.Gate) gates++;
    const steps: readonly { dCol: number; dRow: number }[] = [
      { dCol: 1, dRow: 0 },
      { dCol: -1, dRow: 0 },
      { dCol: 0, dRow: 1 },
      { dCol: 0, dRow: -1 },
    ];
    for (const { dCol, dRow } of steps) {
      const next = { col: at.col + dCol, row: at.row + dRow };
      if (grid.inBounds(next.col, next.row) && !seen.has(`${next.col},${next.row}`)) {
        // Only walk the plot itself: past the gate is the rest of the village.
        if (Math.abs(next.col - inside.col) <= 6 && Math.abs(next.row - inside.row) <= 6) {
          queue.push(next);
        }
      }
    }
  }
  return { fences, gates };
}

describe("garden fences", () => {
  test("the ring sits outside the beds, so no bed is lost to a fence post", () => {
    const ring = gardenFenceRing({ col: 10, row: 20 }, 3, 2);
    // 5 wide by 4 tall, minus the 3x2 of beds inside it.
    expect(ring.length).toBe(5 * 4 - 3 * 2);
    for (const cell of ring) {
      const insideBeds = cell.col >= 10 && cell.col <= 12 && cell.row >= 20 && cell.row <= 21;
      expect(insideBeds).toBe(false);
    }
    expect(new Set(ring.map((cell) => `${cell.col},${cell.row}`)).size).toBe(ring.length);
  });

  test("the gate faces the square and is never a corner", () => {
    const ring = gardenFenceRing({ col: 10, row: 20 }, 3, 3);
    // The square is below and to the left; the nearest non-corner cell is on
    // the near edge, not the corner that is technically closest.
    const gate = gardenGate(ring, { col: 11, row: 40 });
    expect(gate.row).toBe(23);
    expect(gate.col).toBe(11);
  });

  test("a gate is found from every direction the village can lie in", () => {
    const ring = gardenFenceRing({ col: 10, row: 20 }, 4, 4);
    const corners = new Set(["9,19", "14,19", "9,24", "14,24"]);
    for (const towards of [
      { col: 11, row: 0 },
      { col: 11, row: 60 },
      { col: 0, row: 22 },
      { col: 60, row: 22 },
      { col: 0, row: 0 },
      { col: 60, row: 60 },
    ]) {
      const gate = gardenGate(ring, towards);
      expect(ring).toContainEqual(gate);
      expect(corners.has(`${gate.col},${gate.row}`)).toBe(false);
    }
  });

  test("every garden in the village is fenced with exactly one gate", () => {
    const { grid, village } = villageGrid();
    layoutVillage(grid, village);
    const objects = grid.listObjects();
    const gates = objects.filter((object) => object.type === FixtureType.Gate);
    const fenceTypes: readonly string[] = [FixtureType.Fence, FixtureType.FenceSide];
    const fences = objects.filter((object) => fenceTypes.includes(object.type));
    // Three villager gardens and the player's.
    expect(gates.length).toBe(4);
    expect(fences.length).toBeGreaterThan(gates.length * 4);
    for (const gate of gates) expect(gate.blocksMovement).toBe(false);
    for (const fence of fences) expect(fence.blocksMovement).toBe(true);
    // And the way in is walkable, which is the entire point of it.
    for (const gate of gates) expect(grid.isPassable(gate.col, gate.row)).toBe(true);
  });
});

describe("getting out of your own garden", () => {
  // The guarantee that moved when the spawn did. The world generator now
  // carves its routes from the doorstep, which proves the doorstep reaches
  // the story areas — and proves nothing at all about the fenced plot the
  // player is actually standing in. The gate's passability is one boolean;
  // flipped by accident, the player would boot into a sealed box.
  test("the spawn reaches the doorstep, so the gate is really a way out", () => {
    const { grid, village } = villageGrid();
    const { playerSpawn, playerDoorstep } = layoutVillage(grid, village);
    const reachable = floodFillReachable(grid, playerSpawn);
    expect(isReachable(reachable, grid, playerDoorstep)).toBe(true);
  });

  test("and the well, which is the far side of the village from the beds", () => {
    const { grid, village } = villageGrid();
    const { playerSpawn, well } = layoutVillage(grid, village);
    const reachable = floodFillReachable(grid, playerSpawn);
    // The well itself blocks; its doorstep-side neighbour is the honest test.
    expect(isReachable(reachable, grid, { col: well.col, row: well.row + 1 })).toBe(true);
  });

  // Bricking a gate up would be silent otherwise: the ring would still look
  // like a fence, and the plot would simply have no way in.
  test("a gate that blocked would fail this", () => {
    const { grid, village } = villageGrid();
    const { playerSpawn, playerDoorstep } = layoutVillage(grid, village);
    for (const object of grid.listObjects()) {
      if (object.type !== FixtureType.Gate) continue;
      grid.removeObjectAt(object.col, object.row);
      grid.placeObject({ ...object, blocksMovement: true });
    }
    const reachable = floodFillReachable(grid, playerSpawn);
    expect(isReachable(reachable, grid, playerDoorstep)).toBe(false);
  });
});

const RING_TYPES: readonly FixtureType[] = [
  FixtureType.Fence,
  FixtureType.FenceSide,
  FixtureType.Gate,
];

describe("the fences fit the village", () => {
  // placeObject does not complain about a fence standing inside a wall, and
  // the gardens are not all the same size: the player's is 7x5 and the
  // villagers' are 4x4, against three different building footprints.
  test("no fence stands inside a building", () => {
    const { grid, village } = villageGrid();
    const { buildings } = layoutVillage(grid, village);
    const rings = grid
      .listObjects()
      .filter((object) => object.type === FixtureType.Fence || object.type === FixtureType.Gate);
    expect(rings.length).toBeGreaterThan(0);
    for (const cell of rings) {
      for (const building of buildings) {
        const inside =
          cell.col >= building.col &&
          cell.col < building.col + building.width &&
          cell.row >= building.row &&
          cell.row < building.row + building.height;
        expect({ cell: `${cell.col},${cell.row}`, inside }).toEqual({
          cell: `${cell.col},${cell.row}`,
          inside: false,
        });
      }
    }
  });

  test("every garden's beds stay walkable, fence or no fence", () => {
    const { grid, village } = villageGrid();
    const { npcs } = layoutVillage(grid, village);
    expect(npcs.length).toBeGreaterThan(0);
    // Each gate has open ground on both sides of it: the plot within, and
    // the way home without.
    for (const gate of grid.listObjects().filter((o) => o.type === FixtureType.Gate)) {
      const around = [
        { col: gate.col + 1, row: gate.row },
        { col: gate.col - 1, row: gate.row },
        { col: gate.col, row: gate.row + 1 },
        { col: gate.col, row: gate.row - 1 },
      ].filter((cell) => grid.isPassable(cell.col, cell.row));
      expect(around.length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("which way the fence runs", () => {
  // The sides run away from the camera and the top and bottom across it; the
  // corners belong to the top and bottom, because that is the run whose posts
  // the sides line up under. Getting this wrong is a jog at every corner.
  test("sides are the side sprite, corners and the top and bottom are not", () => {
    const { grid, village } = villageGrid();
    layoutVillage(grid, village);
    const ring = grid
      .listObjects()
      .filter((object) => RING_TYPES.includes(object.type as FixtureType));
    const cols = ring.map((cell) => cell.col);
    const rows = ring.map((cell) => cell.row);

    for (const cell of ring) {
      // Group by plot: a cell's own ring is the one whose corners bound it.
      const plot = ring.filter(
        (other) => Math.abs(other.col - cell.col) <= 9 && Math.abs(other.row - cell.row) <= 9,
      );
      const left = Math.min(...plot.map((c) => c.col));
      const right = Math.max(...plot.map((c) => c.col));
      const top = Math.min(...plot.map((c) => c.row));
      const bottom = Math.max(...plot.map((c) => c.row));
      const onSide =
        (cell.col === left || cell.col === right) && cell.row !== top && cell.row !== bottom;
      if (cell.type === FixtureType.Gate) continue;
      expect({ at: `${cell.col},${cell.row}`, side: cell.type === FixtureType.FenceSide }).toEqual({
        at: `${cell.col},${cell.row}`,
        side: onSide,
      });
    }
    expect(cols.length).toBe(rows.length);
  });

  test("the right-hand side is drawn mirrored, the left-hand one is not", () => {
    const { grid, village } = villageGrid();
    layoutVillage(grid, village);
    const sides = grid.listObjects().filter((object) => object.type === FixtureType.FenceSide);
    expect(sides.length).toBeGreaterThan(0);
    const flipped = sides.filter((cell) => cell.flip === true);
    // Two sides per plot, mirrored on one of them: half and half.
    expect(flipped.length).toBe(sides.length / 2);
    for (const cell of sides) {
      // Its opposite number on the same plot, not one on another garden that
      // happens to share a row.
      const twin = sides.find(
        (other) =>
          other.row === cell.row && other.col !== cell.col && Math.abs(other.col - cell.col) <= 9,
      );
      if (!twin) continue;
      expect(cell.flip === true).toBe(cell.col > twin.col);
    }
  });
});
