// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { AnimalKind } from "../world/animals";
import { DecorType } from "../world/decor";
import { FixtureType } from "../world/fixtures";
import type { ItemType } from "../world/inventory";
import { MaterialType } from "../world/materials";
import { NAMED_PEOPLE } from "../world/names";
import { PlantStage, PlantType } from "../world/plants";
import type { Buyable } from "../world/shop";
import { TerrainType } from "../world/terrain";
import type { Noun, Phrases } from "./phrases";

/**
 * The game in Croatian.
 *
 * Two things Croatian needs that neither of the other books does:
 *
 * **Counting has three forms, not two.** One carrot is `mrkva`, two are
 * `mrkve`, five are `mrkava`, and which one a number takes is decided by its
 * last *two* digits rather than its last one — eleven through fourteen take
 * the many-form even though they end in one through four. See `countForm`.
 * The `Noun` interface has one plural slot, so the three forms live in a
 * private table here and `count` reads that table directly.
 *
 * **There are no articles, and there are cases.** `definite` and `bare` are
 * both the nominative, because Croatian has no "the" to put in front of one.
 * `indefinite` is the accusative — every sentence that introduces a thing has
 * it as an object — and `none` is the genitive, which is what follows
 * *nemaš*. Nothing outside this file reads any of the three today; they are
 * filled in correctly anyway, because the next sentence that needs one should
 * find it right rather than find it plausible.
 *
 * The register is the one an adult uses to a child: *ti*, imperatives, and
 * short sentences.
 *
 * **And nothing the game says to the child is in a gender.** This is the
 * rule that had been broken everywhere and is the reason this file was gone
 * through: Croatian's past tense agrees with the speaker, so *dobro došao*,
 * *dobro si uočio*, *gdje si sletio* and *mjesto na kojem si već bio* all
 * greet a girl as a boy — and half the children this is written for are
 * girls. The game does not know, either: a child picks one of six bodies and
 * two of them read as a boy, and none of it is written down as a gender
 * anywhere, correctly, because it is not the game's business.
 *
 * So every sentence addressed to the player is built without a participle
 * that would have to agree: the present tense (*poznaješ*, *brojiš*), a
 * question about a thing rather than about her (*na kojem si broju*), or a
 * noun (*dobro oko*). `i18n.test.ts` holds the file to it — the pattern is
 * mechanical enough to catch, and it came back three times by hand.
 *
 * The generic *igrač* on a parent's list of players is left alone. That is
 * the ordinary Croatian generic for a person who plays and it names nobody
 * in particular; what is wrong is telling a specific girl she *is* a boy.
 */

/**
 * Which of the three counting forms a number takes.
 *
 * The rule is on the last two digits. Eleven through fourteen take the
 * many-form despite ending in one through four, and *that* is the line
 * Slavic pluralisation is usually shipped without.
 */
export function countForm(count: number): "one" | "few" | "many" {
  const whole = Math.abs(Math.trunc(count));
  const lastTwo = whole % 100;
  if (lastTwo >= 11 && lastTwo <= 14) return "many";
  const last = whole % 10;
  if (last === 1) return "one";
  if (last >= 2 && last <= 4) return "few";
  return "many";
}

interface HrNoun {
  /** Nominative singular: what the thing is called. */
  readonly one: string;
  /** Accusative singular: what you plant, put down, or pick up. */
  readonly acc: string;
  /** After two, three and four — and what follows *nemaš*. */
  readonly few: string;
  /** After five and up, and after nought. */
  readonly many: string;
}

function noun(forms: HrNoun): Noun {
  return {
    bare: forms.one,
    // No articles in Croatian, so naming a thing already on screen and
    // naming it in the abstract are the same word.
    definite: forms.one,
    indefinite: forms.acc,
    none: forms.few,
    plural: forms.many,
  };
}

/** `3 mrkve`, `1 mrkva`, `11 mrkava`. */
function counted(forms: HrNoun, count: number): string {
  return `${count} ${forms[countForm(count)]}`;
}

