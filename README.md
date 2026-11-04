# Schau- und Spiel-Werkstatt

Ein druckbarer Guide plus eine kleine Web-App, mit dem ein Elternteil mit seiner jüngeren Tochter (4 Jahre, Kindergarten, Österreich) spielerisch **genau schauen, sortieren, Unterschiede finden und Paare zuordnen** übt: die Vorstufen von Mathematik und Programmieren. Sie ist die kleine Schwester der Denk- und Programmier-Werkstatt der großen Schwester und hat dasselbe Format: Anleitung für Mama oder Papa, Blätter für das Kind, Sammelpass, ein kleiner Bildschirm-Bonus.

**Das Kind kann noch nicht lesen.** Auf den Blättern und in der App steht deshalb kein Text für sie: Aufgaben-Bilder zeigen, was zu tun ist (anmalen, einkreisen, verbinden, ausschneiden, kleben), und Mama oder Papa sagt die Aufgabe. Fast alles läuft mit Bewegung, Kuscheltieren, Malen, Schneiden und Kleben. Die App ist ein kurzer, gemeinsamer Bonus (höchstens 5 Minuten, ohne Ton).

Stand: **Block A (Einheiten 1–5)** ist ausformuliert: Das Einhorn räumt auf (Sortieren), Drachen groß und klein (Größen), Der Kobold schummelt (Was passt nicht?), Schatten-Detektivin (Schatten und Formen), Wer gehört zu wem? (Paare). Dazu 5 Web-Pakete mit 35 Levels und mehreren Spielarten: das Richtige antippen, Körbe, der Reihe nach, Tipp alle an, Suchbild, Paare aufdecken, „Was hat der Kobold weggenommen?“ und Turm bauen. Plan für alle 20 Einheiten: `plan/lehrplan.md`. Auftrag mit allen Wünschen: `AUFTRAG.md`.

## Ergebnis

| Was | Inhalt |
|---|---|
| `out/schau-werkstatt.pdf` | alles: Titel, Inhalt, Einleitung, Hallo-Seite, Sammelpass, je Einheit Spickzettel + Anleitung + Blätter (mit Lösungen), Rückmeldebogen, Gerätetest |
| `out/kopiervorlagen.pdf` | nur die Seiten des Kindes: Titel, Hallo-Seite, Sammelpass, alle Blätter |
| `out/spickzettel.pdf` | eine Seite pro Einheit zum Mitnehmen beim Durchführen |
| Web-App (`web/`, gebaut nach `_site/`) | 5 Pakete für Handy und Tablet, nur Antippen, offline-fähig, über GitHub Pages |

In **Originalgröße (100 %)** drucken. Wo es auf Farbe ankommt, steht „in Farbe drucken“ bei der Vorbereitung der Einheit.

Die PDFs werden **nur lokal** gebaut. Sie sind nicht eingecheckt und kommen nicht auf GitHub Pages, weil sie den Namen des Kindes enthalten.

## Datenschutz: der Name bleibt lokal (Variante B)

Der Vorname des Kindes steht **in keiner Datei im Repo**. In allen Quellen steht `{{KIND}}`. Beim Bauen setzt `build.mjs` den Namen aus `kind.json` ein. Diese Datei ist in `.gitignore`.

```bash
cp kind.beispiel.json kind.json
# in kind.json eintragen: "KIND" (Vorname), "pagesBasis" (Adresse der Web-App, für die QR-Codes),
# optional "SCHWESTER" und "KUSCHELTIER" (werden nur geprüft: sie dürfen nirgends im Repo stehen)
```

Der Build prüft alle Dateien, die ins Repo kämen, und **bricht ab**, wenn einer dieser Namen irgendwo steht (auch in Dateinamen). Einzeln: `node werkzeuge/pruefe-name.mjs`. Der Repo-Name und damit die Pages-Adresse dürfen den Namen enthalten, deshalb steht die Adresse in `kind.json` und nicht in `werkstatt.json`.

Die Web-App enthält keinen Namen, keine Anmeldung, keine Tracker, lädt nichts aus dem Internet nach und hat `noindex`.

## Bauen

Braucht **Node 20+**, **Google Chrome** (oder `WERKSTATT_CHROME=/pfad/zu/chrome`) und **poppler** (`pdfinfo`, `pdftoppm`). Mit Nix holt `./baue.sh` Node und poppler selbst.

```bash
npm install
./baue.sh                            # ganzes Buch + Kopiervorlagen + Spickzettel → out/
./baue.sh --nur 03 --png --dpi 110   # nur Einheit 3, Seitenbilder in out/seiten-03/
./baue.sh --nur rahmen --png         # nur Titel, Einleitung, Sammelpass, Rückmeldebogen, Gerätetest
```

Der Build bricht mit ❌ ab, wenn

- eine Aufgabe nicht eindeutig lösbar ist (zum Beispiel bei „Was passt nicht?“ ein zweites Bild herausfällt, ein Ding in zwei Körbe passt oder zwei Größen zu ähnlich sind),
- auf einem Blatt des Kindes Text steht (erlaubt ist nur der kleine graue Satz für Mama oder Papa),
- ein Bild kleiner als 2,5 cm ist (verkleinerte Bilder in Größen-Aufgaben: 1,2 cm) oder eine Ausschneide-Karte kleiner als 5 cm,
- ein Blatt über die A4-Seite läuft, etwas in den Druckrand ragt oder eine Leerseite entsteht,
- ein Spickzettel länger als eine Seite ist oder seine Minuten nicht zur Anleitung passen,
- ein Pflichtteil einer Anleitung fehlt (Ziel, Wenn nur Zeit für eins ist, Material, Ablauf, Sätze zum Sagen, Stolpersteine, Leichter/Schwerer, Mit der großen Schwester, Bonus-Knobelei, Hintergrund, Bildschirm-Bonus, Lösungen),
- ein Zeichen in der Schrift fehlt, ein QR-Code aus dem Seitenbild nicht gelesen werden kann oder ein Verweis auf ein Blatt ins Leere zeigt,
- ein Name aus `kind.json` in einer Datei des Repos steht.

