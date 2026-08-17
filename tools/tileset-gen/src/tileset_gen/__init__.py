# SPDX-FileCopyrightText: 2026 Marko Ivankovic
# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

"""CLI entrypoint: `uv run tileset-gen`. Writes the dual-grid autotile set
(see dual_grid.py) per terrain type into public/assets/tiles/ (see
REUSE.toml — that directory is CC-BY-NC-ND-4.0, separate from this tool's
own PolyForm-Noncommercial-1.0.0 code license). Deterministic by default:
the same seed always reproduces the same tiles, matching the game's own
seeded-PRNG world generator."""

import argparse
import os
import random
from pathlib import Path

from .dual_grid import DRAWABLE_MASKS, dual_tile_for_output, dual_tile_key
from .terrain import TERRAIN_GENERATORS

DEFAULT_SEED = 1
# tools/tileset-gen/src/tileset_gen/__init__.py -> repo root is 4 parents up.
_REPO_ROOT = Path(__file__).resolve().parents[4]
DEFAULT_OUT = _REPO_ROOT / "public" / "assets" / "tiles"

DEFAULT_VARIANTS = 4

# The one mask whose 4 corners are all `terrain` — i.e. the plain
# fully-interior tile, by far the most common case in open ground.
FULL_MASK = 15


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate Mathemagicum's terrain tileset.")
    parser.add_argument(
        "--seed", type=int, default=DEFAULT_SEED, help="RNG seed (default: %(default)s)."
    )
    parser.add_argument(
        "--out", type=Path, default=DEFAULT_OUT, help="Output directory (default: %(default)s)."
    )
    parser.add_argument(
        "--variants",
        type=int,
        default=DEFAULT_VARIANTS,
        help="Distinct textures per (terrain, mask) — every mask, not "
        "just the fully-interior one, so a partial mask's interior detail "
        "(grass blades, dirt speckle, etc — see terrain.py) doesn't repeat "
        "identically at every tile sharing that mask. Edge shape itself is "
        "NOT randomized per variant — see dual_grid.py's _boundary_wobble "
        "— so neighbouring tiles of the same mask always seam exactly "
        "regardless of which variant each one picked (default: %(default)s).",
    )
    args = parser.parse_args()

    args.out.mkdir(parents=True, exist_ok=True)

    count = 0
    for terrain in TERRAIN_GENERATORS:
        for mask in DRAWABLE_MASKS:
            for variant in range(args.variants):
                seed_key = f"{args.seed}:{terrain}:{mask}:{variant}"
                rng = random.Random(seed_key)
                image = dual_tile_for_output(terrain, mask, rng)
                name = dual_tile_key(terrain, mask, variant)
                image.save(args.out / f"{name}.png")
                count += 1
    print(
        f"wrote {count} dual-grid tiles ({len(DRAWABLE_MASKS)} masks x "
        f"{len(TERRAIN_GENERATORS)} terrains x {args.variants} variants)"
    )
    print(f"all tiles written to {os.path.relpath(args.out, _REPO_ROOT)}")


if __name__ == "__main__":
    main()
