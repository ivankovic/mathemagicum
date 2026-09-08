// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import {
  canStamp,
  drawPlan,
  payForStamp,
  plansFromSave,
  plansToSave,
  shortFor,
  stampCost,
  stampedAt,
  stampedWires,
} from "./blueprint";
import { Inventory } from "./inventory";
import { MachineType, recipeFor } from "./machines";
import { MaterialType } from "./materials";

const standing = [
  { key: "10,10", type: MachineType.Sorter },
  { key: "12,10", type: MachineType.Funnel },
  // Too far to be on this line.
  { key: "20,10", type: MachineType.Bell },
  // Another drawing, which is never drawn.
  { key: "11,12", type: MachineType.Blueprint },
];
const wires = [
  { from: "10,10", to: "12,10" },
  { from: "12,10", to: "20,10" },
];

describe("drawing a line", () => {
  test("takes the machines within reach, and only the wires between them", () => {
    const plan = drawPlan({ col: 11, row: 11 }, standing, wires);
    expect(plan.machines).toEqual([
      { dCol: -1, dRow: -1, type: MachineType.Sorter },
      { dCol: 1, dRow: -1, type: MachineType.Funnel },
    ]);
    expect(plan.wires).toEqual([{ from: [-1, -1], to: [1, -1] }]);
  });

  test("stamps down at the same offsets", () => {
    const plan = drawPlan({ col: 11, row: 11 }, standing, wires);
    expect(stampedAt(plan, { col: 30, row: 30 })).toEqual([
      { col: 29, row: 29, type: MachineType.Sorter },
      { col: 31, row: 29, type: MachineType.Funnel },
    ]);
    expect(stampedWires(plan, { col: 30, row: 30 })).toEqual([{ from: "29,29", to: "31,29" }]);
  });
});

describe("paying for a stamping", () => {
  const plan = drawPlan({ col: 11, row: 11 }, standing, wires);

  test("costs every machine's recipe added up, and refuses short", () => {
    const wood = recipeFor(MachineType.Sorter).find(([m]) => m === MaterialType.Wood)?.[1] ?? 0;
    expect(stampCost(plan).find(([m]) => m === MaterialType.Wood)?.[1]).toBe(wood);
    const held = new Inventory();
    expect(canStamp(held, plan)).toBe(false);
    expect(shortFor(held, plan)).not.toBeNull();
    for (const [material, count] of stampCost(plan)) held.add(material, count);
    expect(canStamp(held, plan)).toBe(true);
    expect(payForStamp(held, plan)).toBe(true);
    for (const [material] of stampCost(plan)) expect(held.count(material)).toBe(0);
  });

  test("an empty drawing cannot be stamped", () => {
    const held = new Inventory();
    held.add(MaterialType.Wood, 99);
    expect(canStamp(held, { machines: [], wires: [] })).toBe(false);
  });
});

describe("what a save remembers of a drawing", () => {
  test("survives the round trip, and drops what it does not know", () => {
    const plan = drawPlan({ col: 11, row: 11 }, standing, wires);
    const saved = plansToSave(new Map([["11,11", plan]]));
    expect(plansFromSave(saved).get("11,11")).toEqual(plan);
    const mangled = plansFromSave({
      "1,1": "sorter:1,0;trebuchet:2,0;blueprint:3,0|1,0>2,0;1,0>9,9",
      nonsense: "sorter:1,0|",
      "2,2": 7,
    });
    expect(mangled.get("1,1")).toEqual({
      machines: [{ dCol: 1, dRow: 0, type: MachineType.Sorter }],
      wires: [],
    });
    expect(mangled.has("nonsense")).toBe(false);
    expect(mangled.has("2,2")).toBe(false);
  });
});
