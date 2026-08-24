// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import { SPELLS } from "../spells/spellbook";
import { ALL_PLACES, ALL_SPELLS, parseDevOptions, places } from "./devHooks";

describe("parseDevOptions", () => {
  test("asks for nothing when nothing is asked for", () => {
    expect(parseDevOptions("")).toEqual({
      seed: null,
      freezeNpcs: false,
      coins: 0,
      crops: 0,
      hungry: false,
      language: null,
      intro: false,
      wall: false,
      materials: 0,
      reached: [],
      portalRung: null,
      arrayRung: null,
      rung: null,
      clockRung: null,
      symmetryRung: null,
      brickRung: null,
      learned: [],
      flowers: [],
      hour: null,
      skipTitle: false,
      at: null,
    });
  });

  // The currency follows the language, so without this the German half of
  // the shop can only be reached by launching a differently-localed browser.
  test("reads a language override", () => {
    expect(parseDevOptions("?lang=de").language).toBe("de");
    expect(parseDevOptions("?lang=de-CH").language).toBe("de-CH");
    expect(parseDevOptions("?lang=").language).toBe(null);
  });

  // The welcome is given once and then remembered, which is right for a
  // player and useless for a test of it.
  test("reads a request for the welcome", () => {
    expect(parseDevOptions("?intro").intro).toBe(true);
    expect(parseDevOptions("").intro).toBe(false);
  });

  // Walking to a named place is the journey the portal spell exists to
  // save, and a slow way to find out whether its ruler is drawn right.
  test("reads the places to count as already reached", () => {
    expect(parseDevOptions("?reached=harbour").reached).toEqual(["harbour"]);
    expect(parseDevOptions("?reached=harbour,bigCity").reached).toEqual(["harbour", "bigCity"]);
    expect(parseDevOptions("?reached=all").reached).toEqual(ALL_PLACES as string[]);
    expect(parseDevOptions("?reached=").reached).toEqual([]);
    expect(parseDevOptions("").reached).toEqual([]);
  });

  // Kept rather than dropped: the profile checks them against the anchors it
  // knows, and swallowing a typo here would leave a script wondering why its
  // destination was still locked.
  test("an unknown place is passed through rather than swallowed", () => {
    expect(places("atlantis")).toEqual(["atlantis"]);
    expect(places(" harbour , bigCity ")).toEqual(["harbour", "bigCity"]);
  });

  // The portal spell is learned from the geometer, so without this every
  // script that wants it has to walk into the tower and tap him first —
  // which is a test of the gate rather than of the thing being tested.
  test("reads the spells to count as already taught", () => {
    expect(parseDevOptions("?learned=portal").learned).toEqual(["portal"]);
    expect(parseDevOptions("?learned=all").learned).toEqual(ALL_SPELLS as string[]);
    // Every spell there is, not every spell there was. This was a hand-kept
    // list and it fell two spells behind the spellbook, so `?learned=all`
    // silently could not reach the two newest ones.
    expect([...ALL_SPELLS].sort()).toEqual([...SPELLS].sort());
    expect(parseDevOptions("").learned).toEqual([]);
  });

  // The one spell with four visibly different parchments, and which one a
  // child sees comes from a profile `?skipTitle` deliberately does not make.
  test("reads a portal rung to cast at", () => {
    expect(parseDevOptions("?portalRung=0").portalRung).toBe(0);
    expect(parseDevOptions("?portalRung=9").portalRung).toBe(9);
    expect(parseDevOptions("?portalRung=").portalRung).toBe(null);
    expect(parseDevOptions("").portalRung).toBe(null);
  });

  // Night is a third of the day and the game follows the player's own clock,
  // so without this a look at the lighting means waiting for evening.
  test("reads a pinned clock", () => {
    expect(parseDevOptions("?hour=22").hour).toBe(22);
    expect(parseDevOptions("?hour=6.5").hour).toBe(6.5);
    expect(parseDevOptions("?hour=").hour).toBe(null);
    expect(parseDevOptions("").hour).toBe(null);
  });

  // The title card waits to be tapped, which no script wants to do before it
  // can even see the world.
  test("reads a request to skip the title", () => {
    expect(parseDevOptions("?skipTitle").skipTitle).toBe(true);
    expect(parseDevOptions("").skipTitle).toBe(false);
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
    // Same clamping for a basketful, which is the other thing a script needs
    // to be handed rather than to earn.
    expect(parseDevOptions("?crops=3").crops).toBe(3);
    expect(parseDevOptions("?crops=-1").crops).toBe(0);
  });

  test("several at once", () => {
    expect(parseDevOptions("?seed=7&freezeNpcs&coins=40&lang=de")).toEqual({
      seed: 7,
      freezeNpcs: true,
      coins: 40,
      crops: 0,
      hungry: false,
      language: "de",
      intro: false,
      wall: false,
      materials: 0,
      reached: [],
      portalRung: null,
      arrayRung: null,
      rung: null,
      clockRung: null,
      symmetryRung: null,
      brickRung: null,
      learned: [],
      flowers: [],
      hour: null,
      skipTitle: false,
      at: null,
    });
  });
});

describe("standing somewhere in particular", () => {
  // The world is five hundred tiles across and most of what is worth looking
  // at is nowhere near where the player starts.
  test("a pair of whole numbers is a tile", () => {
    expect(parseDevOptions("?at=12,340").at).toEqual({ col: 12, row: 340 });
    expect(parseDevOptions("?at=0,0").at).toEqual({ col: 0, row: 0 });
  });

  // Anything else is nothing, rather than a tile made of guesses: a script
  // that mistyped this should start where it always starts, not somewhere
  // arbitrary it will then report on.
  test("anything else is not", () => {
    for (const raw of ["", "12", "12,", ",5", "a,b", "1,2,3", "1.5,2", "-1,4", "4,-1"]) {
      expect({ raw, at: parseDevOptions(`?at=${raw}`).at }).toEqual({ raw, at: null });
    }
    expect(parseDevOptions("").at).toBeNull();
  });
});
