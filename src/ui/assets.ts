// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

/**
 * The interface art, and what the game is allowed to assume about it.
 *
 * Unlike every other asset here these have no footprint, no frames and no
 * animations — a panel is not a spritesheet — so the generator ships one
 * index for the whole set rather than a sidecar per file. Sizes and the
 * nine-slice insets are read from that index rather than restated here, for
 * the same reason building footprints are: the generator is the only thing
 * that knows how big it drew something.
 */

import { COIN_TIERS, type CoinTier } from "../shop/currency";
import { type FixtureType, PLACEABLE_FIXTURES } from "../world/fixtures";
import { PLANT_TYPES, type PlantType } from "../world/plants";

export const UiAsset = {
  ParchmentFill: "parchment-fill",
  ParchmentFrame: "parchment-frame",
  Spellbook: "spellbook",
  RuneAdd: "rune-add",
  SeedPouch: "seed-pouch",
  Basket: "basket",
  Crate: "crate",
  /** The map hanging on the tower's wall — the object, not the world it shows. */
  MapWall: "map-wall",
} as const;

export type UiAsset = (typeof UiAsset)[keyof typeof UiAsset];

/** The icon for a crop, as it appears in the seed pouch and the basket. */
export function cropIcon(plant: PlantType): string {
  return `crop-${plant}`;
}

/** The face of a coin: one picture per tier, with the value written beside it. */
export function coinIcon(tier: CoinTier): string {
  return `coin-${tier}`;
}

/** The icon for something the store sells, as it appears in the crate. */
export function itemIcon(fixture: FixtureType): string {
  return `item-${fixture}`;
}

// The crop icons are per-plant rather than named one by one, which is what
// keeps them in step: adding a crop to PLANT_TYPES asks the loader for an
// icon that has to exist, and `uiEntry` throws by name if the generator has
// not been re-run. The generator has the mirror image of this check.
export const UI_ASSETS: readonly string[] = [
  ...Object.values(UiAsset),
  ...PLANT_TYPES.map(cropIcon),
  ...PLACEABLE_FIXTURES.map(itemIcon),
  ...COIN_TIERS.map(coinIcon),
];

export const UI_SIDECAR_KEY = "ui-index";

export function uiTextureKey(asset: string): string {
  return `ui-${asset}`;
}

export interface NineSliceInsets {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface UiAssetEntry {
  file: string;
  width: number;
  height: number;
  /** Set on the one asset meant to be repeated rather than placed. */
  tiles?: boolean;
  /** Set on the one asset meant to be stretched to a panel's size. */
  nine_slice?: NineSliceInsets;
}

export interface UiIndex {
  assets: Record<string, UiAssetEntry>;
}

export function uiEntry(index: UiIndex | undefined, asset: string): UiAssetEntry {
  const entry = index?.assets?.[asset];
  if (!entry) throw new Error(`ui.json has no entry for "${asset}" — regenerate it`);
  return entry;
}
