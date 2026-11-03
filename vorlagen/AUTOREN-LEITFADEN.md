# Leitfaden: eine Einheit schreiben

So entsteht eine neue Einheit. Verbindliche Wörter, Bilder und Regeln stehen in `plan/lehrplan.md` (Abschnitt 7).

## 1. Aufgaben anlegen (`raetsel/eN.json`)

Eine Datei pro Einheit. Dieselben Aufgaben gehen an die Blätter und an die Web-App.

```json
{
  "einheit": 6,
  "titel": "Die Muster-Raupe",
  "bild": "schmetterling",
  "aufgaben": {
    "blatt-aufgabe": { "art": "passtnicht", "web": false, "satz": "Was passt nicht?", "dinge": ["…"], "loesung": "…", "merkmal": "farbe" },
    "w-level-1":     { "art": "paare", "satz": "Was frisst der Hase?", "beziehung": "frisst", "zeige": "hase", "optionen": ["karotte", "knochen"] }
  },
  "web": { "levels": ["w-level-1"] }
}
```

- `satz`: der Satz für Mama oder Papa (am Blatt klein und grau, in der App oben). Pflicht für App-Aufgaben.
- `"web": false`: nur am Papier. Diese Aufgaben müssen auf einem Blatt stehen (der Build warnt sonst).
- `web.levels`: 3 bis 7 Levels, höchstens 4 Antworten auf einmal.
- Felder pro Aufgabenart: siehe Kopf von `web/kern/aufgaben.js`. Was „eindeutig“ heißt: `plan/lehrplan.md` Abschnitt 7.6.
- Prüfen: `node werkzeuge/pruefe.mjs --bericht` (löst alles und zeigt die Lösungen).

Neue Bilder: in `bilder/katalog.json` eintragen (mit Merkmalen), dann einmal `node werkzeuge/bilder-holen.mjs <openmoji-paket>`.
Eine neue Aufgabenart: Prüfer und Schritte in `web/kern/aufgaben.js`, Darstellung am Blatt in `src/components.js` (`KOERPER`), Test in `tests/kern.test.mjs`.

## 2. Die Einheit schreiben (`src/einheiten/NN-titel.html`, in `src/buch.json` eintragen)

Drei Teile, in dieser Reihenfolge:

```html
<section class="spick" id="spick-6" data-einheit="6" data-block="B"> … </section>
<section class="anleitung" id="einheit-6" data-einheit="6" data-block="B"> … </section>
<section class="seite blatt" id="blatt-6-1" data-einheit="6" data-block="B">
  <k-kopf></k-kopf>
  <k-aufgabe ref="e6:blatt-aufgabe" tun="einkreisen" mm="34"></k-aufgabe>
  <k-qr paket="e6"></k-qr>
  <k-fuss></k-fuss>
</section>
```

### Pflichtteile der Anleitung (der Build prüft sie)

`.kasten.ziel`, `.kasten.kurz` (Wenn nur Zeit für eins ist), `.kasten.material`, `ol.ablauf` (jeder Schritt mit `data-min`, zusammen 10–20 Minuten), `.sag` (Sätze zum Sagen: `p.du`, `p.sie`, `p.dann`), `.kasten.stolper`, `.kasten.leichter-schwerer`, `.kasten.schwester`, `.kasten.knobelei`, `.kasten.hintergrund`, `.kasten.bildschirm`, `<k-loesungen von="blatt-6-1 …">`.

Der Spickzettel hat **genau eine Seite** und **dieselben Minuten** im Ablauf wie die Anleitung.

### Bausteine

| Baustein | Wofür |
|---|---|
| `<k-kopf>` | Kopf jedes Blatts (Stern, Bild der Einheit, Namenslinie) |
| `<k-aufgabe ref tun [mm] [spalten] [stil] [wachsen] [kompakt] [satz]>` | eine Aufgabe mit Aufgaben-Bild; mehrere refs nebeneinander; `kompakt` = Bild links, ohne Satz |
| `<k-karten ref \| bilder [doppelt] [mischen] [spalten] [mm]>` | Ausschneide-Karten (mindestens 50 mm) |
| `<k-qr paket="eN">` | QR-Code zum Web-Paket |
| `<k-fuss [text]>` | Fußzeile mit Blatt-Nummer |
| `<k-tun name [box]>`, `<k-bild b [stil]>` | Aufgaben-Bild und Bild im Text |
| `<k-bilderleiste bilder mm [stil]>` | Bilder in einer Reihe (z. B. Malbild) |
| `<k-titel [zusatz]>` | Überschrift der Einheit |
| `<k-loesungen von>` | verkleinerte Blätter mit Lösungen |
| `<a class="blattref" href="#blatt-6-1"></a>` | „Blatt 6-1 (S. 23)“ |

### Regeln für die Blätter (der Build prüft sie)

- **Kein Text für das Kind**: Text nur in `.fuer-mich` (klein, grau, für Mama oder Papa).
- Jedes Blatt passt auf genau eine A4-Seite, nichts ragt in den Druckrand (5 mm).
- Bilder mindestens 25 mm (verkleinerte mit `data-klein` mindestens 12 mm), Karten mindestens 50 mm.
- Österreichisches Deutsch (Stiege, Sackerl, Kasten, Polster, Jause …): der Build warnt bei bundesdeutschen Wörtern.

## 3. Bauen und anschauen

```bash
node build.mjs --nur 06 --png --dpi 70     # nur Einheit 6, Seitenbilder in out/seiten-06/
node werkzeuge/web-bauen.mjs && npx playwright test --grep e6
```

Jede Seite als Bild anschauen, bevor die Einheit fertig ist.
