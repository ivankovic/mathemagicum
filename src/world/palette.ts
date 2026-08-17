// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

// What is left of the placeholder flat colors, now that terrain, buildings,
// characters, interiors and crops all render from generated art: only the
// village well, which the asset generator has no sprite for.

// Keyed by PlacedObject.type (see src/world/villageLayout.ts) rather than a
// closed union — new story-area object types will accrete over time.
export const OBJECT_COLORS: Record<string, number> = {
  well: 0x78909c,
  house: 0xa1887f,
  school: 0x7986cb,
  "post-office": 0xe57373,
  store: 0xffb74d,
};
export const DEFAULT_OBJECT_COLOR = 0xbdbdbd;
