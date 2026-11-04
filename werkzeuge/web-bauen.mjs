// Baut die Web-App: web/ + geprüfte Aufgaben (raetsel/) + Bilder → _site/
//   node werkzeuge/web-bauen.mjs
// Prüft dabei alle Aufgaben, setzt die Build-Version in den Cache-Namen des Service Workers
// und bricht ab, wenn eine Datei fremde Adressen lädt.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pruefeAlle } from './pruefe.mjs';
import { bilderDatenJs, WURZEL } from './kern.mjs';

const WEB = path.join(WURZEL, 'web');
const SITE = path.join(WURZEL, '_site');
const fehler = [];

const erg = pruefeAlle();
if (erg.fehler.length) {
  console.log('❌ Aufgaben-Prüfung: ' + erg.fehler.length + ' Fehler');
  for (const f of erg.fehler) console.log('  • ' + f);
  process.exit(1);
}

// Welche Bilder braucht die App? (Bilder aus den Levels, Paket-Bilder, Etiketten, Bilder der Startseite)
const ids = new Set(['einhorn', 'drache', 'fee', 'schere', 'stift', 'zeigefinger', 'augen', 'sprechen']);
for (const p of Object.values(erg.pakete)) {
  ids.add(p.bild);
  for (const l of p.levels) for (const s of l.schritte) for (const r of s.zeige.concat(s.optionen)) {
    if (r.bild) ids.add(r.bild);
    if (r.korb && r.korb.etikett) ids.add(r.korb.etikett);
  }
}

fs.rmSync(SITE, { recursive: true, force: true });
fs.mkdirSync(path.join(SITE, 'kern'), { recursive: true });
fs.mkdirSync(path.join(SITE, 'icons'), { recursive: true });
const kopiere = (rel, ziel) => fs.copyFileSync(path.join(WEB, rel), path.join(SITE, ziel || rel));
for (const d of ['index.html', 'app.css', 'app.js', 'manifest.webmanifest']) kopiere(d);
for (const d of fs.readdirSync(path.join(WEB, 'icons'))) kopiere('icons/' + d);
for (const d of ['bilder.js', 'symbole.js']) kopiere('kern/' + d);
fs.copyFileSync(path.join(WURZEL, 'bilder', 'fluent', 'LICENSE.txt'), path.join(SITE, 'LIZENZ-BILDER.txt'));

const pakete = JSON.stringify(erg.pakete);
const daten = bilderDatenJs([...ids]) + 'window.WERKSTATT_PAKETE = ' + pakete.replace(/</g, '\\u003c') + ';\n';
// Version: Datum + Prüfsumme über alle Dateien, die in den Cache kommen
const summe = crypto.createHash('sha256');
summe.update(daten);
for (const d of ['index.html', 'app.css', 'app.js', 'kern/bilder.js', 'kern/symbole.js']) summe.update(fs.readFileSync(path.join(WEB, d)));
const version = new Date().toISOString().slice(0, 10) + '-' + summe.digest('hex').slice(0, 8);
fs.writeFileSync(path.join(SITE, 'daten.js'), daten + 'window.WERKSTATT_VERSION = ' + JSON.stringify(version) + ';\n');
fs.writeFileSync(path.join(SITE, 'sw.js'), fs.readFileSync(path.join(WEB, 'sw.js'), 'utf8').replace('__VERSION__', version));
fs.writeFileSync(path.join(SITE, '.nojekyll'), '');

// Keine fremden Adressen laden (xmlns-Angaben in SVGs sind keine Anfragen)
const fremd = /(?:src|href)\s*=\s*["']\s*(?:https?:)?\/\/|url\(\s*["']?\s*(?:https?:)?\/\/|fetch\(\s*["'`]\s*https?:|import\s*\(?\s*["'`]\s*https?:|@import/;
for (const d of fs.readdirSync(SITE, { recursive: true })) {
  const f = path.join(SITE, d);
  if (fs.statSync(f).isDirectory() || !/\.(html|js|css|webmanifest|svg)$/.test(d)) continue;
  const m = fs.readFileSync(f, 'utf8').match(fremd);
  if (m) fehler.push(d + ': lädt eine fremde Adresse (' + m[0] + ')');
}
// Jede Datei aus der Cache-Liste des Service Workers muss es geben
const liste = (fs.readFileSync(path.join(SITE, 'sw.js'), 'utf8').match(/const DATEIEN = \[([\s\S]*?)\]/) || [])[1] || '';
for (const d of liste.match(/'[^']+'/g) || []) {
  const n = d.slice(1, -1);
  if (n !== './' && !fs.existsSync(path.join(SITE, n))) fehler.push('sw.js: ' + n + ' fehlt in _site/');
}

if (fehler.length) {
  console.log('❌ ' + fehler.length + ' Fehler:');
  for (const f of fehler) console.log('  • ' + f);
  process.exit(1);
}
const levels = Object.values(erg.pakete).reduce((s, p) => s + p.levels.length, 0);
console.log('✅ _site/ gebaut: ' + Object.keys(erg.pakete).length + ' Pakete, ' + levels + ' Levels, ' + ids.size + ' Bilder, Version ' + version);
