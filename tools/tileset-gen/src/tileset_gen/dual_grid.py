# SPDX-FileCopyrightText: 2026 Marko Ivankovic
# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

"""Modern "dual-grid" autotiling: the tiles actually drawn sit on a grid
offset by half a cell from the terrain data grid, so each drawn diamond's
four vertices each land on one data cell — see src/world/tileset.ts's
module docstring for the full geometry and the render-time half of this
scheme (cornerMaskFor/dualTileKey), and GameScene.ts's activateChunk for
how it's composited per TERRAIN_PRIORITY layer.

This replaces the old 47-tile "blob" scheme (see git history for
blob.py): a drawn tile's content is now fully determined by which of its
4 corner data cells match a given terrain — 16 raw combinations, no
reduction step, no separate wedge tiles for a higher-priority terrain
encroaching from a neighbour. Mask bit i is set when that corner is
`terrain`; the bit layout here MUST match src/world/tileset.ts's exactly,
same cross-language contract the old scheme had.
"""

import math
import random
from collections.abc import Callable

from PIL import Image

from .iso import OUTPUT_HEIGHT, OUTPUT_WIDTH, TILE_HEIGHT, TILE_WIDTH, in_diamond
from .shading import downsample
from .terrain import TERRAIN_GENERATORS

UP = 1
RIGHT = 2
DOWN = 4
LEFT = 8

# Masks 1-15: every combination except the fully-transparent "none of my
# corners are this terrain" case (0), which needs no PNG — the renderer
# just skips drawing this terrain's layer for that tile (see
# GameScene.ts's activateChunk).
DRAWABLE_MASKS: tuple[int, ...] = tuple(range(1, 16))

_NOISE_AMPLITUDE = 0.16
_ALPHA_STEEPNESS = 3.0


def _corner_alpha(nx: float, ny: float, mask: int) -> float:
    """How much of `mask`'s corners this pixel belongs to, in [0, 1].

    (nx, ny) is the diamond's normalized space (|nx| + |ny| <= 1, see
    iso.py's in_diamond). Reparametrize to (p, q) where p and q each run
    0..1 across the diamond and the four vertices land on the four
    corners of the unit square: left=(0,0), up=(0,1), right=(1,1),
    down=(1,0) — this is exactly the (col, row) grid's own 45-degree
    rotation undone, so bilinear interpolation in (p, q) is bilinear
    interpolation over the 4 data cells the tile's dual-grid offset
    places at those vertices. The four corner weights below are the
    standard bilinear corner weights and always sum to 1 for any (p, q),
    which is what makes a terrain's own alpha and its neighbours' alphas
    partition the tile exactly rather than leaving gaps or double-
    coverage — see tileset-gen's README for the one case (3+ terrains
    meeting at a single dual tile) where compositing that partition with
    plain alpha-over still isn't perfectly exact.
    """
    p = (nx + ny + 1) / 2
    q = (nx - ny + 1) / 2
    alpha = 0.0
    if mask & UP:
        alpha += (1 - p) * q
    if mask & RIGHT:
        alpha += p * q
    if mask & DOWN:
        alpha += p * (1 - q)
    if mask & LEFT:
        alpha += (1 - p) * (1 - q)
    return alpha


# Fixed frequency/phase triples for _boundary_wobble — deliberately NOT
# drawn from a per-tile rng. An edge's shape must be a pure function of
# (nx, ny, mask): two dual tiles that happen to land on different
# --variants selections but share a mask (adjacent tiles along one long
# boundary almost always do, since tileVariantFor varies by position) draw
# the SAME edge curve, so their shared seam lines up exactly. Randomizing
# this per variant was tried and rejected — see git history — it produced
# a visible kink at every tile boundary where two independently-wobbled
# edges failed to agree, not the organic look it was meant to give.
_BOUNDARY_WOBBLE_TERMS: tuple[tuple[float, float, float], ...] = (
    (2.3, 1.6, 0.7),
    (3.4, 2.7, 3.5),
    (1.7, 3.2, 5.4),
)


def _boundary_wobble(nx: float, ny: float) -> float:
    """A small sum of fixed sine waves, returning roughly [-1, 1] — smooth,
    coherent perturbation (not per-pixel static) to nudge a transition
    line with, so an edge reads as organic — grass tufts poking into dirt
    — rather than a perfect geometric curve. See _BOUNDARY_WOBBLE_TERMS
    for why the terms are fixed rather than random, and _boundary_alpha
    for how the same field is shared, sign-flipped, between a mask and
    its complement so their alphas still sum to exactly 1."""
    return sum(
        math.sin(fx * nx + fy * ny + phase) for fx, fy, phase in _BOUNDARY_WOBBLE_TERMS
    ) / len(_BOUNDARY_WOBBLE_TERMS)


