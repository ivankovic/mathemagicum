// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { TerrainType } from "./terrain";

/**
 * Ground that was moved, as a save remembers it.
 *
 * The mirror spell painted this — take the ground from there and put it
 * here — and the spell has gone: nobody wanted ground moved, and the puzzle
 * it asked went to the blueprint, which copies the thing a child does want
 * copied. Nothing in the game paints terrain any more.
 *
 * The list stays because the gardens it rearranged are still somebody's
 * gardens. A save that held four moved squares yesterday holds them today,
 * read in and written straight back out, and a child who once put a patch
 * of sand beside her door still has it there. Dropping the field would have
 * been a hill quietly going back to where it was generated, which is the
 * one kind of change to a world nobody asked for.
 *
 * Its own list rather than a difference against the world as generated: the
 * terrain is a quarter of a million tiles, and comparing them all to find
 * the four she changed would be a quarter of a million comparisons on every
 * save.
 */
export type PaintedTiles = readonly (readonly [number, number, TerrainType])[];

/** Read a painted list back from a save, dropping anything that is not one. */
export function readPainted(value: unknown): PaintedTiles {
  if (!Array.isArray(value)) return [];
  const out: (readonly [number, number, TerrainType])[] = [];
  for (const entry of value) {
    if (!Array.isArray(entry) || entry.length !== 3) continue;
    const [col, row, terrain] = entry as [unknown, unknown, unknown];
    if (!Number.isInteger(col) || !Number.isInteger(row)) continue;
    if (typeof terrain !== "string") continue;
    if (!(TERRAIN_NAMES as readonly string[]).includes(terrain)) continue;
    out.push([col as number, row as number, terrain as TerrainType]);
  }
  return out;
}

const TERRAIN_NAMES: readonly TerrainType[] = Object.values(TerrainType);
