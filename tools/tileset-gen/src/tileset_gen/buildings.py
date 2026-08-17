# SPDX-FileCopyrightText: 2026 Marko Ivankovic
# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

"""One generator function per building type — hardcoded here rather than
derived from a TS source file (unlike plants.py's PlantType), per explicit
direction. The 5 names match src/world/palette.ts's OBJECT_COLORS keys
exactly (well, house, school, post-office, store — the only 5 PlacedObject
types src/world/villageLayout.ts currently places).

Standalone billboard sprites, not diamond tiles — same bottom-centre
anchoring convention as plants.py, but larger, since a building needs to
read as rising above (and often overhanging) the multi-tile footprint it
sits on rather than sitting flush on one tile like a plant. See
src/world/objects.ts's PlacedObject.anchorCol for the in-game anchor point
this lines up with, and src/scenes/GameScene.ts's spawnBuildings.

The well is the one 1x1-footprint object (see villageLayout.ts's
BUILDING_SIZE vs. its own well placement) — it gets its own, smaller
canvas (WELL_CANVAS_*) rather than sharing house/school/post-office/
store's BUILDING_CANVAS_* (sized for a 4x4 footprint): a well silhouette
is much smaller, and matching a 4x4 building's canvas would either leave
it looking tiny and lost in a mostly-empty sprite, or force stretching it
to fill space it doesn't need."""

import random
from collections.abc import Callable

from PIL import Image, ImageDraw

from .palette import BUILDING_BASE_COLORS, RGB, shade

BUILDING_CANVAS_WIDTH = 100
BUILDING_CANVAS_HEIGHT = 128

WELL_CANVAS_WIDTH = 70
WELL_CANVAS_HEIGHT = 120

BuildingGenerator = Callable[[random.Random, int, int], Image.Image]


def _cottage_shell(
    draw: ImageDraw.ImageDraw,
    rng: random.Random,
    base: tuple[float, float],
    body_width: float,
    body_height: float,
    roof_height: float,
    wall_color: RGB,
    roof_color: RGB,
) -> tuple[float, float, float, float]:
    """A rectangular wall with a triangular roof on top — the shared
    silhouette behind house/school/post-office/store, which then each add
    their own door/window/roof-ornament details. Returns
    (wall_left, wall_right, wall_top, roof_peak_y) so callers can place
    details relative to the shell without recomputing its geometry."""
    bx, by = base
    wall_left, wall_right = bx - body_width / 2, bx + body_width / 2
    wall_top = by - body_height
    roof_peak_y = wall_top - roof_height

    # Flat wall fill, then a single vertical shade band so it doesn't
    # read as a flat cardboard cutout — fine here (unlike terrain) since
    # a building sprite never tiles against a copy of itself.
    draw.rectangle([wall_left, wall_top, wall_right, by], fill=wall_color)
    shadow_x = wall_left + body_width * 0.62
    draw.rectangle([shadow_x, wall_top, wall_right, by], fill=shade(wall_color, 0.85))

    draw.polygon(
        [(wall_left - 4, wall_top), (bx, roof_peak_y), (wall_right + 4, wall_top)],
        fill=roof_color,
    )
    # Roof shade split, same reasoning as the wall's.
    draw.polygon(
        [(bx, roof_peak_y), (wall_right + 4, wall_top), (bx, wall_top)],
        fill=shade(roof_color, 0.8),
    )

    door_width = body_width * 0.28
    door_height = body_height * 0.45
    draw.rectangle(
        [bx - door_width / 2, by - door_height, bx + door_width / 2, by],
        fill=shade(wall_color, 0.55),
    )

    return wall_left, wall_right, wall_top, roof_peak_y


def well_sprite(
    rng: random.Random,
    width: int = WELL_CANVAS_WIDTH,
    height: int = WELL_CANVAS_HEIGHT,
) -> Image.Image:
    """Not a cottage — a stone ring with a peaked roof over it, since a
    well's silhouette is nothing like a house's and shouldn't share the
    cottage shell."""
    img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    # Jittered per RNG draw (a variant's own seed), not per pixel — so
    # repeated instances of the same type read as distinct without any
    # single one looking noisy or inconsistent with itself.
    stone = shade(BUILDING_BASE_COLORS["well"], rng.uniform(0.9, 1.1))
    base_x, base_y = width / 2, height - 4

    ring_w, ring_h = 44, 26
    ring_top = base_y - ring_h
    draw.ellipse(
        [base_x - ring_w / 2, ring_top, base_x + ring_w / 2, ring_top + ring_h], fill=stone
    )
    inner_w, inner_h = 30, 16
    inner_top = ring_top + (ring_h - inner_h) / 2 + 3
    draw.ellipse(
        [base_x - inner_w / 2, inner_top, base_x + inner_w / 2, inner_top + inner_h],
        fill=shade(stone, 0.55),
    )
    # Stone-block ticks around the rim.
    for i in range(10):
        angle_x = base_x - ring_w / 2 + 4 + i * (ring_w - 8) / 9
        draw.line(
            [(angle_x, ring_top + 3), (angle_x, ring_top + ring_h - 3)],
            fill=shade(stone, 0.7),
            width=1,
        )

    post_h = 48
    post_top = ring_top - post_h
    for side in (-1, 1):
        px = base_x + side * (ring_w / 2 - 4)
        draw.rectangle([px - 3, post_top, px + 3, ring_top + 4], fill=shade(stone, 0.8))
    draw.polygon(
        [
            (base_x - ring_w / 2 - 6, post_top),
            (base_x, post_top - 22),
            (base_x + ring_w / 2 + 6, post_top),
        ],
        fill=shade(stone, 1.15),
    )
    draw.line(
        [(base_x - ring_w / 2 + 2, post_top - 4), (base_x, post_top - 4)],
        fill=shade(stone, 0.9),
        width=2,
    )
    return img


