# Contributing

Thanks for your interest in contributing.

## Setup

```sh
bun install
bun run dev
```

`bun install` also installs the git hooks (via `lefthook install`, run
automatically as the `prepare` script). Pre-commit runs Biome and `tsc
--noEmit` on staged files.

## Before opening a PR

```sh
bun run lint
bun run typecheck
bun run test
bun run build
```

CI runs the same checks and must pass before merge.

## Licensing your contribution

This project is licensed PolyForm-Noncommercial-1.0.0 for code and
CC-BY-NC-ND-4.0 for creative assets (art, audio) — see
[`REUSE.toml`](REUSE.toml). By submitting a contribution, you agree to
license it under the same terms as the file(s) you're changing.
