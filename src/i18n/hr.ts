// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { AnimalKind } from "../world/animals";
import { FixtureType } from "../world/fixtures";
import type { ItemType } from "../world/inventory";
import { MaterialType } from "../world/materials";
import { PlantStage, PlantType } from "../world/plants";
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
  [FixtureType.Table]: { one: "stol", acc: "stol", few: "stola", many: "stolova" },
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
  [MaterialType.Stone]: { one: "kamen", acc: "kamen", few: "kamena", many: "kamenja" },
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
function formsOf(thing: ItemType): HrNoun {
  return (
    PLANT_FORMS[thing as PlantType] ??
    FIXTURE_FORMS[thing as FixtureType] ??
    MATERIAL_FORMS[thing as MaterialType] ?? {
      one: thing,
      acc: thing,
      few: thing,
      many: thing,
    }
  );
}

function item(thing: ItemType): Noun {
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
  seeds: "Ovo je tvoj vrt. Uzmi sjeme iz vrećice i past će u zemlju na polje ispred tebe.",
  spell:
    "Sjeme ovdje ne raste samo od sebe. Otvori čarobnjačku knjigu, baci runu + na njega i riješi zadatak. Dva bacanja i plod je zreo. Učiteljica u školi pokazat će ti kako, ako je pitaš.",
  pick: "Dodirni zreo plod da ga ubereš. Ide ti u košaru, a na polju naraste novi.",
  store:
    "Trgovkinja u štaglju otkupljuje što ubereš, a prodaje ograde, stolove i svjetiljke za vrt. Novac brojiš sam — a ona se zna i prevariti.",
  map: "U kuli, na zidu, visi karta cijeloga svijeta. Dodirni je kad god želiš vidjeti gdje si — a geometar ispod nje naučit će te čaroliju za putovanje.",
};

/** `1 sat`, `2 sata`, `5 sati`. */
function hours(count: number): string {
  return `${count} ${{ one: "sat", few: "sata", many: "sati" }[countForm(count)]}`;
}

