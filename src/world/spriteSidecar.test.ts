// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import playerSidecar from "../../public/assets/characters/player.json";
import teacherSidecar from "../../public/assets/characters/teacher.json";
import carrotSidecar from "../../public/assets/plants/carrot.json";
import { type SheetLayout, spriteSheetConfig } from "./spriteSidecar";

const SHIPPED: readonly (readonly [string, { sheet: SheetLayout }])[] = [
  ["player", playerSidecar as unknown as { sheet: SheetLayout }],
  ["teacher", teacherSidecar as unknown as { sheet: SheetLayout }],
  ["carrot", carrotSidecar as unknown as { sheet: SheetLayout }],
];

describe("slicing a generated sheet", () => {
  // The whole reason this is a function rather than an object literal at each
  // loader. The avatar's recoloured copy was registered with a frame size and
  // nothing else, so every frame came out a pixel up and left of where it
  // belonged and drifted further across the sheet — and what showed inside
  // each frame was a sliver of its neighbour, which on a character sheet is
  // the next frame's shadow, smeared over the player.
  test("carries the padding, not just the frame size", () => {
    for (const [name, sidecar] of SHIPPED) {
      const config = spriteSheetConfig(sidecar.sheet);
      expect({ name, config }).toEqual({
        name,
        config: {
          frameWidth: sidecar.sheet.frame_width,
          frameHeight: sidecar.sheet.frame_height,
          margin: sidecar.sheet.margin,
          spacing: sidecar.sheet.spacing,
        },
      });
    }
  });

  // If the generator ever stopped extruding, slicing without the padding
  // would be harmless and this whole class of bug would be theoretical. It
  // does extrude, so it is not.
  test("the shipped sheets really are padded, so the padding cannot be skipped", () => {
    for (const [name, sidecar] of SHIPPED) {
      expect({ name, margin: sidecar.sheet.margin > 0 }).toEqual({ name, margin: true });
      expect({ name, spacing: sidecar.sheet.spacing > 0 }).toEqual({ name, spacing: true });
    }
  });

  // The number that could not have caught it. A 204x600 sheet cut on a bare
  // 32x48 grid yields six columns and twelve rows — exactly what the padded
  // slicing yields — so a frame count matching proves nothing about whether
  // the frames are in the right place.
  test("a frame count is not evidence the slicing is right", () => {
    const sheet = (playerSidecar as unknown as { sheet: SheetLayout }).sheet;
    const naiveColumns = Math.floor(
      (sheet.columns * (sheet.frame_width + sheet.spacing) + sheet.margin * 2) / sheet.frame_width,
    );
    expect(naiveColumns).toBeGreaterThanOrEqual(sheet.columns);
  });
});