def house_sprite(
    rng: random.Random,
    width: int = BUILDING_CANVAS_WIDTH,
    height: int = BUILDING_CANVAS_HEIGHT,
) -> Image.Image:
    img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    # Jittered per RNG draw (a variant's own seed), not per pixel — see
    # well_sprite's comment on the same pattern.
    wall = shade(BUILDING_BASE_COLORS["house"], rng.uniform(0.9, 1.1))
    roof = (0x6D, 0x4C, 0x41)
    base = (width / 2, height - 4)
    wall_left, wall_right, wall_top, _peak = _cottage_shell(
        draw,
        rng,
        base,
        body_width=56,
        body_height=52,
        roof_height=34,
        wall_color=wall,
        roof_color=roof,
    )
    window = shade(wall, 1.3)
    draw.rectangle([wall_left + 8, wall_top + 10, wall_left + 18, wall_top + 20], fill=window)
    draw.rectangle([wall_right - 18, wall_top + 10, wall_right - 8, wall_top + 20], fill=window)
    return img


def school_sprite(
    rng: random.Random,
    width: int = BUILDING_CANVAS_WIDTH,
    height: int = BUILDING_CANVAS_HEIGHT,
) -> Image.Image:
    """Wider than a house, with a small bell tower on the roof peak — the
    village's one visibly "institutional" building."""
    img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    wall = shade(BUILDING_BASE_COLORS["school"], rng.uniform(0.9, 1.1))
    roof = (0x37, 0x47, 0x4F)
    base = (width / 2, height - 4)
    wall_left, wall_right, wall_top, peak = _cottage_shell(
        draw,
        rng,
        base,
        body_width=76,
        body_height=48,
        roof_height=26,
        wall_color=wall,
        roof_color=roof,
    )
    window = shade(wall, 1.3)
    for wx in (wall_left + 10, wall_left + 26, wall_right - 26, wall_right - 10):
        draw.rectangle([wx, wall_top + 8, wx + 10, wall_top + 20], fill=window)
    tower_w = 12
    tower_top = peak - 20
    draw.rectangle(
        [base[0] - tower_w / 2, tower_top, base[0] + tower_w / 2, peak], fill=shade(wall, 0.9)
    )
    draw.polygon(
        [
            (base[0] - tower_w / 2 - 2, tower_top),
            (base[0], tower_top - 10),
            (base[0] + tower_w / 2 + 2, tower_top),
        ],
        fill=roof,
    )
    return img


def post_office_sprite(
    rng: random.Random,
    width: int = BUILDING_CANVAS_WIDTH,
    height: int = BUILDING_CANVAS_HEIGHT,
) -> Image.Image:
    """A cottage with a mail flag post out front, distinguishing it from
    house at a glance without changing the wall/roof silhouette."""
    img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    wall = shade(BUILDING_BASE_COLORS["post-office"], rng.uniform(0.9, 1.1))
    roof = (0xFA, 0xFA, 0xFA)
    base = (width / 2, height - 4)
    wall_left, wall_right, wall_top, _peak = _cottage_shell(
        draw,
        rng,
        base,
        body_width=54,
        body_height=50,
        roof_height=30,
        wall_color=wall,
        roof_color=roof,
    )
    window = shade(wall, 1.4)
    draw.rectangle([wall_right - 18, wall_top + 10, wall_right - 8, wall_top + 20], fill=window)

    post_x = wall_left - 14
    draw.line([(post_x, height - 4), (post_x, height - 44)], fill=(0x6D, 0x4C, 0x41), width=3)
    draw.polygon(
        [(post_x, height - 44), (post_x + 14, height - 40), (post_x, height - 36)],
        fill=(0xE5, 0x39, 0x35),
    )
    return img


def store_sprite(
    rng: random.Random,
    width: int = BUILDING_CANVAS_WIDTH,
    height: int = BUILDING_CANVAS_HEIGHT,
) -> Image.Image:
    """A cottage with a striped awning over the door."""
    img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    wall = shade(BUILDING_BASE_COLORS["store"], rng.uniform(0.9, 1.1))
    roof = (0x8D, 0x6E, 0x63)
    base = (width / 2, height - 4)
    wall_left, wall_right, wall_top, _peak = _cottage_shell(
        draw,
        rng,
        base,
        body_width=58,
        body_height=48,
        roof_height=28,
        wall_color=wall,
        roof_color=roof,
    )
    window = shade(wall, 1.35)
    draw.rectangle([wall_left + 8, wall_top + 10, wall_left + 20, wall_top + 22], fill=window)

    awning_y = wall_top + 26
    stripe_w = (wall_right - wall_left) / 6
    for i in range(6):
        color = (0xFA, 0xFA, 0xFA) if i % 2 == 0 else shade(wall, 0.7)
        draw.polygon(
            [
                (wall_left + i * stripe_w, awning_y),
                (wall_left + (i + 1) * stripe_w, awning_y),
                (wall_left + (i + 1) * stripe_w - 3, awning_y + 8),
                (wall_left + i * stripe_w - 3, awning_y + 8),
            ],
            fill=color,
        )
    return img


BUILDING_GENERATORS: dict[str, BuildingGenerator] = {
    "well": well_sprite,
    "house": house_sprite,
    "school": school_sprite,
    "post-office": post_office_sprite,
    "store": store_sprite,
}
