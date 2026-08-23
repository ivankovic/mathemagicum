// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import type { AreaPlacement } from "./anchors";
import { floodFillReachable, isReachable } from "./connectivity";
import { FixtureType } from "./fixtures";
import { WorldGrid } from "./grid";
import type { PlacedObject } from "./objects";
import { TerrainType } from "./terrain";
import type { GridPoint } from "./topdown";
import {
  DIRECTIONS,
  GARDEN_ENTRANCE_WIDTH,
  HOUSE_IDS,
  VILLAGER_HOME_COUNT,
  VILLAGER_IDS,
  VILLAGE_SIZE,
  gardenEntrance,
  gardenFenceRing,
  gardenGate,
  layoutVillage,
  plotFor,
  stallCells,
} from "./villageLayout";

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

  test("places the ring and the villagers' cottages, all blocking, all in the box", () => {
    const { grid, village } = villageGrid();
    const { buildings } = layoutVillage(grid, village);
    // Seven round the square, and one apiece for the villagers off it.
    expect(buildings.length).toBe(7 + VILLAGER_HOME_COUNT);
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

  // The ones with something to say are found inside their own building; the
  // rest wander. See VillageNpcSpec.indoors.
  test("everyone with something to explain is indoors, the others are not", () => {
    const { grid, village } = villageGrid();
    const { npcs } = layoutVillage(grid, village);
    const indoors = npcs.filter((npc) => npc.indoors).map((npc) => npc.id);
    expect(indoors.sort()).toEqual(["geometer", "shopkeeper", "teacher"]);
    expect(npcs.filter((npc) => !npc.indoors).length).toBeGreaterThan(0);
  });

  // The post office is the first building with two people in it: the postal
  // worker walks the square and the geometry teacher is up the tower. Only
  // one of them is indoors, which is what lets a room have a single
  // attendant without any of it having to know there is a second person.
  test("a building may have somebody outside it and somebody in it", () => {
    const { grid, village } = villageGrid();
    const { npcs } = layoutVillage(grid, village);
    const tower = npcs.filter((npc) => npc.homeBuildingId === "post-office");
    expect(tower.map((npc) => npc.id).sort()).toEqual(["geometer", "postal-worker"]);
    expect(tower.filter((npc) => npc.indoors).map((npc) => npc.id)).toEqual(["geometer"]);
  });

  test("everybody who lives here gets a home point, and no child's house does", () => {
    const { grid, village } = villageGrid();
    const { npcs, buildings } = layoutVillage(grid, village);
    const npcIds = npcs.map((n) => n.id).sort();
    expect(npcIds).toEqual(
      ["geometer", "postal-worker", "shopkeeper", "teacher", ...VILLAGER_IDS].sort(),
    );
    // None of the four round the square: those are the children's, one each,
    // and a villager living in one was a stranger in somebody's home.
    for (const id of HOUSE_IDS) {
      expect(buildings.find((b) => b.id === id)).toBeDefined();
      expect({ id, taken: npcs.some((n) => n.homeBuildingId === id) }).toEqual({
        id,
        taken: false,
      });
    }

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

    // And fenced in, with exactly one way out — which is three cells wide
    // now, and made of two gates with a gap between them.
    const fenced = ringAround(grid, playerSpawn);
    expect(fenced.fences).toBeGreaterThan(0);
    expect(fenced.gates).toBe(2);
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

  /**
   * The two cells a side run comes *down* into.
   *
   * A corner joins in one direction and not the other. A side run overhangs
   * the cell above it and lands on that panel's post, so the top corners
   * draw themselves; below one there is nothing to overhang with, and the
   * panel's post starts a third of a tile down — which left every garden
   * with a clean break at each of its two bottom corners.
   */
  test("the bottom corners are the piece that closes the join", () => {
    const { grid, village } = villageGrid();
    layoutVillage(grid, village);
    const corners = grid.listObjects().filter((object) => object.type === FixtureType.FenceCorner);
    // Up to two per garden over four gardens, and fewer when the gap in a
    // way in falls directly above one — then there is nothing for its post
    // to meet and it goes back to being a plain panel.
    expect(corners.length).toBeGreaterThan(0);
    expect(corners.length).toBeLessThanOrEqual(8);
  });

  test("and each of them has a side run standing directly above it", () => {
    const { grid, village } = villageGrid();
    layoutVillage(grid, village);
    // A gate on a side run counts: its art runs to the bottom of its cell
    // for exactly this reason, so the corner's post lands on timber.
    const sideRun: readonly string[] = [
      FixtureType.FenceSide,
      FixtureType.GateSide,
      FixtureType.GateSideLower,
    ];
    for (const corner of grid.listObjects()) {
      if (corner.type !== FixtureType.FenceCorner) continue;
      const above = grid.getObjectAt(corner.col, corner.row - 1);
      // The whole reason this piece exists. A corner with nothing above it
      // would be a post carried up to meet nothing — which is a real case
      // now that the way in is three cells wide and its middle is empty.
      expect({
        at: `${corner.col},${corner.row}`,
        meets: sideRun.includes(above?.type ?? ""),
      }).toEqual({ at: `${corner.col},${corner.row}`, meets: true });
    }
  });

  test("the right-hand one is mirrored and the left-hand one is not", () => {
    const { grid, village } = villageGrid();
    layoutVillage(grid, village);
    const corners = grid.listObjects().filter((object) => object.type === FixtureType.FenceCorner);
    // Its tall post stands under the run above it, and on the right that run
    // is against the cell's other edge — the same reason a side run flips.
    const flipped = corners.filter((corner) => corner.flip);
    expect(flipped.length).toBe(corners.length / 2);
    for (const corner of corners) {
      const above = grid.getObjectAt(corner.col, corner.row - 1);
      expect({ at: corner.col, same: corner.flip === above?.flip }).toEqual({
        at: corner.col,
        same: true,
      });
    }
  });

  // Still a fence: it blocks, it is not for sale, and nothing about it is a
  // gate. Cheap to state and it is the sort of thing a new variant loses.
  test("a corner is a fence in every way but its picture", () => {
    const { grid, village } = villageGrid();
    layoutVillage(grid, village);
    for (const corner of grid.listObjects()) {
      if (corner.type !== FixtureType.FenceCorner) continue;
      expect(corner.blocksMovement).toBe(true);
      expect(grid.isPassable(corner.col, corner.row)).toBe(false);
    }
  });

  /**
   * The reported fault: the way in was a single cell, which is a target a
   * six-year-old has to aim at. They walk along the fence, arrive beside the
   * gap rather than at it, and press into a panel that looks no different
   * from the way through.
   */
  describe("a way in three cells wide", () => {
    const ring = () => gardenFenceRing({ col: 10, row: 20 }, 7, 5);

    test("is three cells, in a line, and none of them a corner", () => {
      const at = ring();
      for (const towards of [
        { col: 13, row: 60 },
        { col: 13, row: 0 },
        { col: 0, row: 22 },
        { col: 60, row: 22 },
        { col: 0, row: 0 },
        { col: 60, row: 60 },
      ]) {
        const entrance = gardenEntrance(at, towards);
        expect(entrance.length).toBe(GARDEN_ENTRANCE_WIDTH);
        const corners = new Set(["9,19", "17,19", "9,25", "17,25"]);
        for (const cell of entrance) {
          expect(at).toContainEqual(cell);
          expect(corners.has(`${cell.col},${cell.row}`)).toBe(false);
        }
        // In a line, and consecutive: a way in with a fence panel in the
        // middle of it is two ways in a tile apart.
        const across = entrance[0]?.row === entrance[1]?.row;
        const along = entrance.map((cell) => (across ? cell.col : cell.row));
        expect(new Set(entrance.map((cell) => (across ? cell.row : cell.col))).size).toBe(1);
        expect(Math.max(...along) - Math.min(...along)).toBe(GARDEN_ENTRANCE_WIDTH - 1);
      }
    });

    test("is centred on the cell the old single gate would have been", () => {
      const at = ring();
      const towards = { col: 13, row: 60 };
      expect(gardenEntrance(at, towards)[1]).toEqual(gardenGate(at, towards));
    });

    // A garden nobody has shrunk yet, but a spec that shrank one should give
    // a narrower way in rather than reach past the end of its own fence.
    test("and never runs off the end of its edge", () => {
      const narrow = gardenFenceRing({ col: 10, row: 20 }, 2, 2);
      for (const cell of gardenEntrance(narrow, { col: 11, row: 60 })) {
        expect(narrow).toContainEqual(cell);
      }
    });

    test("every cell of it is walked through, not only the middle", () => {
      const { grid, village } = villageGrid();
      layoutVillage(grid, village);
      const gateTypes: readonly string[] = [
        FixtureType.Gate,
        FixtureType.GateSide,
        FixtureType.GateSideLower,
      ];
      const gates = grid.listObjects().filter((object) => gateTypes.includes(object.type));
      expect(gates.length).toBeGreaterThan(0);
      for (const gate of gates) {
        // The gates themselves, and the gap each pair stands either side of.
        // Two gateposts round a one-tile hole would be the same target it
        // was before with more timber round it.
        expect(grid.isPassable(gate.col, gate.row)).toBe(true);
      }
    });

    test("and its middle carries nothing at all", () => {
      const { grid, village } = villageGrid();
      layoutVillage(grid, village);
      const gateTypes: readonly string[] = [
        FixtureType.Gate,
        FixtureType.GateSide,
        FixtureType.GateSideLower,
      ];
      const gates = grid.listObjects().filter((object) => gateTypes.includes(object.type));
      // Each pair faces its twin two cells away with an empty cell between.
      for (const gate of gates) {
        const twin = gates.find(
          (other) =>
            other !== gate && Math.abs(other.col - gate.col) + Math.abs(other.row - gate.row) === 2,
        );
        expect({ at: `${gate.col},${gate.row}`, paired: Boolean(twin) }).toEqual({
          at: `${gate.col},${gate.row}`,
          paired: true,
        });
        if (!twin) continue;
        const middle = {
          col: (gate.col + twin.col) / 2,
          row: (gate.row + twin.row) / 2,
        };
        expect(grid.getObjectAt(middle.col, middle.row)).toBeNull();
        expect(grid.isPassable(middle.col, middle.row)).toBe(true);
      }
    });
  });

  test("every garden in the village is fenced with exactly one gate", () => {
    const { grid, village } = villageGrid();
    layoutVillage(grid, village);
    const objects = grid.listObjects();
    // Either kind: a gate on a side run is drawn for a run that goes away
    // from the camera, and half of them land on one — the gate goes on the
    // ring cell nearest the square, and two of the four sides run that way.
    const gateTypes: readonly string[] = [
      FixtureType.Gate,
      FixtureType.GateSide,
      FixtureType.GateSideLower,
    ];
    const gates = objects.filter((object) => gateTypes.includes(object.type));
    const fenceTypes: readonly string[] = [
      FixtureType.Fence,
      FixtureType.FenceSide,
      FixtureType.FenceCorner,
    ];
    const fences = objects.filter((object) => fenceTypes.includes(object.type));
    // Three villager gardens and the player's, two gates to a way in.
    expect(gates.length).toBe(4 * 2);
    expect(fences.length).toBeGreaterThan(gates.length * 4);
    for (const gate of gates) expect(gate.blocksMovement).toBe(false);
    for (const fence of fences) expect(fence.blocksMovement).toBe(true);
    // And the way in is walkable, which is the entire point of it.
    for (const gate of gates) expect(grid.isPassable(gate.col, gate.row)).toBe(true);
  });

  // The defect this fixes: a gate on a side run drawn with the panel that
  // runs across the camera — rails sticking sideways into the garden, with
  // the run stopping above it and starting again below.
  test("a gate in a side run is drawn for a side run", () => {
    const { grid, village } = villageGrid();
    layoutVillage(grid, village);
    const objects = grid.listObjects();
    const gateTypes: readonly string[] = [
      FixtureType.Gate,
      FixtureType.GateSide,
      FixtureType.GateSideLower,
    ];
    for (const gate of objects.filter((object) => gateTypes.includes(object.type))) {
      // Two cells out, not one: the cell touching a gate is as likely to be
      // the gap in the middle of the way in, or the other gate, as it is to
      // be the run this is asking about.
      const sideRun: readonly string[] = [
        FixtureType.FenceSide,
        FixtureType.GateSide,
        FixtureType.GateSideLower,
      ];
      const inSideRun = [-2, -1, 1, 2].some((step) =>
        sideRun.includes(grid.getObjectAt(gate.col, gate.row + step)?.type ?? ""),
      );
      const at = { col: gate.col, row: gate.row };
      // Which of the two ends of a side run it is, is the next test's
      // business; this one only asks that a gate in a column is drawn for a
      // column and not with the across-the-camera panel.
      const drawnSideways =
        gate.type === FixtureType.GateSide || gate.type === FixtureType.GateSideLower;
      expect({ ...at, sideways: drawnSideways }).toEqual({ ...at, sideways: inSideRun });
    }
  });

  /**
   * And which end. The leaf hangs off the run it belongs to, and on a side
   * run that run is above one gate and below the other — so unlike every
   * other pair in this fence, mirroring cannot turn one into the other.
   */
  test("the upper gate of a side run is the upper one, and the lower the lower", () => {
    const { grid, village } = villageGrid();
    layoutVillage(grid, village);
    const sideGates = grid
      .listObjects()
      .filter(
        (object) =>
          object.type === FixtureType.GateSide || object.type === FixtureType.GateSideLower,
      );
    expect(sideGates.length).toBeGreaterThan(0);
    for (const gate of sideGates) {
      const twin = sideGates.find(
        (other) => other !== gate && other.col === gate.col && Math.abs(other.row - gate.row) === 2,
      );
      expect({ at: `${gate.col},${gate.row}`, paired: Boolean(twin) }).toEqual({
        at: `${gate.col},${gate.row}`,
        paired: true,
      });
      if (!twin) continue;
      const upper = gate.row < twin.row ? gate : twin;
      const lower = gate.row < twin.row ? twin : gate;
      expect(upper.type).toBe(FixtureType.GateSide);
      expect(lower.type).toBe(FixtureType.GateSideLower);
    }
  });

  // Its leaf swings into the garden, so the right-hand side is the left-hand
  // sprite mirrored — the same rule the fence beside it follows.
  test("a gate on the right-hand side is mirrored, like the fence is", () => {
    const { grid, village } = villageGrid();
    layoutVillage(grid, village);
    for (const object of grid.listObjects()) {
      if (object.type !== FixtureType.GateSide && object.type !== FixtureType.GateSideLower) {
        continue;
      }
      const neighbour = [-1, 1]
        .map((step) => grid.getObjectAt(object.col, object.row + step))
        .find((other) => other?.type === FixtureType.FenceSide);
      if (!neighbour) continue;
      const at = { col: object.col, row: object.row };
      expect({ ...at, flip: object.flip === true }).toEqual({
        ...at,
        flip: neighbour.flip === true,
      });
    }
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

  /**
   * Bricking the way in up would be silent otherwise: the ring would still
   * look like a fence, and the plot would simply have no way out of it.
   *
   * The whole way in, not only its gates. It is three cells wide and the
   * middle one carries nothing, so blocking the timber alone leaves a hole —
   * which is the point of the change and would make this test pass while
   * proving nothing.
   */
  test("a way in that blocked would fail this", () => {
    const { grid, village } = villageGrid();
    const { playerSpawn, playerDoorstep } = layoutVillage(grid, village);
    const gates = grid.listObjects().filter((object) => WAY_IN.includes(object.type));
    for (const gate of gates) {
      grid.removeObjectAt(gate.col, gate.row);
      grid.placeObject({ ...gate, blocksMovement: true });
      // And the gap each pair stands either side of.
      for (const step of [-1, 1]) {
        for (const at of [
          { col: gate.col + step, row: gate.row },
          { col: gate.col, row: gate.row + step },
        ]) {
          if (grid.getObjectAt(at.col, at.row)) continue;
          grid.placeObject({
            id: `sealed-${at.col}-${at.row}`,
            type: FixtureType.Fence,
            col: at.col,
            row: at.row,
            width: 1,
            height: 1,
            blocksMovement: true,
            anchorCol: at.col,
            anchorRow: at.row,
          });
        }
      }
    }
    const reachable = floodFillReachable(grid, playerSpawn);
    expect(isReachable(reachable, grid, playerDoorstep)).toBe(false);
  });
});

/** Every piece a way in is made of, across the camera and away from it. */
const WAY_IN: readonly string[] = [
  FixtureType.Gate,
  FixtureType.GateSide,
  FixtureType.GateSideLower,
];

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

describe("the shop's stalls", () => {
  // The store is drawn with the barn sprite: a good big building, and not
  // obviously a place that sells anything. What marks it out is what is set
  // up in front of it.
  test("stand in the row in front of the building, at either end", () => {
    const cells = stallCells({ col: 10, row: 20 }, 4, 3);
    expect(cells).toEqual([
      { col: 10, row: 23 },
      { col: 13, row: 23 },
    ]);
  });

  // The door is in the middle, and a stall in front of it would be a shop
  // you cannot walk into.
  test("never in the middle, where the door is", () => {
    for (const width of [3, 4, 5, 6]) {
      const cells = stallCells({ col: 0, row: 0 }, width, 3);
      const middle = (width - 1) / 2;
      for (const cell of cells) {
        expect({ width, clear: Math.abs(cell.col - middle) >= 1 }).toEqual({ width, clear: true });
      }
    }
  });

  test("two of them, not a row: this is a shop, not a market square", () => {
    expect(stallCells({ col: 0, row: 0 }, 8, 3).length).toBe(2);
  });

  test("a village puts them in front of its store and nowhere else", () => {
    const { grid, village } = villageGrid();
    const { buildings } = layoutVillage(grid, village);
    const stalls = grid.listObjects().filter((object) => object.type === FixtureType.Stall);
    expect(stalls.length).toBeGreaterThan(0);
    expect(stalls.length).toBeLessThanOrEqual(2);

    const store = buildings.find((building) => building.id === "store");
    if (!store) throw new Error("the village has no store");
    for (const stall of stalls) {
      expect(stall.row).toBe(store.row + store.height);
      expect(stall.col === store.col || stall.col === store.col + store.width - 1).toBe(true);
    }
  });

  // A stall blocks its cell, so one dropped onto the path the square carves
  // to this door would wall the shop off — and a shop you cannot walk into
  // is worse than a shop with one stall outside it instead of two.
  test("never onto ground something else already stands on", () => {
    const { grid, village } = villageGrid();
    layoutVillage(grid, village);
    const seen = new Map<string, string>();
    for (const object of grid.listObjects()) {
      const key = `${object.col},${object.row}`;
      expect({ key, first: seen.get(key) ?? object.id }).toEqual({ key, first: object.id });
      seen.set(key, object.id);
    }
  });

  test("and the shop is still reachable from the square", () => {
    const { grid, village } = villageGrid();
    const { buildings, well } = layoutVillage(grid, village);
    const store = buildings.find((building) => building.id === "store");
    if (!store) throw new Error("the village has no store");
    const visited = floodFillReachable(grid, { col: well.col, row: well.row + 1 });
    // The doorstep row, minus the cells the stalls stand on: at least one way
    // up to the door has to survive them.
    const doorstep = Array.from({ length: store.width }, (_, at) => ({
      col: store.col + at,
      row: store.row + store.height,
    })).filter((cell) => grid.isPassable(cell.col, cell.row));
    expect(doorstep.length).toBeGreaterThan(0);
    expect(doorstep.some((cell) => isReachable(visited, grid, cell))).toBe(true);
  });
});

describe("where the villagers live", () => {
  /**
   * The village has to find room for all four, in every world.
   *
   * Rejection sampling is the kind of thing that works on the seed it was
   * written against and quietly comes up one short on another — and a
   * villager with no home is a villager every later pass has to special-case.
   * `layoutVillage` throws rather than settling for three, so this is a test
   * that it never has to.
   */
  test("four cottages, in every world", () => {
    for (let seed = 0; seed < 120; seed++) {
      const { grid, village } = villageGrid();
      const { buildings } = layoutVillage(grid, village, seed);
      const cottages = buildings.filter((b) => b.id.startsWith("villager-home-"));
      expect({ seed, count: cottages.length }).toEqual({ seed, count: VILLAGER_HOME_COUNT });
    }
  });

  test("and no two of them touch", () => {
    for (let seed = 0; seed < 120; seed++) {
      const { grid, village } = villageGrid();
      const cottages = layoutVillage(grid, village, seed).buildings.filter((b) =>
        b.id.startsWith("villager-home-"),
      );
      for (let a = 0; a < cottages.length; a++) {
        for (let b = a + 1; b < cottages.length; b++) {
          const one = cottages[a] as PlacedObject;
          const two = cottages[b] as PlacedObject;
          const apart = Math.max(
            one.col - (two.col + two.width - 1),
            two.col - (one.col + one.width - 1),
            one.row - (two.row + two.height - 1),
            two.row - (one.row + one.height - 1),
          );
          expect({ seed, a, b, clear: apart > 0 }).toEqual({ seed, a, b, clear: true });
        }
      }
    }
  });

  // Not on the square, not on a road, not in anybody's plot. Everything the
  // village builds is carved to dirt and nothing else in the box is, so
  // "started on ground that was not dirt" is the whole rule — checked here
  // by the consequence: a cottage never stands on another building.
  test("they stand clear of everything the village had already built", () => {
    for (let seed = 0; seed < 60; seed++) {
      const { grid, village } = villageGrid();
      const { buildings } = layoutVillage(grid, village, seed);
      const ring = buildings.filter((b) => !b.id.startsWith("villager-home-"));
      for (const cottage of buildings.filter((b) => b.id.startsWith("villager-home-"))) {
        for (const other of ring) {
          const overlaps =
            cottage.col < other.col + other.width &&
            other.col < cottage.col + cottage.width &&
            cottage.row < other.row + other.height &&
            other.row < cottage.row + cottage.height;
          expect({ seed, cottage: cottage.id, other: other.id, overlaps }).toEqual({
            seed,
            cottage: cottage.id,
            other: other.id,
            overlaps: false,
          });
        }
      }
    }
  });

  /**
   * A villager can get home, and a child can get to them.
   *
   * `carvePath` draws a straight line and sets dirt under whatever it
   * crosses, so a cottage whose walk from the square passed through a fence
   * would leave a dirt scar and a villager on the wrong side of it. The
   * candidate's line is checked before it is carved; this checks the
   * consequence, which is the thing that matters.
   */
  test("and every one of them can be walked to from the square", () => {
    for (let seed = 0; seed < 40; seed++) {
      const { grid, village } = villageGrid();
      const { well, npcs } = layoutVillage(grid, village, seed);
      const reachable = floodFillReachable(grid, { col: well.col, row: well.row + 1 });
      for (const npc of npcs.filter((n) => n.homeBuildingId.startsWith("villager-home-"))) {
        expect({ seed, npc: npc.id, home: isReachable(reachable, grid, npc.home) }).toEqual({
          seed,
          npc: npc.id,
          home: true,
        });
      }
    }
  });

  // The layout has no sidecars, so it places a doorstep by the shape a
  // cottage is: door in the bottom middle, step on the tile below. If the
  // art ever moves that door, this is what says so.
  test("the doorstep the layout assumes is the doorstep the art draws", () => {
    const { grid, village } = villageGrid();
    const { npcs, buildings } = layoutVillage(grid, village, 3);
    for (const npc of npcs.filter((n) => n.homeBuildingId.startsWith("villager-home-"))) {
      const home = buildings.find((b) => b.id === npc.homeBuildingId) as PlacedObject;
      expect(npc.home).toEqual({
        col: home.col + Math.floor(home.width / 2),
        row: home.row + home.height,
      });
      expect(grid.isPassable(npc.home.col, npc.home.row)).toBe(true);
    }
  });
});

describe("where each child starts", () => {
  // Four houses round the square, four children on a device, and
  // `Profile.house` says which is whose. Nothing read it until the
  // nameplates went up and made it plain that everybody was being put down
  // at house zero's gate.
  test("every house says where its owner begins, and they are all different", () => {
    const { grid, village } = villageGrid();
    const { homes, buildings } = layoutVillage(grid, village);
    expect(Object.keys(homes).sort()).toEqual([...HOUSE_IDS].sort());
    const spots = new Set(Object.values(homes).map((h) => `${h.inside.col},${h.inside.row}`));
    expect(spots.size).toBe(HOUSE_IDS.length);
    for (const [id, home] of Object.entries(homes)) {
      expect({ id, standable: grid.isPassable(home.inside.col, home.inside.row) }).toEqual({
        id,
        standable: true,
      });
      expect({ id, doorstep: grid.isPassable(home.doorstep.col, home.doorstep.row) }).toEqual({
        id,
        doorstep: true,
      });
      // Their own, not somebody else's: the nearest house to where they are
      // put down is the one whose name is on it.
      const nearest = buildings
        .filter((b) => HOUSE_IDS.includes(b.id))
        .sort(
          (a, b) =>
            Math.hypot(a.col - home.inside.col, a.row - home.inside.row) -
            Math.hypot(b.col - home.inside.col, b.row - home.inside.row),
        )[0];
      expect({ id, nearest: nearest?.id }).toEqual({ id, nearest: id });
    }
  });
});

describe("the four plots", () => {
  /**
   * The same garden four times, turned to face the square.
   *
   * House zero had a seven-by-five "per the original design request (a big
   * garden)" and the other three a four-by-four, which was fine while a
   * world belonged to one child and is one child getting half their
   * sibling's garden the moment four of them share a tablet.
   */
  test("every child gets the same number of squares to plant", () => {
    const areas = new Set<number>();
    for (const name of ["N", "E", "S", "W"]) {
      const plot = plotFor(DIRECTIONS[name] as never);
      areas.add(plot.width * plot.height);
    }
    expect([...areas]).toEqual([35]);
  });

  // The long side runs *across* the way out of the village, so every child
  // meets their plot the same way round: walking in at the middle of a
  // seven-tile frontage. North and south are wide; east and west are deep.
  test("and it is turned to face the square rather than always lying the same way", () => {
    expect(plotFor(DIRECTIONS.N as never)).toEqual({ width: 7, height: 5 });
    expect(plotFor(DIRECTIONS.S as never)).toEqual({ width: 7, height: 5 });
    expect(plotFor(DIRECTIONS.E as never)).toEqual({ width: 5, height: 7 });
    expect(plotFor(DIRECTIONS.W as never)).toEqual({ width: 5, height: 7 });
  });

  // Every one of the four houses really is on a cardinal direction, which is
  // what makes "across" one axis rather than a diagonal to round off.
  test("and every house it applies to sits square to the compass", () => {
    const { grid, village } = villageGrid();
    const { well, homes } = layoutVillage(grid, village);
    for (const id of HOUSE_IDS) {
      const at = homes[id]?.inside as GridPoint;
      const straight = at.col === well.col || at.row === well.row;
      expect({ id, straight }).toEqual({ id, straight: true });
    }
  });
});
