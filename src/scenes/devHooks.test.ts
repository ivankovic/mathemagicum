// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import { parseDevOptions } from "./devHooks";

describe("parseDevOptions", () => {
  test("asks for nothing when nothing is asked for", () => {
    expect(parseDevOptions("")).toEqual({
      seed: null,
      freezeNpcs: false,
      coins: 0,
      language: null,
      money: null,
    });
  });

  // The currency follows the language, so without this the German half of
  // the shop can only be reached by launching a differently-localed browser.
  test("reads a language override", () => {
    expect(parseDevOptions("?lang=de").language).toBe("de");
    expect(parseDevOptions("?lang=de-CH").language).toBe("de-CH");
    expect(parseDevOptions("?lang=").language).toBe(null);
  });

  // The euro is the currency that behaves differently — small coins, so the
  // shop sells fewer at a time — and it is not the default in any language.
  test("reads a currency override", () => {
    expect(parseDevOptions("?money=euro").money).toBe("euro");
    expect(parseDevOptions("?money=").money).toBe(null);
    expect(parseDevOptions("").money).toBe(null);
  });

  test("reads a seed, so a script knows which sums it will be asked", () => {
    expect(parseDevOptions("?seed=12345").seed).toBe(12345);
  });

  // A bad seed silently becoming 0 would give a script a *different* set of
  // problems than it computed, and the failure would look like wrong answers.
  test("refuses a seed it cannot read rather than inventing one", () => {
    expect(parseDevOptions("?seed=banana").seed).toBe(null);
    expect(parseDevOptions("?seed=").seed).toBe(null);
  });

  test("freezing the villagers is on by being mentioned at all", () => {
    expect(parseDevOptions("?freezeNpcs").freezeNpcs).toBe(true);
    expect(parseDevOptions("?freezeNpcs=1").freezeNpcs).toBe(true);
    expect(parseDevOptions("?seed=1").freezeNpcs).toBe(false);
  });

  test("starting coins are read, and never negative", () => {
    expect(parseDevOptions("?coins=100").coins).toBe(100);
    expect(parseDevOptions("?coins=-5").coins).toBe(0);
    expect(parseDevOptions("?coins=2.9").coins).toBe(2);
  });

  test("several at once", () => {
    expect(parseDevOptions("?seed=7&freezeNpcs&coins=40&lang=de")).toEqual({
      seed: 7,
      freezeNpcs: true,
      coins: 40,
      language: "de",
      money: null,
    });
  });
});
