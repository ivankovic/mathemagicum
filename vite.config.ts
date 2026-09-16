// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// Relative base keeps the build portable across hosting targets (GitHub
// Pages project subpath, Cloudflare Pages root, itch.io zip upload, etc.)
// without a rebuild. Override with VITE_BASE at build time once a host is
// chosen, if an absolute path ever turns out to be required.
const base = process.env.VITE_BASE ?? "./";

export default defineConfig({
  base,
  // Listen on every interface, not just loopback, so the game can be opened
  // from a phone or a tablet on the same network — which is the only way to
  // find out how the trays and the parchments behave under a thumb, and the
  // only way to hear the synthesised music through a speaker that is not
  // this one. `bun run dev` then prints a Network: line with the address to
  // type; `bunx --bun vite --host localhost` still overrides it for a run
  // that should stay private — note that `--host false` does *not*: Vite
  // takes the word as a hostname, fails to resolve it, and then reports
  // port after port as "in use" until you stop it.
  server: {
    host: true,
    // Vite refuses requests whose Host header is a name it was not told
    // about (its answer to DNS rebinding), and the default exemption covers
    // bare IP addresses only. A LAN IP therefore already works; an mDNS
    // name like `core.local`, which is what a phone is actually given, does
    // not. A leading dot matches the suffix, so this admits any `*.local`
    // and nothing beyond the house.
    allowedHosts: [".local"],
  },
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
        // to miss. `json` also covers the music and the sound effects: there
        // is no audio *file* in this game — `public/assets/music/*.json` and
        // `assets/sfx/sfx.json` are scores (`"format": "mathemagicum-score"`)
        // that `src/audio/` synthesises at play time — so there is no .ogg
        // or .mp3 to add here, and `sound.ts` relies on this glob to keep
        // the music playing on a train. Extend this list again for whatever
        // else actually lands under public/assets rather than guessing
        // ahead of it.
        //
        // `woff2` is the lettering, which is fetched by the stylesheet
        // rather than by Phaser and would otherwise be the one thing in the
        // game that needed the network. It is twenty kilobytes and the whole
        // interface is written in it.
        globPatterns: ["**/*.{js,wasm,css,html,png,json,woff2}"],
        // The largest assets are the terrain atlas index (terrain.json,
        // ~1.0MB) and its page (terrain-0.png, ~950KB), both under
        // maximumFileSizeToCacheInBytes' 2MB default — anything over it is
        // silently left out of the precache, so check `find public -type f
        // -printf '%s %p\n' | sort -n | tail` when an atlas grows, and raise
        // the limit here before the first one crosses it.
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
