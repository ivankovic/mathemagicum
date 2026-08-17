# SPDX-FileCopyrightText: 2026 Marko Ivankovic
# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

"""CLI entrypoint: `uv run building-gen`. Writes one PNG per building type
per variant into public/assets/buildings/ (see REUSE.toml — that directory
is CC-BY-NC-ND-4.0, separate from this tool's own PolyForm-Noncommercial-
1.0.0 code license). Deterministic by default: the same seed always
reproduces the same sprites."""

from .asset_cli import REPO_ROOT, run
from .buildings import BUILDING_GENERATORS

DEFAULT_OUT = REPO_ROOT / "public" / "assets" / "buildings"


def main() -> None:
    run(label="building", generators=BUILDING_GENERATORS, default_out=DEFAULT_OUT)


if __name__ == "__main__":
    main()
