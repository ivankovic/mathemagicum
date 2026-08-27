// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

/**
 * Which spells a child knows, and how they come to know one.
 *
 * The game shipped with every spell in the book from the first minute, and
 * the design said so in as many words: teachers explain a spell, they never
 * gate it. That has been narrowed, deliberately — the *portal* spell is
 * learned from the geometer in the tower, and the *array* spell from the
 * great tree in the enchanted forest.
 *
 * The distinction worth keeping is what the rule was protecting. Nothing may
 * be locked behind **being good at arithmetic**: a child who cannot do the
 * sums must never be shut out of the garden, and that is still true — the
 * growth spell is theirs from the start and no spell is ever taken away for
 * getting an answer wrong. What is locked here is behind **having met
 * somebody**, which is a different thing: it is the reason to walk up the
 * tower, and it makes the geometer someone you find rather than someone you
 * could go your whole game without noticing.
 *
 * The unlearned rune is still *drawn*, dimmed, in the spellbook — the same
 * choice the map makes for a place nobody has walked to yet. A book with a
 * gap in it says there is something to find; a book that hides what it does
 * not have says the game is finished.
 */

export const Spell = {
  /** Addition, on a number line. Grows a crop. */
  Growth: "growth",
  /** Subtraction, on the same number line walked backwards. Clears the way. */
  Clearing: "clearing",
  /** Measuring, on a ruled map. Crosses the world. */
  Portal: "portal",
  /** Multiplication, as rows and columns. Ripens a patch in one go. */
  Array: "array",
  /** Division, as a heap dealt into baskets. Picks a ripe patch in one go. */
  Share: "share",
  /** Telling the time. Winds the world's clock to wherever you point it. */
  Hourglass: "hourglass",
  /** Folding a shape in half: the first geometry about a whole figure. */
  Mirror: "mirror",
} as const;

export type Spell = (typeof Spell)[keyof typeof Spell];

export const SPELLS: readonly Spell[] = [
  Spell.Growth,
  Spell.Clearing,
  Spell.Portal,
  Spell.Array,
  Spell.Share,
  Spell.Hourglass,
  Spell.Mirror,
];

/**
 * The ones every child has from their first minute.
 *
 * The growth spell has to be: it is how the garden is tended, and a child who
 * could not tend the garden would have nothing to do at all. The clearing
 * spell is here for a quieter reason — it is the same instrument as the
 * growth spell, the same number line walked the other way, so a teacher who
 * had already explained one would have nothing left to say about the other.
 */
export const KNOWN_FROM_THE_START: readonly Spell[] = [Spell.Growth, Spell.Clearing];

/** Where each spell that must be learned is taught. */
export const TAUGHT_BY: Partial<Record<Spell, string>> = {
  [Spell.Portal]: "geometer",
  // Not a person. The great tree in the enchanted forest is the second
  // teacher, and it being a *thing* rather than somebody standing in a room
  // is the point: the forest has no village and nobody lives there, so a
  // teacher who was a person would have needed a house built round them.
  [Spell.Array]: "great-tree",
  // The fisherman on the quay. Dealing a catch out into equal baskets is
  // what a quay does all morning, and the harbour was the one place in the
  // world with people in it and nothing to learn from any of them.
  [Spell.Share]: "fisher",
  // Beside the tower in the city, under the one clock in the world that
  // shows the hour to everybody at once. A spell about telling the time
  // belongs with the thing that tells it — which is also why it is no
  // longer the astronomer's: hers is up a mountain, and the child who wants
  // to know what o'clock it is is standing in the plaza.
  [Spell.Hourglass]: "clockmaker",
  // Up the mountain, in the dome. The astronomer keeps the one instrument
  // in the game that is about *shape* rather than about quantity, and she
  // is the teacher furthest from the village by construction — so what she
  // teaches ought to be the thing least like the arithmetic below.
  [Spell.Mirror]: "astronomer",
};

export function knowsSpell(learned: Iterable<string>, spell: Spell): boolean {
  if (KNOWN_FROM_THE_START.includes(spell)) return true;
  for (const known of learned) if (known === spell) return true;
  return false;
}

/**
 * Add a spell to what somebody knows.
 *
 * Gives back the same list when it is already known, so a caller can compare
 * by identity to decide whether anything happened — which is what stops the
 * geometer announcing he has taught you the spell every single time you say
 * hello to him.
 */
export function learnSpell(learned: readonly string[], spell: Spell): readonly string[] {
  if (learned.includes(spell)) return learned;
  return [...learned, spell];
}

/**
 * The spells read back from a save.
 *
 * Unknown names are dropped: the set is fixed, and a name that is not in it
 * can only come from a different build. The ones known from the start are
 * *not* stored — they are known by rule rather than by record, so a save can
 * never contradict the rule.
 */
export function readLearned(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return [];
  const known = value.filter(
    (name): name is Spell =>
      typeof name === "string" &&
      (SPELLS as readonly string[]).includes(name) &&
      !KNOWN_FROM_THE_START.includes(name as Spell),
  );
  return [...new Set(known)];
}
