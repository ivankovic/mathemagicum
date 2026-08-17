// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { type PixelRect, type ScreenPoint, gridToScreen } from "./iso";

// Tiles per chunk, per axis. Rendering (not world data) is chunked: each
// chunk becomes one RenderTexture, activated near the camera and released
// away from it, so a 500x500+ world never has to rasterize all at once.
export const CHUNK_SIZE = 32;

export interface ChunkCoord {
  chunkCol: number;
  chunkRow: number;
}

export function tileToChunk(col: number, row: number): ChunkCoord {
  return { chunkCol: Math.floor(col / CHUNK_SIZE), chunkRow: Math.floor(row / CHUNK_SIZE) };
}

export function chunkKey(chunk: ChunkCoord): string {
  return `${chunk.chunkCol},${chunk.chunkRow}`;
}

// Screen-space AABB (in the map's own unshifted projection space — callers
// add their own origin) of one chunk's tiles. Isometric tiles are diamonds,
// so neighbouring chunks' bounds overlap; pad by half a tile on every side
// or you get seams at chunk boundaries.
export function chunkScreenBounds(
  chunk: ChunkCoord,
  tileWidth: number,
  tileHeight: number,
): PixelRect {
  const colStart = chunk.chunkCol * CHUNK_SIZE;
  const rowStart = chunk.chunkRow * CHUNK_SIZE;
  const colEnd = colStart + CHUNK_SIZE - 1;
  const rowEnd = rowStart + CHUNK_SIZE - 1;
  const corners: ScreenPoint[] = [
    gridToScreen(colStart, rowStart),
    gridToScreen(colEnd, rowStart),
    gridToScreen(colStart, rowEnd),
    gridToScreen(colEnd, rowEnd),
  ];
  const xs = corners.map((p) => p.x);
  const ys = corners.map((p) => p.y);
  const padX = tileWidth / 2;
  const padY = tileHeight / 2;
  return {
    minX: Math.min(...xs) - padX,
    maxX: Math.max(...xs) + padX,
    minY: Math.min(...ys) - padY,
    maxY: Math.max(...ys) + padY,
  };
}

// Screen-space AABB of one chunk's DUAL tiles (see src/world/tileset.ts's
// module docstring) — the dual grid extends one extra row/column of tiles
// beyond a chunk's own CHUNK_SIZE x CHUNK_SIZE data cells (its outermost
// dual tiles are centered half a cell before chunkCol*CHUNK_SIZE and half
// a cell past the chunk's own last data cell), so this is NOT just
// chunkScreenBounds with padding — it covers a genuinely larger area, or
// GameScene.activateChunk clips those outermost dual tiles when it stamps
// them into a RenderTexture sized off the wrong bounds.
export function dualChunkScreenBounds(
  chunk: ChunkCoord,
  tileWidth: number,
  tileHeight: number,
): PixelRect {
  const colStart = chunk.chunkCol * CHUNK_SIZE - 0.5;
  const rowStart = chunk.chunkRow * CHUNK_SIZE - 0.5;
  const colEnd = colStart + CHUNK_SIZE;
  const rowEnd = rowStart + CHUNK_SIZE;
  const corners: ScreenPoint[] = [
    gridToScreen(colStart, rowStart),
    gridToScreen(colEnd, rowStart),
    gridToScreen(colStart, rowEnd),
    gridToScreen(colEnd, rowEnd),
  ];
  const xs = corners.map((p) => p.x);
  const ys = corners.map((p) => p.y);
  const padX = tileWidth / 2;
  const padY = tileHeight / 2;
  return {
    minX: Math.min(...xs) - padX,
    maxX: Math.max(...xs) + padX,
    minY: Math.min(...ys) - padY,
    maxY: Math.max(...ys) + padY,
  };
}

export interface TileRange {
  minCol: number;
  maxCol: number;
  minRow: number;
  maxRow: number;
}

// Chunk coords covering a tile range, expanded by marginChunks on every
// side and clamped to the world's chunk bounds. The tile range itself is
// expected to already be a conservative (over-inclusive is fine,
// under-inclusive is not) bound on what's visible — see GameScene's use
// of screenToGrid on the camera's world-view corners.
export function chunksCoveringTileRange(
  range: TileRange,
  worldWidthTiles: number,
  worldHeightTiles: number,
  marginChunks: number,
): ChunkCoord[] {
  const maxChunkCol = Math.max(0, Math.ceil(worldWidthTiles / CHUNK_SIZE) - 1);
  const maxChunkRow = Math.max(0, Math.ceil(worldHeightTiles / CHUNK_SIZE) - 1);
  const start = tileToChunk(range.minCol, range.minRow);
  const end = tileToChunk(range.maxCol, range.maxRow);

  const minChunkCol = Math.max(0, start.chunkCol - marginChunks);
  const minChunkRow = Math.max(0, start.chunkRow - marginChunks);
  const maxChunkColClamped = Math.min(maxChunkCol, end.chunkCol + marginChunks);
  const maxChunkRowClamped = Math.min(maxChunkRow, end.chunkRow + marginChunks);

  const coords: ChunkCoord[] = [];
  for (let chunkRow = minChunkRow; chunkRow <= maxChunkRowClamped; chunkRow++) {
    for (let chunkCol = minChunkCol; chunkCol <= maxChunkColClamped; chunkCol++) {
      coords.push({ chunkCol, chunkRow });
    }
  }
  return coords;
}
