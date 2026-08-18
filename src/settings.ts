// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { Currency, currencyForLanguage } from "./shop/currency";

/**
 * The two things the player gets to decide about, and where they are kept.
 *
 * The language and the money used to be worked out from the browser and left
 * at that: whatever `navigator.language` said, with the currency falling out
 * of it. That is a fine default and a bad rule. A German-speaking child may
 * be reading the game on a household machine set to English, and a child in
 * Zagreb may want to count francs precisely *because* they are foreign.
 *
 * So the browser only supplies the first guess. After that the player's own
 * choice wins, and it is remembered — these are the first two things the game
 * saves at all, which is deliberate: a setting you have to make again every
 * time is not a setting.
 *
 * Storage is passed in rather than reached for. It makes the rules testable
 * without a browser, and it means a machine with storage switched off gets
 * defaults instead of an exception on the way to the title screen.
 */

export const Language = {
  English: "en",
  German: "de",
} as const;

export type Language = (typeof Language)[keyof typeof Language];

export const LANGUAGES: readonly Language[] = [Language.English, Language.German];

/** Every language reads its own name in itself; a menu in a language you do not read is no help. */
export const LANGUAGE_NAMES: Record<Language, string> = {
  [Language.English]: "English",
  [Language.German]: "Deutsch",
};

/**
 * "Follow the language" is a real answer, not a missing one.
 *
 * Keeping it distinct from the currency it resolves to means a player who
 * switches language gets the money that goes with it, instead of being stuck
 * with whatever the currency was when they last looked at this screen.
 */
export const FOLLOW_LANGUAGE = "auto";

export type MoneyChoice = typeof FOLLOW_LANGUAGE | Currency;

export const MONEY_CHOICES: readonly MoneyChoice[] = [
  FOLLOW_LANGUAGE,
  Currency.Kuna,
  Currency.Franc,
  Currency.Euro,
];

export interface Settings {
  readonly language: Language;
  readonly money: MoneyChoice;
  /**
   * Whether the postal worker has already walked the player through the
   * basics.
   *
   * Saved for the same reason the other two are: a tutorial that interrupts
   * every single load is one the player learns to dismiss without reading,
   * which is worse than not having one. He still walks over and can still be
   * tapped for it again — what is remembered is only whether it opens by
   * itself.
   */
  readonly introSeen: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  language: Language.English,
  money: FOLLOW_LANGUAGE,
  introSeen: false,
};

/** What the game can read a language tag as. `de-CH`, `de-AT` and `de` all agree. */
export function languageOf(tag: string | null | undefined): Language {
  const lower = (tag ?? "").toLowerCase();
  return lower === "de" || lower.startsWith("de-") ? Language.German : Language.English;
}

/** Which coins are in the purse, given both choices. */
export function currencyFor(settings: Settings): Currency {
  return settings.money === FOLLOW_LANGUAGE
    ? currencyForLanguage(settings.language)
    : settings.money;
}

/** Just enough of `localStorage` to keep two strings, so tests need no browser. */
export interface SettingsStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const SETTINGS_KEY = "mathemagicum.settings";

function isLanguage(value: unknown): value is Language {
  return LANGUAGES.includes(value as Language);
}

function isMoney(value: unknown): value is MoneyChoice {
  return MONEY_CHOICES.includes(value as MoneyChoice);
}

/**
 * What the player chose, or the best guess if they have not chosen.
 *
 * Each field is validated on its own, so a saved file from an older version
 * — or one somebody edited by hand — costs at most the field that no longer
 * makes sense rather than the whole set.
 */
export function readSettings(store: SettingsStore | null, browserLanguage?: string): Settings {
  const fallback: Settings = { ...DEFAULT_SETTINGS, language: languageOf(browserLanguage) };
  if (!store) return fallback;
  let saved: unknown;
  try {
    const raw = store.getItem(SETTINGS_KEY);
    if (raw === null) return fallback;
    saved = JSON.parse(raw);
  } catch {
    // Unreadable storage or unparseable contents: the defaults are still a
    // playable game, and a settings file is not worth a blank screen over.
    return fallback;
  }
  if (typeof saved !== "object" || saved === null) return fallback;
  const record = saved as Record<string, unknown>;
  return {
    language: isLanguage(record.language) ? record.language : fallback.language,
    money: isMoney(record.money) ? record.money : fallback.money,
    introSeen: record.introSeen === true,
  };
}

/** Remember a choice, or carry on without remembering it. */
export function writeSettings(store: SettingsStore | null, settings: Settings): void {
  if (!store) return;
  try {
    store.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Private browsing, a full quota, storage switched off. The game is
    // playable with the choice held only for this session.
  }
}

/** The browser's storage if there is one, and nothing if it is switched off. */
export function browserStore(): SettingsStore | null {
  try {
    const storage = globalThis.localStorage;
    // Touch it: some browsers hand back an object that throws on use.
    storage?.getItem(SETTINGS_KEY);
    return storage ?? null;
  } catch {
    return null;
  }
}
