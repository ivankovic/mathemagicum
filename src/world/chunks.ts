// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { DUAL_OFFSET, DUAL_ORIGIN } from "./terrainAtlas";
import { type PixelRect, TILE_SIZE } from "./topdown";

// Dual tiles per chunk, per axis. Rendering (not world data) is chunked:
// each chunk becomes one RenderTexture, activated near the camera and
// released away from it, so a 500x500+ world never has to rasterize at once.
export const CHUNK_SIZE = 32;

export interface ChunkCoord {
  chunkCol: number;
  chunkRow: number;
}

export function chunkKey(chunk: ChunkCoord): string {
  return `${chunk.chunkCol},${chunk.chunkRow}`;
}

export interface TileRange {
  minCol: number;
  maxCol: number;
  minRow: number;
  maxRow: number;
}

// Chunks partition the DUAL tile grid, not the data grid — that grid is what
// actually gets drawn, and it starts one tile back on each axis (see
// terrainAtlas.ts's DUAL_ORIGIN). Chunk 0 therefore begins at dual tile -1,
// so a chunk's tiles are contiguous and no dual tile belongs to two chunks.
export function dualTileRange(chunk: ChunkCoord): TileRange {
  const minCol = DUAL_ORIGIN + chunk.chunkCol * CHUNK_SIZE;
  const minRow = DUAL_ORIGIN + chunk.chunkRow * CHUNK_SIZE;
  return { minCol, maxCol: minCol + CHUNK_SIZE - 1, minRow, maxRow: minRow + CHUNK_SIZE - 1 };
}

export function dualTileToChunk(col: number, row: number): ChunkCoord {
  return {
    chunkCol: Math.floor((col - DUAL_ORIGIN) / CHUNK_SIZE),
    chunkRow: Math.floor((row - DUAL_ORIGIN) / CHUNK_SIZE),
  };
}

// Exact pixel rect of one chunk's dual tiles. Unlike the isometric version
// this replaced, no half-tile padding is needed anywhere: top-down tiles are
// axis-aligned squares that tile exactly, so neighbouring chunks abut rather
// than overlap and there are no seams to pad away.
export function dualChunkScreenBounds(chunk: ChunkCoord): PixelRect {
  const range = dualTileRange(chunk);
  return {
    minX: range.minCol * TILE_SIZE + DUAL_OFFSET,
    minY: range.minRow * TILE_SIZE + DUAL_OFFSET,
    maxX: (range.maxCol + 1) * TILE_SIZE + DUAL_OFFSET,
    maxY: (range.maxRow + 1) * TILE_SIZE + DUAL_OFFSET,
  };
}

// How many chunks the dual grid for a world of this size needs per axis.
// The dual grid is one tile wider and taller than the data grid.
export function chunkCount(dataCells: number): number {
  return Math.max(1, Math.ceil((dataCells + 1) / CHUNK_SIZE));
}

// Chunks covering a range of DATA tiles, expanded by marginChunks on every
// side and clamped to the world's chunk bounds. A data cell is a corner of
// the four dual tiles around it, so the dual range runs one further back on
// each axis than the data range does. The input is expected to already be a
// conservative bound on what's visible — over-inclusive is fine,
// under-inclusive is not.
export function chunksCoveringTileRange(
  range: TileRange,
  worldWidthTiles: number,
  worldHeightTiles: number,
  marginChunks: number,
): ChunkCoord[] {
  const maxChunkCol = chunkCount(worldWidthTiles) - 1;
  const maxChunkRow = chunkCount(worldHeightTiles) - 1;
  const start = dualTileToChunk(range.minCol - 1, range.minRow - 1);
  const end = dualTileToChunk(range.maxCol, range.maxRow);

  const minChunkCol = Math.max(0, start.chunkCol - marginChunks);
  const minChunkRow = Math.max(0, start.chunkRow - marginChunks);
  const lastCol = Math.min(maxChunkCol, end.chunkCol + marginChunks);
  const lastRow = Math.min(maxChunkRow, end.chunkRow + marginChunks);

  const coords: ChunkCoord[] = [];
  for (let chunkRow = minChunkRow; chunkRow <= lastRow; chunkRow++) {
    for (let chunkCol = minChunkCol; chunkCol <= lastCol; chunkCol++) {
      coords.push({ chunkCol, chunkRow });
    }
  }
  return coords;
}
