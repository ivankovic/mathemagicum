// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import catalogueJson from "../../public/assets/characters/avatar.json";
import { applyRecolour, packRgb } from "../render/recolour";
import { recolourPlan } from "./recolour";
import {
  AVATAR_COLOURS,
  type AvatarCatalogue,
  DEFAULT_AVATAR,
  suggestedAvatar,
  usableAvatar,
} from "./style";

// The shipped file, not a fixture: the point of these is that the game and
// the art agree, and a hand-written catalogue would agree with itself.
const CATALOGUE = catalogueJson as unknown as AvatarCatalogue;

function pixelsOf(...colours: readonly (readonly number[])[]): Uint8ClampedArray {
  const data = new Uint8ClampedArray(colours.length * 4);
  colours.forEach((colour, index) => {
    data[index * 4] = colour[0] ?? 0;
    data[index * 4 + 1] = colour[1] ?? 0;
    data[index * 4 + 2] = colour[2] ?? 0;
    data[index * 4 + 3] = colour[3] ?? 255;
  });
  return data;
}

function colourAt(data: Uint8ClampedArray, index: number): number[] {
  return [...data.slice(index * 4, index * 4 + 4)];
}

describe("the catalogue the art ships", () => {
  test("offers every body as a loadable sheet name", () => {
    expect(CATALOGUE.bodies.length).toBeGreaterThan(1);
    expect(CATALOGUE.bodies).toContain(DEFAULT_AVATAR.body);
  });

  test("names a colour for every slot the recolour touches", () => {
    for (const colour of AVATAR_COLOURS) {
      expect(CATALOGUE.shipped_palette[colour]).toBeDefined();
      expect(CATALOGUE.shipped_palette[`${colour}_shade`]).toBeDefined();
      expect(CATALOGUE.options[colour].length).toBeGreaterThan(1);
    }
  });

  // The property the whole scheme rests on, checked from this side too: the
  // player used to wear the same colour on their shirt and their hat, and a
  // recolour of one would have moved the other.
  test("no two shipped slots are the same colour", () => {
    const values = Object.values(CATALOGUE.shipped_palette).map(packRgb);
    expect(new Set(values).size).toBe(values.length);
  });

  test("the default avatar is one the catalogue can draw", () => {
    expect(usableAvatar(CATALOGUE, DEFAULT_AVATAR)).toEqual(DEFAULT_AVATAR);
  });
});

describe("a style from an older save", () => {
  test("a body that no longer exists falls back rather than asking for a missing sheet", () => {
    const style = usableAvatar(CATALOGUE, { ...DEFAULT_AVATAR, body: "player-pirate" });
    expect(CATALOGUE.bodies).toContain(style.body);
  });

  test("a tone index off the end of the list costs that field and nothing else", () => {
    const style = usableAvatar(CATALOGUE, { body: "player", skin: 99, hair: 2, shirt: -1 });
    expect(style).toEqual({ body: "player", skin: 0, hair: 2, shirt: 0 });
  });

  test("a fractional index is not an index", () => {
    expect(usableAvatar(CATALOGUE, { ...DEFAULT_AVATAR, hair: 1.5 }).hair).toBe(0);
  });
});

describe("suggesting an avatar for the next child", () => {
  test("the first child gets the game's own character", () => {
    expect(suggestedAvatar(CATALOGUE, 0)).toEqual(DEFAULT_AVATAR);
  });

  // Two identical faces on the who's-playing screen is the one thing it
  // cannot show: a child tapping the wrong one loses their farm for a turn.
  test("no two of the first several children look alike", () => {
    const looks =
      CATALOGUE.bodies.length *
      CATALOGUE.options.skin.length *
      CATALOGUE.options.hair.length *
      CATALOGUE.options.shirt.length;
    const seen = new Set<string>();
    for (let taken = 0; taken < looks; taken++) {
      seen.add(JSON.stringify(suggestedAvatar(CATALOGUE, taken)));
    }
    expect(seen.size).toBe(looks);
    expect(looks).toBeGreaterThan(100);
  });

  test("every suggestion is one the art can draw", () => {
    for (let taken = 0; taken < 40; taken++) {
      const style = suggestedAvatar(CATALOGUE, taken);
      expect(usableAvatar(CATALOGUE, style)).toEqual(style);
    }
  });
});

