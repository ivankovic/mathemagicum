// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { Habitat } from "./habitat";
import { canStepBetween } from "./levels";
import type { PlacedObject } from "./objects";
import {
  type Crop,
  HARVEST_STAGE,
  PLANTED_STAGE,
  type PlantType,
  canPlantOn,
  nextStage,
} from "./plants";
import { TerrainType, isPassable } from "./terrain";
import type { GridPoint } from "./topdown";

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
  /**
   * How high off the ground each cell is, as a whole number of steps.
   *
   * Stored rather than derived from terrain, because two patches of the same
   * terrain can be at different heights — a step up in a meadow is grass
   * above and grass below. It is also what a ramp is: a place where the
   * level does not step, cut through a run where it otherwise would. See
   * src/world/levels.ts.
   */
  private readonly levelCodes: Uint8Array;
  /**
   * Where the level may be changed: the ways up.
   *
   * A flag rather than a shape in the level field, because a ramp cut by
   * lowering the ground moves the step instead of removing it — see
   * `canStepBetween`. One cell of this on either side of a step makes that
   * step crossable, and it is also what tells the renderer to draw the ramp
   * tile rather than the cliff.
   */
  private readonly rampFlags: Uint8Array;
  // Plants are sparse (most tiles are never planted), so a map of only the
  // planted tiles is far cheaper than a dense array sized to the whole grid.
  // A crop carries its growth stage, unlike terrain or habitat: it is the one
  // thing on the map the player changes after generation.
  private readonly crops = new Map<number, Crop>();
  /**
   * Cells with a plank deck over them: the harbour's piers.
   *
   * A sparse set rather than a terrain, and that is a design decision worth
   * stating. A pier is a *built thing on top of* water, not a kind of
   * ground — and making it a terrain would have cost the shipped atlas 2,465
   * new frames, because the dual-grid blend enumerates every four-corner
   * combination of every material against every other. Two and a half
   * thousand frames for something that appears in one place on the map.
   *
   * So it rides over whatever is underneath, exactly as a crop does, and the
   * only rule it changes is that you can stand on it.
   */
  private readonly bridges = new Set<number>();
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
    this.levelCodes = new Uint8Array(this.width * this.height);
    this.rampFlags = new Uint8Array(this.width * this.height);
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

  getLevel(col: number, row: number): number {
    const idx = this.requireInBounds(col, row);
    return this.levelCodes[idx] ?? 0;
  }

  setLevel(col: number, row: number, level: number): void {
    const idx = this.requireInBounds(col, row);
    this.levelCodes[idx] = Math.max(0, Math.min(255, Math.trunc(level)));
  }

  isRamp(col: number, row: number): boolean {
    if (!this.inBounds(col, row)) return false;
    return this.rampFlags[row * this.width + col] === 1;
  }

  setRamp(col: number, row: number, ramp: boolean): void {
    const idx = this.requireInBounds(col, row);
    this.rampFlags[idx] = ramp ? 1 : 0;
  }

  /**
   * Whether the player can walk from one cell to a neighbouring one.
   *
   * `isPassable` asks whether a cell can be *stood on*; this asks whether a
   * particular step is allowed, and the difference is the whole of what a
   * cliff means to movement. Both sides of a step up are perfectly good
   * ground — you simply cannot get from one to the other, except where a
   * ramp has brought them to the same level.
   *
   * Everything that moves has to ask this rather than `isPassable` alone.
   * Anything that only asks the old question will walk up cliffs.
   */
  canStep(from: GridPoint, to: GridPoint): boolean {
    if (!this.isPassable(to.col, to.row)) return false;
    if (!this.inBounds(from.col, from.row)) return false;
    return canStepBetween(
      this.getLevel(from.col, from.row),
      this.getLevel(to.col, to.row),
      this.isRamp(from.col, from.row),
      this.isRamp(to.col, to.row),
    );
  }

  /** The whole level field, for the passes that work on it in bulk. */
  levels(): Uint8Array {
    return this.levelCodes;
  }

  /** Replace it wholesale, after a pass that returned a new one. */
  setLevels(levels: Uint8Array): void {
    if (levels.length !== this.levelCodes.length) {
      throw new Error("a level field must be the same size as the grid");
    }
    this.levelCodes.set(levels);
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
    // A deck over the water is the one thing that makes unwalkable ground
    // walkable. Checked before the terrain rather than instead of it, so a
    // pier laid over sand — which happens where it meets the beach — is
    // still just sand with planks on it.
    if (!isPassable(this.getTerrain(col, row)) && !this.isBridged(col, row)) return false;
    const object = this.objectsByTile.get(this.index(col, row));
    return !object?.blocksMovement;
  }

  isBridged(col: number, row: number): boolean {
    if (!this.inBounds(col, row)) return false;
    return this.bridges.has(this.index(col, row));
  }

  setBridge(col: number, row: number, decked: boolean): void {
    const idx = this.requireInBounds(col, row);
    if (decked) this.bridges.add(idx);
    else this.bridges.delete(idx);
  }

  /**
   * Every decked cell, for the renderer.
   *
   * Walked from the sparse set rather than over the grid, for the reason
   * `listCrops` is: a world is a quarter of a million cells and a harbour
   * has a few dozen planks in it.
   */
  listBridges(): GridPoint[] {
    return [...this.bridges].map((idx) => ({
      col: idx % this.width,
      row: Math.floor(idx / this.width),
    }));
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
    // Planks are not soil. The rule would mostly hold without this — no
    // crop grows on water — but a pier reaching up the beach is laid over
    // sand, and the cactus does grow on that.
    if (this.isBridged(col, row)) return false;
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
   * Every planted tile, for saving.
   *
   * Walked from the sparse map rather than over the grid: a world is a
   * quarter of a million cells and a well-played one has a few dozen crops
   * in it, so this is the difference between a save that is instant and one
   * that stutters the game every time it happens.
   */
  listCrops(): readonly (readonly [number, number, Crop])[] {
    const out: (readonly [number, number, Crop])[] = [];
    for (const [idx, crop] of this.crops) {
      out.push([idx % this.width, Math.floor(idx / this.width), crop]);
    }
    return out;
  }

  /**
   * Put a crop back exactly as it was, growth and all.
   *
   * Deliberately not `plant()`: that one starts a seed and refuses ground a
   * crop cannot grow on, both of which are right for a child planting and
   * wrong for a save being restored — a carrot that was legal when it was
   * planted must come back even if the rule about carrots has since changed,
   * or a world reloads with holes in it.
   */
  restoreCrop(col: number, row: number, crop: Crop): void {
    this.crops.set(this.requireInBounds(col, row), crop);
  }

  /**
   * Take the crop off this tile, if there is one and it is ready.
   *
   * Returns what was picked, or null if the tile is bare or the crop is
   * still growing. The maturity rule lives here rather than at the call site
   * for the same reason `growCrop`'s does: what "ready" means is a fact about
   * a crop, and a second thing that harvests should not get to have its own
   * opinion about it.
   */
  harvestCrop(col: number, row: number): Crop | null {
    const idx = this.requireInBounds(col, row);
    const crop = this.crops.get(idx);
    if (!crop || crop.stage !== HARVEST_STAGE) return null;
    this.crops.delete(idx);
    return crop;
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
