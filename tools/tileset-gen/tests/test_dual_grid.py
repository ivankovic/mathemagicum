# SPDX-FileCopyrightText: 2026 Marko Ivankovic
# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

"""Pure-logic and geometric-invariant tests for dual_grid.py — no image
inspection, no renderer, no browser. Samples _corner_alpha directly in
(nx, ny) space rather than rendering PNGs and reading pixels back, so
these run in milliseconds and pin down the exact invariant a regression
would violate."""

import random

import pytest

from tileset_gen.dual_grid import (
    DOWN,
    DRAWABLE_MASKS,
    LEFT,
    RIGHT,
    UP,
    _boundary_alpha,
    _boundary_wobble,
    _corner_alpha,
    _steepen,
    dual_tile,
    dual_tile_for_output,
    dual_tile_key,
)
from tileset_gen.iso import OUTPUT_HEIGHT, OUTPUT_WIDTH, in_diamond

CORNERS = (UP, RIGHT, DOWN, LEFT)


def _diamond_samples(rng: random.Random, count: int) -> list[tuple[float, float]]:
    samples = []
    while len(samples) < count:
        nx = rng.uniform(-1, 1)
        ny = rng.uniform(-1, 1)
        if abs(nx) + abs(ny) <= 1:
            samples.append((nx, ny))
    return samples


def test_drawable_masks_are_1_through_15():
    assert DRAWABLE_MASKS == tuple(range(1, 16))


def test_corner_weights_always_sum_to_one():
    """Every terrain's own alpha at a pixel is `_corner_alpha` for
    whichever of its 4 corners are that terrain — summed across every
    terrain touching that pixel's 4 corners, that must total exactly 1
    (a true partition of the tile), or compositing leaves either a gap
    or double coverage. See dual_grid.py's _corner_alpha docstring."""
    rng = random.Random(0)
    for nx, ny in _diamond_samples(rng, 200):
        total = sum(_corner_alpha(nx, ny, 1 << i) for i in range(4))
        assert total == pytest.approx(1.0)


@pytest.mark.parametrize("mask", DRAWABLE_MASKS)
def test_corner_alpha_is_in_unit_range(mask):
    rng = random.Random(1)
    for nx, ny in _diamond_samples(rng, 200):
        alpha = _corner_alpha(nx, ny, mask)
        assert -1e-9 <= alpha <= 1.0 + 1e-9


@pytest.mark.parametrize("corner", CORNERS)
def test_single_corner_mask_is_fully_solid_at_its_own_vertex(corner):
    """A tile whose mask has only one corner bit set should be ~fully
    solid right at that corner's vertex and ~fully transparent at the
    opposite one — the two vertices used here are (0, -1) "up" and
    (0, 1) "down"; RIGHT/LEFT use (1, 0)/(-1, 0) instead, hence the
    per-corner vertex lookup."""
    vertex = {UP: (0.0, -1.0), RIGHT: (1.0, 0.0), DOWN: (0.0, 1.0), LEFT: (-1.0, 0.0)}
    vx, vy = vertex[corner]
    assert _corner_alpha(vx, vy, corner) == pytest.approx(1.0)
    assert _corner_alpha(-vx, -vy, corner) == pytest.approx(0.0)


def test_full_mask_is_solid_everywhere():
    rng = random.Random(2)
    for nx, ny in _diamond_samples(rng, 200):
        assert _corner_alpha(nx, ny, 15) == pytest.approx(1.0)


def test_dual_tile_mask_15_has_no_transparency_added():
    rng = random.Random("t")
    img = dual_tile("grass", 15, rng, width=32, height=16)
    px = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            a = px[x, y][3]
            assert a in (0, 255)  # only the diamond silhouette's own alpha, no fade


