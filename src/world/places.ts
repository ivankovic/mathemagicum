// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import type { AnchorPlacements } from "./anchors";

/**
 * The five places worth naming, as names.
 *
 * A list rather than a derivation from a placed world, because a save has to
 * be read back before any world exists: the profile store runs at the
 * who's-playing screen, and there is no grid yet. `AnchorPlacements` is what
 * keeps the two honest — the type below fails to compile the moment a sixth
 * anchor is added and not named here.
 */
export type PlaceName = keyof AnchorPlacements;

export const PLACE_NAMES: readonly PlaceName[] = [
  "village",
  "harbour",
  "bigCity",
  "observatory",
  "enchantedForest",
];

/** Where every child starts, and the one place they have always been. */
export const HOME_PLACE: PlaceName = "village";