def _steepen(alpha: float, steepness: float = _ALPHA_STEEPNESS) -> float:
    """Sharpens `alpha` (already in [0, 1]) around its own midpoint — a
    symmetric Hill/logistic curve, alpha**k / (alpha**k + (1-alpha)**k).

    _corner_alpha's raw bilinear blend varies smoothly across the ENTIRE
    tile, not just near the true corner boundary — e.g. a mask with 2
    adjacent corners set is exactly linear all the way across, so a
    one-cell-wide dirt path showed a gradient nearly as wide as the tile
    itself: a blurry halo, not an edge. Steepening compresses that
    gradient into a narrow band near the true boundary instead.
    Symmetric — S(x) + S(1-x) == 1 exactly, for any x — so the exact
    2-terrain partition dual_tile_for_output's compositing relies on
    (see GameScene.ts's baseTerrainFor) still holds after steepening."""
    if alpha <= 0.0:
        return 0.0
    if alpha >= 1.0:
        return 1.0
    a = alpha**steepness
    b = (1 - alpha) ** steepness
    return a / (a + b)


def _boundary_alpha(
    nx: float,
    ny: float,
    mask: int,
    wobble: Callable[[float, float], float] = _boundary_wobble,
) -> float:
    """The alpha to actually paint at (nx, ny) for `mask`: _corner_alpha's
    raw blend, nudged by `wobble` for an organic edge, then narrowed by
    _steepen.

    `wobble`'s contribution is sign-flipped by whether `mask` includes the
    UP corner. Complementing a mask (the two terrains sharing a dual tile
    always have complementary masks, since together they cover all 4
    corners) always flips every bit, including UP — so a mask and its
    complement always get opposite-signed wobble from the same shared
    field, and corner_alpha(mask) + corner_alpha(complement) == 1 (see
    _corner_alpha's docstring) means their _boundary_alpha values still
    sum to exactly 1. Without this, a coherent-but-unsigned wobble applied
    to both sides independently would bias the pair's total coverage up
    or down together instead of just shifting the boundary between them.
    `wobble` is only a parameter so tests can substitute a zero/known
    function; real callers always use the default."""
    sign = -1.0 if mask & UP else 1.0
    alpha = _corner_alpha(nx, ny, mask) + sign * _NOISE_AMPLITUDE * wobble(nx, ny)
    alpha = min(1.0, max(0.0, alpha))
    return _steepen(alpha)


def dual_tile(
    terrain: str,
    mask: int,
    rng: random.Random,
    width: int = TILE_WIDTH,
    height: int = TILE_HEIGHT,
) -> Image.Image:
    """`terrain`'s own tile (same generator as the plain tileset, so it
    carries the same texture detail), alpha-scaled by `_boundary_alpha`
    so it fades out — narrowly, organically, not a wide smooth halo —
    away from whichever corners `mask` doesn't claim. mask=15 (all 4
    corners) is the fully-interior case — no fade, returned as-is."""
    img = TERRAIN_GENERATORS[terrain](rng, width, height)
    if mask == 15:
        return img

    px = img.load()
    cx, cy = width / 2, height / 2
    for y in range(height):
        for x in range(width):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            nx = (x + 0.5 - cx) / (width / 2)
            ny = (y + 0.5 - cy) / (height / 2)
            alpha = _boundary_alpha(nx, ny, mask)
            if alpha < 1.0:
                px[x, y] = (r, g, b, round(a * alpha))
    return img


def dual_tile_key(terrain: str, mask: int, variant: int) -> str:
    return f"{terrain}-dual-{mask}-{variant}"


def dual_tile_for_output(terrain: str, mask: int, rng: random.Random) -> Image.Image:
    """`dual_tile` at generation resolution (TILE_WIDTH/TILE_HEIGHT),
    downsampled to OUTPUT_WIDTH/OUTPUT_HEIGHT (see shading.downsample)
    for smoother texture detail — but with alpha computed FRESH,
    analytically, at output resolution rather than carried through the
    resize along with everything else.

    Resizing alpha blurs the diamond's outer silhouette into a soft
    antialiased edge. That looks fine for any ONE tile in isolation, but
    two independently-generated adjacent tiles' blurred edges don't
    complement each other — composited side by side (as every real
    chunk does), that shows up as a visible seam at every tile boundary,
    not just at terrain transitions. Caught by rendering an actual chunk
    and looking, not by inspecting one tile. A hard silhouette
    (in_diamond) combined with the same _corner_alpha formula used at
    generation time reproduces exactly the same shape every tile agrees
    on regardless of its random variant, so neighbours' edges always
    meet exactly, the same guarantee the un-supersampled scheme this
    replaced had for free."""
    img = downsample(
        TERRAIN_GENERATORS[terrain](rng, TILE_WIDTH, TILE_HEIGHT), OUTPUT_WIDTH, OUTPUT_HEIGHT
    )
    px = img.load()
    cx, cy = OUTPUT_WIDTH / 2, OUTPUT_HEIGHT / 2
    for y in range(OUTPUT_HEIGHT):
        for x in range(OUTPUT_WIDTH):
            r, g, b, _existing_a = px[x, y]
            if not in_diamond(x, y, OUTPUT_WIDTH, OUTPUT_HEIGHT):
                px[x, y] = (0, 0, 0, 0)
                continue
            if mask == 15:
                px[x, y] = (r, g, b, 255)
                continue
            nx = (x + 0.5 - cx) / (OUTPUT_WIDTH / 2)
            ny = (y + 0.5 - cy) / (OUTPUT_HEIGHT / 2)
            px[x, y] = (
                r,
                g,
                b,
                round(255 * _boundary_alpha(nx, ny, mask)),
            )
    return img
