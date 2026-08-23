// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { DEFAULT_FACING, Facing } from "../world/characters";
import type { WorldGrid } from "../world/grid";
import { ITEM_TYPES, type ItemType } from "../world/inventory";
import type { PlacedObject } from "../world/objects";
import { PLANT_STAGES, PLANT_TYPES, type PlantStage, type PlantType } from "../world/plants";
import type { GameSession } from "../world/session";
import type { GridPoint } from "../world/topdown";

/**
 * A played world, written down.
 *
 * What is *not* here is the world. Terrain, elevation, habitats, the village
 * and everyone in it all come back from the seed, which is a number — so a
 * save holds only what a child changed, and a thoroughly farmed world is a
 * few kilobytes rather than a few megabytes.
 *
 * That trade has one price and it is worth naming: the diff is anchored to a
 * world the generator produces, and the generator is still being worked on.
 * Change a habitat rule and the same seed grows a different coastline, at
 * which point a saved fence can land in the sea. `GENERATOR_VERSION` below is
 * how that is caught rather than discovered by a child walking into it.
 *
 * Nothing here touches Phaser or storage. It turns a live session into plain
 * data and back, which is the whole of what a test needs to check.
 */

/**
 * Bumped by hand whenever a change to world generation moves what a seed
 * produces.
 *
 * Deliberately manual. Deriving it — hashing the generator's source, say —
 * would invalidate every save on a comment, and a scheme that cries wolf is
 * one somebody eventually routes around.
 */
export const GENERATOR_VERSION = 1;

/** Bumped when the shape below changes, which is a different thing. */
export const SNAPSHOT_VERSION = 1;

export interface WorldSnapshot {
  /** Planted tiles: column, row, what, how grown. */
  readonly crops: readonly (readonly [number, number, PlantType, PlantStage])[];
  /** What the player put down that the generator did not. */
  readonly placed: readonly PlacedObject[];
  /** Generated objects the player took away, by the tile they stood on. */
  readonly cleared: readonly (readonly [number, number])[];
  /**
   * The floor plan of every house somebody has added a room to, by building.
   *
   * Here rather than with the child, and the placement is the whole of it: a
   * house is a fact about the world, and two siblings on one tablet own
   * different cottages in the same village. Keeping a plan on the *player*
   * would put sister's extension in brother's house the moment he walked
   * into his own.
   *
   * Only the floor, as `col,row` keys — the walls are worked out from it,
   * and a save with both in it is a save whose two halves can disagree. Only
   * houses that have been *changed* appear: a cottage nobody has touched is
   * the cottage the generator shipped, and writing that down every autosave
   * would be storing the absence of news.
   *
   * Optional, because every save written before anybody could build has no
   * such thing and must go on loading.
   */
  readonly plans?: Readonly<Record<string, readonly string[]>>;
  /**
   * How each house is furnished, by building.
   *
   * Beside the floor plans and for the same reason: a house is a fact about
   * the world, and two siblings own different cottages in one village. Only
   * houses that have been *rearranged* appear — a room nobody has touched is
   * the room the generator drew, and writing that down every autosave would
   * be storing the absence of news.
   */
  readonly decor?: Readonly<Record<string, readonly string[]>>;
}

export interface PlayerSnapshot {
  readonly col: number;
  readonly row: number;
  readonly facing: Facing;
  readonly coins: number;
  readonly items: readonly (readonly [ItemType, number])[];
}

/**
 * The world file: the ground everybody shares, and nothing about anybody.
 *
 * The player used to be in here, back when a world belonged to one child.
 * Splitting them is what sharing actually cost — and it paid for itself
 * immediately: a child's purse and basket are now nowhere near the world
 * file, so rebuilding a world after a generator change cannot touch them.
 * There is no "what does the child keep" question left to answer.
 */
export interface GameSnapshot {
  readonly snapshotVersion: number;
  readonly generatorVersion: number;
  readonly seed: number;
  readonly world: WorldSnapshot;
  /**
   * When this was written, as a wall-clock timestamp.
   *
   * Here rather than on the player, and that placement is the whole of it.
   * The profile's `lastPlayed` is bumped whenever anything about a *child*
   * changes — a rung moving, a spell learned — so it answers "when did
   * something happen", not "when did they stop". And a field written only on
   * the way out would be stale whenever the way out never runs: a killed
   * tab, a phone reaping the page, a crash.
   *
   * The world is written by a timer as well as on the way out, so this is
   * never more than one autosave interval behind whatever actually happened.
   * The hourglass spell reads it as "when you put the game down", and being
   * a minute out is invisible to a question asked in whole hours.
   */
  readonly savedAt: number;
}

