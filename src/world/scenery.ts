// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { TerrainType } from "./terrain";

// Impassable natural objects — the trees, spires and boulders the ground
// grows. The generator ships one per terrain (see its "Objects and
// buildings"), so which one appears is decided by what it is standing on
// rather than chosen: conifers in woodland, rock in the mountains.

const SCENERY_PREFIX = "scenery-";

// Keyed by terrain, and the value is the generator's own name for that
// object's sheet. Water is absent on purpose: it already blocks, and a
// boulder in the sea is not a barrier but a mistake.
export const SCENERY_FOR_TERRAIN: Partial<Record<TerrainType, string>> = {
  [TerrainType.Mountain]: "mountain",
  [TerrainType.Hilly]: "hilly",
  [TerrainType.Woodland]: "woodland",
  [TerrainType.Grass]: "grass",
  [TerrainType.Sand]: "sand",
  [TerrainType.Dirt]: "dirt",
};

export const SCENERY_KINDS: readonly string[] = Object.values(SCENERY_FOR_TERRAIN).filter(
  (kind): kind is string => kind !== undefined,
);

export function sceneryOn(terrain: TerrainType): string | undefined {
  return SCENERY_FOR_TERRAIN[terrain];
}

/** The scenery kind a placed object names, or null if it is not scenery. */
export function sceneryKind(objectType: string): string | null {
  return objectType.startsWith(SCENERY_PREFIX) ? objectType.slice(SCENERY_PREFIX.length) : null;
}

export function sceneryType(kind: string): string {
  return `${SCENERY_PREFIX}${kind}`;
}

export function scenerySheetKey(kind: string): string {
  return `scenery-sheet-${kind}`;
}

export function scenerySidecarKey(kind: string): string {
  return `scenery-sidecar-${kind}`;
}

// Matches the sidecar's own animation naming: `instance_N`.
export function sceneryAnimKey(kind: string, instance: number): string {
  return `scenery-anim-${kind}-${instance}`;
}
