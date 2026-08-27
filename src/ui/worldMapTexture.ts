// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import type Phaser from "phaser";
import type { WorldGrid } from "../world/grid";
import { MINIMAP_COLORS, MINIMAP_STEP, minimapPoint, minimapSize } from "../world/minimap";

/**
 * The world, painted once into a texture that is then just an image.
 *
 * Two panels want the same picture now — the map on the tower wall and the
 * portal spell's parchment — and a quarter of a million cells is nothing to
 * walk once and quite a lot to walk twice. Shared here rather than owned by
 * whichever panel opened first, so the second one does not have to know the
 * first exists in order to get a map.
 *
 * The texture outlives the panels that use it: a scene restarted on a resize
 * would otherwise ask for a key already in use and get nothing back.
 */

const WORLD_MAP_TEXTURE = "world-map";

/**
 * Paint it if it has not been painted, and give back the key.
 *
 * Null when the canvas could not be made at all, which is the one case a
 * caller has to handle: an image built against a key that does not exist
 * gets Phaser's missing-texture placeholder, and that is how a lime green
 * box once ended up several tiles across on the night the lamps went in.
 */
export function paintWorldMap(scene: Phaser.Scene, grid: WorldGrid): string | null {
  if (scene.textures.exists(WORLD_MAP_TEXTURE)) return WORLD_MAP_TEXTURE;
  const size = minimapSize(grid.width, grid.height);
  const canvas = scene.textures.createCanvas(WORLD_MAP_TEXTURE, size.width, size.height);
  const context = canvas?.context;
  if (!canvas || !context) return null;
  const image = context.createImageData(size.width, size.height);
  for (let row = 0; row < grid.height; row += MINIMAP_STEP) {
    for (let col = 0; col < grid.width; col += MINIMAP_STEP) {
      const colour = MINIMAP_COLORS[grid.getTerrain(col, row)];
      const at = minimapPoint(col, row);
      const offset = (at.y * size.width + at.x) * 4;
      image.data[offset] = (colour >> 16) & 0xff;
      image.data[offset + 1] = (colour >> 8) & 0xff;
      image.data[offset + 2] = colour & 0xff;
      image.data[offset + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
  canvas.refresh();
  return WORLD_MAP_TEXTURE;
}
