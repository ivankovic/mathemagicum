// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import { readFileSync, statSync } from "node:fs";
import { FACE, FACE_RANGES } from "./parchment";

/**
 * The lettering, and the three things about it that can quietly stop being
 * true.
 *
 * A font is not like the rest of the art. Everything else is loaded by name
 * through Phaser, so a missing sprite is a missing sprite and `assets.test`
 * catches it; this one is fetched by a stylesheet, named by a string in
 * another file, and cut down to a list of characters nobody can see. Each of
 * those is a join, and each join is somewhere the two halves can drift apart
 * without anything failing until a child is looking at it.
 */

const FAMILY = FACE.split(",")[0]?.trim() ?? "";
const FONT_FILE = "public/fonts/andika.woff2";
const html = readFileSync("index.html", "utf8");

describe("the face the game is written in", () => {
  // The file is really there and is really a font. A path that 404s shows up
  // as every label in the game silently falling back to whatever the browser
  // has, which is exactly what this was meant to stop.
  test("ships with the game", () => {
    expect(statSync(FONT_FILE).size).toBeGreaterThan(5_000);
    expect(readFileSync(FONT_FILE).subarray(0, 4).toString("latin1")).toBe("wOF2");
  });

  /**
   * And the stylesheet and the code agree about what it is called.
   *
   * Two files name this face: `index.html` declares it and every text object
   * in the game asks for it by `FACE`. Neither knows about the other, and a
   * rename in one of them is a game that boots, runs, and is written in the
   * browser's default sans.
   */
  test("is declared under the same name the game asks for", () => {
    expect(html).toContain(`font-family: "${FAMILY}"`);
    expect(html).toContain(FONT_FILE.replace("public", ""));
  });

  test("is fetched before it is needed, and only from this device", () => {
    expect(html).toContain('rel="preload"');
    // Nothing from a font service. The game is played offline, and a face
    // that arrived over the network would be a face that did not arrive.
    expect(html).not.toContain("fonts.googleapis.com");
    expect(html).not.toContain("fonts.gstatic.com");
  });

  /**
   * And it can write every word the game knows.
   *
   * The face is subset to keep it small, which makes the phrase books a
   * promise: a sentence with a character outside `FACE_RANGES` renders as an
   * empty box. The person who would add one is a translator working in a
   * language they read and the rest of us do not, so the failure would be
   * invisible to everybody able to fix it — which is the whole reason this
   * test is worth its weight.
   *
   * Read out of the source rather than by calling the phrase functions: many
   * of them take arguments, and what matters here is every character that
   * appears in the file, not every sentence it can build.
   */
  test("has a letter for every one the phrase books use", () => {
    const missing = new Set<string>();
    for (const language of ["en", "de", "hr"]) {
      const source = readFileSync(`src/i18n/${language}.ts`, "utf8");
      for (const letter of source) {
        const at = letter.codePointAt(0) ?? 0;
        // Newlines and tabs are in the file and are not letters. Nothing
        // below a space is ever drawn.
        if (at < 0x20) continue;
        if (FACE_RANGES.some(([from, to]) => at >= from && at <= to)) continue;
        missing.add(letter);
      }
    }
    expect([...missing]).toEqual([]);
  });

  // A child types their own name, and a keyboard can produce more than the
  // phrase books do. These are the letters the three languages are written
  // with, which is as far as a subset can sensibly reach.
  test("and for the names the children who play it are likely to have", () => {
    for (const letter of "ČčĆćŠšŽžĐđÄäÖöÜüßÉéÁáÍíÓóÚúÑñ") {
      const at = letter.codePointAt(0) ?? 0;
      const covered = FACE_RANGES.some(([from, to]) => at >= from && at <= to);
      expect({ letter, covered }).toEqual({ letter, covered: true });
    }
  });
});
