// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import type Phaser from "phaser";
import type { Phrases } from "../i18n/phrases";
import type { FixtureType } from "../world/fixtures";
import { type MachineType, SPARK, isMachine, recipeFor } from "../world/machines";
import { PagedPanel } from "./PagedPanel";
import type { PanelRect } from "./ParchmentPanel";
import { type UiIndex, itemIcon, materialIcon, uiTextureKey } from "./assets";
import { INK_DIM } from "./parchment";
import { RUNE_OF } from "./runes";

/**
 * What a thing is, and what it costs — opened from the little cloud on its
 * own button in the crate.
 *
 * **The question and the answer in the same place.** A child looking at a
 * picture of a machine they have never built has two questions, and the
 * crate could answer neither: dimming a slot says *not yet*, never *how
 * much*, and certainly never what the thing is for. Help that lived on a
 * separate screen would be help a child has to already know about.
 *
 * Two pages, because there are two questions.
 *
 * The first is what it does, and it is mostly *pictures*: the machine, and
 * the rune that wakes it. This game names its spells by their runes rather
 * than by words — a child who cannot read still knows the one with the dots
 * in it — so "cast sharing on it" is best said by showing the sharing rune,
 * and the sentence underneath is for whoever reads.
 *
 * The second is what it costs, and that one needs numerals. It is the only
 * place in this game where a figure is the answer, because "some wood and
 * some stone" is not a thing a child can go and fetch.
 */

/** Which of the two questions is on show. */
type Page = "does" | "costs";

const PAGES: readonly Page[] = ["does", "costs"];

/** How big a recipe's material is drawn, and the gap between two of them. */
const COST_ART = 40;
const COST_GAP = 34;
const COUNT_SIZE = 15;

export class ThingPanel extends PagedPanel<Page> {
  private subject: FixtureType | null = null;
  private readonly counts: Phaser.GameObjects.Text[] = [];
  private readonly stuff: Phaser.GameObjects.Image[] = [];

  constructor(
    scene: Phaser.Scene,
    index: UiIndex,
    depth: number,
    words: Phrases,
    register: (object: Phaser.GameObjects.GameObject) => void,
  ) {
    super(scene, index, depth, words, register, {
      maxWidth: 420,
      maxHeight: 330,
      minWidth: 300,
      minHeight: 250,
      icons: 2,
    });
    // Two of each, which is every recipe in the game: a machine is made of
    // wood and stone, and a recipe in one material would be a number rather
    // than a plan. Made once and moved, like everything else on this panel —
    // a panel that built objects when it opened would build them again every
    // time somebody turned a page.
    for (let i = 0; i < 2; i++) {
      this.stuff.push(
        this.own(scene.add.image(0, 0, uiTextureKey(itemIcon("well" as FixtureType)))),
      );
      this.counts.push(this.raise(this.own(this.text("", COUNT_SIZE, INK_DIM).setOrigin(0.5, 0))));
    }
  }

  /** Open it on one thing. Nothing else can be asked about yet. */
  openFor(thing: FixtureType, onClose: () => void): void {
    this.subject = thing;
    this.open_(onClose);
  }

  /**
   * What is being explained, or nothing.
   *
   * For a scenario, which has no other way to see this: a page that opened
   * and a cloud whose tap went nowhere look identical from outside, and the
   * second is the failure the cloud was most likely to have — it is a small
   * mark in the corner of a button that already takes taps.
   */
  get telling(): FixtureType | null {
    return this.isOpen ? this.subject : null;
  }

  protected deck(): readonly Page[] {
    // One page for anything that is not built: what it does, and no price.
    return this.subject && isMachine(this.subject) ? PAGES : PAGES.slice(0, 1);
  }

  protected titleText(): string {
    return this.subject ? this.words.fixture(this.subject).bare : "";
  }

  protected bodyText(page: Page): string {
    if (!this.subject) return "";
    return page === "does" ? this.words.thingDoes(this.subject) : this.words.thingCosts;
  }

  protected drawArt(rect: PanelRect, top: number, bottom: number, page: Page): void {
    for (const part of [...this.stuff, ...this.counts]) part.setVisible(false);
    const thing = this.subject;
    if (!thing) return;
    const middle = (top + bottom) / 2;
    if (page === "does") {
      // The thing itself, and the rune that wakes it — which is a picture
      // rather than a word on purpose. Anything that is not a machine has
      // nothing to be woken by, so it stands alone.
      const rune = isMachine(thing) ? RUNE_OF[SPARK[thing as MachineType]] : null;
      this.drawIcons(rect, middle, rune ? [itemIcon(thing), rune] : [itemIcon(thing)]);
      return;
    }
    this.drawCost(rect, middle, thing as MachineType);
  }

  /**
   * The recipe: each material, with how many of it underneath.
   *
   * Drawn here rather than through `drawIcons` because of the numerals. A
   * row of pictures says *wood and stone*, which a child could already have
   * guessed from the machine; the whole use of this page is the two numbers,
   * so they are set directly under the thing they count and the picture is
   * what says which pile to count.
   */
  private drawCost(rect: PanelRect, middle: number, machine: MachineType): void {
    const recipe = recipeFor(machine);
    const spread = (recipe.length - 1) * (COST_ART + COST_GAP);
    for (const [at, [material, count]] of recipe.entries()) {
      const picture = this.stuff[at];
      const label = this.counts[at];
      if (!picture || !label) continue;
      const x = rect.centreX - spread / 2 + at * (COST_ART + COST_GAP);
      picture
        .setTexture(uiTextureKey(materialIcon(material)))
        .setDisplaySize(COST_ART, COST_ART)
        .setPosition(x, middle - COUNT_SIZE / 2)
        .setVisible(true);
      label
        .setText(String(count))
        .setPosition(x, middle + COST_ART / 2 - COUNT_SIZE / 2)
        .setVisible(true);
    }
  }
}
