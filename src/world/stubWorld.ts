// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

// Temporary: an all-grass square with an impassable water border, standing
// in for the real generator (docs/WORLD_GENERATION.md) while the render/
// camera/chunking side gets built and proven out. Phase 4 replaces this
// with actual generation — nothing here should be treated as permanent.
import { WorldGrid } from "./grid";
import type { GridPoint } from "./iso";
import { TerrainType } from "./terrain";

export interface StubWorld {
  grid: WorldGrid;
  playerStart: GridPoint;
}

export function generateStubWorld(size: number): StubWorld {
  const rows: TerrainType[][] = Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, col) => {
      const isBorder = row === 0 || row === size - 1 || col === 0 || col === size - 1;
      return isBorder ? TerrainType.Water : TerrainType.Grass;
    }),
  );

  return {
    grid: new WorldGrid(rows),
    playerStart: { col: Math.floor(size / 2), row: Math.floor(size / 2) },
  };
}
