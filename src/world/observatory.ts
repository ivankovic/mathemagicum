// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import type { AreaPlacement } from "./anchors";
import { type BuildingRole, footprintFor } from "./buildings";
import { FixtureType } from "./fixtures";
import type { WorldGrid } from "./grid";
import type { PlacedObject } from "./objects";
import type { Rng } from "./rng";
import { TerrainType } from "./terrain";
import type { GridPoint } from "./topdown";

/**
 * The observatory: a dome on a plateau, and the path up to it.
 *
 * The fourth layout grammar, and the simplest, because the mountain has
 * already done most of the work. The generator puts this box in the highest
 * band there is and then flattens it, which leaves exactly the shape an
 * observatory wants: a shelf of hill in the middle with rock all round it,
 * at the top of a climb the world's own connectivity has already cut.
 *
 * So this places one building and one path. The village is round, the
 * harbour is linear, the city is a grid — this is a **single approach**, and
 * everything about it is arranged along that one line. Arriving is meant to
 * feel like the end of a walk rather than like entering a place.
 *
 * **The path is inside the box.** The route *to* the mountain is the world's
 * to carve and it does, in ramps, before anything here is built; what this
 * owns is the last stretch, from the rim of the plateau to the door — which
 * is the stretch the astronomer asks to have lit.
 */

/** How wide the path up is. */
const PATH_WIDE = 3;
/**
 * The most the lamps are ever spread, in cells.
 *
 * A *ceiling*, not a spacing: how long the path is depends on how big a
 * shelf the mountain left, and five lamps three apart want thirteen cells of
 * it. Where there are fewer, they close up — which is what a lit path does
 * on a short climb, and better than a layout that quietly ships four lamps
 * and an astronomer who asks for five.
 */
const LAMP_EVERY = 3;
/** How many lamp posts the climb carries. What the astronomer asks for. */
export const LAMP_POSTS = 5;
/** Ground cleared around the dome, so it stands in a yard rather than rock. */
const YARD = 2;

export interface Observatory {
  /** The dome, as a placed building. */
  readonly dome: PlacedObject;
  /** The cell a visitor stands on to go in — the world's route anchor. */
  readonly doorstep: GridPoint;
  /** The path from the plateau's rim to the door, in order, foot first. */
  readonly path: readonly GridPoint[];
  /**
   * Where a lamp goes, in order up the climb.
   *
   * Marked rather than filled: lighting them is what the astronomer asks
   * for, and like the great tree's bed the state of it is read off the world
   * rather than written down anywhere.
   */
  readonly posts: readonly GridPoint[];
  readonly placed: readonly PlacedObject[];
}

/**
 * Where the plateau is: the walkable shelf the flatten pass leaves.
 *
 * Found rather than assumed. The shelf is where the box's own ground came
 * out after being shifted into a habitable band, and how big it is depends
 * on how high the mountain was to start with — so a layout that guessed at
 * it would be right in the seeds it was written against and nowhere else.
 */
function shelfOf(grid: WorldGrid, box: AreaPlacement): AreaPlacement | null {
  let left = Number.POSITIVE_INFINITY;
  let right = Number.NEGATIVE_INFINITY;
  let top = Number.POSITIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;
  for (let row = box.row; row < box.row + box.height; row++) {
    for (let col = box.col; col < box.col + box.width; col++) {
      if (!grid.inBounds(col, row)) continue;
      if (grid.getTerrain(col, row) === TerrainType.Mountain) continue;
      left = Math.min(left, col);
      right = Math.max(right, col);
      top = Math.min(top, row);
      bottom = Math.max(bottom, row);
    }
  }
  if (left > right || top > bottom) return null;
  return { id: box.id, col: left, row: top, width: right - left + 1, height: bottom - top + 1 };
}

function pave(grid: WorldGrid, col: number, row: number): void {
  if (grid.inBounds(col, row)) grid.setTerrain(col, row, TerrainType.Dirt);
}

/**
 * Build the observatory.
 *
 * The dome first, at the head of the shelf, because the path is laid to its
 * door and not the other way round — a path drawn first and a building put
 * at the end of it is how a door ends up facing a cliff.
 */
