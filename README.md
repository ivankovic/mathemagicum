# Mathemagicum

A free-to-play, source-available, on-device educational RPG. Pixel art,
isometric view, runs entirely in the browser — no server, no account, no
network required after the first load.

Source is publicly readable and modifiable for noncommercial use (see
[License](#license)) — not OSI/FSF "open source," which requires permitting
commercial use.

## Status

Repo/toolchain scaffold only. No gameplay yet.

## Stack

- [Bun](https://bun.sh) — runtime, package manager, test runner
- [Phaser 3](https://phaser.io) — game framework (TypeScript)
- [Vite](https://vitejs.dev) — dev server / static build (+ `vite-plugin-pwa` for offline support)
- [Biome](https://biomejs.dev) — lint + format
- [Lefthook](https://github.com/evilmartians/lefthook) — git hooks

## Getting started

```sh
bun install
bun run dev       # dev server
bun run test      # bun:test
bun run typecheck # tsc --noEmit
bun run lint      # biome check
bun run build     # production build to dist/
```

> `dev`/`build`/`preview` run through `bunx --bun` rather than plain `vite`:
> Vite's bin has a `#!/usr/bin/env node` shebang, and the PWA plugin's
> Workbox dependency crashes under Node <19 (no global WebCrypto). Forcing
> Bun's own runtime sidesteps the host's Node version entirely.

## License

- Source code: [PolyForm Noncommercial 1.0.0](LICENSE) — noncommercial use,
  modification, and redistribution only.
- Art, audio, and other creative assets (once added): CC-BY-NC-ND-4.0.

See [`REUSE.toml`](REUSE.toml) for the per-path license mapping.
