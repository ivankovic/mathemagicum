// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import type { WorldGrid } from "./grid";

export interface GridPos {
  col: number;
  row: number;
}

const DIRECTIONS: readonly GridPos[] = [
  { col: 0, row: -1 },
  { col: 0, row: 1 },
  { col: -1, row: 0 },
  { col: 1, row: 0 },
];

function samePos(a: GridPos, b: GridPos): boolean {
  return a.col === b.col && a.row === b.row;
}

function posKey(p: GridPos): string {
  return `${p.col},${p.row}`;
}

// Shortest path from start to goal over passable tiles, 4-directional,
// uniform cost — BFS is exact and plenty fast for a map this size, no need
// for A*. Returns the steps to take (excluding start), or null if the goal
// is unreachable or itself impassable. Returns [] if already at the goal.
export function findPath(grid: WorldGrid, start: GridPos, goal: GridPos): GridPos[] | null {
  if (!grid.isPassable(goal.col, goal.row)) return null;
  if (samePos(start, goal)) return [];

  const cameFrom = new Map<string, GridPos>();
  const visited = new Set<string>([posKey(start)]);
  const queue: GridPos[] = [start];

  for (let head = 0; head < queue.length; head++) {
    const current = queue[head];
    if (!current) continue;
    if (samePos(current, goal)) return reconstructPath(cameFrom, start, goal);

    for (const delta of DIRECTIONS) {
      const next = { col: current.col + delta.col, row: current.row + delta.row };
      const key = posKey(next);
      if (visited.has(key) || !grid.isPassable(next.col, next.row)) continue;
      visited.add(key);
      cameFrom.set(key, current);
      queue.push(next);
    }
  }
  return null;
}

function reconstructPath(
  cameFrom: ReadonlyMap<string, GridPos>,
  start: GridPos,
  goal: GridPos,
): GridPos[] {
  const path: GridPos[] = [];
  let current = goal;
  while (!samePos(current, start)) {
    path.push(current);
    const prev = cameFrom.get(posKey(current));
    if (!prev) break;
    current = prev;
  }
  return path.reverse();
}