/**
 * The objects the generator made, remembered before the player touches
 * anything.
 *
 * Taken once at load rather than worked out at save time, when the only way
 * to know what was generated would be to generate the world a second time —
 * a quarter of a million cells, every autosave, to answer a question the
 * game already knew the answer to when it started.
 */
export type WorldBaseline = ReadonlyMap<string, string>;

function tileKey(col: number, row: number): string {
  return `${col},${row}`;
}

/**
 * What stands on a tile, as far as a save is concerned.
 *
 * Type rather than id: two fences of the same kind on the same tile are the
 * same fence to a player, and ids are minted per run. The flip is in here
 * because it is the difference between the left and right side of an
 * enclosure, which is visible.
 */
function objectSignature(object: PlacedObject): string {
  return `${object.type}${object.flip ? "|flip" : ""}`;
}

export function worldBaseline(grid: WorldGrid): WorldBaseline {
  const generated = new Map<string, string>();
  for (const object of grid.listObjects()) {
    generated.set(tileKey(object.col, object.row), objectSignature(object));
  }
  return generated;
}

/**
 * The difference between the world as generated and the world as played.
 *
 * Compared by what stands on each tile, not merely by whether *something*
 * does. A player who takes the village's own fence down and puts one they
 * bought in its place leaves a tile that is occupied before and after — and
 * a check for occupancy alone would record no change at all, so the world
 * would reload with the generator's fence back and theirs gone.
 */
export function snapshotWorld(
  grid: WorldGrid,
  baseline: WorldBaseline,
  plans: Readonly<Record<string, readonly string[]>> = {},
  decor: Readonly<Record<string, readonly string[]>> = {},
): WorldSnapshot {
  const placed: PlacedObject[] = [];
  const standing = new Map<string, string>();
  for (const object of grid.listObjects()) {
    const key = tileKey(object.col, object.row);
    const signature = objectSignature(object);
    standing.set(key, signature);
    if (baseline.get(key) !== signature) placed.push(object);
  }
  const cleared: [number, number][] = [];
  for (const [key, signature] of baseline) {
    if (standing.get(key) === signature) continue;
    const [col, row] = key.split(",").map(Number);
    if (col !== undefined && row !== undefined) cleared.push([col, row]);
  }
  return {
    crops: grid.listCrops().map(([col, row, crop]) => [col, row, crop.plant, crop.stage] as const),
    placed,
    cleared,
    ...(Object.keys(plans).length > 0 ? { plans } : {}),
    ...(Object.keys(decor).length > 0 ? { decor } : {}),
  };
}

/**
 * The player, written down.
 *
 * The tile is passed in rather than read off the session, and that is the
 * whole point of the argument. A child inside the shop has `session.tile`
 * set to a cell of a six-by-five room, and a room cell is a perfectly
 * plausible tile on a five-hundred-square world — so an autosave that fired
 * while they were indoors would write a room coordinate into a world save,
 * pass every bounds check on the way back in, and put them down somewhere
 * arbitrary. What belongs here is the tile they would step out onto.
 */
export function snapshotPlayer(session: GameSession, outdoorAt: GridPoint): PlayerSnapshot {
  return {
    col: outdoorAt.col,
    row: outdoorAt.row,
    facing: session.facing,
    coins: session.purse.coins,
    items: session.inventory.entries().map(([item, count]) => [item, count] as const),
  };
}

export function snapshotGame(
  grid: WorldGrid,
  baseline: WorldBaseline,
  seed: number,
  savedAt: number,
  plans: Readonly<Record<string, readonly string[]>> = {},
  decor: Readonly<Record<string, readonly string[]>> = {},
): GameSnapshot {
  return {
    snapshotVersion: SNAPSHOT_VERSION,
    generatorVersion: GENERATOR_VERSION,
    seed,
    world: snapshotWorld(grid, baseline, plans, decor),
    savedAt,
  };
}

/**
 * The floor plans out of a save, with anything mangled dropped.
 *
 * A bad plan is dropped rather than repaired, and one bad house does not
 * take the other three with it: what a child loses is an extension, and
 * what they keep is a cottage they can build out again. A plan repaired
 * into something plausible would be a room somebody did not build.
 */