const PLANT_FORMS: Record<PlantType, HrNoun> = {
  [PlantType.Carrot]: { one: "mrkva", acc: "mrkvu", few: "mrkve", many: "mrkava" },
  [PlantType.Sunflower]: {
    one: "suncokret",
    acc: "suncokret",
    few: "suncokreta",
    many: "suncokreta",
  },
  [PlantType.Cactus]: { one: "kaktus", acc: "kaktus", few: "kaktusa", many: "kaktusa" },
  [PlantType.Tomato]: { one: "rajčica", acc: "rajčicu", few: "rajčice", many: "rajčica" },
  [PlantType.Pepper]: { one: "paprika", acc: "papriku", few: "paprike", many: "paprika" },
  [PlantType.Wheat]: { one: "pšenica", acc: "pšenicu", few: "pšenice", many: "pšenica" },
};

const ANIMALS: Record<AnimalKind, Noun> = {
  [AnimalKind.Chicken]: noun({ one: "kokoš", acc: "kokoš", few: "kokoši", many: "kokoši" }),
  [AnimalKind.Duck]: noun({ one: "patka", acc: "patku", few: "patke", many: "pataka" }),
  [AnimalKind.Cat]: noun({ one: "mačka", acc: "mačku", few: "mačke", many: "mačaka" }),
  // Masculine and animate, so the accusative is the genitive: vidiš zeca.
  [AnimalKind.Rabbit]: noun({ one: "zec", acc: "zeca", few: "zeca", many: "zečeva" }),
};

const FIXTURE_FORMS: Record<FixtureType, HrNoun> = {
  [FixtureType.Well]: { one: "bunar", acc: "bunar", few: "bunara", many: "bunara" },
  [FixtureType.Fence]: { one: "ograda", acc: "ogradu", few: "ograde", many: "ograda" },
  [FixtureType.Table]: {
    one: "vrtni stol",
    acc: "vrtni stol",
    few: "vrtna stola",
    many: "vrtnih stolova",
  },
  [FixtureType.Lamp]: {
    one: "svjetiljka",
    acc: "svjetiljku",
    few: "svjetiljke",
    many: "svjetiljki",
  },
  [FixtureType.Bench]: { one: "klupa", acc: "klupu", few: "klupe", many: "klupa" },
  [FixtureType.Scarecrow]: {
    one: "strašilo",
    acc: "strašilo",
    few: "strašila",
    many: "strašila",
  },
  [FixtureType.Flowerpot]: { one: "tegla", acc: "teglu", few: "tegle", many: "tegli" },
  // Masculine and inanimate, so the accusative is the nominative — the same
  // shape as *bunar* above, and the reason neither needs a second form.
  [FixtureType.Sorter]: {
    one: "razvrstavač",
    acc: "razvrstavač",
    few: "razvrstavača",
    many: "razvrstavača",
  },
  // *Staklenik*, the everyday word for a glasshouse. Masculine and
  // inanimate, so the accusative is the nominative — the same shape as the
  // sorter above it.
  [FixtureType.Hothouse]: {
    one: "staklenik",
    acc: "staklenik",
    few: "staklenika",
    many: "staklenika",
  },
  // *Sito*, neuter, and neuter nouns take their nominative for the
  // accusative — so all four forms come off the one stem.
  [FixtureType.Sieve]: {
    one: "sito",
    acc: "sito",
    few: "sita",
    many: "sita",
  },
  // *Brojilo*, neuter like the sieve above it, so the accusative is the
  // nominative and all four forms come off the one stem.
  [FixtureType.Tally]: {
    one: "brojilo",
    acc: "brojilo",
    few: "brojila",
    many: "brojila",
  },
  // One feminine and one masculine, and the masculine is inanimate, so its
  // accusative is its nominative — the same shape as *bunar* and the sorter.
  [FixtureType.Windpump]: {
    one: "vjetrenjača",
    acc: "vjetrenjaču",
    few: "vjetrenjače",
    many: "vjetrenjača",
  },
  [FixtureType.Planter]: {
    one: "sanduk za cvijeće",
    acc: "sanduk za cvijeće",
    few: "sanduka za cvijeće",
    many: "sanduka za cvijeće",
  },
  // *Vrata* is plural-only in Croatian and cannot be counted, so a gate in a
  // fence is a *vratnica* — the leaf that swings, which is what is drawn.
  [FixtureType.Gate]: { one: "vratnica", acc: "vratnicu", few: "vratnice", many: "vratnica" },
  [FixtureType.FenceSide]: { one: "ograda", acc: "ogradu", few: "ograde", many: "ograda" },
  // Still a fence. What a corner is, is a fact about the picture.
  [FixtureType.FenceCorner]: { one: "ograda", acc: "ogradu", few: "ograde", many: "ograda" },
  [FixtureType.GateSide]: { one: "vratnica", acc: "vratnicu", few: "vratnice", many: "vratnica" },
  [FixtureType.GateSideLower]: {
    one: "vratnica",
    acc: "vratnicu",
    few: "vratnice",
    many: "vratnica",
  },
  // Invented, as the English is: a mushroom that gives light.
  [FixtureType.Glowcap]: {
    one: "svjetlarka",
    acc: "svjetlarku",
    few: "svjetlarke",
    many: "svjetlarki",
  },
  [FixtureType.Stall]: { one: "tezga", acc: "tezgu", few: "tezge", many: "tezgi" },
  // World generation's, and never counted, so the adjective is left in the
  // form it takes when the thing is simply named.
  [FixtureType.CityWall]: {
    one: "gradski zid",
    acc: "gradski zid",
    few: "gradska zida",
    many: "gradskih zidova",
  },
  [FixtureType.CityWallSide]: {
    one: "gradski zid",
    acc: "gradski zid",
    few: "gradska zida",
    many: "gradskih zidova",
  },
  [FixtureType.CityGate]: {
    one: "gradska vrata",
    acc: "gradska vrata",
    few: "gradskih vrata",
    many: "gradskih vrata",
  },
  [FixtureType.CityGateSide]: {
    one: "gradska vrata",
    acc: "gradska vrata",
    few: "gradskih vrata",
    many: "gradskih vrata",
  },
};

