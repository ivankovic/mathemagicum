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
}
