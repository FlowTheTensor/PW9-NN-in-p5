// =============================================================================
//  daten.js – Beispieldaten (Szenarien) und Normierung
// =============================================================================
//  Jedes Szenario liefert pro Messung genau zwei Werte (Merkmale) und das
//  Ergebnis der Prüfung:
//    Klasse 1 = i.O.   (in Ordnung)
//    Klasse 0 = n.i.O. (nicht in Ordnung)
//
//  Das neuronale Netz kennt die Regel dahinter NICHT – es soll sie aus den
//  Beispielen lernen. Alle Daten sind simuliert, die Regeln sind an die
//  Stationen einer Industrie-4.0-Modellanlage angelehnt.
//
//  Ein neues Szenario anlegen: einfach einen weiteren Eintrag in SZENARIEN
//  ergänzen – es erscheint dann automatisch in der Auswahlliste.
// =============================================================================

// Wortformen für die Erklärtexte (z. B. "Nächstes Teil" / "Nächste Messung")
function wortformen(einzahl, mehrzahl, weiblich) {
  const dativ = mehrzahl.endsWith("n") ? mehrzahl : mehrzahl + "n";
  const klein = mehrzahl.toLowerCase();
  return {
    sg: einzahl, // Teil
    pl: mehrzahl, // Teile
    ein: weiblich ? "eine " + einzahl : "ein " + einzahl,
    das: weiblich ? "die " + einzahl : "das " + einzahl,
    dies: weiblich ? "diese " + einzahl : "dieses " + einzahl,
    dasselbe: weiblich ? "dieselbe " + einzahl : "dasselbe " + einzahl,
    kein: weiblich ? "keine " + einzahl : "kein " + einzahl,
    naechst: weiblich ? "Nächste " + einzahl : "Nächstes " + einzahl,
    naechstKlein: weiblich ? "die nächste " + einzahl : "das nächste " + einzahl,
    eigen: weiblich ? "Eigene " + einzahl : "Eigenes " + einzahl,
    training: "Trainings" + klein, // Trainingsteile
    test: "Test" + klein, // Testteile
    testDativ: "Test" + dativ.toLowerCase(), // Testteilen
  };
}

