// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

/**
 * A picture of the map with its marks on, for a human to judge.
 *
 *     bun e2e/lookAtTheMap.ts
 *
 * Run by hand and deliberately not `*.e2e.ts`, like `capture.ts`: what it
 * produces is a screenshot, and no assertion can say whether a small cyan
 * picture on parchment can be told apart from the one beside it. `mapOwes`
 * proves the right six textures are visible; this is the other half.
 */

import { play, shutDown } from "./harness";

const SEAMS = "&hour=12&freezeNpcs";

await play({ seams: SEAMS, firstTime: true }, async (game) => {
  const doors = await game.seam<Record<string, { col: number; row: number }>>("doors");
  const door = doors["post-office"];
  if (!door) throw new Error("this village has no post office");
  await game.reload(`${SEAMS}&at=${door.col},${door.row + 1}`);
  await game.walk("ArrowUp", 700);
  await game.stopped();
  await game.tap("wallMap");
  await game.settle(800);
  await game.look("the-map-with-its-marks");
  console.log("showing:", await game.seam<string[]>("mapOwes"));
});
await shutDown();
