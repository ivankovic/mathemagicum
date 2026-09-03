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
 * The register is the one a German adult uses to a child: du, imperatives,
 * and no compound noun longer than a line.
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

const ANIMALS: Record<AnimalKind, Noun> = {
  [AnimalKind.Chicken]: noun({ bare: "Huhn", gender: "n", plural: "Hühner" }),
  [AnimalKind.Duck]: noun({ bare: "Ente", gender: "f", plural: "Enten" }),
  [AnimalKind.Cat]: noun({ bare: "Katze", gender: "f", plural: "Katzen" }),
  [AnimalKind.Rabbit]: noun({ bare: "Kaninchen", gender: "n", plural: "Kaninchen" }),
};

const FIXTURES: Record<FixtureType, Noun> = {
  [FixtureType.Well]: noun({ bare: "Brunnen", gender: "m", plural: "Brunnen" }),
  [FixtureType.Fence]: noun({ bare: "Zaun", gender: "m", plural: "Zäune" }),
  [FixtureType.Table]: noun({ bare: "Gartentisch", gender: "m", plural: "Gartentische" }),
  [FixtureType.Lamp]: noun({ bare: "Laterne", gender: "f", plural: "Laternen" }),
  [FixtureType.Bench]: noun({ bare: "Bank", gender: "f", plural: "Bänke" }),
  [FixtureType.Scarecrow]: noun({ bare: "Vogelscheuche", gender: "f", plural: "Vogelscheuchen" }),
  [FixtureType.Flowerpot]: noun({ bare: "Blumentopf", gender: "m", plural: "Blumentöpfe" }),
  [FixtureType.Sorter]: noun({ bare: "Sortierer", gender: "m", plural: "Sortierer" }),
  // *Gewächshaus*, the ordinary word for a glasshouse, which is the one a
  // child would hear at home rather than a compound built for this game.
  [FixtureType.Hothouse]: noun({ bare: "Gewächshaus", gender: "n", plural: "Gewächshäuser" }),
  [FixtureType.Sieve]: noun({ bare: "Sieb", gender: "n", plural: "Siebe" }),
  [FixtureType.Tally]: noun({ bare: "Zählwerk", gender: "n", plural: "Zählwerke" }),
  [FixtureType.Windpump]: noun({ bare: "Windpumpe", gender: "f", plural: "Windpumpen" }),
  [FixtureType.Planter]: noun({ bare: "Pflanzkasten", gender: "m", plural: "Pflanzkästen" }),
  [FixtureType.Gate]: noun({ bare: "Tor", gender: "n", plural: "Tore" }),
  [FixtureType.FenceSide]: noun({ bare: "Zaun", gender: "m", plural: "Zäune" }),
  [FixtureType.FenceCorner]: noun({ bare: "Zaun", gender: "m", plural: "Zäune" }),
  [FixtureType.GateSide]: noun({ bare: "Tor", gender: "n", plural: "Tore" }),
  [FixtureType.GateSideLower]: noun({ bare: "Tor", gender: "n", plural: "Tore" }),
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
  [TerrainType.Hilly]: "Hügel",
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
  seeds: `Ich bin ${NAMED_PEOPLE["postal-worker"]}, der Postbote. Das da ist dein Garten. Nimm ein Saatkorn aus dem Beutel und tipp auf das Feld, auf das es soll.`,
  spell: `Von allein wächst hier nichts. Öffne das Zauberbuch, sprich die +-Rune darauf und löse die Aufgabe. Zweimal, dann ist die Pflanze reif. ${NAMED_PEOPLE.teacher} in der Schule zeigt es dir, wenn du sie fragst.`,
  pick: "Tipp auf eine reife Pflanze, um sie zu pflücken. Sie wandert in deinen Korb, und das Feld ist wieder leer — bereit für ein neues Saatkorn.",
  store: `${NAMED_PEOPLE.shopkeeper} in der Scheune kauft deine Ernte und verkauft Zäune, Tische und Laternen für den Garten. Das Geld zählst du selbst ab — und sie verzählt sich auch mal.`,
  map: `Im Turm hängt an der Wand eine Karte der ganzen Welt. Tipp jederzeit darauf, um zu sehen, wo du bist — und ${NAMED_PEOPLE.geometer} darunter bringt dir einen Zauber fürs Reisen bei.`,
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

const MATERIALS: Record<MaterialType, Noun> = {
  // Stoffnamen: man bringt Holz mit, nicht ein Holz.
  [MaterialType.Wood]: noun({ bare: "Holz", gender: "n", plural: "Holz" }),
  [MaterialType.Stone]: noun({ bare: "Stein", gender: "m", plural: "Steine" }),
};

const FURNITURE: Record<DecorType, Noun> = {
  [DecorType.Bed]: noun({ bare: "Bett", gender: "n", plural: "Betten" }),
  [DecorType.Table]: noun({ bare: "Tisch", gender: "m", plural: "Tische" }),
  [DecorType.Chair]: noun({ bare: "Stuhl", gender: "m", plural: "Stühle" }),
  [DecorType.Rug]: noun({ bare: "Teppich", gender: "m", plural: "Teppiche" }),
  [DecorType.Bookshelf]: noun({ bare: "Regal", gender: "n", plural: "Regale" }),
  [DecorType.Stove]: noun({ bare: "Ofen", gender: "m", plural: "Öfen" }),
  // Spüle rather than Waschbecken: the kitchen one and the washroom one are
  // two different words in German where English leans on one, and the
  // washstand below is the other.
  [DecorType.Sink]: noun({ bare: "Spüle", gender: "f", plural: "Spülen" }),
  [DecorType.Dresser]: noun({ bare: "Küchenschrank", gender: "m", plural: "Küchenschränke" }),
  [DecorType.Kettle]: noun({ bare: "Kessel", gender: "m", plural: "Kessel" }),
  [DecorType.Bath]: noun({ bare: "Badewanne", gender: "f", plural: "Badewannen" }),
  [DecorType.Washstand]: noun({ bare: "Waschtisch", gender: "m", plural: "Waschtische" }),
  [DecorType.Privy]: noun({ bare: "Plumpsklo", gender: "n", plural: "Plumpsklos" }),
};

/** `1 Baum`, `12 Bäume` — das Gehölz über den Beeten des Baums. */
function trees(count: number): string {
  return `${count} ${count === 1 ? "Baum" : "Bäume"}`;
}

function item(item: ItemType | Buyable): Noun {
  return (
    PLANTS[item as PlantType] ??
    // Before the fixtures, because the store sells a garden table *and* an
    // indoor one and they are two different objects sharing a word.
    FURNITURE[item as DecorType] ??
    FIXTURES[item as FixtureType] ??
    MATERIALS[item as MaterialType] ??
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

  cleared: "Der Weg ist frei.",

  titleTagline: "Ein Garten, und das Rechnen, das ihn wachsen lässt",
  titleLoading: "wird geladen…",
  titleLoadingWhat: (done, total, what) => `lädt ${done}/${total} — ${what}`,
  titleLoadFailed: (what) => `konnte nicht geladen werden: ${what}`,
  titlePlay: "tipp irgendwo, um zu beginnen",

  mapTitle: "Karte der Welt",
  mapYouAreHere: "Du bist der helle Punkt.",
  placeName: (place) => PLACE_NAMES[place] ?? place,

  geometryLessonTitle: "Die Welt vermessen",
  geometryRune:
    "Der Zirkel in deinem Zauberbuch öffnet eine Karte. Wähle einen Ort, an dem du schon warst, sag, wie weit er weg ist, und das Portal bringt dich hin.",
  geometryStones: (stones) =>
    `Der Weg ist mit Trittsteinen ausgelegt, einer für jeden Schritt, den das Portal macht. Tipp jeden an, während du zählst: 1, 2, 3 … bis zum letzten. Diese Reise hat ${stones} davon.`,
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

  groveAsks: ({ task, standing, ripe, squares }) =>
    task === "overgrown"
      ? `Das Gehölz hat meine Beete überwuchert. Sprich die −-Rune aus deinem Zauberbuch auf die ${trees(standing)}, die noch stehen.`
      : task === "done"
        ? "Mein Hain ist voll. Geh in Frieden."
        : `Nimm jetzt, was du verdient hast: hol eine Sonnenblume aus deinem Beutel und sprich die sechs Punkte über ein ganzes Beet auf einmal. ${ripe} von ${squares} Kästchen sind reif.`,
  groveTaskTitle: "Die Beete des Baums",
  groveBargain: "Tu das, und die sechs Punkte gehören dir.",
  groveLessonTitle: "Reihen und Spalten",
  groveRune:
    "Die sechs Punkte in deinem Zauberbuch wirken auf ein ganzes Beet auf einmal. Sag, wie viele Kästchen darin sind, dann wächst jedes einzelne mit.",
  groveRows: (rows, columns) =>
    `Sieh das Beet als Reihen an: ${rows} Reihen, und in jeder ${columns} — jede Reihe genau gleich, das ist der ganze Trick.`,
  groveCount: (rows, columns, total) =>
    `Zähl also in Reihen weiter: ${Array.from({ length: rows }, (_, at) => (at + 1) * columns).join(", ")}. Das ist ${rows} × ${columns} = ${total}.`,
  groveTurn: (rows, columns, total) =>
    `Jetzt dreh das Beet um: ${columns} Reihen zu ${rows}. Immer noch ${total}. ${rows} × ${columns} und ${columns} × ${rows} sind dasselbe Beet von zwei Seiten — du musst also nur das halbe Einmaleins lernen.`,

  arrayTitle: (rows, columns) => `${rows} × ${columns}`,
  arrayAsk: "Wie viele sind es im ganzen Beet?",
  arrayHintRows: (columns, counted) =>
    `Zähl in ${columns}er-Schritten: ${Array.from({ length: counted }, (_, at) => (at + 1) * columns).join(", ")}…`,

  debugTitle: "Debug-Optionen",
  debugHint: "Tipp noch einmal auf die Überschrift, um sie wegzulegen.",
  debugFrozen: "Das Dorf anhalten",
  debugHungry: "Alle Tiere hungrig",
  debugHour: (hour) => `Die Stunde: ${String(hour).padStart(2, "0")}:00`,
  debugRung: (rung, of) => `Die Rechenaufgaben: Stufe ${rung} von ${of}`,
  debugPurse: "Geldbeutel füllen",
  debugBasket: "Korb füllen",
  debugLearn: "Alles lernen, überall hinkommen",
  debugOn: "an",
  debugOff: "aus",
  debugDone: "fertig",

  shareLessonTitle: "Aufteilen",
  shareRune: `Der Strich mit den zwei Punkten in deinem Zauberbuch erntet ein ganzes Beet auf einmal — und fragt, wie sich der Fang aufteilt. ${NAMED_PEOPLE.fisher} macht das jeden Morgen.`,
  shareHeap: (total, parts) =>
    `Das ist der ganze Haufen: ${total}. Und das sind ${parts} Körbe, in jeden kommt gleich viel.`,
  shareDeal: (total, parts, each) =>
    `Geh die Körbe der Reihe nach durch, bis der Haufen leer ist. ${total} auf ${parts} verteilt macht ${each} in jedem.`,
  shareOver: (left, parts) =>
    `Und diese ${left} passen nicht mehr: sonst hätte ein Korb mehr als die anderen. Was übrig bleibt, ist immer weniger als ${parts}.`,
  shareTitle: (total, parts) => `${total} ÷ ${parts}`,
  shareAsk: "Wie viel bekommt jeder Korb?",
  shareAskLeft: "Und wie viel bleibt übrig?",
  shareHintDeal: (filled, sharedOut) =>
    `${filled} gefüllt, ${sharedOut} verteilt. Geh weiter herum.`,
  shareHintCount: (parts) => `Zähl in ${parts}er-Schritten, bis du beim Haufen bist.`,
  shareDone: (total, parts, each, left) =>
    left > 0
      ? `${total} auf ${parts} verteilt macht ${each} für jeden, und ${left} bleibt übrig.`
      : `${total} auf ${parts} verteilt macht genau ${each} für jeden.`,

  brickTitle: "Die Mauer",
  brickAsk: "Jeder Stein ist die Summe der beiden darunter.",
  brickWrong: "Der nicht. Schau noch einmal.",
  brickDone: "Das ist eine Mauer. Dein Zimmer steht.",
  brickHintAdd: "Zähl die beiden Steine darunter zusammen.",
  brickHintTakeAway: "Zieh den Stein daneben von dem darüber ab.",

  lampsTaskTitle: `${NAMED_PEOPLE.astronomer}s Aufstieg`,
  lampsAsk: (left) =>
    left > 0
      ? `Der Weg zu meiner Tür ist dunkel. Stell auf jeden Pfosten eine Laterne — ${left} ${left === 1 ? "fehlt" : "fehlen"} noch.`
      : "Jeder Pfosten brennt. Komm nach Einbruch der Dunkelheit herauf, dann zeige ich dir den Himmel.",
  lampsBargain: "Tu das, und der Spiegel gehört dir.",
  lampsEarned: "Der Spiegel gehört dir.",

  starChartTitle: "Die Nacht über dem Tal",
  starChartCaption: "Die Sterne, wie sie um Mitternacht stehen, von Hand gezeichnet.",

  mirrorTitle: "Der Spiegel",
  mirrorAsk: "Male die Felder aus, damit beide Seiten der Linie gleich sind.",
  mirrorWrong: "Das nicht. Schau über die Linie.",
  mirrorDone: "Beide Seiten sind gleich. Das ist ein Spiegel.",
  mirrorHint: "Dieses Feld ist eines davon.",

  hourglassTitle: "Das Stundenglas",
  hourglassAsk: "Wie weit stellst du die Uhr?",
  hourglassTurnIt: "Wisch im Kreis, um die Uhr zu drehen.",
  hourglassMinutes: "Minuten",
  hourglassHours: "Stunden",
  hourglassTo: "stell sie auf",
  hourglassNow: "jetzt ist es",
  hourglassCountOn: (hours) => `Zähl im Kreis weiter: ${hours}, und weiter…`,
  hourglassSolved: (hours) => `${hours} Stunden. Das Glas dreht sich.`,

  optionsButton: "Optionen",
  optionsTitle: "Optionen",
  languageHeading: "Sprache",

  aboutButton: "\u00dcber",
  aboutTitle: "\u00dcber dieses Spiel",
  madeBy: "Von Marko Ivankovic",
  copyright: "\u00a9 2026 Marko Ivankovic",
  licenceLine: "Code: PolyForm Noncommercial 1.0.0\nGrafik: CC BY-NC-ND 4.0",
  // Per Sie, wo der Rest des Spiels duzt: dieser Absatz spricht nicht das
  // Kind an, sondern wer f\u00fcr das Ger\u00e4t bezahlt.
  sponsorNote:
    "Dieses Spiel ist v\u00f6llig kostenlos. Es wird immer kostenlos bleiben. Wenn Sie die Entwicklung unterst\u00fctzen m\u00f6chten, k\u00f6nnen Sie das \u00fcber GitHub Sponsorships tun. Wenn Sie studieren, alleinerziehend sind oder sich nicht in einer guten finanziellen Lage befinden, geben Sie f\u00fcr dieses Spiel bitte KEIN Geld aus. Unterst\u00fctzen Sie das Spiel nur, wenn Sie Mittel Ihrer Schule oder einer anderen Organisation verwenden oder finanziell gut gestellt sind.",
  sourceLink: "Quellcode auf GitHub",
  sponsorLink: "GitHub Sponsors",

  playersTitle: "Wer spielt?",
  newPlayer: "Neu",
  tongueTitle: "Sprache",
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
  sumsHeading: "Deine Aufgaben",
  sumsTitle: "Wie groß sind deine Aufgaben?",
  nextStep: "Weiter",
  parentsNotice: "Wichtige Hinweise f\u00fcr Eltern",
  offlineNotice: "Dieses Spiel wird nicht online gespielt.",
  backupNotice:
    "Geht das Ger\u00e4t verloren, ist die Spielwelt verloren. Sichern Sie die Speicherdatei regelm\u00e4\u00dfig.",
  exportSaves: "Spielst\u00e4nde sichern",
  exportDone: "Gesichert",
  importSaves: "Sicherung einspielen",
  importAreYouSure:
    "Alles auf diesem Ger\u00e4t wird durch die Datei ersetzt: jeder Spieler und jedes Spiel.",
  importYes: "Ja, einspielen",
  importNo: "Nein, behalten",
  importNotASave: "Diese Datei ist keine Mathemagicum-Sicherung.",
  gamesHeading: "Spielstände",
  gameWhen: (savedAt) =>
    new Date(savedAt).toLocaleDateString("de-DE", { day: "numeric", month: "short" }),
  deleteGameAsk: "Diesen Spielstand löschen? Die Welt und alles darin sind dann für immer weg.",

  storeTitle: (money) => `Laden — ${money}`,
  storeFooter: (keeper) => `${keeper} kauft deine Ernte und verkauft Sachen für Garten und Haus.`,
  keeperBuys: (keeper) => `${keeper} kauft`,
  keeperSells: (keeper) => `${keeper} verkauft`,
  stockRow: (thing, price) => `${DE.item(thing).bare}\n${price}`,
  cropRow: (item, held, price) => `${held} x ${DE.item(item).bare}\nje ${price}`,
  buyTitle: (thing, count, price) => `${count} x ${DE.item(thing).bare} — zahle ${price}`,
  sellTitle: (item, count, price) => `${count} x ${DE.item(item).bare} — sie zahlt ${price}`,
  onTheCounter: (total) => `auf dem Tresen: ${total}`,
  moreToGo: (amount) => `Es fehlen noch ${amount}.`,
  tooMuch: (amount) => `${amount} zu viel.`,
  exactlyRight: "Genau richtig — tipp auf „zahlen“.",
  tooExpensive: "Das ist mehr Geld, als du hast.",
  paidFor: (fixture, count) => `Bezahlt. ${DE.count(fixture, count)} in deiner Kiste.`,
  sheCountsOut: "sie zählt ab:",
  countHerCoins: "Zähl ihre Münzen. Stimmt das Geld?",
  countHerPiles: "Rechne ihre Stapel aus. Stimmt das Geld?",
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

  introTitle: "Willkommen im Dorf",
  intro: (beat) => INTRO_DE[beat] ?? "",

  lessonTitle: "Der Additionszauber",
  lessonRune:
    "Öffne dein Zauberbuch und tipp auf die +-Rune. Was vor dir steht, wächst einen Schritt — aber nur, wenn du die Aufgabe lösen kannst.",
  lessonSplit: (addend, parts) =>
    parts.length === 1
      ? `${addend} ist schon ein einziges Stück — also nur ein Sprung.`
      : `Zerleg die Zahl. ${addend} ist ${parts.join(" und ")}. Jede Zahl besteht aus ${
          parts.length === 2 ? "Zehnern und Einern" : "Hundertern, Zehnern und Einern"
        } — und das sind die ${parts.length === 2 ? "zwei" : "drei"} Sprünge.`,
  lessonJump: (start, jumps) =>
    `Fang bei ${start} an und spring zuerst den kleinen Teil: ${jumps.map((jump) => `+${jump}`).join(", dann ")}. Schreib in jedes Kästchen die Zahl, auf der du landest.`,
  lessonAnswer: (answer) =>
    `Im letzten Kästchen steht die Lösung: ${answer}. Weil du klein anfängst, ändert sich jedes Mal nur ein Teil der Zahl — nichts zu übertragen, nichts im Kopf zu behalten.`,
  lessonUndo: (total, addend, start) =>
    `Manchmal fehlt die Zahl ganz vorne: ? + ${addend} = ${total}. Dann springst du dieselben Sprünge rückwärts von ${total} statt vorwärts und landest da, wo es angefangen haben muss: ${start}.`,
  lessonNext: "weiter",
  lessonBack: "zurück",
  lessonDone: "ab in den Garten",
  lessonExample: (start, addend) => `${start} + ${addend}`,

  place: (index) => PLACES[index] ?? "",
  jumpPrompt: (index) => `Spring die ${PLACES[index] ?? ""}. Wo landest du?`,
  addPlace: (index, from) => `Addiere die ${PLACES[index] ?? ""} zu ${from}.`,
  sumQuestion: (from, jump) => `${from} + ${jump} = ?`,
  takeQuestion: (total, known) => `${total} − ${known} = ?`,
};
