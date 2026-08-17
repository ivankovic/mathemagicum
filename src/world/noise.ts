// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

/**
 * A smooth, seeded scalar field over the grid — the thing that makes terrain
 * come out as features rather than static.
 *
 * Terrain used to be rolled per tile from its habitat's weights, which gets
 * the proportions right and the shapes catastrophically wrong: a wetland at
 * half water became salt-and-pepper rather than ponds. What a habitat's
 * weights actually describe is how much of a region each terrain covers, not
 * how likely each individual tile is — so the fill reads this field instead
 * and cuts it at the weight boundaries. Neighbouring tiles sample nearly the
 * same value, so they land in the same band, so terrain arrives in patches.
 *
 * Read it as elevation: low is water, high is rock. Every habitat cuts the
 * same field, which is why a lake continues across the boundary between one
 * habitat and the next instead of stopping dead at it.
 */

// Two octaves: one for the shape of a region, one to keep its coastline from
// looking like a contour line. More octaves push the distribution further
// toward its mean (see uniform()) for detail no 32px tile can show.
const OCTAVES = 2;
// Period of the first octave, in tiles. Around a fifth of a 500-tile world,
// so a single body of water spans a walk rather than a screen.
const BASE_PERIOD = 96;
const LACUNARITY = 2.7;
const GAIN = 0.5;

// Hash of a lattice point to [0, 1). Integer mixing rather than a table:
// the field has to be identical across machines and runs, and a permutation
// table would be one more thing to keep in sync with the seed.
function latticeValue(x: number, y: number, seed: number): number {
  let h = Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1) ^ Math.imul(seed, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 13), 0x297a2d39);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// Smoothstep, so the field has no creases at lattice lines. Linear
// interpolation leaves visible diamond artefacts once you threshold it.
function fade(t: number): number {
  return t * t * (3 - 2 * t);
}

function valueNoise(x: number, y: number, period: number, seed: number): number {
  const gx = Math.floor(x / period);
  const gy = Math.floor(y / period);
  const fx = fade(x / period - gx);
  const fy = fade(y / period - gy);
  const v00 = latticeValue(gx, gy, seed);
  const v10 = latticeValue(gx + 1, gy, seed);
  const v01 = latticeValue(gx, gy + 1, seed);
  const v11 = latticeValue(gx + 1, gy + 1, seed);
  const top = v00 + (v10 - v00) * fx;
  const bottom = v01 + (v11 - v01) * fx;
  return top + (bottom - top) * fy;
}

/** Raw fractal noise at a tile. Smooth, seeded, and *not* uniform — see uniform(). */
export function fieldAt(col: number, row: number, seed: number): number {
  let total = 0;
  let amplitude = 1;
  let normalizer = 0;
  let period = BASE_PERIOD;
  for (let octave = 0; octave < OCTAVES; octave++) {
    total += valueNoise(col, row, period, seed + octave * 1013) * amplitude;
    normalizer += amplitude;
    amplitude *= GAIN;
    period /= LACUNARITY;
  }
  return total / normalizer;
}

/**
 * The field's own distribution, measured once and baked in.
 *
 * Interpolating between random lattice values averages them, so the raw
 * field clusters around 0.5 rather than spreading evenly over [0, 1) — and a
 * habitat that asks for "half water" would get far more or less than half,
 * because the half of the *range* below 0.5 is not half of the *tiles*.
 *
 * These are the 5% quantiles of `fieldAt`, measured over a 500x500 grid and
 * averaged across six seeds; `uniform` inverts them so a cut at 0.5 really
 * does fall on the median tile. They are specific to the octave constants
 * above — noise.test.ts checks the remapped field is actually uniform, so
 * changing those without remeasuring fails rather than quietly skewing every
 * habitat's proportions.
 */
const CDF: readonly number[] = [
  0.0, 0.257, 0.311, 0.347, 0.376, 0.401, 0.425, 0.446, 0.467, 0.487, 0.505, 0.524, 0.542, 0.563,
  0.584, 0.607, 0.636, 0.668, 0.703, 0.753, 1.0,
];

/**
 * The field at a tile, remapped so its values are spread evenly over [0, 1).
 *
 * This is what makes a habitat's weights mean what they say: cut this at
 * 0.3 and 30% of the tiles fall below, whatever shape the underlying noise
 * happens to have.
 */
export function uniform(col: number, row: number, seed: number): number {
  const raw = fieldAt(col, row, seed);
  const bands = CDF.length - 1;
  // Binary search would be faster; at 20 entries a scan is not worth the
  // extra code, and this runs once per tile at generation time only.
  for (let i = 0; i < bands; i++) {
    const lo = CDF[i] as number;
    const hi = CDF[i + 1] as number;
    if (raw <= hi) {
      const span = hi - lo;
      const within = span > 0 ? (raw - lo) / span : 0;
      return (i + within) / bands;
    }
  }
  return 1;
}
