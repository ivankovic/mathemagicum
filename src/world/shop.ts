// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { type FixtureType, PLACEABLE_FIXTURES } from "./fixtures";
import type { Inventory, ItemType } from "./inventory";
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
 * What one harvested crop fetches, in the currency's minor unit — lipa or
 * rappen. The unit everything else is quoted in.
 *
 * 2.50 rather than a round 1.00 or 5.00 on purpose: a price that is a whole
 * number of the largest coin can be paid with one coin and teaches nothing.
 * This one takes three, and two of them are not the same.
 */
export const CROP_PRICE = 250;

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
  gate: Number.POSITIVE_INFINITY, // nor is this: it belongs to a garden wall
  "fence-side": Number.POSITIVE_INFINITY, // the same fence, the world's copy
  fence: 2,
  table: 5,
  lamp: 8,
};

export const SHOP_STOCK: readonly FixtureType[] = PLACEABLE_FIXTURES;

export function priceOf(fixture: FixtureType): number {
  const crops = COST_IN_CROPS[fixture];
  if (!Number.isFinite(crops)) throw new Error(`${fixture} is not for sale`);
  return crops * CROP_PRICE;
}

/**
 * What the store pays for one of an item, or 0 if it does not want it.
 *
 * Not `valueOf`, which every object already has: a free function with that
 * name is one import away from being mistaken for the built-in.
 */
export function sellPriceOf(item: ItemType): number {
  return (PLANT_TYPES as readonly string[]).includes(item) ? CROP_PRICE : 0;
}

export function isSellable(item: ItemType): item is PlantType {
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
): Trade {
  const unit = sellPriceOf(item);
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
): Trade {
  if (!Number.isInteger(count) || count <= 0) return { ok: false, amount: 0 };
  const price = priceOf(fixture) * count;
  if (!purse.spend(price)) return { ok: false, amount: 0 };
  inventory.add(fixture, count);
  return { ok: true, amount: price };
}
