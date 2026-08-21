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
import { sceneryKind } from "./scenery";
import { type Patch, patchCells } from "./selection";
import { CROP_PRICE, Purse, type Trade, buyStock, sellCrops } from "./shop";
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
 * Every action returns what happened *and why*, as a value rather than as a
 * sentence. It used to return the sentence: a refusal the player cannot see
 * reads as the game having missed the input, and keeping the wording next to
 * the condition was what stopped the two drifting apart.
 *
 * The reason it is a value now is that **the game no longer says anything in
 * words**. A line of small type along the top of the screen is unreadable to
 * the child it is for — their eyes are on the square they just tried to
 * plant, and the youngest of them cannot read at all — so every refusal and
 * every result is drawn where it happened instead. A picture cannot be
 * looked up in a phrase book, so the rule has to name what went wrong rather
 * than how to phrase it.
 *
 * It also means the rules no longer know what language the game is in, which
 * they never had any business knowing.
 */

/**
 * Why an action was refused, or what it did.
 *
 * One name per condition, and every condition has one: the scene turns these
 * into marks on the world, and a condition that shared a name with another
 * would be two different problems drawn the same way.
 */
export const Outcome = {
  // --- refusals -----------------------------------------------------------
  /** Nothing grows indoors, and nothing is put down in here either. */
  Indoors: "indoors",
  /** The square is taken: a wall, a tree, a fence, the edge of the world. */
  NoRoom: "no-room",
  /** The square is fine but the crop will not grow on that ground. */
  WrongGround: "wrong-ground",
  /** Something is already planted there. */
  AlreadyPlanted: "already-planted",
  /** It is already as grown as it gets. */
  AlreadyGrown: "already-grown",
  /** There is nothing on that square to pick, clear or take back. */
  NothingThere: "nothing-there",
  /** That square holds something the player is not allowed to remove. */
  NotYours: "not-yours",
  /** The basket, pouch or crate is empty of the thing being asked for. */
  NoneLeft: "none-left",
  /** It is out of reach: one step, and this is more. */
  TooFar: "too-far",
  /** She is not facing anything that could be grown. */
  FacingNothing: "facing-nothing",

  // --- things that happened ------------------------------------------------
  Planted: "planted",
  Grew: "grew",
  Picked: "picked",
  PutDown: "put-down",
  PickedUp: "picked-up",
  Cleared: "cleared",
} as const;

export type Outcome = (typeof Outcome)[keyof typeof Outcome];

export interface ActionResult {
  readonly ok: boolean;
  /** What happened, or why it did not. */
  readonly outcome: Outcome;
  /**
   * The tile acted on — or, when the action was refused, the tile it was
   * refused *about*.
   *
   * Named on a refusal as well as on a success because of what the refusal
   * has to do on screen. A line of small type along the top of the display
   * is unreadable to the child it is for: their eyes are on the square they
   * just tried to plant, several hundred pixels away, and a six-year-old may
   * not read it at all. So the game says no *where the no happened*, and the
   * only thing that can tell it where is the rule that refused.
   *
   * Absent when the refusal is not about a square — no seeds left, nothing
   * in the basket — which is exactly when there is nowhere to point.
   */
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
 * tile the player *faces*, and a facing is one of four however the player
 * got there — walking diagonally is a thing the game now does, but being
 * drawn diagonally is not — so a diagonal neighbour is still genuinely out
 * of reach of a trowel. Talking needs no facing, and refusing someone
 * standing at your corner would be a rule with no reason behind it that the
 * player could see.
 */
export function stepsToSpeak(a: GridPoint, b: GridPoint): number {
  return Math.max(Math.abs(a.col - b.col), Math.abs(a.row - b.row));
}

export class GameSession {
  readonly grid: WorldGrid;
  readonly inventory = new Inventory();
  readonly purse = new Purse();
  /**
   * What a crop fetches for the child playing.
   *
   * Held here and swappable for the same reason the phrases are: it is a
   * fact about who is playing rather than about the shop, and the panel that
   * draws the counter should be asking the session rather than being handed
   * a number to keep in step with everything else that quotes one.
   */
  cropPrice = CROP_PRICE;

