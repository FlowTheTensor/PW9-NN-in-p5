// =============================================================================
//  daten.js – Prozessdaten einer Spritzgießmaschine
// =============================================================================
//  Pro Bauteil werden zwei Prozesswerte gemessen:
//    - Werkzeugtemperatur in °C
//    - Einspritzdruck in bar
//  Die Qualitätsprüfung entscheidet danach:
//    Klasse 1 = i.O.   (in Ordnung, Gutteil)
//    Klasse 0 = n.i.O. (nicht in Ordnung, Ausschuss)
//
//  Das neuronale Netz kennt die Regel dahinter NICHT – es soll sie aus den
//  Beispielen lernen.
// =============================================================================

const MERKMALE = [
  { name: "Temperatur", einheit: "°C", min: 180, max: 260 },
  { name: "Druck", einheit: "bar", min: 600, max: 1400 },
];

// Das Netz rechnet mit normierten Werten zwischen −1 und +1
function normieren(wert, merkmal) {
  return ((wert - merkmal.min) / (merkmal.max - merkmal.min)) * 2 - 1;
}

function entnormieren(n, merkmal) {
  return merkmal.min + ((n + 1) / 2) * (merkmal.max - merkmal.min);
}

// Das "Prozessfenster": nur hier entstehen Gutteile.
// (Daraus werden die Beispieldaten erzeugt – das Netz sieht diese Regel nie.)
const PROZESSFENSTER = { tMin: 205, tMax: 242, pMin: 880 };

function pruefeBauteil(t, p) {
  if (t < PROZESSFENSTER.tMin) {
    return { label: 0, fehler: "unvollständig gefüllt (zu kalt)" };
  }
  if (t > PROZESSFENSTER.tMax) {
    return { label: 0, fehler: "Schlieren / Verbrennung (zu heiß)" };
  }
  if (p < PROZESSFENSTER.pMin) {
    return { label: 0, fehler: "Einfallstellen (zu wenig Druck)" };
  }
  return { label: 1, fehler: "" };
}

// Zufallsgenerator mit festem Startwert: der Datensatz ist bei jedem Start gleich
function zufallsGenerator(startwert) {
  let a = startwert >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function erzeugeDatensatz() {
  const rnd = zufallsGenerator(20251111);
  const liste = [];
  for (let i = 0; i < 110; i++) {
    let t;
    let p;
    if (i % 5 < 2) {
      // ein Teil der Messungen liegt im üblichen Arbeitsbereich der Maschine
      t = 207 + rnd() * 32;
      p = 900 + rnd() * 480;
    } else {
      // der Rest ist über den ganzen Bereich verteilt (Anfahren, Störungen, ...)
      t = 182 + rnd() * 76;
      p = 610 + rnd() * 780;
    }
    t = Math.round(t);
    p = Math.round(p / 5) * 5;

    let ergebnis = pruefeBauteil(t, p);

    // Messunsicherheit: knapp an der Grenze wird manchmal anders entschieden
    const knapp =
      Math.abs(t - PROZESSFENSTER.tMin) <= 2 ||
      Math.abs(t - PROZESSFENSTER.tMax) <= 2 ||
      Math.abs(p - PROZESSFENSTER.pMin) <= 25;
    if (knapp && rnd() < 0.15) {
      ergebnis =
        ergebnis.label === 1
          ? { label: 0, fehler: "Grenzfall – bei der Prüfung aussortiert" }
          : { label: 1, fehler: "" };
    }

    liste.push({
      id: 4101 + i,
      t,
      p,
      x: normieren(t, MERKMALE[0]),
      y: normieren(p, MERKMALE[1]),
      label: ergebnis.label,
      fehler: ergebnis.fehler,
    });
  }
  return liste;
}

function mischen(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

// Beschreibung eines Bauteils für Tooltips und Erklärungen
function bauteilText(b) {
  const werte = `${b.t} °C · ${b.p} bar`;
  const kopf = b.id ? `Teil ${b.id}` : "Eigenes Teil";
  if (b.label === 1) {
    return `${kopf} · ${werte} · i.O.`;
  }
  return `${kopf} · ${werte} · n.i.O. – ${b.fehler}`;
}
