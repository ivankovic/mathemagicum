// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import type Phaser from "phaser";
import type { SheetLayout } from "../world/spriteSidecar";
import { spriteSheetConfig } from "../world/spriteSidecar";
import { type RecolourPlan, applyRecolour } from "./recolour";

/**
 * Registering a repainted copy of a loaded spritesheet.
 *
 * The only part of the recolour with Phaser in it. Everything about *which*
 * colours move is plain data and tested without a browser; this is the
 * twenty lines that get pixels out of a loaded sheet and a new sheet back
 * in, and it is shared by the children's characters and the village's roofs.
 *
 * The route is: the loaded texture's source image, drawn into a canvas, read
 * back as bytes, remapped, and registered under a key of its own. Reading
 * pixels back through a canvas is where a scheme like this usually dies —
 * premultiplied alpha or colour management shifting values by one, on art
 * whose whole premise is exact matches — so it was measured before anything
 * was built on it: a shipped sheet through this path comes back byte for
 * byte, eleven distinct colours in and eleven out.
 *
 * The sheet's *layout* is passed, not just a frame size. The copy carries
 * the shipped sheet's padding, so it has to be cut exactly the way the
 * loader cut the original — given a frame size alone it was cut from (0, 0)
 * on a bare grid, which drew a sliver of the neighbouring frame into every
 * one of them.
 */
export function repaintedSheet(
  scene: Phaser.Scene,
  sourceKey: string,
  key: string,
  plan: RecolourPlan,
  sheet: SheetLayout,
): string {
  if (scene.textures.exists(key)) return key;
  if (plan.size === 0 || !scene.textures.exists(sourceKey)) return sourceKey;

  const image = scene.textures.get(sourceKey).getSourceImage() as
    | HTMLImageElement
    | HTMLCanvasElement;
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return sourceKey;
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  applyRecolour(pixels.data, plan);
  context.putImageData(pixels, 0, 0);

  scene.textures.addSpriteSheet(key, canvas as unknown as HTMLImageElement, {
    ...spriteSheetConfig(sheet),
  });
  return key;
}
