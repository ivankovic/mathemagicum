// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import type { Inventory, ItemType } from "./inventory";
import { MACHINE_TYPES, MachineType, canBuild, recipeFor } from "./machines";
import type { MaterialType } from "./materials";
import type { GridPoint } from "./topdown";
import { WIRE_REACH, type Wire, tileOf, wireKey } from "./wires";

/**
 * A blueprint's drawing: the machines standing round it and the wires
 * between them, as offsets from where it stands.
 *
 * Made the moment the blueprint is woken, of everything within a wire's
 * reach of it — the same six squares a wire spans, because a line a wire
 * cannot cross is not one line. Not the blueprint itself and not any other
 * blueprint: a drawing of a drawing would be a way to build blueprints for
 * free, and a blueprint costs paper.
 *
 * **Stamping pays.** Tapped down somewhere else, the drawing builds every
 * machine in it at the same offsets and strings the same wires, and each
 * machine costs its recipe out of the basket, exactly as building it by
 * hand would. Nothing is conjured; what a blueprint saves is the *wiring*
 * and the walking, which is what a function saves a programmer. The
 * blueprint that was stamped counts the stamping — see `MachineState.rung`
 * — which is what the mechanic's last job reads.
 */

export interface PlanMachine {
  readonly dCol: number;
  readonly dRow: number;
  readonly type: MachineType;
}

export interface PlanWire {
  readonly from: readonly [number, number];
  readonly to: readonly [number, number];
}

export interface Plan {
  readonly machines: readonly PlanMachine[];
  readonly wires: readonly PlanWire[];
}

/** A machine standing in the garden, as the scene lists them. */
export interface Standing {
  readonly key: string;
  readonly type: MachineType;
}

/**
 * Draw what stands round a square.
 *
 * Every machine within reach that is not a blueprint, and every wire whose
 * both ends are among them. Offsets from the origin, so the drawing can be
 * stamped anywhere.
 */
export function drawPlan(
  origin: GridPoint,
  standing: readonly Standing[],
  wires: readonly Wire[],
): Plan {
  const near = new Map<string, PlanMachine>();
  for (const one of standing) {
    if (one.type === MachineType.Blueprint) continue;
    const at = tileOf(one.key);
    if (!at) continue;
    const dCol = at.col - origin.col;
    const dRow = at.row - origin.row;
    if (dCol === 0 && dRow === 0) continue;
    if (Math.max(Math.abs(dCol), Math.abs(dRow)) > WIRE_REACH) continue;
    near.set(one.key, { dCol, dRow, type: one.type });
  }
  const planWires: PlanWire[] = [];
  for (const wire of wires) {
    const from = near.get(wire.from);
    const to = near.get(wire.to);
    if (!from || !to) continue;
    planWires.push({ from: [from.dCol, from.dRow], to: [to.dCol, to.dRow] });
  }
  return { machines: [...near.values()], wires: planWires };
}

/** Where each machine of a plan would stand, stamped at this square. */
export function stampedAt(
  plan: Plan,
  at: GridPoint,
): readonly (GridPoint & { type: MachineType })[] {
  return plan.machines.map((one) => ({
    col: at.col + one.dCol,
    row: at.row + one.dRow,
    type: one.type,
  }));
}

/** Where each wire of a plan would run, stamped at this square. */
export function stampedWires(plan: Plan, at: GridPoint): readonly Wire[] {
  const key = (offset: readonly [number, number]) => `${at.col + offset[0]},${at.row + offset[1]}`;
  return plan.wires.map((wire) => ({ from: key(wire.from), to: key(wire.to) }));
}

/**
 * What a stamping costs, as a count per material: every machine's recipe
 * added up.
 */
export function stampCost(plan: Plan): readonly (readonly [MaterialType, number])[] {
  const cost = new Map<MaterialType, number>();
  for (const one of plan.machines) {
    for (const [material, count] of recipeFor(one.type)) {
      cost.set(material, (cost.get(material) ?? 0) + count);
    }
  }
  return [...cost.entries()].sort(([left], [right]) => left.localeCompare(right));
}

/** The first material the basket is short of, or null if it can pay. */
export function shortFor(held: Inventory, plan: Plan): ItemType | null {
  for (const [material, count] of stampCost(plan)) {
    if (held.count(material) < count) return material;
  }
  return null;
}

/** Whether the basket holds every machine's recipe at once. */
export function canStamp(held: Inventory, plan: Plan): boolean {
  return plan.machines.length > 0 && shortFor(held, plan) === null;
}

/** Pay for a stamping. Only ever after `canStamp`, so it cannot half pay. */
export function payForStamp(held: Inventory, plan: Plan): boolean {
  if (!canStamp(held, plan)) return false;
  for (const one of plan.machines) if (!canBuild(held, one.type)) return false;
  for (const [material, count] of stampCost(plan)) held.remove(material, count);
  return true;
}

// --- what a save remembers ---------------------------------------------------

/** One plan as a string: machines, then wires, offsets only. */
export function plansToSave(plans: ReadonlyMap<string, Plan>): Readonly<Record<string, string>> {
  const saved: Record<string, string> = {};
  for (const [where, plan] of plans) {
    const machines = plan.machines.map((one) => `${one.type}:${one.dCol},${one.dRow}`).join(";");
    const wires = plan.wires
      .map((wire) => `${wire.from[0]},${wire.from[1]}>${wire.to[0]},${wire.to[1]}`)
      .join(";");
    saved[where] = `${machines}|${wires}`;
  }
  return saved;
}

/**
 * Read back, dropping anything mangled: a machine nobody has heard of, an
 * offset that is not a whole number, a wire between offsets the plan does
 * not hold.
 */
export function plansFromSave(saved: unknown): Map<string, Plan> {
  const plans = new Map<string, Plan>();
  if (typeof saved !== "object" || saved === null) return plans;
  for (const [where, entry] of Object.entries(saved as Record<string, unknown>)) {
    if (typeof entry !== "string" || !tileOf(where)) continue;
    const [machinePart = "", wirePart = ""] = entry.split("|");
    const machines: PlanMachine[] = [];
    for (const piece of machinePart.split(";").filter((one) => one.length > 0)) {
      const [type, at] = piece.split(":");
      const offset = at ? tileOf(at) : null;
      if (!type || !offset || !(MACHINE_TYPES as readonly string[]).includes(type)) continue;
      if (type === MachineType.Blueprint) continue;
      machines.push({ dCol: offset.col, dRow: offset.row, type: type as MachineType });
    }
    const has = (offset: GridPoint) =>
      machines.some((one) => one.dCol === offset.col && one.dRow === offset.row);
    const wires: PlanWire[] = [];
    for (const piece of wirePart.split(";").filter((one) => one.length > 0)) {
      const [from, to] = piece.split(">");
      const a = from ? tileOf(from) : null;
      const b = to ? tileOf(to) : null;
      if (!a || !b || !has(a) || !has(b)) continue;
      wires.push({ from: [a.col, a.row], to: [b.col, b.row] });
    }
    plans.set(where, { machines, wires });
  }
  return plans;
}

/** The key a stamped wire would have, for the scene's own list. */
export { wireKey };
