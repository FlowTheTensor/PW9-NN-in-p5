// =============================================================================
//  KI-Qualitätsprüfung
//  Ein kleines neuronales Netz lernt, i.O. von n.i.O. zu unterscheiden – nur
//  anhand von zwei Messwerten. Mehrere Beispiele (Spritzguss, Förderband,
//  Pneumatik, Reflow-Löten, Greifer) sind über die Auswahlliste wählbar.
// =============================================================================
//
//  Dateien
//    daten.js   Beispieldaten (Szenarien) und Normierung
//    netz.js    das neuronale Netz (Vorwärtsrechnung, Fehlerrückführung)
//    ui.js      Knöpfe, Auswahllisten, Regler
//    sketch.js  Ablauf, Zeichnen, Erklärungen (diese Datei)
//
//  Bedienung
//    →  nächster Schritt der Vorwärtsrechnung
//    ←  Fehlerrückführung Phase für Phase (nur im Trainingsmodus)
//    Klick in das Diagramm: eigene Messung mit diesen Werten prüfen
//
//  Läuft mit p5.js 1.x und 2.x.
//  Hinweis: Alle Schleifen haben geschweifte Klammern – der p5-Web-Editor
//  kommt mit Schleifen ohne Klammern nicht zurecht.
// =============================================================================

// -----------------------------------------------------------------------------
// Layout (logisches Raster 1600 × 900, wird auf die Fenstergröße skaliert)
// -----------------------------------------------------------------------------
const W = 1600;
const H = 900;
let S = 1;

// Schriften der Jakob-Preh-Schule (Google Fonts, siehe index.html).
// Ohne Internet wird automatisch auf Systemschriften ausgewichen.
const SCHRIFTEN = {
  titel: ["Quicksand", "Arial"],
  text: ["Inter", "Arial"],
  mono: ["JetBrains Mono", "monospace"],
};
const schriftGeladen = { titel: false, text: false, mono: false };
let TITEL = "Arial";
let SCHRIFT = "Arial";
let MONO = "monospace";

function ladeSchriften() {
  if (!document.fonts || !document.fonts.load) {
    return;
  }
  for (const art of Object.keys(SCHRIFTEN)) {
    const name = SCHRIFTEN[art][0];
    Promise.all([
      document.fonts.load(`400 16px "${name}"`),
      document.fonts.load(`700 16px "${name}"`),
    ])
      .then((ergebnis) => {
        if (ergebnis[0].length > 0 && ergebnis[1].length > 0) {
          schriftGeladen[art] = true;
          TITEL = schriftGeladen.titel ? SCHRIFTEN.titel[0] : SCHRIFTEN.titel[1];
          SCHRIFT = schriftGeladen.text ? SCHRIFTEN.text[0] : SCHRIFTEN.text[1];
          MONO = schriftGeladen.mono ? SCHRIFTEN.mono[0] : SCHRIFTEN.mono[1];
        }
      })
      .catch(() => {});
  }
}

const P_DATEN = { x: 24, y: 84, w: 560, h: 576, titel: "" }; // Titel = Szenario-Auswahl (ui.js)
const P_KURVE = { x: 24, y: 676, w: 560, h: 208, titel: "Lernkurve · Fehlerquote je Epoche" };
const P_NETZ = { x: 600, y: 84, w: 976, h: 576, titel: "Neuronales Netz" };
const P_ERKL = { x: 600, y: 676, w: 600, h: 208, titel: "" };
const P_EINST = { x: 1216, y: 676, w: 360, h: 208, titel: "Einstellungen" };
const KOPF_H = 34; // Höhe der Panel-Überschrift

const PLOT = { x: 104, y: 132, s: 436 };

const IN_X = 720;
const VER_X = 1000;
const AUS_X = 1250;
const NETZ_MY = 390;
const IN_Y = [300, 480];
const AUS_Y = 390;
const R = 36; // Radius der Ein- und Ausgabeneuronen
const KURZ = ["T", "p"]; // Kurzzeichen der Eingaben

const KARTE_RES = 180;

// Farben nach dem Corporate Design der Jakob-Preh-Schule (bsnes.de):
// Papierweiß, Logo-Schwarz, Schul-Rot als Akzent, Senf als zweiter Akzent.
const FARBE = {
  papier: [251, 249, 245], // Hintergrund
  flaeche: [255, 255, 255], // Karten / Panels
  flaeche2: [243, 238, 230], // abgesetzte Flächen
  linie: [231, 225, 214],
  text: [29, 29, 28], // Logo-Schwarz
  grau: [91, 88, 82], // weicher Text
  blass: [125, 122, 114], // Meta-Text
  akzent: [200, 30, 58], // Schul-Rot (texttauglich)
  akzentHell: [228, 0, 43], // Logo-Rot (nur dekorativ / große Elemente)
  senf: [184, 122, 28],
  io: [52, 128, 84], // i.O. (Gutteil)
  nio: [200, 30, 58], // n.i.O. (Ausschuss)
  plus: [44, 92, 150], // positives Gewicht
  minus: [184, 122, 28], // negatives Gewicht (Senf)
  dPlus: [36, 76, 126], // Gewicht wird größer
  dMinus: [150, 96, 18], // Gewicht wird kleiner
  vor: [29, 29, 28], // Vorwärtsrechnung
  fehler: [228, 0, 43], // Fehlersignal läuft zurück
  neuron: [29, 29, 28],
};

// Dauer der einzelnen Phasen der Fehlerrückführung in ms
const RF_DAUER = { ausgang: 2600, wAus: 3200, versteckt: 2600, wEin: 3200, bias: 2400, neu: 2400 };

// -----------------------------------------------------------------------------
// Zustand
// -----------------------------------------------------------------------------
let netz;
let datensatz = [];
let trainingsdaten = [];
let testdaten = [];

let modus = "erkunden"; // "erkunden" oder "training"
let phase = "bereit"; // bereit | eingabe | versteckt | ausgabe | rueck | fertig
let teil = null; // aktuelles Bauteil
let vw = null; // Ergebnis der letzten Vorwärtsrechnung
let anim = null; // Vorwärts-Animation {art, t0, dauer}
let rf = null; // laufende Fehlerrückführung
let markierungen = []; // bereits bearbeitete Teile (mit Ergebnis)
let manIdx = 0;
let hinweis = null;

let lernrate = 0.5;
let epochenZiel = 30;
let tempo = "mittel";

let laufTraining = false;
let trainIdx = 0;
let laufEpoche = 0;
let gesamtEpochen = 0;
let kurve = []; // {e, train, test}
let glimmenEin = [];
let glimmenAus = [];

let laufTest = false;
let testIdx = 0;
let testFalsch = 0;
let letzteTestquote = null;

let karteAn = false;
let karteVeraltet = true;
let karteBild;
const karteWerte = new Float32Array(KARTE_RES * KARTE_RES);

let plotsGross = false;
let fehlerMeldung = null;
let cnv;

// =============================================================================
// Start
// =============================================================================
function setup() {
  ladeSchriften();
  const [cw, ch] = zeichenflaeche();
  cnv = createCanvas(cw, ch);
  S = width / W;

  karteBild = createImage(KARTE_RES, KARTE_RES);
  karteBild.loadPixels();

  netz = new NeuronalesNetz(4);
  // Beispiel direkt über die Adresse wählbar, z. B. index.html?szenario=greifer
  waehleSzenario(new URLSearchParams(window.location.search).get("szenario"));
  datensatz = erzeugeDatensatz();
  datenAufteilen();

  erstelleUi();
  cnv.parent(huelle);
  netzZurueckgesetzt(true);
  layoutUi();
}

function zeichenflaeche() {
  const cw = Math.max(800, Math.min(1600, windowWidth - 24, ((windowHeight - 24) * W) / H));
  return [Math.round(cw), Math.round((cw * H) / W)];
}

function windowResized() {
  const [cw, ch] = zeichenflaeche();
  resizeCanvas(cw, ch);
  S = width / W;
  layoutUi();
}

// =============================================================================
// Hauptschleife – Fehler werden abgefangen, damit nie alles einfriert
// =============================================================================
function draw() {
  try {
    logik();
    background(...FARBE.papier);
    push();
    scale(S);
    zeichneKopf();
    zeichneDatenPanel();
    zeichneKurvenPanel();
    zeichneNetzPanel();
    zeichneErklaerung();
    zeichneEinstellungen();
    zeichneTooltip();
    zeichneFehlerMeldung();
    pop();
    aktualisiereUi();
  } catch (err) {
    behandleFehler(err);
  }
}

function behandleFehler(err) {
  console.error(err);
  fehlerMeldung = { text: String((err && err.message) || err), t0: millis() };
  // in einen sicheren Zustand zurück
  laufTraining = false;
  laufTest = false;
  anim = null;
  rf = null;
  phase = "bereit";
}

// =============================================================================
// Ablauf: Netz zurücksetzen, Daten, Modus
// =============================================================================
function netzZurueckgesetzt(kurveLoeschen) {
  glimmenEin = [];
  glimmenAus = [];
  for (let i = 0; i < netz.n; i++) {
    glimmenEin.push([0, 0]);
    glimmenAus.push(0);
  }
  if (kurveLoeschen !== false) {
    kurve = [];
    gesamtEpochen = 0;
  }
  letzteTestquote = null;
  markierungen = [];
  rf = null;
  anim = null;
  vw = null;
  teil = null;
  phase = "bereit";
  karteVeraltet = true;
  if (ui.anzahl) {
    uiAusNetz();
  }
}