  private position: GridPoint;
  private heading: Facing;
  /**
   * Whether the player is inside a building.
   *
   * The scene owns the mode itself — swapping grids, layers and the camera —
   * but the *rule* that nothing may be gardened in there lives with the other
   * rules, so every refusal sits next to the condition that produces it
   * rather than half here and half in a renderer.
   */
  indoors = false;

  constructor(options: SessionOptions) {
    this.grid = options.grid;
    this.position = { col: options.start.col, row: options.start.row };
    this.heading = options.facing ?? ("down" as Facing);
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
    if (this.indoors) return { ok: false, outcome: Outcome.Indoors };
    const { col, row } = this.facingTile();
    // The tile underfoot was passable by definition; the one ahead is not.
    // Checked before anything reads the terrain there, because both the
    // world's edge and a tile occupied by a tree are reachable states and
    // `getTerrain` throws off the edge of the grid.
    if (!this.grid.isPassable(col, row)) {
      return { ok: false, outcome: Outcome.NoRoom, tile: { col, row } };
    }
    if (this.grid.getPlant(col, row) !== null) {
      return { ok: false, outcome: Outcome.AlreadyPlanted, tile: { col, row } };
    }
    if (!this.grid.plant(col, row, plant)) {
      return {
        ok: false,
        outcome: Outcome.WrongGround,
        tile: { col, row },
      };
    }
    return {
      ok: true,
      outcome: Outcome.Planted,
      tile: { col, row },
      plant,
    };
  }

  /**
   * Which cells of a patch would take a given action.
   *
   * The array spell is now an *area* tool: the player draws a rectangle,
   * picks what to do to it, and one multiplication buys that many of it. So
   * what the spell needs from the world is not "does this shape fit" but
   * "how much of what they drew can this actually happen to" — and the
   * answer is a list, because the scene has to touch each cell afterwards.
   *
   * **Every cell that will take it, and no refusal for the rest.** A spell
   * that chose its own rectangle had to be all-or-nothing: one that planted
   * nineteen of twenty-four would have lied about what it was going to do.
   * A rectangle the *player* drew is different — they can see what is in it,
   * and the game refusing the whole patch because one corner has a rock in
   * it would be the game arguing with a plain instruction. It does what it
   * can and says how much that was; it only refuses when the answer is none.
   */
  plantableIn(plant: PlantType, patch: Patch): GridPoint[] {
    if (this.indoors) return [];
    return patchCells(patch).filter(
      (at) => this.grid.isPassable(at.col, at.row) && this.grid.canPlant(at.col, at.row, plant),
    );
  }

  growableIn(patch: Patch): GridPoint[] {
    if (this.indoors) return [];
    return patchCells(patch).filter((at) => {
      const crop = this.grid.getCrop(at.col, at.row);
      return crop !== null && crop.stage !== PlantStage.Mature;
    });
  }

  clearableIn(patch: Patch): GridPoint[] {
    if (this.indoors) return [];
    return patchCells(patch).filter((at) => {
      const object = this.grid.getObjectAt(at.col, at.row);
      return object !== null && sceneryKind(object.type) !== null;
    });
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
    if (this.indoors) return { ok: false, outcome: Outcome.Indoors };
    const { col, row } = this.facingTile();
    if (!this.grid.inBounds(col, row)) {
      return { ok: false, outcome: Outcome.FacingNothing };
    }
    const crop = this.grid.getCrop(col, row);
    if (!crop) return { ok: false, outcome: Outcome.FacingNothing, tile: { col, row } };
    if (crop.stage === PlantStage.Mature) {
      return {
        ok: false,
        outcome: Outcome.AlreadyGrown,
        tile: { col, row },
      };
    }
    return { ok: true, outcome: Outcome.Grew, tile: { col, row }, crop };
  }

