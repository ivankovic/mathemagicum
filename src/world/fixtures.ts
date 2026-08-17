// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

// Built props that are not buildings — a well is furniture for a village
// square, not architecture. See the asset generator's "Fixtures".

export const FixtureType = {
  Well: "well",
} as const;

export type FixtureType = (typeof FixtureType)[keyof typeof FixtureType];

export const FIXTURE_TYPES: readonly FixtureType[] = Object.values(FixtureType);

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