// Bias oder Aktivierung wurde umgeschaltet
function netzEinstellungGeaendert() {
  if (rf) {
    rfBeenden();
  }
  if (teil && vw) {
    vw = netz.vorwaerts(teil.x, teil.y);
  }
  karteVeraltet = true;
}

function datenAufteilen() {
  mischen(datensatz);
  trainingsdaten = datensatz.slice(0, 75);
  testdaten = datensatz.slice(75);
  manIdx = 0;
  kurve = [];
  gesamtEpochen = 0;
}

// anderes Beispiel gewählt: neue Daten, die Gewichte des Netzes bleiben
function szenarioWechseln(name) {
  if (laufTraining || laufTest || !SZENARIEN[name]) {
    return;
  }
  waehleSzenario(name);
  datensatz = erzeugeDatensatz();
  datenAufteilen();
  netzZurueckgesetzt(true);
  if (ui.szenario) {
    ui.szenario.selected(szenarioName);
  }
}

function setzeModus(m) {
  if (laufTraining || laufTest) {
    return;
  }
  modus = m;
  markierungen = [];
  rf = null;
  anim = null;
  vw = null;
  teil = null;
  phase = "bereit";
  manIdx = 0;
}

function lernrateZuruecksetzen() {
  lernrate = 0.5;
  ui.lr.value(lernrate);
}

function zufallsWerte() {
  lernrateZuruecksetzen();
  netz.zufallsStart();
  netzZurueckgesetzt(true);
}

function tutorialNetz() {
  lernrateZuruecksetzen();
  netz.tutorialStart();
  netzZurueckgesetzt(true);
}

function aktionsKnopf() {
  if (modus === "training") {
    if (laufTraining) {
      trainingStoppen();
    } else {
      trainingStarten();
    }
  } else if (laufTest) {
    laufTest = false;
  } else {
    testStarten();
  }
}

// =============================================================================
// Schritt für Schritt
// =============================================================================
function naechstesTeil() {
  const liste = modus === "training" ? trainingsdaten : testdaten;
  if (manIdx >= liste.length) {
    manIdx = 0;
    mischen(liste);
  }
  return liste[manIdx++];
}

function teilEingeben(b) {
  teil = b;
  vw = netz.vorwaerts(b.x, b.y);
  markierungen.push({ b, falsch: null });
  rf = null;
  phase = "eingabe";
  anim = { art: "ein", t0: millis(), dauer: 600 };
}

function schrittVor() {
  if (laufTraining || laufTest) {
    return;
  }
  if (phase === "rueck") {
    rfBeenden();
    return;
  }
  if (phase === "bereit" || phase === "ausgabe" || phase === "fertig") {
    teilEingeben(naechstesTeil());
  } else if (phase === "eingabe") {
    phase = "versteckt";
    anim = { art: "vor1", t0: millis(), dauer: 900 };
  } else if (phase === "versteckt") {
    phase = "ausgabe";
    anim = { art: "vor2", t0: millis(), dauer: 900 };
    const m = markierungen[markierungen.length - 1];
    if (m) {
      m.falsch = (vw.y >= 0.5 ? 1 : 0) !== teil.label;
    }
  }
}

function schrittZurueck() {
  if (laufTraining || laufTest) {
    return;
  }
  if (modus !== "training") {
    zeigeHinweis("Die Fehlerrückführung gibt es nur im Trainingsmodus.");
    return;
  }
  if (phase === "rueck") {
    rfWeiter();
  } else if (phase === "ausgabe" || phase === "fertig") {
    rfStarten();
  } else {
    zeigeHinweis("Rechne zuerst mit → bis zur Ausgabe vorwärts.");
  }
}

function zeigeHinweis(text) {
  hinweis = { text, t0: millis() };
}

// -----------------------------------------------------------------------------
// Fehlerrückführung mit Animation
// -----------------------------------------------------------------------------
function rfStarten() {
  const vorher = netz.vorwaerts(teil.x, teil.y);
  const gewVorher = netz.schnappschuss();
  const r = netz.rueckfuehrung(vorher, teil.label, lernrate);
  netz.anwenden(r);
  const nachher = netz.vorwaerts(teil.x, teil.y);

  const schritte = ["ausgang", "wAus", "versteckt", "wEin"];
  if (netz.biasAn) {
    schritte.push("bias");
  }
  schritte.push("neu");

  rf = { r, vorher, nachher, gewVorher, schritte, idx: 0, t0: millis(), fertig: false };
  vw = nachher;
  phase = "rueck";
  anim = null;
}

function rfWeiter() {
  if (!rf) {
    return;
  }
  rf.idx++;
  rf.t0 = millis();
  if (rf.schritte[rf.idx] === "neu") {
    karteVeraltet = true;
  }
  if (rf.idx >= rf.schritte.length) {
    rfBeenden();
  }
}

function rfBeenden() {
  if (!rf) {
    return;
  }
  rf.idx = rf.schritte.length;
  rf.fertig = true;
  phase = "fertig";
  karteVeraltet = true;
}

// Zustand einer Phase: −1 = noch nicht erreicht, 0…1 = läuft gerade, 2 = vorbei
function rfZustand(name) {
  if (!rf) {
    return 2;
  }
  const k = rf.schritte.indexOf(name);
  if (k < 0) {
    return -1;
  }
  if (rf.fertig || rf.idx > k) {
    return 2;
  }
  if (rf.idx < k) {
    return -1;
  }
  return constrain((millis() - rf.t0) / RF_DAUER[name], 0, 1);
}

function rfAnteil(name) {
  const z = rfZustand(name);
  return z < 0 ? 0 : Math.min(1, z);
}