const MATERIAL_FORMS: Record<MaterialType, HrNoun> = {
  // Mass nouns, both: you come back with wood, not with a wood. The
  // counting forms are the ones a Croatian speaker uses for a quantity of
  // it — tri drva, pet drva.
  [MaterialType.Wood]: { one: "drvo", acc: "drvo", few: "drva", many: "drva" },
  [MaterialType.Stone]: { one: "kamen", acc: "kamen", few: "kamena", many: "kamena" },
};

const PLANTS: Record<PlantType, Noun> = Object.fromEntries(
  Object.entries(PLANT_FORMS).map(([key, forms]) => [key, noun(forms)]),
) as Record<PlantType, Noun>;

const FIXTURES: Record<FixtureType, Noun> = Object.fromEntries(
  Object.entries(FIXTURE_FORMS).map(([key, forms]) => [key, noun(forms)]),
) as Record<FixtureType, Noun>;

const MATERIALS: Record<MaterialType, Noun> = Object.fromEntries(
  Object.entries(MATERIAL_FORMS).map(([key, forms]) => [key, noun(forms)]),
) as Record<MaterialType, Noun>;

/** The three forms of anything the player can hold. */
const FURNITURE_FORMS: Record<DecorType, HrNoun> = {
  [DecorType.Bed]: { one: "krevet", acc: "krevet", few: "kreveta", many: "kreveta" },
  [DecorType.Table]: { one: "stol", acc: "stol", few: "stola", many: "stolova" },
  [DecorType.Chair]: { one: "stolica", acc: "stolicu", few: "stolice", many: "stolica" },
  [DecorType.Rug]: { one: "tepih", acc: "tepih", few: "tepiha", many: "tepiha" },
  [DecorType.Bookshelf]: { one: "polica", acc: "policu", few: "police", many: "polica" },
  [DecorType.Stove]: { one: "peć", acc: "peć", few: "peći", many: "peći" },
  // Sudoper is the kitchen's and umivaonik the washroom's — the same split
  // German makes, and the washstand below is the other half of it.
  [DecorType.Sink]: { one: "sudoper", acc: "sudoper", few: "sudopera", many: "sudopera" },
  [DecorType.Dresser]: { one: "kredenac", acc: "kredenac", few: "kredenca", many: "kredenaca" },
  [DecorType.Kettle]: { one: "kotlić", acc: "kotlić", few: "kotlića", many: "kotlića" },
  [DecorType.Bath]: { one: "kada", acc: "kadu", few: "kade", many: "kada" },
  [DecorType.Washstand]: {
    one: "umivaonik",
    acc: "umivaonik",
    few: "umivaonika",
    many: "umivaonika",
  },
  [DecorType.Privy]: { one: "zahod", acc: "zahod", few: "zahoda", many: "zahoda" },
};

