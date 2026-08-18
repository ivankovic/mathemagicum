// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

// Built props that are not buildings — a well is furniture for a village
// square, not architecture. See the asset generator's "Fixtures".

export const FixtureType = {
  Well: "well",
  Fence: "fence",
  Table: "table",
  Lamp: "lamp",
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
  FixtureType.Table,
  FixtureType.Lamp,
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
