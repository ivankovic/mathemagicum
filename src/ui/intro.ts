// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { CoinTier } from "../shop/currency";
import { FixtureType } from "../world/fixtures";
import { PlantType } from "../world/plants";
import { UiAsset, coinIcon, cropIcon, itemIcon } from "./assets";

/**
 * What the postal worker tells you on your way in, and the pictures he tells
 * it with.
 *
 * Four things, which is the whole game as it currently stands: put a seed in
 * the ground, cast the spell to grow it, pick it, sell it. Anything else the
 * player can find on their own — and a tutorial that covers everything is one
 * nobody reads to the end.
 *
 * **Every page is two icons the player will meet again.** They are the same
 * images that sit in the corner of the screen and on the shop's counter, not
 * illustrations drawn for the telling: "tap this pouch" is a sentence a child
 * can act on, and "tap the seed pouch" is one they have to go and decode. The
 * icons live here rather than in the panel so a test can check they are ones
 * the loader actually has.
 */

export const IntroBeat = {
  /** Seeds go in the ground, from the pouch. */
  Seeds: "seeds",
  /** They only grow when the spell is cast on them. */
  Spell: "spell",
  /** Ripe ones are picked with a tap, into the basket. */
  Pick: "pick",
  /** The store turns crops into coins and coins into things to put down. */
  Store: "store",
} as const;

export type IntroBeat = (typeof IntroBeat)[keyof typeof IntroBeat];

export const INTRO_BEATS: readonly IntroBeat[] = [
  IntroBeat.Seeds,
  IntroBeat.Spell,
  IntroBeat.Pick,
  IntroBeat.Store,
];

export const INTRO_ICONS: Record<IntroBeat, readonly string[]> = {
  [IntroBeat.Seeds]: [UiAsset.SeedPouch, cropIcon(PlantType.Carrot)],
  [IntroBeat.Spell]: [UiAsset.Spellbook, UiAsset.RuneAdd],
  [IntroBeat.Pick]: [cropIcon(PlantType.Sunflower), UiAsset.Basket],
  [IntroBeat.Store]: [coinIcon(CoinTier.Gold), itemIcon(FixtureType.Fence)],
};