const SZENARIEN = {
  // ---------------------------------------------------------------------------
  foerderband: {
    name: "Förderband-Antrieb · Zustandsüberwachung",
    untertitel: "Zustandsüberwachung · Neuronales Netz",
    wort: wortformen("Messung", "Messungen", true),
    soll: "Befund Instandhaltung (Soll)",
    merkmale: [
      { name: "Strom", achse: "Motorstrom in A", einheit: "A", min: 0, max: 1.6, raster: 0.01, stellen: 2, gitter: 0.4 },
      { name: "Schwingung", achse: "Schwingstärke am Motorlager in mm/s", einheit: "mm/s", min: 0, max: 10, raster: 0.1, stellen: 1, gitter: 2 },
    ],
    pruefe(i, v) {
      if (i < 0.2) {
        return { label: 0, fehler: "Strom zu klein – Kontakt, Leitung oder Sicherung prüfen" };
      }
      if (i > 1.05) {
        return { label: 0, fehler: "Überlast – Band schwergängig oder blockiert" };
      }
      if (v > 4.5) {
        return { label: 0, fehler: "Schwingung zu hoch – Lagerschaden (Wartung nötig)" };
      }
      return { label: 1, fehler: "" };
    },
    knapp: (i, v) => Math.abs(i - 0.2) <= 0.03 || Math.abs(i - 1.05) <= 0.04 || Math.abs(v - 4.5) <= 0.3,
    grenzfall: "Grenzfall – vom Instandhalter als auffällig eingestuft",
    arbeitsbereich: [[0.25, 1.0], [0.5, 4.0]],
    streubereich: [[0.03, 1.57], [0.2, 9.8]],
    startwert: 20260311,
    ersteId: 1201,
    form: "der Gut-Bereich hat aber drei Seiten",
    gelernt: "welchen Gut-Bereich das Netz gelernt hat",
  },

  // ---------------------------------------------------------------------------
  spritzguss: {
    name: "Spritzgießmaschine · Qualitätsprüfung",
    untertitel: "Spritzguss · Neuronales Netz",
    wort: wortformen("Teil", "Teile", false),
    soll: "Qualitätsprüfung (Soll)",
    merkmale: [
      { name: "Temperatur", achse: "Werkzeugtemperatur in °C", einheit: "°C", min: 180, max: 260, raster: 1, stellen: 0, gitter: 20 },
      { name: "Druck", achse: "Einspritzdruck in bar", einheit: "bar", min: 600, max: 1400, raster: 5, stellen: 0, gitter: 200 },
    ],
    // Das "Prozessfenster": nur hier entstehen Gutteile.
    pruefe(t, p) {
      if (t < 205) {
        return { label: 0, fehler: "unvollständig gefüllt (zu kalt)" };
      }
      if (t > 242) {
        return { label: 0, fehler: "Schlieren / Verbrennung (zu heiß)" };
      }
      if (p < 880) {
        return { label: 0, fehler: "Einfallstellen (zu wenig Druck)" };
      }
      return { label: 1, fehler: "" };
    },
    knapp: (t, p) => Math.abs(t - 205) <= 2 || Math.abs(t - 242) <= 2 || Math.abs(p - 880) <= 25,
    grenzfall: "Grenzfall – bei der Prüfung aussortiert",
    arbeitsbereich: [[207, 239], [900, 1380]], // üblicher Arbeitsbereich der Maschine
    streubereich: [[182, 258], [610, 1390]], // Anfahren, Störungen, ...
    startwert: 20251111,
    ersteId: 4101,
    form: "das Prozessfenster hat aber drei Seiten",
    gelernt: "welches Prozessfenster das Netz gelernt hat",
  },

  // ---------------------------------------------------------------------------
  pneumatik: {
    name: "Pneumatikzylinder · Fehlerdiagnose",
    untertitel: "Pneumatik · Neuronales Netz",
    wort: wortformen("Messung", "Messungen", true),
    soll: "Diagnose (Soll)",
    merkmale: [
      { name: "Ausfahrzeit", achse: "Ausfahrzeit in ms", einheit: "ms", min: 150, max: 650, raster: 1, stellen: 0, gitter: 100 },
      { name: "Luft", achse: "Luftverbrauch je Hub in Nl (Normliter)", einheit: "Nl", min: 0.05, max: 0.55, raster: 0.01, stellen: 2, gitter: 0.1 },
    ],
    pruefe(t, v) {
      if (t < 240) {
        return { label: 0, fehler: "zu schnell – Drossel zu weit offen, harter Anschlag" };
      }
      if (t > 420) {
        return { label: 0, fehler: "zu langsam – Druck zu niedrig oder Führung schwergängig" };
      }
      if (v > 0.34) {
        return { label: 0, fehler: "Luftverbrauch zu hoch – Leckage an Schlauch oder Dichtung" };
      }
      if (v < 0.16) {
        return { label: 0, fehler: "zu wenig Luft – Hub nicht vollständig, Endlage nicht erreicht" };
      }
      return { label: 1, fehler: "" };
    },
    knapp: (t, v) => Math.abs(t - 240) <= 8 || Math.abs(t - 420) <= 8 || Math.abs(v - 0.34) <= 0.01 || Math.abs(v - 0.16) <= 0.01,
    grenzfall: "Grenzfall – bei der Diagnose anders eingestuft",
    arbeitsbereich: [[250, 410], [0.18, 0.32]],
    streubereich: [[160, 640], [0.06, 0.54]],
    startwert: 20260412,
    ersteId: 3301,
    form: "der Gut-Bereich hat aber vier Seiten",
    gelernt: "welchen Gut-Bereich das Netz gelernt hat",
  },

  // ---------------------------------------------------------------------------
  reflow: {
    name: "Reflow-Lötofen · Lötstellenprüfung",
    untertitel: "Reflow-Löten · Neuronales Netz",
    wort: wortformen("Platine", "Platinen", true),
    soll: "Lötstellenprüfung (Soll)",
    merkmale: [
      { name: "Spitzentemp.", achse: "Spitzentemperatur in °C", einheit: "°C", min: 220, max: 270, raster: 1, stellen: 0, gitter: 10 },
      { name: "Lötzeit", achse: "Zeit über Liquidus (217 °C) in s", einheit: "s", min: 20, max: 120, raster: 1, stellen: 0, gitter: 20 },
    ],
    // bleifreies Lot SAC305 schmilzt bei 217 °C
    pruefe(t, z) {
      if (t < 235) {
        return { label: 0, fehler: "kalte Lötstelle – Lot nicht vollständig aufgeschmolzen" };
      }
      if (z < 40) {
        return { label: 0, fehler: "schlechte Benetzung – Zeit über Liquidus zu kurz" };
      }
      if (z > 100) {
        return { label: 0, fehler: "spröde Lötstelle – Zeit über Liquidus zu lang" };
      }
      if ((t - 217) * z > 2100) {
        return { label: 0, fehler: "zu viel Wärme – Bauteile oder Leiterplatte geschädigt" };
      }
      return { label: 1, fehler: "" };
    },
    knapp: (t, z) =>
      Math.abs(t - 235) <= 1 || Math.abs(z - 40) <= 3 || Math.abs(z - 100) <= 3 || Math.abs((t - 217) * z - 2100) <= 120,
    grenzfall: "Grenzfall – bei der Sichtprüfung (AOI) aussortiert",
    arbeitsbereich: [[236, 250], [45, 75]],
    streubereich: [[221, 269], [22, 118]],
    startwert: 20260515,
    ersteId: 5001,
    form: "die Grenze des Gut-Bereichs ist aber gebogen und hat mehrere Seiten",
    gelernt: "welchen Gut-Bereich das Netz gelernt hat",
  },

  // ---------------------------------------------------------------------------
  greifer: {
    name: "Handhabung · Ablagegenauigkeit Greifer",
    untertitel: "Greifer-Positionierung · Neuronales Netz",
    wort: wortformen("Ablage", "Ablagen", true),
    soll: "Positionsprüfung (Soll)",
    merkmale: [
      { name: "Δx", achse: "Ablageabweichung Δx in mm", einheit: "mm", min: -1.5, max: 1.5, raster: 0.01, stellen: 2, gitter: 0.5 },
      { name: "Δy", achse: "Ablageabweichung Δy in mm", einheit: "mm", min: -1.5, max: 1.5, raster: 0.01, stellen: 2, gitter: 0.5 },
    ],
    // Positionstoleranz: das Werkstück darf höchstens 0,8 mm von der Sollposition abweichen
    pruefe(dx, dy) {
      const r = Math.sqrt(dx * dx + dy * dy);
      if (r > 0.8) {
        return { label: 0, fehler: `außerhalb der Positionstoleranz (Abstand ${r.toFixed(2)} mm > 0.80 mm)` };
      }
      return { label: 1, fehler: "" };
    },
    knapp: (dx, dy) => Math.abs(Math.sqrt(dx * dx + dy * dy) - 0.8) <= 0.05,
    grenzfall: "Grenzfall – Werkstücksitz in der Kamera beanstandet",
    arbeitsbereich: [[-0.7, 0.7], [-0.7, 0.7]],
    streubereich: [[-1.45, 1.45], [-1.45, 1.45]],
    startwert: 20260620,
    ersteId: 7001,
    form: "der Toleranzbereich ist aber ein Kreis",
    gelernt: "welchen Toleranzbereich das Netz gelernt hat",
  },
};

