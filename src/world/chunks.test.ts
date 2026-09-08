// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import {
  CHUNK_SIZE,
  type ChunkCoord,
  type TileRange,
  chunkCount,
  chunkKey,
  chunksCoveringTileRange,
  coldestKeys,
  dualChunkScreenBounds,
  dualTileRange,
  dualTileToChunk,
  sameSpan,
  spanOf,
  tilesUnder,
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

describe("tilesUnder", () => {
  test("a rectangle sitting exactly on the origin starts at tile nought", () => {
    const range = tilesUnder({ minX: 0, minY: 0, maxX: TILE_SIZE, maxY: TILE_SIZE }, 0, 0);
    expect(range).toEqual({ minCol: 0, maxCol: 1, minRow: 0, maxRow: 1 });
  });

  test("moves with the origin, which is where the grid is drawn", () => {
    const view = { minX: 100, minY: 100, maxX: 100 + TILE_SIZE, maxY: 100 + TILE_SIZE };
    expect(tilesUnder(view, 100, 100)).toEqual({ minCol: 0, maxCol: 1, minRow: 0, maxRow: 1 });
  });

  test("floors rather than rounds, so a rectangle inside one tile is that tile", () => {
    const view = { minX: 1, minY: 1, maxX: TILE_SIZE - 1, maxY: TILE_SIZE - 1 };
    expect(tilesUnder(view, 0, 0)).toEqual({ minCol: 0, maxCol: 0, minRow: 0, maxRow: 0 });
  });

  test("goes negative to the left of and above the origin", () => {
    const range = tilesUnder({ minX: -1, minY: -1, maxX: 0, maxY: 0 }, 0, 0);
    expect(range).toEqual({ minCol: -1, maxCol: 0, minRow: -1, maxRow: 0 });
  });

  test("reads each axis against its own origin", () => {
    // Distinct origins on purpose. With one standing in for the other this
    // still returns four numbers and they are still in order, so only the
    // values catch it.
    const view = { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    expect(tilesUnder(view, TILE_SIZE, TILE_SIZE * 3)).toEqual({
      minCol: -1,
      maxCol: -1,
      minRow: -3,
      maxRow: -3,
    });
  });

  test("keeps its order: flooring never swaps the two corners", () => {
    for (let x = -200; x <= 200; x += 37) {
      const range = tilesUnder({ minX: x, minY: x, maxX: x + 640, maxY: x + 480 }, 13, -29);
      expect(range.minCol).toBeLessThanOrEqual(range.maxCol);
      expect(range.minRow).toBeLessThanOrEqual(range.maxRow);
    }
  });
});

describe("spanOf", () => {
  // The arithmetic the streamer used to do inline, written out here in the
  // literal form it had. If `spanOf` and this ever disagree, one of them has
  // drifted from `chunksCoveringTileRange` and the fast path is answering
  // about the wrong chunks.
  function inlineSpan(range: TileRange) {
    return {
      startCol: Math.floor((range.minCol - 1 - DUAL_ORIGIN) / CHUNK_SIZE),
      startRow: Math.floor((range.minRow - 1 - DUAL_ORIGIN) / CHUNK_SIZE),
      endCol: Math.floor((range.maxCol - DUAL_ORIGIN) / CHUNK_SIZE),
      endRow: Math.floor((range.maxRow - DUAL_ORIGIN) / CHUNK_SIZE),
    };
  }

  test("is what the streamer worked out by hand, for every range tried", () => {
    for (let minCol = -40; minCol <= 80; minCol += 7) {
      for (let minRow = -40; minRow <= 80; minRow += 11) {
        for (const span of [0, 1, 31, 32, 33, 64]) {
          const range = { minCol, maxCol: minCol + span, minRow, maxRow: minRow + span };
          expect(spanOf(range)).toEqual(inlineSpan(range));
        }
      }
    }
  });

  test("steps back one tile at the near edge and not at the far one", () => {
    // The dual cell behind the range's first tile belongs to the previous
    // chunk on a boundary, and the range needs the chunk holding it.
    const onBoundary = { minCol: DUAL_ORIGIN + CHUNK_SIZE, maxCol: 0, minRow: 0, maxRow: 0 };
    expect(spanOf(onBoundary).startCol).toBe(0);
    expect(spanOf({ ...onBoundary, minCol: DUAL_ORIGIN + CHUNK_SIZE + 1 }).startCol).toBe(1);
  });

  test("agrees with the chunks the range is actually covered by", () => {
    for (const range of [
      { minCol: 0, maxCol: 5, minRow: 0, maxRow: 5 },
      { minCol: 30, maxCol: 40, minRow: 60, maxRow: 70 },
      { minCol: -1, maxCol: 200, minRow: -1, maxRow: 200 },
    ]) {
      const span = spanOf(range);
      const covering = chunksCoveringTileRange(range, 500, 500, 0);
      const cols = covering.map((chunk) => chunk.chunkCol);
      const rows = covering.map((chunk) => chunk.chunkRow);
      expect(Math.min(...cols)).toBe(Math.max(0, span.startCol));
      expect(Math.max(...cols)).toBe(span.endCol);
      expect(Math.min(...rows)).toBe(Math.max(0, span.startRow));
      expect(Math.max(...rows)).toBe(span.endRow);
    }
  });

  test("two ranges in the same chunks have the same span", () => {
    const one = { minCol: 4, maxCol: 10, minRow: 4, maxRow: 10 };
    const other = { minCol: 5, maxCol: 11, minRow: 5, maxRow: 11 };
    expect(spanOf(one)).toEqual(spanOf(other));
  });
});

describe("sameSpan", () => {
  const span = { startCol: 1, startRow: 2, endCol: 3, endRow: 4 };

  test("nothing settled yet is never the same", () => {
    expect(sameSpan(null, span)).toBe(false);
  });

  test("the same four numbers are the same view", () => {
    expect(sameSpan({ ...span }, span)).toBe(true);
  });

  test("any one of the four differing is a different view", () => {
    for (const key of ["startCol", "startRow", "endCol", "endRow"] as const) {
      expect(sameSpan({ ...span, [key]: span[key] + 1 }, span)).toBe(false);
    }
  });
});

describe("coldestKeys", () => {
  const stamps = (...pairs: [string, number][]) => pairs;

  test("gives up nothing while the cache is within its limit", () => {
    expect(coldestKeys(stamps(["a", 1], ["b", 2]), 2, new Set())).toEqual([]);
    expect(coldestKeys(stamps(["a", 1]), 60, new Set())).toEqual([]);
  });

  test("gives up exactly the overflow, coldest first", () => {
    const held = stamps(["a", 5], ["b", 1], ["c", 3], ["d", 9]);
    expect(coldestKeys(held, 2, new Set())).toEqual(["b", "c"]);
  });

  test("never gives up a chunk that is on screen, however cold", () => {
    // The whole point: a chunk in view is about to be used whatever its
    // stamp says, and evicting it is a redraw in the frame that needed it.
    const held = stamps(["a", 0], ["b", 1], ["c", 2], ["d", 3]);
    expect(coldestKeys(held, 2, new Set(["a", "b"]))).toEqual(["c", "d"]);
  });

  test("gives up what it can when everything else is spoken for", () => {
    const held = stamps(["a", 0], ["b", 1], ["c", 2]);
    expect(coldestKeys(held, 1, new Set(["a", "b"]))).toEqual(["c"]);
  });

  test("counts the whole cache against the limit, not just what may go", () => {
    // Three held, one protected, a limit of one: two must go and only two
    // may, so both of them do.
    const held = stamps(["keep", 0], ["x", 1], ["y", 2]);
    expect(coldestKeys(held, 1, new Set(["keep"]))).toEqual(["x", "y"]);
  });
});
