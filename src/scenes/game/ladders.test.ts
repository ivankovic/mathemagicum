// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import { DEFAULT_AVATAR } from "../../avatar/style";
import { type Profile, createProfile } from "../../save/profiles";
import { Language } from "../../settings";
import { DEFAULT_BAND } from "../../spells/difficulty";
import { parseDevOptions } from "../devHooks";
import { Ladders } from "./ladders";

const clean = { solved: true, clean: true };
const muddled = { solved: true, clean: false };

function harness(search = "") {
  let profile: Profile = createProfile(
    [],
    { name: "Ana", avatar: DEFAULT_AVATAR, language: Language.English, band: DEFAULT_BAND },
    1000,
  );
  const saved: Partial<Profile>[] = [];
  const ladders = new Ladders({
    profile: () => profile,
    dev: () => parseDevOptions(search),
    save: (change) => {
      saved.push(change);
      profile = { ...profile, ...change };
    },
  });
  return { ladders, saved, profile: () => profile };
}

describe("Ladders", () => {
  test("reads the child's rung until a dev seam holds it", () => {
    expect(harness().ladders.held("rung")).toBe(harness().profile().rung);
    expect(harness("?rung=9").ladders.held("rung")).toBe(9);
  });

  test("climbs after a run of clean casts, and empties the window it climbed on", () => {
    const { ladders, saved, profile } = harness();
    const from = profile().brickRung;
    for (let i = 0; i < 3; i++) expect(ladders.note("brickRung", clean)).toBe(false);
    expect(ladders.note("brickRung", clean)).toBe(true);
    expect(profile().brickRung).toBe(from + 1);
    expect(saved).toEqual([{ brickRung: from + 1 }]);
    expect(ladders.window("brickRung")).toEqual([]);
    expect(ladders.window("rung")).toEqual([]);
  });

  test("moves nothing while a dev seam holds the spell still", () => {
    const { ladders, saved } = harness("?brickRung=2");
    for (let i = 0; i < 4; i++) expect(ladders.note("brickRung", clean)).toBe(false);
    expect(saved).toEqual([]);
  });

  test("keeps every ladder's window apart", () => {
    const { ladders } = harness();
    ladders.note("rung", clean);
    ladders.note("shareRung", muddled);
    expect(ladders.window("rung")).toEqual([true]);
    expect(ladders.window("shareRung")).toEqual([false]);
    ladders.empty(["rung"]);
    expect(ladders.window("rung")).toEqual([]);
    expect(ladders.window("shareRung")).toEqual([false]);
  });
});
