# SPDX-FileCopyrightText: 2026 Marko Ivankovic
# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import random

import pytest

from tileset_gen.iso import TILE_HEIGHT, TILE_WIDTH
from tileset_gen.terrain import TERRAIN_GENERATORS

from .helpers import assert_deterministic, assert_valid_sprite


@pytest.mark.parametrize("terrain", TERRAIN_GENERATORS)
def test_produces_a_full_size_rgba_diamond(terrain):
    img = TERRAIN_GENERATORS[terrain](random.Random(0))
    assert_valid_sprite(img, (TILE_WIDTH, TILE_HEIGHT))


@pytest.mark.parametrize("terrain", TERRAIN_GENERATORS)
def test_is_deterministic_for_a_given_seed(terrain):
    assert_deterministic(TERRAIN_GENERATORS[terrain], f"seed:{terrain}")


@pytest.mark.parametrize("terrain", TERRAIN_GENERATORS)
def test_corner_pixel_outside_the_diamond_is_transparent(terrain):
    img = TERRAIN_GENERATORS[terrain](random.Random(0))
    assert img.getpixel((0, 0))[3] == 0


@pytest.mark.parametrize("terrain", TERRAIN_GENERATORS)
def test_center_pixel_is_opaque(terrain):
    img = TERRAIN_GENERATORS[terrain](random.Random(0))
    cx, cy = img.size[0] // 2, img.size[1] // 2
    assert img.getpixel((cx, cy))[3] == 255


@pytest.mark.parametrize("terrain", TERRAIN_GENERATORS)
def test_every_opaque_pixel_is_fully_opaque_or_fully_transparent(terrain):
    """Terrain fills are deliberately flat, not gradient-shaded, and every
    detail pass paints fully-opaque marks — see shading.py's module
    docstring. No partial alpha should ever appear on a plain (uncut)
    terrain tile; dual_grid.py's corner alpha is what introduces partial
    alpha, tested separately in test_dual_grid.py."""
    img = TERRAIN_GENERATORS[terrain](random.Random(0))
    alphas = {pixel[3] for pixel in img.get_flattened_data()}
    assert alphas <= {0, 255}
