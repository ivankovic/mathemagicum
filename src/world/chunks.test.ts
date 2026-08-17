// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import {
  CHUNK_SIZE,
  chunkKey,
  chunkScreenBounds,
  chunksCoveringTileRange,
  dualChunkScreenBounds,
  tileToChunk,
} from "./chunks";
import { TILE_HEIGHT, TILE_WIDTH } from "./iso";

describe("tileToChunk", () => {
  test("tile (0,0) is in chunk (0,0)", () => {
    expect(tileToChunk(0, 0)).toEqual({ chunkCol: 0, chunkRow: 0 });
  });

  test("the last tile of a chunk is still in that chunk", () => {
    expect(tileToChunk(CHUNK_SIZE - 1, CHUNK_SIZE - 1)).toEqual({ chunkCol: 0, chunkRow: 0 });
  });

  test("the first tile past a chunk boundary is in the next chunk", () => {
    expect(tileToChunk(CHUNK_SIZE, 0)).toEqual({ chunkCol: 1, chunkRow: 0 });
    expect(tileToChunk(0, CHUNK_SIZE)).toEqual({ chunkCol: 0, chunkRow: 1 });
  });
});

describe("chunkKey", () => {
  test("is stable and distinguishes different chunks", () => {
    expect(chunkKey({ chunkCol: 1, chunkRow: 2 })).toBe(chunkKey({ chunkCol: 1, chunkRow: 2 }));
    expect(chunkKey({ chunkCol: 1, chunkRow: 2 })).not.toBe(chunkKey({ chunkCol: 2, chunkRow: 1 }));
  });
});

describe("chunkScreenBounds", () => {
  test("padded bounds of neighbouring chunks overlap (no seam gap)", () => {
    const a = chunkScreenBounds({ chunkCol: 0, chunkRow: 0 }, TILE_WIDTH, TILE_HEIGHT);
    const b = chunkScreenBounds({ chunkCol: 1, chunkRow: 0 }, TILE_WIDTH, TILE_HEIGHT);
    // chunk (1,0) sits to the right/below of (0,0) in screen space; their
    // padded AABBs must share at least a sliver, or diamonds right at the
    // boundary get clipped by neither texture.
    expect(b.minX).toBeLessThanOrEqual(a.maxX);
    expect(b.minY).toBeLessThanOrEqual(a.maxY);
  });

  test("unpadded center point of a chunk sits inside its own bounds", () => {
    const bounds = chunkScreenBounds({ chunkCol: 2, chunkRow: 3 }, TILE_WIDTH, TILE_HEIGHT);
    expect(bounds.minX).toBeLessThan(bounds.maxX);
    expect(bounds.minY).toBeLessThan(bounds.maxY);
  });
});

describe("dualChunkScreenBounds", () => {
  test("strictly contains chunkScreenBounds — the dual grid always extends further", () => {
    const chunk = { chunkCol: 2, chunkRow: 3 };
    const primal = chunkScreenBounds(chunk, TILE_WIDTH, TILE_HEIGHT);
    const dual = dualChunkScreenBounds(chunk, TILE_WIDTH, TILE_HEIGHT);
    expect(dual.minX).toBeLessThanOrEqual(primal.minX);
    expect(dual.minY).toBeLessThanOrEqual(primal.minY);
    expect(dual.maxX).toBeGreaterThanOrEqual(primal.maxX);
    expect(dual.maxY).toBeGreaterThanOrEqual(primal.maxY);
  });

  test("padded bounds of neighbouring chunks overlap (no seam gap)", () => {
    const a = dualChunkScreenBounds({ chunkCol: 0, chunkRow: 0 }, TILE_WIDTH, TILE_HEIGHT);
    const b = dualChunkScreenBounds({ chunkCol: 1, chunkRow: 0 }, TILE_WIDTH, TILE_HEIGHT);
    expect(b.minX).toBeLessThanOrEqual(a.maxX);
    expect(b.minY).toBeLessThanOrEqual(a.maxY);
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

  test("margin expands the returned set symmetrically", () => {
    const coords = chunksCoveringTileRange(
      { minCol: 40, maxCol: 40, minRow: 40, maxRow: 40 },
      500,
      500,
      1,
    );
    // tile (40,40) -> chunk (1,1); margin 1 -> chunks (0..2, 0..2) = 9 chunks
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
    for (const c of coords) {
      expect(c.chunkCol).toBeGreaterThanOrEqual(0);
      expect(c.chunkRow).toBeGreaterThanOrEqual(0);
    }
  });

  test("clamps at the far edge of a 500x500 world too", () => {
    const maxChunkIndex = Math.ceil(500 / CHUNK_SIZE) - 1;
    const coords = chunksCoveringTileRange(
      { minCol: 499, maxCol: 499, minRow: 499, maxRow: 499 },
      500,
      500,
      3,
    );
    for (const c of coords) {
      expect(c.chunkCol).toBeLessThanOrEqual(maxChunkIndex);
      expect(c.chunkRow).toBeLessThanOrEqual(maxChunkIndex);
    }
  });
});
