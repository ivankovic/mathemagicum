# SPDX-FileCopyrightText: 2026 Marko Ivankovic
# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

"""Isometric diamond geometry, matching src/world/iso.ts's TILE_WIDTH/
TILE_HEIGHT exactly — tiles this generator produces are meant to drop
straight into the game at their native size, no scaling."""

TILE_WIDTH = 64
TILE_HEIGHT = 32


def in_diamond(x: int, y: int, width: int = TILE_WIDTH, height: int = TILE_HEIGHT) -> bool:
    """Whether pixel (x, y) falls inside the diamond inscribed in a
    width x height box (the same shape src/scenes/GameScene.ts's
    drawDiamond draws with Phaser Graphics). Tested at the pixel's center,
    not its corner, so the mask doesn't pick up a directional bias."""
    cx, cy = width / 2, height / 2
    nx = (x + 0.5 - cx) / (width / 2)
    ny = (y + 0.5 - cy) / (height / 2)
    return abs(nx) + abs(ny) <= 1.0


# Direction names match src/scenes/GameScene.ts's DirectionTag ("up" is the
# row-1 grid neighbour, etc.), not compass points — picked so this module's
# vocabulary lines up with the game's if this ever gets wired into
# neighbour-aware tile selection.
#
# Each direction is one full edge of the diamond, not a point on it: in the
# diamond's normalized (nx, ny) space, u = nx - ny is exactly 1 along the
# whole up-edge and exactly -1 along the whole down-edge (and constant
# along neither axis in between only at the vertices) — same story for
# v = nx + ny on the left/right edges. That makes "distance from an edge"
# a single linear term, not a 2D distance-to-segment calculation.
def edge_weight(
    x: int,
    y: int,
    width: int,
    height: int,
    direction: str,
    band_start: float = 0.15,
) -> float:
    """0 in the bulk of the diamond, ramping linearly to 1 right at the
    named edge, starting at `band_start` (in the same [-1, 1] units as u/v
    above) — a higher band_start keeps more of the tile "purely" the base
    terrain, blending only near that one edge."""
    cx, cy = width / 2, height / 2
    nx = (x + 0.5 - cx) / (width / 2)
    ny = (y + 0.5 - cy) / (height / 2)
    if direction == "up":
        v = nx - ny
    elif direction == "down":
        v = ny - nx
    elif direction == "right":
        v = nx + ny
    elif direction == "left":
        v = -(nx + ny)
    else:
        raise ValueError(f"unknown direction {direction!r}")
    if v <= band_start:
        return 0.0
    return min(1.0, (v - band_start) / (1.0 - band_start))