// aktuell gewähltes Szenario
let szenarioName = "foerderband";
let SZ = SZENARIEN[szenarioName];

function waehleSzenario(name) {
  if (SZENARIEN[name]) {
    szenarioName = name;
    SZ = SZENARIEN[name];
  }
}

// Das Netz rechnet mit normierten Werten zwischen −1 und +1
function normieren(wert, merkmal) {
  return ((wert - merkmal.min) / (merkmal.max - merkmal.min)) * 2 - 1;
}

function entnormieren(n, merkmal) {
  return merkmal.min + ((n + 1) / 2) * (merkmal.max - merkmal.min);
}

// auf das Messraster runden (z. B. Druck auf 5 bar, Strom auf 0.01 A)
function runde(wert, merkmal) {
  return Number((Math.round(wert / merkmal.raster) * merkmal.raster).toFixed(merkmal.stellen));
}

// Messwert mit Einheit als Text
function wertText(wert, merkmal) {
  return wert.toFixed(merkmal.stellen) + " " + merkmal.einheit;
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

// eine Messung (Datenpunkt) aus zwei Rohwerten bauen
function erzeugeTeil(id, w0, w1, ergebnis) {
  const [m0, m1] = SZ.merkmale;
  return {
    id,
    roh: [w0, w1],
    x: normieren(w0, m0),
    y: normieren(w1, m1),
    label: ergebnis.label,
    fehler: ergebnis.fehler,
  };
}

function erzeugeDatensatz() {
  const rnd = zufallsGenerator(SZ.startwert);
  const [m0, m1] = SZ.merkmale;
  const liste = [];
  for (let i = 0; i < 110; i++) {
    // ein Teil der Messungen liegt im üblichen Arbeitsbereich,
    // der Rest ist über den ganzen Bereich verteilt (Anfahren, Störungen, ...)
    const [b0, b1] = i % 5 < 2 ? SZ.arbeitsbereich : SZ.streubereich;
    const w0 = runde(b0[0] + rnd() * (b0[1] - b0[0]), m0);
    const w1 = runde(b1[0] + rnd() * (b1[1] - b1[0]), m1);

    let ergebnis = SZ.pruefe(w0, w1);

    // Messunsicherheit: knapp an der Grenze wird manchmal anders entschieden
    if (SZ.knapp(w0, w1) && rnd() < 0.15) {
      ergebnis = ergebnis.label === 1 ? { label: 0, fehler: SZ.grenzfall } : { label: 1, fehler: "" };
    }

    liste.push(erzeugeTeil(SZ.ersteId + i, w0, w1, ergebnis));
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

// Beschreibung einer Messung für Tooltips und Erklärungen
function bauteilText(b) {
  const werte = `${wertText(b.roh[0], SZ.merkmale[0])} · ${wertText(b.roh[1], SZ.merkmale[1])}`;
  const kopf = b.id ? `${SZ.wort.sg} ${b.id}` : SZ.wort.eigen;
  if (b.label === 1) {
    return `${kopf} · ${werte} · i.O.`;
  }
  return `${kopf} · ${werte} · n.i.O. – ${b.fehler}`;
}
