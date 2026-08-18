// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

// The terrain vocabulary is the asset generator's, not ours: these strings
// are the ones that appear in atlas frame names (see terrainAtlas.ts), so
// renaming one here silently stops the tile it names from resolving. The
// declaration order matches the generator's PRIORITY tuple — nothing in the
// game depends on that order, but keeping it makes the two lists diffable.
export const TerrainType = {
  Water: "water",
  Sand: "sand",
  Dirt: "dirt",
  Grass: "grass",
  Woodland: "woodland",
  Hilly: "hilly",
  Mountain: "mountain",
  // Laid stone, not grown ground: the village square. Last in the list
  // because it is last in the generator's PRIORITY — wherever cobbles meet
  // anything, theirs is the edge that reads, since a paved square with a
  // grass lip over it would look like the grass was winning.
  Cobble: "cobble",
} as const;

export type TerrainType = (typeof TerrainType)[keyof typeof TerrainType];

export const TERRAIN_TYPES: readonly TerrainType[] = Object.values(TerrainType);

// Woodland and Hilly are walkable ground, not obstacles: the things that
// actually block a woodland tile are the trees standing on it, which are
// placed objects with their own footprints (see objects.ts), not the terrain.
const IMPASSABLE: ReadonlySet<TerrainType> = new Set([TerrainType.Water, TerrainType.Mountain]);

export function isPassable(terrain: TerrainType): boolean {
  return !IMPASSABLE.has(terrain);
}
