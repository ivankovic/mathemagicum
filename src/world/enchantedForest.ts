// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import type { AreaPlacement } from "./anchors";
import { FixtureType } from "./fixtures";
import type { WorldGrid } from "./grid";
import { LandmarkType } from "./landmarks";
import type { PlacedObject } from "./objects";
import { PlantStage, PlantType } from "./plants";
import { type Rng, randInt } from "./rng";
import { sceneryOn, sceneryType } from "./scenery";
import { type Patch, patchCells } from "./selection";
import { TerrainType } from "./terrain";
import type { GridPoint } from "./topdown";

/**
 * The grove at the heart of the enchanted forest.
 *
 * The second anchor to get anything in it, and the first that is not a
 * settlement. Where the village is laid out — a square, a ring of buildings,
 * gardens with fences — this is *grown*: one great tree at the middle,
 * mushrooms that give off their own light, and a wood thick enough that the
 * grove has to be cleared out of it.
 *
 * The reserved box arrives flat, all one level and empty of scenery: the
 * generator's scatter skips reserved areas, and the anchor is what seeds the
 * woodland blob around it. So everything here is placed rather than avoided,
 * and nothing has to be undone first.
 */

/** How far from the tree the grove is kept clear, in tiles. */
/**
 * How far the grass reaches from the tree.
 *
 * The clearing is *made* grass rather than left as whatever the box landed
 * on, and everything outside it in the box is made woodland — so the grove
 * is always the same picture: a ring of wood round a patch of grass, with
 * the tree in the middle of it. It used to inherit the terrain under it,
 * which on a hilly band put the great tree in a field of scrub.
 */
const CLEARING_RADIUS = 9;
/** The ring of mushrooms about the tree, and how many stand in it. */
const RING_RADIUS = 4;
const RING_LIGHTS = 8;
/** Mushrooms scattered through the wood beyond the ring. */
const SCATTERED_LIGHTS = 14;

/** The bed the tree asks to have filled: four squares by three. */
/**
 * The beds, and the trellis round them.
 *
 * Four squares of two by two, laid out two by two with vine between and
 * around them — which is one seven-by-seven block. Two by two is the array
 * spell's own smallest shape, and four of them is the shape of the spell
 * itself: the child fills sixteen squares by hand and is given the rune that
 * would have filled a whole patch in one cast.
 *
 * The bed used to be one four-by-three of bare earth. Earth in a clearing
 * read as a hole in it rather than as somebody's plot, which is what the
 * vine is for: a border says *plot* without taking the grass away.
 */
/** What the tree asks for, and nothing else. See `groveProgress`. */
export const GROVE_CROP = PlantType.Sunflower;

const BED_SIDE = 2;
const BEDS_ACROSS = 2;
/** Vine, bed, vine, bed, vine. */
const TRELLIS = BEDS_ACROSS * BED_SIDE + BEDS_ACROSS + 1;
/** How much wood has closed over it, in cells. */
const THICKET = 6;

/**
 * How deep the dusk is at a point, from one inside the wood to nothing well
 * outside it.
 *
 * Not a rectangle switched on and off. The anchor box has a hard edge and
 * the wood around it does not — the scatter blurs outward for tiles past the
 * boundary — so a tint keyed to the box would put a visible straight line
 * across the ground exactly where the trees say there is none.
 *
 * So it ramps: full inside the box, falling to nothing `DUSK_FADE_TILES`
 * outside it, measured as the distance to the box rather than to its centre
 * (a centre distance would make the corners darker than the edges of a
 * square wood). The scene eases this over time as well, which is what
 * covers the one case a spatial ramp cannot: arriving by portal.
 */
export const DUSK_FADE_TILES = 10;

export function duskOver(box: AreaPlacement, at: GridPoint): number {
  const outX = Math.max(box.col - at.col, at.col - (box.col + box.width - 1), 0);
  const outY = Math.max(box.row - at.row, at.row - (box.row + box.height - 1), 0);
  const out = Math.hypot(outX, outY);
  if (out <= 0) return 1;
  if (out >= DUSK_FADE_TILES) return 0;
  return 1 - out / DUSK_FADE_TILES;
}

export interface Grove {
  /** Where the great tree stands, as the top-left of its footprint. */
  readonly tree: GridPoint;
  /** The tile a visitor is meant to stand on to speak to it. */
  readonly doorstep: GridPoint;
  /**
   * The beds the tree asks to have filled: four squares of two by two.
   *
   * Two by two is the array spell's own smallest shape and four of them is
   * the shape of the spell itself — the child fills sixteen squares by hand
   * and is given the rune that would have filled a whole patch in one cast.
   *
   * Bordered with vine rather than carved to bare earth. Earth in a clearing
   * read as a hole in the grass; a trellis says *plot* without taking the
   * grass away.
   */
  readonly beds: readonly Patch[];
  /** The cells of the trellis, so a test can find it and the save can keep it. */
  readonly trellis: readonly GridPoint[];
  /**
   * The wood that has closed over the bed, which has to come away first.
   *
   * Scattered over the bed and the ground beside it rather than ringed round
   * anything: a closed ring inside the clearing would be a wall, and the one
   * pass that could open a wall is the connectivity carve, which these are
   * deliberately hidden from.
   */
  readonly thicket: readonly GridPoint[];
  readonly placed: readonly PlacedObject[];
}