function weich(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

// Angezeigte Werte – während der Rückführung wird von alt nach neu übergeblendet
function zeigeWEin(i, j) {
  if (!rf) {
    return netz.wEin[i][j];
  }
  const alt = rf.gewVorher.wEin[i][j];
  return lerp(alt, alt + rf.r.dEin[i][j], weich(rfAnteil("wEin")));
}

function zeigeWAus(i) {
  if (!rf) {
    return netz.wAus[i];
  }
  const alt = rf.gewVorher.wAus[i];
  return lerp(alt, alt + rf.r.dAus[i], weich(rfAnteil("wAus")));
}

function zeigeBVer(i) {
  if (!rf) {
    return netz.bVer[i];
  }
  const alt = rf.gewVorher.bVer[i];
  return lerp(alt, alt + rf.r.dBVer[i], weich(rfAnteil("bias")));
}

function zeigeBAus() {
  if (!rf) {
    return netz.bAus;
  }
  const alt = rf.gewVorher.bAus;
  return lerp(alt, alt + rf.r.dBAus, weich(rfAnteil("bias")));
}

// Werte der Neuronen (vorher → nachher während der Phase "neu")
function zeigeWert(feld, i) {
  if (!vw) {
    return 0;
  }
  if (!rf) {
    return i === undefined ? vw[feld] : vw[feld][i];
  }
  const a = weich(rfAnteil("neu"));
  const v0 = i === undefined ? rf.vorher[feld] : rf.vorher[feld][i];
  const v1 = i === undefined ? rf.nachher[feld] : rf.nachher[feld][i];
  return lerp(v0, v1, a);
}

function animLaeuft(art) {
  return anim !== null && anim.art === art && millis() - anim.t0 < anim.dauer;
}

function eingabeBekannt() {
  return vw !== null && (laufTraining || laufTest || phase !== "bereit");
}

function versteckteBekannt() {
  if (vw === null) {
    return false;
  }
  if (laufTraining || laufTest) {
    return true;
  }
  if (phase === "versteckt") {
    return !animLaeuft("vor1");
  }
  return phase === "ausgabe" || phase === "rueck" || phase === "fertig";
}

function ausgabeBekannt() {
  if (vw === null) {
    return false;
  }
  if (laufTraining || laufTest) {
    return true;
  }
  if (phase === "ausgabe") {
    return !animLaeuft("vor2");
  }
  return phase === "rueck" || phase === "fertig";
}

// =============================================================================
// Automatisches Training und Test
// =============================================================================
function trainingStarten() {
  if (kurve.length === 0) {
    kurve.push({ e: 0, train: netz.fehlerquote(trainingsdaten), test: netz.fehlerquote(testdaten) });
  }
  rf = null;
  anim = null;
  phase = "bereit";
  markierungen = [];
  laufEpoche = 0;
  trainIdx = 0;
  mischen(trainingsdaten);
  laufTraining = true;
}

function trainingStoppen() {
  laufTraining = false;
  markierungen = [];
  phase = "bereit";
  vw = null;
  teil = null;
  karteVeraltet = true;
}

function trainiereEinTeil() {
  const b = trainingsdaten[trainIdx];
  teil = b;
  const r = netz.lerneBeispiel(b.x, b.y, b.label, lernrate);
  vw = netz.vorwaerts(b.x, b.y);

  // Glimmen der Verbindungen: Vorzeichen = Richtung der Änderung
  for (let i = 0; i < netz.n; i++) {
    glimmenAus[i] = constrain(glimmenAus[i] + r.dAus[i] / 0.03, -1, 1);
    for (let j = 0; j < 2; j++) {
      glimmenEin[i][j] = constrain(glimmenEin[i][j] + r.dEin[i][j] / 0.03, -1, 1);
    }
  }
  if (ui.abnehmend.checked()) {
    lernrate = Math.max(0.05, lernrate * 0.9995);
  }
  markierungen.push({ b, falsch: null });
  karteVeraltet = true;

  trainIdx++;
  if (trainIdx >= trainingsdaten.length) {
    trainIdx = 0;
    mischen(trainingsdaten);
    laufEpoche++;
    gesamtEpochen++;
    kurve.push({ e: gesamtEpochen, train: netz.fehlerquote(trainingsdaten), test: netz.fehlerquote(testdaten) });
    markierungen = [];
    if (laufEpoche >= epochenZiel) {
      trainingStoppen();
    }
  }
}

function testStarten() {
  laufTest = true;
  testIdx = 0;
  testFalsch = 0;
  markierungen = [];
  rf = null;
  anim = null;
  phase = "bereit";
}

function testeEinTeil() {
  const b = testdaten[testIdx];
  teil = b;
  vw = netz.vorwaerts(b.x, b.y);
  const falsch = (vw.y >= 0.5 ? 1 : 0) !== b.label;
  if (falsch) {
    testFalsch++;
  }
  markierungen.push({ b, falsch });
  testIdx++;
  if (testIdx >= testdaten.length) {
    letzteTestquote = testFalsch / testdaten.length;
    laufTest = false;
    phase = "bereit";
  }
}

function logik() {
  for (let i = 0; i < glimmenAus.length; i++) {
    glimmenAus[i] *= 0.9;
    glimmenEin[i][0] *= 0.9;
    glimmenEin[i][1] *= 0.9;
  }

  if (laufTraining) {
    let anzahl = 3;
    if (tempo === "langsam") {
      anzahl = frameCount % 4 === 0 ? 1 : 0;
    } else if (tempo === "schnell") {
      anzahl = trainingsdaten.length;
    }
    for (let k = 0; k < anzahl; k++) {
      if (!laufTraining) {
        break;
      }
      trainiereEinTeil();
    }
  }

  if (laufTest && frameCount % 3 === 0) {
    testeEinTeil();
  }

  if (rf && !rf.fertig && !ui.phasen.checked()) {
    if (millis() - rf.t0 > RF_DAUER[rf.schritte[rf.idx]]) {
      rfWeiter();
    }
  }

  if (anim && millis() - anim.t0 > anim.dauer) {
    anim = null;
  }

  if (karteAn && karteVeraltet) {
    berechneKarte();
    karteVeraltet = false;
  }
}

// =============================================================================
// Zeichnen – Grundlagen
// =============================================================================
function mausX() {
  return mouseX / S;
}

function mausY() {
  return mouseY / S;
}

// Karte im Stil der Schule: weiße Fläche, feine Linie, Titel mit rotem Punkt
// (der Punkt nimmt die Satzzeichen aus dem Logo "jakob·preh·schule!" auf)
function panel(p) {
  noStroke();
  fill(29, 29, 28, 10);
  rect(p.x + 1, p.y + 3, p.w, p.h, 12);
  fill(...FARBE.flaeche);
  stroke(...FARBE.linie);
  strokeWeight(1);
  rect(p.x, p.y, p.w, p.h, 12);
  stroke(...FARBE.linie);
  line(p.x + 12, p.y + KOPF_H, p.x + p.w - 12, p.y + KOPF_H);
  if (p.titel) {
    noStroke();
    fill(...FARBE.akzentHell);
    circle(p.x + 19, p.y + KOPF_H / 2 + 1, 7);
    fill(...FARBE.text);
    textFont(TITEL);
    textStyle(BOLD);
    textSize(16);
    textAlign(LEFT, CENTER);
    text(p.titel, p.x + 30, p.y + KOPF_H / 2 + 1);
    textStyle(NORMAL);
  }
}

// Farbskala für Wahrscheinlichkeit "i.O.": rot (0) – weiß (0.5) – grün (1)
function skalenFarbe(v, kraeftig) {
  const rot = kraeftig ? [200, 30, 58] : [241, 192, 198];
  const gruen = kraeftig ? [52, 128, 84] : [192, 223, 201];
  if (v < 0.5) {
    const a = v / 0.5;
    return [lerp(rot[0], 255, a), lerp(rot[1], 255, a), lerp(rot[2], 255, a)];
  }
  const a = (v - 0.5) / 0.5;
  return [lerp(255, gruen[0], a), lerp(255, gruen[1], a), lerp(255, gruen[2], a)];
}

function f2(v) {
  return v.toFixed(2);
}

function f3(v) {
  return v.toFixed(3);
}

function mitVorzeichen(v, stellen) {
  return (v >= 0 ? "+ " : "− ") + Math.abs(v).toFixed(stellen);
}

function klammer(v) {
  return v < 0 ? "(" + v.toFixed(2) + ")" : v.toFixed(2);
}

function umbrechen(txt, maxBreite) {
  const woerter = txt.split(" ");
  const zeilen = [];
  let akt = "";
  for (const wort of woerter) {
    const probe = akt ? akt + " " + wort : wort;
    if (textWidth(probe) > maxBreite && akt) {
      zeilen.push(akt);
      akt = wort;
    } else {
      akt = probe;
    }
  }
  if (akt) {
    zeilen.push(akt);
  }
  return zeilen;
}

// =============================================================================
// Kopfzeile
// =============================================================================
function zeichneKopf() {
  // Kopfzeile auf Papierweiß, das Logo liegt als Bild darüber (siehe ui.js)
  noStroke();
  fill(...FARBE.flaeche);
  rect(0, 0, W, 56);
  stroke(...FARBE.linie);
  strokeWeight(1);
  line(0, 56, W, 56);

  // Trenner zwischen Logo und Titel: Punkt und Strich wie im Logo
  noStroke();
  fill(...FARBE.akzentHell);
  circle(160, 28, 6);
  stroke(...FARBE.akzentHell);
  strokeWeight(3);
  line(170, 34, 180, 22);

  noStroke();
  fill(...FARBE.text);
  textFont(TITEL);
  textStyle(BOLD);
  textSize(21);
  textAlign(LEFT, CENTER);
  text("KI-Qualitätsprüfung", 194, 21);
  textStyle(NORMAL);
  textFont(SCHRIFT);
  textSize(13);
  fill(...FARBE.blass);
  text(SZ.untertitel, 194, 41);

  // Statuszeile
  fill(...FARBE.grau);
  textSize(13);
  textAlign(LEFT, CENTER);
  text(statusText(), 26, 70);
}

function statusText() {
  if (laufTest) {
    return `Test läuft: ${testIdx} von ${testdaten.length} ${SZ.wort.testDativ} geprüft · ${testFalsch} falsch erkannt`;
  }
  if (modus === "training") {
    let s = `Trainingsmodus · ${trainingsdaten.length} ${SZ.wort.training} · Lernrate η = ${lernrate.toFixed(2)}`;
    if (laufTraining) {
      s += ` · Epoche ${laufEpoche + 1} von ${epochenZiel} · ${SZ.wort.sg} ${trainIdx + 1} von ${trainingsdaten.length}`;
    } else if (gesamtEpochen > 0) {
      s += ` · bisher ${gesamtEpochen} Epochen trainiert`;
    }
    return s;
  }
  const quote = letzteTestquote === null ? "–" : (letzteTestquote * 100).toFixed(1) + " %";
  return `Erkunden & Testen · ${testdaten.length} ${SZ.wort.test} · Fehlerquote im letzten Test: ${quote}`;
}

// =============================================================================
// Prozessdaten
// =============================================================================
function zuPlot(xn, yn) {
  return [PLOT.x + ((xn + 1) / 2) * PLOT.s, PLOT.y + ((1 - yn) / 2) * PLOT.s];
}

function imPlot(px, py) {
  return px >= PLOT.x && px <= PLOT.x + PLOT.s && py >= PLOT.y && py <= PLOT.y + PLOT.s;
}

function berechneKarte() {
  for (let r = 0; r < KARTE_RES; r++) {
    const yn = 1 - ((r + 0.5) / KARTE_RES) * 2;
    for (let c = 0; c < KARTE_RES; c++) {
      karteWerte[r * KARTE_RES + c] = netz.ausgabe(((c + 0.5) / KARTE_RES) * 2 - 1, yn);
    }
  }
  const px = karteBild.pixels;
  for (let r = 0; r < KARTE_RES; r++) {
    for (let c = 0; c < KARTE_RES; c++) {
      const k = r * KARTE_RES + c;
      const oben = karteWerte[k] >= 0.5;
      // Entscheidungsgrenze: hier wechselt die Ausgabe über 0.5
      const grenze =
        (c + 1 < KARTE_RES && karteWerte[k + 1] >= 0.5 !== oben) ||
        (r + 1 < KARTE_RES && karteWerte[k + KARTE_RES] >= 0.5 !== oben);
      const farbe = grenze ? [29, 29, 28] : skalenFarbe(karteWerte[k], false);
      px[k * 4] = farbe[0];
      px[k * 4 + 1] = farbe[1];
      px[k * 4 + 2] = farbe[2];
      px[k * 4 + 3] = 255;
    }
  }
  karteBild.updatePixels();
}

function zeichneDatenPanel() {
  panel(P_DATEN);

  // Legende in der Überschrift
  textFont(SCHRIFT);
  textSize(13);
  textAlign(LEFT, CENTER);
  zeichneTeilMarke(P_DATEN.x + P_DATEN.w - 150, P_DATEN.y + 17, 1, 8, 255);
  fill(...FARBE.text);
  noStroke();
  text("i.O.", P_DATEN.x + P_DATEN.w - 138, P_DATEN.y + 18);
  zeichneTeilMarke(P_DATEN.x + P_DATEN.w - 82, P_DATEN.y + 17, 0, 8, 255);
  fill(...FARBE.text);
  noStroke();
  text("n.i.O.", P_DATEN.x + P_DATEN.w - 70, P_DATEN.y + 18);

  // Diagrammfläche
  stroke(...FARBE.linie);
  strokeWeight(1);
  fill(...FARBE.papier);
  rect(PLOT.x, PLOT.y, PLOT.s, PLOT.s);
  if (karteAn) {
    image(karteBild, PLOT.x, PLOT.y, PLOT.s, PLOT.s);
  }

  // Gitter und Achsen
  textFont(SCHRIFT);
  textSize(12);
  const [m0, m1] = SZ.merkmale;
  for (const v of gitterWerte(m0)) {
    const [gx] = zuPlot(normieren(v, m0), 0);
    stroke(0, 0, 0, 25);
    line(gx, PLOT.y, gx, PLOT.y + PLOT.s);
    noStroke();
    fill(...FARBE.grau);
    textAlign(CENTER, TOP);
    text(gitterText(v, m0), gx, PLOT.y + PLOT.s + 6);
  }
  for (const v of gitterWerte(m1)) {
    const [, gy] = zuPlot(0, normieren(v, m1));
    stroke(0, 0, 0, 25);
    line(PLOT.x, gy, PLOT.x + PLOT.s, gy);
    noStroke();
    fill(...FARBE.grau);
    textAlign(RIGHT, CENTER);
    text(gitterText(v, m1), PLOT.x - 6, gy);
  }
  fill(...FARBE.text);
  textStyle(BOLD);
  textSize(13);
  textAlign(CENTER, TOP);
  text(m0.achse, PLOT.x + PLOT.s / 2, PLOT.y + PLOT.s + 24);
  push();
  translate(P_DATEN.x + 18, PLOT.y + PLOT.s / 2);
  rotate(-HALF_PI);
  textAlign(CENTER, TOP);
  text(m1.achse, 0, 0);
  pop();
  textStyle(NORMAL);

  // alle Teile des aktuellen Datensatzes (blass)
  const liste = modus === "training" ? trainingsdaten : testdaten;
  for (const b of liste) {
    const [px, py] = zuPlot(b.x, b.y);
    zeichneTeilMarke(px, py, b.label, 6, 110);
  }

  // bearbeitete Teile (kräftig)
  for (const m of markierungen) {
    const [px, py] = zuPlot(m.b.x, m.b.y);
    zeichneTeilMarke(px, py, m.b.label, 9, 255);
    if (m.falsch) {
      noFill();
      stroke(...FARBE.text);
      strokeWeight(2.5);
      circle(px, py, 26);
      line(px + 9, py - 9, px + 14, py - 14);
    }
  }

  // Mauszeiger im Diagramm
  if (imPlot(mausX(), mausY()) && !laufTraining && !laufTest) {
    cursor(CROSS);
  } else {
    cursor(ARROW);
  }
}

// Gitterlinien auf "runden" Werten innerhalb des Wertebereichs
function gitterWerte(m) {
  const werte = [];
  const start = Math.ceil(m.min / m.gitter - 1e-9) * m.gitter;
  for (let v = start; v <= m.max + 1e-9; v += m.gitter) {
    werte.push(Number(v.toFixed(6)));
  }
  return werte;
}

function gitterText(v, m) {
  const stellen = Number.isInteger(m.gitter) ? 0 : Math.min(m.stellen, 1);
  return v.toFixed(stellen).replace("-", "−");
}

function zeichneTeilMarke(x, y, label, r, alpha) {
  stroke(255, alpha);
  strokeWeight(1.5);
  if (label === 1) {
    fill(...FARBE.io, alpha);
    circle(x, y, r * 2);
  } else {
    fill(...FARBE.nio, alpha);
    quad(x, y - r * 1.2, x + r * 1.2, y, x, y + r * 1.2, x - r * 1.2, y);
  }
}

// =============================================================================
// Lernkurve
// =============================================================================
function zeichneKurvenPanel() {
  const p = P_KURVE;
  panel(p);
  textFont(SCHRIFT);

  if (kurve.length === 0) {
    noStroke();
    fill(...FARBE.grau);
    textSize(13);
    textAlign(CENTER, CENTER);
    text(
      "Noch kein Training.\nStarte im Trainingsmodus das automatische Training,\num zu sehen, wie die Fehlerquote sinkt.",
      p.x + p.w / 2,
      p.y + KOPF_H + (p.h - KOPF_H) / 2
    );
    return;
  }

  const gx = p.x + 60;
  const gy = p.y + KOPF_H + 18;
  const gw = p.w - 84;
  const gh = p.h - KOPF_H - 52;
  const letzte = kurve[kurve.length - 1];
  const maxE = Math.max(5, letzte.e + (laufTraining ? epochenZiel - laufEpoche : 0));
  let maxF = 0.2;
  for (const k of kurve) {
    maxF = Math.max(maxF, k.train, k.test);
  }
  const yMax = Math.ceil(maxF * 10) / 10;
  const sx = (e) => gx + (e / maxE) * gw;
  const sy = (v) => gy + gh - (v / yMax) * gh;

  stroke(...FARBE.linie);
  strokeWeight(1);
  line(gx, sy(yMax / 2), gx + gw, sy(yMax / 2));
  line(gx, sy(yMax), gx + gw, sy(yMax));
  stroke(...FARBE.blass);
  strokeWeight(1.5);
  line(gx, gy, gx, gy + gh);
  line(gx, gy + gh, gx + gw, gy + gh);

  noStroke();
  fill(...FARBE.grau);
  textSize(12);
  textAlign(RIGHT, CENTER);
  for (let k = 0; k <= 2; k++) {
    const v = (yMax * k) / 2;
    text(Math.round(v * 100) + " %", gx - 6, sy(v));
  }
  textAlign(CENTER, TOP);
  text("0", gx, gy + gh + 5);
  text(maxE, gx + gw, gy + gh + 5);
  text("Epoche", gx + gw / 2, gy + gh + 5);

  const reihen = [
    { feld: "train", farbe: FARBE.minus, name: "Training" },
    { feld: "test", farbe: FARBE.plus, name: "Test" },
  ];
  for (const reihe of reihen) {
    noFill();
    stroke(...reihe.farbe);
    strokeWeight(2.5);
    beginShape();
    for (const k of kurve) {
      vertex(sx(k.e), sy(k[reihe.feld]));
    }
    endShape();
    noStroke();
    fill(...reihe.farbe);
    for (const k of kurve) {
      circle(sx(k.e), sy(k[reihe.feld]), 6);
    }
  }

  // Legende in der Überschrift
  textAlign(LEFT, CENTER);
  textSize(12);
  let lx = p.x + p.w - 210;
  for (const reihe of reihen) {
    fill(...reihe.farbe);
    circle(lx, p.y + 17, 10);
    fill(...FARBE.text);
    text(`${reihe.name} ${Math.round(letzte[reihe.feld] * 100)} %`, lx + 9, p.y + 18);
    lx += 105;
  }
}

// =============================================================================
// Netz
// =============================================================================
function verY(i) {
  if (netz.n === 1) {
    return NETZ_MY;
  }
  const spanne = Math.min(420, (netz.n - 1) * 130);
  return NETZ_MY - spanne / 2 + (i * spanne) / (netz.n - 1);
}

function verR() {
  if (netz.n === 1) {
    return 32;
  }
  const abstand = Math.min(420, (netz.n - 1) * 130) / (netz.n - 1);
  return Math.min(32, abstand * 0.4);
}

function neuronUnterMaus() {
  const r = verR();
  for (let i = 0; i < netz.n; i++) {
    if (dist(mausX(), mausY(), VER_X, verY(i)) < r + 4) {
      return i;
    }
  }
  return -1;
}

function punktAuf(x1, y1, x2, y2, t) {
  return [lerp(x1, x2, t), lerp(y1, y2, t)];
}

function zeichneVerbindung(x1, y1, r1, x2, y2, r2, w, glimmen) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const sx = x1 + Math.cos(a) * r1;
  const sy = y1 + Math.sin(a) * r1;
  const ex = x2 - Math.cos(a) * (r2 + 2);
  const ey = y2 - Math.sin(a) * (r2 + 2);
  const dicke = 1 + Math.min(Math.abs(w), 2) * 4;

  if (Math.abs(glimmen) > 0.03) {
    const g = Math.min(1, Math.abs(glimmen));
    const c = glimmen > 0 ? FARBE.dPlus : FARBE.dMinus;
    stroke(c[0], c[1], c[2], 150 * g);
    strokeWeight(dicke + 16 * g);
    line(sx, sy, ex, ey);
  }
  const farbe = w >= 0 ? FARBE.plus : FARBE.minus;
  stroke(...farbe);
  strokeWeight(dicke);
  line(sx, sy, ex - Math.cos(a) * 10, ey - Math.sin(a) * 10);
  noStroke();
  fill(...farbe);
  push();
  translate(ex, ey);
  rotate(a);
  const hb = 5 + dicke * 0.35;
  triangle(0, 0, -13, -hb, -13, hb);
  pop();
}

