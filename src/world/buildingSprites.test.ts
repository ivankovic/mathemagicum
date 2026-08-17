// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import {
  BUILDING_TYPES,
  BUILDING_VARIANTS,
  buildingSpriteKey,
  buildingVariantFor,
} from "./buildingSprites";
import { OBJECT_COLORS } from "./palette";

describe("BUILDING_TYPES", () => {
  test("matches OBJECT_COLORS' keys exactly", () => {
    expect(new Set(BUILDING_TYPES)).toEqual(new Set(Object.keys(OBJECT_COLORS)));
  });
});

describe("buildingVariantFor", () => {
  test("is deterministic for a given (col, row)", () => {
    expect(buildingVariantFor(7, 12)).toBe(buildingVariantFor(7, 12));
  });

  test("always returns an in-range variant index", () => {
    for (let col = 0; col < 50; col++) {
      for (let row = 0; row < 50; row++) {
        const variant = buildingVariantFor(col, row);
        expect(variant).toBeGreaterThanOrEqual(0);
        expect(variant).toBeLessThan(BUILDING_VARIANTS);
      }
    }
  });
});

describe("buildingSpriteKey", () => {
  test("is the bare '<type>-<variant>' the generator writes to disk", () => {
    expect(buildingSpriteKey("house", 2)).toBe("house-2");
    expect(buildingSpriteKey("post-office", 0)).toBe("post-office-0");
  });
});
