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

import { LANGUAGES, type Language } from "../settings";
import { CURRENCY } from "../shop/currency";
import { type FixtureType, PLACEABLE_FIXTURES } from "../world/fixtures";
import { FLOWER_TYPES, type FlowerType } from "../world/flowers";
import { MATERIAL_TYPES, type MaterialType } from "../world/materials";
import { PLANT_TYPES, type PlantType } from "../world/plants";

export const UiAsset = {
  ParchmentFill: "parchment-fill",
  ParchmentFrame: "parchment-frame",
  Spellbook: "spellbook",
  RuneAdd: "rune-add",
  /** The subtraction spell's rune: the plus with one bar taken away. */
  RuneMinus: "rune-minus",
  /** The portal spell's rune: a pair of dividers, the instrument of measuring. */
  RunePortal: "rune-portal",
  /**
   * The multiplication spell's rune: six dots in two rows of three.
   *
   * Not a cross. A saltire is the plus turned forty-five degrees, and at
   * this size on a phone that is the addition rune drawn twice — so this one
   * leaves the operator signs alone and shows the array itself.
   */
  RuneTimes: "rune-times",
  /**
   * The hourglass spell's rune: an hourglass, half run through.
   *
   * The instrument rather than the effect, as the dividers are. A clock face
   * would be the obvious drawing and it is the *question* the spell asks,
   * not the spell — which is time passing, and an hourglass is the one
   * object that is only ever about that.
   */
  RuneHourglass: "rune-hourglass",
  /** The mirror spell: a shape and the fold down the middle of it. */
  RuneMirror: "rune-mirror",
  SeedPouch: "seed-pouch",
  Basket: "basket",
  Crate: "crate",
  /** The map hanging on the tower's wall — the object, not the world it shows. */
  MapWall: "map-wall",
  /**
   * The chart of the night on the dome's wall — the tower's map, one storey
   * further up the world.
   *
   * Same frame and same proportions on purpose: a child who has learned that
   * a framed thing on a wall can be tapped should not have to learn it
   * twice, and what tells the two apart is that one is a coast and the other
   * is a sky.
   */
  StarChart: "star-chart",
  /**
   * The cloud an animal thinks in: a slot for a food, and a question mark.
   *
   * Interface art, but drawn into the *world* layer rather than over it — it
   * belongs to a chicken and has to slide with the camera and sort against
   * what is standing in front of it.
   */
  ThoughtBubble: "thought-bubble",
  /** What goes in it while an animal is asking: a crop, then this. */
  MarkQuestion: "mark-question",
  /** And what goes in it for a moment after it has been fed. */
  MarkGlad: "mark-glad",
  /** The two halves of *are you sure*, for the one thing that asks twice. */
  MarkYes: "mark-yes",
  MarkNo: "mark-no",
} as const;

export type UiAsset = (typeof UiAsset)[keyof typeof UiAsset];

/** The icon for a crop, as it appears in the seed pouch and the basket. */
export function cropIcon(plant: PlantType): string {
  return `crop-${plant}`;
}

/**
 * The face of a coin: one picture for each one there is.
 *
 * It used to be one per *metal*, three of them, on the argument that the
 * value was written on the button beside the icon. Money is laid out on a
 * table now and there is no room beside a coin for a caption — so with four
 * coins and three metals, two came out the same gold at the same size, which
 * is one coin as far as a glance is concerned.
 */
export function coinIcon(value: number): string {
  return `coin-${value}`;
}

/** The icon for something the store sells, as it appears in the crate. */
export function itemIcon(fixture: FixtureType): string {
  return `item-${fixture}`;
}

/**
 * The button for one flower.
 *
 * Its own naming rather than `itemIcon`'s, because a flower is not an item:
 * nothing sells one and nothing carries one. What it shares with a crop is
 * that it goes in the seed pouch, which is why it is drawn to be told apart
 * from one.
 */
export function flowerIcon(flower: FlowerType): string {
  return `flower-${flower}`;
}

/**
 * The flag that stands for a language.
 *
 * The chooser is the one screen a child meets before they can read the
 * screen it is on: "English" and "Deutsch" are two words in two alphabets,
 * and a five-year-old may know neither. A flag is the one picture that means
 * a language to somebody who cannot read its name.
 *
 * By language code rather than by country, because that is what is being
 * chosen. That the picture is a country's flag is a convention this game is
 * borrowing, not a claim about who speaks what.
 */
export function flagIcon(language: Language): string {
  return `flag-${language}`;
}

/** And for what the world gives up when it is cleared. */
export function materialIcon(material: MaterialType): string {
  return `material-${material}`;
}

// The crop icons are per-plant rather than named one by one, which is what
// keeps them in step: adding a crop to PLANT_TYPES asks the loader for an
// icon that has to exist, and `uiEntry` throws by name if the generator has
// not been re-run. The generator has the mirror image of this check.
export const UI_ASSETS: readonly string[] = [
  ...Object.values(UiAsset),
  ...PLANT_TYPES.map(cropIcon),
  ...PLACEABLE_FIXTURES.map(itemIcon),
  ...FLOWER_TYPES.map(flowerIcon),
  ...CURRENCY.denominations.map(coinIcon),
  ...MATERIAL_TYPES.map(materialIcon),
  ...LANGUAGES.map(flagIcon),
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
