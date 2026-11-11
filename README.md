# KI-Qualitätsprüfung · Spritzguss

Ein kleines neuronales Netz zum Zuschauen und Ausprobieren: Es lernt, Gutteile (**i.O.**) von Ausschuss (**n.i.O.**) zu unterscheiden – nur anhand von zwei Prozesswerten einer Spritzgießmaschine. Vorwärtsrechnung und Fehlerrückführung (Backpropagation) lassen sich Schritt für Schritt verfolgen, mit allen Zahlen und Formeln.

Erstellt für den Unterricht an der Jakob-Preh-Schule ([bsnes.de](https://www.bsnes.de)).

**Live-Version:** [Hier direkt anschauen](https://flowthetensor.github.io/PW9-NN-in-p5/)

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

## Weitere Beispiele (Auswahlliste über dem Diagramm)

Neben der Spritzgießmaschine gibt es Beispiele aus der Elektronik und Mechatronik, angelehnt an die Stationen einer Industrie-4.0-Modellanlage. Alle Daten sind simuliert. Jedes Beispiel hat 110 Messungen, darunter wenige Grenzfälle.

| Beispiel | Merkmal 1 | Merkmal 2 | n.i.O., wenn … | Form des Gut-Bereichs |
|---|---|---|---|---|
| **Spritzgießmaschine** · Qualitätsprüfung | Werkzeugtemperatur 180 … 260 °C | Einspritzdruck 600 … 1400 bar | zu kalt (< 205 °C), zu heiß (> 242 °C), zu wenig Druck (< 880 bar) | Rechteck, nach oben offen (3 Seiten) |
| **Förderband-Antrieb** · Zustandsüberwachung | Motorstrom 0 … 1,6 A | Schwingstärke am Motorlager 0 … 10 mm/s | Strom < 0,2 A (Kontakt/Sicherung), Strom > 1,05 A (Überlast/blockiert), Schwingung > 4,5 mm/s (Lagerschaden) | Rechteck, nach unten offen (3 Seiten) |
| **Pneumatikzylinder** · Fehlerdiagnose | Ausfahrzeit 150 … 650 ms | Luftverbrauch je Hub 0,05 … 0,55 Nl | zu schnell (< 240 ms), zu langsam (> 420 ms), Leckage (> 0,34 Nl), Hub unvollständig (< 0,16 Nl) | geschlossenes Rechteck (4 Seiten) |
| **Reflow-Lötofen** · Lötstellenprüfung | Spitzentemperatur 220 … 270 °C | Zeit über Liquidus (217 °C) 20 … 120 s | kalte Lötstelle (< 235 °C), schlechte Benetzung (< 40 s), spröde (> 100 s), zu viel Wärme ((T − 217 °C) · t > 2100 °C·s) | 3 gerade Seiten und eine gebogene |
| **Handhabung** · Ablagegenauigkeit Greifer | Ablageabweichung Δx −1,5 … +1,5 mm | Ablageabweichung Δy −1,5 … +1,5 mm | Abstand zur Sollposition > 0,8 mm | Kreis |

**Ideen für den Unterricht**

- Je mehr Seiten der Gut-Bereich hat, desto mehr versteckte Neuronen braucht das Netz. Mit ReLU zieht jedes versteckte Neuron ungefähr eine gerade Kante. Wie viele Neuronen braucht der Kreis beim Greifer mindestens?
- Ohne Aktivierungsfunktion kann das Netz nur eine gerade Grenze ziehen. Bei keinem der Beispiele reicht das.
- Die Entscheidungskarte zeigt, welchen Bereich das Netz gelernt hat. Ein Vergleich mit der Tabelle oben zeigt, wo das Netz noch danebenliegt.

Ein Beispiel lässt sich auch direkt über die Adresse öffnen, z. B. `index.html?szenario=greifer` (`spritzguss`, `foerderband`, `pneumatik`, `reflow`, `greifer`). Beim Speichern merkt sich das Netz das Beispiel, beim Laden wird es wieder ausgewählt. Neue Beispiele lassen sich in [daten.js](daten.js) als weiterer Eintrag in `SZENARIEN` ergänzen.

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

Die Änderungen erscheinen direkt an den Verbindungen (▲ größer / ▼ kleiner), die Rechnung mit den echten Zahlen steht im Erklärfeld. Mit „Phasen einzeln“ wartet jede Phase auf ←. Woher die Formeln kommen, steht unten unter [Herleitung der Fehlerrückführung](#herleitung-der-fehlerrückführung).

**Einstellungen:** Anzahl versteckter Neuronen, Bias, Aktivierungsfunktion (Leaky-ReLU oder tanh), Lernrate η, Epochen, Tempo, abnehmende Lernrate. Netze lassen sich als JSON speichern und wieder laden.

## Herleitung der Fehlerrückführung

### Bezeichnungen

| Zeichen | Bedeutung |
|---|---|
| $x_j$ | Eingabewerte (normierte Temperatur und normierter Druck) |
| $w_{ij}$ | Gewicht von Eingabe $j$ zum versteckten Neuron $i$ |
| $z_i,\ h_i = f(z_i)$ | Summe und Ausgabe des versteckten Neurons $i$ ($f$ = Aktivierungsfunktion, ohne Aktivierung gilt $h_i = z_i$) |
| $v_i$ | Gewicht vom versteckten Neuron $i$ zum Ausgang (im Programm als w(h*i*→y) angezeigt) |
| $z,\ y = \sigma(z)$ | Summe und Ausgabe des Ausgabeneurons |
| $t$ | Soll-Wert aus der Qualitätsprüfung: 1 = i.O., 0 = n.i.O. |
| $\eta$ | Lernrate |

Vorwärtsrechnung:

$$z_i = \sum_j w_{ij}\,x_j + b_i \qquad h_i = f(z_i) \qquad z = \sum_i v_i\,h_i + b \qquad y = \sigma(z) = \frac{1}{1 + e^{-z}}$$

### Fehlerfunktion: der quadratische Fehler

Gelernt wird nach jedem einzelnen Teil. Gemessen wird der Fehler dabei mit dem **quadratischen Fehler** dieses einen Teils:

$$L = (t - y)^2$$

Ziel: alle Gewichte so verändern, dass $L$ kleiner wird. Dafür braucht man die Ableitung von $L$ nach jedem Gewicht (Gradientenabstieg):

$$w_\text{neu} = w - \eta \cdot \frac{\partial L}{\partial w}$$

### Schritt 1: Fehlersignal am Ausgang

Ableitung des quadratischen Fehlers nach der Ausgabe $y$ (Kettenregel, die innere Ableitung von $t - y$ ist $-1$):

$$\frac{\partial L}{\partial y} = 2(t - y)\cdot(-1) = -2(t - y)$$

Ableitung der Sigmoid-Funktion:

$$\frac{\partial y}{\partial z} = \sigma(z)\,\bigl(1 - \sigma(z)\bigr) = y\,(1 - y)$$

Zusammengesetzt mit der Kettenregel:

$$\frac{\partial L}{\partial z} = \frac{\partial L}{\partial y}\cdot\frac{\partial y}{\partial z} = -2(t - y)\cdot y\,(1 - y)$$

Das **Fehlersignal** $\delta$ ist im Programm als *negativer* Gradient definiert – also die Richtung, in die sich $z$ ändern soll, damit der Fehler kleiner wird:

$$\boxed{\delta = -\frac{\partial L}{\partial z} = 2\,(t - y)\cdot y\,(1 - y)}$$

Die **2** kommt also direkt aus der Ableitung des Quadrats.

### Schritt 2: Gewichte zum Ausgang

Wegen $z = \sum_i v_i\,h_i + b$ gilt $\dfrac{\partial z}{\partial v_i} = h_i$, also:

$$\frac{\partial L}{\partial v_i} = \frac{\partial L}{\partial z}\cdot h_i = -\delta \cdot h_i$$

Eingesetzt in den Gradientenabstieg wird aus dem Minus ein Plus:

$$\boxed{v_i^\text{neu} = v_i + \eta\cdot\delta\cdot h_i} \qquad \text{also} \qquad \Delta v_i = \eta\cdot\delta\cdot h_i$$

### Schritt 3: Fehlersignal der versteckten Neuronen

Das versteckte Neuron $i$ beeinflusst den Fehler über $h_i$ und das Gewicht $v_i$:

$$\frac{\partial L}{\partial z_i} = \frac{\partial L}{\partial z}\cdot\frac{\partial z}{\partial h_i}\cdot\frac{\partial h_i}{\partial z_i} = -\delta\cdot v_i\cdot f'(z_i)$$

$$\boxed{\delta_i = \delta\cdot v_i\cdot f'(z_i)}$$

Wichtig: Hier wird das **alte** Gewicht $v_i$ verwendet – also der Wert, mit dem die Vorwärtsrechnung gemacht wurde, nicht der schon angepasste. Ohne Aktivierungsfunktion ist $f'(z_i) = 1$. Die Ableitungen der Aktivierungsfunktionen:

| Funktion | $f(z)$ | $f'(z)$ |
|---|---|---|
| Leaky-ReLU | $z$ für $z > 0$, sonst $0{,}1\,z$ | $1$ für $z > 0$, sonst $0{,}1$ |
| tanh | $\tanh(z)$ | $1 - \tanh^2(z)$ |

### Schritt 4: Gewichte von der Eingabe

Genau wie in Schritt 2, mit $\dfrac{\partial z_i}{\partial w_{ij}} = x_j$:

$$\boxed{\Delta w_{ij} = \eta\cdot\delta_i\cdot x_j}$$

Ist ein Eingabewert $x_j$ nahe 0, ändert sich sein Gewicht kaum.

### Schritt 5: Biases

Ein Bias verhält sich wie ein Gewicht, dessen Eingang immer 1 ist:

$$\Delta b = \eta\cdot\delta \qquad \Delta b_i = \eta\cdot\delta_i$$

### Anmerkungen

- **Quadratischer Fehler, nicht MSE:** Der *mittlere* quadratische Fehler (MSE) über $N$ Teile wäre $\frac{1}{N}\sum (t - y)^2$, seine Ableitung hätte den Faktor $\frac{2}{N}$. Weil das Programm nach jedem einzelnen Teil lernt (stochastischer Gradientenabstieg), wird hier der quadratische Fehler eines Teils verwendet.
- **Variante mit ½:** In vielen Lehrbüchern steht $L = \frac{1}{2}(t - y)^2$. Dann kürzt sich die 2 weg, und es bleibt $\delta = (t - y)\,y\,(1 - y)$. Inhaltlich ändert das nichts – der Faktor 2 wirkt nur wie eine doppelt so große Lernrate.
- **Kreuzentropie als Alternative:** Für Klassifikation nimmt man in der Praxis meist die Kreuzentropie $L = -\bigl[t\ln y + (1 - t)\ln(1 - y)\bigr]$. Dort kürzt sich die Sigmoid-Ableitung heraus, und es bleibt $\delta = t - y$. Vorteil: Das Netz lernt auch dann zügig, wenn es sehr sicher falsch liegt ($y$ nahe 0 oder 1). Beim quadratischen Fehler wird $y(1 - y)$ dort sehr klein und das Lernen stockt. Für die Einführung ist der quadratische Fehler anschaulicher.

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
