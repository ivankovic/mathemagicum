// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { describe, expect, test } from "bun:test";
import { isLastPage, stepPage } from "./pages";

const DECK = ["a", "b", "c"] as const;

describe("stepping through a deck", () => {
  test("goes forward and back", () => {
    expect(stepPage(DECK, "a", 1)).toBe("b");
    expect(stepPage(DECK, "c", -1)).toBe("b");
  });

  // The panel steps one page at a time, so a hole or a wrap in this is a
  // button that reads as broken.
  test("stops at both ends rather than wrapping", () => {
    expect(stepPage(DECK, "a", -1)).toBe("a");
    expect(stepPage(DECK, "c", 1)).toBe("c");
    expect(stepPage(DECK, "a", -5)).toBe("a");
    expect(stepPage(DECK, "c", 5)).toBe("c");
  });

  test("a page that is not in the deck starts from the beginning", () => {
    expect(stepPage(DECK, "z" as "a", 1)).toBe("a");
  });

  test("only the last page is the last one", () => {
    expect(isLastPage(DECK, "c")).toBe(true);
    expect(isLastPage(DECK, "a")).toBe(false);
    expect(isLastPage([], "a")).toBe(false);
  });
});
