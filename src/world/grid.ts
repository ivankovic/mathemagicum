// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { Habitat } from "./habitat";
import type { PlacedObject } from "./objects";
import { type Crop, PLANTED_STAGE, type PlantType, canPlantOn, nextStage } from "./plants";
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
  // A crop carries its growth stage, unlike terrain or habitat: it is the one
  // thing on the map the player changes after generation.
  private readonly crops = new Map<number, Crop>();
  // Static structures (buildings, the village well) placed at generation
  // time. Sparse for the same reason as plants; a multi-tile object appears
  // once per occupied tile so lookups by (col, row) stay O(1), plus a flat
  // list for callers that need to enumerate every object once (rendering).
  private readonly objectsByTile = new Map<number, PlacedObject>();
  private readonly objectList: PlacedObject[] = [];
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

  getCrop(col: number, row: number): Crop | null {
    const idx = this.requireInBounds(col, row);
    return this.crops.get(idx) ?? null;
  }

  getPlant(col: number, row: number): PlantType | null {
    return this.getCrop(col, row)?.plant ?? null;
  }

  isPassable(col: number, row: number): boolean {
    if (!this.inBounds(col, row)) return false;
    if (!isPassable(this.getTerrain(col, row))) return false;
    const object = this.objectsByTile.get(this.index(col, row));
    return !object?.blocksMovement;
  }

  // Stamps the object onto every tile of its footprint. Callers are
  // responsible for footprints not overlapping — generation-time layout
  // code controls its own placement, so there's no runtime conflict to
  // detect here (unlike plant(), which is called from live gameplay).
  placeObject(object: PlacedObject): void {
    this.objectList.push(object);
    for (let row = object.row; row < object.row + object.height; row++) {
      for (let col = object.col; col < object.col + object.width; col++) {
        if (!this.inBounds(col, row)) continue;
        this.objectsByTile.set(this.index(col, row), object);
      }
    }
  }

  /**
   * Removes whatever object occupies this cell, footprint and all.
   *
   * Used when carving a guaranteed route: an object blocks a tile whatever
   * the terrain under it is, so a carve that only rewrites terrain cannot
   * open a way through one.
   */
  removeObjectAt(col: number, row: number): PlacedObject | null {
    const object = this.getObjectAt(col, row);
    if (!object) return null;
    for (let r = object.row; r < object.row + object.height; r++) {
      for (let c = object.col; c < object.col + object.width; c++) {
        if (!this.inBounds(c, r)) continue;
        if (this.objectsByTile.get(this.index(c, r)) === object) {
          this.objectsByTile.delete(this.index(c, r));
        }
      }
    }
    const at = this.objectList.indexOf(object);
    if (at >= 0) this.objectList.splice(at, 1);
    return object;
  }

  getObjectAt(col: number, row: number): PlacedObject | null {
    if (!this.inBounds(col, row)) return null;
    return this.objectsByTile.get(this.index(col, row)) ?? null;
  }

  listObjects(): readonly PlacedObject[] {
    return this.objectList;
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
    this.crops.set(this.index(col, row), { plant, stage: PLANTED_STAGE });
    return true;
  }

  /**
   * Move the crop on this tile one stage further along, if there is one and
   * it is not already grown.
   *
   * Returns the crop as it now stands, or null if nothing changed. Nothing
   * here decides *when* growth happens — that is the addition spell's job
   * (`src/spells/addition.ts`), and keeping the decision out of the grid is
   * what stops a second growing spell from having to negotiate with this one.
   */
  growCrop(col: number, row: number): Crop | null {
    const idx = this.requireInBounds(col, row);
    const crop = this.crops.get(idx);
    if (!crop) return null;
    const stage = nextStage(crop.stage);
    if (!stage) return null;
    const grown = { plant: crop.plant, stage };
    this.crops.set(idx, grown);
    return grown;
  }
}
