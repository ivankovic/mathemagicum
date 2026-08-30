// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { type MachineState, type MachineType, drawOff, feed } from "./machines";
import type { GridPoint } from "./topdown";

/**
 * Wire, which is how one machine reaches another.
 *
 * **It only carries.** That is the whole of what a wire is and the reason it
 * is worth having as its own thing: every decision belongs to a machine
 * standing where a child can see it, and none of them belong to the line
 * between two of them. No filters, no priorities, no settings. A wire that
 * chose would be a rule with nowhere to point at.
 *
 * **A link, not a path.** A wire is two ends and a sag between them, drawn
 * from one machine's crates to another's mouth — not a run of tiles a child
 * lays down and steers round corners. That skips belts, junctions and the
 * whole routing puzzle, which is not the game this is: a child is here to do
 * arithmetic, and a machine that needed its plumbing planned would crowd
 * that out.
 *
 * The world already has wire in it, which is where this came from. The
 * blimps over the city are windmills tethered by cable to the houses below,
 * and a child has seen that working from the ground long before they own a
 * single machine. What they build in the garden is the same idea brought
 * down out of the sky.
 */

/** One length of it: which machine it comes off, and which it feeds. */
export interface Wire {
  /** The square the source machine stands on, as `col,row`. */
  readonly from: string;
  readonly to: string;
}

/**
 * How far one length will reach, in squares.
 *
 * Far enough that two machines need not touch, short enough that a garden
 * cannot be wired to the harbour. Chebyshev, like every other distance in
 * this game — a wire run corner to corner is one wire, the same as a wire
 * run straight, because a child laying them out is thinking about where
 * things *are* rather than about how far a line travels.
 */
export const WIRE_REACH = 6;

/**
 * How much one round's work carries.
 *
 * The same clock the machines run on, so a wire is neither faster nor slower
 * than the thing feeding it. Three, which is what a round of either machine
 * puts into its crates — so a wire keeps up with what it is drinking from
 * and a line neither starves nor silts up on its own.
 */
export const CARRIES_PER_ROUND = 3;

export function wireKey(from: string, to: string): string {
  return `${from}>${to}`;
}

export function tileOf(key: string): GridPoint | null {
  const [col, row] = key.split(",").map(Number);
  if (col === undefined || row === undefined) return null;
  return Number.isInteger(col) && Number.isInteger(row) ? { col, row } : null;
}

/**
 * Whether a wire may be strung between these two squares.
 *
 * Not to itself, and not further than it reaches. Both are refusals a child
 * meets rather than rules they read: the second end is tapped and either
 * takes or does not, so the answer has to be a yes or a no about *those two
 * squares* and nothing else.
 */
export function canString(from: GridPoint, to: GridPoint): boolean {
  const across = Math.abs(from.col - to.col);
  const down = Math.abs(from.row - to.row);
  if (across === 0 && down === 0) return false;
  return Math.max(across, down) <= WIRE_REACH;
}

/** What one length of wire did when it was given a round's work. */
export interface Carried {
  readonly source: MachineState;
  readonly sink: MachineState;
  /** How much moved. Nought is a wire that is backed up. */
  readonly moved: number;
}

/**
 * Carry what will go, and leave what will not.
 *
 * **A refusal backs the source up; it never drops and never swaps.** The
 * destination's mouth holds one kind at a time — see `feed` — so a hothouse
 * full of carrots being sent timber has nowhere to put it. Dropping the
 * timber would quietly destroy a child's material, and swapping it would
 * make the machine eat what was already in there. Leaving it where it is
 * means the source's crates fill up and the line stops, which is visible,
 * undoable, and the reason a sieve is worth building.
 *
 * A wire into a machine that is still asleep carries nothing either, because
 * `feed` refuses one — a machine has to be shown its sum before anything
 * will go into it, however it arrives.
 */
export function carry(
  source: MachineState,
  sink: MachineState,
  sinkMachine: MachineType,
  many: number = CARRIES_PER_ROUND,
): Carried {
  const still: Carried = { source, sink, moved: 0 };
  const drawn = drawOff(source, many);
  if (drawn.item === null || drawn.count <= 0) return still;
  const fed = feed(sink, drawn.item, drawn.count, sinkMachine);
  // Nothing moved, so nothing moved: the source keeps what it had rather
  // than the drawn-off count vanishing between the two.
  if (!fed) return still;
  return { source: drawn.state, sink: fed, moved: drawn.count };
}

/** Every wire, written down, in a stable order. */
export function wiresToSave(wires: readonly Wire[]): string[] {
  return wires.map((wire) => wireKey(wire.from, wire.to));
}

/**
 * Read them back, dropping anything that does not make sense.
 *
 * A bad entry costs a child one length of wire and leaves them the garden.
 * Nothing here checks that a machine still stands at either end: one might
 * have been taken back, and a wire to nowhere carries nothing and is tidied
 * up by the scene when it notices. Refusing to load it would be refusing to
 * load a garden because something had been moved.
 */
export function wiresFromSave(saved: unknown): Wire[] {
  if (!Array.isArray(saved)) return [];
  const wires: Wire[] = [];
  const seen = new Set<string>();
  for (const entry of saved) {
    if (typeof entry !== "string") continue;
    const [from, to] = entry.split(">");
    if (from === undefined || to === undefined) continue;
    const at = tileOf(from);
    const end = tileOf(to);
    if (!at || !end || !canString(at, end)) continue;
    const key = wireKey(from, to);
    if (seen.has(key)) continue;
    seen.add(key);
    wires.push({ from, to });
  }
  return wires;
}
