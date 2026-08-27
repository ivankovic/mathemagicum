// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import type { AreaPlacement } from "./anchors";
import { type HighCorner, bandFloor, elevationAt, groundAt, highEdges } from "./elevation";
import type { WorldGrid } from "./grid";
import { Habitat } from "./habitat";
import { TerrainType } from "./terrain";

// How deep the far edges are forced to open water. Two tiles rather than
// one: the warp can lift a tile at the very edge into the sand band, and a
// world whose "sea" is a one-tile trim of beach does not read as a sea.
const SHORE_DEPTH = 2;

/**
 * Paints every tile from its height on the slope (see elevation.ts).
 *
 * Every tile, story areas included. They used to be skipped and left at the
 * grid's default grass, which made each one a green rectangle sitting in
 * whatever it had been placed in — a lawn in the mountains, a lawn on the
 * beach. A story area should look like it belongs where it is; what makes it
 * *usable* is `flattenReservedAreas`, not a different terrain.
 */
export function fillFromElevation(grid: WorldGrid, corner: HighCorner, seed: number): void {
  for (let row = 0; row < grid.height; row++) {
    for (let col = 0; col < grid.width; col++) {
      const elevation = elevationAt(col, row, grid.width, grid.height, corner, seed);
      const ground = groundAt(col, row, elevation, seed);
      grid.setTerrain(col, row, ground.terrain);
      grid.setHabitat(col, row, ground.habitat);
    }
  }
}

/**
 * The one story area allowed to keep water in the middle of it.
 *
 * Matched by id rather than by a flag on `AreaPlacement`, because the id is
 * what the anchor already carries and a second way of saying which box this
 * is would be a second thing to keep in step.
 */
const HARBOUR_ID = "harbour";

// What impassable ground becomes when a story area still needs opening up
// after the ground beneath it has been lowered: the next band in toward the
// walkable middle.
const WALKABLE_INSTEAD: Partial<Record<TerrainType, TerrainType>> = {
  [TerrainType.Mountain]: TerrainType.Hilly,
  [TerrainType.Water]: TerrainType.Sand,
};

// Over how many tiles the clearing fades in from the area's edge, and how
// much clearance it keeps from the bands it must not land in.
const CLEARING_FEATHER = 7;
const CLEARING_MARGIN = 0.06;

// 0 at the box's edge, 1 once CLEARING_FEATHER tiles inside it. Smoothstep
// rather than linear so the clearing has no crease where the fade ends.
function clearingStrength(col: number, row: number, box: AreaPlacement): number {
  const inset = Math.min(
    col - box.col,
    box.col + box.width - 1 - col,
    row - box.row,
    box.row + box.height - 1 - row,
  );
  const t = Math.min(1, Math.max(0, inset / CLEARING_FEATHER));
  return t * t * (3 - 2 * t);
}

/**
 * Opens each story area up into a clearing, without turning it into a
 * rectangle of one colour.
 *
 * These are the five places the game will build content in, so a player has
 * to be able to stand in them — but the Observatory sits in the mountain and
 * the Harbour on the shore, so both are mostly rock and sea to begin with.
 *
 * Simply converting the impassable tiles was not enough. An Observatory
 * placed wholly in the mountain came out 100% hilly: still a flat rectangle,
 * just a different flat rectangle, with a hard line where it met the rock.
 *
 * So the whole area is *shifted* into walkable ground instead — by one
 * amount, fading in from its edge, and re-read through the same bands as
 * everywhere else. Shifting rather than squeezing is the point: pulling
 * every tile toward one habitable height lands them all on it, which is the
 * flat rectangle again. A shift moves the area bodily and leaves its own
 * rise and fall intact, so the clearing follows the terrain's noise — a bowl
 * in the hillside, a rise out of the shallows.
 *
 * And only as far as it must. An area already on walkable ground does not
 * move at all, which is what stopped an earlier version dragging the
 * Enchanted Forest out of its trees and onto grass.
 */
