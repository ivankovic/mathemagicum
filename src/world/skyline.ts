// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

/**
 * The skyline: things drawn in the air over a place, standing on nothing.
 *
 * Its own module rather than a third kind of landmark, and the split is the
 * same one the asset generator draws. A landmark is *one of a kind, covers
 * several tiles, has no inside, and is the reason to walk somewhere* — that
 * is `landmarks.ts`, in its own words, and two of the four clauses are false
 * of a blimp. There are several over one city, and nobody walks anywhere to
 * see one.
 *
 * The load-bearing difference is that **a skyline sprite is never placed**.
 * It is not a `PlacedObject`, it is not in the grid, it blocks nothing, it
 * is not written to a save and no route can carve it away. It is drawn from
 * the world the seed already produced — the same standing as the harbour's
 * ships, which are sprites over berths rather than objects on cells.
 *
 * Which is what makes it cheap. Everything that made the sun panels awkward
 * — a cell to occupy, a price to be absent, a name in three languages, a
 * connectivity pass that could delete them — is a consequence of being a
 * thing a game *puts down*, and none of it applies here.
 */

export const SkyThing = {
  /**
   * A small airship at anchor over a rooftop, with a turbine on its back.
   *
   * How the city makes its power, after two attempts at saying so with
   * hardware bolted to the ground and then to a roof. See the generator's
   * `SKYLINE` for why its canvas is the townhouse's made taller.
   */
  Blimp: "blimp",
} as const;

export type SkyThing = (typeof SkyThing)[keyof typeof SkyThing];

export const SKY_THINGS: readonly SkyThing[] = Object.values(SkyThing);

export function skySheetKey(thing: SkyThing): string {
  return `sky-${thing}`;
}

export function skySidecarKey(thing: SkyThing): string {
  return `sky-sidecar-${thing}`;
}

/** Matches the sidecar's own animation name. */
export function skyAnimKey(thing: SkyThing): string {
  return `sky-${thing}-idle`;
}

/**
 * One blimp for every this-many city houses.
 *
 * A few, which is what was asked for, and the number is the whole of the
 * difference between a sky with airships in it and a traffic jam. Five is
 * enough that a child walking a street passes under one without having to go
 * looking, and few enough that the one overhead is worth looking up at.
 */
export const HOUSES_PER_BLIMP = 5;

/**
 * What a city house's placed-object id begins with.
 *
 * The city names its buildings `city-<role>-<n>`, and the houses are the
 * `townhouse` role. Written here rather than in the scene so the one place
 * that decides what may be moored and the one place that filters for it
 * cannot drift apart — and a blimp tied to a shop or a clock tower would be
 * a picture nobody meant.
 */
export const CITY_HOUSE_ID = "city-townhouse";

/**
 * Which of a city's houses have one moored above them.
 *
 * A pure function of the list, and its own function so it can be reasoned
 * about without a browser — the only part of this with a decision in it.
 *
 * **Every fifth, from a sorted list, rather than a random draw.** Sorted
 * because the order buildings come back in is world generation's business
 * and not a promise; two runs of the same seed must moor the same houses, or
 * a child's city rearranges itself overhead every time they open the game.
 * Spaced rather than drawn because a random few in a grid of blocks clump,
 * and three blimps over neighbouring roofs with none for the rest of the
 * city reads as a mistake rather than as chance.
 *
 * Offset to the middle of each group, so the first one is not always the
 * house nearest a corner of the map.
 */
export function mooredHouses(houses: readonly string[]): readonly string[] {
  const sorted = [...houses].sort();
  const picked: string[] = [];
  for (let at = Math.floor(HOUSES_PER_BLIMP / 2); at < sorted.length; at += HOUSES_PER_BLIMP) {
    const id = sorted[at];
    if (id !== undefined) picked.push(id);
  }
  return picked;
}
