// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { type FixtureType, PLACEABLE_FIXTURES } from "./fixtures";
import { PLANT_TYPES, type PlantType } from "./plants";

/**
 * What the player is carrying.
 *
 * Deliberately a count per item and nothing else — no slots, no stack size,
 * no weight. Those are scarcity mechanics, and the design doc rules out
 * artificial scarcity: a basket that fills up would turn "help a villager"
 * into "walk home first", which is the sort of friction that exists to pad
 * a session rather than to teach anything.
 *
 * Nothing here tells anything that it changed. Whatever mutates an inventory
 * owns refreshing what displays it — the basket's count badges are painted
 * when its tray opens and again when the scene says so, and a future spell or
 * villager reward that adds to this without saying so will leave a stale
 * number under the player's thumb. Watching for that from in here would mean
 * this class knowing about the interface, which is the wrong way round.
 *
 * Items are crops she has picked and fixtures she has bought. `ItemType` was
 * a separate name from `PlantType` from the start so the first non-crop item
 * would not have to be pretended into the plant list, which is exactly what
 * the village store turned out to sell.
 */

export type ItemType = PlantType | FixtureType;

export const ITEM_TYPES: readonly ItemType[] = [...PLANT_TYPES, ...PLACEABLE_FIXTURES];

export class Inventory {
  // Sparse: a player carrying two kinds of thing has two entries, not one
  // per item that exists. Absent and zero mean the same thing, and `add`
  // never stores a zero, so `size` is the number of *kinds* carried.
  private readonly counts = new Map<ItemType, number>();

  /** How many of one item is carried. */
  count(item: ItemType): number {
    return this.counts.get(item) ?? 0;
  }

  /** Everything carried, in a stable order, skipping what is not. */
  entries(): readonly (readonly [ItemType, number])[] {
    return ITEM_TYPES.filter((item) => this.count(item) > 0).map(
      (item) => [item, this.count(item)] as const,
    );
  }

  /** How many things are carried in total, counting duplicates. */
  get total(): number {
    let sum = 0;
    for (const value of this.counts.values()) sum += value;
    return sum;
  }

  /** How many *kinds* of thing are carried. */
  get kinds(): number {
    return this.counts.size;
  }

  get isEmpty(): boolean {
    return this.counts.size === 0;
  }

  /**
   * Put `amount` of an item in. Returns the new count.
   *
   * Rejects zero and negatives rather than quietly treating `add(-1)` as a
   * removal: taking things out is `remove`, and an `add` that could subtract
   * is a bug waiting for a caller that forgot to clamp.
   */
  add(item: ItemType, amount = 1): number {
    if (!Number.isInteger(amount) || amount <= 0) return this.count(item);
    const next = this.count(item) + amount;
    this.counts.set(item, next);
    return next;
  }

  /**
   * Take `amount` out, but only if there is that much. Returns whether it
   * happened — all or nothing, so a caller cannot half-spend something.
   */
  remove(item: ItemType, amount = 1): boolean {
    if (!Number.isInteger(amount) || amount <= 0) return false;
    const held = this.count(item);
    if (held < amount) return false;
    const left = held - amount;
    // Deleted rather than left at zero, so `entries` and `kinds` mean what
    // they say without every reader having to filter.
    if (left === 0) this.counts.delete(item);
    else this.counts.set(item, left);
    return true;
  }
}
