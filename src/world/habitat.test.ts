// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import { HABITAT_DEFINITIONS, Habitat, sampleTerrain } from "./habitat";
import { createRng } from "./rng";
import { TerrainType } from "./terrain";

describe("HABITAT_DEFINITIONS", () => {
  test("every habitat's weights sum to a positive number", () => {
    for (const habitat of Object.values(Habitat)) {
      const total = [...HABITAT_DEFINITIONS[habitat].terrainWeights.values()].reduce(
        (sum, w) => sum + w,
        0,
      );
      expect(total).toBeGreaterThan(0);
    }
  });
});

describe("sampleTerrain", () => {
  test("a single-terrain habitat always returns that terrain", () => {
    const rng = createRng(1);
    for (let i = 0; i < 50; i++) {
      expect(sampleTerrain(Habitat.Meadow, rng)).toBe(TerrainType.Grass);
    }
  });

  test("only ever returns terrain types the habitat actually lists", () => {
    const rng = createRng(2);
    const allowed = [...HABITAT_DEFINITIONS[Habitat.Coastal].terrainWeights.keys()];
    for (let i = 0; i < 200; i++) {
      expect(allowed).toContain(sampleTerrain(Habitat.Coastal, rng));
    }
  });

  test("a mixed habitat produces more than one terrain type over many samples", () => {
    const rng = createRng(3);
    const seen = new Set<TerrainType>();
    for (let i = 0; i < 200; i++) {
      seen.add(sampleTerrain(Habitat.Wetland, rng));
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  test("the same seed produces the same terrain sequence", () => {
    const rngA = createRng(99);
    const rngB = createRng(99);
    const seqA = Array.from({ length: 30 }, () => sampleTerrain(Habitat.Highland, rngA));
    const seqB = Array.from({ length: 30 }, () => sampleTerrain(Habitat.Highland, rngB));
    expect(seqA).toEqual(seqB);
  });
});
