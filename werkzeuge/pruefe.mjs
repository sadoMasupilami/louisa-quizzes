// Prüft alle Aufgaben (raetsel/eN.json) und die Bilder-Sammlung, rechnet Lösungen aus und baut die Levels
// für die Web-App. Dieselben Daten gehen an die Blätter (build.mjs) und an die App (web-bauen.mjs).
//
//   node werkzeuge/pruefe.mjs            nur prüfen
//   node werkzeuge/pruefe.mjs --bericht  dazu jede Aufgabe mit Lösung ausgeben
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { kern, WURZEL } from './kern.mjs';

const MERKMAL_WERTE = {
  art: ['tier', 'wesen', 'essen', 'pflanze', 'ding', 'form', 'symbol'],
  farbe: [null, 'rot', 'blau', 'gelb', 'gruen', 'orange', 'braun', 'grau', 'rosa', 'weiss', 'lila', 'schwarz'],
  bewegt: [null, 'schwimmt', 'fliegt', 'laeuft']
};

export function pruefeBilder() {
  const { Bilder } = kern();
  const fehler = [];
  for (const id of Bilder.alle()) {
    const m = Bilder.merkmale(id);
    for (const [k, werte] of Object.entries(MERKMAL_WERTE)) {
      if (!werte.includes(m[k])) fehler.push('bilder/katalog.json: ' + id + ': ' + k + ' = ' + JSON.stringify(m[k]) + ' ist nicht erlaubt');
    }
    for (const z of m.frisst.concat(m.gehoert)) if (!Bilder.gibt(z)) fehler.push('bilder/katalog.json: ' + id + ' verweist auf unbekanntes Bild ' + z);
    try { Bilder.svg(id); Bilder.svg(id, { stil: 'umriss' }); } catch (e) { fehler.push('Bild ' + id + ': ' + e.message); }
  }
  return fehler;
}

export function pruefeAlle(ordner) {
  ordner = ordner || path.join(WURZEL, 'raetsel');
  const { Aufgaben, Bilder } = kern();
  const fehler = pruefeBilder();
  const einheiten = {};
  const pakete = {};
  const dateien = fs.readdirSync(ordner).filter((d) => /^e\d+\.json$/.test(d)).sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)));
  for (const d of dateien) {
    let e;
    try { e = JSON.parse(fs.readFileSync(path.join(ordner, d), 'utf8')); } catch (err) { fehler.push(d + ': kein gültiges JSON (' + err.message + ')'); continue; }
    const key = 'e' + e.einheit;
    if (d !== key + '.json') fehler.push(d + ': "einheit" passt nicht zum Dateinamen');
    if (!e.titel) fehler.push(d + ': titel fehlt');
    if (e.bild && !Bilder.gibt(e.bild)) fehler.push(d + ': unbekanntes Bild ' + e.bild);
    const aufgaben = {};
    for (const [id, a] of Object.entries(e.aufgaben || {})) {
      const erg = Aufgaben.pruefe(a);
      for (const f of erg.fehler) fehler.push(d + ' → ' + id + ' (' + a.art + '): ' + f);
      aufgaben[id] = { ...a, loesung: erg.loesung, grund: erg.grund };
    }
    einheiten[key] = { einheit: e.einheit, titel: e.titel, bild: e.bild, aufgaben };
    if (e.web) {
      const levels = [];
      for (const id of e.web.levels || []) {
        const a = e.aufgaben[id];
        if (!a) { fehler.push(d + ' → web: unbekannte Aufgabe ' + id); continue; }
        if (Aufgaben.NUR_PAPIER.includes(a.art)) { fehler.push(d + ' → web: ' + id + ' (' + a.art + ') gibt es nur am Papier'); continue; }
        try { levels.push({ id, satz: a.satz, schritte: Aufgaben.schritte(a) }); } catch (err) { /* Fehler steht schon oben */ }
      }
      if (levels.length < 3 || levels.length > 7) fehler.push(d + ' → web: ' + levels.length + ' Levels, erlaubt sind 3 bis 7 (ein Paket ist kurz)');
      for (const l of levels) {
        for (const s of l.schritte) if (s.optionen.length > 4) fehler.push(d + ' → web ' + l.id + ': höchstens 4 Antworten auf einmal');
      }
      pakete[key] = { paket: key, einheit: e.einheit, titel: e.titel, bild: e.web.bild || e.bild, levels };
    }
  }
  return { fehler, einheiten, pakete };
}

const direkt = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (direkt) {
  const erg = pruefeAlle(process.argv.includes('--raetsel') ? process.argv[process.argv.indexOf('--raetsel') + 1] : null);
  if (process.argv.includes('--bericht')) {
    const { Bilder } = kern();
    const n = (id) => (Bilder.merkmale(id) || { name: id }).name;
    for (const [k, e] of Object.entries(erg.einheiten)) {
      console.log('\n## Einheit ' + e.einheit + ': ' + e.titel);
      for (const [id, a] of Object.entries(e.aufgaben)) {
        let l = JSON.stringify(a.loesung);
        if (a.art === 'passtnicht') l = n(a.dinge[a.loesung]) + ' (' + (a.grund || []).map((g) => g.merkmal + ': die anderen ' + g.wert).join(', ') + ')';
        if (a.art === 'sortieren') l = Object.entries(a.loesung || {}).map(([d, i]) => n(d) + '→Korb ' + (i + 1)).join(', ');
        console.log('  ' + id.padEnd(22) + a.art.padEnd(16) + l);
      }
      if (erg.pakete[k]) console.log('  Web-Paket: ' + erg.pakete[k].levels.length + ' Levels, ' + erg.pakete[k].levels.reduce((s, x) => s + x.schritte.length, 0) + ' Schritte');
    }
  }
  if (erg.fehler.length) {
    console.log('\n❌ ' + erg.fehler.length + ' Fehler:');
    for (const f of erg.fehler) console.log('  • ' + f);
    process.exit(1);
  }
  console.log('\n✅ ' + Object.values(erg.einheiten).reduce((s, e) => s + Object.keys(e.aufgaben).length, 0) + ' Aufgaben geprüft, ' + Object.keys(erg.pakete).length + ' Web-Pakete');
}