def test_dual_tile_single_corner_fades_out_away_from_that_corner():
    rng = random.Random("u")
    img = dual_tile("grass", UP, rng, width=32, height=16)
    w, h = img.size
    top = img.getpixel((w // 2, 1))[3]
    bottom = img.getpixel((w // 2, h - 2))[3]
    assert top > bottom


@pytest.mark.parametrize("mask", DRAWABLE_MASKS)
def test_dual_tile_for_output_has_a_hard_silhouette(mask):
    """Every pixel's alpha must exactly match in_diamond() — 0 outside,
    non-zero-only-if-in-diamond inside. A resize-blurred edge (the bug
    this function exists to avoid — see its own docstring) would leave
    partial alpha just outside the true silhouette, which two
    independently-generated adjacent tiles' blurred edges don't
    complement, showing up as a seam at every tile boundary once real
    terrain is on screen — caught by rendering an actual chunk, not by
    inspecting one tile."""
    rng = random.Random(f"h:{mask}")
    img = dual_tile_for_output("grass", mask, rng)
    px = img.load()
    for y in range(OUTPUT_HEIGHT):
        for x in range(OUTPUT_WIDTH):
            inside = in_diamond(x, y, OUTPUT_WIDTH, OUTPUT_HEIGHT)
            alpha = px[x, y][3]
            if not inside:
                assert alpha == 0, f"({x},{y}) outside diamond has alpha {alpha}"


def test_dual_tile_for_output_mask_15_is_fully_opaque_inside():
    rng = random.Random("full")
    img = dual_tile_for_output("grass", 15, rng)
    px = img.load()
    for y in range(OUTPUT_HEIGHT):
        for x in range(OUTPUT_WIDTH):
            if in_diamond(x, y, OUTPUT_WIDTH, OUTPUT_HEIGHT):
                assert px[x, y][3] == 255


def test_dual_tile_for_output_is_the_expected_size():
    rng = random.Random("size")
    img = dual_tile_for_output("grass", 15, rng)
    assert img.size == (OUTPUT_WIDTH, OUTPUT_HEIGHT)


def test_dual_tile_key_always_includes_the_variant():
    assert dual_tile_key("grass", 15, 2) == "grass-dual-15-2"
    assert dual_tile_key("grass", 1, 0) == "grass-dual-1-0"


class TestSteepen:
    def test_endpoints_are_fixed(self):
        assert _steepen(0.0) == 0.0
        assert _steepen(1.0) == 1.0

    def test_midpoint_is_fixed(self):
        assert _steepen(0.5) == pytest.approx(0.5)

    def test_is_symmetric_so_a_two_terrain_partition_still_sums_to_one(self):
        """S(x) + S(1-x) == 1 for any x — the property dual_tile_for_
        output's exact 2-terrain compositing (see GameScene.ts's
        baseTerrainFor) depends on _steepen preserving."""
        rng = random.Random(3)
        for _ in range(200):
            x = rng.uniform(0.0, 1.0)
            assert _steepen(x) + _steepen(1 - x) == pytest.approx(1.0)

    def test_narrows_the_transition_toward_the_endpoints(self):
        """The whole point: values away from the midpoint should move
        CLOSER to their nearest endpoint than they started — a narrower
        transition band, not just a relabeling."""
        assert _steepen(0.3) < 0.3
        assert _steepen(0.7) > 0.7
        assert _steepen(0.1) < 0.1
        assert _steepen(0.9) > 0.9

    def test_is_monotonic(self):
        rng = random.Random(4)
        xs = sorted(rng.uniform(0.0, 1.0) for _ in range(200))
        steepened = [_steepen(x) for x in xs]
        assert steepened == sorted(steepened)


class TestBoundaryWobble:
    def test_is_a_pure_function_of_position_no_randomness(self):
        """Regression guard for the actual bug this replaced: edge shape
        was drawn from a per-tile rng stream, so two dual tiles sharing a
        mask but rendered as different --variants got unrelated wobbles —
        a visible kink at every seam between them. _boundary_wobble must
        depend only on (nx, ny), so any tile using a given mask draws the
        exact same edge curve, seaming exactly with its neighbours."""
        assert _boundary_wobble(0.3, -0.2) == _boundary_wobble(0.3, -0.2)

    def test_stays_roughly_in_unit_range(self):
        rng = random.Random(5)
        for nx, ny in _diamond_samples(rng, 200):
            assert -1.0 <= _boundary_wobble(nx, ny) <= 1.0


def test_boundary_alpha_stays_in_unit_range():
    rng = random.Random(6)
    for mask in DRAWABLE_MASKS:
        for nx, ny in _diamond_samples(rng, 50):
            alpha = _boundary_alpha(nx, ny, mask)
            assert 0.0 <= alpha <= 1.0


def test_boundary_alpha_is_identical_across_calls_for_the_same_mask():
    """The property that actually fixes the jarring-seam bug: two
    generation calls for the same mask (e.g. different --variants draws)
    must produce the exact same edge shape, since real neighbouring dual
    tiles along one boundary are very often different variants of the
    same mask."""
    rng = random.Random(8)
    for mask in DRAWABLE_MASKS:
        for nx, ny in _diamond_samples(rng, 20):
            assert _boundary_alpha(nx, ny, mask) == _boundary_alpha(nx, ny, mask)


def test_boundary_alpha_of_complementary_masks_sums_to_one():
    """The two terrains sharing one dual tile always have complementary
    masks (together they cover all 4 corners). _corner_alpha's raw blend
    already sums to exactly 1 for any mask and its complement (see
    test_corner_weights_always_sum_to_one); _boundary_alpha must preserve
    that after adding wobble and steepening, or the pair either leaves a
    transparent gap or double-paints — see _boundary_alpha's docstring
    for why the wobble is sign-flipped by the mask's UP bit to make this
    hold."""
    rng = random.Random(9)
    for nx, ny in _diamond_samples(rng, 200):
        for mask in DRAWABLE_MASKS:
            complement = (~mask) & 15
            if complement == 0:
                continue  # mask 15's "complement" (0) is never drawn
            total = _boundary_alpha(nx, ny, mask) + _boundary_alpha(nx, ny, complement)
            assert total == pytest.approx(1.0, abs=1e-6)


def test_boundary_alpha_transition_is_narrower_than_the_raw_bilinear_one():
    """The actual regression this whole feature is for: sample a mask
    whose raw _corner_alpha is exactly linear across the tile (2 adjacent
    corners) at a point 25% of the way from one corner's edge toward the
    other — the raw value there is a soft 0.25 (a wide, visible halo);
    _boundary_alpha at the same point should already read as mostly one
    terrain or the other."""
    mask = UP | RIGHT  # corner_alpha == q, linear from 0 at q=0 to 1 at q=1
    # q = 0.25 in (nx, ny): from p=(nx+ny+1)/2, q=(nx-ny+1)/2 — pick ny=0
    # so q = (nx+1)/2 = 0.25 => nx = -0.5.
    nx, ny = -0.5, 0.0
    raw = _corner_alpha(nx, ny, mask)
    assert raw == pytest.approx(0.25)

    def zero_wobble(_nx: float, _ny: float) -> float:
        return 0.0

    steepened = _boundary_alpha(nx, ny, mask, zero_wobble)
    assert steepened < 0.1, f"expected a narrow transition, got {steepened} at raw alpha {raw}"