describe("repainting a sheet", () => {
  const skin = CATALOGUE.shipped_palette.skin as readonly number[];
  const hair = CATALOGUE.shipped_palette.hair as readonly number[];
  const pants = CATALOGUE.shipped_palette.pants as readonly number[];
  const outline = CATALOGUE.shipped_palette.outline as readonly number[];

  test("the chosen tones land on the pixels that had the shipped ones", () => {
    const style = { ...DEFAULT_AVATAR, skin: 4 };
    const data = pixelsOf(skin);
    applyRecolour(data, recolourPlan(CATALOGUE, style));
    expect(colourAt(data, 0)).toEqual([...(CATALOGUE.options.skin[4]?.[0] ?? []), 255]);
  });

  // Only three of the eleven slots are ever repainted. The other eight have
  // to come through untouched, and the closest pair in the sheet — the
  // outline and the hair, thirty-one units apart — is near enough that
  // nothing here may work out which is which by eye.
  test("colours with no rule are left exactly alone", () => {
    const data = pixelsOf(pants, outline);
    applyRecolour(data, recolourPlan(CATALOGUE, { ...DEFAULT_AVATAR, skin: 3, shirt: 2 }));
    expect(colourAt(data, 0)).toEqual([...pants, 255]);
    expect(colourAt(data, 1)).toEqual([...outline, 255]);
  });

  test("transparent padding stays transparent, whatever it is filled with", () => {
    const data = pixelsOf([...skin, 0]);
    applyRecolour(data, recolourPlan(CATALOGUE, { ...DEFAULT_AVATAR, skin: 4 }));
    expect(colourAt(data, 0)).toEqual([...skin, 0]);
  });

  // The bug this scheme invites: apply "skin becomes X" and then "hair
  // becomes Y" in turn, and a child whose chosen skin happens to equal the
  // shipped hair colour gets their face repainted into their hair.
  test("a chosen colour is never itself repainted by a later rule", () => {
    const collide: AvatarCatalogue = {
      ...CATALOGUE,
      options: {
        ...CATALOGUE.options,
        // Skin becomes exactly the colour hair is shipped in.
        skin: [[hair as [number, number, number], hair as [number, number, number]]],
        hair: [
          [
            [1, 2, 3],
            [4, 5, 6],
          ],
        ],
      },
    };
    const data = pixelsOf(skin, hair);
    applyRecolour(data, recolourPlan(collide, { body: "player", skin: 0, hair: 0, shirt: 0 }));
    expect(colourAt(data, 0)).toEqual([...hair, 255]);
    expect(colourAt(data, 1)).toEqual([1, 2, 3, 255]);
  });

  test("picking what the sheet already is repaints nothing", () => {
    const shipped = CATALOGUE.options.skin.findIndex(
      (tone) => packRgb(tone[0]) === packRgb(skin as [number, number, number]),
    );
    if (shipped < 0) return;
    const data = pixelsOf(skin);
    const changed = applyRecolour(
      data,
      recolourPlan(CATALOGUE, { ...DEFAULT_AVATAR, skin: shipped }),
    );
    expect(changed).toBe(1);
    expect(colourAt(data, 0)).toEqual([...skin, 255]);
  });

  test("every offered combination has a rule for all three colours", () => {
    for (const body of CATALOGUE.bodies) {
      for (let skinIndex = 0; skinIndex < CATALOGUE.options.skin.length; skinIndex++) {
        const plan = recolourPlan(CATALOGUE, { body, skin: skinIndex, hair: 2, shirt: 3 });
        expect(plan.size).toBe(AVATAR_COLOURS.length * 2);
      }
    }
  });
});
