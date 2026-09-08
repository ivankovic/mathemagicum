// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { FixtureType } from "../world/fixtures";
import { UiAsset, itemIcon } from "./assets";

/**
 * What the postal worker brings when the game has changed under a child who
 * was already playing it.
 *
 * The welcome (see `intro.ts`) says what the game *is*, once. This says what
 * is new in it, to somebody who has already been told the first thing. Same
 * man, same paper, same buttons — he is the one person in the world whose
 * job is bringing you something, and a second messenger would be a second
 * thing to learn.
 *
 * **This list is append-only, and that is the whole versioning scheme.** A
 * child's save holds `newsSeen`, which is how many of these they have had;
 * everything past that index is what he still owes them. There is no build
 * number to bump and nothing to remember at release time — you add a beat
 * when you ship something, or you do not and nobody is told anything. A
 * version stamp was the other option and it has a step in it that gets
 * skipped, which is a stamp that lies.
 *
 * Re-ordering or removing a beat silently re-reads every save, so do
 * neither: an entry that is no longer news is still the thing some child's
 * count is pointing past.
 *
 * **A beat is two icons and one sentence about a thing they can go and
 * touch.** These are five-year-olds, some of whom are still learning to
 * read — a changelog is an adult genre and would be read by nobody here.
 * "There is a new machine for the garden" is news. "The corner clock was
 * split out of the file it lived in" is not, and neither is anything whose
 * only picture would have to be drawn specially to explain it: the icons are
 * the ones already in the corner of the screen and on the shop's counter,
 * for the reason `intro.ts` gives.
 */

export const NewsBeat = {
  /** The press: the first machine with two mouths. */
  Press: "press",
} as const;

export type NewsBeat = (typeof NewsBeat)[keyof typeof NewsBeat];

export const NEWS_BEATS: readonly NewsBeat[] = [NewsBeat.Press];

export const NEWS_ICONS: Record<NewsBeat, readonly string[]> = {
  // The machine, and the crate it comes out of once it is built. The crate
  // is the actionable half: a child who knows there is a press but not that
  // built things live in the crate has been told a fact rather than a step.
  [NewsBeat.Press]: [itemIcon(FixtureType.Press), UiAsset.Crate],
};
