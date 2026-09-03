// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import type { Rgb } from "../render/recolour";
import { HOUSE_IDS } from "./villageLayout";

/**
 * Why every house in the village is not the same house.
 *
 * Four cottages stood in the square and all four were pixel for pixel
 * identical, inside and out. That is a village nobody can give directions
 * in: "the one with the red roof" only works if there is one.
 *
 * The fix is a repaint rather than more art. A cottage is drawn from a
 * fourteen-colour palette of which three are its roof, and its room from a
 * twenty-colour one of which three are the soft furnishings — so a house
 * becomes another house by swapping one ramp, at load time, from a sheet
 * that was already downloaded. Four homes cost one sheet.
 *
 * **What varies is deliberately small.** The roof outside, because a village
 * seen from above is mostly roofs and it is the one ramp visible from across
 * the square. The bedding and the rug inside, because from the door of a
 * small room the soft things are what you notice — repainting the plaster
 * would change the *light* in the room rather than its character. Walls,
 * trim, windows, wood and firelight stay put everywhere, and that is what
 * keeps four different houses reading as four houses in one village.
 */

/** A dark, base and light tone: the shape every generated ramp comes in. */
export type Ramp = readonly [Rgb, Rgb, Rgb];

export interface HousePalette {
  /** Every colour the sheet was drawn in, by slot name, from the sidecar. */
  readonly palette: Readonly<Record<string, Rgb>>;
  readonly options: readonly Ramp[];
}

/** The slots a house's roof occupies, in ramp order. */
export const ROOF_SLOTS = ["roof_dark", "roof", "roof_light"] as const;
/** And the ones its bedding and rug occupy. */
export const FABRIC_SLOTS = ["fabric_dark", "fabric", "fabric_light"] as const;

export function rampOf(
  palette: Readonly<Record<string, Rgb>>,
  slots: readonly string[],
): Ramp | null {
  const tones = slots.map((slot) => palette[slot]);
  if (tones.some((tone) => !tone)) return null;
  return tones as unknown as Ramp;
}

/**
 * Which look a given house wears.
 *
 * Derived from the building's id and the world's seed rather than rolled, so
 * the house with the blue roof is the house with the blue roof every time
 * the village is generated — which is the entire point. A child who says
 * "meet me at the green one" has to be able to rely on it.
 *
 * **The player's own house always takes option zero**, which is the look the
 * game has always had. Their home is the one building they need to find from
 * a distance without thinking, and a house that changed colour between
 * worlds would be a landmark that is not one.
 */
export function houseLook(buildingId: string, seed: number, options: number): number {
  // One look, or none, means everybody wears it — including the villagers,
  // whose reservation below would otherwise hand them an index the art does
  // not have.
  if (options <= 1) return 0;
  if (buildingId === PLAYER_HOUSE_ID) return 0;
  // A small string hash, seeded by the world. Not `Math.random`: this has to
  // give the same answer on every load, and it has to differ between two
  // villages that happen to have the same house names — which is every pair
  // of villages, since the names come from the layout rather than the seed.
  let hash = (seed >>> 0) ^ 0x9e37_79b9;
  for (let at = 0; at < buildingId.length; at++) {
    hash = Math.imul(hash ^ buildingId.charCodeAt(at), 0x0100_0193) >>> 0;
  }
  // Never zero for anybody else: option zero is the player's, and a villager
  // wearing it would put two identical houses in one square again — which is
  // the thing this exists to prevent.
  return 1 + (hash % (options - 1));
}

export const PLAYER_HOUSE_ID = "player-house";

/**
 * How late into dusk a house lights its windows: 0 at the first hint of it,
 * up to `LIGHTING_SPREAD` of the way through.
 *
 * Nobody in a village lights a lamp at the same second as their neighbour,
 * and a whole square of windows coming on together reads as a switch being
 * thrown rather than as evening. Stable per house per world, from the same
 * hash `houseLook` uses and for the same reason: it has to give the same
 * answer on every load.
 *
 * Bounded rather than merely offset. Every window is fully lit by the time
 * the night is at its darkest — a house still dark at midnight would read
 * as the lighting not working rather than as somebody having an early night.
 */
export const LIGHTING_SPREAD = 0.45;

export function lightingDelay(buildingId: string, seed: number): number {
  let hash = (seed >>> 0) ^ 0x85eb_ca6b;
  for (let at = 0; at < buildingId.length; at++) {
    hash = Math.imul(hash ^ buildingId.charCodeAt(at), 0x0100_0193) >>> 0;
  }
  return ((hash % 1000) / 1000) * LIGHTING_SPREAD;
}