export function layoutObservatory(
  grid: WorldGrid,
  box: AreaPlacement,
  rng: Rng,
): Observatory | null {
  void rng;
  const shelf = shelfOf(grid, box);
  // Tall enough for a dome, a doorstep and a climb with five lamps on it.
  // Anything less and the place would be a building with a step in front of
  // it rather than somewhere you walk up to.
  if (!shelf || shelf.width < 6 || shelf.height < LAMP_POSTS + 5) return null;

  const role: BuildingRole = "observatory";
  const { width, height } = footprintFor(role);
  const dome = {
    col: shelf.col + Math.floor((shelf.width - width) / 2),
    row: shelf.row + 1,
  };
  if (dome.col < shelf.col || dome.row + height >= shelf.row + shelf.height) return null;

  // The yard: bare ground round the dome, so it stands on something built
  // rather than on the hillside it happens to be on.
  for (let row = dome.row - YARD; row < dome.row + height + YARD; row++) {
    for (let col = dome.col - YARD; col < dome.col + width + YARD; col++) {
      pave(grid, col, row);
    }
  }

  const building: PlacedObject = {
    id: "observatory-dome",
    type: role,
    col: dome.col,
    row: dome.row,
    width,
    height,
    blocksMovement: true,
    anchorCol: dome.col,
    anchorRow: dome.row,
  };
  grid.placeObject(building);
  const placed: PlacedObject[] = [building];

  // --- the climb ----------------------------------------------------------

  // Straight down the shelf from the door to its southern rim. Straight
  // because it is the *approach* to one building: a path that wandered would
  // be a path, and this is meant to read as a way up.
  const doorCol = dome.col + Math.floor(width / 2);
  const doorstep = { col: doorCol, row: dome.row + height };
  const path: GridPoint[] = [];
  for (let row = doorstep.row; row < shelf.row + shelf.height; row++) {
    for (let d = -Math.floor(PATH_WIDE / 2); d <= Math.floor(PATH_WIDE / 2); d++) {
      pave(grid, doorCol + d, row);
    }
    grid.removeObjectAt(doorCol, row);
    path.push({ col: doorCol, row });
  }

  // The posts: up one side of the path, evenly spaced, starting at the foot.
  // One side rather than both, because five lamps in a row up the left of a
  // path reads as a lit way and five pairs reads as an avenue — and this is
  // a mountain track, not an approach to a palace.
  const posts: GridPoint[] = [];
  // Spread as far as the path allows and no further, so the whole run is lit
  // whatever length it came out.
  const every = Math.max(1, Math.min(LAMP_EVERY, Math.floor((path.length - 1) / (LAMP_POSTS - 1))));
  for (let n = 0; n < LAMP_POSTS; n++) {
    const along = path.length - 1 - n * every;
    const at = path[along];
    if (!at) break;
    const post = { col: at.col - Math.floor(PATH_WIDE / 2) - 1, row: at.row };
    if (!grid.inBounds(post.col, post.row) || grid.getObjectAt(post.col, post.row)) continue;
    pave(grid, post.col, post.row);
    posts.push(post);
  }

  return { dome: building, doorstep, path, posts, placed };
}

/**
 * How far along the astronomer's task is, read off the world.
 *
 * The same shape as the great tree's, and deliberately: whether a lamp is
 * standing on a post is a thing the save already records, so the task needs
 * no field of its own and cannot drift out of step with the ground.
 */
export function lampsLit(grid: WorldGrid, observatory: Observatory): number {
  return observatory.posts.filter(
    (at) => grid.getObjectAt(at.col, at.row)?.type === FixtureType.Lamp,
  ).length;
}

/**
 * How many posts a lamp could actually be set on right now.
 *
 * Not the same as "how many are dark", and the difference is the astronomer's
 * whole supply rule. A post is chosen at generation time from cells that were
 * clear then, and nothing stops the player fencing one afterwards — at which
 * point the cell is no longer passable, `place` refuses it, and a handout
 * counted against the dark posts would top her up again on every single
 * visit. Counted against the *free* ones instead, nobody can come away with
 * more lamps than there are places to put them.
 */
export function postsFree(grid: WorldGrid, observatory: Observatory): number {
  return observatory.posts.filter((at) => grid.getObjectAt(at.col, at.row) === null).length;
}
