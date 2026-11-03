// Holt die Bilder aus dem OpenMoji-Paket (CC BY-SA 4.0) nach bilder/openmoji/ (Farbe und Umriss).
// Nur einmal nötig oder wenn bilder/katalog.json neue OpenMoji-Bilder bekommt:
//   npm pack openmoji && tar xzf openmoji-*.tgz     (ergibt ./package)
//   node werkzeuge/bilder-holen.mjs ./package
// Die geholten Dateien werden eingecheckt, der Build braucht das Paket danach nicht mehr.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WURZEL = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const quelle = process.argv[2];
if (!quelle || !fs.existsSync(path.join(quelle, 'color', 'svg'))) {
  console.error('Aufruf: node werkzeuge/bilder-holen.mjs <ordner des openmoji-pakets>');
  process.exit(2);
}
const katalog = JSON.parse(fs.readFileSync(path.join(WURZEL, 'bilder', 'katalog.json'), 'utf8')).bilder;
const ziel = path.join(WURZEL, 'bilder', 'openmoji');
for (const sub of ['farbe', 'umriss']) fs.mkdirSync(path.join(ziel, sub), { recursive: true });

// Säubern: keine ids (sonst doppelte ids im HTML), keine Kommentare, Leerraum zusammenziehen
const saeubere = (s) => s
  .replace(/<\?xml[^>]*>/g, '').replace(/<!--[\s\S]*?-->/g, '')
  .replace(/\s+id="[^"]*"/g, '')
  .replace(/>\s+</g, '><').replace(/\s{2,}/g, ' ').trim();

let n = 0;
const gebraucht = new Set();
for (const [id, b] of Object.entries(katalog)) {
  if (!b.quelle.startsWith('openmoji:')) continue;
  const hex = b.quelle.slice('openmoji:'.length);
  gebraucht.add(hex + '.svg');
  for (const [sub, set] of [['farbe', 'color'], ['umriss', 'black']]) {
    const f = path.join(quelle, set, 'svg', hex + '.svg');
    if (!fs.existsSync(f)) { console.error('❌ fehlt im OpenMoji-Paket: ' + set + '/' + hex + ' (' + id + ')'); process.exitCode = 1; continue; }
    fs.writeFileSync(path.join(ziel, sub, hex + '.svg'), saeubere(fs.readFileSync(f, 'utf8')) + '\n');
  }
  n++;
}
// Nicht mehr gebrauchte Dateien entfernen
for (const sub of ['farbe', 'umriss']) {
  for (const d of fs.readdirSync(path.join(ziel, sub))) if (!gebraucht.has(d)) fs.rmSync(path.join(ziel, sub, d));
}
fs.copyFileSync(path.join(quelle, 'LICENSE.txt'), path.join(ziel, 'LICENSE.txt'));
const version = JSON.parse(fs.readFileSync(path.join(quelle, 'package.json'), 'utf8')).version;
fs.writeFileSync(path.join(ziel, 'HERKUNFT.md'),
  '# Herkunft der Bilder\n\nAlle Dateien in diesem Ordner stammen aus **OpenMoji ' + version + '** (https://openmoji.org),\n' +
  'dem Open-Source-Emoji-Projekt der HfG Schwäbisch Gmünd. Lizenz: **CC BY-SA 4.0** (LICENSE.txt).\n\n' +
  'Geändert: ids und Leerraum entfernt (werkzeuge/bilder-holen.mjs). Schatten-Bilder werden beim Bauen\n' +
  'daraus abgeleitet (alle Flächen und Linien dunkel, web/kern/bilder.js).\n');
console.log('✅ ' + n + ' OpenMoji-Bilder nach bilder/openmoji/ geholt (Farbe und Umriss)');
