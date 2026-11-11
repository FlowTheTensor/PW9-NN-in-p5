# KI-Qualitätsprüfung · Spritzguss

Ein kleines neuronales Netz zum Zuschauen und Ausprobieren: Es lernt, Gutteile (**i.O.**) von Ausschuss (**n.i.O.**) zu unterscheiden – nur anhand von zwei Prozesswerten einer Spritzgießmaschine. Vorwärtsrechnung und Fehlerrückführung (Backpropagation) lassen sich Schritt für Schritt verfolgen, mit allen Zahlen und Formeln.

Erstellt für den Unterricht an der Jakob-Preh-Schule ([bsnes.de](https://www.bsnes.de)).

**Live-Version:** `https://<benutzername>.github.io/<repository>/`

---

## Worum geht es?

Bei jedem Bauteil werden zwei Werte gemessen:

| Merkmal | Bereich |
|---|---|
| Werkzeugtemperatur | 180 … 260 °C |
| Einspritzdruck | 600 … 1400 bar |

Gutteile entstehen nur in einem bestimmten **Prozessfenster**. Außerhalb davon gibt es Ausschuss: unvollständig gefüllt (zu kalt), Schlieren/Verbrennung (zu heiß) oder Einfallstellen (zu wenig Druck). Das Netz kennt diese Regel **nicht** – es soll sie aus 110 Beispielteilen lernen. Ein paar Grenzfälle sind wie bei echten Messungen nicht eindeutig.

Das Netz:

```
2 Eingaben (Temperatur, Druck)  →  1–10 versteckte Neuronen  →  1 Ausgabe
```

Die Ausgabe ist die Wahrscheinlichkeit, dass das Teil i.O. ist (Sigmoid-Funktion, Schwelle 0,5).

## Bedienung

| Aktion | Wirkung |
|---|---|
| **→** oder „Vorwärts“ | nächstes Teil holen bzw. nächster Schritt der Vorwärtsrechnung |
| **←** oder „Fehlerrückführung“ | Backpropagation Phase für Phase (nur im Trainingsmodus) |
| Klick ins Diagramm | eigenes Teil mit diesen Prozesswerten prüfen |
| Maus über einem Punkt | Teilenummer, Messwerte und Prüfergebnis |
| Maus über einem Neuron | Gewichte anzeigen (bei mehr als 4 versteckten Neuronen) |

**Modi**

- **Erkunden & Testen:** Teile aus den Testdaten Schritt für Schritt durch das Netz schicken oder mit „Test starten“ alle Testteile auf einmal prüfen.
- **Training:** Teile aus den Trainingsdaten durchrechnen und die Fehlerrückführung ansehen – oder das automatische Training starten.

**Fehlerrückführung in Phasen**

1. Fehlersignal am Ausgang: δ = 2·(t − y)·y·(1 − y)
2. Gewichte versteckt → Ausgang: Δw = η · δ · h
3. Fehlersignal der versteckten Neuronen: δ_h = δ · w(alt) · f'(z)
4. Gewichte Eingabe → versteckt: Δw = η · δ_h · x
5. Biases (falls eingeschaltet): Δb = η · δ
6. Dasselbe Teil neu vorwärts rechnen: Fehler vorher → nachher

Die Änderungen erscheinen direkt an den Verbindungen (▲ größer / ▼ kleiner), die Rechnung mit den echten Zahlen steht im Erklärfeld. Mit „Phasen einzeln“ wartet jede Phase auf ←.

**Einstellungen:** Anzahl versteckter Neuronen, Bias, Aktivierungsfunktion (Leaky-ReLU oder tanh), Lernrate η, Epochen, Tempo, abnehmende Lernrate. Netze lassen sich als JSON speichern und wieder laden.

## Ideen für den Unterricht

- **Ohne Aktivierungsfunktion trainieren:** Das Netz kann nur eine gerade Grenze ziehen und bleibt bei etwa 30 % Fehlern. Warum reicht das für ein Prozessfenster mit drei Seiten nicht?
- **Bias und Aktivierung einschalten:** Mit 3–4 versteckten Neuronen sinkt die Fehlerquote auf etwa 3–10 %. Die Entscheidungskarte zeigt das gelernte Prozessfenster.
- **Anzahl der Neuronen variieren:** Was ändert sich mit 1, 2, 4 oder 10 Neuronen?
- **Lernrate verändern:** Was passiert bei sehr kleiner oder sehr großer Lernrate? (Lernkurve beobachten)
- **Training vs. Test:** Warum wird mit Teilen getestet, die das Netz beim Training nie gesehen hat?
- **Zufall:** Manchmal bleibt ein Training schlecht – mit „Zufallswerte“ neu starten und vergleichen.
- **Tutorial-Netz:** 1 Neuron, alle Gewichte 1 – gut, um die Rechnung einmal von Hand nachzuvollziehen.

## Dateien

| Datei | Inhalt |
|---|---|
| `index.html` | Seite, bindet Schriften, p5.js und die Skripte ein |
| `style.css` | Gestaltung im Corporate Design der Schule |
| `daten.js` | Beispieldaten (Prozessfenster, Normierung) |
| `netz.js` | das neuronale Netz – reines JavaScript, ohne p5 |
| `ui.js` | Knöpfe, Auswahllisten, Regler |
| `sketch.js` | Ablauf, Zeichnen, Erklärtexte |
| `assets/logo-jps.png` | Logo der Jakob-Preh-Schule |
| `libraries/p5.min.js` | p5.js (lokal, damit die Seite auch offline läuft) |

## Lokal starten

Die Seite braucht einen kleinen Webserver, ein Doppelklick auf `index.html` reicht nicht in jedem Browser. Am einfachsten in VS Code mit der Erweiterung **Live Server**: Rechtsklick auf `index.html` → „Open with Live Server“.

## Technische Hinweise

- Läuft mit **p5.js 1.x** (lokal mitgeliefert: 1.10) und **p5.js 2.x**. Dafür verzichtet der Code bewusst auf Funktionen, die sich zwischen den Versionen geändert haben (z. B. `preload`, `loadFont`, `bezierVertex`).
- Die Schriften (Quicksand, Inter, JetBrains Mono) kommen von Google Fonts. Ohne Internet weicht die Seite automatisch auf Systemschriften aus.
- Alle Schleifen haben geschweifte Klammern: Der p5-Web-Editor baut in Schleifen eine Endlosschleifen-Sicherung ein, die bei Schleifen ohne Klammern fehlschlägt.
- Fehler in `draw()` werden abgefangen und als Hinweis angezeigt, statt das Programm einzufrieren.
- Der Datensatz wird mit festem Startwert erzeugt und ist deshalb bei jedem Start gleich. Nur die Aufteilung in Trainings- und Testdaten (75 / 35) ist zufällig.