function zeichneImpuls(x, y, farbe) {
  // heller Hof, damit der Impuls auch auf einer gleichfarbigen Linie sichtbar ist
  noStroke();
  fill(255, 255, 255, 220);
  circle(x, y, 22);
  fill(farbe[0], farbe[1], farbe[2], 60);
  circle(x, y, 26);
  fill(...farbe);
  circle(x, y, 12);
}

function zeichneRing(x, y, r, farbe) {
  noFill();
  stroke(...farbe);
  strokeWeight(4);
  circle(x, y, 2 * (r + 7 + 3 * Math.sin(millis() / 110)));
}

function zeichneGewichtsSchild(x, y, w) {
  const s = w.toFixed(2);
  textFont(MONO);
  textSize(14);
  const b = textWidth(s) + 10;
  fill(255, 240);
  stroke(...FARBE.linie);
  strokeWeight(1);
  rect(x - b / 2, y - 10, b, 20, 5);
  noStroke();
  fill(...(w >= 0 ? FARBE.dPlus : FARBE.dMinus));
  textAlign(CENTER, CENTER);
  text(s, x, y);
}

function zeichneDeltaSchild(x, y, d, alpha) {
  const s = (d >= 0 ? "▲ +" : "▼ −") + Math.abs(d).toFixed(3);
  textFont(MONO);
  textStyle(BOLD);
  textSize(13);
  const b = textWidth(s) + 12;
  noStroke();
  const c = d >= 0 ? FARBE.dPlus : FARBE.dMinus;
  fill(c[0], c[1], c[2], 245 * alpha);
  rect(x - b / 2, y - 10, b, 20, 10);
  fill(255, 255 * alpha);
  textAlign(CENTER, CENTER);
  text(s, x, y);
  textStyle(NORMAL);
}

