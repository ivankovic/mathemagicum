# Contributing

Thanks for your interest in contributing.

## Setup

```sh
bun install
bun run dev
```

`bun install` also installs the git hooks (via `lefthook install`, run
automatically as the `prepare` script). Pre-commit runs Biome on the staged
files, and `tsc --noEmit` and `bun test` on the whole project whenever a
TypeScript file is staged (see `lefthook.yml`; the whole-project run is about
twenty-five seconds).

## Before opening a PR

```sh
bun run lint
bun run typecheck
bun run test
bun run build
bun run e2e
```

CI runs the same checks and must pass before merge. The last one is the
browser suite and takes about twenty minutes; it needs Chromium once,
installed with

```sh
bun node_modules/playwright/cli.js install chromium
```

— through `bun` rather than `bunx`, because Playwright's CLI has a
`#!/usr/bin/env node` shebang and picks up whatever old Node the host has.

## What the coverage number means

`bun run test:coverage` reports about 95% of lines. **That is not 95% of
`src/`.** Bun instruments the files a test actually loads and averages over
those, so a file no test imports is missing from the denominator rather than
counted as nought — and about half the production code is in that position:
every panel in `src/ui`, `GameScene`, `BootScene`, `chunkStreamer`,
`lighting`, `sound`. Weighted by line across the whole of `src/`, the real
figure is nearer 48%.

The gap is the shape of the thing rather than a hole in it. Those files are
the renderer and the input adapter; the rules they draw live in `src/world`
and `src/spells` behind them, which is where the unit tests are and why they
reach into the nineties there. What drives the other half is `bun run e2e` —
which is why a change to a panel or to `GameScene` is not covered by a green
`bun test`, and why the browser suite is not optional before a PR.

Do not try to put a floor under the number in `bunfig.toml`. Bun parses
`coverageThreshold` and, as of 1.3.14, does not act on it: the suite passes a
demand for 99% while measuring 95%. A gate that does nothing reads like a
gate that works.

## Licensing your contribution

This project is licensed PolyForm-Noncommercial-1.0.0 for code and
CC-BY-NC-ND-4.0 for creative assets (art, audio) — see
[`REUSE.toml`](REUSE.toml). By submitting a contribution, you agree to
license it under the same terms as the file(s) you're changing.
