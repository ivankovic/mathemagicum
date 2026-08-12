# SPDX-FileCopyrightText: 2026 Marko Ivankovic
# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

"""Small, reusable drawing primitives shared by every terrain generator in
texture.py — a flat-filled silhouette and a scatter of colored dots.
Deliberately no per-tile edge outline and no per-tile gradient: both are
positioned relative to the TILE, not the world, so on a real tiled floor
they reset at every tile boundary and read as a grid — a seam, even
without a literal outline. Visual richness comes entirely from the
scattered detail below, which is randomized per tile and doesn't have a
consistent boundary to seam against."""

import random

from PIL import Image

from .iso import TILE_HEIGHT, TILE_WIDTH, in_diamond
from .palette import RGB, shade


def solid_diamond(base: RGB, width: int = TILE_WIDTH, height: int = TILE_HEIGHT) -> Image.Image:
    """A diamond filled with one flat color — no shading of its own, so
    two adjacent tiles' fills are pixel-identical at the shared edge."""
    img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    px = img.load()
    r, g, b = base
    for y in range(height):
        for x in range(width):
            if in_diamond(x, y, width, height):
                px[x, y] = (r, g, b, 255)
    return img


def scatter_dots(
    img: Image.Image,
    rng: random.Random,
    base: RGB,
    count: int,
    factor_range: tuple[float, float],
    margin: int = 3,
) -> None:
    """Speckles `count` single-pixel dots at random opaque positions,
    each independently shaded within factor_range. Used for dirt/sand
    grain rather than dense per-pixel noise, which reads as static at
    tile scale — sparse, deliberate marks read as texture instead."""
    width, height = img.size
    px = img.load()
    for _ in range(count):
        x = rng.randint(margin, width - 1 - margin)
        y = rng.randint(margin, height - 1 - margin)
        if px[x, y][3] == 0:
            continue
        r, g, b = shade(base, rng.uniform(*factor_range))
        px[x, y] = (r, g, b, 255)
