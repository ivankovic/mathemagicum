// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

/**
 * How full the loading bar should be.
 *
 * Small enough to look obvious and wrong enough often enough to be worth
 * stating on its own: the loader runs in two passes on one plugin, its file
 * count *grows* while it works, and both of those have already produced a bar
 * that lied.
 */

/** One pass of the loader: where it starts on the bar and how much it owns. */
export interface BarPass {
  readonly base: number;
  readonly span: number;
}

/** What the loader says right now. */
export interface BarLoad {
  readonly complete: number;
  readonly total: number;
}

/**
 * Where the bar sits, given a pass, the loader's count, and how far it has
 * already got.
 *
 * Never behind `high`. The terrain atlas is a multiatlas: its pages join the
 * queue only once its index has arrived, so the denominator grows mid-pass
 * and an honest fraction falls from 92% to 73%. A bar that goes backwards
 * says the thing you were waiting for got further away.
 */
export function barFraction(pass: BarPass, load: BarLoad, high: number): number {
  const total = Math.max(1, load.total);
  const done = Math.max(0, Math.min(1, load.complete / total));
  return Math.max(high, pass.base + pass.span * done);
}
