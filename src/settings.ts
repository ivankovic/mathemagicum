// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

/**
 * What the player gets to decide about, and where it is kept.
 *
 * The language used to be worked out from the browser and left at that:
 * whatever `navigator.language` said. That is a fine default and a bad rule —
 * a German-speaking child may be reading the game on a household machine set
 * to English — so the browser only supplies the first guess and the player's
 * own choice wins after that.
 *
 * It is remembered, which is deliberate: a setting you have to make again
 * every time is not a setting. The money used to be a choice here too, back
 * when the game offered real currencies; there is one invented money now and
 * nothing to choose between (see src/shop/currency.ts).
 *
 * Storage is passed in rather than reached for. It makes the rules testable
 * without a browser, and it means a machine with storage switched off gets
 * defaults instead of an exception on the way to the title screen.
 */

export const Language = {
  English: "en",
  German: "de",
  Croatian: "hr",
} as const;

export type Language = (typeof Language)[keyof typeof Language];

export const LANGUAGES: readonly Language[] = [
  Language.English,
  Language.German,
  Language.Croatian,
];

/** Every language reads its own name in itself; a menu in a language you do not read is no help. */
export const LANGUAGE_NAMES: Record<Language, string> = {
  [Language.English]: "English",
  [Language.German]: "Deutsch",
  [Language.Croatian]: "Hrvatski",
};

/**
 * What the device remembers, as opposed to what a child does.
 *
 * Only one thing, and it is not the game's language: it is the language of
 * the screen that asks *who is playing*, which has to be written in
 * something before anybody has been chosen. It follows whoever played last,
 * so a household that reads German is not asked in English every morning.
 *
 * Everything else a player chose — their language in the game, their avatar,
 * their world, whether they have had the welcome — belongs to the player and
 * lives in their profile (`src/save/profiles.ts`). It used to live here, one
 * set for the whole device, which is the wrong shape for the machine this is
 * built for: two siblings sharing a tablet may not read the same language,
 * and the one who does not gets a game they cannot play.
 */
export interface Settings {
  readonly language: Language;
  /**
   * Whether the game makes any sound at all: the music and the world's own
   * noises together, under one switch.
   *
   * One switch and not two, which is a decision rather than a shortcut. A
   * parent who reaches for this has decided the room should be quiet, and
   * handing them a choice between "the tune" and "the coins" is asking them
   * to make a distinction they did not come here to make. It was called
   * `music` while music was all there was.
   *
   * Here rather than in a profile, and it is the same argument the language
   * of the who's-playing screen makes: that screen exists before anybody has
   * been chosen, and it is where the first touch of the session lands —
   * which is the touch a browser needs before it will make a sound at all. A
   * preference kept per player could not be consulted at the one moment it
   * has to be.
   *
   * It is also the shape the household wants. Two siblings may not read the
   * same language, but "not right now, we are at the table" is a fact about
   * the room and not about either of them.
   */
  readonly sound: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  language: Language.English,
  // On. A game that has to be switched on to have any sound is a game most
  // players will never hear, and the control is one tap away on the screen
  // every parent opens anyway.
  sound: true,
};

/**
 * What the game can read a language tag as. `de-CH`, `de-AT` and `de` all
 * agree, and anything it does not speak is English.
 *
 * Read off `LANGUAGES` rather than written out, which is the whole of a bug
 * this had. It used to test for German by hand and answer English to
 * everything else, and that was true for exactly as long as there were two
 * books. Croatian arrived and this was not touched — so `hr` came back
 * English, and because a *saved* language is read through here too, a child
 * who chose Croatian was handed English back on the next launch. A list that
 * has to be edited in two places to add a language is a list that will be
 * edited in one.
 *
 * The country is dropped before the match: a tag is a language and a place,
 * and the place has never been something this game varies on.
 */
export function languageOf(tag: string | null | undefined): Language {
  const spoken = (tag ?? "").toLowerCase().split("-")[0] ?? "";
  return LANGUAGES.find((language) => language === spoken) ?? Language.English;
}

/** Just enough of `localStorage` to keep the players and their worlds, so tests need no browser. */
export interface SettingsStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  /**
   * Optional because a store that cannot forget is still a usable store —
   * a test double keeping two strings has no reason to implement it — but a
   * device that deletes a player and keeps their world would be growing a
   * farm nothing can reach.
   */
  removeItem?(key: string): void;
}

export const SETTINGS_KEY = "mathemagicum.settings";

function isLanguage(value: unknown): value is Language {
  return LANGUAGES.includes(value as Language);
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
    // `music` is what this was called for the fortnight it governed only the
    // tune. Read as a second chance rather than migrated: a household that
    // had turned the music off and then found the coins chinking at them
    // would rightly file that as the switch having been ignored.
    sound:
      typeof record.sound === "boolean"
        ? record.sound
        : typeof record.music === "boolean"
          ? record.music
          : fallback.sound,
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

/**
 * The saved settings with a run's overrides applied.
 *
 * Two scenes need this — the title card has a language too — and neither
 * should be reaching into `?lang=` on its own: a card that greeted a German
 * player in English and then handed over to a German game would be the one
 * screen that had not been told.
 */
export function settingsWithOverrides(
  stored: Settings,
  overrides: { language?: string | null },
): Settings {
  return overrides.language ? { ...stored, language: languageOf(overrides.language) } : stored;
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
