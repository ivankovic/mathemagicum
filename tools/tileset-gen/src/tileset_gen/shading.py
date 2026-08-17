# SPDX-FileCopyrightText: 2026 Marko Ivankovic
# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

"""Small, reusable drawing primitives shared by every terrain generator in
terrain.py — a flat-filled silhouette and a scatter of colored dots.
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


def edge_taper(nx: float, ny: float, band: float = 0.14) -> float:
    """1.0 in the bulk of the diamond, ramping linearly down to 0.0 at
    the true boundary within the outer `band` (nx, ny in the same
    normalized space as in_diamond: |nx| + |ny| <= 1 is inside).

    Every terrain generator's own randomized detail (scatter marks,
    facets, wave highlights) is seeded independently per tile — nothing
    correlates what one tile draws near its edge with what its neighbour
    draws near the touching edge. A hard cutoff a few pixels from the
    edge still leaves detail right up against that cutoff, so two
    unrelated patterns meet abruptly at the shared boundary — the actual
    source of the faint grid visible once real terrain (not a lone tile)
    is on screen, which a per-tile antialiasing/silhouette fix can't
    touch since it's about CONTENT, not the alpha shape. Fading detail
    to nothing before it reaches the edge means every tile's own edge
    converges on the same flat base color its neighbours' edges do too,
    so there's nothing left to seam against."""
    dist_from_edge = 1.0 - (abs(nx) + abs(ny))
    if dist_from_edge <= 0:
        return 0.0
    return min(1.0, dist_from_edge / band)


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


def downsample(img: Image.Image, width: int, height: int) -> Image.Image:
    """Resize `img` (RGBA) down to (width, height).

    Pillow's own `resize()` already premultiplies by alpha internally
    for RGBA images before filtering and un-premultiplies the result —
    that's what avoids the classic dark-fringe bug (a fully-transparent
    neighbour's arbitrary/black RGB bleeding in at full weight near a
    transparency boundary). An earlier version of this function redid
    that premultiply/un-premultiply by hand, not realizing Pillow (as of
    at least 10.2) already does it: manually premultiplying before
    calling `resize()` fed it data that looked like a SECOND, independent
    straight-alpha image, so `resize()` premultiplied it again — then
    this function's own un-premultiply divided by alpha a second time
    too, amplifying tiny values near any edge into a wildly wrong,
    fully-saturated color. Invisible on a single tile in isolation, but
    dual_tile_for_output forces a hard silhouette afterward, which made
    that amplified color fully opaque — a bright seam at literally every
    tile edge once real terrain was on screen. Caught by rendering an
    actual chunk and looking, not by inspecting one tile.

    Uses BOX (plain area averaging), not a sharper filter like LANCZOS,
    for the same class of reason: LANCZOS's negative side-lobes still
    ring a few pixels either side of a sharp transparency transition
    even with premultiplication done correctly — a much smaller effect
    than the bug above (a few RGB values of overshoot, not full
    saturation), but a hard silhouette makes it fully opaque too, and a
    few-values-brighter rim at literally every tile edge is still a
    faintly visible grid once real terrain is on screen. BOX has no
    negative weights, so it can't overshoot past its input range at all."""
    return img.resize((width, height), Image.BOX)


def scatter_dots(
    img: Image.Image,
    rng: random.Random,
    base: RGB,
    count: int,
    factor_range: tuple[float, float],
) -> None:
    """Speckles `count` single-pixel dots at random opaque positions,
    each independently shaded within factor_range. Used for dirt/sand
    grain rather than dense per-pixel noise, which reads as static at
    tile scale — sparse, deliberate marks read as texture instead.
    Thinned out toward the tile's own edge by edge_taper — see that
    function's docstring for why a hard margin isn't enough."""
    width, height = img.size
    px = img.load()
    cx, cy = width / 2, height / 2
    for _ in range(count):
        x = rng.randint(0, width - 1)
        y = rng.randint(0, height - 1)
        if px[x, y][3] == 0:
            continue
        nx = (x + 0.5 - cx) / (width / 2)
        ny = (y + 0.5 - cy) / (height / 2)
        if rng.random() > edge_taper(nx, ny):
            continue
        r, g, b = shade(base, rng.uniform(*factor_range))
        px[x, y] = (r, g, b, 255)
