// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { type AnchorPlacements, type AreaPlacement, placeAnchors } from "./anchors";
import { type CityLayout, layoutCity } from "./city";
import { ensureConnectivity, floodFillReachable } from "./connectivity";
import { type HighCorner, WORLD_HIGH_CORNER, elevationAt } from "./elevation";
import { type Grove, growGrove } from "./enchantedForest";
import { type WildSpot, wildFlowerObject, wildSpots } from "./flowers";
import { WorldGrid } from "./grid";
import { type HarbourLayout, layoutHarbour } from "./harbour";
import { type Observatory, layoutObservatory } from "./observatory";
import { createRng, randInt } from "./rng";
import { scatterScenery } from "./scatter";
import { assignLevels, cutRamps, nearTheRim, sealRampEdges } from "./terraces";
import { TerrainType } from "./terrain";
import { fillFromElevation, flattenReservedAreas, sealFarEdges } from "./terrainFill";
import type { GridPoint } from "./topdown";
import { type VillageLayout, layoutVillage } from "./villageLayout";

export interface GeneratedWorld {
  grid: WorldGrid;
  anchors: AnchorPlacements;
  playerStart: GridPoint;
  village: VillageLayout;
  /** The enchanted forest's clearing, and the great tree standing in it. */
  grove: Grove;
  /**
   * The harbour's working front, or null if this box has no shore.
   *
   * Nullable because the layout refuses rather than inventing one: the
   * anchor is placed straddling the waterline, but placement keeps a near
   * miss when no candidate lands squarely in the window, and a near miss on
   * a cliff coast can come back dry. A harbour that quietly built a quay
   * along an imaginary shore would be worse than one that says it could not.
   */
  harbour: HarbourLayout | null;
  /** The big city: its streets, its blocks and the square at the middle. */
  city: CityLayout;
  /**
   * The dome on the mountain, or null if the shelf the flatten pass left is
   * too small to stand one on. Nullable for the reason the harbour is: a
   * layout that invented a plateau would be worse than one that says it
   * could not find one.
   */
  observatory: Observatory | null;
  /**
   * The three flowers growing wild, one of each kind.
   *
   * Handed back rather than left for a caller to hunt for on the grid: what
   * a scenario and a map both want is *where they are*, and finding that by
   * scanning a quarter of a million cells for an object whose name starts
   * with "wild-" is the sort of thing that works until somebody renames it.
   */
  wildFlowers: readonly WildSpot[];
  // Which corner the world slopes down from. Everything else about the
  // layout follows from it, so it is worth handing back rather than making
  // callers infer it from the terrain.
  highCorner: HighCorner;
}

function centerOf(area: AreaPlacement): GridPoint {
  return {
    col: area.col + Math.floor(area.width / 2),
    row: area.row + Math.floor(area.height / 2),
  };
}

