# SPDX-FileCopyrightText: 2026 Marko Ivankovic
# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

"""One generator function per terrain type in src/world/terrain.ts's
TerrainType — TERRAIN_GENERATORS' keys match those values exactly, so the
CLI can name output files directly off the game's own vocabulary."""

import math
import random
from collections.abc import Callable

from PIL import Image

from .iso import TILE_HEIGHT, TILE_WIDTH
from .palette import BASE_COLORS, shade
from .shading import scatter_dots, solid_diamond

TerrainGenerator = Callable[[random.Random, int, int], Image.Image]


def grass_tile(
    rng: random.Random, width: int = TILE_WIDTH, height: int = TILE_HEIGHT
) -> Image.Image:
    base = BASE_COLORS["grass"]
    img = solid_diamond(base, width, height)
    # Short single-pixel "blade" ticks, mixed light and dark, rather than
    # drawing literal blade shapes — at 64x32 a suggestion reads better
    # than an attempt at detail.
    px = img.load()
    for _ in range(26):
        x = rng.randint(4, width - 5)
        y = rng.randint(3, height - 5)
        if px[x, y][3] == 0:
            continue
        factor = rng.uniform(1.15, 1.3) if rng.random() < 0.5 else rng.uniform(0.72, 0.85)
        r, g, b = shade(base, factor)
        px[x, y] = (r, g, b, 255)
        if px[x, y + 1][3] != 0:
            px[x, y + 1] = (r, g, b, 255)
    return img


def dirt_tile(
    rng: random.Random, width: int = TILE_WIDTH, height: int = TILE_HEIGHT
) -> Image.Image:
    base = BASE_COLORS["dirt"]
    img = solid_diamond(base, width, height)
    scatter_dots(img, rng, base, count=24, factor_range=(0.55, 0.75))
    scatter_dots(img, rng, base, count=10, factor_range=(1.2, 1.35))
    return img


def sand_tile(
    rng: random.Random, width: int = TILE_WIDTH, height: int = TILE_HEIGHT
) -> Image.Image:
    base = BASE_COLORS["sand"]
    img = solid_diamond(base, width, height)
    scatter_dots(img, rng, base, count=45, factor_range=(0.85, 0.95))
    scatter_dots(img, rng, base, count=45, factor_range=(1.05, 1.18))
    return img


def water_tile(
    rng: random.Random, width: int = TILE_WIDTH, height: int = TILE_HEIGHT
) -> Image.Image:
    base = BASE_COLORS["water"]
    img = solid_diamond(base, width, height)
    px = img.load()
    phase = rng.uniform(0, math.tau)
    highlight = shade(base, 1.28)
    for y in range(2, height - 2, 3):
        for x in range(width):
            if px[x, y][3] == 0:
                continue
            wave = math.sin(x / 6.0 + phase + y * 0.5)
            if wave > 0.5:
                px[x, y] = (*highlight, 255)
    return img


def rock_tile(
    rng: random.Random, width: int = TILE_WIDTH, height: int = TILE_HEIGHT
) -> Image.Image:
    base = BASE_COLORS["rock"]
    img = solid_diamond(base, width, height)
    px = img.load()
    # A handful of shaded seed points, each pixel taking its nearest
    # seed's tint — a cheap Voronoi that reads as faceted stone.
    seeds = [
        (rng.uniform(6, width - 6), rng.uniform(4, height - 4), rng.uniform(0.7, 1.32))
        for _ in range(7)
    ]
    for y in range(height):
        for x in range(width):
            existing = px[x, y]
            if existing[3] == 0:
                continue
            _sx, _sy, factor = min(seeds, key=lambda s: (s[0] - x) ** 2 + ((s[1] - y) * 2) ** 2)
            r, g, b = shade(base, factor)
            er, eg, eb, _ = existing
            # Mostly the facet's own tint, a little of the flat base
            # underneath so facets don't drift too far from rock's actual
            # color.
            px[x, y] = (
                round(r * 0.75 + er * 0.25),
                round(g * 0.75 + eg * 0.25),
                round(b * 0.75 + eb * 0.25),
                255,
            )
    return img


TERRAIN_GENERATORS: dict[str, TerrainGenerator] = {
    "grass": grass_tile,
    "dirt": dirt_tile,
    "sand": sand_tile,
    "water": water_tile,
    "rock": rock_tile,
}
