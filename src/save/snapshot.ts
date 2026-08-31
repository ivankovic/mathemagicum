// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { DEFAULT_FACING, Facing } from "../world/characters";
import type { WorldGrid } from "../world/grid";
import { ITEM_TYPES, type ItemType } from "../world/inventory";
import type { PlacedObject } from "../world/objects";
import { PLANT_STAGES, PLANT_TYPES, type PlantStage, type PlantType } from "../world/plants";
import type { GameSession } from "../world/session";
import { type PaintedTiles, readPainted } from "../world/terrainCopy";
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
 * one somebody eventually routes around. What keeps it honest instead is
 * `generatorPin.test.ts`, which fails the moment a seed grows something
 * different and can only be quieted by writing the new fingerprints down —
 * next to which this line is impossible to miss.
 *
 * **2** — the enchanted forest became round. Its clearing was a square of
 * lawn measured in Chebyshev steps and is a wandering circle now, its box
 * grew from twenty-four tiles to thirty-six to hold one, and its wood thins
 * into the country instead of stopping at the box's edge. The grove is drawn
 * before the harbour, the city and the observatory and draws from the same
 * rng, so all four moved: every seed grows a different world, which is
 * exactly what this number is for.
 */
export const GENERATOR_VERSION = 2;

/**
 * Bumped when the shape below changes, which is a different thing.
 *
 * It has two jobs and both are load-bearing. Going forwards it names the last
 * step of the migration chain, so a save written by an older build is walked
 * up to today before anything reads it — see `migrate`. Going *backwards* it
 * is the guard: a save stamped higher than this was written by a build that
 * knew more than this one does, and `writeGame` refuses to write over it.
 *
 * That second one is not hypothetical. A tab left open across a deploy is
 * running yesterday's code against today's save, and without the guard the
 * first autosave quietly drops every field yesterday did not know about.
 */
export const SNAPSHOT_VERSION = 2;

/**
 * The first version whose rooms are believed about the fire.
 *
 * A room saved before the stove was furniture has no stove written in it,
 * because back then the fireplace was part of the wall and not something a
 * save had any business mentioning. Such a room has to have one put back or
 * it is dark for ever with nothing on screen to say why.
 *
 * A room saved *after* has one written in it if there is one — and, just as
 * importantly, has none written in it when the child is carrying it. Without
 * a number to tell the two apart, "no stove in the save" meant both things at
 * once, and the repair fired on every read: picking the oven up put one in
 * the basket and conjured another in the corner, once per tap.
 *
 * Equal to `SNAPSHOT_VERSION` today and not the same fact. This one is the
 * age at which a piece of the save became trustworthy, and it stays where it
 * is when the shape changes again for some unrelated reason.
 */
export const HEARTH_IS_FURNITURE = 2;

/**
 * One step up the chain: what a save of `from` has to have done to it to
 * become a save of `to`.
 *
 * Pure, small, and kept for ever. A migration is not deleted when it stops
 * being needed for the saves anybody has today, because "anybody" includes a
 * child who has not opened the game since the spring.
 */
export interface Migration {
  readonly from: number;
  readonly to: number;
  readonly run: (world: WorldSnapshot) => WorldSnapshot;
}

/**
 * Every step, in order, and there are none yet.
 *
 * That is not an oversight — it is what the format has cost so far. Every
 * change to date has been *additive with a default*: an absent `turn` reads
 * as facing the camera, an absent `made` as a machine that deals, an absent
 * `mark` as a tally nobody has shown a heap to. A field that means the right
 * thing by being missing needs no migration, and it is much the better trick
 * where it fits.
 *
 * What it does not fit is a field changing meaning, a field splitting in two,
 * or a key being rewritten — and this is where those go, one entry each, so
 * that the next person to need one adds a line rather than inventing a
 * scheme under time pressure.
 */
export const MIGRATIONS: readonly Migration[] = [];