// Runs the full pipeline from docs/WORLD_GENERATION.md, steps 0-7 for the
// Village specifically (its interior is built — see villageLayout.ts) and
// steps 0-6 for the other 4 anchors (their interiors — step 7 — and
// stitching — step 8 — aren't built yet; they depend on story-object
// content that doesn't exist). One seed deterministically produces one
// world.
export function generateWorld(width: number, height: number, seed: number): GeneratedWorld {
  const rng = createRng(seed);
  const grid = WorldGrid.empty(width, height, TerrainType.Grass);

  // The whole map hangs off this one choice: which corner is the top of the
  // slope. Drawn first so every later decision can be made against it.
  // Fixed, not drawn. Every world is high in the same corner so that "water
  // is downhill, rock is uphill" is a thing a child can carry from one world
  // into the next — see WORLD_HIGH_CORNER.
  const highCorner = WORLD_HIGH_CORNER;
  const fieldSeed = randInt(rng, 0, 0x7ffffffe);
  const elevation = (col: number, row: number) =>
    elevationAt(col, row, width, height, highCorner, fieldSeed);

  // Anchors are placed against elevation rather than against painted
  // terrain, so this needs nothing on the grid yet — which is what lets the
  // village carve its paths before the fill runs and skips over them.
  const anchors = placeAnchors(width, height, elevation, rng);
  const reservedBoxes = [
    anchors.village,
    anchors.harbour,
    anchors.bigCity,
    anchors.observatory,
    anchors.enchantedForest,
  ];

  fillFromElevation(grid, highCorner, fieldSeed);
  // Between the fill and the seal. After the fill so a story area is cut
  // from the ground it actually sits in; before the seal so the world's
  // water edge still wins where a story area reaches it — the Harbour is
  // supposed to touch the sea, and the far edges are the world's boundary.
  flattenReservedAreas(grid, reservedBoxes, highCorner, fieldSeed);
  sealFarEdges(grid, highCorner);

  // After the fill rather than before it: the village carves paths and
  // gardens, which are not natural ground and must not be painted over. Also
  // before ensureConnectivity, since the Village's centre tile ends up the
  // well (impassable), not a safe start point.
  const village = layoutVillage(grid, anchors.village, seed);
  // The second anchor with anything in it. After the village so the two
  // cannot argue about a tile, and before the scatter — which skips reserved
  // boxes, so the grove is the only thing that ever grows in there.
  const grove = growGrove(grid, anchors.enchantedForest, rng);
  // The third and fourth places with anything in them, and each with its own
  // layout grammar: the village is round, the harbour is linear along its
  // shore, the city is a grid of streets. Same kit of buildings in all
  // three — what makes them different places is how they are arranged.
  const harbour = layoutHarbour(grid, anchors.harbour, rng);
  const city = layoutCity(grid, anchors.bigCity, rng);
  const observatory = layoutObservatory(grid, anchors.observatory, rng);
  // Before the connectivity check, so it sees the walled rim and reports
  // honestly. Carving cannot clear an object, so the barrier is confined to
  // the rim where it has nothing to cut off.
  // The world's levels, and the ways up between them. Before the
  // connectivity check so it sees the steps and reports honestly — and the
  // ramps have to be cut here rather than left to it, because it carves
  // *terrain* and a step is not terrain.
  assignLevels(grid, reservedBoxes);
  cutRamps(grid, reservedBoxes, fieldSeed);

  // The trees and boulders. After the levels, because nothing may straddle a
  // step, and before the connectivity check so it sees them and clears any
  // that happen to close a route.
  scatterScenery(grid, reservedBoxes, fieldSeed);

  // From the doorstep rather than from where the player stands: the spawn is
  // inside a fenced garden, and this carves its routes by removing whatever
  // is in the way — starting it in there had it cut straight out through the
  // fence. The garden hangs off the doorstep through its gate, so anything
  // reachable from one is reachable from the other.
  ensureConnectivity(
    grid,
    village.playerDoorstep,
    [
      // Doorsteps, not middles. This pass carves by *removing whatever is in
      // the way*, so a target with something on it is a target the pass
      // deletes — which is how the great tree vanished from every world for a
      // while, silently, because a route to an empty clearing is still a
      // route. The harbour's is land rather than a plank for the same reason
      // one step further on: a carve that had to reach a pier would bulldoze
      // the quay's approach, and the pier is the one structure whose whole job
      // is to be the only way over water.
      harbour?.doorstep ?? centerOf(anchors.harbour),
      city.doorstep,
      centerOf(anchors.observatory),
      // The grove's doorstep, not its middle: the middle is where the great
      // tree stands, and this pass carves by *removing whatever is in the way*.
      // Aimed at the centre it walked in and took the tree out, which is the
      // same thing that happened to the player's garden gate when the spawn
      // moved inside the fence — and just as silent, because a route to a
      // clearing with nothing in it is still a route.
      grove.doorstep,
    ],
    // Never along the world's own edge. That ring stands a step above
    // everything inside it so that it cannot be walked onto — it is what
    // stops a child reaching the edge of the map — and this is the one pass
    // allowed to mark ramps, so a route that ran along it left a flight of
    // steps up onto the boundary. The ring *inside* it counts too: a step is
    // crossable if either of its two cells is a ramp, so a ramp marked just
    // inside the rim opens the rim without a ramp ever being put on it.
    (col, row) => nearTheRim(width, height, col, row),
  );

  // Last, so it sees every way up there is. The lanes above are only some of
  // them: connectivity marks ramps of its own where a carved route has to
  // climb, a cell or two at a time, and that is exactly the shape that
  // leaves an edge the art cannot taper. Running it before this as well was
  // tried and dropped — it produced worlds identical to the byte, because
  // the seal settles on the same answer whenever it is asked.
  //
  // Safe here because it only ever *adds* ways up: nothing it does can close
  // a route the pass above just opened.
  sealRampEdges(grid, reservedBoxes);

  // Last of all, and after the connectivity pass on purpose.
  //
  // A flower is a quest that can be finished or a quest that cannot, and the
  // difference is one seed in a hundred — which is the worst shape a failure
  // has, because it works every time anybody looks. Placed before the carve,
  // one could land behind water the pass never opened; placed on any old
  // passable cell, one could land inside the city walls. So they go on cells
  // the flood fill has just proved are walkable from the player's own front
  // door, which is the same thing the game means by "reachable".
  const wildFlowers = sowWildFlowers(grid, rng, village.playerDoorstep, reservedBoxes);

  return {
    grid,
    anchors,
    playerStart: village.playerSpawn,
    village,
    grove,
    harbour,
    city,
    observatory,
    wildFlowers,
    highCorner,
  };
}

/**
 * Put the three wild flowers somewhere a child can walk to.
 *
 * **Out in the world, not in the settlements.** A flower found in the
 * village square is a flower found on the way to the shop, and the whole of
 * what these reward is having gone somewhere. The reserved boxes are the
 * five story areas, and skipping them puts the flowers in the country
 * between.
 *
 * **They do not block.** Everything else standing on a cell out here is
 * something to walk around; a flower is something to walk *into*, and one
 * that stopped a child dead in a meadow would read as a rock drawn wrong.
 * It also means one can never close a route the connectivity pass just
 * opened, which is what makes it safe to run this after that pass.
 */
function sowWildFlowers(
  grid: WorldGrid,
  rng: ReturnType<typeof createRng>,
  from: GridPoint,
  reserved: readonly AreaPlacement[],
): readonly WildSpot[] {
  const reachable = floodFillReachable(grid, from);
  const inside = (col: number, row: number) =>
    reserved.some(
      (box) =>
        col >= box.col && col < box.col + box.width && row >= box.row && row < box.row + box.height,
    );
  const open: GridPoint[] = [];
  for (let row = 0; row < grid.height; row++) {
    for (let col = 0; col < grid.width; col++) {
      if (reachable[row * grid.width + col] !== 1) continue;
      if (grid.getObjectAt(col, row)) continue;
      if (grid.getPlant(col, row)) continue;
      if (inside(col, row)) continue;
      open.push({ col, row });
    }
  }
  const spots = wildSpots(rng, open);
  for (const spot of spots) {
    grid.placeObject({
      id: `wild-flower-${spot.flower}`,
      type: wildFlowerObject(spot.flower),
      col: spot.col,
      row: spot.row,
      width: 1,
      height: 1,
      blocksMovement: false,
      anchorCol: spot.col,
      anchorRow: spot.row,
    });
  }
  return spots;
}
