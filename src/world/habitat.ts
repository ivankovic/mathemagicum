// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { TerrainType } from "./terrain";

// A habitat describes a *region*, not a single tile: which terrain types
// appear there and how often. See docs/WORLD_GENERATION.md — habitat and
// terrain are deliberately separate; a Woodland tile is still Grass
// terrain underneath, it just has (eventually) tree decoration on it.
// Decoration is not implemented yet, so for now a habitat is purely a
// terrain-weight distribution.
export const Habitat = {
  Meadow: "meadow",
  Woodland: "woodland",
  Wetland: "wetland",
  Coastal: "coastal",
  Highland: "highland",
} as const;

export type Habitat = (typeof Habitat)[keyof typeof Habitat];

interface HabitatDefinition {
  // ORDER IS SIGNIFICANT, low ground first. The fill reads a smooth
  // elevation field and cuts it at these weights in order, so the first
  // entry is what fills the hollows and the last is what caps the rises.
  // Reordering a habitat's entries moves its terrain around the map.
  readonly terrainWeights: ReadonlyMap<TerrainType, number>;
}

function weights(
  entries: readonly (readonly [TerrainType, number])[],
): ReadonlyMap<TerrainType, number> {
  return new Map(entries);
}

export const HABITAT_DEFINITIONS: Record<Habitat, HabitatDefinition> = {
  [Habitat.Meadow]: { terrainWeights: weights([[TerrainType.Grass, 1]]) },
  // Woodland finally has a terrain of its own. It stays mostly Woodland with
  // Grass mixed in rather than being pure, so the region reads as a wood with
  // clearings instead of a flat green slab — and so the boundary between the
  // two is drawn by the tileset rather than by the habitat's outline.
  [Habitat.Woodland]: {
    terrainWeights: weights([
      [TerrainType.Grass, 0.25],
      [TerrainType.Woodland, 0.75],
    ]),
  },
  [Habitat.Wetland]: {
    terrainWeights: weights([
      [TerrainType.Water, 0.5],
      [TerrainType.Grass, 0.5],
    ]),
  },
  [Habitat.Coastal]: {
    terrainWeights: weights([
      [TerrainType.Water, 0.3],
      [TerrainType.Sand, 0.7],
    ]),
  },
  // Mostly walkable Hilly with impassable Mountain peaks through it: a
  // highland the player can cross but has to route around, rather than a
  // wall. Dirt is the bare ground between.
  [Habitat.Highland]: {
    terrainWeights: weights([
      [TerrainType.Dirt, 0.2],
      [TerrainType.Hilly, 0.55],
      [TerrainType.Mountain, 0.25],
    ]),
  },
};

/**
 * The terrain a habitat puts at a given height, where `elevation` is a
 * position in [0, 1) within the habitat's own range — 0 its lowest ground,
 * 1 its highest.
 *
 * This replaced a per-tile weighted roll. The weights are unchanged and mean
 * the same thing about *area*, but reading them as bands of a smooth field
 * rather than as odds is what turns a wetland into ponds instead of static:
 * neighbouring tiles get nearly the same elevation, so they land in the same
 * band.
 */
export function terrainAtElevation(habitat: Habitat, elevation: number): TerrainType {
  const entries = [...HABITAT_DEFINITIONS[habitat].terrainWeights.entries()];
  const last = entries[entries.length - 1];
  if (!last) throw new Error(`Habitat "${habitat}" has no terrain weights`);
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let cursor = elevation * total;
  for (const [terrain, weight] of entries) {
    cursor -= weight;
    // Strictly less, so a band of weight 0 can never claim a tile.
    if (cursor < 0) return terrain;
  }
  return last[0];
}