Warnungen (⚠️, z. B. bundesdeutsche Wörter wie „Treppe“ statt „Stiege“) bitte auch beheben.

## Aufgaben prüfen

Alle Aufgaben stehen in `raetsel/eN.json`. Jedes Bild der Bilder-Sammlung (`bilder/katalog.json`) hat Merkmale (Farbe, Art, schwimmt/fliegt/läuft, frisst, gehört zu), und `web/kern/aufgaben.js` prüft damit jede Aufgabe und rechnet die Lösung aus. Dieselbe Datei verwenden die Blätter (Lösungen) und die App.

```bash
node werkzeuge/pruefe.mjs --bericht   # alle Aufgaben lösen, Lösungen ausgeben
node --test tests/kern.test.mjs       # Tests für den Kern (auch: kaputte Aufgaben werden erkannt)
```

## Web-App bauen und testen

```bash
node werkzeuge/web-bauen.mjs   # web/ + Aufgaben + Bilder → _site/
npx playwright test            # jedes Level auf Handy und Tablet, hoch und quer, durchspielen
```

Die Tests spielen jedes Level einmal durch und probieren dabei jede Spielart auch falsch aus, öffnen jedes Level direkt über die Adresse, prüfen Tippflächen (mindestens 72 px), dass nichts scrollt, dass keine fremden Hosts angefragt werden und die Konsole fehlerfrei bleibt, testen „Für Erwachsene“ und den Offline-Betrieb, und machen Bildschirmfotos (`test-results/bilder/<projekt>/`). Geräte: iPhone 8 (375 · 667) hoch und quer, iPhone SE (320 · 568), Pixel 5, iPad hoch und quer. **WebKit** (die Safari-Engine) läuft mit, wenn es installiert ist (`npx playwright install webkit`, unter Linux zusätzlich `npx playwright install-deps webkit`), sonst nur Chromium.

Zum Ausprobieren: `node tests/server.mjs` und `http://localhost:4173/` öffnen.

## Veröffentlichen (GitHub Pages)

Veröffentlicht wird **nur die Web-App** (`_site/`), nie die PDFs. Das macht `.github/workflows/pages.yml` bei jedem Push auf `main`.

1. Einmalig im Repo auf GitHub: **Settings → Pages → Source: „GitHub Actions“**.
2. Die Adresse ist dann `https://<benutzername>.github.io/<repo-name>/` (Benutzername klein geschrieben).
3. Diese Adresse als `pagesBasis` in `kind.json` eintragen, dann die PDFs neu bauen (die QR-Codes werden daraus gebaut, `<adresse>#e1` usw.).
4. Vor Einheit 1 die **Gerätetest-Checkliste** (letzte Seite im PDF) auf iPhone, iPad und Android abarbeiten.

## Aufbau

```
AUFTRAG.md                       Auftrag mit allen Wünschen und Entscheidungen
plan/lehrplan.md                 Plan für 20 Einheiten, Begriffsliste, Aufgaben-Bilder, Bilder, Regeln
vorlagen/AUTOREN-LEITFADEN.md    wie man eine Einheit schreibt, alle Bausteine, Datenformat
bilder/katalog.json              Bilder-Sammlung mit Merkmalen
bilder/motive.json               Beschreibung jedes Bildes und jeder Szene
bilder/erzeugt/                  Bilder (Farbe, Umriss, Schatten) und Szenen, siehe HERKUNFT.md
raetsel/eN.json                  Aufgaben und Web-Levels pro Einheit (eine Datenquelle für Papier und App)
src/buch.json                    Reihenfolge der Teile im Buch
src/rahmen/                      Titel, Inhalt, Einleitung, Hallo-Seite, Sammelpass, Rückmeldebogen, Gerätetest
src/einheiten/NN-*.html          eine Datei pro Einheit (Spickzettel, Anleitung, Blätter)
src/styles.css, src/components.js  Design, Bausteine, Lösungsansicht, Prüfungen
src/fonts/                       Andika und Nunito (SIL Open Font License)
web/                             Web-App (index.html, app.js, app.css, Service Worker, Manifest, Symbole)
web/kern/                        Bilder, Symbole und Aufgaben-Kern, gemeinsam für App, Blätter und Prüfung
werkzeuge/                       Prüfung, Namens-Prüfung, Web-App bauen, Bilder erzeugen und verarbeiten, mit-nix.sh
tests/                           Tests für den Kern und die Web-App
build.mjs, baue.sh               PDFs bauen
werkstatt.json                   Titel und Stand (ohne Namen, ohne Adresse)
kind.beispiel.json               Vorlage für kind.json (lokal, nie einchecken)
.github/workflows/pages.yml      Web-App auf GitHub Pages veröffentlichen
```

## Lizenzen

Bilder der Tiere und Dinge sowie die Szenen sind eigens für diese Werkstatt erzeugt (`bilder/erzeugt/HERKUNFT.md`). Schriften: Andika und Nunito, SIL Open Font License (`src/fonts/`). Fehler-Kobold, Formen, Socken, Körbe und Aufgaben-Bilder sind selbst gezeichnet.
