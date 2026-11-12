// =============================================================================
//  ui.js – HTML-Bedienelemente über der Zeichenfläche
// =============================================================================
//  Alle Positionen werden im logischen 1600×900-Raster angegeben und beim
//  Ändern der Fenstergröße mitskaliert (siehe layoutUi).
// =============================================================================

const ui = {};
const uiPositionen = [];
let huelle;

function platziere(el, x, y, w, ...klassen) {
  el.addClass("ui");
  for (const k of klassen) {
    el.addClass(k);
  }
  el.parent(huelle);
  uiPositionen.push({ el, x, y, w });
  return el;
}

function layoutUi() {
  huelle.style("width", width + "px");
  huelle.style("font-size", 15 * S + "px");
  for (const p of uiPositionen) {
    // alles unterhalb der Kopfzeile rutscht um die Beispiel-Leiste nach unten
    const y = p.y >= 56 && !p.el.hasClass("beispiel") ? p.y + LEISTE : p.y;
    p.el.position(p.x * S, y * S);
    if (p.w) {
      p.el.style("width", p.w * S + "px");
    }
  }
}

// Nach dem Anklicken den Fokus abgeben, damit die Pfeiltasten wieder das Netz steuern
function fokusWeg(el) {
  const inp = el.elt.querySelector ? el.elt.querySelector("input, select") : null;
  (inp || el.elt).blur();
}

