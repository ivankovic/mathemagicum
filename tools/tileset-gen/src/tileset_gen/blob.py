# SPDX-FileCopyrightText: 2026 Marko Ivankovic
# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

"""The 47-tile "blob" autotile scheme: for a single terrain, one alpha-
masked tile per distinguishable pattern of "is this neighbour the same
terrain or not" among the 8 surrounding tiles (4 edges + 4 corners). The
renderer (GameScene.ts) draws terrains in a fixed priority order (see
TERRAIN_PRIORITY in src/world/tileset.ts): a tile's own blob is cut only
toward HIGHER-priority neighbours (a higher-priority terrain is never cut
at all — see ownCutMaskFor), and what a cut exposes is a dedicated wedge
tile (edge_wedge_tile / corner_wedge_tile below) from the higher terrain,
drawn at the SAME position — not "whatever happens to already be
underneath," which is what an earlier version of this tried and which
left gaps (see _wedge_tile's docstring for why).

The bit layout and reduce_mask() here MUST match src/world/tileset.ts's
reduceBlobMask() exactly — same constants, same logic — since the
renderer computes a tile's neighbour mask independently at render time and
has to land on the same 47 canonical values this module generates PNGs
for. See that file's own docstring.
"""

import math
import random
from collections.abc import Callable

from PIL import Image

from .iso import TILE_HEIGHT, TILE_WIDTH
from .texture import TERRAIN_GENERATORS

UP = 1
RIGHT = 2
DOWN = 4
LEFT = 8
UP_LEFT = 16
UP_RIGHT = 32
DOWN_RIGHT = 64
DOWN_LEFT = 128

# Each corner bit is only visually distinguishable when both of its
# flanking edges are "same terrain" (0) — otherwise the edge cut already
# dominates that region and the corner's actual value can't be seen.
_CORNER_FLANKS = {
    UP_LEFT: (UP, LEFT),
    UP_RIGHT: (UP, RIGHT),
    DOWN_RIGHT: (DOWN, RIGHT),
    DOWN_LEFT: (DOWN, LEFT),
}


def reduce_mask(mask: int) -> int:
    """Zeroes every corner bit that isn't currently distinguishable,
    collapsing the raw 256 (8-bit) space down to the 47 canonical values
    — see canonical_masks()."""
    for corner, (edge_a, edge_b) in _CORNER_FLANKS.items():
        if mask & edge_a or mask & edge_b:
            mask &= ~corner
    return mask


def canonical_masks() -> list[int]:
    """The 47 unique reduced values, in ascending order of first
    appearance. Derived, not hand-enumerated, so it's provably exhaustive:
    every one of the 256 raw 8-bit patterns reduces to one of these."""
    seen: set[int] = set()
    ordered: list[int] = []
    for raw in range(256):
        reduced = reduce_mask(raw)
        if reduced not in seen:
            seen.add(reduced)
            ordered.append(reduced)
    return ordered


# Vertex position of each corner, in the diamond's normalized (nx, ny)
# space (nx, ny each in [-1, 1], diamond is |nx| + |ny| <= 1) — see
# transitions-era edge_weight in iso.py for the same coordinate system.
_CORNER_VERTEX = {
    UP_LEFT: (0.0, -1.0),
    UP_RIGHT: (1.0, 0.0),
    DOWN_RIGHT: (0.0, 1.0),
    DOWN_LEFT: (-1.0, 0.0),
}

# How far into the tile a cut extends. Edges: fraction of the u/v range
# (see edge_cut) left un-cut before the ramp starts. Corners: radius in
# normalized-space units. Both tuned by eye (render + look), not derived.
_EDGE_BAND = 0.5
_CORNER_RADIUS = 0.6


def _edge_cut(nx: float, ny: float, direction: int) -> float:
    if direction == UP:
        v = nx - ny
    elif direction == DOWN:
        v = ny - nx
    elif direction == RIGHT:
        v = nx + ny
    elif direction == LEFT:
        v = -(nx + ny)
    else:
        raise ValueError(f"not an edge bit: {direction}")
    if v <= _EDGE_BAND:
        return 0.0
    return min(1.0, (v - _EDGE_BAND) / (1.0 - _EDGE_BAND))


def _corner_cut(nx: float, ny: float, corner: int) -> float:
    vx, vy = _CORNER_VERTEX[corner]
    d = math.hypot(nx - vx, ny - vy)
    if d >= _CORNER_RADIUS:
        return 0.0
    return 1.0 - d / _CORNER_RADIUS