export interface WorldSnapshot {
  /** Planted tiles: column, row, what, how grown. */
  readonly crops: readonly (readonly [number, number, PlantType, PlantStage])[];
  /** What the player put down that the generator did not. */
  readonly placed: readonly PlacedObject[];
  /** Generated objects the player took away, by the tile they stood on. */
  readonly cleared: readonly (readonly [number, number])[];
  /**
   * Ground the mirror spell moved: the tile, and what it is now.
   *
   * A list of what changed rather than a difference against the world as
   * generated, which is what everything else here is. Terrain is a quarter
   * of a million tiles and comparing them all to find the four she painted
   * would be a quarter of a million comparisons on every autosave — and the
   * mirror spell is the only thing in the game that paints, so it can simply
   * say what it did.
   */
  readonly painted?: PaintedTiles;
  /**
   * What every machine is holding, by the square it stands on.
   *
   * Here rather than on the placed object it belongs to, and the placement
   * is the point: `placed` is a *difference against how the world was
   * generated*, compared by a signature, and what a sorter has in its mouth
   * this minute is not a fact about generation. It is also unvalidated on
   * the way in — `isPlacedObject` waves unknown fields through — where this
   * goes through `machinesFromSave` and drops anything mangled.
   *
   * A fact about the world rather than about the child, for the reason
   * `plans` is: two siblings on one tablet share a garden, and a machine one
   * of them built and filled is standing there for the other.
   */
  readonly machines?: Readonly<Record<string, string>>;
  /**
   * Every length of wire, as the two squares it joins.
   *
   * A fact about the world rather than about the child, for the reason the
   * machines are: two siblings on one tablet share a garden, and a line one
   * of them strung is carrying for the other.
   */
  readonly wires?: readonly string[];
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
  // The turn is part of what a thing *is* here, not decoration on it: a
  // bench the generator put down facing the camera and a child turned round
  // is a difference the save has to carry, and this signature is how the
  // save decides there is one.
  const turned = object.turn ? `|turn${object.turn}` : "";
  // And whose it is. A fence a child bought and put down on a square the
  // village had already fenced is the same picture and not the same thing:
  // hers can be picked up again and the village's cannot, so a save that
  // called them equal would give her back the village's on the next load and
  // quietly take hers away.
  const owned = object.mine ? "|mine" : "";
  return `${object.type}${object.flip ? "|flip" : ""}${turned}${owned}`;
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
  painted: PaintedTiles = [],
  machines: Readonly<Record<string, string>> = {},
  wires: readonly string[] = [],
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
    ...(painted.length > 0 ? { painted } : {}),
    ...(Object.keys(machines).length > 0 ? { machines } : {}),
    ...(wires.length > 0 ? { wires } : {}),
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
  painted: PaintedTiles = [],
  machines: Readonly<Record<string, string>> = {},
  wires: readonly string[] = [],
): GameSnapshot {
  return {
    snapshotVersion: SNAPSHOT_VERSION,
    generatorVersion: GENERATOR_VERSION,
    seed,
    world: snapshotWorld(grid, baseline, plans, decor, painted, machines, wires),
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
/**
 * Walk a save up to today, one step at a time.
 *
 * Runs every migration above the version it was written at, in order, and
 * stamps the result with where it arrived. A save already at today's version
 * goes through untouched, which is nearly every save there will ever be.
 *
 * **A save from the future is left exactly as it is.** Not migrated, not
 * repaired, not partly understood: a build that meets a save newer than
 * itself has no way to know what it would be throwing away, so it changes
 * nothing and `writeGame` refuses to overwrite it. That is a stale tab left
 * open across a deploy, and it is the one way a child can lose work without
 * touching anything.
 */
export function migrate(snapshot: GameSnapshot): GameSnapshot {
  return walk(snapshot, MIGRATIONS, SNAPSHOT_VERSION);
}

/**
 * The chain itself, with the steps and the destination handed in.
 *
 * Split out from `migrate` so it can be tried with migrations that are not
 * real — the list is empty today, and an untried mechanism is one that is
 * wrong on the day it first matters.
 */
export function walk(
  snapshot: GameSnapshot,
  steps: readonly Migration[],
  upTo: number,
): GameSnapshot {
  const at = Number.isInteger(snapshot.snapshotVersion) ? snapshot.snapshotVersion : 0;
  if (at >= upTo) return snapshot;
  let world = snapshot.world;
  for (const step of [...steps].sort((a, b) => a.from - b.from)) {
    if (step.from < at || step.to > upTo) continue;
    world = step.run(world);
  }
  return { ...snapshot, snapshotVersion: upTo, world };
}

/** Whether this save was written by a build that knew more than this one. */
export function fromTheFuture(snapshot: GameSnapshot | null | undefined): boolean {
  return (
    snapshot !== null &&
    snapshot !== undefined &&
    Number.isInteger(snapshot.snapshotVersion) &&
    snapshot.snapshotVersion > SNAPSHOT_VERSION
  );
}

/** What came back, and what could not. */
export interface Restored {
  /**
   * Things she put down that no longer have anywhere to stand.
   *
   * Handed to the caller rather than dropped, because the caller is the only
   * one that knows what to do with them — a fence goes back in the basket, a
   * machine goes back with everything that was inside it. Losing a layout is
   * survivable; losing the things is not.
   */
  readonly refused: readonly PlacedObject[];
}

export function restoreWorld(
  grid: WorldGrid,
  world: WorldSnapshot | undefined,
  groundMoved = false,
): Restored {
  const refused: PlacedObject[] = [];
  if (!world) return { refused };
  for (const [col, row] of world.cleared ?? []) {
    if (grid.inBounds(col, row)) grid.removeObjectAt(col, row);
  }
  for (const object of world.placed ?? []) {
    if (!isPlacedObject(object) || !grid.inBounds(object.col, object.row)) continue;
    // **Refused rather than forced.** A save is a handful of differences
    // against a world the generator builds, and the generator is still being
    // worked on: change a habitat rule and the same seed grows a different
    // coastline, at which point a fence saved on grass is a fence in the sea.
    //
    // What used to happen was worse than either. The whole snapshot was
    // thrown away on a version mismatch — every room, every machine, every
    // line — for a hazard that only ever applied to the outdoor half. So the
    // ground is checked a square at a time instead, and what will not stand
    // is handed back rather than dropped on water or lost with the rest.
    //
    // **Only when the ground has actually moved.** An ordinary reload puts a
    // save back against a world grown from the same seed by the same code,
    // where every square is exactly the one it was saved against — so there
    // is nothing to check and checking anyway would mean a common path
    // carrying the risk of a rare one.
    if (groundMoved && !fits(grid, object)) {
      refused.push(object);
      continue;
    }
    grid.placeObject(object);
  }
  // Before the crops and after the objects, which is the order they were
  // laid down in: ground first, then what stands on it.
  for (const [col, row, terrain] of readPainted(world.painted)) {
    if (grid.inBounds(col, row)) grid.setTerrain(col, row, terrain);
  }
  for (const entry of world.crops ?? []) {
    const [col, row, plant, stage] = entry;
    if (!grid.inBounds(col, row)) continue;
    if (!PLANT_TYPES.includes(plant) || !PLANT_STAGES.includes(stage)) continue;
    // A crop on ground that has become sea or rock is simply not there any
    // more. Nothing is handed back for it, and that is not meanness: nothing
    // was spent on it either — planting costs no seed, and what a child paid
    // for a crop was the cast that grew it, which is already behind them.
    if (groundMoved && !grid.isPassable(col, row)) continue;
    grid.restoreCrop(col, row, { plant, stage });
  }
  return { refused };
}

/**
 * Whether a saved thing can still stand where it was left.
 *
 * The same question `session.place` asks when a child puts one down, and
 * deliberately the same one: a square the game would refuse today is a square
 * a save has no more right to than a tap does.
 */
function fits(grid: WorldGrid, object: PlacedObject): boolean {
  return grid.isPassable(object.col, object.row) && grid.getCrop(object.col, object.row) === null;
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
