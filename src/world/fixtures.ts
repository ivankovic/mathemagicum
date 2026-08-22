// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

// Built props that are not buildings — a well is furniture for a village
// square, not architecture. See the asset generator's "Fixtures".

export const FixtureType = {
  Well: "well",
  Fence: "fence",
  Table: "table",
  Lamp: "lamp",
  /** A garden bench: the table with a back, which is what tells them apart. */
  Bench: "bench",
  /** The only cross in the set, and the only one that sways. */
  Scarecrow: "scarecrow",
  /** The only round one, and the only one in its own colours. */
  Flowerpot: "flowerpot",
  // World generation's, like the well: it stands in the fence around each
  // village garden, and it is drawn open because it is the one cell of that
  // fence the player can walk through.
  Gate: "gate",
  // The same fence running away from the camera rather than across it. The
  // player's fence is the one panel — choosing an orientation per tile is
  // not a decision a single tap can carry — so this is world generation's.
  FenceSide: "fence-side",
  /**
   * The corner a side run comes *down* into.
   *
   * A corner joins in one direction and not the other. Above one, the side
   * run overhangs its cell by half a tile and lands on the panel's post, so
   * the run continues straight down out of it. Below one there is nothing to
   * overhang with: the side run stops at its cell's edge and the panel's
   * post does not begin until a third of the way into the next cell, which
   * left every garden with a clean break at each of its two bottom corners.
   *
   * This is the same panel with its near post carried up to meet the run
   * above. World generation's, like the side run: which cells are corners is
   * a fact about an enclosure rather than about a fence.
   */
  FenceCorner: "fence-corner",
  /**
   * The gate that stands in one.
   *
   * Half of every garden's gate lands on a side run — the gate goes on the
   * ring cell nearest the square, and two of the four sides are the ones
   * that run away from the camera — so this is not a corner case. Without
   * it, half of them were drawn with the across-the-camera panel: rails
   * sticking sideways into the garden, with the run stopping above and
   * starting again below.
   */
  GateSide: "gate-side",
  /**
   * A market stall, and the reason the store looks like a store.
   *
   * World generation's, like the well. The store is drawn with the barn
   * sprite — a good big building and not obviously a place that sells
   * anything — so what marks it out is what is set up in front of it, which
   * is how a village shop announces itself in the world too. Nothing sells
   * you one.
   */
  Stall: "stall",
  /**
   * The enchanted forest's own light: mushrooms that glow.
   *
   * A fixture rather than scenery so it takes the lamp's path — the one
   * thing in the game that lights the ground around it. The grove is drawn
   * darker than the world at every hour, and these are what keep it
   * *readable* rather than merely dark.
   */
  Glowcap: "glowcap",
  /**
   * The big city's ring wall, in the same four pieces the garden fence
   * comes in: a run across the camera, a run away from it, and a gateway in
   * each.
   *
   * World generation's, like the fence around a village garden and for the
   * same reason: a player setting walls down one at a time is drawing a line
   * across the ground, and choosing an orientation per tile is not a
   * decision a single tap can carry.
   */
  CityWall: "city-wall",
  CityWallSide: "city-wall-side",
  /**
   * The way through it.
   *
   * Drawn open and, uniquely among fixtures, placed *unblocked* — a closed
   * gate on this grid either walls the city off or lets the player walk
   * through solid stone. What a gate cell blocks is a question about the
   * world rather than about the picture, which is why the sidecar still says
   * the cell is solid and the layout overrides it.
   */
  CityGate: "city-gate",
  CityGateSide: "city-gate-side",
} as const;

export type FixtureType = (typeof FixtureType)[keyof typeof FixtureType];

export const FIXTURE_TYPES: readonly FixtureType[] = Object.values(FixtureType);

/**
 * The fixtures a player buys and sets down, as opposed to the one world
 * generation places.
 *
 * The well is part of the village and never moves; these are stock. The
 * split is the generator's — its `PLACEABLE` names the same three — and it
 * matters here because only these need a price, a slot in the crate and a
 * way back into the player's hands.
 */
export const PLACEABLE_FIXTURES: readonly FixtureType[] = [
  FixtureType.Fence,
  // The gate was world generation's alone, on the argument that a gate in a
  // crate is a gateway to nowhere standing in a field. That held while a
  // fence was the only thing a garden could be built out of; the moment a
  // child can fence a plot, the way in is the piece they are missing.
  FixtureType.Gate,
  FixtureType.Table,
  FixtureType.Lamp,
  // Three that do nothing, which is what they are for. The children asked to
  // be able to add to the place they live, and a garden somebody has put a
  // bench in is theirs in a way a garden with a fence round it is not.
  FixtureType.Bench,
  FixtureType.Scarecrow,
  FixtureType.Flowerpot,
];

export function isPlaceable(fixture: FixtureType): boolean {
  return PLACEABLE_FIXTURES.includes(fixture);
}

// PlacedObject.type is an open string — story areas will accrete new kinds —
// so this narrows it rather than assuming every object is a fixture.
export function fixtureFor(objectType: string): FixtureType | null {
  return FIXTURE_TYPES.includes(objectType as FixtureType) ? (objectType as FixtureType) : null;
}

export function fixtureSheetKey(fixture: FixtureType): string {
  return `fixture-${fixture}`;
}

export function fixtureSidecarKey(fixture: FixtureType): string {
  return `fixture-sidecar-${fixture}`;
}

export function fixtureAnimKey(fixture: FixtureType): string {
  return `fixture-${fixture}-idle`;
}