function put(
  grid: WorldGrid,
  type: string,
  col: number,
  row: number,
  size: number,
  blocks: boolean,
): PlacedObject | null {
  for (let r = row; r < row + size; r++) {
    for (let c = col; c < col + size; c++) {
      if (!grid.inBounds(c, r) || grid.getObjectAt(c, r)) return null;
    }
  }
  const object: PlacedObject = {
    id: `grove-${type}-${col}-${row}`,
    type,
    col,
    row,
    width: size,
    height: size,
    blocksMovement: blocks,
    anchorCol: col,
    anchorRow: row,
  };
  grid.placeObject(object);
  return object;
}

/**
 * Grow the grove inside its box.
 *
 * The order is the picture. The tree first, because everything else is
 * placed relative to it; then the ring of lights around it, which is what
 * makes the clearing read as *kept* rather than as a gap in the trees; then
 * the wood, which fills everything the clearing does not; then lights
 * scattered through that wood, so walking in from the edge is a walk from
 * one light to the next rather than a walk through the dark.
 */
export function growGrove(grid: WorldGrid, box: AreaPlacement, rng: Rng): Grove {
  const placed: PlacedObject[] = [];
  const middle = {
    col: box.col + Math.floor(box.width / 2),
    row: box.row + Math.floor(box.height / 2),
  };
  // The footprint is three by three and the anchor is its top-left, so the
  // tree stands one cell up and left of the middle of the box.
  const tree = { col: middle.col - 1, row: middle.row - 1 };
  const great = put(grid, LandmarkType.GreatTree, tree.col, tree.row, 3, true);
  if (great) placed.push(great);

  const distance = (col: number, row: number) =>
    Math.max(Math.abs(col - middle.col), Math.abs(row - middle.row));

  // The ground, before anything is grown on it: grass inside the clearing
  // and wood outside it, whatever the box landed on. The grove is one
  // picture — a ring of wood round a patch of grass — and inheriting the
  // band it was placed in put the great tree in a field of scrub as often as
  // not.
  for (let row = box.row; row < box.row + box.height; row++) {
    for (let col = box.col; col < box.col + box.width; col++) {
      if (!grid.inBounds(col, row)) continue;
      grid.setTerrain(
        col,
        row,
        distance(col, row) <= CLEARING_RADIUS ? TerrainType.Grass : TerrainType.Woodland,
      );
    }
  }

  // The ring: eight lights at the compass points of a square about the tree,
  // which at this radius reads as a circle and never as a grid.
  for (let n = 0; n < RING_LIGHTS; n++) {
    const angle = (n / RING_LIGHTS) * Math.PI * 2;
    const col = middle.col + Math.round(Math.cos(angle) * RING_RADIUS);
    const row = middle.row + Math.round(Math.sin(angle) * RING_RADIUS);
    const light = put(grid, FixtureType.Glowcap, col, row, 1, false);
    if (light) placed.push(light);
  }

  // The wood. Thick, and thickest at the edges of the box — walking in
  // should feel like the trees opening out rather than like arriving at a
  // lawn with a tree on it.
  for (let row = box.row; row < box.row + box.height; row++) {
    for (let col = box.col; col < box.col + box.width; col++) {
      const out = distance(col, row);
      if (out <= CLEARING_RADIUS) continue;
      const kind = sceneryOn(grid.getTerrain(col, row));
      if (!kind) continue;
      // Denser the further out, from about a third at the clearing's edge to
      // most of the ground at the box's own.
      const chance = Math.min(0.75, 0.28 + (out - CLEARING_RADIUS) * 0.07);
      if (randInt(rng, 1, 100) > chance * 100) continue;
      const tree = put(grid, sceneryType(kind), col, row, 1, true);
      if (tree) placed.push(tree);
    }
  }

  // And lights among the trees, so the way in is lit.
  for (let n = 0; n < SCATTERED_LIGHTS; n++) {
    const col = randInt(rng, box.col, box.col + box.width - 1);
    const row = randInt(rng, box.row, box.row + box.height - 1);
    if (distance(col, row) <= CLEARING_RADIUS) continue;
    const light = put(grid, FixtureType.Glowcap, col, row, 1, false);
    if (light) placed.push(light);
  }

  // Where a visitor stands to speak to it: the cell below the middle of the
  // trunk, which is the one the player walks up to facing north. Cleared of
  // anything that might have grown there.
  // Taken off the list as well as off the grid: `placed` is what is standing
  // in the grove, and an entry for something that was pulled up is a lie the
  // renderer would then act on.
  const pull = (col: number, row: number) => {
    const gone = grid.removeObjectAt(col, row);
    if (!gone) return;
    const at = placed.indexOf(gone);
    if (at >= 0) placed.splice(at, 1);
  };

  const doorstep = { col: middle.col, row: tree.row + 3 };
  pull(doorstep.col, doorstep.row);

  // --- what the tree asks for ---------------------------------------------

  // The trellis, west of the doorstep so the way in stays open: one
  // seven-by-seven block of vine holding four two-by-two beds.
  //
  // Placed *after* everything else in the clearing so `pull` can take the
  // trees and lights that grew where it goes — and the ring of lights round
  // the tree keeps whichever of its eight fall outside it, which is what
  // stops the trellis reading as a thing dropped on top of a light.
  const block = { col: middle.col - TRELLIS - 1, row: tree.row + 3 };
  const beds: Patch[] = [];
  for (let down = 0; down < BEDS_ACROSS; down++) {
    for (let across = 0; across < BEDS_ACROSS; across++) {
      beds.push({
        col: block.col + 1 + across * (BED_SIDE + 1),
        row: block.row + 1 + down * (BED_SIDE + 1),
        width: BED_SIDE,
        height: BED_SIDE,
      });
    }
  }
  const inABed = new Set(beds.flatMap((bed) => patchCells(bed).map((at) => `${at.col},${at.row}`)));
  const trellis: GridPoint[] = [];
  for (const at of patchCells({ ...block, width: TRELLIS, height: TRELLIS })) {
    if (!grid.inBounds(at.col, at.row)) continue;
    pull(at.col, at.row);
    if (inABed.has(`${at.col},${at.row}`)) continue;
    // Walked over, not walked round. A border you cannot cross is a wall,
    // and the beds inside it have to be reachable.
    const vine = put(grid, FixtureType.ForestVine, at.col, at.row, 1, false);
    if (!vine) continue;
    trellis.push(at);
    placed.push(vine);
  }

  // And the wood that has closed over it. Placed *after* the bed is cleared,
  // so the thicket really is standing on the ground that has to be freed —
  // and marked unbreakable, so the route the world carves to the doorstep
  // cannot do the player's first task for them.
  const thicket: GridPoint[] = [];
  const overgrown = beds
    .flatMap((bed) => patchCells(bed))
    .filter((at) => grid.inBounds(at.col, at.row) && !grid.getObjectAt(at.col, at.row));
  for (let n = 0; n < THICKET && overgrown.length > 0; n++) {
    const [at] = overgrown.splice(randInt(rng, 0, overgrown.length - 1), 1);
    if (!at) break;
    const kind = sceneryOn(grid.getTerrain(at.col, at.row)) ?? sceneryOn(TerrainType.Woodland);
    if (!kind) continue;
    const scrub = put(grid, sceneryType(kind), at.col, at.row, 1, true);
    if (!scrub) continue;
    scrub.unbreakable = true;
    thicket.push(at);
    placed.push(scrub);
  }

  return { tree, doorstep, beds, trellis, thicket, placed };
}

