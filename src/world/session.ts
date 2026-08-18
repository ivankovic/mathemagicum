// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { EN } from "../i18n/en";
import type { Phrases } from "../i18n/phrases";
import { type Facing, facingFor, stepForFacing } from "./characters";
import { type FixtureType, isPlaceable } from "./fixtures";
import type { WorldGrid } from "./grid";
import { Inventory, type ItemType } from "./inventory";
import type { PlacedObject } from "./objects";
import { type Crop, HARVEST_YIELD, PlantStage, type PlantType } from "./plants";
import { Purse, type Trade, buyStock, sellCrops } from "./shop";
import type { GridPoint } from "./topdown";

/**
 * Everything the player can do, with none of what it looks like.
 *
 * This exists because the rules used to live inside the Phaser scene, tangled
 * up with sprites, cameras and tweens — so the only way to check that
 * planting a seed, growing it twice, picking it, selling it and buying a
 * fence all worked together was to drive a browser and look at screenshots.
 * That found real bugs, but slowly, and it never found the ones nobody
 * thought to photograph: selling a crop you do not have, fencing yourself
 * into a corner, casting on bare ground.
 *
 * So the rules moved here and the scene became a renderer over them. The test
 * for that whole loop is now a few lines of arithmetic that runs in
 * milliseconds, and the scene is left holding only the things a headless test
 * could never have checked anyway.
 *
 * Every action returns what happened *and what to say about it*. The message
 * is part of the rule rather than a decoration the caller adds: a refusal the
 * player cannot see reads as the game having missed the input, and putting
 * the wording next to the condition is what stops the two drifting apart.
 */

export interface ActionResult {
  readonly ok: boolean;
  readonly message: string;
  /** The tile acted on, when there was one. */
  readonly tile?: GridPoint;
}

export interface PlantResult extends ActionResult {
  readonly plant?: PlantType;
}

export interface CropResult extends ActionResult {
  readonly crop?: Crop;
}

export interface PlaceResult extends ActionResult {
  readonly fixture?: FixtureType;
  readonly object?: PlacedObject;
}

export interface SessionOptions {
  readonly grid: WorldGrid;
  readonly start: GridPoint;
  readonly facing?: Facing;
  /** Defaults to English, so a test of the rules need not pick a language. */
  readonly phrases?: Phrases;
}

/** How far a thing can be and still be worked: one orthogonal step. */
export function stepsBetween(a: GridPoint, b: GridPoint): number {
  return Math.abs(a.col - b.col) + Math.abs(a.row - b.row);
}

/**
 * How far a *person* can be and still be spoken to: one step in any
 * direction, diagonals included.
 *
 * Deliberately not the same measure as `stepsBetween`. Gardening acts on the
 * tile the player faces and there is no diagonal facing to turn to, so a
 * diagonal neighbour is genuinely out of reach. Talking needs no facing, and
 * refusing someone standing at your corner would be a rule with no reason
 * behind it that the player could see.
 */
export function stepsToSpeak(a: GridPoint, b: GridPoint): number {
  return Math.max(Math.abs(a.col - b.col), Math.abs(a.row - b.row));
}

export class GameSession {
  readonly grid: WorldGrid;
  /**
   * The words every refusal and every result is written in.
   *
   * Held rather than reached for, and swappable, because the player can
   * change language mid-game: the session keeps the rules, and the rules
   * decide what to say about themselves — a message written by the renderer
   * instead would have to repeat the condition that produced it.
   */
  private words: Phrases;
  readonly inventory = new Inventory();
  readonly purse = new Purse();

  private position: GridPoint;
  private heading: Facing;
  /**
   * Whether the player is inside a building.
   *
   * The scene owns the mode itself — swapping grids, layers and the camera —
   * but the *rule* that nothing may be gardened in there lives with the other
   * rules, so every refusal message sits next to the condition that produces
   * it rather than half here and half in a renderer.
   */
  indoors = false;

