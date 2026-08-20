// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

/**
 * How a finished cast went — for any spell.
 *
 * Shared rather than owned by the spell that got here first: the growth
 * spell and the portal spell answer completely different questions, but the
 * difficulty reads both the same way, and a second copy of this shape would
 * be a second thing to keep in step with `recordCast`.
 *
 * `solved` is what the world acts on; `clean` is what the difficulty reads.
 * They are separate because there is no fail state — a cast that took nine
 * goes still does what it was cast for, and a scheme that could only see
 * `solved` would see every cast as identical and never move.
 */
export interface CastResult {
  readonly solved: boolean;
  /** Every answer right the first time it was submitted. */
  readonly clean: boolean;
}

export function castResult(state: { missteps: number } | null, solved: boolean): CastResult {
  return { solved, clean: solved && (state?.missteps ?? 1) === 0 };
}
