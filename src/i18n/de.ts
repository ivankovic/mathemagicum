// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { FixtureType } from "../world/fixtures";
import type { ItemType } from "../world/inventory";
import { PlantStage, PlantType } from "../world/plants";
import { TerrainType } from "../world/terrain";
import type { Noun, Phrases } from "./phrases";

/**
 * The game in German.
 *
 * Written as German rather than as English with German words in it. Two
 * things that means in practice:
 *
 * **Gender is carried by the noun, not guessed by the sentence.** `definite`
 * is the nominative ("die Karotte", "der Kaktus"), `indefinite` and `none`
 * are the accusative ("einen Zaun", "keinen Zaun"), because every sentence
 * that introduces a thing has it as the object. A single "the" would produce
 * "der Karotte" somewhere within a week.
 *
 * **No pronouns.** German would need er/sie/es agreeing with the noun, which
 * is a second table of forms to keep in step. Every sentence here is written
 * so it does not need one — "zum Aufheben antippen" rather than "tipp darauf,
 * um ihn aufzuheben" — which is also how a sign in a shop would put it.
 *
 * The interface is a rich German would use for a child: du, imperatives, and
 * no compound nouns longer than a line.
 */

interface DeNoun {
  readonly bare: string;
  readonly gender: "m" | "f" | "n";
  readonly plural: string;
}

function noun({ bare, gender, plural }: DeNoun): Noun {
  const definite = { m: "der", f: "die", n: "das" }[gender];
  // Accusative, which is the case every sentence in this file needs.
  const indefinite = { m: "einen", f: "eine", n: "ein" }[gender];
  const none = { m: "keinen", f: "keine", n: "kein" }[gender];
  return {
    bare,
    definite: `${definite} ${bare}`,
    indefinite: `${indefinite} ${bare}`,
    none: `${none} ${bare}`,
    plural,
  };
}

const PLANTS: Record<PlantType, Noun> = {
  [PlantType.Carrot]: noun({ bare: "Karotte", gender: "f", plural: "Karotten" }),
  [PlantType.Sunflower]: noun({ bare: "Sonnenblume", gender: "f", plural: "Sonnenblumen" }),
  [PlantType.Cactus]: noun({ bare: "Kaktus", gender: "m", plural: "Kakteen" }),
  [PlantType.Tomato]: noun({ bare: "Tomate", gender: "f", plural: "Tomaten" }),
  [PlantType.Pepper]: noun({ bare: "Paprika", gender: "f", plural: "Paprika" }),
  // Stoffname: man erntet Weizen, nicht Weizens.
  [PlantType.Wheat]: noun({ bare: "Weizen", gender: "m", plural: "Weizen" }),
};

const FIXTURES: Record<FixtureType, Noun> = {
  [FixtureType.Well]: noun({ bare: "Brunnen", gender: "m", plural: "Brunnen" }),
  [FixtureType.Fence]: noun({ bare: "Zaun", gender: "m", plural: "Zäune" }),
  [FixtureType.Table]: noun({ bare: "Tisch", gender: "m", plural: "Tische" }),
  [FixtureType.Lamp]: noun({ bare: "Laterne", gender: "f", plural: "Laternen" }),
  [FixtureType.Gate]: noun({ bare: "Tor", gender: "n", plural: "Tore" }),
  [FixtureType.FenceSide]: noun({ bare: "Zaun", gender: "m", plural: "Zäune" }),
  [FixtureType.GateSide]: noun({ bare: "Tor", gender: "n", plural: "Tore" }),
  [FixtureType.Glowcap]: noun({ bare: "Leuchtpilz", gender: "m", plural: "Leuchtpilze" }),
  [FixtureType.Stall]: noun({ bare: "Marktstand", gender: "m", plural: "Marktstände" }),
  [FixtureType.CityWall]: noun({ bare: "Stadtmauer", gender: "f", plural: "Stadtmauern" }),
  [FixtureType.CityWallSide]: noun({ bare: "Stadtmauer", gender: "f", plural: "Stadtmauern" }),
  [FixtureType.CityGate]: noun({ bare: "Stadttor", gender: "n", plural: "Stadttore" }),
  [FixtureType.CityGateSide]: noun({ bare: "Stadttor", gender: "n", plural: "Stadttore" }),
};

