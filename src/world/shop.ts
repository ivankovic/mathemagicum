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

/** What one harvested crop fetches. The unit everything else is quoted in. */
export const CROP_PRICE = 5;

/** What the store stocks, priced in crops. */
const COST_IN_CROPS: Record<FixtureType, number> = {
  well: Number.POSITIVE_INFINITY, // not for sale; the village has the one
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
  readonly message: string;
}

/**
 * Sell one of something.
 *
 * One unit per call rather than a sell-everything: `remove` is all-or-
 * nothing and reads well for one, and a sell-all button next to a per-unit
 * buy would be two interaction models in one panel.
 */
export function sellOne(inventory: Inventory, purse: Purse, item: ItemType): Trade {
  const price = sellPriceOf(item);
  if (price <= 0) return { ok: false, message: `The shopkeeper has no use for a ${item}` };
  if (!inventory.remove(item, 1)) return { ok: false, message: `You have no ${item} to sell` };
  const coins = purse.earn(price);
  return { ok: true, message: `Sold a ${item} for ${price} — you have ${coins} coins` };
}

/** Buy one of something. Refuses rather than going into debt. */
export function buyOne(inventory: Inventory, purse: Purse, fixture: FixtureType): Trade {
  const price = priceOf(fixture);
  if (!purse.spend(price)) {
    return {
      ok: false,
      message: `A ${fixture} costs ${price} — you have ${purse.coins}`,
    };
  }
  const held = inventory.add(fixture, 1);
  return { ok: true, message: `Bought a ${fixture} — you have ${held}, and ${purse.coins} coins` };
}
