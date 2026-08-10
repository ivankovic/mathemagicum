// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { Habitat } from "./habitat";
import { type PlantType, canPlantOn } from "./plants";
import { TerrainType, isPassable } from "./terrain";

// Flat, numerically-indexed storage. At world scale (hundreds of thousands
// of tiles) an array of {terrain, plant} objects is real GC pressure, while
// a Uint8Array is a few hundred KB. TerrainType/Habitat stay string unions
// for readability at every call site — coded to a small integer only at
// this storage boundary.
const TERRAIN_CODES: readonly TerrainType[] = Object.values(TerrainType);
const TERRAIN_TO_CODE = new Map<TerrainType, number>(TERRAIN_CODES.map((t, i) => [t, i]));

function terrainToCode(terrain: TerrainType): number {
  const code = TERRAIN_TO_CODE.get(terrain);
  if (code === undefined) throw new Error(`Unknown terrain type "${terrain}"`);
  return code;
}

function codeToTerrain(code: number): TerrainType {
  const terrain = TERRAIN_CODES[code];
  if (!terrain) throw new RangeError(`Unknown terrain code ${code}`);
  return terrain;
}

const HABITAT_CODES: readonly Habitat[] = Object.values(Habitat);
const HABITAT_TO_CODE = new Map<Habitat, number>(HABITAT_CODES.map((h, i) => [h, i]));

function habitatToCode(habitat: Habitat): number {
  const code = HABITAT_TO_CODE.get(habitat);
  if (code === undefined) throw new Error(`Unknown habitat "${habitat}"`);
  return code;
}

function codeToHabitat(code: number): Habitat {
  const habitat = HABITAT_CODES[code];
  if (!habitat) throw new RangeError(`Unknown habitat code ${code}`);
  return habitat;
}

export class WorldGrid {
  private readonly terrainCodes: Uint8Array;
  // Defaults to habitat code 0 (Meadow) for any tile a caller never sets —
  // fine for hand-built test/stub grids that don't care about habitat.
  private readonly habitatCodes: Uint8Array;
  // Plants are sparse (most tiles are never planted), so a map of only the
  // planted tiles is far cheaper than a dense array sized to the whole grid.
  private readonly plants = new Map<number, PlantType>();
  readonly width: number;
  readonly height: number;

  constructor(terrain: readonly (readonly TerrainType[])[]) {
    this.height = terrain.length;
    this.width = terrain[0]?.length ?? 0;
    this.terrainCodes = new Uint8Array(this.width * this.height);
    this.habitatCodes = new Uint8Array(this.width * this.height);
    for (let row = 0; row < this.height; row++) {
      const rowTiles = terrain[row];
      if (!rowTiles) continue;
      for (let col = 0; col < this.width; col++) {
        const t = rowTiles[col];
        if (!t) continue;
        this.terrainCodes[this.index(col, row)] = terrainToCode(t);
      }
    }
  }

  // A width x height grid uniformly filled with one terrain, for the
  // generator to progressively overwrite via setTerrain/setHabitat.
  static empty(width: number, height: number, defaultTerrain: TerrainType): WorldGrid {
    const rows: TerrainType[][] = Array.from({ length: height }, () =>
      Array.from({ length: width }, () => defaultTerrain),
    );
    return new WorldGrid(rows);
  }

  private index(col: number, row: number): number {
    return row * this.width + col;
  }

  inBounds(col: number, row: number): boolean {
    return col >= 0 && col < this.width && row >= 0 && row < this.height;
  }

  private requireInBounds(col: number, row: number): number {
    if (!this.inBounds(col, row)) throw new RangeError(`(${col}, ${row}) is out of bounds`);
    return this.index(col, row);
  }

  getTerrain(col: number, row: number): TerrainType {
    const idx = this.requireInBounds(col, row);
    const code = this.terrainCodes[idx];
    if (code === undefined) throw new RangeError(`(${col}, ${row}) has no terrain code`);
    return codeToTerrain(code);
  }

  setTerrain(col: number, row: number, terrain: TerrainType): void {
    const idx = this.requireInBounds(col, row);
    this.terrainCodes[idx] = terrainToCode(terrain);
  }

  getHabitat(col: number, row: number): Habitat {
    const idx = this.requireInBounds(col, row);
    const code = this.habitatCodes[idx];
    if (code === undefined) throw new RangeError(`(${col}, ${row}) has no habitat code`);
    return codeToHabitat(code);
  }

  setHabitat(col: number, row: number, habitat: Habitat): void {
    const idx = this.requireInBounds(col, row);
    this.habitatCodes[idx] = habitatToCode(habitat);
  }

  getPlant(col: number, row: number): PlantType | null {
    const idx = this.requireInBounds(col, row);
    return this.plants.get(idx) ?? null;
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
    this.plants.set(this.index(col, row), plant);
    return true;
  }
}