export function readPlans(world: WorldSnapshot | undefined): Record<string, readonly string[]> {
  return readByHouse(world?.plans, (key) => /^-?\d+,-?\d+$/.test(key));
}

/** The same again for how each house is furnished. `decor.ts` reads the entries. */
export function readDecor(world: WorldSnapshot | undefined): Record<string, readonly string[]> {
  return readByHouse(world?.decor, () => true);
}

function readByHouse(
  saved: Readonly<Record<string, readonly string[]>> | undefined,
  usable: (entry: string) => boolean,
): Record<string, readonly string[]> {
  const plans: Record<string, readonly string[]> = {};
  for (const [house, floor] of Object.entries(saved ?? {})) {
    if (!Array.isArray(floor)) continue;
    const cells = floor.filter((key): key is string => typeof key === "string" && usable(key));
    if (cells.length > 0) plans[house] = cells;
  }
  return plans;
}

/**
 * When a saved world was last written, or null if it never was.
 *
 * Read straight off the record rather than through the restore path, because
 * the hourglass spell wants it whether or not the save was usable: a world
 * whose seed has changed is a world the child still put down at some hour.
 * Anything that is not a plausible timestamp comes back null, and the spell
 * then has nothing to give — which is the right answer for a save that has
 * been edited by hand.
 */
export function savedAtOf(record: unknown): number | null {
  if (typeof record !== "object" || record === null) return null;
  const at = Number((record as { savedAt?: unknown }).savedAt);
  return Number.isFinite(at) && at > 0 ? at : null;
}

/**
 * Put a saved world back onto a freshly generated one.
 *
 * Every field is checked on the way in, because a save is data from outside
 * the program however it got there — an older version, a hand-edited file, a
 * half-written one from a tab that died mid-save. Anything that does not
 * make sense is dropped rather than restored: a missing fence is a thing a
 * child can buy again, and a crash on load is a farm they can never reach.
 */
export function restoreWorld(grid: WorldGrid, world: WorldSnapshot | undefined): void {
  if (!world) return;
  for (const [col, row] of world.cleared ?? []) {
    if (grid.inBounds(col, row)) grid.removeObjectAt(col, row);
  }
  for (const object of world.placed ?? []) {
    if (isPlacedObject(object) && grid.inBounds(object.col, object.row)) {
      grid.placeObject(object);
    }
  }
  for (const entry of world.crops ?? []) {
    const [col, row, plant, stage] = entry;
    if (!grid.inBounds(col, row)) continue;
    if (!PLANT_TYPES.includes(plant) || !PLANT_STAGES.includes(stage)) continue;
    grid.restoreCrop(col, row, { plant, stage });
  }
}

/**
 * Put a child's own things back.
 *
 * `keepPlace` is false when the world was rebuilt: their coins and their
 * basket are still theirs — those were never in the world file — but the
 * tile they were standing on described a world that no longer exists, and
 * a saved position on a moved coastline is how somebody wakes up in the sea.
 */
export function restorePlayer(
  session: GameSession,
  player: PlayerSnapshot | undefined | null,
  keepPlace = true,
): void {
  if (!player) return;
  if (keepPlace && session.grid.inBounds(player.col, player.row)) {
    session.setPosition(player.col, player.row);
  }
  if (keepPlace) session.face(isFacing(player.facing) ? player.facing : DEFAULT_FACING);
  if (Number.isInteger(player.coins) && player.coins > 0) session.purse.earn(player.coins);
  for (const entry of player.items ?? []) {
    const [item, count] = entry;
    if (ITEM_TYPES.includes(item) && Number.isInteger(count) && count > 0) {
      session.inventory.add(item, count);
    }
  }
}

function isFacing(value: unknown): value is Facing {
  return Object.values(Facing).includes(value as Facing);
}

function isPlacedObject(value: unknown): value is PlacedObject {
  if (typeof value !== "object" || value === null) return false;
  const object = value as Record<string, unknown>;
  return (
    typeof object.id === "string" &&
    typeof object.type === "string" &&
    Number.isInteger(object.col) &&
    Number.isInteger(object.row) &&
    Number.isInteger(object.width) &&
    Number.isInteger(object.height) &&
    Number.isInteger(object.anchorCol) &&
    Number.isInteger(object.anchorRow) &&
    typeof object.blocksMovement === "boolean"
  );
}
