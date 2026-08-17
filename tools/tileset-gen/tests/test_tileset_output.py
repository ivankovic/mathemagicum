# SPDX-FileCopyrightText: 2026 Marko Ivankovic
# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

"""Checks the actual checked-in deliverable — public/assets/tiles/ — has
full coverage: all 15 drawable dual-grid masks per terrain (mask 0 needs
no PNG — see dual_grid.py — so 1-15), each with every variant. Every
other test in this suite calls a generator function directly and never
touches disk (see helpers.py's module docstring); this one is
deliberately different, since "do we have every (terrain, mask, variant)
combination" is a question about the committed output, not about the
generator logic in the abstract — looping over every combination
trivially covers every combination by construction, so testing
__init__.py's loop from memory alone would prove nothing. Reading the
real directory also catches the actual failure mode that matters:
someone changes dual_grid.py's mask logic or terrain.py's
TERRAIN_GENERATORS and forgets to regenerate the checked-in PNGs
(`uv run tileset-gen`) before committing.

Only checks which files exist, not pixel content — not a golden-image
test. Retexturing or recoloring a terrain doesn't move this test; only a
change to which masks, terrains, or variant count exist does, which is
the rare/deliberate case where regenerating actually is the fix."""

from pathlib import Path

import pytest

from tileset_gen import DEFAULT_OUT, DEFAULT_VARIANTS
from tileset_gen.dual_grid import DRAWABLE_MASKS
from tileset_gen.terrain import TERRAIN_GENERATORS


def _dual_masks_on_disk(out: Path, terrain: str) -> set[int]:
    masks = set()
    for f in out.glob(f"{terrain}-dual-*.png"):
        # "grass-dual-1-2.png" -> "1-2" -> take the mask, drop the variant.
        stem = f.stem.removeprefix(f"{terrain}-dual-")
        masks.add(int(stem.split("-")[0]))
    return masks


def _variant_count_on_disk(out: Path, terrain: str, mask: int) -> int:
    return len(list(out.glob(f"{terrain}-dual-{mask}-*.png")))


def test_output_directory_exists():
    assert DEFAULT_OUT.is_dir(), (
        f"{DEFAULT_OUT} doesn't exist — run `uv run tileset-gen` from tools/tileset-gen"
    )


@pytest.mark.parametrize("terrain", TERRAIN_GENERATORS)
def test_every_drawable_mask_has_a_dual_tile_on_disk(terrain):
    expected = set(DRAWABLE_MASKS)
    found = _dual_masks_on_disk(DEFAULT_OUT, terrain)
    missing = expected - found
    assert not missing, f"{terrain}: missing dual tiles for masks {sorted(missing)}"


@pytest.mark.parametrize("terrain", TERRAIN_GENERATORS)
def test_no_stray_masks_on_disk(terrain):
    """The inverse of the completeness check above — a mask outside
    1-15 (e.g. a stale mask-0 file left over from a previous scheme)
    should get cleaned up, not linger as a dead file."""
    expected = set(DRAWABLE_MASKS)
    found = _dual_masks_on_disk(DEFAULT_OUT, terrain)
    extra = found - expected
    assert not extra, f"{terrain}: stray dual tiles for non-drawable masks {sorted(extra)}"


@pytest.mark.parametrize("terrain", TERRAIN_GENERATORS)
@pytest.mark.parametrize("mask", DRAWABLE_MASKS)
def test_every_mask_has_full_variant_coverage_on_disk(terrain, mask):
    """Every mask gets DEFAULT_VARIANTS files, not just the fully-
    interior one — a partial mask's interior texture detail (grass
    blades, dirt speckle) would otherwise repeat identically at every
    tile sharing that mask. (Edge shape itself is intentionally the same
    across variants of a mask — see dual_grid.py's _boundary_wobble —
    so this is about texture variety only, not the boundary curve.) This
    is what actually distinguishes the current scheme from the one it
    replaced (which gave every non-fully-interior mask exactly one file)
    — a regression back to that would pass every other test in this
    file."""
    count = _variant_count_on_disk(DEFAULT_OUT, terrain, mask)
    assert count == DEFAULT_VARIANTS, (
        f"{terrain} mask {mask}: found {count} variant files on disk, expected {DEFAULT_VARIANTS}"
    )
