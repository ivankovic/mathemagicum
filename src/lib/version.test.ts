// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { expect, test } from "bun:test";
import { projectName } from "./version";

test("projectName is Phaser-free and runs under bun:test", () => {
  expect(projectName()).toBe("mathemagicum");
});
