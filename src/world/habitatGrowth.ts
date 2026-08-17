// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import type { AreaPlacement } from "./anchors";
import type { WorldGrid } from "./grid";
import { Habitat, terrainAtElevation } from "./habitat";
import { smoothNoise, uniform } from "./noise";
import { type Rng, pick, randInt } from "./rng";
import type { GridPoint } from "./topdown";

const INTERIOR_HABITATS: readonly Habitat[] = [Habitat.Meadow, Habitat.Woodland, Habitat.Wetland];
// Roughly one extra interior seed per this many tiles, per axis — a tuning
// knob (docs/WORLD_GENERATION.md open questions), not a design fork.
const SEED_SPACING = 60;

// How much the ground resists a habitat spreading through it, and over what
// distance that resistance varies. A region advances slowly through costly
// ground and races through cheap ground, which is what bends the boundary
// between two regions into a curve instead of the straight bisector equal
// rates produce. The period is deliberately shorter than the elevation
// field's: this shapes the outline of a region, not the terrain inside it.
const SPREAD_COST_RANGE = 6;
const SPREAD_COST_PERIOD = 34;

interface Frontier {
  cost: number;
  // Insertion index, used only to break ties. Two paths of exactly equal
  // cost are common on a grid, and without this the winner would depend on
  // heap internals rather than the seed.
  order: number;
  col: number;
  row: number;
  habitat: Habitat;
}

// A binary min-heap. Growth is no longer uniform-cost, so a FIFO queue no
// longer visits tiles in the order they are actually reached.
class FrontierHeap {
  private readonly items: Frontier[] = [];

  get size(): number {
    return this.items.length;
  }

  private static before(a: Frontier, b: Frontier): boolean {
    return a.cost !== b.cost ? a.cost < b.cost : a.order < b.order;
  }

  push(item: Frontier): void {
    const items = this.items;
    items.push(item);
    let i = items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      const a = items[i] as Frontier;
      const b = items[parent] as Frontier;
      if (!FrontierHeap.before(a, b)) break;
      items[i] = b;
      items[parent] = a;
      i = parent;
    }
  }

  pop(): Frontier | undefined {
    const items = this.items;
    const top = items[0];
    const last = items.pop();
    if (last !== undefined && items.length > 0) {
      items[0] = last;
      let i = 0;
      for (;;) {
        const left = i * 2 + 1;
        const right = left + 1;
        let best = i;
        if (
          left < items.length &&
          FrontierHeap.before(items[left] as Frontier, items[best] as Frontier)
        ) {
          best = left;
        }
        if (
          right < items.length &&
          FrontierHeap.before(items[right] as Frontier, items[best] as Frontier)
        ) {
          best = right;
        }
        if (best === i) break;
        const a = items[i] as Frontier;
        items[i] = items[best] as Frontier;
        items[best] = a;
        i = best;
      }
    }
    return top;
  }
}

function isInsideAnyBox(col: number, row: number, boxes: readonly AreaPlacement[]): boolean {
  return boxes.some(
    (b) => col >= b.col && col < b.col + b.width && row >= b.row && row < b.row + b.height,
  );
}

function isBorderRing(grid: WorldGrid, col: number, row: number): boolean {
  return col === 0 || col === grid.width - 1 || row === 0 || row === grid.height - 1;
}

