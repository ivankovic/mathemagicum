# SPDX-FileCopyrightText: 2026 Marko Ivankovic
# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

"""Base terrain colors, kept in sync by eye with src/world/palette.ts's
TERRAIN_COLORS — generated tiles should read as the same palette the game's
placeholder flat-color diamonds already use, just textured."""

RGB = tuple[int, int, int]

BASE_COLORS: dict[str, RGB] = {
    "grass": (0x4C, 0xAF, 0x50),
    "dirt": (0x8D, 0x6E, 0x63),
    "sand": (0xE0, 0xC6, 0x8C),
    "water": (0x4F, 0xA8, 0xD8),
    "rock": (0x9E, 0x9E, 0x9E),
}


def shade(rgb: RGB, factor: float) -> RGB:
    """Lighten (factor > 1, toward white) or darken (factor < 1, toward
    black) a color. factor == 1 returns it unchanged."""
    r, g, b = rgb
    if factor >= 1:
        t = min(factor - 1.0, 1.0)
        return (
            round(r + (255 - r) * t),
            round(g + (255 - g) * t),
            round(b + (255 - b) * t),
        )
    t = max(factor, 0.0)
    return (round(r * t), round(g * t), round(b * t))