  /**
   * Whether there is something in the way that the clearing spell may take.
   *
   * Scenery only: the trees, boulders and outcrops the ground grew. A fence
   * or a lamp is *yours* — you bought it and set it down, and a spell that
   * unmade it would be a spell that could undo an afternoon's shopping by
   * being cast at the wrong tile. A building is not even a candidate.
   *
   * The tile in front, like planting and growing, and for the same reason:
   * three gardening actions that targeted different tiles would mean facing
   * one way to plant and another to clear.
   */
  checkClearing(): ActionResult {
    if (this.indoors) return { ok: false, outcome: Outcome.NothingThere };
    const { col, row } = this.facingTile();
    if (!this.grid.inBounds(col, row)) return { ok: false, outcome: Outcome.NothingThere };
    const object = this.grid.getObjectAt(col, row);
    if (!object) return { ok: false, outcome: Outcome.NothingThere, tile: { col, row } };
    if (sceneryKind(object.type) === null) {
      return { ok: false, outcome: Outcome.NotYours, tile: { col, row } };
    }
    return { ok: true, outcome: Outcome.Cleared, tile: { col, row } };
  }

  /** Take it away. Gives back what stood there, so the scene can unmake it. */
  clearAt(col: number, row: number): PlacedObject | null {
    const object = this.grid.getObjectAt(col, row);
    if (!object || sceneryKind(object.type) === null) return null;
    return this.grid.removeObjectAt(col, row);
  }

  growAt(col: number, row: number): CropResult {
    if (!this.grid.inBounds(col, row)) return { ok: false, outcome: Outcome.NothingThere };
    const grown = this.grid.growCrop(col, row);
    if (!grown) return { ok: false, outcome: Outcome.NothingThere };
    return {
      ok: true,
      outcome: Outcome.Grew,
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
    if (this.indoors) return { ok: false, outcome: Outcome.Indoors };
    const ahead = this.facingTile();
    const picked = this.pickAt(ahead) ?? this.pickAt(this.tile);
    if (picked) {
      const held = this.inventory.add(picked.crop.plant, HARVEST_YIELD);
      return {
        ok: true,
        outcome: Outcome.Picked,
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
      // Not ripe yet, or nothing there at all: from the outside both are
      // "this square has nothing for you", and the square shows which.
      outcome: crop ? Outcome.AlreadyPlanted : Outcome.NothingThere,
      tile: ahead,
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
    if (this.indoors) return { ok: false, outcome: Outcome.Indoors };
    if (!isPlaceable(fixture)) return { ok: false, outcome: Outcome.NotYours };
    if (this.inventory.count(fixture) <= 0) {
      return { ok: false, outcome: Outcome.NoneLeft };
    }
    const { col, row } = this.facingTile();
    // Generation-time placement could assume it owned the map; this cannot,
    // so the tile has to be checked for everything already on it.
    if (!this.grid.isPassable(col, row)) {
      return { ok: false, outcome: Outcome.NoRoom, tile: { col, row } };
    }
    if (this.grid.getCrop(col, row)) {
      return { ok: false, outcome: Outcome.AlreadyPlanted, tile: { col, row } };
    }
    if (!this.inventory.remove(fixture, 1)) return { ok: false, outcome: Outcome.NoneLeft };

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
      outcome: Outcome.PutDown,
      tile: { col, row },
      fixture,
      object,
    };
  }

  /** Take a placed fixture back, if it is within one step. */
  takeBack(fixture: FixtureType, col: number, row: number): PlaceResult {
    if (this.indoors) return { ok: false, outcome: Outcome.Indoors };
    if (stepsBetween(this.tile, { col, row }) > 1) {
      return { ok: false, outcome: Outcome.TooFar, tile: { col, row } };
    }
    if (!this.grid.removeObjectAt(col, row)) return { ok: false, outcome: Outcome.NothingThere };
    const held = this.inventory.add(fixture, 1);
    return {
      ok: true,
      outcome: Outcome.PickedUp,
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
    return sellCrops(this.inventory, this.purse, item, count, this.cropPrice);
  }

  /** Buy stock, having already counted the money out. */
  buy(fixture: FixtureType, count = 1): Trade {
    return buyStock(this.inventory, this.purse, fixture, count, this.cropPrice);
  }
}
