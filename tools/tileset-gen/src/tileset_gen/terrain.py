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
from .shading import edge_taper, scatter_dots, solid_diamond

TerrainGenerator = Callable[[random.Random, int, int], Image.Image]


def grass_tile(
    rng: random.Random, width: int = TILE_WIDTH, height: int = TILE_HEIGHT
) -> Image.Image:
    base = BASE_COLORS["grass"]
    img = solid_diamond(base, width, height)
    # Short single-pixel "blade" ticks, mixed light and dark, rather than
    # drawing literal blade shapes — a suggestion reads better than an
    # attempt at detail. Count scales with tile area (~4x for a 2x
    # linear resolution bump) to hold the same apparent density rather
    # than thinning out as tiles grow. Thinned out toward the tile's own
    # edge by edge_taper — see that function's docstring.
    px = img.load()
    cx, cy = width / 2, height / 2
    for _ in range(104):
        x = rng.randint(0, width - 1)
        y = rng.randint(0, height - 2)  # -2, not -1: leaves room for the y+1 tick below
        if px[x, y][3] == 0:
            continue
        nx = (x + 0.5 - cx) / (width / 2)
        ny = (y + 0.5 - cy) / (height / 2)
        if rng.random() > edge_taper(nx, ny):
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
    scatter_dots(img, rng, base, count=96, factor_range=(0.55, 0.75))
    scatter_dots(img, rng, base, count=40, factor_range=(1.2, 1.35))
    return img


def sand_tile(
    rng: random.Random, width: int = TILE_WIDTH, height: int = TILE_HEIGHT
) -> Image.Image:
    base = BASE_COLORS["sand"]
    img = solid_diamond(base, width, height)
    scatter_dots(img, rng, base, count=180, factor_range=(0.85, 0.95))
    scatter_dots(img, rng, base, count=180, factor_range=(1.05, 1.18))
    return img


def water_tile(
    rng: random.Random, width: int = TILE_WIDTH, height: int = TILE_HEIGHT
) -> Image.Image:
    base = BASE_COLORS["water"]
    img = solid_diamond(base, width, height)
    px = img.load()
    cx, cy = width / 2, height / 2
    phase = rng.uniform(0, math.tau)
    highlight = shade(base, 1.28)
    for y in range(4, height - 4, 6):
        for x in range(width):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            wave = math.sin(x / 12.0 + phase + y * 0.25)
            if wave <= 0.5:
                continue
            # phase is independent per tile, so this ridge line's own
            # position doesn't line up with a neighbouring water tile's —
            # tapered to nothing at the edge rather than cut hard, same
            # reasoning as edge_taper's other callers.
            nx = (x + 0.5 - cx) / (width / 2)
            ny = (y + 0.5 - cy) / (height / 2)
            weight = edge_taper(nx, ny)
            px[x, y] = (
                round(highlight[0] * weight + r * (1 - weight)),
                round(highlight[1] * weight + g * (1 - weight)),
                round(highlight[2] * weight + b * (1 - weight)),
                255,
            )
    return img


def rock_tile(
    rng: random.Random, width: int = TILE_WIDTH, height: int = TILE_HEIGHT
) -> Image.Image:
    base = BASE_COLORS["rock"]
    img = solid_diamond(base, width, height)
    px = img.load()
    cx, cy = width / 2, height / 2
    # A handful of shaded seed points, each pixel taking its nearest
    # seed's tint — a cheap Voronoi that reads as faceted stone. Seed
    # count scales with tile area (~4x for a 2x linear resolution bump)
    # to hold the same apparent facet size rather than growing facets.
    # Seeded independently per tile, so unlike the scatter-based terrains
    # (see scatter_dots), it's the facet tint's WEIGHT that fades toward
    # the edge via edge_taper, not whether a facet is drawn at all —
    # every pixel is inside some facet, there's no "skip this one".
    seeds = [
        (rng.uniform(12, width - 12), rng.uniform(8, height - 8), rng.uniform(0.7, 1.32))
        for _ in range(28)
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
            # color — tapered to entirely flat base right at the edge.
            nx = (x + 0.5 - cx) / (width / 2)
            ny = (y + 0.5 - cy) / (height / 2)
            facet_weight = 0.75 * edge_taper(nx, ny)
            px[x, y] = (
                round(r * facet_weight + er * (1 - facet_weight)),
                round(g * facet_weight + eg * (1 - facet_weight)),
                round(b * facet_weight + eb * (1 - facet_weight)),
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
