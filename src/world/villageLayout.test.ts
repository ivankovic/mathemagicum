// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import type { AreaPlacement } from "./anchors";
import { WorldGrid } from "./grid";
import { TerrainType } from "./terrain";
import { VILLAGE_SIZE, layoutVillage } from "./villageLayout";

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
  test("carves a Dirt square around the centre with the well at its middle", () => {
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

    // A tile a couple of steps off centre is inside the square and clear.
    expect(grid.getTerrain(center.col + 2, center.row)).toBe(TerrainType.Dirt);
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

  test("playerSpawn is the player's own doorstep, not just anywhere in the square", () => {
    const { grid, village } = villageGrid();
    const { playerSpawn, well, buildings } = layoutVillage(grid, village);
    const playerHouse = buildings.find((b) => b.id === "player-house");
    expect(playerHouse).toBeDefined();
    if (!playerHouse) return;

    expect(grid.isPassable(playerSpawn.col, playerSpawn.row)).toBe(true);
    expect(playerSpawn).not.toEqual({ col: well.col, row: well.row });

    // "Doorstep" means adjacent to the house, not just somewhere in the
    // village: within a couple of tiles of the footprint, and strictly
    // between the house and the square's centre (i.e. player-house sits
    // north, so the doorstep's row is below the house but above centre).
    const center = {
      col: village.col + Math.floor(village.width / 2),
      row: village.row + Math.floor(village.height / 2),
    };
    expect(playerSpawn.row).toBeGreaterThan(playerHouse.row + playerHouse.height - 1);
    expect(playerSpawn.row).toBeLessThan(center.row);
    expect(Math.abs(playerSpawn.col - (playerHouse.col + playerHouse.width / 2))).toBeLessThan(3);
  });
});