function formsOf(thing: ItemType | Buyable): HrNoun {
  return (
    PLANT_FORMS[thing as PlantType] ??
    // Before the fixtures: the store sells a garden table and an indoor one,
    // which are two objects sharing a word.
    FURNITURE_FORMS[thing as DecorType] ??
    FIXTURE_FORMS[thing as FixtureType] ??
    MATERIAL_FORMS[thing as MaterialType] ?? {
      one: thing,
      acc: thing,
      few: thing,
      many: thing,
    }
  );
}

function item(thing: ItemType | Buyable): Noun {
  return noun(formsOf(thing));
}

const STAGES: Record<PlantStage, string> = {
  [PlantStage.Seedling]: "klica",
  [PlantStage.Growing]: "raste",
  [PlantStage.Mature]: "zrelo",
};

const TERRAIN: Record<TerrainType, string> = {
  [TerrainType.Water]: "voda",
  [TerrainType.Sand]: "pijesak",
  [TerrainType.Dirt]: "zemlja",
  [TerrainType.Grass]: "trava",
  [TerrainType.Woodland]: "šuma",
  [TerrainType.Hilly]: "brda",
  [TerrainType.Mountain]: "planina",
  [TerrainType.Cobble]: "kaldrma",
};

const ROOMS: Record<string, string> = {
  cottage: "kućica",
  townhouse: "gradska kuća",
  ship: "brodsko skladište",
  observatory: "zvjezdarnica",
  barn: "štagalj",
  tower: "kula",
  schoolhouse: "škola",
};

const PLACES = ["jedinice", "desetice", "stotice"];

const COMPASS_HR: Record<string, string> = {
  east: "istok",
  west: "zapad",
  north: "sjever",
  south: "jug",
};

const PLACE_NAMES: Record<string, string> = {
  village: "selo",
  harbour: "luka",
  bigCity: "grad",
  observatory: "zvjezdarnica",
  enchantedForest: "stara šuma",
};

const INTRO_HR: Record<string, string> = {
  seeds: `Ja sam ${NAMED_PEOPLE["postal-worker"]}, poštar. Ovo je tvoj vrt. Uzmi sjeme iz vrećice pa dodirni polje na koje ga želiš posijati.`,
  spell: `Sjeme ovdje ne raste samo od sebe. Otvori čarobnjačku knjigu, baci runu + na njega i riješi zadatak. Dva bacanja i plod je zreo. ${NAMED_PEOPLE.teacher} će ti u školi pokazati kako, ako je pitaš.`,
  pick: "Dodirni zreo plod da ga ubereš. Ide ti u košaru, a polje ostaje prazno — spremno za novo sjeme.",
  store: `${NAMED_PEOPLE.shopkeeper} u štaglju otkupljuje što ubereš, a prodaje ograde, stolove i svjetiljke za vrt. Novac brojiš ti — a ona se zna i prevariti.`,
  map: `U kuli, na zidu, visi karta cijeloga svijeta. Dodirni je kad god želiš vidjeti gdje si — a ${NAMED_PEOPLE.geometer} će te ispod nje naučiti čaroliju za putovanje.`,
};

/** `1 sat`, `2 sata`, `5 sati`. */
function hours(count: number): string {
  return `${count} ${{ one: "sat", few: "sata", many: "sati" }[countForm(count)]}`;
}

/** `1 korak`, `2 koraka`, `5 koraka`. */
function paces(count: number): string {
  return `${count} ${{ one: "korak", few: "koraka", many: "koraka" }[countForm(count)]}`;
}

/** `1 red`, `2 reda`, `5 redova`. */
function rowsOf(count: number): string {
  return `${count} ${{ one: "red", few: "reda", many: "redova" }[countForm(count)]}`;
}

/** `1 grm`, `2 grma`, `5 grmova` — the wood over the tree's beds. */
function bushes(count: number): string {
  return `${count} ${{ one: "grm", few: "grma", many: "grmova" }[countForm(count)]}`;
}

/** `1 oznaka`, `2 oznake`, `5 oznaka`. */
function marks(count: number): string {
  return `${count} ${{ one: "oznaka", few: "oznake", many: "oznaka" }[countForm(count)]}`;
}

