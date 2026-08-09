// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

export const TerrainType = {
  Grass: "grass",
  Dirt: "dirt",
  Sand: "sand",
  Water: "water",
  Rock: "rock",
} as const;

export type TerrainType = (typeof TerrainType)[keyof typeof TerrainType];

const IMPASSABLE: ReadonlySet<TerrainType> = new Set([TerrainType.Water, TerrainType.Rock]);

export function isPassable(terrain: TerrainType): boolean {
  return !IMPASSABLE.has(terrain);
}
