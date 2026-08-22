// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import { phrasesFor } from "../i18n";
import { Language } from "../settings";
import { SOURCE_URL, SPONSOR_URL } from "./AboutPanel";

/**
 * The About screen is mostly words, and the words are the point.
 *
 * Nothing here checks a layout — that is what the screenshots are for. What
 * these check is the half of it that would fail silently: a link pointing at
 * the wrong account, or a paragraph about money that has quietly lost the
 * sentence telling people not to spend any.
 */

const LANGUAGES = [Language.English, Language.German] as const;

describe("where the two buttons go", () => {
  test("both are GitHub, over https, and nowhere else", () => {
    for (const url of [SOURCE_URL, SPONSOR_URL]) {
      const at = new URL(url);
      expect(at.protocol).toBe("https:");
      expect(at.hostname).toBe("github.com");
    }
  });

  /**
   * The sponsors page belongs to whoever owns the source. They are two
   * separate strings and a typo in either would send somebody's money to a
   * stranger with a similar name — which is the one mistake on this screen
   * that costs a reader something.
   */
  test("and both belong to the same account", () => {
    const owner = (url: string) => new URL(url).pathname.split("/").filter(Boolean);
    expect(owner(SOURCE_URL)[0]).toBe(owner(SPONSOR_URL)[1] ?? "");
    expect(owner(SPONSOR_URL)[0]).toBe("sponsors");
  });
});

describe("what the money paragraph says", () => {
  /**
   * The sentence the whole paragraph exists for, in the author's own
   * capitals. A translation or a tidy-up that softened it would be editing
   * somebody's ethics for them, and it would read as an oversight rather
   * than as a decision.
   */
  test("it tells people not to spend, in capitals, in every language", () => {
    for (const language of LANGUAGES) {
      const note = phrasesFor(language).sponsorNote;
      expect(note).toMatch(/\bNOT\b|\bKEIN\b/);
    }
  });

  test("and it says the game is free before it mentions paying", () => {
    for (const language of LANGUAGES) {
      const note = phrasesFor(language).sponsorNote;
      const free = note.search(/free|kostenlos/i);
      const paying = note.search(/sponsor/i);
      expect({ language, free: free >= 0, paying: paying >= 0 }).toEqual({
        language,
        free: true,
        paying: true,
      });
      // The order is the argument: it is free, and *then* here is how to
      // give. Reversed, the first thing a parent reads is a request.
      expect(free).toBeLessThan(paying);
    }
  });

  test("and it names who should not pay", () => {
    const who: Record<string, readonly RegExp[]> = {
      [Language.English]: [/student/i, /single parent/i, /financial/i],
      [Language.German]: [/studier/i, /alleinerziehend/i, /finanziell/i],
    };
    for (const language of LANGUAGES) {
      const note = phrasesFor(language).sponsorNote;
      for (const pattern of who[language] ?? []) {
        expect({ language, pattern: String(pattern), said: pattern.test(note) }).toEqual({
          language,
          pattern: String(pattern),
          said: true,
        });
      }
    }
  });

  // A note to the author about which button to draw, not prose for a reader.
  // It was in the text as written and would have shipped as a stray
  // parenthesis in the middle of a sentence.
  test("and carries no leftover authoring note", () => {
    for (const language of LANGUAGES) {
      expect(phrasesFor(language).sponsorNote).not.toContain("(button link)");
    }
  });
});

describe("who made it", () => {
  test("every language says so, and says the licence", () => {
    for (const language of LANGUAGES) {
      const words = phrasesFor(language);
      expect(words.madeBy).toContain("Marko Ivankovic");
      expect(words.copyright).toContain("2026");
      expect(words.licenceLine).toContain("PolyForm");
      // The art is licensed apart from the code, and the notice has to say
      // both or it is telling a reader the wrong thing about half of it.
      expect(words.licenceLine).toContain("CC BY-NC-ND");
    }
  });
});