// Grows habitat regions across the wilderness from three kinds of seed: the
// border ring (already Coastal/Highland from generateBorder), the
// Enchanted Forest anchor (seeds Woodland around it), and scattered random
// interior seeds for everything else. This is multi-source BFS rather than
// literal Conway-style cellular automata — same goal as
// docs/WORLD_GENERATION.md describes (coherent patches, not per-tile
// noise), simpler to reason about, and guaranteed to terminate in
// O(tiles). Tiles inside a reserved anchor box are left untouched — that's
// story-area interior generation, deliberately not built yet.
export function growHabitats(
  grid: WorldGrid,
  reservedBoxes: readonly AreaPlacement[],
  forestSeed: GridPoint,
  rng: Rng,
): void {
  const claimed = new Uint8Array(grid.width * grid.height);
  const index = (col: number, row: number) => row * grid.width + col;
  const heap = new FrontierHeap();
  const costSeed = randInt(rng, 0, 0x7ffffffe);
  let order = 0;

  // What it costs a region to spread onto this tile.
  const spreadCost = (col: number, row: number): number =>
    1 + SPREAD_COST_RANGE * smoothNoise(col, row, SPREAD_COST_PERIOD, costSeed);

  function seedIgnoringBoxes(col: number, row: number, habitat: Habitat): void {
    if (!grid.inBounds(col, row)) return;
    const idx = index(col, row);
    if (claimed[idx]) return;
    claimed[idx] = 1;
    grid.setHabitat(col, row, habitat);
    heap.push({ cost: 0, order: order++, col, row, habitat });
  }

  // Every seed except the border respects reserved boxes — including the
  // forest seed itself, so Enchanted Forest's own reserved interior is
  // left untouched exactly like the other four anchors' are, and the
  // caller-supplied forestSeed only takes effect if it names a point
  // outside that box (e.g. just past its edge).
  function seed(col: number, row: number, habitat: Habitat): void {
    if (isInsideAnyBox(col, row, reservedBoxes)) return;
    seedIgnoringBoxes(col, row, habitat);
  }

  // Border ring tiles are already habitat-tagged by generateBorder; reuse
  // that rather than guessing, and seed them unconditionally (even under
  // an anchor box — e.g. Harbour's footprint includes the coastline it
  // sits on, and the border stays authoritative there regardless).
  for (let col = 0; col < grid.width; col++) {
    seedIgnoringBoxes(col, 0, grid.getHabitat(col, 0));
    seedIgnoringBoxes(col, grid.height - 1, grid.getHabitat(col, grid.height - 1));
  }
  for (let row = 0; row < grid.height; row++) {
    seedIgnoringBoxes(0, row, grid.getHabitat(0, row));
    seedIgnoringBoxes(grid.width - 1, row, grid.getHabitat(grid.width - 1, row));
  }

  seed(forestSeed.col, forestSeed.row, Habitat.Woodland);

  const seedCols = Math.max(1, Math.floor(grid.width / SEED_SPACING));
  const seedRows = Math.max(1, Math.floor(grid.height / SEED_SPACING));
  for (let i = 0; i < seedCols * seedRows; i++) {
    const col = randInt(rng, 0, grid.width - 1);
    const row = randInt(rng, 0, grid.height - 1);
    seed(col, row, pick(rng, INTERIOR_HABITATS));
  }

  const deltas = [
    { dCol: 0, dRow: -1 },
    { dCol: 0, dRow: 1 },
    { dCol: -1, dRow: 0 },
    { dCol: 1, dRow: 0 },
  ];

  // Cheapest-first, and a tile is claimed when it is *reached* rather than
  // when it is queued: the region whose cheapest path arrives first owns it,
  // which is what makes the varying cost shape the boundary at all.
  while (heap.size > 0) {
    const current = heap.pop();
    if (!current) break;
    for (const { dCol, dRow } of deltas) {
      const col = current.col + dCol;
      const row = current.row + dRow;
      if (!grid.inBounds(col, row)) continue;
      if (isInsideAnyBox(col, row, reservedBoxes)) continue;
      const idx = index(col, row);
      if (claimed[idx]) continue;
      claimed[idx] = 1;
      grid.setHabitat(col, row, current.habitat);
      heap.push({
        cost: current.cost + spreadCost(col, row),
        order: order++,
        col,
        row,
        habitat: current.habitat,
      });
    }
  }
}

/**
 * Paints terrain by cutting a smooth elevation field at each habitat's
 * weights (see noise.ts and habitat.ts's terrainAtElevation).
 *
 * This used to roll each tile independently from those weights, which got
 * the proportions right and the shapes wrong: 37,000 water tiles in a
 * 500x500 world whose largest connected body was 289 tiles, and 40% of dirt
 * sitting as single specks. Weights describe how much of a *region* each
 * terrain covers, not the odds for one tile, and reading them that way is
 * what produces lakes and ridges rather than static.
 *
 * One field serves every habitat, so a lake runs on across the boundary
 * between a wetland and the coast rather than stopping at it.
 *
 * Border ring tiles are skipped — generateBorder already forced their
 * terrain and that stays authoritative. Reserved anchor boxes are skipped
 * too (deliberately left at the grid's default terrain — see growHabitats).
 * Must run after growHabitats.
 */
export function fillTerrainFromHabitats(
  grid: WorldGrid,
  reservedBoxes: readonly AreaPlacement[],
  rng: Rng,
): void {
  // Drawn from the same rng as everything else, so one world seed still
  // determines the whole map and the field is not a second source of truth.
  const fieldSeed = randInt(rng, 0, 0x7ffffffe);
  for (let row = 0; row < grid.height; row++) {
    for (let col = 0; col < grid.width; col++) {
      if (isBorderRing(grid, col, row)) continue;
      if (isInsideAnyBox(col, row, reservedBoxes)) continue;
      const elevation = uniform(col, row, fieldSeed);
      grid.setTerrain(col, row, terrainAtElevation(grid.getHabitat(col, row), elevation));
    }
  }
}
