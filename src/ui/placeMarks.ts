// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { SPELLS, type Spell, TAUGHT_AT } from "../spells/spellbook";
import { FixtureType } from "../world/fixtures";
import type { PlaceName } from "../world/places";
import { itemIcon } from "./assets";
import { RUNE_OF } from "./runes";

/**
 * What each place on the map still has for her, as pictures.
 *
 * **The question the map could not answer.** The map on the tower wall draws
 * the five places and where she is standing, which tells a child where things
 * are and nothing about whether any of them is worth the walk. Meanwhile the
 * game already has a mark that means *this one still has something for you* —
 * the rune over a teacher's head, which goes out once it has been given. The
 * two were built years apart and never introduced. This introduces them: the
 * same picture, on the same rule, at world scale.
 *
 * **Why the dome carries a machine and not a rune.** Four places owe a spell
 * and the fifth owes the blueprint, which is a machine — the astronomer is
 * the one teacher in the game who pays in something other than a spell. So
 * its picture is the blueprint's own, the one the crate shows, rather than a
 * new symbol invented for a map. A child who walks up the mountain sees the
 * thing she was promised in the place she will later take it from.
 *
 * That the observatory can be marked at all is the point of the exercise. It
 * is the one anchor area with no spell, no guide and no rune pointing at it,
 * and it turns out to hold a hard prerequisite for finishing the game — see
 * `docs/STORY.md`.
 *
 * **No Phaser here, on purpose**, like `minimap.ts` next to it: what a place
 * owes is a fact about progress, and it is tested without a browser.
 */

/** What the observatory owes, which is a machine rather than a spell. */
export const DOME_OWES = FixtureType.Blueprint;

/**
 * The pictures one place still owes, in the order they should be drawn.
 *
 * Empty for a place with nothing left, which is what makes the mark mean
 * anything: a map where every dot always glowed would be a map saying only
 * that there are five places, which she can already see.
 */
export function owedAt(
  place: PlaceName,
  knows: (spell: Spell) => boolean,
  blueprintEarned: boolean,
): readonly string[] {
  if (place === "observatory") return blueprintEarned ? [] : [itemIcon(DOME_OWES)];
  // Walked in `SPELLS` order rather than over `TAUGHT_AT`'s own keys, so the
  // city's two come out in the order the spellbook lists them — which is the
  // order her own tray shows, and the only order she has ever seen them in.
  return SPELLS.filter((spell) => TAUGHT_AT[spell] === place && !knows(spell)).map(
    (spell) => RUNE_OF[spell],
  );
}