function erstelleUi() {
  huelle = createDiv();
  huelle.addClass("huelle");

  // --- Kopfzeile -------------------------------------------------------------
  ui.logo = platziere(createImg("assets/logo-jps.png", "Logo der Jakob-Preh-Schule"), 14, 3, 122, "logo");

  // Beispiel-Leiste: ein Reiter je Beispiel (Reihenfolge wie in SZENARIEN, daten.js)
  ui.beispiele = {};
  let bx = 128;
  Object.keys(SZENARIEN).forEach((id, i) => {
    const text = `${i + 1} · ${SZENARIEN[id].kurz}`;
    const b = 34 + text.length * 8.6;
    ui.beispiele[id] = platziere(createButton(text), bx, 63, b, "beispiel");
    ui.beispiele[id].attribute("title", SZENARIEN[id].name + " (das Netz wird zurückgesetzt)");
    ui.beispiele[id].mousePressed(() => {
      szenarioWechseln(id);
      ui.beispiele[id].elt.blur();
    });
    bx += b + 10;
  });

  ui.modusErkunden = platziere(createButton("Erkunden & Testen"), 470, 12, 180, "kopf");
  ui.modusErkunden.mousePressed(() => setzeModus("erkunden"));

  ui.modusTraining = platziere(createButton("Training"), 656, 12, 120, "kopf");
  ui.modusTraining.mousePressed(() => setzeModus("training"));

  ui.aktion = platziere(createButton("▶ Test starten"), 800, 12, 200, "primaer");
  ui.aktion.mousePressed(aktionsKnopf);

  ui.zufall = platziere(createButton("Zufallswerte"), 1090, 12, 120, "kopf");
  ui.zufall.mousePressed(zufallsWerte);

  ui.tutorial = platziere(createButton("Tutorial"), 1216, 12, 100, "kopf");
  ui.tutorial.mousePressed(tutorialNetz);

  ui.laden = platziere(createButton("Laden"), 1322, 12, 120, "kopf");
  ui.laden.mousePressed(() => ui.datei.elt.click());

  ui.speichern = platziere(createButton("Speichern"), 1448, 12, 128, "kopf");
  ui.speichern.mousePressed(netzSpeichern);

  ui.datei = createFileInput(dateiGewaehlt);
  ui.datei.parent(huelle);
  ui.datei.hide();

  // --- Prozessdaten ----------------------------------------------------------
  ui.aufteilen = platziere(createButton("Daten neu aufteilen"), 40, 620, 230);
  ui.aufteilen.mousePressed(() => {
    datenAufteilen();
    netzZurueckgesetzt(false);
  });

  ui.karte = platziere(createButton("Entscheidungskarte einblenden"), 282, 620, 286);
  ui.karte.mousePressed(() => {
    karteAn = !karteAn;
    karteVeraltet = true;
  });

  // --- Netz ------------------------------------------------------------------
  ui.plotsGross = platziere(createCheckbox(" Funktionen groß", false), 1404, 91, 160);
  ui.plotsGross.changed(() => {
    plotsGross = ui.plotsGross.checked();
    fokusWeg(ui.plotsGross);
  });

  // --- Erklärung -------------------------------------------------------------
  ui.vor = platziere(createButton("Vorwärts ▶ (→)"), 616, 846, 196, "dunkel");
  ui.vor.mousePressed(schrittVor);

  ui.zurueck = platziere(createButton("◀ Fehlerrückführung (←)"), 820, 846, 236, "primaer");
  ui.zurueck.mousePressed(schrittZurueck);

  ui.phasen = platziere(createCheckbox(" Phasen einzeln", false), 1066, 851, 130);
  ui.phasen.changed(() => fokusWeg(ui.phasen));

  // --- Einstellungen ---------------------------------------------------------
  platziere(createSpan("Versteckte Neuronen"), 1232, 720, 170);
  ui.anzahl = platziere(createSelect(), 1480, 720, 80);
  for (let i = 1; i <= 10; i++) {
    ui.anzahl.option(String(i), String(i));
  }
  ui.anzahl.changed(() => {
    const n = parseInt(ui.anzahl.value(), 10);
    if (n !== netz.n && confirm("Achtung: Das Netz wird neu aufgebaut, alle Gewichte werden zurückgesetzt.")) {
      netz.neuAufbauen(n);
      netzZurueckgesetzt(true);
    }
    ui.anzahl.selected(String(netz.n));
    ui.anzahl.elt.blur();
  });

  ui.bias = platziere(createCheckbox(" Bias", false), 1232, 752, 90);
  ui.bias.changed(() => {
    netz.biasAn = ui.bias.checked();
    netzEinstellungGeaendert();
    fokusWeg(ui.bias);
  });

  ui.akt = platziere(createCheckbox(" Aktivierung", false), 1316, 752, 126);
  ui.akt.changed(() => {
    netz.aktivierungAn = ui.akt.checked();
    netzEinstellungGeaendert();
    fokusWeg(ui.akt);
  });

  ui.aktArt = platziere(createSelect(), 1444, 750, 118);
  ui.aktArt.option("ReLU", "relu"); // Leaky-ReLU
  ui.aktArt.option("tanh", "tanh");
  ui.aktArt.changed(() => {
    netz.aktivierung = ui.aktArt.value();
    netzEinstellungGeaendert();
    ui.aktArt.elt.blur();
  });

  // nur im Trainingsmodus
  ui.lrText = platziere(createSpan("η = 0.50"), 1232, 794, 80);
  ui.lr = platziere(createSlider(0.05, 1, lernrate, 0.05), 1312, 800, 248);
  ui.lr.input(() => {
    lernrate = Number(ui.lr.value());
  });
  ui.lr.changed(() => ui.lr.elt.blur());

  ui.epText = platziere(createSpan("Epochen"), 1232, 824, 72);
  ui.epochen = platziere(createSelect(), 1304, 824, 70);
  for (const e of [5, 10, 20, 30, 50, 100]) {
    ui.epochen.option(String(e), String(e));
  }
  ui.epochen.selected(String(epochenZiel));
  ui.epochen.changed(() => {
    epochenZiel = parseInt(ui.epochen.value(), 10);
    ui.epochen.elt.blur();
  });

  ui.tempoText = platziere(createSpan("Tempo"), 1390, 824, 56);
  ui.tempo = platziere(createSelect(), 1448, 824, 112);
  for (const t of ["langsam", "mittel", "schnell"]) {
    ui.tempo.option(t, t);
  }
  ui.tempo.selected(tempo);
  ui.tempo.changed(() => {
    tempo = ui.tempo.value();
    ui.tempo.elt.blur();
  });

  ui.abnehmend = platziere(createCheckbox(" Lernrate nimmt beim Training ab", true), 1232, 856, 330);
  ui.abnehmend.changed(() => fokusWeg(ui.abnehmend));

  uiAusNetz();
}

