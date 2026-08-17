# SPDX-FileCopyrightText: 2026 Marko Ivankovic
# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import random

import pytest

from tileset_gen.buildings import (
    BUILDING_CANVAS_HEIGHT,
    BUILDING_CANVAS_WIDTH,
    BUILDING_GENERATORS,
    WELL_CANVAS_HEIGHT,
    WELL_CANVAS_WIDTH,
)

from .helpers import assert_deterministic, assert_valid_sprite, opaque_pixel_count

# The well is the one 1x1-footprint object (see buildings.py's module
# docstring) — its canvas is smaller than the 4x4 buildings' shared one.
_EXPECTED_CANVAS_SIZE = {
    "well": (WELL_CANVAS_WIDTH, WELL_CANVAS_HEIGHT),
}


def _expected_size(building: str) -> tuple[int, int]:
    return _EXPECTED_CANVAS_SIZE.get(building, (BUILDING_CANVAS_WIDTH, BUILDING_CANVAS_HEIGHT))


@pytest.mark.parametrize("building", BUILDING_GENERATORS)
def test_produces_a_full_size_rgba_canvas(building):
    img = BUILDING_GENERATORS[building](random.Random(0))
    assert_valid_sprite(img, _expected_size(building))


def test_well_canvas_is_smaller_than_the_4x4_buildings_share():
    """The well's 1x1 footprint (vs. every other building's 4x4, see
    villageLayout.ts's BUILDING_SIZE) should get a visibly smaller canvas,
    not the same one stretched or padded to match — see buildings.py's
    module docstring for why."""
    assert WELL_CANVAS_WIDTH < BUILDING_CANVAS_WIDTH
    assert WELL_CANVAS_HEIGHT < BUILDING_CANVAS_HEIGHT


def test_well_silhouette_stays_within_its_own_canvas():
    """The well's absolute pixel geometry (ring/post sizes) isn't scaled
    by its canvas size — assert it wasn't accidentally shrunk to clip
    against WELL_CANVAS_WIDTH/HEIGHT's edges."""
    img = BUILDING_GENERATORS["well"](random.Random(0))
    w, h = img.size
    px = img.load()
    for y in (0, h - 1):
        for x in range(w):
            assert px[x, y][3] == 0, f"well sprite touches its own top/bottom edge at ({x},{y})"
    for x in (0, w - 1):
        for y in range(h):
            assert px[x, y][3] == 0, f"well sprite touches its own left/right edge at ({x},{y})"


@pytest.mark.parametrize("building", BUILDING_GENERATORS)
def test_is_deterministic_for_a_given_seed(building):
    assert_deterministic(BUILDING_GENERATORS[building], f"seed:{building}")


@pytest.mark.parametrize("building", BUILDING_GENERATORS)
def test_draws_something_visible(building):
    img = BUILDING_GENERATORS[building](random.Random(0))
    assert opaque_pixel_count(img) > 0


def test_names_match_object_colors_keys_exactly():
    """buildings.py's module docstring claims these 5 names match
    src/world/palette.ts's OBJECT_COLORS keys exactly — assert that
    claim rather than let it silently rot if either list changes."""
    assert set(BUILDING_GENERATORS) == {"well", "house", "school", "post-office", "store"}
