// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import type { AreaPlacement } from "./anchors";
import type { WorldGrid } from "./grid";
import { Habitat, sampleTerrain } from "./habitat";
import type { GridPoint } from "./iso";
import { type Rng, pick, randInt } from "./rng";

const INTERIOR_HABITATS: readonly Habitat[] = [Habitat.Meadow, Habitat.Woodland, Habitat.Wetland];
// Roughly one extra interior seed per this many tiles, per axis — a tuning
// knob (docs/WORLD_GENERATION.md open questions), not a design fork.
const SEED_SPACING = 60;

interface QueueItem {
  col: number;
  row: number;
  habitat: Habitat;
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
  const queue: QueueItem[] = [];

  function seedIgnoringBoxes(col: number, row: number, habitat: Habitat): void {
    if (!grid.inBounds(col, row)) return;
    const idx = index(col, row);
    if (claimed[idx]) return;
    claimed[idx] = 1;
    grid.setHabitat(col, row, habitat);
    queue.push({ col, row, habitat });
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

  for (let head = 0; head < queue.length; head++) {
    const current = queue[head];
    if (!current) continue;
    for (const { dCol, dRow } of deltas) {
      const col = current.col + dCol;
      const row = current.row + dRow;
      if (!grid.inBounds(col, row)) continue;
      if (isInsideAnyBox(col, row, reservedBoxes)) continue;
      const idx = index(col, row);
      if (claimed[idx]) continue;
      claimed[idx] = 1;
      grid.setHabitat(col, row, current.habitat);
      queue.push({ col, row, habitat: current.habitat });
    }
  }
}

// Samples terrain per tile from its (already-grown) habitat's weights.
// Border ring tiles are skipped — generateBorder already forced their
// terrain and that must stay authoritative, never overwritten by a
// habitat roll. Reserved anchor boxes are skipped too (deliberately left
// at the grid's default terrain — see growHabitats). Must run after
// growHabitats.
export function fillTerrainFromHabitats(
  grid: WorldGrid,
  reservedBoxes: readonly AreaPlacement[],
  rng: Rng,
): void {
  for (let row = 0; row < grid.height; row++) {
    for (let col = 0; col < grid.width; col++) {
      if (isBorderRing(grid, col, row)) continue;
      if (isInsideAnyBox(col, row, reservedBoxes)) continue;
      grid.setTerrain(col, row, sampleTerrain(grid.getHabitat(col, row), rng));
    }
  }
}