function zeichneDeltaFehler(x, y, wert) {
  const s = "δ = " + wert.toFixed(3);
  textFont(MONO);
  textStyle(BOLD);
  textSize(13);
  const b = textWidth(s) + 12;
  stroke(...FARBE.fehler);
  strokeWeight(1.5);
  fill(255);
  rect(x - b / 2, y - 10, b, 21, 6);
  noStroke();
  fill(...FARBE.fehler);
  textAlign(CENTER, CENTER);
  text(s, x, y);
  textStyle(NORMAL);
}

function zeichneBias(x, y, r, wert) {
  stroke(...FARBE.neuron);
  strokeWeight(1.5);
  fill(255);
  circle(x, y, r * 2);
  noStroke();
  fill(...FARBE.text);
  textFont(MONO);
  textSize(Math.max(8, r * 0.72));
  textAlign(CENTER, CENTER);
  text(wert.toFixed(2), x, y);
}

// die k größten Beträge – damit bei vielen Neuronen nicht alles zugepflastert wird
function groessteIndizes(werte, k) {
  return new Set(
    werte
      .map((v, i) => [Math.abs(v), i])
      .sort((a, b) => b[0] - a[0])
      .slice(0, k)
      .map((paar) => paar[1])
  );
}

function zeichneNetzPanel() {
  panel(P_NETZ);
  const n = netz.n;
  const rv = verR();
  const zeigeIn = eingabeBekannt();
  const zeigeH = versteckteBekannt();
  const zeigeY = ausgabeBekannt();
  const maus = neuronUnterMaus();
  const alleSchilder = n <= 4;
  const r = rf ? rf.r : null;

  // Schichten
  noStroke();
  fill(...FARBE.flaeche2, 150);
  rect(IN_X - 80, NETZ_MY - 210, 160, 420, 14);
  rect(VER_X - 80, NETZ_MY - 262, 160, 524, 14);
  rect(AUS_X - 80, NETZ_MY - 150, 160, 330, 14);
  fill(...FARBE.grau);
  textFont(SCHRIFT);
  textStyle(BOLD);
  textSize(13);
  textAlign(CENTER, TOP);
  text("Eingabeschicht", IN_X, NETZ_MY - 202);
  text("Versteckte Schicht", VER_X, NETZ_MY - 254);
  text("Ausgabeschicht", AUS_X, NETZ_MY - 142);
  textStyle(NORMAL);

  // Glimmen der Verbindungen
  const glEin = [];
  const glAus = [];
  const puls = 0.55 + 0.45 * Math.sin(millis() / 120);
  for (let i = 0; i < n; i++) {
    glEin.push([0, 0]);
    glAus.push(0);
  }
  if (r) {
    const zA = rfZustand("wAus");
    if (zA !== -1) {
      const m = Math.max(...r.dAus.map(Math.abs), 1e-9);
      for (let i = 0; i < n; i++) {
        glAus[i] = (r.dAus[i] / m) * (zA <= 1 ? puls : 0.45);
      }
    }
    const zE = rfZustand("wEin");
    if (zE !== -1) {
      let m = 1e-9;
      for (let i = 0; i < n; i++) {
        m = Math.max(m, Math.abs(r.dEin[i][0]), Math.abs(r.dEin[i][1]));
      }
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < 2; j++) {
          glEin[i][j] = (r.dEin[i][j] / m) * (zE <= 1 ? puls : 0.45);
        }
      }
    }
  } else {
    for (let i = 0; i < n; i++) {
      glAus[i] = glimmenAus[i];
      glEin[i][0] = glimmenEin[i][0];
      glEin[i][1] = glimmenEin[i][1];
    }
  }

  // Verbindungen
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < 2; j++) {
      zeichneVerbindung(IN_X, IN_Y[j], R, VER_X, verY(i), rv, zeigeWEin(i, j), glEin[i][j]);
    }
  }
  for (let i = 0; i < n; i++) {
    zeichneVerbindung(VER_X, verY(i), rv, AUS_X, AUS_Y, R, zeigeWAus(i), glAus[i]);
  }

  // Linien vom aktuellen Teil im Diagramm zu den Eingabeneuronen
  if (teil && phase !== "bereit" && !laufTraining && !laufTest) {
    const [px, py] = zuPlot(teil.x, teil.y);
    stroke(FARBE.vor[0], FARBE.vor[1], FARBE.vor[2], 150);
    strokeWeight(2);
    for (let j = 0; j < 2; j++) {
      line(px, py, IN_X - R, IN_Y[j]);
    }
  }

  // Impulse: türkis = Vorwärtsrechnung, magenta = Fehlersignal läuft zurück
  zeichneImpulse(n);

  // Hervorhebung der gerade aktiven Schicht
  if (phase === "eingabe") {
    for (let j = 0; j < 2; j++) {
      zeichneRing(IN_X, IN_Y[j], R, FARBE.vor);
    }
  }
  if (phase === "versteckt" && zeigeH) {
    for (let i = 0; i < n; i++) {
      zeichneRing(VER_X, verY(i), rv, FARBE.vor);
    }
  }
  if (phase === "ausgabe" && zeigeY) {
    zeichneRing(AUS_X, AUS_Y, R, FARBE.vor);
  }
  if (r) {
    const zA = rfZustand("ausgang");
    if (zA >= 0 && zA <= 1) {
      zeichneRing(AUS_X, AUS_Y, R, FARBE.fehler);
    }
    const zV = rfZustand("versteckt");
    if (zV >= 0 && zV <= 1) {
      for (let i = 0; i < n; i++) {
        zeichneRing(VER_X, verY(i), rv, FARBE.fehler);
      }
    }
  }

  // Eingabeneuronen
  for (let j = 0; j < 2; j++) {
    stroke(...FARBE.text);
    strokeWeight(2);
    fill(...FARBE.neuron);
    circle(IN_X, IN_Y[j], R * 2);
    noStroke();
    fill(255);
    textFont(MONO);
    textSize(18);
    textAlign(CENTER, CENTER);
    text(zeigeIn ? f2(vw.x[j]) : "?", IN_X, IN_Y[j]);

    fill(...FARBE.text);
    textFont(SCHRIFT);
    textStyle(BOLD);
    textSize(14);
    text(SZ.merkmale[j].name, IN_X, IN_Y[j] - R - 26);
    textStyle(NORMAL);
    textSize(12);
    fill(...FARBE.grau);
    const roh = zeigeIn && teil ? wertText(teil.roh[j], SZ.merkmale[j]) : SZ.merkmale[j].einheit;
    text(roh, IN_X, IN_Y[j] - R - 10);
  }

  // versteckte Neuronen
  for (let i = 0; i < n; i++) {
    const y = verY(i);
    stroke(...FARBE.text);
    strokeWeight(2);
    fill(...FARBE.neuron);
    circle(VER_X, y, rv * 2);
    noStroke();
    fill(zeigeH ? 255 : 160);
    textFont(MONO);
    textSize(Math.max(10, rv * 0.52));
    textAlign(CENTER, CENTER);
    text(zeigeH ? f2(zeigeWert("h", i)) : "?", VER_X, y);
    if (netz.biasAn) {
      zeichneBias(VER_X - rv * 0.9, y - rv * 0.9, Math.max(10, rv * 0.45), zeigeBVer(i));
    }
  }

  // Ausgabeneuron
  const yWert = zeigeY ? zeigeWert("y") : 0.5;
  stroke(...FARBE.text);
  strokeWeight(2);
  fill(...skalenFarbe(yWert, true));
  circle(AUS_X, AUS_Y, R * 2);
  noStroke();
  fill(Math.abs(yWert - 0.5) > 0.3 ? 255 : 30);
  textFont(MONO);
  textSize(18);
  textAlign(CENTER, CENTER);
  text(zeigeY ? f2(yWert) : "?", AUS_X, AUS_Y);
  fill(...FARBE.grau);
  textFont(SCHRIFT);
  textSize(12);
  text("P(i.O.)", AUS_X, AUS_Y + R + 12);
  if (netz.biasAn) {
    zeichneBias(AUS_X - R * 0.9, AUS_Y - R * 0.9, 15, zeigeBAus());
  }

  // Aktivierungsfunktionen
  if (netz.aktivierungAn) {
    const pw = plotsGross ? 150 : 58;
    const ph = plotsGross ? 100 : 40;
    for (let i = 0; i < n; i++) {
      zeichneFunktion(VER_X + rv + 8, verY(i) - ph / 2, pw, ph, netz.aktivierung, zeigeH ? zeigeWert("z", i) : null);
    }
  }
  {
    const pw = plotsGross ? 150 : 72;
    const ph = plotsGross ? 100 : 46;
    zeichneFunktion(AUS_X - pw / 2, AUS_Y + R + 26, pw, ph, "sigmoid", zeigeY ? zeigeWert("zAus") : null);
  }

  // Gewichte und ihre Änderungen
  const zE = r ? rfZustand("wEin") : -1;
  const zA = r ? rfZustand("wAus") : -1;
  const topEin = new Set();
  if (r) {
    const flach = [];
    for (let i = 0; i < n; i++) {
      flach.push(r.dEin[i][0], r.dEin[i][1]);
    }
    for (const k of groessteIndizes(flach, 4)) {
      topEin.add(k);
    }
  }
  const topAus = r ? groessteIndizes(r.dAus, 4) : new Set();

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < 2; j++) {
      const [lx, ly] = punktAuf(IN_X, IN_Y[j], VER_X, verY(i), 0.6);
      const schild = alleSchilder || maus === i;
      if (schild) {
        zeichneGewichtsSchild(lx, ly, zeigeWEin(i, j));
      }
      if (r && zE !== -1 && (schild || topEin.has(i * 2 + j))) {
        zeichneDeltaSchild(lx, ly + (schild ? 21 : 0), r.dEin[i][j], zE <= 1 ? zE : 1);
      }
    }
  }
  for (let i = 0; i < n; i++) {
    const [lx, ly] = punktAuf(VER_X, verY(i), AUS_X, AUS_Y, 0.5);
    const schild = alleSchilder || maus === i;
    if (schild) {
      zeichneGewichtsSchild(lx, ly, zeigeWAus(i));
    }
    if (r && zA !== -1 && (schild || topAus.has(i))) {
      zeichneDeltaSchild(lx, ly + (schild ? 21 : 0), r.dAus[i], zA <= 1 ? zA : 1);
    }
  }

  // Bias-Änderungen
  if (r && netz.biasAn && rfZustand("bias") !== -1) {
    const z = rfZustand("bias");
    const a = z <= 1 ? z : 1;
    for (let i = 0; i < n; i++) {
      if (alleSchilder || maus === i) {
        zeichneDeltaSchild(VER_X - rv * 0.9 - 46, verY(i) - rv * 0.9, r.dBVer[i], a);
      }
    }
    zeichneDeltaSchild(AUS_X - R * 0.9 - 46, AUS_Y - R * 0.9, r.dBAus, a);
  }

  // Fehlersignale δ
  if (r && rfZustand("ausgang") !== -1) {
    zeichneDeltaFehler(AUS_X, AUS_Y - R - 22, r.deltaAus);
  }
  if (r && rfZustand("versteckt") !== -1) {
    for (let i = 0; i < n; i++) {
      if (n <= 5 || maus === i) {
        zeichneDeltaFehler(VER_X, verY(i) + rv + 14, r.deltaVer[i]);
      }
    }
  }

  if (n > 4) {
    noStroke();
    fill(...FARBE.grau);
    textFont(SCHRIFT);
    textSize(12);
    textAlign(CENTER, TOP);
    text("Maus auf ein Neuron: Gewichte anzeigen", VER_X, NETZ_MY + 268);
  }

  zeichnePruefergebnis();
}

