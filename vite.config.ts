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
        // "source-available", not "open source": the licence is PolyForm
        // Noncommercial, and the README goes out of its way to say this is
        // not the OSI meaning of the term. An install card is a worse place
        // than most to contradict your own licence.
        description: "A free-to-play, source-available, on-device educational RPG.",
        start_url: ".",
        scope: ".",
        display: "standalone",
        background_color: "#000000",
        theme_color: "#000000",
        // One drawing at 64px, exported at whole multiples of itself, so
        // every size is the same picture rather than a resample of it — an
        // icon a platform has smoothed is the one place a pixel-art game
        // stops looking like one. Relative `src` resolves against the
        // manifest's own URL, which is what keeps `base: "./"` portable.
        //
        // `any` and not `maskable`: the drawing runs to its own border on
        // all four edges, and a maskable icon is cropped to a circle inside
        // it — declaring both would clip the border off and take the top of
        // the hat with it, on Android only, long after this was tested.
        icons: [
          { src: "./icon-64.png", sizes: "64x64", type: "image/png", purpose: "any" },
          { src: "./icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "./icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
        ],
      },
      workbox: {
        // Phaser loads atlases/spritesheets via its own loader at runtime
        // (see BootScene.ts), which the Vite build never sees — Workbox's
        // default globPatterns (**/*.{js,wasm,css,html}) does NOT cover
        // them, so they'd silently be missing from the offline precache.
        // `png` covers the terrain atlas page and the building sheets;
        // `json` covers the atlas index and the sprite sidecars, which are
        // fetched at runtime exactly like the images and are just as fatal
        // to miss. Extend this list again for whatever else actually lands
        // under public/assets (audio, ...) rather than guessing ahead of it.
        globPatterns: ["**/*.{js,wasm,css,html,png,json}"],
        // The largest asset is the terrain atlas page (~850KB), comfortably
        // under maximumFileSizeToCacheInBytes' 2MB default. Raise it if a
        // future atlas needs a second page.
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
