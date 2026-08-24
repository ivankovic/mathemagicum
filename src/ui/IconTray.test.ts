// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import { type Slot, badgeLabel, traySlots } from "./IconTray";

// IconTray itself needs a live Phaser scene, but the one rule in it that can
// be wrong without anything on screen looking broken is what a badge says.
describe("badgeLabel", () => {
  test("shows a plain count", () => {
    expect(badgeLabel(1)).toBe("1");
    expect(badgeLabel(7)).toBe("7");
    expect(badgeLabel(42)).toBe("42");
  });

  // An empty slot should read as empty. A "0" badge is a label saying so,
  // which is more ink for less meaning.
  test("shows nothing at all for none", () => {
    expect(badgeLabel(0)).toBe(null);
    expect(badgeLabel(-3)).toBe(null);
  });

  test("stops at two digits rather than overflowing the corner", () => {
    expect(badgeLabel(99)).toBe("99");
    expect(badgeLabel(100)).toBe("99+");
    expect(badgeLabel(4000)).toBe("99+");
  });

  // The purse asks for three, and it is the only thing that does. A basket
  // past ninety-nine carrots is a basket where the exact number has stopped
  // mattering; ninety-nine ducats is an afternoon's harvesting, and a purse
  // stuck at "99+" from then on would hide the one count it exists to show.
  test("but counts further where a caller says it must", () => {
    expect(badgeLabel(100, 999)).toBe("100");
    expect(badgeLabel(999, 999)).toBe("999");
    expect(badgeLabel(1000, 999)).toBe("999+");
    expect(badgeLabel(250_000, 999)).toBe("999+");
  });

  test("and still says nothing for an empty purse", () => {
    expect(badgeLabel(0, 999)).toBe(null);
  });

  // Nothing produces a fraction today, but a badge is a corner two
  // characters wide and "1.5" does not fit in it.
  test("never renders a fraction", () => {
    expect(badgeLabel(2.7)).toBe("2");
    expect(badgeLabel(0.4)).toBe(null);
  });

  test("survives nonsense rather than drawing it", () => {
    expect(badgeLabel(Number.NaN)).toBe(null);
    expect(badgeLabel(Number.POSITIVE_INFINITY)).toBe(null);
  });
});

/**
 * Where the things in a tray sit.
 *
 * The rule that broke without anything looking broken: the crate grew from
 * seven things to twelve, kept stacking them in one column, and the top two
 * ended up above the screen. A button nobody can reach is a button that does
 * nothing, and that is how it was reported.
 */
describe("traySlots", () => {
  test("stacks straight up while one column will hold them", () => {
    const slots = traySlots(6, 10);
    expect(slots.map((s) => s.column)).toEqual([0, 0, 0, 0, 0, 0]);
    expect(slots.map((s) => s.row)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  // The bug, stated as a rule: nothing may be placed past the room there is.
  test("never puts anything past the room it was given", () => {
    for (let room = 1; room <= 12; room++) {
      for (let count = 1; count <= 24; count++) {
        for (const slot of traySlots(count, room)) {
          expect({ room, count, within: slot.row <= room }).toEqual({
            room,
            count,
            within: true,
          });
        }
      }
    }
  });

  test("wraps leftward into as few columns as will do", () => {
    // Twelve things in a column that holds ten: two columns, not one.
    const slots = traySlots(12, 10);
    expect(new Set(slots.map((s) => s.column)).size).toBe(2);
    expect(Math.max(...slots.map((s) => s.column))).toBe(1);
  });

  // Eleven and a lonely one reads as a mistake; six and six reads as a tray.
  test("shares them out between the columns rather than spilling", () => {
    for (let room = 2; room <= 12; room++) {
      for (let count = 1; count <= 24; count++) {
        const perColumn = new Map<number, number>();
        for (const slot of traySlots(count, room)) {
          perColumn.set(slot.column, (perColumn.get(slot.column) ?? 0) + 1);
        }
        const sizes = [...perColumn.values()];
        expect({ room, count, spread: Math.max(...sizes) - Math.min(...sizes) <= 1 }).toEqual({
          room,
          count,
          spread: true,
        });
      }
    }
  });

  test("gives every item exactly one place, and no two the same", () => {
    for (let count = 1; count <= 24; count++) {
      const slots = traySlots(count, 5);
      expect(slots.length).toBe(count);
      const seen = new Set(slots.map((s: Slot) => `${s.column},${s.row}`));
      expect(seen.size).toBe(count);
    }
  });

  test("an empty tray has nowhere to put anything", () => {
    expect(traySlots(0, 6)).toEqual([]);
    expect(traySlots(-2, 6)).toEqual([]);
  });

  // A viewport can be short enough that nothing sensible fits. It must still
  // return a place for everything rather than dividing by zero.
  test("survives a screen with no room at all", () => {
    const slots = traySlots(4, 0);
    expect(slots.length).toBe(4);
    expect(slots.every((s) => s.row >= 1)).toBe(true);
  });
});
