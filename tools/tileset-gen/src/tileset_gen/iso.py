# SPDX-FileCopyrightText: 2026 Marko Ivankovic
# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

"""Isometric diamond geometry. Generation happens at 2x OUTPUT_WIDTH/
OUTPUT_HEIGHT (supersampling) purely for smoother procedural detail and
cleaner alpha edges; every PNG this tool saves is downsampled back to
OUTPUT_WIDTH/OUTPUT_HEIGHT before being written (see __init__.py), which
is exactly src/world/iso.ts's TILE_WIDTH/TILE_HEIGHT — the renderer never
sees the larger size and needs no changes to match it."""

OUTPUT_WIDTH = 64
OUTPUT_HEIGHT = 32

TILE_WIDTH = OUTPUT_WIDTH * 2
TILE_HEIGHT = OUTPUT_HEIGHT * 2


def in_diamond(x: int, y: int, width: int = TILE_WIDTH, height: int = TILE_HEIGHT) -> bool:
    """Whether pixel (x, y) falls inside the diamond inscribed in a
    width x height box (the same shape src/scenes/GameScene.ts's
    drawDiamond draws with Phaser Graphics). Tested at the pixel's center,
    not its corner, so the mask doesn't pick up a directional bias."""
    cx, cy = width / 2, height / 2
    nx = (x + 0.5 - cx) / (width / 2)
    ny = (y + 0.5 - cy) / (height / 2)
    return abs(nx) + abs(ny) <= 1.0
