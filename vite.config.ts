import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// Relative base keeps the build portable across hosting targets (GitHub
// Pages project subpath, Cloudflare Pages root, itch.io zip upload, etc.)
// without a rebuild. Override with VITE_BASE at build time once a host is
// chosen, if an absolute path ever turns out to be required.
const base = process.env.VITE_BASE ?? "./";

export default defineConfig({
  base,
  build: {
    target: "es2022",
  },
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "Mathemagicum",
        short_name: "Mathemagicum",
        description: "A free, open-source, on-device educational RPG.",
        start_url: ".",
        scope: ".",
        display: "standalone",
        background_color: "#000000",
        theme_color: "#000000",
        // TODO: add real icons once art direction is settled.
        icons: [],
      },
      workbox: {
        // Phaser loads images/spritesheets/tilemaps/audio via its own
        // loader at runtime (see BootScene.ts), which the Vite build never
        // sees — Workbox's default globPatterns (**/*.{js,wasm,css,html})
        // does NOT cover them, so they'd silently be missing from the
        // offline precache. `png` covers the tileset from
        // tools/tileset-gen (public/assets/tiles/*.png, ~4KB each, well
        // under the default per-file cap); extend this list again for
        // whatever other asset types actually land under public/assets
        // (audio, atlases, ...) rather than guessing ahead of them now.
        globPatterns: ["**/*.{js,wasm,css,html,png}"],
        // Raise maximumFileSizeToCacheInBytes (default 2MB) once a real
        // spritesheet atlas exists — the current tiles are nowhere near it.
        // Workbox's SW bundler unconditionally `require`s terser, whose
        // serialize-javascript dependency calls crypto.getRandomValues() at
        // module load — that throws under the host's system Node if it's
        // <19 (no global WebCrypto by default). Bun always provides
        // globalThis.crypto, which is why package.json's scripts run vite
        // via `bunx --bun` rather than letting `bun run` fall through to
        // vite's `#!/usr/bin/env node` shebang and the system Node.
      },
    }),
  ],
});