/** `1 korak`, `2 koraka`, `5 koraka`. */
function paces(count: number): string {
  return `${count} ${{ one: "korak", few: "koraka", many: "koraka" }[countForm(count)]}`;
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

  titleTagline: "Vrt, i računanje koje ga uzgaja",
  titleLoading: "učitavanje…",
  titleLoadingWhat: (done, total, what) => `učitavanje ${done}/${total} — ${what}`,
  titleLoadFailed: (what) => `nije se moglo učitati: ${what}`,
  titlePlay: "dodirni bilo gdje za početak",

  mapTitle: "Karta svijeta",
  mapYouAreHere: "Ti si svijetla točka.",
  placeName: (place) => PLACE_NAMES[place] ?? place,

  geometryLessonTitle: "Mjerenje svijeta",
  geometryRune:
    "Šestar u tvojoj knjizi otvara kartu. Odaberi mjesto na kojem si već bio, reci koliko je daleko, i portal će te odnijeti tamo.",
  geometryRuler: (count) =>
    `Uz svaki rub karte ide ravnalo. Jedna oznaka je ${paces(count)}, a mjesto na kojem stojiš je nula — pa oznaka na kojoj mjesto leži i jest koliko je daleko.`,
  geometryLegs: (across, acrossMarks, down, downMarks, total) =>
    `Portal ide ${acrossMarks} na ${across}, pa ${downMarks} na ${down}. To je ${acrossMarks} + ${downMarks} = ${marks(total)} puta.`,
  geometryCrow: (acrossMarks, downMarks, squares, crow) =>
    `Vrana leti ravno, a to je kraće. Pomnoži svaku stranu sa sobom pa zbroji: ${acrossMarks}×${acrossMarks} + ${downMarks}×${downMarks} = ${squares}. Let je broj koji pomnožen sam sa sobom daje ${squares} — ${crow}. Na pravom putu zaokruži na najbližu cijelu oznaku.`,

  portalTitle: "Portal",
  portalChoose: "Kamo da te portal odnese?",
  portalLocked: "Tamo još nisi bio.",
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
      ? `Šuma mi je prekrila gredice. Ukloni ${standing} što još stoje.`
      : task === "done"
        ? "Moj je gaj pun. Sretno ti bilo."
        : `Napuni mi gredice suncokretima: zrelo je ${ripe} od ${squares} polja.`,
  groveTaskTitle: "Gredice starog drveta",
  groveBargain: "Učini to i šest točkica su tvoje.",
  groveLessonTitle: "Redovi i stupci",
  groveRune:
    "Šest točkica u tvojoj knjizi sadi cijelu gredicu odjednom. Reci koliko će klica stati u nju, i sve ulaze zajedno.",
  groveRows: (rows, columns) =>
    `Gledaj gredicu po redovima. ${rows} reda, a u svakom ${columns} — svaki red potpuno isti, i u tome je cijeli trik.`,
  groveCount: (rows, columns, total) =>
    `Zato broji po redovima: ${Array.from({ length: rows }, (_, at) => (at + 1) * columns).join(", ")}. To je ${rows} × ${columns} = ${total}.`,
  groveTurn: (rows, columns, total) =>
    `Sad okreni gredicu na bok: ${columns} reda po ${rows}. Opet ${total}. ${rows} × ${columns} i ${columns} × ${rows} su ista gredica gledana s dvije strane, pa moraš naučiti samo pola tablice.`,

  arrayTitle: (rows, columns) => `${rows} × ${columns}`,
  arrayAsk: "Koliko ih je u cijeloj gredici?",
  arrayHintRows: (columns, counted) =>
    `Broji po ${columns}: ${Array.from({ length: counted }, (_, at) => (at + 1) * columns).join(", ")}…`,

  brickTitle: "Zid",
  brickAsk: "Svaka je cigla zbroj dviju ispod sebe.",
  brickWrong: "Ta nije. Pogledaj još jednom.",
  brickDone: "To je zid. Tvoja je soba gotova.",
  brickHintAdd: "Zbroji dvije cigle ispod nje.",
  brickHintTakeAway: "Oduzmi ciglu do nje od one iznad.",

  hourglassTitle: "Pješčani sat",
  hourglassAsk: "Koliko si sati bio odsutan?",
  hourglassLeft: "otišao si",
  hourglassBack: "vratio si se",
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
  newPlayer: "Novi igrač",
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
  deleteAreYouSure: (name) => `Ukloniti ${name} i sve što je ${name} uzgojio?`,
  deleteYes: "Da, ukloni",
  deleteNo: "Ne, ostavi",
  sumsHeading: "Tvoji zadaci",
  gamesHeading: "Igre na ovom uređaju",
  gameWhen: (savedAt) =>
    new Date(savedAt).toLocaleDateString("hr-HR", { day: "numeric", month: "short" }),
  deleteGameAsk: "Baciti ovu igru? Njezin svijet i sve učinjeno u njemu nestaju zauvijek.",

  storeTitle: (money) => `Trgovina — ${money}`,
  storeFooter: "Otkupljuje plodove, a prodaje stvari za tvoj vrt.",
  sheBuys: "Otkupljuje",
  sheSells: "Prodaje",
  stockRow: (fixture, price) => `${FIXTURES[fixture]?.bare}\n${price}`,
  cropRow: (thing, held, price) => `${held} x ${item(thing).bare}\n${price} po komadu`,
  buyTitle: (fixture, count, price) => `${count} x ${FIXTURES[fixture]?.bare} — plati ${price}`,
  sellTitle: (thing, count, price) => `${count} x ${item(thing).bare} — duguje ti ${price}`,
  onTheCounter: (total) => `na pultu: ${total}`,
  moreToGo: (amount) => `Fali još ${amount}.`,
  tooMuch: (amount) => `${amount} previše.`,
  exactlyRight: "Točno tako — dodirni plati.",
  tooExpensive: "To je više novca nego što imaš.",
  paidFor: (fixture, count) => `Plaćeno. ${counted(formsOf(fixture), count)} u tvom sanduku.`,
  sheCountsOut: "ona odbrojava:",
  countHerCoins: "Prebroj njezine novčiće. Je li to točan iznos?",
  back: "natrag",
  pay: "plati",
  done: "gotovo",
  clear: "obriši",
  thatsRight: "točno je",
  thatsWrong: "nije točno",

  verdictExact: (owed) => `Točno — ${owed} na dlaku.`,
  verdictSpotted: (paid, owed, short) =>
    `Dobro si uočio. Bilo je ${paid}, ${short ? "manje od" : "više od"} ${owed}. Nadoknadit će ti.`,
  verdictWasRight: (owed) => `Ipak je bilo točno: ${owed}. Prebrojat će ti ponovno.`,
  verdictLookAgain: (paid, owed) => `Pogledaj još jednom — bilo je ${paid}, a ne ${owed}.`,

  introTitle: "Dobro došao u selo",
  intro: (beat) => INTRO_HR[beat] ?? "",

  lessonTitle: "Čarolija zbrajanja",
  lessonRune:
    "Otvori knjigu i dodirni runu +. Ono ispred tebe naraste za jedan korak — ali samo ako riješiš zadatak koji ti postavi.",
  lessonSplit: (addend, parts) =>
    `Rastavi broj. ${addend} je ${parts.join(" i ")}. Svaki je broj složen od stotica, desetica i jedinica, i to su ta tri skoka.`,
  lessonJump: (start, jumps) =>
    `Kreni od ${start} i prvo preskoči mali dio: ${jumps.map((jump) => `+${jump}`).join(", pa ")}. Upiši broj na koji si sletio u svaki okvir.`,
  lessonAnswer: (answer) =>
    `Zadnji okvir je odgovor: ${answer}. Kad prvo skačeš male dijelove, svaki put se mijenja samo jedan dio broja, pa nema ništa za prenositi ni za pamtiti.`,
  lessonNext: "dalje",
  lessonBack: "natrag",
  lessonDone: "sad idi",
  lessonExample: (start, addend) => `${start} + ${addend}`,

  place: (index) => PLACES[index] ?? "",
  jumpPrompt: (index) => `Preskoči ${PLACES[index] ?? ""}. Gdje si sletio?`,
  addPlace: (index, from) => `Dodaj ${PLACES[index] ?? ""} na ${from}.`,
  sumQuestion: (from, jump) => `${from} + ${jump} = ?`,
};