export function flattenReservedAreas(
  grid: WorldGrid,
  reservedBoxes: readonly AreaPlacement[],
  corner: HighCorner,
  seed: number,
): void {
  const lowest = bandFloor(TerrainType.Sand) + CLEARING_MARGIN;
  const highest = bandFloor(TerrainType.Mountain) - CLEARING_MARGIN;

  for (const box of reservedBoxes) {
    const heightAt = (col: number, row: number) =>
      elevationAt(col, row, grid.width, grid.height, corner, seed);

    // The whole area is shifted by one amount, not squeezed toward one
    // value. Squeezing is what produced the flat rectangle: pull every tile
    // toward the same habitable height and they all arrive at it. Shifting
    // moves the area bodily into walkable ground and leaves its own rise and
    // fall intact.
    let total = 0;
    let cells = 0;
    for (let row = box.row; row < box.row + box.height; row++) {
      for (let col = box.col; col < box.col + box.width; col++) {
        if (!grid.inBounds(col, row)) continue;
        total += heightAt(col, row);
        cells++;
      }
    }
    if (cells === 0) continue;
    const mean = total / cells;
    // Only as far as it has to go. An area already on walkable ground —
    // the Enchanted Forest in its trees, the Harbour on its sand — does not
    // move at all, which is what keeps it the place it was chosen to be.
    const shift = Math.min(highest, Math.max(lowest, mean)) - mean;

    for (let row = box.row; row < box.row + box.height; row++) {
      for (let col = box.col; col < box.col + box.width; col++) {
        if (!grid.inBounds(col, row)) continue;
        const strength = clearingStrength(col, row, box);
        if (strength <= 0) continue;
        const ground = groundAt(col, row, heightAt(col, row) + shift * strength, seed);
        grid.setTerrain(col, row, ground.terrain);
        grid.setHabitat(col, row, ground.habitat);
        // Well inside the clearing the player must be able to stand
        // anywhere, whatever the shifted ground came out as.
        //
        // Except the harbour's sea. This rule used to drain it: the box is
        // chosen for straddling the waterline, and then the middle of it —
        // which is the bay — was turned to sand for being unwalkable, and
        // the docks came out in a field. A harbour is the one story area
        // whose whole point is a piece of ground you cannot stand on, and
        // it gets over its water by pier rather than by the water not being
        // there. Mountains still soften: rock in the middle of a place is
        // an obstacle, not the reason for it.
        if (strength > 0.5) {
          const here = grid.getTerrain(col, row);
          const instead = WALKABLE_INSTEAD[here];
          if (instead && !(here === TerrainType.Water && box.id === HARBOUR_ID)) {
            grid.setTerrain(col, row, instead);
          }
        }
      }
    }
  }
}

/**
 * Forces the two edges furthest from the high corner to open water.
 *
 * The slope already sends them there, but "already sends them there" is not
 * the same as "is water": the warp that gives the coastline its shape can
 * lift a tile at the very edge into sand or grass. These two edges are the
 * far side of the world and the design calls for them to read as sea, so
 * they are set rather than sampled.
 *
 * The other two edges are left alone. They climb from the high corner, so
 * they are mountain and woodland along most of their length and reach the
 * water only where they meet the low corner — a ridge running down to the
 * sea, which needs no forcing.
 */
export function sealFarEdges(grid: WorldGrid, corner: HighCorner): void {
  const edges = highEdges(corner);
  for (let row = 0; row < grid.height; row++) {
    for (let col = 0; col < grid.width; col++) {
      const fromLeft = col;
      const fromRight = grid.width - 1 - col;
      const fromTop = row;
      const fromBottom = grid.height - 1 - row;
      const horizontal = edges.left ? fromRight : fromLeft;
      const vertical = edges.top ? fromBottom : fromTop;
      if (Math.min(horizontal, vertical) >= SHORE_DEPTH) continue;
      grid.setTerrain(col, row, TerrainType.Water);
      grid.setHabitat(col, row, Habitat.Coastal);
    }
  }
}
