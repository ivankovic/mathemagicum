// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import {
  CHUNK_SIZE,
  type ChunkCoord,
  chunkCount,
  chunkKey,
  chunksCoveringTileRange,
  dualChunkScreenBounds,
  dualTileRange,
  dualTileToChunk,
} from "./chunks";
import { DUAL_ORIGIN } from "./terrainAtlas";
import { TILE_SIZE } from "./topdown";

describe("dualTileToChunk", () => {
  test("the dual grid's first tile is in chunk (0,0)", () => {
    expect(dualTileToChunk(DUAL_ORIGIN, DUAL_ORIGIN)).toEqual({ chunkCol: 0, chunkRow: 0 });
  });

  test("the last tile of a chunk is still in that chunk", () => {
    const last = DUAL_ORIGIN + CHUNK_SIZE - 1;
    expect(dualTileToChunk(last, last)).toEqual({ chunkCol: 0, chunkRow: 0 });
  });

  test("the first tile past a chunk boundary is in the next chunk", () => {
    const first = DUAL_ORIGIN + CHUNK_SIZE;
    expect(dualTileToChunk(first, DUAL_ORIGIN)).toEqual({ chunkCol: 1, chunkRow: 0 });
    expect(dualTileToChunk(DUAL_ORIGIN, first)).toEqual({ chunkCol: 0, chunkRow: 1 });
  });

  test("round-trips with dualTileRange for every tile of a chunk", () => {
    const chunk: ChunkCoord = { chunkCol: 2, chunkRow: 3 };
    const range = dualTileRange(chunk);
    for (const col of [range.minCol, range.maxCol]) {
      for (const row of [range.minRow, range.maxRow]) {
        expect(dualTileToChunk(col, row)).toEqual(chunk);
      }
    }
  });
});

describe("chunkKey", () => {
  test("is stable and distinguishes different chunks", () => {
    expect(chunkKey({ chunkCol: 1, chunkRow: 2 })).toBe(chunkKey({ chunkCol: 1, chunkRow: 2 }));
    expect(chunkKey({ chunkCol: 1, chunkRow: 2 })).not.toBe(chunkKey({ chunkCol: 2, chunkRow: 1 }));
  });
});

describe("dualChunkScreenBounds", () => {
  // Square tiles abut exactly, so unlike the isometric bounds this replaced
  // there is no padding and no overlap — neighbouring chunks meet on a line.
  // Any gap leaves an unpainted seam; any overlap double-draws it.
  test("neighbouring chunks meet exactly, with no gap and no overlap", () => {
    const a = dualChunkScreenBounds({ chunkCol: 0, chunkRow: 0 });
    const right = dualChunkScreenBounds({ chunkCol: 1, chunkRow: 0 });
    const below = dualChunkScreenBounds({ chunkCol: 0, chunkRow: 1 });
    expect(right.minX).toBe(a.maxX);
    expect(below.minY).toBe(a.maxY);
  });

  test("is exactly CHUNK_SIZE tiles across", () => {
    const bounds = dualChunkScreenBounds({ chunkCol: 2, chunkRow: 3 });
    expect(bounds.maxX - bounds.minX).toBe(CHUNK_SIZE * TILE_SIZE);
    expect(bounds.maxY - bounds.minY).toBe(CHUNK_SIZE * TILE_SIZE);
  });

  test("bounds are whole pixels, so a RenderTexture needs no rounding", () => {
    const bounds = dualChunkScreenBounds({ chunkCol: 5, chunkRow: 7 });
    for (const value of [bounds.minX, bounds.minY, bounds.maxX, bounds.maxY]) {
      expect(Number.isInteger(value)).toBe(true);
    }
  });
});

describe("chunkCount", () => {
  test("covers the dual grid, which is one tile larger than the data grid", () => {
    expect(chunkCount(CHUNK_SIZE - 1)).toBe(1);
    // CHUNK_SIZE data cells need CHUNK_SIZE + 1 dual tiles — one chunk over.
    expect(chunkCount(CHUNK_SIZE)).toBe(2);
  });
});

describe("chunksCoveringTileRange", () => {
  test("a range entirely within one chunk with no margin returns just that chunk", () => {
    const coords = chunksCoveringTileRange(
      { minCol: 5, maxCol: 10, minRow: 5, maxRow: 10 },
      500,
      500,
      0,
    );
    expect(coords).toEqual([{ chunkCol: 0, chunkRow: 0 }]);
  });

  test("includes the chunk holding the dual tiles behind the range's first cell", () => {
    // A data cell is a corner of dual tiles c-1 and c. Chunk 0 ends at dual
    // tile CHUNK_SIZE - 2 (the grid starts at DUAL_ORIGIN), so data cell
    // CHUNK_SIZE - 1 is the one whose two dual tiles straddle the boundary —
    // miss the earlier chunk and that cell's top-left quarter goes unpainted.
    const split = CHUNK_SIZE - 1;
    const coords = chunksCoveringTileRange(
      { minCol: split, maxCol: split, minRow: split, maxRow: split },
      500,
      500,
      0,
    );
    expect(coords).toContainEqual({ chunkCol: 0, chunkRow: 0 });
    expect(coords).toContainEqual({ chunkCol: 1, chunkRow: 1 });
  });

  test("margin expands the returned set symmetrically", () => {
    const coords = chunksCoveringTileRange(
      { minCol: 40, maxCol: 40, minRow: 40, maxRow: 40 },
      500,
      500,
      1,
    );
    expect(coords.length).toBe(9);
    expect(coords).toContainEqual({ chunkCol: 0, chunkRow: 0 });
    expect(coords).toContainEqual({ chunkCol: 2, chunkRow: 2 });
  });

  test("clamps to world bounds instead of returning negative/out-of-range chunks", () => {
    const coords = chunksCoveringTileRange(
      { minCol: 0, maxCol: 0, minRow: 0, maxRow: 0 },
      500,
      500,
      3,
    );
    expect(coords.length).toBeGreaterThan(0);
    for (const c of coords) {
      expect(c.chunkCol).toBeGreaterThanOrEqual(0);
      expect(c.chunkRow).toBeGreaterThanOrEqual(0);
    }
  });

  test("clamps at the far edge of a 500x500 world too", () => {
    const maxChunkIndex = chunkCount(500) - 1;
    const coords = chunksCoveringTileRange(
      { minCol: 499, maxCol: 499, minRow: 499, maxRow: 499 },
      500,
      500,
      3,
    );
    expect(coords.length).toBeGreaterThan(0);
    for (const c of coords) {
      expect(c.chunkCol).toBeLessThanOrEqual(maxChunkIndex);
      expect(c.chunkRow).toBeLessThanOrEqual(maxChunkIndex);
    }
  });

  test("the chunks for a full-world range cover every dual tile of that world", () => {
    const size = 100;
    const coords = chunksCoveringTileRange(
      { minCol: 0, maxCol: size - 1, minRow: 0, maxRow: size - 1 },
      size,
      size,
      0,
    );
    const covered = new Set<string>();
    for (const chunk of coords) {
      const range = dualTileRange(chunk);
      for (let row = range.minRow; row <= range.maxRow; row++) {
        for (let col = range.minCol; col <= range.maxCol; col++) covered.add(`${col},${row}`);
      }
    }
    for (let row = DUAL_ORIGIN; row < size; row++) {
      for (let col = DUAL_ORIGIN; col < size; col++) {
        expect(covered.has(`${col},${row}`)).toBe(true);
      }
    }
  });
});
