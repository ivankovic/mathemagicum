// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

/**
 * What a child chose to look like.
 *
 * Three colours and a body. The colours are swapped into the sheet at load
 * time (see recolour.ts), so they cost nothing to offer — every combination
 * of skin, hair and shirt is one download. The body is a silhouette and
 * cannot be recoloured into existence, so each one is a sheet of its own and
 * there are four.
 *
 * Which colours exist is not written down here. It is shipped beside the art
 * in `characters/avatar.json`, because the swatches a child picks from have
 * to be the tones the sheets were drawn to be recoloured with: a palette
 * retyped into the game and then changed upstream is a swatch that paints on
 * somebody else's skin.
 */

export interface AvatarStyle {
  /** Which sheet, and so which silhouette. */
  readonly body: string;
  readonly skin: number;
  readonly hair: number;
  readonly shirt: number;
}

export type Rgb = readonly [number, number, number];
/** A colour and the shade it is lit from, always chosen together. */
export type Tone = readonly [Rgb, Rgb];

export interface AvatarCatalogue {
  readonly bodies: readonly string[];
  /** Which pixel value in the shipped sheets is skin, hair, shirt, outline. */
  readonly shipped_palette: Readonly<Record<string, Rgb>>;
  readonly options: {
    readonly skin: readonly Tone[];
    readonly hair: readonly Tone[];
    readonly shirt: readonly Tone[];
  };
}

/**
 * The avatar a new player starts on.
 *
 * Deliberately the look the game had before anybody could choose: skin 1,
 * hair 1, shirt 4 on the long-haired body is pixel for pixel the character
 * every screenshot and every play test so far was of. A default that was
 * some neutral index instead would have quietly restyled the game's own
 * protagonist on the way in.
 */
export const DEFAULT_AVATAR: AvatarStyle = { body: "player", skin: 1, hair: 1, shirt: 4 };

/** Which of the three colour rows a chooser shows, in the order it shows them. */
export const AVATAR_COLOURS = ["skin", "hair", "shirt"] as const;
export type AvatarColour = (typeof AVATAR_COLOURS)[number];

export function tonesFor(catalogue: AvatarCatalogue, colour: AvatarColour): readonly Tone[] {
  return catalogue.options[colour];
}

export function toneIndex(style: AvatarStyle, colour: AvatarColour): number {
  return style[colour];
}

export function withTone(style: AvatarStyle, colour: AvatarColour, index: number): AvatarStyle {
  return { ...style, [colour]: index };
}

/**
 * A style the shipped art can actually draw.
 *
 * A save is older than the game reading it, always: a body that has since
 * been renamed, or a fifth skin tone that was dropped, must cost the child
 * that one field rather than the whole avatar — and must never leave the
 * game asking for a sheet that was not loaded, which is a lime-green box
 * where the player should be.
 */
export function usableAvatar(catalogue: AvatarCatalogue, style: AvatarStyle): AvatarStyle {
  const inRange = (value: number, count: number) =>
    Number.isInteger(value) && value >= 0 && value < count ? value : 0;
  return {
    body: catalogue.bodies.includes(style.body)
      ? style.body
      : (catalogue.bodies[0] ?? DEFAULT_AVATAR.body),
    skin: inRange(style.skin, catalogue.options.skin.length),
    hair: inRange(style.hair, catalogue.options.hair.length),
    shirt: inRange(style.shirt, catalogue.options.shirt.length),
  };
}

/**
 * One avatar per child, without asking them to be inventive.
 *
 * Used to seed the chooser for a *new* player: the first child gets the
 * default and everyone after gets something visibly different, because two
 * identical faces on the who's-playing screen is the one thing that screen
 * must never show. Walking the shirts first and the bodies slowest spreads
 * the difference where it reads at a glance.
 */
export function suggestedAvatar(catalogue: AvatarCatalogue, taken: number): AvatarStyle {
  const first = usableAvatar(catalogue, DEFAULT_AVATAR);
  if (taken <= 0) return first;
  let seen = 0;
  const period = combinationCount(catalogue);
  for (let at = 0; at < period; at++) {
    const style = nthAvatar(catalogue, at);
    if (sameAvatar(style, first)) continue;
    if (++seen === taken) return style;
  }
  // More children than there are looks. Wrapping is the honest answer — the
  // alternative is refusing to make a profile — and by this point the screen
  // is full of faces anyway.
  return nthAvatar(catalogue, taken % Math.max(1, period));
}

function combinationCount(catalogue: AvatarCatalogue): number {
  return (
    Math.max(1, catalogue.bodies.length) *
    Math.max(1, catalogue.options.skin.length) *
    Math.max(1, catalogue.options.hair.length) *
    Math.max(1, catalogue.options.shirt.length)
  );
}

/**
 * Every look, numbered, shirt changing fastest and body slowest.
 *
 * Counting rather than rolling: two children in a row must not be handed the
 * same face, and a random pick that happens to repeat is exactly what the
 * who's-playing screen cannot survive.
 */
function nthAvatar(catalogue: AvatarCatalogue, at: number): AvatarStyle {
  const shirts = Math.max(1, catalogue.options.shirt.length);
  const hairs = Math.max(1, catalogue.options.hair.length);
  const skins = Math.max(1, catalogue.options.skin.length);
  const bodies = Math.max(1, catalogue.bodies.length);
  const index = Math.max(0, Math.trunc(at));
  return usableAvatar(catalogue, {
    shirt: index % shirts,
    hair: Math.floor(index / shirts) % hairs,
    skin: Math.floor(index / (shirts * hairs)) % skins,
    body: catalogue.bodies[Math.floor(index / (shirts * hairs * skins)) % bodies] ?? "",
  });
}

export function sameAvatar(a: AvatarStyle, b: AvatarStyle): boolean {
  return a.body === b.body && a.skin === b.skin && a.hair === b.hair && a.shirt === b.shirt;
}
