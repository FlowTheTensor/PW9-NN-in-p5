// =============================================================================
//  netz.js – ein kleines neuronales Netz (ohne p5, reines JavaScript)
// =============================================================================
//  Aufbau:  2 Eingaben  →  n versteckte Neuronen  →  1 Ausgabe
//
//  Versteckte Schicht:  z_i = w(x0→h_i)·x0 + w(x1→h_i)·x1 (+ b_i)
//                       h_i = f(z_i)          (f = Aktivierungsfunktion oder einfach z)
//  Ausgabe:             z   = Σ w(h_i→y)·h_i (+ b)
//                       y   = σ(z) = 1 / (1 + e^(−z))     → Wahrscheinlichkeit für "i.O."
//
//  Gelernt wird mit der Fehlerrückführung (Backpropagation) und dem
//  quadratischen Fehler (t − y)².
// =============================================================================

const GEWICHT_GRENZE = 50; // schützt vor "explodierenden" Gewichten bei zu großer Lernrate

class NeuronalesNetz {
  constructor(anzahlVersteckt) {
    this.biasAn = false;
    this.aktivierungAn = false;
    this.aktivierung = "relu"; // "relu" (Leaky-ReLU) oder "tanh"
    this.neuAufbauen(anzahlVersteckt);
  }

  neuAufbauen(anzahlVersteckt) {
    this.n = anzahlVersteckt;
    this.wEin = []; // wEin[i][j]: Eingabe j → verstecktes Neuron i
    this.wAus = []; // wAus[i]:    verstecktes Neuron i → Ausgabe
    this.bVer = []; // Bias der versteckten Neuronen
    this.bAus = 0; // Bias des Ausgabeneurons
    for (let i = 0; i < anzahlVersteckt; i++) {
      this.wEin.push([0, 0]);
      this.wAus.push(0);
      this.bVer.push(0);
    }
    this.zufallsStart();
  }

  zufallsStart() {
    for (let i = 0; i < this.n; i++) {
      this.wEin[i][0] = Math.random() * 2 - 1;
      this.wEin[i][1] = Math.random() * 2 - 1;
      this.wAus[i] = Math.random() * 2 - 1;
      this.bVer[i] = Math.random() * 0.2 - 0.1;
    }
    this.bAus = Math.random() * 0.2 - 0.1;
  }

  // ganz einfaches Startnetz für die Einführung
  tutorialStart() {
    this.neuAufbauen(1);
    this.wEin[0] = [1, 1];
    this.wAus[0] = 1;
    this.bVer[0] = 0;
    this.bAus = 0;
  }

  // ---------------------------------------------------------------------------
  // Aktivierungsfunktionen
  // ---------------------------------------------------------------------------
  f(z) {
    if (!this.aktivierungAn) {
      return z;
    }
    if (this.aktivierung === "tanh") {
      return Math.tanh(z);
    }
    return z > 0 ? z : 0.1 * z; // Leaky-ReLU
  }

  // Ableitung (Steigung) der Aktivierungsfunktion an der Stelle z
  fStrich(z) {
    if (!this.aktivierungAn) {
      return 1;
    }
    if (this.aktivierung === "tanh") {
      const th = Math.tanh(z);
      return 1 - th * th;
    }
    return z > 0 ? 1 : 0.1;
  }

  static sigmoid(z) {
    const zz = Math.max(-40, Math.min(40, z));
    return 1 / (1 + Math.exp(-zz));
  }

  // ---------------------------------------------------------------------------
  // Vorwärtsrechnung: liefert alle Zwischenwerte (für die Anzeige)
  // ---------------------------------------------------------------------------
  vorwaerts(x0, x1) {
    const z = [];
    const h = [];
    let zAus = this.biasAn ? this.bAus : 0;
    for (let i = 0; i < this.n; i++) {
      const zi = (this.biasAn ? this.bVer[i] : 0) + this.wEin[i][0] * x0 + this.wEin[i][1] * x1;
      z.push(zi);
      h.push(this.f(zi));
      zAus += this.wAus[i] * h[i];
    }
    return { x: [x0, x1], z, h, zAus, y: NeuronalesNetz.sigmoid(zAus) };
  }

  // schnelle Variante, nur die Ausgabe (für die Entscheidungskarte)
  ausgabe(x0, x1) {
    let zAus = this.biasAn ? this.bAus : 0;
    for (let i = 0; i < this.n; i++) {
      const zi = (this.biasAn ? this.bVer[i] : 0) + this.wEin[i][0] * x0 + this.wEin[i][1] * x1;
      zAus += this.wAus[i] * this.f(zi);
    }
    return NeuronalesNetz.sigmoid(zAus);
  }

