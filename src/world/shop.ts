// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { type FixtureType, PLACEABLE_FIXTURES } from "./fixtures";
import type { Inventory, ItemType } from "./inventory";
import { MATERIAL_TYPES, type MaterialType } from "./materials";
import { PLANT_TYPES, type PlantType } from "./plants";

/**
 * What the village store pays and charges.
 *
 * The design doc's economy is one sentence long — money exists, villagers
 * pay it, the shopkeeper takes it — so this is the first place any number
 * has had to be chosen. Two rules keep those numbers from being arbitrary:
 *
 * **Every crop is worth the same.** Not because that is obviously right,
 * but because nothing today makes one crop harder to grow than another:
 * each takes one planting and two casts, and they differ only in which
 * terrain accepts them. Pricing them apart would be inventing a difficulty
 * that the game does not have. When crops differ, so can their prices.
 *
 * **Everything for sale is priced in crops, not in coins.** `2` below means
 * "two harvests", and the coin figure falls out of that. A player who wants
 * a lamp can count what it costs in the units they actually earn, and a
 * later change to what a crop is worth cannot silently make the whole shop
 * cheap or unaffordable.
 *
 * Nothing here is scarcity: crops regrow, seeds stay free, and there is no
 * cap on either coins or stock. The store is somewhere for the work to go,
 * not a gate — see GAME_DESIGN.md's pillars.
 */

/**
 * What one harvested crop fetches, in rays — the money's minor unit, and
 * what everything else here is quoted in.
 *
 * 2.50 rather than a round 1.00 or 5.00 on purpose: a price that is a whole
 * number of the largest coin can be paid with one coin and teaches nothing.
 * This one takes three, and two of them are not the same.
 */
export const CROP_PRICE = 250;

/**
 * What a crop fetches for the child currently playing.
 *
 * A parameter now rather than the constant above, because a six-year-old
 * counting out 2,50 is counting the wrong thing: the gentlest setting quotes
 * a crop at a whole sun so the money is money rather than a second puzzle
 * (see src/spells/difficulty.ts).
 *
 * What it emphatically does *not* do is change what anything is worth.
 * Everything the store sells is priced in *crops* — a fence is two harvests
 * at every setting — so quoting a crop differently rescales both sides of
 * every trade at once and the economy is identical. That is deliberate: the
 * moment easier sums earned less, the game would be telling a struggling
 * child they are worth less.
 */
export type CropPrice = number;

/**
 * The most of one thing that changes hands in a single trade.
 *
 * A counting limit, not a purse one: past a handful of items the sum stops
 * being arithmetic a child does in their head and becomes bookkeeping, and
 * the shopkeeper's payment has to stay countable on the counter.
 */
export const MAX_TRADE = 10;

/** What the store stocks, priced in crops. */
const COST_IN_CROPS: Record<FixtureType, number> = {
  well: Number.POSITIVE_INFINITY, // not for sale; the village has the one
  // The gate used to be world generation's alone. It is a player's now: a
  // child who can fence a plot needs the way in, and a fenced garden with no
  // gate is a child walled out of their own carrots.
  gate: 3,
  "fence-side": Number.POSITIVE_INFINITY, // the same fence, the world's copy
  "fence-corner": Number.POSITIVE_INFINITY, // and its corner
  "gate-side": Number.POSITIVE_INFINITY, // and the gate that stands in it
  "gate-side-lower": Number.POSITIVE_INFINITY, // and its other end
  glowcap: Number.POSITIVE_INFINITY, // the forest's, and it would not glow anywhere else
  "forest-vine": Number.POSITIVE_INFINITY, // the forest's own growth, and the tree's border
  "forest-vine-side": Number.POSITIVE_INFINITY,
  "forest-vine-corner": Number.POSITIVE_INFINITY,
  "forest-vine-corner-up": Number.POSITIVE_INFINITY,
  stall: Number.POSITIVE_INFINITY, // the market's, and it belongs to the market
  // The city's ring wall and the way through it. Not for sale for the reason
  // the well is not: it is a piece of a place rather than a thing somebody
  // owns, and a child who could buy a length of city wall could wall their
  // own garden in with it.
  "city-wall": Number.POSITIVE_INFINITY,
  "city-wall-side": Number.POSITIVE_INFINITY,
  "city-gate": Number.POSITIVE_INFINITY,
  "city-gate-side": Number.POSITIVE_INFINITY,
  fence: 2,
  table: 5,
  lamp: 8,
  // The three that do nothing. Priced under the lamp, because what they buy
  // is a garden that looks like somebody's rather than a light to work by —
  // and a child should be able to have one before they have saved for weeks.
  bench: 4,
  scarecrow: 3,
  flowerpot: 2,
};

