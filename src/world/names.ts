// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

// What the people in the world are called.
//
// Separate from characters.ts on purpose: that file answers "which sheet is
// this person drawn with", and its answer is deliberately *shared* — every
// shopkeeper in the world wears the same apron. A name is the opposite kind
// of fact. It is the one thing that has to be different for each of the five
// women behind five identical counters, so it is keyed by who somebody is
// rather than by what they do.

/**
 * The names are the same in every language.
 *
 * The same argument the coins already make (see `docs/GAME_DESIGN.md` —
 * "the money is not real money"): a name is a proper noun, and two siblings
 * on one tablet playing in two languages should not be calling the same
 * person different things. It also means one table instead of three, and no
 * way for a name to go missing in a language.
 *
 * That costs something in Croatian, where names decline, so the sentences
 * that use one are written to want the **nominative** — "Mira buys", not
 * "sell to Mira". A sentence that genuinely needs an oblique case is its own
 * language's problem, the way `Noun` already carries German's accusative.
 *
 * Every name here is plain ASCII and says itself the same way in English,
 * German and Croatian. No name in the game needs a spelling a five-year-old
 * has to be taught before they can read who they are talking to.
 */
export const NAMED_PEOPLE = {
  // The postman, who walks across the square to say hello. The first person
  // in the world with a name, because he is the first person anybody meets.
  "postal-worker": "Bruno",
  teacher: "Lena",
  geometer: "Anton",
  // The village shopkeeper — the one who is *called* `shopkeeper`, because
  // in the village that is both her name and her job. The city's and the
  // harbour's are other people; see `KEEPER_NAMES`.
  shopkeeper: "Mira",
  astronomer: "Vera",
  fisher: "Tomo",
  clockmaker: "Emil",
} as const;

/**
 * The women who keep the other shops.
 *
 * Women, and not by accident: the shop's own sentences say *she* — she owes
 * you this, she counts it out, she is wrong one time in ten — and they are
 * one set of sentences shared by every counter in the world. One sheet, one
 * pronoun, one list of names that agrees with it. A shopkeeper who read as a
 * man would need those lines written twice in three languages to buy nothing
 * the player can see.
 *
 * Mira is not in it. She is the village's, and a second Mira on the quay
 * would undo the whole point of naming them.
 */
export const KEEPER_NAMES: readonly string[] = [
  "Ana",
  "Klara",
  "Dora",
  "Eva",
  "Greta",
  "Ida",
  "Jana",
  "Marta",
  "Nada",
  "Rosa",
  "Vida",
  "Zora",
];

/**
 * Everybody else: the villagers in the cottages, the townsfolk on the ring
 * road, the people standing about on the quay.
 *
 * Mixed, because nothing anywhere says *he* or *she* about any of them —
 * they are drawn from three generic sheets and no sentence in the game is
 * about one of them. They have names for the same reason the cottages have
 * nameplates: a world where only the useful people are anybody is a world of
 * shopkeepers and extras.
 */
export const FOLK_NAMES: readonly string[] = [
  "Adam",
  "Boris",
  "Elena",
  "Irma",
  "Ivan",
  "Kata",
  "Leon",
  "Luka",
  "Milan",
  "Nina",
  "Niko",
  "Olga",
  "Oskar",
  "Petra",
  "Rita",
  "Roman",
  "Sara",
  "Sonja",
  "Tina",
  "Viktor",
];

/** What naming somebody needs to know about them. `VillageNpcSpec` fits. */
export interface Named {
  id: string;
  /** What they are, when their id is not it — see `VillageNpcSpec.role`. */
  role?: string;
}

const SHOPKEEPER_ROLE = "shopkeeper";

/**
 * The one named part that more than one person plays.
 *
 * Everybody else in `NAMED_PEOPLE` is a part with exactly one player in the
 * world, so the part *is* the person and naming the part names them wherever
 * they turn up — the clockmaker is `city-clockmaker` in the city's list and
 * still Emil. A shopkeeper is not: there are seven of those, they share a
 * role because they share a sheet and a counter, and hanging Mira on the
 * role would put her behind all seven.
 */
const SHARED_ROLES: ReadonlySet<string> = new Set([SHOPKEEPER_ROLE]);

/** The name written down for this part, if the part is somebody. */
function byHand(part: string): string | undefined {
  return SHARED_ROLES.has(part) ? undefined : NAMED_PEOPLE[part as keyof typeof NAMED_PEOPLE];
}

/**
 * Who everybody in this world is, by id.
 *
 * **Handed out in cast order, not hashed from the id.** The same reasoning
 * `characterFor` uses for faces: the world always produces its people in the
 * same order from the same seed, so walking the list gives a person the same
 * name every time their world is rebuilt — and, unlike a hash, it cannot
 * give two of them the same one. That mattered enough to decide it: a city
 * shop's id carries the number of the *block* it landed on, which is drawn
 * at random and sparse, so anything modular over it puts two Klaras in one
 * city on some seeds and nobody could say which.
 *
 * The named roles are in the map whether or not the cast holds them, because
 * the astronomer is spawned from `LONE_ATTENDANTS` rather than from any
 * layout's list and would otherwise be the one person in the world without a
 * name.
 *
 * The pools wrap if a world ever holds more people than names. That is not a
 * world the generator makes — `names.test.ts` builds one and checks — and
 * two Ninas at opposite ends of a city is a better failure than a crash.
 */
export function nameCast(cast: readonly Named[]): ReadonlyMap<string, string> {
  const names = new Map<string, string>(Object.entries(NAMED_PEOPLE));
  let keepers = 0;
  let folk = 0;
  for (const person of cast) {
    if (names.has(person.id)) continue;
    // By the part they play before the pools, because a world does not
    // always call somebody by their part: the village's clockmaker id is
    // `clockmaker` and the city's is `city-clockmaker`, and only one of
    // those is a key in the table.
    const written = person.role ? byHand(person.role) : undefined;
    if (written) {
      names.set(person.id, written);
      continue;
    }
    const isKeeper = (person.role ?? person.id) === SHOPKEEPER_ROLE;
    const pool = isKeeper ? KEEPER_NAMES : FOLK_NAMES;
    const at = isKeeper ? keepers++ : folk++;
    const name = pool[at % pool.length];
    if (!name) throw new Error("a name pool is empty");
    names.set(person.id, name);
  }
  return names;
}