const STAGES: Record<PlantStage, string> = {
  [PlantStage.Seedling]: "ein Keimling",
  [PlantStage.Growing]: "am Wachsen",
  [PlantStage.Mature]: "reif",
};

const TERRAIN: Record<TerrainType, string> = {
  [TerrainType.Water]: "Wasser",
  [TerrainType.Sand]: "Sand",
  [TerrainType.Dirt]: "Erde",
  [TerrainType.Grass]: "Gras",
  [TerrainType.Woodland]: "Waldboden",
  [TerrainType.Hilly]: "Hügeln",
  [TerrainType.Mountain]: "Fels",
  [TerrainType.Cobble]: "Pflaster",
};

const ROOMS: Record<string, string> = {
  cottage: "Hütte",
  townhouse: "Stadthaus",
  ship: "Schiffsbauch",
  observatory: "Sternwarte",
  barn: "Scheune",
  tower: "Turm",
  schoolhouse: "Schulhaus",
};

// "In der Scheune", "im Turm": the room names again, in the one case the
// entering message needs them in.
const IN_ROOM: Record<string, string> = {
  cottage: "in der Hütte",
  townhouse: "im Stadthaus",
  ship: "im Schiffsbauch",
  observatory: "in der Sternwarte",
  barn: "in der Scheune",
  tower: "im Turm",
  schoolhouse: "im Schulhaus",
};

const PLACES = ["Einer", "Zehner", "Hunderter"];

// Die fünf Orte, die die Welt setzt.
const COMPASS_DE: Record<string, string> = {
  east: "Osten",
  west: "Westen",
  north: "Norden",
  south: "Süden",
};

const PLACE_NAMES: Record<string, string> = {
  village: "das Dorf",
  harbour: "der Hafen",
  bigCity: "die Stadt",
  observatory: "die Sternwarte",
  enchantedForest: "der alte Wald",
};

// Der Rundgang, Seite für Seite. Nach IntroBeat geschlüsselt, damit eine neue
// Seite in jeder Sprache auffällt und nicht leer bleibt.
const INTRO_DE: Record<string, string> = {
  seeds:
    "Das da ist dein Garten. Nimm ein Saatkorn aus dem Beutel — es kommt auf das Feld, vor dem du stehst.",
  spell:
    "Von allein wächst hier nichts. Öffne das Zauberbuch, sprich die +-Rune darauf und löse die Aufgabe. Zweimal, dann ist die Pflanze reif. Die Lehrerin in der Schule zeigt dir, wie es geht.",
  pick: "Tipp auf eine reife Pflanze, um sie zu pflücken. Sie wandert in deinen Korb und wächst nach.",
  store:
    "Die Händlerin in der Scheune kauft deine Ernte und verkauft Zäune, Tische und Laternen für den Garten. Das Geld zählst du selbst ab — und sie verzählt sich auch mal.",
  map: "Im Turm hängt an der Wand eine Karte der ganzen Welt. Tipp jederzeit darauf, um zu sehen, wo du bist — und der Geometer darunter bringt dir einen Zauber fürs Reisen bei.",
};

/**
 * A sentence that starts with a noun form starts with a capital.
 *
 * The forms are stored lowercase because most of them appear mid-sentence
 * ("du hast keinen Zaun"); the handful that open a line are capitalised here
 * rather than stored twice.
 */
function cap(line: string): string {
  return line.charAt(0).toUpperCase() + line.slice(1);
}

const FALLBACK = { gender: "f", plural: "" } as const;

function item(item: ItemType): Noun {
  return (
    PLANTS[item as PlantType] ??
    FIXTURES[item as FixtureType] ??
    noun({ bare: item, ...FALLBACK, plural: item })
  );
}

