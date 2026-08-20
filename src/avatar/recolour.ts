// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { type RecolourPlan, packRgb } from "../render/recolour";
import type { AvatarCatalogue, AvatarStyle } from "./style";
import { AVATAR_COLOURS } from "./style";

/**
 * Which colours move when a child picks their skin, hair and clothes.
 *
 * The repainting itself is in `src/render/recolour.ts` and is shared with
 * the houses; what is here is the half that knows about avatars.
 */

/**
 * What to repaint for one avatar.
 *
 * Base and shade always travel together: a face recoloured without its
 * shading is a flat cut-out, and a face whose shading alone moved is lit by
 * a lamp that is not there.
 */
export function recolourPlan(catalogue: AvatarCatalogue, style: AvatarStyle): RecolourPlan {
  const plan = new Map<number, number>();
  for (const colour of AVATAR_COLOURS) {
    const shipped = catalogue.shipped_palette[colour];
    const shippedShade = catalogue.shipped_palette[`${colour}_shade`];
    const chosen = catalogue.options[colour][style[colour]];
    // A tone index the catalogue does not have is not this module's to
    // repair — style.ts clamps it — so the honest thing here is to leave the
    // sheet alone rather than paint something arbitrary.
    if (!shipped || !shippedShade || !chosen) continue;
    plan.set(packRgb(shipped), packRgb(chosen[0]));
    plan.set(packRgb(shippedShade), packRgb(chosen[1]));
  }
  return plan;
}