export const SHOP_STOCK: readonly FixtureType[] = PLACEABLE_FIXTURES;

export function priceOf(fixture: FixtureType, cropPrice: CropPrice = CROP_PRICE): number {
  const crops = COST_IN_CROPS[fixture];
  if (!Number.isFinite(crops)) throw new Error(`${fixture} is not for sale`);
  return crops * cropPrice;
}

/**
 * What the store pays for one of an item, or 0 if it does not want it.
 *
 * Not `valueOf`, which every object already has: a free function with that
 * name is one import away from being mistaken for the built-in.
 */
export function sellPriceOf(item: ItemType, cropPrice: CropPrice = CROP_PRICE): number {
  const sold =
    (PLANT_TYPES as readonly string[]).includes(item) ||
    (MATERIAL_TYPES as readonly string[]).includes(item);
  return sold ? cropPrice : 0;
}

/**
 * Whether the store wants it.
 *
 * Crops and materials, at the same price. Wood being worth what a carrot is
 * looks generous beside the work — three actions for a crop against one cast
 * for two logs — and it is generous on purpose: subtraction is the spell this
 * game under-uses, and paying for it is the plainest way to have it
 * practised. It cannot be farmed either. Nothing regrows, so a child who
 * clears everything within reach is a child back in the garden.
 */
export function isSellable(item: ItemType): item is PlantType | MaterialType {
  return sellPriceOf(item) > 0;
}

/**
 * The player's coins.
 *
 * Its own small class rather than a number on the scene, so that "you cannot
 * spend what you do not have" is stated once and cannot be forgotten by the
 * second thing that spends.
 */
export class Purse {
  private amount = 0;

  get coins(): number {
    return this.amount;
  }

  earn(amount: number): number {
    if (!Number.isInteger(amount) || amount <= 0) return this.amount;
    this.amount += amount;
    return this.amount;
  }

  canAfford(amount: number): boolean {
    return Number.isInteger(amount) && amount >= 0 && this.amount >= amount;
  }

  /** All or nothing, so nothing can be half-paid-for. */
  spend(amount: number): boolean {
    if (!this.canAfford(amount)) return false;
    this.amount -= amount;
    return true;
  }
}

export interface Trade {
  readonly ok: boolean;
  /** What changed hands, in minor units. */
  readonly amount: number;
}

/**
 * Sell some crops.
 *
 * No message: what the shopkeeper says about a sale now depends on whether
 * she counted it out correctly and on what the player answered, which is the
 * minigame's business rather than the ledger's. See src/shop/payment.ts.
 */
export function sellCrops(
  inventory: Inventory,
  purse: Purse,
  item: ItemType,
  count: number,
  cropPrice: CropPrice = CROP_PRICE,
): Trade {
  const unit = sellPriceOf(item, cropPrice);
  if (unit <= 0 || !Number.isInteger(count) || count <= 0) return { ok: false, amount: 0 };
  if (!inventory.remove(item, count)) return { ok: false, amount: 0 };
  const earned = unit * count;
  purse.earn(earned);
  return { ok: true, amount: earned };
}

/**
 * Buy some stock, having already counted the money out.
 *
 * The caller is the tender minigame, which only lets this be reached once
 * the coins on the counter come to exactly `priceOf(fixture) * count` — so
 * the purse check here is a backstop rather than the gate.
 */
export function buyStock(
  inventory: Inventory,
  purse: Purse,
  fixture: FixtureType,
  count: number,
  cropPrice: CropPrice = CROP_PRICE,
): Trade {
  if (!Number.isInteger(count) || count <= 0) return { ok: false, amount: 0 };
  const price = priceOf(fixture, cropPrice) * count;
  if (!purse.spend(price)) return { ok: false, amount: 0 };
  inventory.add(fixture, count);
  return { ok: true, amount: price };
}
