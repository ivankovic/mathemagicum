// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

// Standalone billboard sprites (see tools/tileset-gen/src/tileset_gen/
// buildings.py) for PlacedObject types — one per type, `BUILDING_VARIANTS`
// distinct textures each so repeated instances of the same type (e.g. the
// 3 villager houses) don't render identically. Anchored bottom-centre at
// PlacedObject.anchorCol/anchorRow (see objects.ts), same convention as
// plants — not tiled per grid cell like terrain, since a building needs to
// rise above and often overhang its own footprint.
import { OBJECT_COLORS } from "./palette";

export const BUILDING_TYPES: readonly string[] = Object.keys(OBJECT_COLORS);

export const BUILDING_VARIANTS = 4;

// Deterministic per-object variant so the same building always renders the
// same sprite — reloading can't make it flicker to a different look. A
// cheap integer hash, not anything cryptographic; same shape as
// tileset.ts's tileVariantFor, just a distinct pair of constants so the
// two domains don't happen to always pick the same variant index together.
export function buildingVariantFor(col: number, row: number): number {
  const hash = (col * 2246822519 + row * 3266489917) >>> 0;
  return hash % BUILDING_VARIANTS;
}

export function buildingSpriteKey(type: string, variant: number): string {
  return `${type}-${variant}`;
}
