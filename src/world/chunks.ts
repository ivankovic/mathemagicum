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
/**
 * The dual tiles a rectangle of the world covers.
 *
 * A floor on each axis, which is what makes the two opposite corners enough:
 * flooring keeps its order, so the smallest pixel is in the smallest tile and
 * the largest in the largest, and an axis-aligned grid needs no other corner.
 *
 * The rectangle is in world pixels and the origin is where the grid's
 * top-left is drawn, because the grid moves under the camera: walking through
 * a door swaps the grid and the origin together.
 */
export function tilesUnder(view: PixelRect, originX: number, originY: number): TileRange {
  return {
    minCol: Math.floor((view.minX - originX) / TILE_SIZE),
    maxCol: Math.floor((view.maxX - originX) / TILE_SIZE),
    minRow: Math.floor((view.minY - originY) / TILE_SIZE),
    maxRow: Math.floor((view.maxY - originY) / TILE_SIZE),
  };
}

/** The first and last chunk a tile range touches. */
export interface ChunkSpan {
  readonly startCol: number;
  readonly startRow: number;
  readonly endCol: number;
  readonly endRow: number;
}

/**
 * Which chunks a range begins and ends in, before any margin or clamp.
 *
 * This is all `chunksCoveringTileRange` reads beyond the world's size, so two
 * ranges with the same span cover the same chunks — which is what lets a
 * frame that has not crossed a boundary do nothing at all. See the streamer.
 *
 * The asymmetry is not a slip and is the whole of what makes the two agree:
 * the near edge steps back one tile and the far edge does not, exactly as
 * `chunksCoveringTileRange` does when it works out its own start and end. A
 * tile is drawn from the dual cell behind it, so the range needs the chunk
 * holding that cell; there is no such cell past the far edge.
 */
export function spanOf(range: TileRange): ChunkSpan {
  const start = dualTileToChunk(range.minCol - 1, range.minRow - 1);
  const end = dualTileToChunk(range.maxCol, range.maxRow);
  return {
    startCol: start.chunkCol,
    startRow: start.chunkRow,
    endCol: end.chunkCol,
    endRow: end.chunkRow,
  };
}

/** Whether the view has come to rest in the same chunks it was in. */
export function sameSpan(before: ChunkSpan | null, now: ChunkSpan): boolean {
  return (
    before !== null &&
    before.startCol === now.startCol &&
    before.startRow === now.startRow &&
    before.endCol === now.endCol &&
    before.endRow === now.endRow
  );
}

/**
 * Which cached chunks to give up, coldest first.
 *
 * The decision only: what is done to a chunk that has been given up is the
 * streamer's, because a chunk is a texture and some sprites and this file
 * knows about neither.
 *
 * `keep` is whatever is on screen now, which is never evicted however cold
 * its stamp — a chunk in view is about to be used whatever it last read, and
 * throwing it away would be a redraw in the frame that needed it. Anything
 * over the limit goes, oldest stamp first; nothing goes while the cache is
 * within it, so a small world never evicts at all.
 */
export function coldestKeys(
  stamps: Iterable<readonly [string, number]>,
  limit: number,
  keep: ReadonlySet<string>,
): string[] {
  const all = [...stamps];
  if (all.length <= limit) return [];
  return all
    .filter(([key]) => !keep.has(key))
    .sort((one, other) => one[1] - other[1])
    .slice(0, all.length - limit)
    .map(([key]) => key);
}

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
