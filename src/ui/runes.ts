// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import type { Spell } from "../spells/spellbook";
import { UiAsset } from "./assets";

/**
 * The rune each spell is drawn as, in one place.
 *
 * There were two: the spellbook's tray listed them by hand in its own order,
 * and the mark over a teacher's head listed the taught ones again. Inserting
 * the division rune between the times and the hourglass renumbered every
 * button after it, and four browser scenarios that tap `spellbook.4` went on
 * tapping the fourth button while meaning the hourglass. Nothing said so:
 * the tap landed, the rune it hit was one nobody had been taught, and a
 * refusal looks exactly like a spell that did not open.
 *
 * So the order is `SPELLS` and the pictures are here, and the tray is built
 * from the two of them rather than written out a third time.
 */
export const RUNE_OF: Record<Spell, string> = {
  growth: UiAsset.RuneAdd,
  clearing: UiAsset.RuneMinus,
  portal: UiAsset.RunePortal,
  array: UiAsset.RuneTimes,
  share: UiAsset.RuneDivide,
  hourglass: UiAsset.RuneHourglass,
  mirror: UiAsset.RuneMirror,
};
