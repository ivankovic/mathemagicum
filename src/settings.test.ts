// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import {
  DEFAULT_SETTINGS,
  FOLLOW_LANGUAGE,
  LANGUAGES,
  LANGUAGE_NAMES,
  Language,
  MONEY_CHOICES,
  SETTINGS_KEY,
  type Settings,
  type SettingsStore,
  currencyFor,
  languageOf,
  readSettings,
  writeSettings,
} from "./settings";
import { Currency } from "./shop/currency";

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

  test("anything else is English, including nothing at all", () => {
    for (const tag of ["en", "en-GB", "hr", "fr-CH", "", null, undefined]) {
      expect(languageOf(tag)).toBe(Language.English);
    }
  });
});

describe("which money", () => {
  test("following the language gives kuna for English and francs for German", () => {
    expect(
      currencyFor({ language: Language.English, money: FOLLOW_LANGUAGE, introSeen: false }),
    ).toBe(Currency.Kuna);
    expect(
      currencyFor({ language: Language.German, money: FOLLOW_LANGUAGE, introSeen: false }),
    ).toBe(Currency.Franc);
  });

  // The whole point of the setting: a player may want the foreign coins.
  test("a chosen currency wins over the language", () => {
    expect(
      currencyFor({ language: Language.English, money: Currency.Franc, introSeen: false }),
    ).toBe(Currency.Franc);
    expect(currencyFor({ language: Language.German, money: Currency.Kuna, introSeen: false })).toBe(
      Currency.Kuna,
    );
  });

  test("following the language follows it when the language changes", () => {
    const settings: Settings = DEFAULT_SETTINGS;
    expect(currencyFor({ ...settings, language: Language.German })).toBe(Currency.Franc);
  });
});

describe("remembering the choice", () => {
  test("with nothing saved, the browser's language is the first guess", () => {
    expect(readSettings(memory(), "de-CH")).toEqual({
      language: Language.German,
      money: FOLLOW_LANGUAGE,
      introSeen: false,
    });
    expect(readSettings(memory(), "en-GB")).toEqual(DEFAULT_SETTINGS);
  });

  test("what was written comes back", () => {
    const store = memory();
    const chosen: Settings = {
      language: Language.German,
      money: Currency.Kuna,
      introSeen: true,
    };
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
    const store = memory(JSON.stringify({ language: "klingon", money: Currency.Franc }));
    expect(readSettings(store, "de")).toEqual({
      language: Language.German,
      money: Currency.Franc,
      introSeen: false,
    });
  });

  test("unparseable storage falls back rather than throwing", () => {
    expect(readSettings(memory("{not json"), "de")).toEqual({
      language: Language.German,
      money: FOLLOW_LANGUAGE,
      introSeen: false,
    });
    expect(readSettings(memory("null"), "en")).toEqual(DEFAULT_SETTINGS);
  });

  // Storage switched off is a supported way to play, not an error path.
  test("no storage at all still gives a playable set", () => {
    expect(readSettings(null, "de")).toEqual({
      language: Language.German,
      money: FOLLOW_LANGUAGE,
      introSeen: false,
    });
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

describe("what the menu offers", () => {
  test("every language on offer has a name to show for it", () => {
    for (const language of LANGUAGES) {
      expect(LANGUAGE_NAMES[language]?.length).toBeGreaterThan(0);
    }
  });

  // The one thing here that is progress rather than preference: it is only
  // ever true once, and a saved file that lost it would replay the tutorial.
  test("having seen the welcome is remembered", () => {
    const store = memory();
    writeSettings(store, { ...DEFAULT_SETTINGS, introSeen: true });
    expect(readSettings(store, "en").introSeen).toBe(true);
    expect(readSettings(memory(), "en").introSeen).toBe(false);
  });

  test("every money choice resolves to a currency", () => {
    for (const money of MONEY_CHOICES) {
      expect(currencyFor({ ...DEFAULT_SETTINGS, money })).toBeTruthy();
    }
  });

  // Every currency there is should be reachable from the menu; one that
  // existed in code and nowhere on screen would be dead weight.
  test("every currency is on offer", () => {
    for (const currency of Object.values(Currency)) {
      expect(MONEY_CHOICES).toContain(currency);
    }
  });
});
