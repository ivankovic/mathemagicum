// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { type PlantType, canPlantOn } from "./plants";
import { type TerrainType, isPassable } from "./terrain";

interface Tile {
  terrain: TerrainType;
  plant: PlantType | null;
}

export class WorldGrid {
  private readonly tiles: Tile[][];
  readonly width: number;
  readonly height: number;

  constructor(terrain: readonly (readonly TerrainType[])[]) {
    this.height = terrain.length;
    this.width = terrain[0]?.length ?? 0;
    this.tiles = terrain.map((row) => row.map((t) => ({ terrain: t, plant: null })));
  }

  inBounds(col: number, row: number): boolean {
    return col >= 0 && col < this.width && row >= 0 && row < this.height;
  }

  private tileAt(col: number, row: number): Tile {
    const tile = this.tiles[row]?.[col];
    if (!tile) throw new RangeError(`(${col}, ${row}) is out of bounds`);
    return tile;
  }

  getTerrain(col: number, row: number): TerrainType {
    return this.tileAt(col, row).terrain;
  }

  getPlant(col: number, row: number): PlantType | null {
    return this.tileAt(col, row).plant;
  }

  isPassable(col: number, row: number): boolean {
    return this.inBounds(col, row) && isPassable(this.getTerrain(col, row));
  }

  canPlant(col: number, row: number, plant: PlantType): boolean {
    return (
      this.inBounds(col, row) &&
      this.getPlant(col, row) === null &&
      canPlantOn(plant, this.getTerrain(col, row))
    );
  }

  plant(col: number, row: number, plant: PlantType): boolean {
    if (!this.canPlant(col, row, plant)) return false;
    this.tileAt(col, row).plant = plant;
    return true;
  }
}