// Bedienelemente an den Zustand des Netzes anpassen (z. B. nach dem Laden)
function uiAusNetz() {
  ui.anzahl.selected(String(netz.n));
  ui.bias.checked(netz.biasAn);
  ui.akt.checked(netz.aktivierungAn);
  ui.aktArt.selected(netz.aktivierung);
}

// --- kleine Helfer, damit das DOM nur bei echten Änderungen angefasst wird ---
function zeige(el, sichtbar) {
  if (el._sichtbar !== sichtbar) {
    if (sichtbar) {
      el.show();
    } else {
      el.hide();
    }
    el._sichtbar = sichtbar;
  }
}

function beschrifte(el, html) {
  if (el._html !== html) {
    el.html(html);
    el._html = html;
  }
}

function sperre(el, gesperrt) {
  if (el.elt.disabled !== gesperrt) {
    el.elt.disabled = gesperrt;
  }
}

function klasse(el, name, an) {
  if (an) {
    el.addClass(name);
  } else {
    el.removeClass(name);
  }
}

// wird in jedem Frame aufgerufen
function aktualisiereUi() {
  const training = modus === "training";
  const beschaeftigt = laufTraining || laufTest;

  klasse(ui.modusErkunden, "aktiv", !training);
  klasse(ui.modusTraining, "aktiv", training);

  if (training) {
    beschrifte(ui.aktion, laufTraining ? "■ Training stoppen" : "▶ Training starten");
  } else {
    beschrifte(ui.aktion, laufTest ? "■ Test stoppen" : "▶ Test starten");
  }
  klasse(ui.aktion, "primaer", !beschaeftigt);
  klasse(ui.aktion, "dunkel", beschaeftigt);

  for (const el of [ui.lrText, ui.lr, ui.epText, ui.epochen, ui.tempoText, ui.tempo, ui.abnehmend]) {
    zeige(el, training);
  }
  beschrifte(ui.lrText, "η = " + lernrate.toFixed(2));
  if (laufTraining && Math.abs(Number(ui.lr.value()) - lernrate) > 0.02) {
    ui.lr.value(lernrate);
  }

  zeige(ui.zurueck, training);
  zeige(ui.phasen, training);

  if (phase === "rueck") {
    beschrifte(ui.vor, "Überspringen ▶▶ (→)");
    beschrifte(ui.zurueck, "◀ Nächste Phase (←)");
  } else if (phase === "fertig") {
    beschrifte(ui.vor, SZ.wort.naechst + " ▶ (→)");
    beschrifte(ui.zurueck, "◀ Nochmal zurück (←)");
  } else if (phase === "bereit" || phase === "ausgabe") {
    beschrifte(ui.vor, SZ.wort.naechst + " ▶ (→)");
    beschrifte(ui.zurueck, "◀ Fehlerrückführung (←)");
  } else {
    beschrifte(ui.vor, "Vorwärts ▶ (→)");
    beschrifte(ui.zurueck, "◀ Fehlerrückführung (←)");
  }
  sperre(ui.vor, beschaeftigt);
  sperre(ui.zurueck, beschaeftigt || !["ausgabe", "rueck", "fertig"].includes(phase));

  beschrifte(ui.karte, karteAn ? "Entscheidungskarte ausblenden" : "Entscheidungskarte einblenden");

  for (const id of Object.keys(ui.beispiele)) {
    klasse(ui.beispiele[id], "aktiv", id === szenarioName);
    sperre(ui.beispiele[id], beschaeftigt && id !== szenarioName);
    ui.beispiele[id].attribute("aria-pressed", id === szenarioName ? "true" : "false");
  }

  for (const el of [ui.anzahl, ui.zufall, ui.tutorial, ui.laden, ui.aufteilen, ui.modusErkunden, ui.modusTraining]) {
    sperre(el, beschaeftigt);
  }
}
