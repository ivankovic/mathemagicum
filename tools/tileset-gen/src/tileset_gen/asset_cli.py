# SPDX-FileCopyrightText: 2026 Marko Ivankovic
# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

"""Shared CLI plumbing for the "one generator function per hardcoded name,
N variants each" category modules — plants, buildings, creatures, items.
Each of those CLIs (plant_cli.py, building_cli.py, creature_cli.py,
item_cli.py) is a few lines wiring its own *_GENERATORS dict and output
directory into run() below. Terrain's CLI (see __init__.py) is its own
thing — blob masks and edge/corner wedges don't fit this shape, so it
isn't built on this helper."""

import argparse
import os
import random
from collections.abc import Callable
from pathlib import Path

from PIL import Image

AssetGenerator = Callable[[random.Random], Image.Image]

# tools/tileset-gen/src/tileset_gen/asset_cli.py -> repo root is 4 parents up.
REPO_ROOT = Path(__file__).resolve().parents[4]

DEFAULT_SEED = 1
DEFAULT_VARIANTS = 4


def run(
    *,
    label: str,
    generators: dict[str, AssetGenerator],
    default_out: Path,
) -> None:
    """Writes `<name>-<variant>.png` for every (name, generator) in
    `generators`, `--variants` times each, deterministically seeded from
    `--seed`."""
    parser = argparse.ArgumentParser(description=f"Generate Mathemagicum's {label} sprites.")
    parser.add_argument(
        "--seed", type=int, default=DEFAULT_SEED, help="RNG seed (default: %(default)s)."
    )
    parser.add_argument(
        "--out", type=Path, default=default_out, help="Output directory (default: %(default)s)."
    )
    parser.add_argument(
        "--variants",
        type=int,
        default=DEFAULT_VARIANTS,
        help=f"Distinct sprites per {label} type, so repeated placements don't look "
        "identical (default: %(default)s).",
    )
    args = parser.parse_args()

    args.out.mkdir(parents=True, exist_ok=True)
    count = 0
    for name, generate in generators.items():
        for variant in range(args.variants):
            rng = random.Random(f"{args.seed}:{name}:{variant}")
            image = generate(rng)
            image.save(args.out / f"{name}-{variant}.png")
            count += 1
    print(f"wrote {count} {label} sprites ({len(generators)} types x {args.variants} variants)")
    print(f"all sprites written to {os.path.relpath(args.out, REPO_ROOT)}")