function zeichneImpulse(n) {
  if (animLaeuft("vor1")) {
    const t = weich((millis() - anim.t0) / anim.dauer);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < 2; j++) {
        zeichneImpuls(...punktAuf(IN_X, IN_Y[j], VER_X, verY(i), t), FARBE.vor);
      }
    }
  }
  if (animLaeuft("vor2")) {
    const t = weich((millis() - anim.t0) / anim.dauer);
    for (let i = 0; i < n; i++) {
      zeichneImpuls(...punktAuf(VER_X, verY(i), AUS_X, AUS_Y, t), FARBE.vor);
    }
  }
  if (!rf || rf.fertig) {
    return;
  }
  const akt = rf.schritte[rf.idx];
  const roh = rfAnteil(akt);
  const t = weich(roh);
  if (akt === "wAus") {
    for (let i = 0; i < n; i++) {
      zeichneImpuls(...punktAuf(AUS_X, AUS_Y, VER_X, verY(i), t), FARBE.fehler);
    }
  } else if (akt === "wEin") {
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < 2; j++) {
        zeichneImpuls(...punktAuf(VER_X, verY(i), IN_X, IN_Y[j], t), FARBE.fehler);
      }
    }
  } else if (akt === "neu") {
    if (roh < 0.5) {
      const t1 = weich(roh * 2);
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < 2; j++) {
          zeichneImpuls(...punktAuf(IN_X, IN_Y[j], VER_X, verY(i), t1), FARBE.vor);
        }
      }
    } else {
      const t2 = weich((roh - 0.5) * 2);
      for (let i = 0; i < n; i++) {
        zeichneImpuls(...punktAuf(VER_X, verY(i), AUS_X, AUS_Y, t2), FARBE.vor);
      }
    }
  }
}

// kleines Diagramm einer Aktivierungsfunktion, der aktuelle Wert als roter Punkt
function zeichneFunktion(x, y, w, h, art, z) {
  let fn;
  let xr;
  let yr;
  let titel;
  if (art === "sigmoid") {
    fn = NeuronalesNetz.sigmoid;
    xr = 6;
    yr = [-0.1, 1.1];
    titel = "Sigmoid";
  } else if (art === "tanh") {
    fn = Math.tanh;
    xr = 3;
    yr = [-1.2, 1.2];
    titel = "tanh";
  } else {
    fn = (v) => (v > 0 ? v : 0.1 * v);
    xr = 3;
    yr = [-0.8, 3];
    titel = "Leaky-ReLU";
  }
  const X = (v) => x + ((v + xr) / (2 * xr)) * w;
  const Y = (v) => y + h - ((v - yr[0]) / (yr[1] - yr[0])) * h;

  stroke(...FARBE.text);
  strokeWeight(1);
  fill(29, 29, 28, 235);
  rect(x, y, w, h, 4);
  stroke(255, 255, 255, 90);
  line(x, Y(0), x + w, Y(0));
  line(X(0), y, X(0), y + h);
  noFill();
  stroke(235, 182, 92); // helles Senf, gut sichtbar auf Schwarz
  strokeWeight(2);
  beginShape();
  for (let k = 0; k <= 40; k++) {
    const v = -xr + (2 * xr * k) / 40;
    vertex(X(v), Y(constrain(fn(v), yr[0], yr[1])));
  }
  endShape();
  if (z !== null && z !== undefined) {
    const zc = constrain(z, -xr, xr);
    noStroke();
    fill(255, 80, 80);
    circle(X(zc), Y(constrain(fn(zc), yr[0], yr[1])), w > 100 ? 10 : 7);
  }
  if (w > 100) {
    noStroke();
    fill(255);
    textFont(SCHRIFT);
    textStyle(BOLD);
    textSize(12);
    textAlign(LEFT, TOP);
    text(titel, x + 6, y + 5);
    textStyle(NORMAL);
  }
}

