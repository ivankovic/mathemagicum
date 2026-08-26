// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import type { WorldGrid } from "./grid";
import { TerrainType, isPassable } from "./terrain";
import type { GridPoint } from "./topdown";

/**
 * Copying the ground from one place to another: what the mirror spell does.
 *
 * The spell asks a child to make one half of a picture match the other. Its
 * effect is the same verb on the world — take what is *there* and put it
 * *here* — which is the design's rule that a spell's effect mirrors its
 * mathematics, kept for the fifth spell as it was for the other four.
 *
 * One square, or a whole block if she marked one out with the times spell
 * first. That is not two features: a block is a rectangle of squares and
 * this copies a list of them, so the difference is the length of the list.
 *
 * **It cannot make water and it cannot drown any.** The one rule, and it is
 * about the world staying playable rather than about taste: terrain is what
 * decides where a child can walk, so a spell that painted sea over a path
 * could cut a village in half or strand her on an island she made herself.
 * Ground for ground, and the map stays connected however she rearranges it.
 */

/** Why a copy was refused, or that it was not. */
export const CopyRefusal = {
  /** Part of it would land off the edge of the world. */
  OffMap: "off-map",
  /** The ground being copied is not ground — it is the sea. */
  NotGround: "not-ground",
  /** The ground being copied *over* is the sea. */
  OverWater: "over-water",
  /** She pointed at the place it already is. */
  SameSpot: "same-spot",
} as const;

export type CopyRefusal = (typeof CopyRefusal)[keyof typeof CopyRefusal];

export interface Painting {
  readonly at: GridPoint;
  readonly terrain: TerrainType;
}

export type CopyPlan =
  | { readonly ok: true; readonly paint: readonly Painting[] }
  | { readonly ok: false; readonly why: CopyRefusal; readonly at: GridPoint };

/**
 * What copying `source` so that its corner lands on `anchor` would paint.
 *
 * Worked out whole before any of it happens, so a copy that would run off
 * the map or into the sea is refused *before* half of it has been done —
 * half a block of moved ground is a mess a child cannot undo.
 *
 * The source is a list rather than a rectangle because that is all this
 * needs to know: one square and a marked-out block go down the same path.
 * Its corner is the smallest column and row in it, which for a rectangle is
 * the top-left and for a single square is the square.
 */
export function planCopy(
  grid: WorldGrid,
  source: readonly GridPoint[],
  anchor: GridPoint,
): CopyPlan {
  if (source.length === 0) return { ok: false, why: CopyRefusal.OffMap, at: anchor };
  const corner = cornerOf(source);
  const shift = { col: anchor.col - corner.col, row: anchor.row - corner.row };
  if (shift.col === 0 && shift.row === 0) {
    return { ok: false, why: CopyRefusal.SameSpot, at: anchor };
  }

  const paint: Painting[] = [];
  for (const cell of source) {
    if (!grid.inBounds(cell.col, cell.row)) {
      return { ok: false, why: CopyRefusal.OffMap, at: cell };
    }
    const terrain = grid.getTerrain(cell.col, cell.row);
    if (!isPassable(terrain)) return { ok: false, why: CopyRefusal.NotGround, at: cell };

    const to = { col: cell.col + shift.col, row: cell.row + shift.row };
    if (!grid.inBounds(to.col, to.row)) {
      return { ok: false, why: CopyRefusal.OffMap, at: to };
    }
    if (!isPassable(grid.getTerrain(to.col, to.row))) {
      return { ok: false, why: CopyRefusal.OverWater, at: to };
    }
    paint.push({ at: to, terrain });
  }
  return { ok: true, paint };
}

/** The smallest column and row in a list of squares. */
export function cornerOf(cells: readonly GridPoint[]): GridPoint {
  let col = Number.POSITIVE_INFINITY;
  let row = Number.POSITIVE_INFINITY;
  for (const cell of cells) {
    col = Math.min(col, cell.col);
    row = Math.min(row, cell.row);
  }
  return { col, row };
}

/**
 * Ground that has been moved, written down.
 *
 * Its own list rather than a difference against the world as generated. The
 * generated terrain is a quarter of a million tiles and comparing them all
 * to find the four she changed would be a quarter of a million comparisons
 * on every save — and the mirror spell is the only thing in the game that
 * paints, so it can simply say what it did.
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