  // ---------------------------------------------------------------------------
  // Fehlerrückführung: berechnet alle Änderungen für EIN Beispiel.
  // Die Gewichte werden hier noch NICHT verändert (siehe anwenden()).
  // ---------------------------------------------------------------------------
  rueckfuehrung(vw, t, lernrate) {
    const y = vw.y;
    const e = t - y; // Fehler
    const steigungAus = y * (1 - y); // Ableitung der Sigmoid-Funktion
    const deltaAus = 2 * e * steigungAus; // Fehlersignal am Ausgang

    const r = {
      lernrate,
      t,
      e,
      steigungAus,
      deltaAus,
      dAus: [], // Änderung der Gewichte versteckt → Ausgabe
      fStrich: [], // Steigung der Aktivierungsfunktion je verstecktem Neuron
      deltaVer: [], // Fehlersignal je verstecktem Neuron
      dEin: [], // Änderung der Gewichte Eingabe → versteckt: dEin[i][j]
      dBVer: [],
      dBAus: this.biasAn ? lernrate * deltaAus : 0,
    };

    for (let i = 0; i < this.n; i++) {
      r.dAus.push(lernrate * deltaAus * vw.h[i]);
      r.fStrich.push(this.fStrich(vw.z[i]));
      // wichtig: das ALTE Gewicht zur Ausgabe verwenden
      r.deltaVer.push(deltaAus * this.wAus[i] * r.fStrich[i]);
      r.dEin.push([
        lernrate * r.deltaVer[i] * vw.x[0],
        lernrate * r.deltaVer[i] * vw.x[1],
      ]);
      r.dBVer.push(this.biasAn ? lernrate * r.deltaVer[i] : 0);
    }
    return r;
  }

  anwenden(r) {
    const begrenzen = (w) => Math.max(-GEWICHT_GRENZE, Math.min(GEWICHT_GRENZE, w));
    for (let i = 0; i < this.n; i++) {
      this.wAus[i] = begrenzen(this.wAus[i] + r.dAus[i]);
      this.wEin[i][0] = begrenzen(this.wEin[i][0] + r.dEin[i][0]);
      this.wEin[i][1] = begrenzen(this.wEin[i][1] + r.dEin[i][1]);
      this.bVer[i] = begrenzen(this.bVer[i] + r.dBVer[i]);
    }
    this.bAus = begrenzen(this.bAus + r.dBAus);
  }

  // ein kompletter Lernschritt für ein Beispiel
  lerneBeispiel(x0, x1, t, lernrate) {
    const vw = this.vorwaerts(x0, x1);
    const r = this.rueckfuehrung(vw, t, lernrate);
    this.anwenden(r);
    return r;
  }

  // Anteil falsch erkannter Beispiele (0 … 1)
  fehlerquote(liste) {
    if (liste.length === 0) {
      return 0;
    }
    let falsch = 0;
    for (const b of liste) {
      const vorhersage = this.ausgabe(b.x, b.y) >= 0.5 ? 1 : 0;
      if (vorhersage !== b.label) {
        falsch++;
      }
    }
    return falsch / liste.length;
  }

  // Kopie aller Gewichte (für die Anzeige vorher/nachher)
  schnappschuss() {
    return {
      wEin: this.wEin.map((w) => w.slice()),
      wAus: this.wAus.slice(),
      bVer: this.bVer.slice(),
      bAus: this.bAus,
    };
  }

  // ---------------------------------------------------------------------------
  // Speichern / Laden
  // ---------------------------------------------------------------------------
  alsJSON() {
    return {
      format: "pw9-netz-1",
      anzahlVersteckt: this.n,
      wEin: this.wEin,
      wAus: this.wAus,
      bVer: this.bVer,
      bAus: this.bAus,
      biasAn: this.biasAn,
      aktivierungAn: this.aktivierungAn,
      aktivierung: this.aktivierung,
    };
  }

  ausJSON(d) {
    const n = d.anzahlVersteckt;
    if (!Number.isInteger(n) || n < 1 || n > 10 || !Array.isArray(d.wEin) || d.wEin.length !== n ||
        !Array.isArray(d.wAus) || d.wAus.length !== n) {
      throw new Error("Die Datei enthält kein gültiges Netz.");
    }
    this.n = n;
    this.wEin = d.wEin.map((w) => [Number(w[0]), Number(w[1])]);
    this.wAus = d.wAus.map(Number);
    this.bVer = Array.isArray(d.bVer) && d.bVer.length === n ? d.bVer.map(Number) : new Array(n).fill(0);
    this.bAus = Number(d.bAus) || 0;
    this.biasAn = !!d.biasAn;
    this.aktivierungAn = !!d.aktivierungAn;
    this.aktivierung = d.aktivierung === "tanh" ? "tanh" : "relu";
  }
}