// -----------------------------------------------------------------------------
// Prüfergebnis rechts neben dem Ausgabeneuron
// -----------------------------------------------------------------------------
function zeichnePruefergebnis() {
  const x = 1350;
  const y = 214;
  const w = 210;
  const h = 330;
  fill(...FARBE.papier);
  stroke(...FARBE.linie);
  strokeWeight(1);
  rect(x, y, w, h, 10);
  noStroke();
  fill(...FARBE.text);
  textFont(SCHRIFT);
  textStyle(BOLD);
  textSize(15);
  textAlign(LEFT, TOP);
  text("Prüfergebnis", x + 14, y + 12);
  textStyle(NORMAL);

  if (!teil || !eingabeBekannt()) {
    fill(...FARBE.grau);
    textSize(13);
    text(`Noch ${SZ.wort.kein}.\nHol dir mit → ${SZ.wort.ein}\noder klicke ins Diagramm.`, x + 14, y + 44);
    return;
  }

  let ty = y + 42;
  const zeile = (titel, wert, farbe, klein) => {
    fill(...FARBE.grau);
    textSize(12);
    text(titel, x + 14, ty);
    fill(...(farbe || FARBE.text));
    textStyle(BOLD);
    textSize(15);
    text(wert, x + 14, ty + 15);
    textStyle(NORMAL);
    ty += 40;
    if (klein) {
      fill(...FARBE.grau);
      textSize(11);
      for (const z of umbrechen(klein, w - 28)) {
        text(z, x + 14, ty - 6);
        ty += 14;
      }
      ty += 4;
    }
  };

  zeile(
    SZ.soll,
    teil.label === 1 ? "i.O.  (t = 1)" : "n.i.O.  (t = 0)",
    teil.label === 1 ? FARBE.io : FARBE.nio,
    teil.label === 1 ? "" : teil.fehler
  );

  if (!ausgabeBekannt()) {
    fill(...FARBE.grau);
    textSize(13);
    text("Das Netz rechnet …\nweiter mit →", x + 14, ty);
    return;
  }

  const yv = zeigeWert("y");
  const vorhersage = yv >= 0.5 ? 1 : 0;
  const richtig = vorhersage === teil.label;
  zeile("Netz: Wahrscheinlichkeit i.O.", f2(yv));
  zeile(
    "Entscheidung des Netzes",
    (vorhersage === 1 ? "i.O." : "n.i.O.") + (richtig ? "   ✓ richtig" : "   ✗ falsch"),
    richtig ? FARBE.io : FARBE.nio
  );
  const e = teil.label - yv;
  zeile("Fehler  t − y", f2(e), FARBE.fehler);

  const bw = w - 28;
  fill(...FARBE.flaeche2);
  rect(x + 14, ty - 6, bw, 9, 4);
  fill(...FARBE.fehler);
  rect(x + 14, ty - 6, bw * Math.min(1, Math.abs(e)), 9, 4);

  if (rf && rfZustand("neu") !== -1) {
    const besser = Math.abs(rf.nachher.y - teil.label) < Math.abs(rf.vorher.y - teil.label);
    fill(...FARBE.grau);
    textSize(12);
    text("Fehler vorher:  " + f3(teil.label - rf.vorher.y), x + 14, ty + 12);
    fill(...(besser ? FARBE.io : FARBE.nio));
    textStyle(BOLD);
    text("Fehler nachher: " + f3(teil.label - rf.nachher.y) + (besser ? "  ↓" : "  ↑"), x + 14, ty + 28);
    textStyle(NORMAL);
  }
}

// =============================================================================
// Erklärung
// =============================================================================
function erklaerung() {
  const aktName = netz.aktivierung === "tanh" ? "tanh-Funktion" : "Leaky-ReLU-Funktion";

  if (laufTraining) {
    return {
      titel: "Automatisches Training läuft",
      text:
        `Jede Trainingsmessung durchläuft Vorwärtsrechnung und Fehlerrückführung. Leuchtende Verbindungen wurden gerade stark angepasst: blau = Gewicht wird größer, orange = Gewicht wird kleiner. Links unten siehst du die Fehlerquote je Epoche.`,
      formeln: [],
    };
  }
  if (laufTest) {
    return {
      titel: "Test läuft",
      text:
        `Das Netz bewertet die ${SZ.wort.test}, die es beim Training nie gesehen hat. Falsch bewertete ${SZ.wort.pl} werden schwarz umkreist.`,
      formeln: [`bisher ${testFalsch} von ${testIdx} falsch`],
    };
  }

  if (phase === "bereit") {
    if (modus === "training") {
      const e = {
        titel: "Trainingsmodus",
        text:
          `Hol dir mit → ${SZ.wort.ein} aus den Trainingsdaten oder klicke ins Diagramm. Nach der Vorwärtsrechnung zeigt ← die Fehlerrückführung Schritt für Schritt. Oder starte oben das automatische Training.`,
        formeln: [],
      };
      if (kurve.length > 1) {
        const k = kurve[kurve.length - 1];
        e.titel = "Training beendet";
        e.text = `Nach ${gesamtEpochen} Epochen: Fehlerquote ${Math.round(k.train * 100)} % beim Training, ${Math.round(k.test * 100)} % beim Test.`;
        if (k.test > 0.15 && !netz.aktivierungAn) {
          e.text +=
            ` Tipp: Ohne Aktivierungsfunktion kann das Netz nur eine gerade Grenze ziehen – ${SZ.form}. Schalte Bias und Aktivierung ein.`;
        } else if (k.test > 0.15) {
          e.text += " Tipp: Mehr Epochen, eine andere Lernrate oder neue Zufallswerte ausprobieren.";
        } else {
          e.text += ` Blende die Entscheidungskarte ein, um zu sehen, ${SZ.gelernt}.`;
        }
      }
      return e;
    }
    return {
      titel: "Erkunden & Testen",
      text:
        `Hol dir mit → ${SZ.wort.ein} aus den Testdaten oder klicke ins Diagramm. Das Netz rechnet dann Schicht für Schicht vorwärts. Mit „Test starten“ werden alle ${SZ.wort.test} auf einmal geprüft.`,
      formeln: [],
    };
  }

  if (phase === "eingabe") {
    return {
      titel: "1 · Eingabe",
      text:
        "Die beiden Messwerte werden auf den Bereich −1 … +1 umgerechnet (normiert), damit das Netz mit ähnlich großen Zahlen arbeitet. Weiter mit →.",
      formeln: [
        normFormel(0),
        normFormel(1),
      ],
    };
  }

  if (phase === "versteckt") {
    const formeln = [];
    for (let i = 0; i < Math.min(netz.n, 4); i++) {
      let s = `h${i + 1}: z = ${f2(netz.wEin[i][0])}·${klammer(vw.x[0])} + ${f2(netz.wEin[i][1])}·${klammer(vw.x[1])}`;
      if (netz.biasAn) {
        s += ` + ${klammer(netz.bVer[i])}`;
      }
      s += ` = ${f2(vw.z[i])}`;
      if (netz.aktivierungAn) {
        s += ` → f = ${f2(vw.h[i])}`;
      }
      formeln.push(s);
    }
    return {
      titel: "2 · Versteckte Schicht",
      text:
        "Jedes versteckte Neuron bildet die gewichtete Summe seiner Eingaben" +
        (netz.biasAn ? " plus Bias" : "") +
        (netz.aktivierungAn ? ` und wendet die ${aktName} an.` : ". Ohne Aktivierungsfunktion gilt h = z.") +
        " Weiter mit →.",
      formeln,
    };
  }

  if (phase === "ausgabe") {
    const entscheidung = vw.y >= 0.5 ? "i.O." : "n.i.O.";
    return {
      titel: "3 · Ausgabe und Fehler",
      text:
        `Das Ausgabeneuron summiert die gewichteten Werte und drückt das Ergebnis mit der Sigmoid-Funktion zwischen 0 und 1: die Wahrscheinlichkeit, dass ${SZ.wort.das} i.O. ist. ` +
        (modus === "training" ? "Jetzt die Fehlerrückführung mit ← starten." : `${SZ.wort.naechst} mit →.`),
      formeln: [
        `y = σ(${f2(vw.zAus)}) = ${f2(vw.y)}   →  Entscheidung: ${entscheidung}`,
        `Soll t = ${teil.label}     Fehler t − y = ${f2(teil.label - vw.y)}`,
      ],
    };
  }

  if (phase === "rueck" && rf) {
    const r = rf.r;
    const akt = rf.schritte[rf.idx];
    const nr = `${rf.idx + 1}/${rf.schritte.length}`;
    const v = rf.vorher;
    const g = rf.gewVorher;
    const n = netz.n;

    if (akt === "ausgang") {
      return {
        titel: `Fehlerrückführung ${nr} · Fehlersignal am Ausgang`,
        text:
          "Wie stark und in welche Richtung muss sich die Ausgabe ändern? Das Fehlersignal δ verbindet den Fehler mit der Steigung der Sigmoid-Funktion.",
        formeln: [
          `Fehler        e = t − y = ${r.t} − ${f2(v.y)} = ${f2(r.e)}`,
          `Steigung      y·(1 − y) = ${f3(r.steigungAus)}`,
          `Fehlersignal  δ = 2·e·y·(1 − y) = ${f3(r.deltaAus)}`,
        ],
      };
    }
    if (akt === "wAus") {
      const formeln = [`Δw = η · δ · h        η = ${f2(r.lernrate)}   δ = ${f3(r.deltaAus)}`];
      for (let i = 0; i < Math.min(n, 3); i++) {
        formeln.push(
          `w(h${i + 1}→y): ${f2(g.wAus[i])} ${mitVorzeichen(r.dAus[i], 3)} = ${f2(g.wAus[i] + r.dAus[i])}   (h${i + 1} = ${f2(v.h[i])})`
        );
      }
      return {
        titel: `Fehlerrückführung ${nr} · Gewichte zum Ausgang`,
        text:
          "Jedes Gewicht ändert sich um Lernrate × Fehlersignal × Wert des Neurons davor. Stark aktive Neuronen bekommen eine große Änderung.",
        formeln,
      };
    }
    if (akt === "versteckt") {
      const formeln = [netz.aktivierungAn ? "δ_h = δ · w(alt) · f'(z)" : "δ_h = δ · w(alt)"];
      for (let i = 0; i < Math.min(n, 3); i++) {
        let s = `δ_h${i + 1} = ${f3(r.deltaAus)} · ${klammer(g.wAus[i])}`;
        if (netz.aktivierungAn) {
          s += ` · ${f2(r.fStrich[i])}`;
        }
        s += ` = ${f3(r.deltaVer[i])}`;
        formeln.push(s);
      }
      return {
        titel: `Fehlerrückführung ${nr} · Fehler der versteckten Neuronen`,
        text:
          "Der Fehler wird rückwärts verteilt: Jedes versteckte Neuron bekommt einen Anteil, so groß wie sein (altes) Gewicht zum Ausgang" +
          (netz.aktivierungAn ? ", mal der Steigung seiner Aktivierungsfunktion." : "."),
        formeln,
      };
    }
    if (akt === "wEin") {
      const formeln = [`Δw = η · δ_h · x        T = ${f2(v.x[0])}   p = ${f2(v.x[1])}`];
      let c = 0;
      for (let i = 0; i < n && c < 3; i++) {
        for (let j = 0; j < 2 && c < 3; j++) {
          formeln.push(
            `w(${KURZ[j]}→h${i + 1}): ${f2(g.wEin[i][j])} ${mitVorzeichen(r.dEin[i][j], 3)} = ${f2(g.wEin[i][j] + r.dEin[i][j])}`
          );
          c++;
        }
      }
      return {
        titel: `Fehlerrückführung ${nr} · Gewichte von der Eingabe`,
        text:
          "Genauso wie eben: Änderung = Lernrate × Fehlersignal des Neurons × Eingabewert. Ist ein Eingabewert nahe 0, ändert sich sein Gewicht kaum.",
        formeln,
      };
    }
    if (akt === "bias") {
      const formeln = ["Δb = η · δ", `b(y):  ${f2(g.bAus)} ${mitVorzeichen(r.dBAus, 3)} = ${f2(g.bAus + r.dBAus)}`];
      for (let i = 0; i < Math.min(n, 2); i++) {
        formeln.push(`b(h${i + 1}): ${f2(g.bVer[i])} ${mitVorzeichen(r.dBVer[i], 3)} = ${f2(g.bVer[i] + r.dBVer[i])}`);
      }
      return {
        titel: `Fehlerrückführung ${nr} · Biases`,
        text: "Ein Bias verhält sich wie ein Gewicht, dessen Eingang immer 1 ist.",
        formeln,
      };
    }
    if (akt === "neu") {
      return {
        titel: `Fehlerrückführung ${nr} · Neu vorwärts rechnen`,
        text: `Mit den angepassten Gewichten wird ${SZ.wort.dasselbe} noch einmal bewertet.`,
        formeln: [
          `Ausgabe y:  ${f2(rf.vorher.y)}  →  ${f2(rf.nachher.y)}`,
          `Fehler:     ${f2(r.t - rf.vorher.y)}  →  ${f2(r.t - rf.nachher.y)}`,
        ],
      };
    }
  }

  if (phase === "fertig" && rf) {
    const ev = rf.r.t - rf.vorher.y;
    const en = rf.r.t - rf.nachher.y;
    const besser = Math.abs(en) < Math.abs(ev);
    return {
      titel: "Fehlerrückführung abgeschlossen",
      text: besser
        ? `Der Fehler für ${SZ.wort.dies} ist kleiner geworden. Mit ← denselben Schritt wiederholen, mit → kommt ${SZ.wort.naechstKlein}.`
        : "Der Fehler ist nicht kleiner geworden – vielleicht ist die Lernrate zu groß. Probier eine kleinere Lernrate.",
      formeln: [`Fehler vorher ${f3(ev)}  →  nachher ${f3(en)}`],
    };
  }

  return { titel: "", text: "", formeln: [] };
}