export const DE: Phrases = {
  plant: (plant) => PLANTS[plant] ?? item(plant),
  fixture: (fixture) => FIXTURES[fixture] ?? item(fixture),
  item,
  stage: (stage) => STAGES[stage] ?? stage,
  terrain: (terrain) => TERRAIN[terrain] ?? terrain,
  room: (room) => ROOMS[room] ?? room,
  count: (thing, count) => {
    const name = item(thing);
    return `${count} ${count === 1 ? name.bare : name.plural}`;
  },

  nothingGrowsIndoors: "Drinnen wächst nichts",
  noRoomToPlant: "Da ist kein Platz zum Pflanzen",
  alreadyPlanted: "Da wächst schon etwas",
  wrongGround: (plant, terrain) =>
    cap(`${PLANTS[plant]?.definite} wächst nicht auf ${TERRAIN[terrain]}`),
  planted: (plant) =>
    cap(`${PLANTS[plant]?.indefinite} gepflanzt — sprich die Plus-Rune zum Wachsen`),
  faceToGrow: "Stell dich vor etwas Gepflanztes, um es wachsen zu lassen",
  alreadyGrown: (plant) => cap(`${PLANTS[plant]?.definite} ist schon voll gewachsen`),
  grownTo: (plant, stage) => cap(`${PLANTS[plant]?.definite} ist jetzt ${STAGES[stage]}`),
  picked: (plant, held) =>
    cap(`${PLANTS[plant]?.indefinite} gepflückt — du hast ${DE.count(plant, held)}`),
  notRipe: (plant) => cap(`${PLANTS[plant]?.definite} ist noch nicht reif — nutze die Plus-Rune`),
  faceToPick: "Stell dich vor etwas Gepflanztes, um es zu pflücken",

  notInHere: "Hier drinnen nicht",
  notYours: (fixture) => cap(`${FIXTURES[fixture]?.indefinite} kannst du nicht mitnehmen`),
  noneLeft: (fixture) => `Du hast ${FIXTURES[fixture]?.none} — kauf einen im Laden`,
  noRoomThere: "Da ist kein Platz",
  somethingGrowing: "Da wächst etwas",
  putDown: (fixture) => cap(`${FIXTURES[fixture]?.indefinite} hingestellt — zum Aufheben antippen`),
  tooFarToReach: "Zu weit weg — geh erst hin",
  pickedUp: (fixture, held) =>
    cap(`${FIXTURES[fixture]?.indefinite} aufgehoben — du hast ${DE.count(fixture, held)}`),

  nothingToClear: "Stell dich zuerst vor etwas im Weg.",
  willNotClear: "Das gehört dir. Der Zauber nimmt nur, was der Boden wachsen ließ.",
  cleared: "Der Weg ist frei.",
  spellFades: "Der Zauber verklingt ungesprochen",
  tooFarToSpeak: "Zu weit weg — geh erst zu ihr",
  tooFarFromLandmark: "Zu weit weg — geh erst ganz nah heran",
  cannotWalkThere: "Da geht es nicht weiter",
  greatTreeGreeting: "Der große Baum regt sich, und seine Lichter neigen sich dir zu",
  lighthouseGreeting: "Oben dreht sich das Licht, und das Meer reicht weiter, als du sehen kannst",
  clockTowerGreeting: "Über dir tickt die Uhr und teilt die Stunde ein",
  entered: (room) => `Du bist ${IN_ROOM[room] ?? room}. Durch die Tür geht es wieder hinaus.`,

  titleTagline: "Ein Garten, und das Rechnen, das ihn wachsen lässt",
  titleLoading: "wird geladen…",
  titlePlay: "tipp irgendwo, um zu beginnen",

  mapTitle: "Karte der Welt",
  mapYouAreHere: "Du bist der helle Punkt.",
  placeName: (place) => PLACE_NAMES[place] ?? place,

  geometerGreeting: "Der Geometer blickt von seinem Tisch auf.",
  portalUntaught: "Diesen hat dir noch niemand beigebracht. Im Turm kennt ihn jemand.",
  portalTaught: "Der Geometer bringt dir den Portalzauber bei.",
  geometryLessonTitle: "Die Welt vermessen",
  geometryRune:
    "Der Zirkel in deinem Zauberbuch öffnet eine Karte. Wähle einen Ort, an dem du schon warst, sage wie weit er weg ist, und das Portal bringt dich hin.",
  geometryRuler: (paces) =>
    `An jeder Seite der Karte läuft ein Lineal. Ein Strich sind ${paces} Schritte, und wo du stehst, ist null — der Strich, auf dem ein Ort liegt, ist also seine Entfernung.`,
  geometryLegs: (across, acrossMarks, down, downMarks, total) =>
    `Das Portal geht ${acrossMarks} nach ${across}, dann ${downMarks} nach ${down}. Das sind ${acrossMarks} + ${downMarks} = ${total} Striche Weg.`,
  geometryCrow: (acrossMarks, downMarks, squares, crow) =>
    `Eine Krähe fliegt geradeaus, und das ist kürzer. Nimm jede Seite mal sich selbst und zähle zusammen: ${acrossMarks}×${acrossMarks} + ${downMarks}×${downMarks} = ${squares}. Die Luftlinie ist die Zahl, die mal sich selbst ${squares} ergibt — ${crow}. Auf einer echten Reise sagst du den nächsten ganzen Strich.`,

  portalTitle: "Portal",
  portalChoose: "Wohin soll dich das Portal bringen?",
  portalLocked: "Da warst du noch nie.",
  portalHereAlready: "Da bist du schon.",
  portalScale: (paces) => `ein Strich = ${paces} Schritte`,
  portalAskCount: "Wie viele Steine sind es?",
  portalAskRead: (towards) => `Wie weit ist es nach ${towards}?`,
  portalAskAdd: "Wie weit ist es, so wie das Portal geht?",
  portalAskCrow: "Wie weit ist es in der Luftlinie?",
  portalCompass: (towards) => COMPASS_DE[towards] ?? towards,
  portalHintCount: (stones) => `Zähle die Steine einzeln: es sind ${stones}.`,
  portalHintRead: (towards, marks) => `Lies den Strich ab: ${marks} nach ${towards}.`,
  portalHintLegs: (across, acrossMarks, down, downMarks) =>
    `${acrossMarks} nach ${across}, dann ${downMarks} nach ${down}.`,
  portalHintCrow: (acrossMarks, downMarks, squares) =>
    `${acrossMarks}×${acrossMarks} + ${downMarks}×${downMarks} = ${squares}. Die Luftlinie mal sich selbst ergibt ${squares}.`,
  portalArrived: (place) => `Das Portal setzt dich bei ${place} ab.`,

  arrayUntaught: "Den hast du dir noch nicht verdient. Im alten Wald wartet etwas auf dich.",
  arrayTaught: "Dein Hain ist voll. Der große Baum bringt dir den Feld-Zauber bei.",
  groveAsks: ({ task, standing, ripe, squares }) =>
    task === "overgrown"
      ? `Das Gehölz hat mein Beet überwuchert. Nimm die ${standing} weg, die noch stehen.`
      : task === "done"
        ? "Mein Hain ist voll. Geh in Frieden."
        : `Füll mein Beet: ${ripe} von ${squares} Kästchen sind reif.`,
  groveLessonTitle: "Reihen und Spalten",
  groveRune:
    "Die sechs Punkte in deinem Zauberbuch bepflanzen ein ganzes Beet auf einmal. Sag, wie viele Setzlinge hineinpassen, dann kommen sie alle zusammen in die Erde.",
  groveRows: (rows, columns) =>
    `Sieh das Beet als Reihen an: ${rows} Reihen, und in jeder ${columns} — jede Reihe genau gleich, das ist der ganze Trick.`,
  groveCount: (rows, columns, total) =>
    `Zähl also in Reihen weiter: ${Array.from({ length: rows }, (_, at) => (at + 1) * columns).join(", ")}. Das ist ${rows} × ${columns} = ${total}.`,
  groveTurn: (rows, columns, total) =>
    `Jetzt dreh das Beet um: ${columns} Reihen zu ${rows}. Immer noch ${total}. ${rows} × ${columns} und ${columns} × ${rows} sind dasselbe Beet von zwei Seiten — du musst also nur das halbe Einmaleins lernen.`,

  arrayTitle: (rows, columns) => `${rows} × ${columns}`,
  arrayMarkOut: "Steck das Feld ab: tipp auf eine Ecke, dann auf die andere.",
  arrayTooSmall: "Ein einzelnes Kästchen ist kein Feld — tipp auf eine zweite Ecke.",
  arrayNothingToDo: "In dem Feld gibt es nichts zu pflanzen, wachsen zu lassen oder zu räumen.",
  arrayChooseAction: "Jetzt wähl, was damit geschehen soll.",
  patchAction: (action) =>
    action === "plant" ? "bepflanzen" : action === "grow" ? "wachsen lassen" : "räumen",
  patchDone: (action, count) =>
    count === 0
      ? "Da war nichts."
      : action === "plant"
        ? `${count} Setzlinge auf einmal.`
        : action === "grow"
          ? `${count} davon sind auf einmal gewachsen.`
          : `${count} Kästchen auf einmal geräumt.`,
  arrayAsk: "Wie viele sind es im ganzen Beet?",
  noRoomForArray: (rows, columns) =>
    `Der Zauber braucht freien Boden, ${columns} breit und ${rows} tief, von dem Feld aus, vor dem du stehst.`,
  arrayHintRows: (columns, counted) =>
    `Zähl in ${columns}er-Schritten: ${Array.from({ length: counted }, (_, at) => (at + 1) * columns).join(", ")}…`,
  arrayPlanted: (plant, count) => `${count} ${plant}-Setzlinge, in Reihen.`,

  hourglassTitle: "Das Stundenglas",
  hourglassAsk: "Wie viele Stunden warst du fort?",
  hourglassLeft: "du gingst",
  hourglassBack: "du bist zurück",
  hourglassCountOn: (hours) => `Zähl im Kreis weiter: ${hours}, und weiter…`,
  hourglassSolved: (hours) => `${hours} Stunden. Das Glas dreht sich.`,
  hourglassNoTime: "Das Glas zeigt dieselbe Stunde wie zuvor. Komm später wieder.",
  hourglassNothingGrowing: "Zeit ist vergangen, aber nichts von dir wächst. Pflanz zuerst etwas.",
  hourglassUntaught:
    "Den hast du dir noch nicht verdient. Oben im Gebirge hütet jemand die Stunden.",
  hourglassTaught: "Der Weg ist erleuchtet. Die Astronomin lehrt dich das Stundenglas.",
  astronomerGreeting: "Die Astronomin blickt vom Okular auf.",
  astronomerAsks: (dark, given) => {
    const left = dark === 1 ? "Eine Laterne fehlt" : `${dark} Laternen fehlen`;
    const posts = dark === 1 ? "den leeren Pfosten" : "die leeren Pfosten";
    if (given <= 0) return `${left} noch am Weg.`;
    const here = given === 1 ? "Hier ist eine" : `Hier sind ${given}`;
    return `${left} noch am Weg. ${here} — stell sie auf ${posts}.`;
  },
  astronomerBlocked: "Auf den Pfosten steht schon etwas. Räum sie zuerst frei.",
  starChartRead: "Eine Karte der Nacht, mit dem Großen Wagen eingezeichnet.",
  hourglassGrew: (count) =>
    count === 1
      ? "Eines ist gewachsen, während du fort warst."
      : `${count} sind gewachsen, während du fort warst.`,

  purseTier: (count, amount) => (count > 0 ? `${count} Münzen — ${amount}` : "davon keine"),
  purseEmpty: "Dein Geldbeutel ist leer",

  optionsButton: "Optionen",
  optionsTitle: "Optionen",
  languageHeading: "Sprache",
  cropSellsFor: (price) => `Eine Ernte bringt ${price}`,

  playersTitle: "Wer spielt?",
  newPlayer: "Neu",
  makePlayerTitle: "Wer bist du?",
  namePrompt: "Dein Name",
  skinHeading: "Haut",
  hairHeading: "Haare",
  shirtHeading: "Kleidung",
  bodyHeading: "Aussehen",
  startPlaying: "Das bin ich",
  neverMind: "Zurück",
  deviceFull: (most) => `Auf diesem Gerät haben ${most} Spieler Platz`,
  deletePlayer: "Spieler entfernen",
  deleteAreYouSure: (name) => `${name} entfernen — mit allem, was ${name} angebaut hat?`,
  deleteYes: "Ja, entfernen",
  deleteNo: "Nein, behalten",
  worldRebuilt: "Die Welt wurde neu gebaut. Deine Münzen und dein Korb gehören weiter dir.",
  sumsHeading: "Deine Aufgaben",

  storeTitle: (money) => `Dorfladen — ${money}`,
  storeFooter: "Sie kauft deine Ernte und verkauft Sachen für den Garten.",
  sheBuys: "Sie kauft",
  sheSells: "Sie verkauft",
  stockRow: (fixture, price) => `${FIXTURES[fixture]?.bare}\n${price}`,
  cropRow: (plant, held, price) => `${held} x ${PLANTS[plant]?.bare}\n${price} je`,
  buyTitle: (fixture, count, price) => `${count} x ${FIXTURES[fixture]?.bare} — zahle ${price}`,
  sellTitle: (plant, count, price) => `${count} x ${PLANTS[plant]?.bare} — sie zahlt ${price}`,
  onTheCounter: (total) => `auf dem Tresen: ${total}`,
  moreToGo: (amount) => `Es fehlen noch ${amount}.`,
  tooMuch: (amount) => `${amount} zu viel.`,
  exactlyRight: "Genau richtig — tipp auf „zahlen“.",
  tooExpensive: "Das ist mehr Geld, als du hast.",
  paidFor: (fixture, count) => `Bezahlt. ${DE.count(fixture, count)} im Kasten.`,
  sheCountsOut: "sie zählt ab:",
  countHerCoins: "Zähl ihre Münzen. Stimmt das Geld?",
  back: "zurück",
  pay: "zahlen",
  done: "fertig",
  clear: "leeren",
  thatsRight: "stimmt",
  thatsWrong: "stimmt nicht",

  verdictExact: (owed) => `Richtig — genau ${owed}.`,
  verdictSpotted: (paid, owed, short) =>
    `Gut aufgepasst. Das waren ${paid} statt ${owed} — ${short ? "zu wenig" : "zu viel"}. Sie gleicht es aus.`,
  verdictWasRight: (owed) => `Es stimmte doch: ${owed}. Sie zählt es noch einmal vor.`,
  verdictLookAgain: (paid, owed) => `Schau noch einmal — das waren ${paid}, nicht ${owed}.`,

  postmanGreeting: "Der Postbote kommt herüber — er hat etwas für dich.",
  introTitle: "Willkommen im Dorf",
  intro: (beat) => INTRO_DE[beat] ?? "",

  teacherGreeting: "Die Lehrerin schaut von ihrem Pult auf.",
  lessonTitle: "Der Additionszauber",
  lessonRune:
    "Öffne dein Zauberbuch und tipp auf die +-Rune. Was vor dir steht, wächst einen Schritt — aber nur, wenn du die Aufgabe lösen kannst.",
  lessonSplit: (addend, parts) =>
    `Zerleg die Zahl. ${addend} ist ${parts.join(" und ")}. Jede Zahl besteht aus Hundertern, Zehnern und Einern — und das sind die drei Sprünge.`,
  lessonJump: (start, jumps) =>
    `Fang bei ${start} an und spring zuerst den kleinen Teil: ${jumps.map((jump) => `+${jump}`).join(", dann ")}. Schreib in jedes Kästchen die Zahl, auf der du landest.`,
  lessonAnswer: (answer) =>
    `Im letzten Kästchen steht die Lösung: ${answer}. Weil du klein anfängst, ändert sich jedes Mal nur ein Teil der Zahl — nichts zu übertragen, nichts im Kopf zu behalten.`,
  lessonNext: "weiter",
  lessonBack: "zurück",
  lessonDone: "ab in den Garten",
  lessonExample: (start, addend) => `${start} + ${addend}`,

  place: (index) => PLACES[index] ?? "",
  jumpPrompt: (index) => `Spring die ${PLACES[index] ?? ""}. Wo landest du?`,
  addPlace: (index, from) => `Addiere die ${PLACES[index] ?? ""} zu ${from}.`,
  sumQuestion: (from, jump) => `${from} + ${jump} = ?`,
};
