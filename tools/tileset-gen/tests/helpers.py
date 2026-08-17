# SPDX-FileCopyrightText: 2026 Marko Ivankovic
# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

"""Shared image-structural assertions for the *_GENERATORS dicts (terrain,
plants, buildings, creatures, items) — every one of these produces a PIL
Image directly in memory, so tests inspect pixels straight off the object
the generator returns. No file I/O, no renderer, no browser."""

import random
from collections.abc import Callable

from PIL import Image


def assert_valid_sprite(img: Image.Image, expected_size: tuple[int, int]) -> None:
    assert img.size == expected_size
    assert img.mode == "RGBA"


def assert_deterministic(generate: Callable[[random.Random], Image.Image], seed_key: str) -> None:
    """Same seed key must produce byte-identical output — every generator
    in this tool is meant to be a pure function of its RNG stream, since
    the CLIs rely on `random.Random(f"{seed}:{name}:{variant}")` to
    reproduce a whole asset set from one integer seed."""
    a = generate(random.Random(seed_key))
    b = generate(random.Random(seed_key))
    assert a.tobytes() == b.tobytes()


def opaque_pixel_count(img: Image.Image) -> int:
    return sum(1 for pixel in img.get_flattened_data() if pixel[3] > 0)