  constructor(options: SessionOptions) {
    this.grid = options.grid;
    this.words = options.phrases ?? EN;
    this.position = { col: options.start.col, row: options.start.row };
    this.heading = options.facing ?? ("down" as Facing);
  }

  /** Say everything from here on in another language. */
  setPhrases(phrases: Phrases): void {
    this.words = phrases;
  }

  get col(): number {
    return this.position.col;
  }

  get row(): number {
    return this.position.row;
  }

  get tile(): GridPoint {
    return { col: this.position.col, row: this.position.row };
  }

  get facing(): Facing {
    return this.heading;
  }

  setPosition(col: number, row: number): void {
    this.position = { col, row };
  }

  /** Point her a given way, without moving her. */
  face(facing: Facing): void {
    this.heading = facing;
  }

  /** Turn to face a step, keeping the current facing if it does not move. */
  turnToward(dCol: number, dRow: number): Facing {
    this.heading = facingFor(dCol, dRow, this.heading);
    return this.heading;
  }

  /**
   * The tile the player is facing — the one every gardening action works on.
   *
   * Gardening used to happen on the tile the player was *standing* on, which
   * has two problems the moment a crop is something you come back to. A
   * seedling under the player's own feet is drawn behind them and invisible,
   * so planting appeared to do nothing; and standing on a tile is the one
   * position from which you cannot see what is on it.
   */
  facingTile(): GridPoint {
    const step = stepForFacing(this.heading);
    return { col: this.position.col + step.dCol, row: this.position.row + step.dRow };
  }

  // --- gardening ----------------------------------------------------------

  plant(plant: PlantType): PlantResult {
    if (this.indoors) return { ok: false, message: this.words.nothingGrowsIndoors };
    const { col, row } = this.facingTile();
    // The tile underfoot was passable by definition; the one ahead is not.
    // Checked before anything reads the terrain there, because both the
    // world's edge and a tile occupied by a tree are reachable states and
    // `getTerrain` throws off the edge of the grid.
    if (!this.grid.isPassable(col, row)) {
      return { ok: false, message: this.words.noRoomToPlant };
    }
    if (this.grid.getPlant(col, row) !== null) {
      return { ok: false, message: this.words.alreadyPlanted };
    }
    if (!this.grid.plant(col, row, plant)) {
      return { ok: false, message: this.words.wrongGround(plant, this.grid.getTerrain(col, row)) };
    }
    return {
      ok: true,
      message: this.words.planted(plant),
      tile: { col, row },
      plant,
    };
  }

  /**
   * Whether there is anything ahead worth casting the growth spell on.
   *
   * Separate from applying it because the spell is a minigame: the scene asks
   * this before opening the parchment, and applies the result only if the
   * player solves it. Both halves name the same tile, which is what stops a
   * cast landing somewhere other than where it was aimed.
   */
  checkGrowth(): CropResult {
    if (this.indoors) return { ok: false, message: this.words.nothingGrowsIndoors };
    const { col, row } = this.facingTile();
    if (!this.grid.inBounds(col, row)) {
      return { ok: false, message: this.words.faceToGrow };
    }
    const crop = this.grid.getCrop(col, row);
    if (!crop) return { ok: false, message: this.words.faceToGrow };
    if (crop.stage === PlantStage.Mature) {
      return {
        ok: false,
        message: this.words.alreadyGrown(crop.plant),
        tile: { col, row },
      };
    }
    return { ok: true, message: "", tile: { col, row }, crop };
  }

  growAt(col: number, row: number): CropResult {
    if (!this.grid.inBounds(col, row)) return { ok: false, message: "" };
    const grown = this.grid.growCrop(col, row);
    if (!grown) return { ok: false, message: "" };
    return {
      ok: true,
      message: this.words.grownTo(grown.plant, grown.stage),
      tile: { col, row },
      crop: grown,
    };
  }

