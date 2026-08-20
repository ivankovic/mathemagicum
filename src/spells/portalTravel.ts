// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { type Facing, oppositeFacing, stepForFacing } from "../world/characters";
import type { GridPoint } from "../world/topdown";

/**
 * Going through the portal: how long it takes, where it stands, and what
 * can be seen through it.
 *
 * The arithmetic of the journey lives in `portal.ts`; this is the crossing.
 * It is here rather than in the scene for the reason every other rule is —
 * where a doorway stands and how far into the world it can see are both
 * things that go wrong at the edge of the map, and both are answerable
 * without a browser.
 *
 * **The portal has two ends and shows the other one.** Standing in the
 * village it is a window onto the harbour; standing in the harbour a moment
 * later it is a window back onto the village. That is the whole of the
 * effect and it is worth stating: a hole that showed the ground you are
 * already on would be a decoration, and a hole that showed nothing would be
 * a door to a cupboard.
 */

/**
 * How long each beat takes, in milliseconds.
 *
 * Kept short on purpose. This plays every single time a child travels, and
 * an animation that is a delight the first time is a toll by the tenth —
 * the whole thing is under two seconds, which is about as long as the
 * growth spell's parchment lingers after its last answer.
 */
export const PORTAL_OPEN_MS = 340;
/** A beat with it open, so what is through it can actually be looked at. */
export const PORTAL_HOLD_MS = 200;
export const PORTAL_ENTER_MS = 400;
export const PORTAL_EXIT_MS = 360;
export const PORTAL_CLOSE_MS = 280;

export function portalTravelMs(): number {
  return PORTAL_OPEN_MS + PORTAL_HOLD_MS + PORTAL_ENTER_MS + PORTAL_EXIT_MS + PORTAL_CLOSE_MS;
}

/** How wide and tall the opening is, in tiles. */
export const PORTAL_TILES_ACROSS = 3;
export const PORTAL_TILES_DOWN = 4;

export interface WorldExtent {
  readonly width: number;
  readonly height: number;
}

export interface TileRange {
  readonly minCol: number;
  readonly minRow: number;
  readonly maxCol: number;
  readonly maxRow: number;
}

/**
 * Where the doorway stands: the tile the traveller is facing.
 *
 * In front of them rather than on top of them, so they are seen to walk into
 * it — a portal opening on the cell you already occupy is a thing that
 * swallows you, which is a different feeling entirely.
 *
 * **Facing out of the world, it opens behind them instead.** Casting it at
 * the map's edge is an ordinary thing to do — the raised rim rings the whole
 * map, so a child can walk right up to it and turn round — and clamping was
 * the first answer: the doorway landed on the traveller's own cell and
 * swallowed them, which is the exact reading this is written to avoid.
 * Turning it round keeps it on a real tile and keeps the walk; at sixteen
 * pixels across, walking backwards into a hole and forwards into one are the
 * same picture.
 *
 * Only if *both* sides are outside the world does it give up and stand on
 * the traveller, which needs a world one tile wide.
 */
export function portalCell(at: GridPoint, facing: Facing, world: WorldExtent): GridPoint {
  const inside = (cell: GridPoint) =>
    cell.col >= 0 && cell.row >= 0 && cell.col < world.width && cell.row < world.height;
  const stepped = (towards: Facing) => {
    const step = stepForFacing(towards);
    return { col: at.col + step.dCol, row: at.row + step.dRow };
  };
  const ahead = stepped(facing);
  if (inside(ahead)) return ahead;
  const behind = stepped(oppositeFacing(facing));
  return inside(behind) ? behind : at;
}

/**
 * The tiles seen through it: a patch of the far end, centred on where the
 * traveller will land.
 *
 * Clamped to the world, so a destination near a corner shows the corner
 * rather than a band of nothing. The patch is bigger than the opening — the
 * opening is an ellipse cut out of it, and an ellipse inscribed exactly in
 * its own picture shows a bald rectangle at the corners the moment anything
 * moves.
 */
export function portalView(centre: GridPoint, world: WorldExtent): TileRange {
  const across = PORTAL_TILES_ACROSS + 2;
  const down = PORTAL_TILES_DOWN + 2;
  const minCol = Math.max(0, Math.min(world.width - across, centre.col - (across >> 1)));
  const minRow = Math.max(0, Math.min(world.height - down, centre.row - (down >> 1)));
  return {
    minCol,
    minRow,
    maxCol: Math.min(world.width - 1, minCol + across - 1),
    maxRow: Math.min(world.height - 1, minRow + down - 1),
  };
}

/**
 * How open the doorway is, from 0 to 1, at a moment of the opening.
 *
 * Eased so it snaps wide and settles rather than creeping: the fast part of
 * a portal is the tearing open, and a linear one reads as a door on a hinge.
 * Stated here rather than picked from a tween library's list so the shape is
 * written down where the timings are.
 */
export function portalOpenness(elapsed: number, duration: number): number {
  const t = Math.max(0, Math.min(1, duration <= 0 ? 1 : elapsed / duration));
  return 1 - (1 - t) ** 3;
}
