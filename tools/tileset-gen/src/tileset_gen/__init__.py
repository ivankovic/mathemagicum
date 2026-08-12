# SPDX-FileCopyrightText: 2026 Marko Ivankovic
# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

"""CLI entrypoint: `uv run tileset-gen`. Writes the 47-tile "blob" autotile
set (see blob.py) per terrain type into public/assets/tiles/ (see
REUSE.toml — that directory is CC-BY-NC-ND-4.0, separate from this tool's
own PolyForm-Noncommercial-1.0.0 code license). Deterministic by default:
the same seed always reproduces the same tiles, matching the game's own
seeded-PRNG world generator."""

import argparse
import random
from pathlib import Path

from .blob import (
    DOWN,
    DOWN_LEFT,
    DOWN_RIGHT,
    LEFT,
    RIGHT,
    UP,
    UP_LEFT,
    UP_RIGHT,
    blob_tile,
    blob_tile_key,
    canonical_masks,
    corner_wedge_key,
    corner_wedge_tile,
    edge_wedge_key,
    edge_wedge_tile,
)
from .texture import TERRAIN_GENERATORS

EDGES = (UP, RIGHT, DOWN, LEFT)
CORNERS = (UP_LEFT, UP_RIGHT, DOWN_RIGHT, DOWN_LEFT)

DEFAULT_SEED = 1
# tools/tileset-gen/src/tileset_gen/__init__.py -> repo root is 4 parents up.
_REPO_ROOT = Path(__file__).resolve().parents[4]
DEFAULT_OUT = _REPO_ROOT / "public" / "assets" / "tiles"


DEFAULT_VARIANTS = 4


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
        help="Distinct textures for the fully-interior (mask 0) tile, so a "
        "tiled floor doesn't repeat one texture identically. The other 46 "
        "edge/corner masks get one each — narrower case, and their "
        "position along a boundary already varies which mask shows "
        "(default: %(default)s).",
    )
    args = parser.parse_args()

    args.out.mkdir(parents=True, exist_ok=True)
    masks = canonical_masks()

    count = 0
    for terrain in TERRAIN_GENERATORS:
        for mask in masks:
            variants = range(args.variants) if mask == 0 else [None]
            for variant in variants:
                seed_key = f"{args.seed}:{terrain}:{mask}:{variant}"
                rng = random.Random(seed_key)
                image = blob_tile(terrain, mask, rng)
                name = blob_tile_key(terrain, mask)
                if variant is not None:
                    name = f"{name}-{variant}"
                image.save(args.out / f"{name}.png")
                count += 1
    print(
        f"wrote {count} blob tiles ({len(masks)} masks x {len(TERRAIN_GENERATORS)} terrains, "
        f"mask 0 x{args.variants} variants)"
    )

    # Wedge tiles: a higher-priority terrain encroaching into a lower-
    # priority neighbour's own tile from one edge or corner direction —
    # the exact alpha inverse of what that neighbour's own blob cuts away
    # there (see blob.py's _wedge_tile). One per terrain per direction, no
    # variants, same reasoning as the non-zero blob masks above.
    edge_count = 0
    for terrain in TERRAIN_GENERATORS:
        for edge in EDGES:
            rng = random.Random(f"{args.seed}:edge:{terrain}:{edge}")
            image = edge_wedge_tile(terrain, edge, rng)
            image.save(args.out / f"{edge_wedge_key(terrain, edge)}.png")
            edge_count += 1
    print(f"wrote {edge_count} edge wedge tiles")

    corner_count = 0
    for terrain in TERRAIN_GENERATORS:
        for corner in CORNERS:
            rng = random.Random(f"{args.seed}:corner:{terrain}:{corner}")
            image = corner_wedge_tile(terrain, corner, rng)
            image.save(args.out / f"{corner_wedge_key(terrain, corner)}.png")
            corner_count += 1
    print(f"wrote {corner_count} corner wedge tiles")

    print(f"all tiles written to {args.out.relative_to(_REPO_ROOT)}")


if __name__ == "__main__":
    main()
