// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import { badgeLabel } from "./IconTray";

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
