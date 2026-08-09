// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { TerrainType } from "./terrain";

const LEGEND: Record<string, TerrainType> = {
  G: TerrainType.Grass,
  D: TerrainType.Dirt,
  S: TerrainType.Sand,
  W: TerrainType.Water,
  R: TerrainType.Rock,
};

// A small hand-placed patch of every terrain type, just to prove multiple
// terrains coexist and matter (movement + planting both read this). Not
// final level design.
const STARTER_MAP_ASCII = [
  "GGGGGGGGGG",
  "GGGDDDGGGG",
  "GGDDDDGSSG",
  "GDDDDDGSSG",
  "GGDDDGGSSG",
  "GGGGGGGGSG",
  "GGGWWGGGGG",
  "GGWWWWGGRR",
  "GGGWWGGGRR",
  "GGGGGGGGGG",
];

export function parseMap(ascii: readonly string[]): TerrainType[][] {
  return ascii.map((row) =>
    [...row].map((char) => {
      const terrain = LEGEND[char];
      if (!terrain) throw new Error(`Unknown terrain character "${char}" in map data`);
      return terrain;
    }),
  );
}

export const STARTER_MAP = parseMap(STARTER_MAP_ASCII);
export const PLAYER_START = { col: 0, row: 0 };