def _cut_strength(nx: float, ny: float, mask: int) -> float:
    """How transparent this pixel should be (0 = fully opaque, 1 = fully
    cut) — the strongest single cut affecting it, not a sum, so
    overlapping cut regions don't double up into an even harder cut."""
    strongest = 0.0
    for bit in (UP, RIGHT, DOWN, LEFT):
        if mask & bit:
            strongest = max(strongest, _edge_cut(nx, ny, bit))
    for bit in (UP_LEFT, UP_RIGHT, DOWN_RIGHT, DOWN_LEFT):
        if mask & bit:
            strongest = max(strongest, _corner_cut(nx, ny, bit))
    return strongest


def blob_tile(
    terrain: str,
    mask: int,
    rng: random.Random,
    width: int = TILE_WIDTH,
    height: int = TILE_HEIGHT,
) -> Image.Image:
    """`terrain`'s own tile (same generator as the plain tileset, so it
    carries the same texture detail), with alpha cut away near whichever
    edges/corners `mask` marks as "different terrain" — reduce_mask(mask)
    is applied here too, so callers don't have to pre-reduce."""
    mask = reduce_mask(mask)
    img = TERRAIN_GENERATORS[terrain](rng, width, height)
    if mask == 0:
        return img  # fully surrounded by itself — no cuts, plain tile

    px = img.load()
    cx, cy = width / 2, height / 2
    for y in range(height):
        for x in range(width):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            nx = (x + 0.5 - cx) / (width / 2)
            ny = (y + 0.5 - cy) / (height / 2)
            cut = _cut_strength(nx, ny, mask)
            if cut > 0:
                px[x, y] = (r, g, b, round(a * (1 - cut)))
    return img


def blob_tile_key(terrain: str, mask: int) -> str:
    return f"{terrain}-blob-{mask}"


def _wedge_tile(
    terrain: str,
    solid_at: Callable[[float, float], float],
    rng: random.Random,
    width: int,
    height: int,
) -> Image.Image:
    """`terrain` visible only where `solid_at(nx, ny)` says so, transparent
    elsewhere. A lower-priority tile's own cut is `1 - solid_at` for the
    exact same function (see ownCutMaskFor's use of edge_cut/corner_cut,
    mirrored here as _edge_cut/_corner_cut) — using the literal inverse,
    not an approximation built from other edges' cuts, is what guarantees
    the two fit together with no gap. An earlier version of the edge
    wedge built its shape from the OTHER 3 edges' cut functions (reusing
    an existing 47-mask tile) instead of inverting its own — those use
    different linear terms (u = nx - ny for one edge, v = nx + ny for the
    next), so their zero-crossings don't coincide, leaving a sliver
    uncovered near each corner. Caught by rendering a real chunk and
    finding leftover safety-base color at the boundary, not by inspection."""
    img = TERRAIN_GENERATORS[terrain](rng, width, height)
    px = img.load()
    cx, cy = width / 2, height / 2
    for y in range(height):
        for x in range(width):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            nx = (x + 0.5 - cx) / (width / 2)
            ny = (y + 0.5 - cy) / (height / 2)
            solid = solid_at(nx, ny)
            px[x, y] = (r, g, b, round(a * solid))
    return img


def edge_wedge_tile(
    terrain: str,
    edge: int,
    rng: random.Random,
    width: int = TILE_WIDTH,
    height: int = TILE_HEIGHT,
) -> Image.Image:
    """`terrain` encroaching from one edge direction — the exact alpha
    inverse of what ownCutMaskFor cuts away there on a lower-priority
    tile (see _wedge_tile)."""
    return _wedge_tile(terrain, lambda nx, ny: _edge_cut(nx, ny, edge), rng, width, height)


def edge_wedge_key(terrain: str, edge: int) -> str:
    return f"{terrain}-edge-{edge}"


def corner_wedge_tile(
    terrain: str,
    corner: int,
    rng: random.Random,
    width: int = TILE_WIDTH,
    height: int = TILE_HEIGHT,
) -> Image.Image:
    """`terrain` encroaching from one corner — the exact alpha inverse of
    the corner notch ownCutMaskFor cuts away on a lower-priority tile
    (see _wedge_tile)."""
    return _wedge_tile(terrain, lambda nx, ny: _corner_cut(nx, ny, corner), rng, width, height)


def corner_wedge_key(terrain: str, corner: int) -> str:
    return f"{terrain}-corner-{corner}"
