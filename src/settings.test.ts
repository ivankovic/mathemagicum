// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import {
  DEFAULT_SETTINGS,
  LANGUAGES,
  LANGUAGE_NAMES,
  Language,
  SETTINGS_KEY,
  type Settings,
  type SettingsStore,
  languageOf,
  readSettings,
  settingsWithOverrides,
  writeSettings,
} from "./settings";

function memory(initial?: string): SettingsStore & { written: string | null } {
  let value = initial ?? null;
  return {
    getItem: () => value,
    setItem: (_key, next) => {
      value = next;
    },
    get written() {
      return value;
    },
  };
}

describe("reading a language tag", () => {
  test("German in any country is German", () => {
    for (const tag of ["de", "de-DE", "de-CH", "de-AT", "DE-ch"]) {
      expect(languageOf(tag)).toBe(Language.German);
    }
  });

  /**
   * The one that was wrong, and was asserted wrong here for a year.
   *
   * `hr` sat in the list below while there were two phrase books and it was
   * simply an unknown tag. There are three now, and nothing moved it — so a
   * saved Croatian player came back English, because that is the same
   * function a profile's language is read through.
   */
  test("Croatian in any country is Croatian", () => {
    for (const tag of ["hr", "hr-HR", "hr-BA", "HR-ba"]) {
      expect(languageOf(tag)).toBe(Language.Croatian);
    }
  });

  test("every language the game has speaks for itself", () => {
    for (const language of LANGUAGES) expect(languageOf(language)).toBe(language);
  });

  test("anything else is English, including nothing at all", () => {
    for (const tag of ["en", "en-GB", "fr-CH", "sv", "", null, undefined]) {
      expect(languageOf(tag)).toBe(Language.English);
    }
  });
});

describe("remembering the choice", () => {
  test("with nothing saved, the browser's language is the first guess", () => {
    expect(readSettings(memory(), "de-CH")).toEqual({
      ...DEFAULT_SETTINGS,
      language: Language.German,
    });
    expect(readSettings(memory(), "en-GB")).toEqual(DEFAULT_SETTINGS);
  });

  test("what was written comes back", () => {
    const store = memory();
    const chosen: Settings = { ...DEFAULT_SETTINGS, language: Language.German };
    writeSettings(store, chosen);
    expect(readSettings(store, "en")).toEqual(chosen);
  });

  // A saved choice is a choice; the browser's language must not overrule it.
  test("a saved language beats the browser's", () => {
    const store = memory();
    writeSettings(store, { ...DEFAULT_SETTINGS, language: Language.English });
    expect(readSettings(store, "de-DE").language).toBe(Language.English);
  });

  test("rubbish in storage costs at most the field that is rubbish", () => {
    const store = memory(JSON.stringify({ language: "klingon" }));
    expect(readSettings(store, "de")).toEqual({ ...DEFAULT_SETTINGS, language: Language.German });
  });

  // Anybody who played while the game offered kuna, francs and euros has a
  // `money` key in their storage. Dropping the field must not cost them the
  // language they chose, and an unknown key must not read as corruption.
  test("a settings blob from before the money was dropped still loads", () => {
    const store = memory(JSON.stringify({ language: "de", money: "franc", introSeen: true }));
    expect(readSettings(store, "en")).toEqual({ ...DEFAULT_SETTINGS, language: Language.German });
  });

  test("unparseable storage falls back rather than throwing", () => {
    expect(readSettings(memory("{not json"), "de")).toEqual({
      ...DEFAULT_SETTINGS,
      language: Language.German,
    });
    expect(readSettings(memory("null"), "en")).toEqual(DEFAULT_SETTINGS);
  });

  test("the sound choice comes back too", () => {
    const store = memory();
    writeSettings(store, { ...DEFAULT_SETTINGS, sound: false });
    expect(readSettings(store, "en").sound).toBe(false);
  });

  /**
   * A settings file written before the game had any sound.
   *
   * Every device that has ever played this has one. The field is missing
   * from all of them, and what they must get is the default rather than
   * `undefined` — which is falsy, and would have quietly shipped a game that
   * is silent for every existing player and audible only for new ones.
   */
  test("a settings blob from before there was sound still loads, with sound", () => {
    const store = memory(JSON.stringify({ language: "hr" }));
    expect(readSettings(store, "en")).toEqual({ ...DEFAULT_SETTINGS, language: Language.Croatian });
    expect(readSettings(store, "en").sound).toBe(true);
  });

  test("and a music field that is not a yes or a no is rubbish, like any other", () => {
    const store = memory(JSON.stringify({ language: "de", sound: "loud" }));
    expect(readSettings(store, "en").sound).toBe(DEFAULT_SETTINGS.sound);
    expect(readSettings(store, "en").language).toBe(Language.German);
  });

  // Storage switched off is a supported way to play, not an error path.
  test("no storage at all still gives a playable set", () => {
    expect(readSettings(null, "de")).toEqual({ ...DEFAULT_SETTINGS, language: Language.German });
    expect(() => writeSettings(null, DEFAULT_SETTINGS)).not.toThrow();
  });

  test("a store that throws on write does not take the game down with it", () => {
    const angry: SettingsStore = {
      getItem: () => {
        throw new Error("no storage here");
      },
      setItem: () => {
        throw new Error("quota");
      },
    };
    expect(readSettings(angry, "en")).toEqual(DEFAULT_SETTINGS);
    expect(() => writeSettings(angry, DEFAULT_SETTINGS)).not.toThrow();
  });

  test("it is saved under one key, so nothing else has to know the shape", () => {
    const store = memory();
    writeSettings(store, DEFAULT_SETTINGS);
    expect(SETTINGS_KEY).toContain("mathemagicum");
    expect(JSON.parse(store.written as string)).toEqual(DEFAULT_SETTINGS);
  });
});

describe("a run's overrides", () => {
  const saved: Settings = { ...DEFAULT_SETTINGS, language: Language.English };

  test("nothing asked for leaves the saved settings alone", () => {
    expect(settingsWithOverrides(saved, {})).toEqual(saved);
    expect(settingsWithOverrides(saved, { language: null })).toEqual(saved);
  });

  test("a language override wins over what was saved", () => {
    const run = settingsWithOverrides(saved, { language: "de-CH" });
    expect(run.language).toBe(Language.German);
  });

  test("it never writes anything back", () => {
    const before = { ...saved };
    settingsWithOverrides(saved, { language: "de" });
    expect(saved).toEqual(before);
  });
});