  /**
   * Pick a ripe crop.
   *
   * One rule whichever way it is asked for: she can pick a crop she is
   * facing, or one she is standing on. Two routes with two reaches would be
   * two rules for one verb.
   */
  harvest(): CropResult {
    if (this.indoors) return { ok: false, message: this.words.nothingGrowsIndoors };
    const ahead = this.facingTile();
    const picked = this.pickAt(ahead) ?? this.pickAt(this.tile);
    if (picked) {
      const held = this.inventory.add(picked.crop.plant, HARVEST_YIELD);
      return {
        ok: true,
        message: this.words.picked(picked.crop.plant, held),
        tile: picked.tile,
        crop: picked.crop,
      };
    }
    // Nothing was picked. Say why, about the tile she was most likely aiming
    // at — a silent refusal reads as the game having missed the input.
    const crop =
      (this.grid.inBounds(ahead.col, ahead.row) ? this.grid.getCrop(ahead.col, ahead.row) : null) ??
      this.grid.getCrop(this.col, this.row);
    return {
      ok: false,
      message: crop ? this.words.notRipe(crop.plant) : this.words.faceToPick,
    };
  }

  private pickAt(at: GridPoint): { tile: GridPoint; crop: Crop } | null {
    if (!this.grid.inBounds(at.col, at.row)) return null;
    const crop = this.grid.harvestCrop(at.col, at.row);
    return crop ? { tile: at, crop } : null;
  }

  // --- things she has bought ----------------------------------------------

  /**
   * Put one bought fixture on the tile ahead.
   *
   * Placed things block the way, which is a state the player can walk herself
   * into a corner with — so the answer is not a connectivity check before
   * every placement but that anything she puts down she can pick back up. A
   * fence that boxed her in is adjacent by definition.
   */
  place(fixture: FixtureType): PlaceResult {
    if (this.indoors) return { ok: false, message: this.words.notInHere };
    if (!isPlaceable(fixture)) return { ok: false, message: this.words.notYours(fixture) };
    if (this.inventory.count(fixture) <= 0) {
      return { ok: false, message: this.words.noneLeft(fixture) };
    }
    const { col, row } = this.facingTile();
    // Generation-time placement could assume it owned the map; this cannot,
    // so the tile has to be checked for everything already on it.
    if (!this.grid.isPassable(col, row)) return { ok: false, message: this.words.noRoomThere };
    if (this.grid.getCrop(col, row)) return { ok: false, message: this.words.somethingGrowing };
    if (!this.inventory.remove(fixture, 1)) return { ok: false, message: "" };

    const object: PlacedObject = {
      id: `${fixture}-${col}-${row}`,
      type: fixture,
      col,
      row,
      width: 1,
      height: 1,
      blocksMovement: true,
      anchorCol: col,
      anchorRow: row,
    };
    this.grid.placeObject(object);
    return {
      ok: true,
      message: this.words.putDown(fixture),
      tile: { col, row },
      fixture,
      object,
    };
  }

  /** Take a placed fixture back, if it is within one step. */
  takeBack(fixture: FixtureType, col: number, row: number): PlaceResult {
    if (this.indoors) return { ok: false, message: this.words.notInHere };
    if (stepsBetween(this.tile, { col, row }) > 1) {
      return { ok: false, message: this.words.tooFarToReach };
    }
    if (!this.grid.removeObjectAt(col, row)) return { ok: false, message: "" };
    const held = this.inventory.add(fixture, 1);
    return {
      ok: true,
      message: this.words.pickedUp(fixture, held),
      tile: { col, row },
      fixture,
    };
  }

  // --- trade ---------------------------------------------------------------

  /**
   * Sell crops, having already been paid.
   *
   * Quantities now, not one at a time: the shopkeeper counts out a payment
   * for the whole lot and the player checks the sum, so selling three
   * carrots one at a time would be three sums instead of one.
   */
  sell(item: ItemType, count = 1): Trade {
    return sellCrops(this.inventory, this.purse, item, count);
  }

  /** Buy stock, having already counted the money out. */
  buy(fixture: FixtureType, count = 1): Trade {
    return buyStock(this.inventory, this.purse, fixture, count);
  }
}
