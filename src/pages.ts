// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

/**
 * Stepping through a short deck of pages.
 *
 * Two people in the village explain things a page at a time, and both need
 * the same two answers: which page is next, and whether this is the last one.
 * Small enough to have written twice; written once because the *clamping* is
 * the part worth agreeing on, and two copies of a rule are two chances for
 * one of them to start wrapping instead.
 */

/**
 * The page `step` along from this one, clamped at both ends.
 *
 * Clamped rather than wrapping: a "next" that jumped back to the beginning
 * reads as the panel having lost its place, and a "back" from page one that
 * landed on the last page reads as it having lost the plot entirely.
 */
export function stepPage<T>(pages: readonly T[], current: T, step: number): T {
  const index = pages.indexOf(current);
  const wanted = Math.max(0, Math.min(pages.length - 1, index + step));
  return pages[wanted] as T;
}

export function isLastPage<T>(pages: readonly T[], current: T): boolean {
  return pages.length > 0 && current === pages[pages.length - 1];
}