// Normierung eines Eingabewerts als Textzeile für das Erklärfeld
function normFormel(j) {
  const m = SZ.merkmale[j];
  const links = (m.name + " " + wertText(teil.roh[j], m)).padEnd(24);
  return `${links}→  ${f2(vw.x[j])}     (${wertText(m.min, m)} = −1, ${wertText(m.max, m)} = +1)`;
}

function zeichneErklaerung() {
  const p = P_ERKL;
  const e = erklaerung();
  p.titel = e.titel;
  panel(p);

  let ty = p.y + KOPF_H + 10;
  const unten = p.y + p.h - 46;
  noStroke();
  textAlign(LEFT, TOP);
  textFont(SCHRIFT);
  textSize(14);
  if (hinweis && millis() - hinweis.t0 < 3500) {
    fill(...FARBE.akzent);
    textStyle(BOLD);
    for (const z of umbrechen(hinweis.text, p.w - 32)) {
      text(z, p.x + 16, ty);
      ty += 18;
    }
    textStyle(NORMAL);
  } else {
    fill(...FARBE.grau);
    for (const z of umbrechen(e.text, p.w - 32).slice(0, 4)) {
      text(z, p.x + 16, ty);
      ty += 18;
    }
  }

  ty += 6;
  textFont(MONO);
  textSize(13);
  fill(...FARBE.text);
  for (const f of e.formeln) {
    if (ty + 16 > unten) {
      break;
    }
    text(f, p.x + 16, ty);
    ty += 17;
  }
}

function zeichneEinstellungen() {
  const p = P_EINST;
  panel(p);
  if (modus === "training") {
    stroke(...FARBE.linie);
    strokeWeight(1);
    line(p.x + 14, 786, p.x + p.w - 14, 786);
  } else {
    noStroke();
    fill(...FARBE.grau);
    textFont(SCHRIFT);
    textSize(12);
    textAlign(LEFT, TOP);
    text("Lernrate, Epochen und Tempo gibt es\nim Trainingsmodus.", p.x + 16, 800);
  }
}

// -----------------------------------------------------------------------------
// Tooltip und Fehlermeldung
// -----------------------------------------------------------------------------
function zeichneTooltip() {
  const mx = mausX();
  const my = mausY();
  if (!imPlot(mx, my)) {
    return;
  }
  const liste = modus === "training" ? trainingsdaten : testdaten;
  let bester = null;
  let besterAbstand = 11;
  const kandidaten = markierungen.map((m) => m.b).concat(liste);
  for (const b of kandidaten) {
    const [px, py] = zuPlot(b.x, b.y);
    const d = dist(mx, my, px, py);
    if (d < besterAbstand) {
      besterAbstand = d;
      bester = b;
    }
  }
  if (!bester) {
    return;
  }
  const s = bauteilText(bester);
  textFont(SCHRIFT);
  textSize(13);
  const b = textWidth(s) + 18;
  const tx = Math.min(mx + 14, W - b - 10);
  noStroke();
  fill(29, 29, 28, 235);
  rect(tx, my + 14, b, 26, 6);
  fill(255);
  textAlign(LEFT, CENTER);
  text(s, tx + 9, my + 27);
}

function zeichneFehlerMeldung() {
  if (!fehlerMeldung || millis() - fehlerMeldung.t0 > 8000) {
    return;
  }
  const s = "Interner Fehler: " + fehlerMeldung.text + "  (Details in der Konsole)";
  textFont(SCHRIFT);
  textSize(14);
  const b = textWidth(s) + 30;
  noStroke();
  fill(...FARBE.akzent, 240);
  rect(W / 2 - b / 2, 62, b, 30, 6);
  fill(255);
  textAlign(CENTER, CENTER);
  text(s, W / 2, 77);
}

// =============================================================================
// Eingaben
// =============================================================================
function mousePressed() {
  if (laufTraining || laufTest) {
    return;
  }
  const mx = mausX();
  const my = mausY();
  if (!imPlot(mx, my)) {
    return;
  }
  const xn = ((mx - PLOT.x) / PLOT.s) * 2 - 1;
  const yn = 1 - ((my - PLOT.y) / PLOT.s) * 2;
  const w0 = runde(entnormieren(xn, SZ.merkmale[0]), SZ.merkmale[0]);
  const w1 = runde(entnormieren(yn, SZ.merkmale[1]), SZ.merkmale[1]);
  teilEingeben(erzeugeTeil(null, w0, w1, SZ.pruefe(w0, w1)));
}

function keyPressed() {
  // Tasten nicht abfangen, wenn eine Auswahlliste oder ein Textfeld den Fokus hat
  const el = document.activeElement;
  if (el && (el.tagName === "SELECT" || el.tagName === "TEXTAREA" ||
      (el.tagName === "INPUT" && !["checkbox", "range", "button", "file"].includes(el.type)))) {
    return true;
  }
  if (key === "ArrowRight") {
    schrittVor();
    return false;
  }
  if (key === "ArrowLeft") {
    schrittZurueck();
    return false;
  }
  return true;
}

// =============================================================================
// Netz speichern und laden
// =============================================================================
function netzSpeichern() {
  const jetzt = new Date();
  const datum = jetzt.toISOString().split("T")[0];
  const uhr = jetzt.toTimeString().split(" ")[0].replace(/:/g, "-");
  const name = prompt("Dateiname:", `${datum}_${uhr}_netz.json`);
  if (name === null) {
    return;
  }
  const daten = netz.alsJSON();
  daten.szenario = szenarioName; // damit beim Laden das passende Beispiel gewählt wird
  const blob = new Blob([JSON.stringify(daten, null, 1)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.download = name;
  a.href = url;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function dateiGewaehlt(datei) {
  if (!datei || !datei.name || !datei.name.toLowerCase().endsWith(".json")) {
    alert("Bitte eine JSON-Datei wählen.");
    return;
  }
  const leser = new FileReader();
  leser.onload = (ev) => {
    try {
      const daten = JSON.parse(ev.target.result);
      netz.ausJSON(daten);
      if (daten.szenario && daten.szenario !== szenarioName && SZENARIEN[daten.szenario]) {
        szenarioWechseln(daten.szenario);
      }
      netzZurueckgesetzt(true);
    } catch (err) {
      alert("Das Netz konnte nicht geladen werden: " + err.message);
    }
  };
  leser.readAsText(datei.file);
  ui.datei.elt.value = "";
}
