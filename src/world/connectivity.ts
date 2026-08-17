// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import type { WorldGrid } from "./grid";
import { TerrainType } from "./terrain";
import type { GridPoint } from "./topdown";

const DELTAS = [
  { dCol: 0, dRow: -1 },
  { dCol: 0, dRow: 1 },
  { dCol: -1, dRow: 0 },
  { dCol: 1, dRow: 0 },
];

// Flood-fill reachability over passable tiles only, from one start point.
// Backed by a Uint8Array visited mask, not a Set<string> of "col,row" keys
// — at world scale (250k tiles) that would allocate a quarter million
// strings for something a single byte per tile already answers.
export function floodFillReachable(grid: WorldGrid, start: GridPoint): Uint8Array {
  const visited = new Uint8Array(grid.width * grid.height);
  const index = (col: number, row: number) => row * grid.width + col;
  if (!grid.isPassable(start.col, start.row)) return visited;

  const queue: GridPoint[] = [start];
  visited[index(start.col, start.row)] = 1;

  for (let head = 0; head < queue.length; head++) {
    const current = queue[head];
    if (!current) continue;
    for (const { dCol, dRow } of DELTAS) {
      const col = current.col + dCol;
      const row = current.row + dRow;
      if (!grid.isPassable(col, row)) continue;
      const idx = index(col, row);
      if (visited[idx]) continue;
      visited[idx] = 1;
      queue.push({ col, row });
    }
  }
  return visited;
}

export function isReachable(visited: Uint8Array, grid: WorldGrid, point: GridPoint): boolean {
  if (!grid.inBounds(point.col, point.row)) return false;
  return visited[point.row * grid.width + point.col] === 1;
}

// Cheapest path from `from` to `to` where stepping onto an already-passable
// tile costs 0 and stepping onto an impassable one costs 1 (it would need
// carving). This is NOT src/world/pathfinding.ts's findPath — that bails
// immediately on an impassable goal, which is exactly the case this needs
// to handle. Weights restricted to {0, 1} make this a 0-1 BFS: instead of a
// true deque (no O(1) front-insertion in a plain JS array), it processes
// same-distance nodes as a "frontier" layer before advancing — equivalent
// result, simpler to get right.
export function findCarvePath(grid: WorldGrid, from: GridPoint, to: GridPoint): GridPoint[] | null {
  const width = grid.width;
  const size = width * grid.height;
  const index = (col: number, row: number) => row * width + col;
  const toCol = (idx: number) => idx % width;
  const toRow = (idx: number) => Math.floor(idx / width);

  const dist = new Float64Array(size).fill(Number.POSITIVE_INFINITY);
  const cameFrom = new Int32Array(size).fill(-1);
  const startIdx = index(from.col, from.row);
  const goalIdx = index(to.col, to.row);
  dist[startIdx] = 0;

  let frontier = [startIdx];
  let nextFrontier: number[] = [];
  let currentDist = 0;

  while (frontier.length > 0) {
    const idx = frontier.pop();
    if (idx === undefined) continue;
    if (dist[idx] !== currentDist) continue; // superseded by a cheaper path
    if (idx === goalIdx) break;

    const col = toCol(idx);
    const row = toRow(idx);
    for (const { dCol, dRow } of DELTAS) {
      const nCol = col + dCol;
      const nRow = row + dRow;
      if (!grid.inBounds(nCol, nRow)) continue;
      const nIdx = index(nCol, nRow);
      const cost = grid.isPassable(nCol, nRow) ? 0 : 1;
      const newDist = currentDist + cost;
      if (newDist < (dist[nIdx] ?? Number.POSITIVE_INFINITY)) {
        dist[nIdx] = newDist;
        cameFrom[nIdx] = idx;
        if (cost === 0) frontier.push(nIdx);
        else nextFrontier.push(nIdx);
      }
    }

    if (frontier.length === 0 && nextFrontier.length > 0) {
      frontier = nextFrontier;
      nextFrontier = [];
      currentDist++;
    }
  }

  if (dist[goalIdx] === undefined || dist[goalIdx] === Number.POSITIVE_INFINITY) return null;

  const path: GridPoint[] = [];
  let cur = goalIdx;
  while (cur !== startIdx) {
    path.push({ col: toCol(cur), row: toRow(cur) });
    const prev = cameFrom[cur];
    if (prev === undefined || prev === -1) break;
    cur = prev;
  }
  return path.reverse();
}

// Guarantees every target is reachable from `start`, carving the minimal
// set of impassable tiles for any that aren't already reachable through
// existing terrain. findCarvePath's 0-cost-first preference means it
// naturally routes through existing passable terrain wherever possible, so
// "cheapest path" and "minimal carve" are the same search, not two separate
// concerns.
export function ensureConnectivity(
  grid: WorldGrid,
  start: GridPoint,
  targets: readonly GridPoint[],
): void {
  let reachable = floodFillReachable(grid, start);
  for (const target of targets) {
    if (isReachable(reachable, grid, target)) continue;

    const path = findCarvePath(grid, start, target);
    if (!path) {
      throw new Error(
        `No route at all (even allowing impassable terrain) to (${target.col}, ${target.row})`,
      );
    }
    for (const { col, row } of path) {
      // Both, and in this order. A tile can be impassable because of its
      // terrain, because something is standing on it, or both — and
      // rewriting only the terrain leaves a boulder sitting in the gap. That
      // failed silently once: a story area walled into the mountain stayed
      // sealed while this reported success.
      grid.removeObjectAt(col, row);
      if (!grid.isPassable(col, row)) grid.setTerrain(col, row, TerrainType.Grass);
    }
    reachable = floodFillReachable(grid, start);
  }

  // Verify rather than assume. This function's entire job is a guarantee,
  // and the failure it is guarding against is invisible from inside the
  // generator — it shows up as a story area nobody can walk to.
  for (const target of targets) {
    if (!isReachable(reachable, grid, target)) {
      throw new Error(`Carved a route to (${target.col}, ${target.row}) but it is still cut off`);
    }
  }
}
