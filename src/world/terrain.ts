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

/**
 * Only the sea.
 *
 * Woodland, hilly and mountain are all walkable *ground*. What blocks a
 * woodland tile is the trees standing on it and what blocks a mountain tile
 * is the rock — placed objects with their own footprints (see objects.ts),
 * not the terrain under them.
 *
 * Mountain used to be in here, and playtesting killed it: a whole terrain
 * nobody can set foot on is a third of the map behind glass. High ground
 * should be somewhere you climb to and stand on, with the rock making the
 * going hard in places — not a painted backdrop.
 */
const IMPASSABLE: ReadonlySet<TerrainType> = new Set([TerrainType.Water]);

export function isPassable(terrain: TerrainType): boolean {
  return !IMPASSABLE.has(terrain);
}
