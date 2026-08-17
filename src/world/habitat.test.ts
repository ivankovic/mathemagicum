// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import { HABITAT_DEFINITIONS, Habitat, terrainAtElevation } from "./habitat";
import { TerrainType } from "./terrain";

const HABITATS = Object.values(Habitat);

describe("HABITAT_DEFINITIONS", () => {
  test("every habitat's weights sum to a positive number", () => {
    for (const habitat of HABITATS) {
      const total = [...HABITAT_DEFINITIONS[habitat].terrainWeights.values()].reduce(
        (sum, w) => sum + w,
        0,
      );
      expect(total).toBeGreaterThan(0);
    }
  });

  test("no habitat lists a terrain twice or with a non-positive weight", () => {
    for (const habitat of HABITATS) {
      for (const weight of HABITAT_DEFINITIONS[habitat].terrainWeights.values()) {
        expect(weight).toBeGreaterThan(0);
      }
    }
  });

  test("water is listed first wherever it appears", () => {
    // The fill reads these as elevation bands, low ground first. Water above
    // anything else would put lakes on the hilltops.
    for (const habitat of HABITATS) {
      const terrains = [...HABITAT_DEFINITIONS[habitat].terrainWeights.keys()];
      const index = terrains.indexOf(TerrainType.Water);
      if (index >= 0) expect(index).toBe(0);
    }
  });

  test("mountain is listed last wherever it appears", () => {
    for (const habitat of HABITATS) {
      const terrains = [...HABITAT_DEFINITIONS[habitat].terrainWeights.keys()];
      const index = terrains.indexOf(TerrainType.Mountain);
      if (index >= 0) expect(index).toBe(terrains.length - 1);
    }
  });
});

describe("terrainAtElevation", () => {
  test("a single-terrain habitat returns that terrain at every height", () => {
    for (let i = 0; i <= 20; i++) {
      expect(terrainAtElevation(Habitat.Meadow, i / 20)).toBe(TerrainType.Grass);
    }
  });

  test("only ever returns terrain the habitat lists", () => {
    for (const habitat of HABITATS) {
      const allowed = [...HABITAT_DEFINITIONS[habitat].terrainWeights.keys()];
      for (let i = 0; i <= 40; i++) {
        expect(allowed).toContain(terrainAtElevation(habitat, i / 40));
      }
    }
  });

  test("is monotonic — a band is one contiguous run of heights", () => {
    // What makes the result coherent: if a terrain could reappear higher up,
    // neighbouring tiles at similar elevation would not share terrain.
    for (const habitat of HABITATS) {
      const seen: TerrainType[] = [];
      for (let i = 0; i <= 200; i++) {
        const terrain = terrainAtElevation(habitat, i / 200);
        if (seen[seen.length - 1] !== terrain) seen.push(terrain);
      }
      expect(new Set(seen).size).toBe(seen.length);
    }
  });

  test("gives each terrain a share of the range matching its weight", () => {
    // The weights still describe area; only their meaning changed from odds
    // to bands. A drift here would silently rebalance every region.
    const samples = 2000;
    for (const habitat of HABITATS) {
      const weights = HABITAT_DEFINITIONS[habitat].terrainWeights;
      const total = [...weights.values()].reduce((sum, w) => sum + w, 0);
      const counts = new Map<TerrainType, number>();
      for (let i = 0; i < samples; i++) {
        const terrain = terrainAtElevation(habitat, i / samples);
        counts.set(terrain, (counts.get(terrain) ?? 0) + 1);
      }
      for (const [terrain, weight] of weights) {
        const share = (counts.get(terrain) ?? 0) / samples;
        expect(Math.abs(share - weight / total)).toBeLessThan(0.01);
      }
    }
  });

  test("the extremes of the range are the first and last bands", () => {
    for (const habitat of HABITATS) {
      const terrains = [...HABITAT_DEFINITIONS[habitat].terrainWeights.keys()];
      expect(terrainAtElevation(habitat, 0)).toBe(terrains[0] as TerrainType);
      expect(terrainAtElevation(habitat, 0.999)).toBe(terrains[terrains.length - 1] as TerrainType);
    }
  });

  test("an elevation of exactly 1 still returns a listed terrain", () => {
    for (const habitat of HABITATS) {
      const allowed = [...HABITAT_DEFINITIONS[habitat].terrainWeights.keys()];
      expect(allowed).toContain(terrainAtElevation(habitat, 1));
    }
  });
});
