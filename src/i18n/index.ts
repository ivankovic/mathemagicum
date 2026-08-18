// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { Language } from "../settings";
import { DE } from "./de";
import { EN } from "./en";
import type { Phrases } from "./phrases";

export type { Noun, Phrases } from "./phrases";
export { EN } from "./en";
export { DE } from "./de";

const BOOKS: Record<Language, Phrases> = {
  [Language.English]: EN,
  [Language.German]: DE,
};

/**
 * The phrase book for a language.
 *
 * Everything that writes for the player takes one of these rather than
 * reaching for a global: the rules are tested without a browser and without a
 * language, and a scene that switches language has to hand the new book to
 * each of them, which is a list a reader can check.
 */
export function phrasesFor(language: Language): Phrases {
  return BOOKS[language] ?? EN;
}
