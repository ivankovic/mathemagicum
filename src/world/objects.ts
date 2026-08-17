// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

// A structure placed on the grid at world-generation time — a building, the
// village well, etc. Distinct from a plant (player-placed, single tile,
// lives in WorldGrid.plants) and from an NPC (runtime-only, moves every
// frame in GameScene, never touches the grid at all).
export interface PlacedObject {
  id: string;
  type: string;
  col: number;
  row: number;
  width: number;
  height: number;
  blocksMovement: boolean;
  // The single footprint cell a standalone sprite (see
  // src/world/buildingSprites.ts) is planted on — its bottom-center point
  // lines up with this cell's, same anchoring convention plants use. For
  // a multi-cell object this is normally its front-facing cell (nearest
  // its "audience", e.g. the village well for a building), not its
  // top-left corner or centre, so the sprite doesn't look like it's
  // floating over empty footprint or embedded behind its own front wall.
  // Equal to (col, row) for a 1x1 object.
  anchorCol: number;
  anchorRow: number;
}
