// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

/**
 * Repainting one generated sheet in another set of colours.
 *
 * This works at all because of what the art is: every pixel the generator
 * draws is either fully transparent or one of a handful of exact colours,
 * with no antialiasing anywhere and no blending between them. So a recolour
 * is a lookup, not a filter — and it is exact, not approximate. Nothing is
 * resampled, nothing is averaged, and the result is a sheet the generator
 * could have produced.
 *
 * Two things use it, which is why it lives here rather than beside either:
 * a child's character, painted in the skin, hair and clothes they picked;
 * and a villager's house, whose roof and bedding are repainted so that one
 * cottage sheet is four homes. The trick is the same both times and the only
 * thing that differs is which slots move.
 *
 * Two things it must get right, both of which are easy to get wrong:
 *
 * **The mapping is simultaneous, not sequential.** Applying "skin becomes X"
 * and then "hair becomes Y" in turn will repaint any pixel the first rule
 * turned into hair's colour — so a child who picks a skin tone that happens
 * to equal the shipped hair colour ends up with their face in their hair.
 * Every pixel is therefore read once against the *original* palette and
 * written once.
 *
 * **Only declared colours move.** Three of a character's eleven colours are
 * ever repainted; the closest pair in the sheet is thirty-one units apart,
 * which is near enough that nothing here may decide by eye which is which.
 * Every one of them comes from the sidecar the generator writes, and a
 * colour with no rule is left exactly as it is.
 */

export type Rgb = readonly [number, number, number];

/** Source colour to destination colour, packed for a fast, exact lookup. */
export type RecolourPlan = ReadonlyMap<number, number>;

/** One opaque colour as a single integer, so a Map lookup replaces a compare. */
export function packRgb(rgb: Rgb): number {
  return ((rgb[0] & 0xff) << 16) | ((rgb[1] & 0xff) << 8) | (rgb[2] & 0xff);
}

/**
 * Repaint pixel data in place, RGBA, four bytes a pixel.
 *
 * Transparent pixels are skipped rather than mapped: the sheet's padding is
 * (0, 0, 0, 0), and a rule whose source happened to be black would otherwise
 * paint the space around the character.
 */
export function applyRecolour(pixels: Uint8ClampedArray, plan: RecolourPlan): number {
  if (plan.size === 0) return 0;
  let changed = 0;
  for (let at = 0; at + 3 < pixels.length; at += 4) {
    if (pixels[at + 3] === 0) continue;
    const from =
      (((pixels[at] ?? 0) & 0xff) << 16) |
      (((pixels[at + 1] ?? 0) & 0xff) << 8) |
      ((pixels[at + 2] ?? 0) & 0xff);
    const to = plan.get(from);
    if (to === undefined) continue;
    pixels[at] = (to >> 16) & 0xff;
    pixels[at + 1] = (to >> 8) & 0xff;
    pixels[at + 2] = to & 0xff;
    changed++;
  }
  return changed;
}

/**
 * A plan that swaps one three-tone ramp for another.
 *
 * The shape every generated palette is built from — dark, base, light — so
 * this is what a roof, a wall or a bolt of cloth is repainted with. All three
 * tones move together, always: a roof whose highlight stayed behind is a roof
 * lit by a sun that has moved.
 */
export function rampPlan(
  from: readonly Rgb[],
  to: readonly Rgb[],
  into: Map<number, number> = new Map(),
): RecolourPlan {
  for (const [index, source] of from.entries()) {
    const target = to[index];
    if (!source || !target) continue;
    into.set(packRgb(source), packRgb(target));
  }
  return into;
}
