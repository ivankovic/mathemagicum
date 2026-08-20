// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import type Phaser from "phaser";
import { repaintedSheet } from "../render/sheetTexture";
import { characterSheetKey } from "../world/characters";
import type { SheetLayout } from "../world/spriteSidecar";
import { recolourPlan } from "./recolour";
import type { AvatarCatalogue, AvatarStyle } from "./style";

/**
 * Making a texture that is one child's character.
 *
 * The only part of the avatar with Phaser in it. Everything about *which*
 * colours (style.ts) and *how* they are swapped (recolour.ts) is plain data
 * and tested without a browser; this is the twenty lines that get pixels out
 * of a loaded sheet and a new sheet back in.
 *
 * The route is: the loaded texture's source image, drawn into a canvas, read
 * back as bytes, remapped, and registered as a spritesheet of its own key.
 * Reading pixels back through a canvas is where a scheme like this usually
 * dies — premultiplied alpha or colour management shifting values by one, on
 * art whose whole premise is exact matches — so it was measured before it
 * was built on: a shipped sheet through this path comes back byte for byte,
 * eleven distinct colours in and eleven out.
 */

export const AVATAR_CATALOGUE_KEY = "avatar-catalogue";

export function avatarCatalogue(scene: Phaser.Scene): AvatarCatalogue | null {
  return (scene.cache.json.get(AVATAR_CATALOGUE_KEY) as AvatarCatalogue | undefined) ?? null;
}

/**
 * A name for one look, in the same namespace the cast lives in.
 *
 * Deliberately shaped like a character name rather than like a texture key,
 * because it then *is* one: the sheet lands at `characterSheetKey` of this
 * and the animations at `characterAnimKey` of it, so the player's sprite is
 * driven by exactly the code that drives the shopkeeper's, and nothing about
 * walking, facing or gesturing has to learn that one character is recoloured.
 *
 * Named per style so two children on one device never share a texture one of
 * them repainted, and so returning to a colour already made costs nothing.
 */
export function avatarCharacter(style: AvatarStyle): string {
  return `${style.body}~${style.skin}${style.hair}${style.shirt}`;
}

/**
 * Build (or reuse) the sheet for a style, and give back the character name it
 * is registered under.
 *
 * Falls back to the body's own name if anything is missing rather than
 * throwing: a child in the colours the sheet shipped in is a far smaller
 * failure than a child with no character at all.
 */
export function avatarTexture(
  scene: Phaser.Scene,
  catalogue: AvatarCatalogue | null,
  style: AvatarStyle,
  /** The body sheet's own layout, from its sidecar. */
  sheet: SheetLayout,
): string {
  const character = avatarCharacter(style);
  const key = characterSheetKey(character);
  const sourceKey = characterSheetKey(style.body);
  if (scene.textures.exists(key)) return character;
  if (!catalogue || !scene.textures.exists(sourceKey)) return style.body;

  const plan = recolourPlan(catalogue, style);
  if (plan.size === 0) return style.body;

  return repaintedSheet(scene, sourceKey, key, plan, sheet) === key ? character : style.body;
}
