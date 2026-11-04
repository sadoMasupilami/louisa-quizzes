// Holt die Bilder aus Fluent Emoji (Microsoft, MIT-Lizenz) nach bilder/fluent/:
//   farbe/<id>.svg     das weiche Farbbild (Fluent „Color“), ids mit dem Bildnamen versehen (keine doppelten ids im HTML)
//   umriss/<id>.svg    zum Ausmalen: aus dem flachen Bild (Fluent „Flat“), alle Flächen weiß, alle Ränder dunkel
//   schatten/<id>.svg  aus dem flachen Bild, alle Flächen dunkel
// Nur einmal nötig oder wenn bilder/katalog.json neue Bilder bekommt:
//   git clone --depth 1 --filter=blob:none --sparse https://github.com/microsoft/fluentui-emoji fluent
//   (cd fluent && git sparse-checkout set --no-cone '/assets/*/Flat/*' '/assets/*/Color/*' '/assets/*/Light/*' '/LICENSE')
//   node werkzeuge/bilder-holen.mjs ./fluent
// Die geholten Dateien werden eingecheckt, der Build braucht das Fluent-Repo danach nicht mehr.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WURZEL = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const quelle = process.argv[2];
if (!quelle || !fs.existsSync(path.join(quelle, 'assets'))) {
  console.error('Aufruf: node werkzeuge/bilder-holen.mjs <ordner des fluentui-emoji-repos>');
  process.exit(2);
}
const katalog = JSON.parse(fs.readFileSync(path.join(WURZEL, 'bilder', 'katalog.json'), 'utf8')).bilder;
const ziel = path.join(WURZEL, 'bilder', 'fluent');
fs.rmSync(ziel, { recursive: true, force: true });
for (const sub of ['farbe', 'umriss', 'schatten']) fs.mkdirSync(path.join(ziel, sub), { recursive: true });

const TINTE = '#1f2340';
const SCHATTEN = '#3b3d4f';

function datei(ordner, ton, art) {
  const name = ordner.toLowerCase().replace(/ /g, '_');
  const f = ton
    ? path.join(quelle, 'assets', ordner, ton, art, name + '_' + art.toLowerCase() + '_' + ton.toLowerCase() + '.svg')
    : path.join(quelle, 'assets', ordner, art, name + '_' + art.toLowerCase() + '.svg');
  if (!fs.existsSync(f)) throw new Error('fehlt: ' + path.relative(quelle, f));
  return fs.readFileSync(f, 'utf8');
}
const saeubere = (s) => s.replace(/<\?xml[^>]*>/g, '').replace(/<!--[\s\S]*?-->/g, '').replace(/>\s+</g, '><').replace(/\s{2,}/g, ' ').trim();
// Feste Größe weg (Größe kommt vom Einbauort), viewBox bleibt
const ohneGroesse = (s) => s.replace(/<svg([^>]*?)\s(?:width|height)="[^"]*"/, '<svg$1').replace(/<svg([^>]*?)\s(?:width|height)="[^"]*"/, '<svg$1');
// ids eindeutig machen: id="x" → id="<bild>-x", ebenso url(#x) und href="#x"
function eindeutig(s, id) {
  const ids = [...s.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  for (const alt of ids) {
    const neu = id + '-' + alt;
    const e = alt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    s = s.replace(new RegExp('id="' + e + '"', 'g'), 'id="' + neu + '"')
      .replace(new RegExp('url\\(#' + e + '\\)', 'g'), 'url(#' + neu + ')')
      .replace(new RegExp('href="#' + e + '"', 'g'), 'href="#' + neu + '"');
  }
  return s;
}
// Aus dem flachen Bild: alle Formen in einer Fläche und einem Rand
function einfarbig(flat, flaeche, rand, breite) {
  let s = flat.replace(/<defs>[\s\S]*?<\/defs>/g, '')
    .replace(/\s(?:fill-opacity|opacity|filter|mask|clip-path)="[^"]*"/g, '')
    .replace(/<svg([^>]*)\sfill="none"/, '<svg$1');
  s = s.replace(/\sfill="(?!none)[^"]*"/g, ' fill="' + flaeche + '"').replace(/\sstroke="(?!none)[^"]*"/g, ' stroke="' + rand + '"');
  // Formen ohne eigene Füllung bekommen die Fläche
  s = s.replace(/<(path|circle|ellipse|rect|polygon)(?![^>]*\sfill=)([^>]*?)(\/?)>/g, '<$1$2 fill="' + flaeche + '"$3>');
  return s.replace(/(<svg[^>]*>)/, '$1<g stroke="' + rand + '" stroke-width="' + breite + '" stroke-linejoin="round" stroke-linecap="round">').replace(/<\/svg>\s*$/, '</g></svg>');
}

let n = 0;
for (const [id, b] of Object.entries(katalog)) {
  if (!b.quelle.startsWith('fluent:')) continue;
  const [ordner, ton] = b.quelle.slice('fluent:'.length).split('@');
  try {
    const farbe = eindeutig(ohneGroesse(saeubere(datei(ordner, ton, 'Color'))), id);
    const flat = ohneGroesse(saeubere(datei(ordner, ton, 'Flat')));
    fs.writeFileSync(path.join(ziel, 'farbe', id + '.svg'), farbe + '\n');
    fs.writeFileSync(path.join(ziel, 'umriss', id + '.svg'), einfarbig(flat, '#fff', TINTE, 0.55) + '\n');
    fs.writeFileSync(path.join(ziel, 'schatten', id + '.svg'), einfarbig(flat, SCHATTEN, SCHATTEN, 0.3) + '\n');
    n++;
  } catch (e) {
    console.error('❌ ' + id + ': ' + e.message);
    process.exitCode = 1;
  }
}
fs.copyFileSync(path.join(quelle, 'LICENSE'), path.join(ziel, 'LICENSE.txt'));
fs.writeFileSync(path.join(ziel, 'HERKUNFT.md'),
  '# Herkunft der Bilder\n\nAlle Dateien in diesem Ordner stammen aus **Fluent Emoji** von Microsoft\n' +
  '(https://github.com/microsoft/fluentui-emoji), Lizenz: **MIT** (LICENSE.txt).\n\n' +
  '- `farbe/`: die Variante „Color“, ids mit dem Bildnamen versehen, Breite und Höhe entfernt.\n' +
  '- `umriss/`: aus der Variante „Flat“ abgeleitet (alle Flächen weiß, alle Ränder dunkel), zum Ausmalen.\n' +
  '- `schatten/`: aus der Variante „Flat“ abgeleitet (alle Flächen dunkel).\n\n' +
  'Erzeugt mit `werkzeuge/bilder-holen.mjs`. Hauttöne: wo es einen gibt, „Light“.\n');
console.log('✅ ' + n + ' Fluent-Bilder nach bilder/fluent/ geholt (Farbe, Umriss, Schatten)');