export const HR: Phrases = {
  plant: (plant) => PLANTS[plant] ?? item(plant),
  fixture: (fixture) => FIXTURES[fixture] ?? item(fixture),
  item,
  stage: (stage) => STAGES[stage] ?? stage,
  terrain: (terrain) => TERRAIN[terrain] ?? terrain,
  room: (room) => ROOMS[room] ?? room,
  count: (thing, count) => counted(formsOf(thing), count),

  cleared: "Put je slobodan.",

  titleTagline: "Vrt i računanje koje ga uzgaja",
  titleLoading: "učitavanje…",
  titleLoadingWhat: (done, total, what) => `učitavanje ${done}/${total} — ${what}`,
  titleLoadFailed: (what) => `nije se moglo učitati: ${what}`,
  titlePlay: "dodirni bilo gdje za početak",

  mapTitle: "Karta svijeta",
  mapYouAreHere: "Ti si svijetla točka.",
  placeName: (place) => PLACE_NAMES[place] ?? place,

  geometryLessonTitle: "Mjerenje svijeta",
  geometryRune:
    "Šestar u tvojoj knjizi otvara kartu. Odaberi mjesto koje već poznaješ, reci koliko je daleko, i portal će te odnijeti tamo.",
  geometryRuler: (count) =>
    `Uz svaki rub karte ide ravnalo. Jedna oznaka je ${paces(count)}, a mjesto na kojem stojiš je nula — pa oznaka na kojoj mjesto leži i jest koliko je daleko.`,
  geometryLegs: (across, acrossMarks, down, downMarks, total) =>
    `Portal ide ${acrossMarks} na ${across}, pa ${downMarks} na ${down}. To je ${acrossMarks} + ${downMarks} = ${marks(total)} puta.`,
  geometryCrow: (acrossMarks, downMarks, squares, crow) =>
    `Vrana leti ravno, a to je kraće. Pomnoži svaku stranu sa sobom pa zbroji: ${acrossMarks}×${acrossMarks} + ${downMarks}×${downMarks} = ${squares}. Let je broj koji pomnožen sam sa sobom daje ${squares} — ${crow}. Kad stvarno putuješ, zaokruži na najbližu cijelu oznaku.`,

  portalTitle: "Portal",
  portalChoose: "Kamo da te portal odnese?",
  portalLocked: "To mjesto još ne poznaješ.",
  portalHereAlready: "Već si tamo.",
  portalScale: (count) => `jedna oznaka = ${paces(count)}`,
  portalAskCount: "Koliko je to kamenčića?",
  portalAskRead: (towards) => `Koliko je daleko na ${towards}?`,
  portalAskAdd: "Koliko je daleko putem kojim portal ide?",
  portalAskCrow: "Koliko je daleko kako vrana leti?",
  portalCompass: (towards) => COMPASS_HR[towards] ?? towards,
  portalHintCount: (stones) => `Prebroj kamenčiće jedan po jedan: ima ih ${stones}.`,
  portalHintRead: (towards, count) =>
    `Pročitaj oznaku na kojoj leži: ${marks(count)} na ${towards}.`,
  portalHintLegs: (across, acrossMarks, down, downMarks) =>
    `${acrossMarks} na ${across}, pa ${downMarks} na ${down}.`,
  portalHintCrow: (acrossMarks, downMarks, squares) =>
    `${acrossMarks}×${acrossMarks} + ${downMarks}×${downMarks} = ${squares}. Vranin let pomnožen sam sa sobom daje ${squares}.`,

  groveAsks: ({ task, standing, ripe, squares }) =>
    task === "overgrown"
      ? `Šuma mi je prekrila gredice. Ukloni ${bushes(standing)} koji još stoje.`
      : task === "done"
        ? "Moj je gaj pun. Sretno ti bilo."
        : `Šest je točkica sada tvoje. Uzmi suncokret iz vrećice i baci ih na cijelu gredicu odjednom. Zrelo je ${ripe} od ${squares} polja.`,
  groveTaskTitle: "Gredice starog drveta",
  groveBargain: "Učini to i šest točkica su tvoje.",
  groveLessonTitle: "Redovi i stupci",
  groveRune:
    "Šest točkica u tvojoj knjizi radi na cijeloj gredici odjednom. Reci koliko polja ima u njoj i sva zajedno narastu.",
  groveRows: (rows, columns) =>
    `Gledaj gredicu po redovima. ${rowsOf(rows)}, a u svakom ${columns} — svaki red potpuno isti, i u tome je cijeli trik.`,
  groveCount: (rows, columns, total) =>
    `Zato broji po redovima: ${Array.from({ length: rows }, (_, at) => (at + 1) * columns).join(", ")}. To je ${rows} × ${columns} = ${total}.`,
  groveTurn: (rows, columns, total) =>
    `Sad okreni gredicu na bok: ${rowsOf(columns)} po ${rows}. Opet ${total}. ${rows} × ${columns} i ${columns} × ${rows} su ista gredica gledana s dvije strane, pa moraš naučiti samo pola tablice.`,

  arrayTitle: (rows, columns) => `${rows} × ${columns}`,
  arrayAsk: "Koliko ih je u cijeloj gredici?",
  arrayHintRows: (columns, counted) =>
    `Broji po ${columns}: ${Array.from({ length: counted }, (_, at) => (at + 1) * columns).join(", ")}…`,

  debugTitle: "Debug postavke",
  debugHint: "Dodirni naslov ponovno da ih skloniš.",
  debugFrozen: "Zaustavi selo",
  debugHungry: "Sve su životinje gladne",
  debugHour: (hour) => `Sat: ${String(hour).padStart(2, "0")}:00`,
  debugRung: (rung, of) => `Računanje: stupanj ${rung} od ${of}`,
  debugPurse: "Napuni novčanik",
  debugBasket: "Napuni košaru",
  debugLearn: "Nauči sve, idi svugdje",
  debugOn: "uključeno",
  debugOff: "isključeno",
  debugDone: "gotovo",

  shareLessonTitle: "Dijeljenje",
  shareRune: `Crta s dvije točkice u tvojoj knjizi obere cijelu gredicu odjednom — i pita kako se ulov dijeli. ${NAMED_PEOPLE.fisher} to radi svako jutro.`,
  shareHeap: (total, parts) =>
    `Ovo je cijela hrpa: ${total}. A ovo su ${parts} košare, u svaku ide jednako.`,
  shareDeal: (total, parts, each) =>
    `Obilazi košare jednu po jednu dok se hrpa ne potroši. ${total} podijeljeno na ${parts} stavlja ${each} u svaku.`,
  shareOver: (left, parts) =>
    `A ovih ${left} ne stane: inače bi jedna košara imala više od ostalih. Ostatak je uvijek manji od ${parts}.`,
  shareTitle: (total, parts) => `${total} ÷ ${parts}`,
  shareAsk: "Koliko dobiva svaka košara?",
  shareAskLeft: "A koliko je ostalo?",
  shareHintDeal: (filled, sharedOut) =>
    `${filled} napunjeno, ${sharedOut} podijeljeno. Nastavi ukrug.`,
  shareHintCount: (parts) => `Broji po ${parts} dok ne dođeš do hrpe.`,
  shareDone: (total, parts, each, left) =>
    left > 0
      ? `${total} podijeljeno na ${parts} daje ${each} svakome, a ostaje ${left}.`
      : `${total} podijeljeno na ${parts} daje točno ${each} svakome.`,

  brickTitle: "Zid",
  brickAsk: "Svaka je cigla zbroj dviju ispod sebe.",
  brickWrong: "Ta nije. Pogledaj još jednom.",
  brickDone: "To je zid. Tvoja je soba gotova.",
  brickHintAdd: "Zbroji dvije cigle ispod nje.",
  brickHintTakeAway: "Oduzmi ciglu do nje od one iznad.",

  // No name in the heading, where English and German both put one. A
  // possessive in Croatian is a *declension* — Vera's is Verin, not Veran or
  // Verain — and building one by sticking a suffix on a name out of the
  // table is how the wrong word gets printed the day somebody renames her.
  // The same reason her own lines never say her name: see the keeper's.
  // *Verin*, not *Verain*: a Croatian possessive off a woman's name drops
  // the -a before the -in. Written as the rule rather than as the word so
  // the name stays the one thing in `names.ts` — and the -in ending is the
  // masculine one, because the noun it agrees with is *uspon*.
  lampsTaskTitle: `${NAMED_PEOPLE.astronomer.replace(/a$/, "")}in uspon`,
  lampsAsk: (left) =>
    left > 0
      ? `Put do mojih vrata je mračan. Na svaki stup ide svjetiljka, a nedostaje ih još ${left}.`
      : "Svi stupovi gore. Dođi kad padne mrak i pokazat ću ti nebo.",
  lampsBargain: "Učini to i zrcalo je tvoje.",
  lampsEarned: "Zrcalo je tvoje.",

  starChartTitle: "Noć nad dolinom",
  starChartCaption: "Zvijezde kako stoje u ponoć, nacrtane rukom.",

  mirrorTitle: "Zrcalo",
  mirrorAsk: "Oboji polja tako da obje strane crte budu jednake.",
  mirrorWrong: "Ta ne. Pogledaj preko crte.",
  mirrorDone: "Obje su strane jednake. To je zrcalo.",
  mirrorHint: "Ovo je polje jedno od njih.",

  hourglassTitle: "Pješčani sat",
  hourglassAsk: "Za koliko pomičeš sat?",
  hourglassTurnIt: "Prevuci ukrug da pomakneš sat.",
  hourglassMinutes: "minuta",
  hourglassHours: "sati",
  hourglassTo: "pomakni na",
  hourglassNow: "sada je",
  hourglassCountOn: (count) => `Broji po brojčaniku: ${count}, pa dalje…`,
  hourglassSolved: (count) => `${hours(count)}. Pješčani sat se okreće.`,

  optionsButton: "postavke",
  optionsTitle: "Postavke",
  languageHeading: "Jezik",

  aboutButton: "O igri",
  aboutTitle: "O igri",
  madeBy: "Napravio Marko Ivankovic",
  copyright: "© 2026 Marko Ivankovic",
  licenceLine: "Kod: PolyForm Noncommercial 1.0.0\nGrafika: CC BY-NC-ND 4.0",
  // Per Vi, dok se u ostatku igre govori ti: ovaj se odlomak ne obraća
  // djetetu nego onome tko plaća uređaj.
  sponsorNote:
    "Ova je igra potpuno besplatna. Zauvijek će ostati besplatna. Ako želite podržati razvoj, možete to učiniti preko GitHub Sponsorships. Ako ste student, samohrani roditelj ili niste u dobroj financijskoj situaciji, molim vas da za ovu igru NE trošite novac. Podržite je samo ako koristite novac svoje škole ili druge organizacije, ili ako ste financijski dobro stojeći.",
  sourceLink: "Kod na GitHubu",
  sponsorLink: "GitHub Sponsors",

  playersTitle: "Tko igra?",
  newPlayer: "Netko novi",
  tongueTitle: "Jezik",
  makePlayerTitle: "Tko si ti?",
  namePrompt: "Tvoje ime",
  skinHeading: "Koža",
  hairHeading: "Kosa",
  shirtHeading: "Odjeća",
  bodyHeading: "Izgled",
  startPlaying: "To sam ja",
  neverMind: "Natrag",
  deviceFull: (most) =>
    `Na ovaj tablet stane ${most} ${{ one: "igrač", few: "igrača", many: "igrača" }[countForm(most)]}`,
  deletePlayer: "Ukloni igrača",
  deleteAreYouSure: (name) => `Ukloniti ${name} — i sve što je u toj igri naraslo?`,
  deleteYes: "Da, ukloni",
  deleteNo: "Ne, ostavi",
  sumsHeading: "Tvoji zadaci",
  sumsTitle: "Koliko su veliki tvoji zadaci?",
  nextStep: "Dalje",
  parentsNotice: "Va\u017ene informacije za roditelje",
  offlineNotice: "Ova se igra ne igra na internetu.",
  backupNotice:
    "Izgubite li ure\u0111aj, izgubljen je i svijet igre. Redovito sigurnosno kopirajte datoteku sa spremljenim igrama.",
  exportSaves: "Izvezi spremljene igre",
  exportDone: "Spremljeno",
  importSaves: "Vrati sigurnosnu kopiju",
  importAreYouSure:
    "Sve na ovom ure\u0111aju zamijenit \u0107e datoteka: svaki igra\u010d i svaka igra.",
  importYes: "Da, vrati",
  importNo: "Ne, zadr\u017ei",
  importNotASave: "Ta datoteka nije Mathemagicum sigurnosna kopija.",
  gamesHeading: "Igre na ovom uređaju",
  gameWhen: (savedAt) =>
    new Date(savedAt).toLocaleDateString("hr-HR", { day: "numeric", month: "short" }),
  deleteGameAsk: "Baciti ovu igru? Njezin svijet i sve učinjeno u njemu nestaju zauvijek.",

  storeTitle: (money) => `Trgovina — ${money}`,
  storeFooter: (keeper) => `${keeper} otkupljuje plodove, a prodaje stvari za vrt i kuću.`,
  keeperBuys: (keeper) => `${keeper} otkupljuje`,
  keeperSells: (keeper) => `${keeper} prodaje`,
  stockRow: (thing, price) => `${item(thing).bare}\n${price}`,
  cropRow: (thing, held, price) => `${held} x ${item(thing).bare}\n${price} po komadu`,
  buyTitle: (thing, count, price) => `${count} x ${item(thing).bare} — plati ${price}`,
  sellTitle: (thing, count, price) => `${count} x ${item(thing).bare} — duguje ti ${price}`,
  onTheCounter: (total) => `na pultu: ${total}`,
  moreToGo: (amount) => `Fali još ${amount}.`,
  tooMuch: (amount) => `${amount} previše.`,
  exactlyRight: "Točno tako — dodirni „plati”.",
  tooExpensive: "To je više novca nego što imaš.",
  paidFor: (fixture, count) => `Plaćeno. ${counted(formsOf(fixture), count)} u tvom sanduku.`,
  sheCountsOut: "ona odbrojava:",
  countHerCoins: "Prebroj njezine novčiće. Je li to točan iznos?",
  countHerPiles: "Izračunaj njezine hrpe. Je li to točan iznos?",
  back: "natrag",
  pay: "plati",
  done: "gotovo",
  clear: "obriši",
  thatsRight: "točno je",
  thatsWrong: "nije točno",

  verdictExact: (owed) => `Točno — baš ${owed}.`,
  verdictSpotted: (paid, owed, short) =>
    `Dobro oko. Bilo je ${paid}, ${short ? "manje od" : "više od"} ${owed}. Nadoknadit će ti.`,
  verdictWasRight: (owed) => `Ipak je bilo točno: ${owed}. Prebrojat će ti ponovno.`,
  verdictLookAgain: (paid, owed) => `Pogledaj još jednom — bilo je ${paid}, a ne ${owed}.`,

  // Plural, and only here. A title is a sign over a door and every sign in
  // Croatia says *dobro došli*; the singular would have to pick a gender,
  // which this book does not do — see the note at the top of the file.
  introTitle: "Dobro došli u selo",
  intro: (beat) => INTRO_HR[beat] ?? "",

  lessonTitle: "Čarolija zbrajanja",
  lessonRune:
    "Otvori knjigu i dodirni runu +. Ono ispred tebe naraste za jedan korak — ali samo ako riješiš zadatak koji ti postavi.",
  lessonSplit: (addend, parts) =>
    parts.length === 1
      ? `${addend} je već jedan komad — dakle samo jedan skok.`
      : `Rastavi broj. ${addend} je ${parts.join(" i ")}. Svaki je broj složen od ${
          parts.length === 2 ? "desetica i jedinica" : "stotica, desetica i jedinica"
        }, i to su ta ${parts.length === 2 ? "dva" : "tri"} skoka.`,
  lessonJump: (start, jumps) =>
    `Kreni od ${start} i prvo preskoči mali dio: ${jumps.map((jump) => `+${jump}`).join(", pa ")}. U svaki okvir upiši broj koji dobiješ.`,
  lessonAnswer: (answer) =>
    `Zadnji okvir je odgovor: ${answer}. Kad prvo skačeš male dijelove, svaki put se mijenja samo jedan dio broja, pa nema ništa za prenositi ni za pamtiti.`,
  lessonUndo: (total, addend, start) =>
    `Ponekad broj nedostaje na početku: ? + ${addend} = ${total}. Onda iste skokove skačeš unatrag od ${total} umjesto naprijed i sletiš ondje gdje je moralo početi: ${start}.`,
  lessonNext: "dalje",
  lessonBack: "natrag",
  lessonDone: "hajde u vrt",
  lessonExample: (start, addend) => `${start} + ${addend}`,

  place: (index) => PLACES[index] ?? "",
  jumpPrompt: (index) => `Skoči ${PLACES[index] ?? ""}. Na kojem si broju?`,
  addPlace: (index, from) => `Dodaj ${PLACES[index] ?? ""} na ${from}.`,
  sumQuestion: (from, jump) => `${from} + ${jump} = ?`,
  takeQuestion: (total, known) => `${total} − ${known} = ?`,
};