/**
 * What the great tree has asked for, and how far along it is.
 *
 * **The quest keeps no state of its own.** Every answer here is read off the
 * world: the thicket is gone when those cells hold nothing, and the bed is
 * full when every square of it holds a ripe crop. Both are already written
 * down by the save — cleared scenery and planted crops are exactly what a
 * world snapshot records — so the task survives a reload without a single
 * new field, and it cannot drift out of step with the ground it is about.
 *
 * That is also why it is here rather than in the spellbook. It is a fact
 * about a patch of forest, not about a child.
 */
export const GroveTask = {
  /** The wood has closed over the bed. */
  Overgrown: "overgrown",
  /** The ground is clear; now fill it. */
  Bare: "bare",
  /** Something is growing in it, but not everything is ripe. */
  Growing: "growing",
  /** Twelve ripe squares. The tree has its grove. */
  Done: "done",
} as const;

export type GroveTask = (typeof GroveTask)[keyof typeof GroveTask];

export interface GroveProgress {
  readonly task: GroveTask;
  /** Cells of the thicket still standing. */
  readonly standing: number;
  /** Squares of the bed holding a ripe crop, and how many there are in all. */
  readonly ripe: number;
  readonly squares: number;
}

export function groveProgress(grid: WorldGrid, grove: Grove): GroveProgress {
  const standing = grove.thicket.filter((at) => grid.getObjectAt(at.col, at.row) !== null).length;
  const cells = grove.beds.flatMap((bed) => patchCells(bed));
  // Sunflowers, and only sunflowers. The tree asks for a particular thing
  // rather than for anything ripe, which is what makes the errand an errand:
  // sixteen squares of whatever was to hand is a bed filled by accident.
  const ripe = cells.filter((at) => {
    const crop = grid.getCrop(at.col, at.row);
    return crop?.stage === PlantStage.Mature && crop.plant === GROVE_CROP;
  }).length;
  const squares = cells.length;
  const task =
    standing > 0
      ? GroveTask.Overgrown
      : ripe >= squares
        ? GroveTask.Done
        : ripe > 0 || cells.some((at) => grid.getCrop(at.col, at.row) !== null)
          ? GroveTask.Growing
          : GroveTask.Bare;
  return { task, standing, ripe, squares };
}