/**
 * How brightly this house's windows burn, given how dark it is.
 *
 * Zero until its own moment in the dusk, then up to one, and one for every
 * house once night is fully down. See `lightingDelay`.
 */
export function windowBrightness(darkness: number, delay: number): number {
  if (darkness <= delay) return 0;
  return Math.min(1, (darkness - delay) / (1 - delay));
}

/** The slots a house's walls occupy, for the one shape that repaints those. */
export const WALL_SLOTS = ["wall_dark", "wall", "wall_light"] as const;

/**
 * Which building shapes vary, and **which ramp each one varies**.
 *
 * Houses were the whole of this and the reason it exists: there are four in
 * the village, twenty townhouses in the city, they are the same shape by
 * design, and without this they were one house drawn twenty-four times. The
 * ship joined them when the harbour got traffic and four hulls started
 * coming and going at the piers.
 *
 * The store is the newcomer and it is here for a fact that changed under the
 * old note. That note said *there is one school and one store and one post
 * office; nothing about them needs telling apart* — which was true when it
 * was written and is not now. The city builds five, the harbour builds up to
 * three, and a playtest said so: *the city having multiple shops that all
 * look the same is not great.*
 *
 * **But the store varies its walls, not its roof**, and that is the same
 * note's own argument turned round rather than abandoned. Roofs carry the
 * saturation and are what identifies a building type at a glance — the barn
 * is blue, the tower purple, the school teal — so repainting a shop's roof
 * would not be variety, it would be deleting the thing that says *shop*. A
 * child crossing a city has to be able to pick one out of a street. The
 * walls carry none of that meaning and are most of the front, so five wall
 * colours under one blue roof is eight shops that are plainly all shops and
 * plainly not the same building.
 *
 * The ramps a wall is repainted with are the sheet's `roof_options` either
 * way: that is the only set of alternatives the art ships, and a ramp is a
 * ramp — three tones from dark to light, which is what the recolour wants
 * whichever slot it lands in.
 */
export const VARYING_SLOTS: Readonly<Record<string, readonly string[]>> = {
  cottage: ROOF_SLOTS,
  townhouse: ROOF_SLOTS,
  ship: ROOF_SLOTS,
  barn: WALL_SLOTS,
};

export const VARYING_SPRITES: readonly string[] = Object.keys(VARYING_SLOTS);

export function varies(sprite: string): boolean {
  return sprite in VARYING_SLOTS;
}

/** Which ramp this shape repaints. See `VARYING_SLOTS`. */
export function slotsFor(sprite: string): readonly string[] {
  return VARYING_SLOTS[sprite] ?? ROOF_SLOTS;
}

/**
 * And which ramp the *room* behind its door repaints.
 *
 * A house varies its soft furnishings, because from the door of a small room
 * the bedding and the rug are what you notice and repainting the plaster
 * would change the light in the room rather than its character.
 *
 * A shop varies its **walls**, for the plainer reason that a warehouse has
 * no soft furnishings: the barn's room is barrels, crates and a counter, and
 * a fabric ramp it never draws is a recolour nobody can see. The complaint
 * was that shops *look exactly the same once you go in*, and answering it
 * with a change to pixels that are not there would have been answering it on
 * paper.
 */
export function roomSlotsFor(room: string): readonly string[] {
  return room === "barn" ? WALL_SLOTS : FABRIC_SLOTS;
}

/**
 * Who lives behind a door, for the plate beside it.
 *
 * Three answers and they are not interchangeable. A villager's cottage shows
 * the villager standing outside it. One of the four round the square shows
 * its owner, or nothing if nobody has moved in — and *nothing* is the answer
 * a question mark is drawn for, which is why it is distinct from "this
 * building has no plate at all".
 *
 * Generic over the child rather than importing a `Profile`, so the rule
 * about who lives where does not drag the save format into the world
 * modules. All it needs to know is that a child has a house number.
 */
export type Resident<T> =
  | { readonly kind: "villager"; readonly character: string }
  | { readonly kind: "child"; readonly owner: T }
  | { readonly kind: "vacant" }
  | null;

export function whoLivesIn<T extends { house: number }>(
  buildingId: string,
  villagers: readonly { readonly homeBuildingId?: string; readonly character: string }[],
  household: readonly T[],
): Resident<T> {
  const villager = villagers.find((one) => one.homeBuildingId === buildingId);
  if (villager) return { kind: "villager", character: villager.character };
  const house = HOUSE_IDS.indexOf(buildingId);
  // Not a house at all: a school has no plate and no question to answer.
  if (house < 0) return null;
  const owner = household.find((one) => one.house === house);
  return owner ? { kind: "child", owner } : { kind: "vacant" };
}
