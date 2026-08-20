// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

/**
 * Landmarks: the one-of-a-kind thing at the heart of a place.
 *
 * Neither scenery nor a building, and it needs to be neither. Scenery is one
 * thing per terrain on a single tile, scattered in its thousands; a building
 * has a door you walk through and a room behind it. A landmark is one of a
 * kind, covers several tiles, has no inside, and is the reason to walk
 * somewhere — which is exactly what the enchanted forest was missing.
 *
 * It is also the only thing in the world allowed to stand taller than a
 * building. See the generator's own note: everything that scatters sits
 * under the roofline so that a village reads as the landmark of the map, and
 * one thing at the heart of one place is the exception that makes that rule
 * worth having.
 *
 * There are two kinds. A **grown** landmark — the great tree — may stand
 * with the tallest building but not over it, or a wood would take the
 * village's job of being the landmark of the map. A **built** one — the
 * lighthouse, the town clock — may be the tallest thing there is, because
 * being seen from outside the place is the entire reason somebody put it up.
 * The generator's `test_scale.py` is where that pair of rules is enforced.
 *
 * Each carries its own footprint and canvas in its sidecar rather than
 * sharing a set of constants, which is what lets a wide crown and a narrow
 * tower be the same kind of thing without being the same shape.
 */

export const LandmarkType = {
  /** The tree the enchanted forest grew around, with lights in its crown. */
  GreatTree: "great-tree",
  /** The beacon on the harbour's headland, whose optic turns. */
  Lighthouse: "lighthouse",
  /** The town clock on the city's square, whose hands go round. */
  ClockTower: "clock-tower",
} as const;

export type LandmarkType = (typeof LandmarkType)[keyof typeof LandmarkType];

export const LANDMARK_TYPES: readonly LandmarkType[] = Object.values(LandmarkType);

/**
 * How many cells a landmark stands on, per side.
 *
 * Written here as well as in the sidecar, for the reason the building
 * footprints are duplicated in `buildings.ts`: world generation runs long
 * before any asset is loaded, so the layout has to know how much room a
 * thing takes while it is deciding where to put it. `assets.test.ts` reads
 * the shipped sidecar and fails if the two drift apart.
 */
export const LANDMARK_FOOTPRINT = 2;

export function landmarkSheetKey(landmark: LandmarkType): string {
  return `landmark-${landmark}`;
}

export function landmarkSidecarKey(landmark: LandmarkType): string {
  return `landmark-sidecar-${landmark}`;
}

/** Matches the sidecar's own animation name. */
export function landmarkAnimKey(landmark: LandmarkType): string {
  return `landmark-${landmark}-idle`;
}

/** The landmark a placed object names, or null if it is not one. */
export function landmarkFor(objectType: string): LandmarkType | null {
  return LANDMARK_TYPES.includes(objectType as LandmarkType) ? (objectType as LandmarkType) : null;
}
