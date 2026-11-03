// Schau- und Spiel-Werkstatt – baut die PDFs aus src/ und raetsel/
//
//   node build.mjs                 ganzes Buch + Kopiervorlagen + Spickzettel  → out/
//   node build.mjs --nur 03        nur Einheit 03 (Spickzettel, Anleitung, Blätter) → out/teil-03.pdf
//   node build.mjs --nur rahmen    nur die Rahmenseiten (Titel, Sammelpass …)
//   node build.mjs --png           zusätzlich jede Seite als Bild → out/seiten/
//   node build.mjs --dpi 110       Auflösung der Seitenbilder (Standard 70)
//
// Braucht Node 20+, die npm-Pakete (npm install), Google Chrome (oder WERKSTATT_CHROME=/pfad/zu/chrome)
// und poppler (pdfinfo, pdftoppm). Mit Nix holt ./baue.sh Node und poppler.
//
// Datenschutz (AUFTRAG.md Abschnitt 8, Variante B): Der Name des Kindes steht nur in kind.json
// (nicht eingecheckt). In den Quellen steht {{KIND}}; hier wird er eingesetzt.
//
// Bricht ab, wenn eine Aufgabe nicht eindeutig ist, ein Blatt überläuft, auf einem Blatt des Kindes Text steht,
// ein Bild zu klein ist, ein Zeichen in der Schrift fehlt, ein QR-Code nicht lesbar ist oder der Name in den Quellen steht.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { PNG } from 'pngjs';
import opentype from 'opentype.js';
import { pruefeAlle } from './werkzeuge/pruefe.mjs';
import { pruefeNamen, namenAusKind } from './werkzeuge/pruefe-name.mjs';
import { bilderDatenJs, KERN_DATEIEN } from './werkzeuge/kern.mjs';

const WURZEL = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(WURZEL, 'src');
const OUT = path.join(WURZEL, 'out');

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : def;
};
const nur = opt('--nur', null);
const mitPng = args.includes('--png');
const dpi = parseInt(opt('--dpi', '70'), 10);

// ---------------------------------------------------------------------
// Name und Einstellungen
// ---------------------------------------------------------------------
const werkstatt = JSON.parse(fs.readFileSync(path.join(WURZEL, 'werkstatt.json'), 'utf8'));
const kindDatei = path.join(WURZEL, 'kind.json');
if (!fs.existsSync(kindDatei)) {
  console.error('❌ kind.json fehlt. Lege sie an (wird nicht eingecheckt):\n   cp kind.beispiel.json kind.json\n   und trag dort den Vornamen und die Adresse der Web-App ein.');
  process.exit(2);
}
const kind = JSON.parse(fs.readFileSync(kindDatei, 'utf8'));
const KIND = String(kind.KIND || '').trim();
if (!KIND || /[{}<>&"]/.test(KIND)) { console.error('❌ kind.json: "KIND" fehlt oder enthält Sonderzeichen'); process.exit(2); }
const pagesBasis = String(kind.pagesBasis || werkstatt.pagesBasis || '').replace(/\/?$/, '/');
if (!/^https:\/\/[^<>]+\/$/.test(pagesBasis)) { console.error('❌ Adresse der Web-App fehlt: "pagesBasis" in kind.json, z. B. https://<benutzername>.github.io/<repo>/'); process.exit(2); }
const setzeName = (s) => s.replace(/\{\{KIND\}\}/g, KIND);

const alleFehler = [];
alleFehler.push(...pruefeNamen(namenAusKind()));

// ---------------------------------------------------------------------
// Aufgaben prüfen und lösen (dieselben Daten wie die Web-App)
// ---------------------------------------------------------------------
const raetsel = pruefeAlle();
if (raetsel.fehler.length) {
  console.log('\n❌ Aufgaben-Prüfung: ' + raetsel.fehler.length + ' Fehler');
  for (const f of raetsel.fehler) console.log('  • ' + f);
  process.exit(1);
}
console.log('🧩 ' + Object.values(raetsel.einheiten).reduce((s, e) => s + Object.keys(e.aufgaben).length, 0) + ' Aufgaben gelöst und geprüft');

// QR-Codes (Fehlerkorrektur M, Ruhezone 4 Module)
const qr = {};
for (const p of Object.values(raetsel.pakete)) {
  const url = pagesBasis + '#' + p.paket;
  const svg = await QRCode.toString(url, { type: 'svg', errorCorrectionLevel: 'M', margin: 4, color: { dark: '#000000', light: '#ffffff' } });
  qr[p.paket] = { url, svg: svg.replace(/<\?xml[^>]*>\s*/, '') };
}

// ---------------------------------------------------------------------
// HTML zusammenbauen
// ---------------------------------------------------------------------
const buch = JSON.parse(fs.readFileSync(path.join(SRC, 'buch.json'), 'utf8'));
let teile = buch.teile;
if (nur) {
  const muster = nur.split(',');
  teile = teile.filter((t) => muster.some((m) => /^\d+$/.test(m) ? t.startsWith('einheiten/' + m.padStart(2, '0')) : t.includes(m)));
  if (!teile.length) { console.error('Kein Teil passt zu --nur ' + nur); process.exit(2); }
}
const name = nur ? 'teil-' + nur.replace(/[^\w-]+/g, '_') : 'schau-werkstatt';

fs.mkdirSync(OUT, { recursive: true });
const stilDatei = 'styles-' + name + '.css';
fs.writeFileSync(path.join(OUT, stilDatei), setzeName(fs.readFileSync(path.join(SRC, 'styles.css'), 'utf8')).replace(/url\("fonts\//g, 'url("../src/fonts/'));
fs.writeFileSync(path.join(OUT, 'bilder-daten.js'), bilderDatenJs());
const daten = { einheiten: raetsel.einheiten, pakete: raetsel.pakete, qr, kind: KIND, titel: werkstatt.titel, stand: werkstatt.stand, teilBuild: !!nur };
const html =
  '<!doctype html>\n<html lang="de-AT">\n<head>\n<meta charset="utf-8">\n<title>' + KIND + 's ' + werkstatt.titel + '</title>\n' +
  '<link rel="stylesheet" href="' + stilDatei + '">\n' +
  '<script>window.__WERKSTATT = ' + JSON.stringify(daten).replace(/</g, '\\u003c') + ';</script>\n' +
  '<script src="bilder-daten.js"></script>\n' +
  KERN_DATEIEN.map((d) => '<script src="../web/kern/' + d + '"></script>\n').join('') +
  '<script src="../src/components.js"></script>\n</head>\n<body>\n' +
  teile.map((t) => '<!-- ===== ' + t + ' ===== -->\n' + setzeName(fs.readFileSync(path.join(SRC, t), 'utf8'))).join('\n') +
  '\n</body>\n</html>\n';
const htmlDatei = path.join(OUT, name + '.html');
fs.writeFileSync(htmlDatei, html);

const poppler = (prog, a) => execFileSync(prog, a, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const seitenAnzahl = (pdf) => +((poppler('pdfinfo', [pdf]).match(/Pages:\s+(\d+)/) || [])[1] || 0);
function ziele(pdf) {
  // Benannte Sprungziele (Chrome legt sie für verlinkte ids an) → Seitenzahl
  const map = {};
  for (const z of poppler('pdfinfo', ['-dests', pdf]).split('\n')) {
    const m = z.match(/^\s*(\d+)\s+\[.*\]\s+"(.+)"\s*$/);
    if (m) map[m[2]] = +m[1];
  }
  return map;
}
// QR-Codes aus einem Seitenbild lesen (mehrere pro Seite: Bild in Streifen teilen)
function liesQr(pdf, seite, ordner) {
  const bild = path.join(ordner, 's' + seite);
  poppler('pdftoppm', ['-r', '150', '-f', String(seite), '-l', String(seite), '-png', '-singlefile', pdf, bild]);
  const png = PNG.sync.read(fs.readFileSync(bild + '.png'));
  const gefunden = new Set();
  const versuch = (x0, y0, w, h) => {
    const d = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) d.set(png.data.subarray(((y0 + y) * png.width + x0) * 4, ((y0 + y) * png.width + x0 + w) * 4), y * w * 4);
    const r = jsQR(d, w, h);
    if (r) gefunden.add(r.data);
  };
  versuch(0, 0, png.width, png.height);
  const streifen = Math.floor(png.height / 3);
  for (let i = 0; i < 5; i++) versuch(0, Math.min(png.height - streifen, Math.floor(i * streifen / 2)), png.width, streifen);
  return [...gefunden];
}
// Zeichen, die eine Schrift enthält (in allen Schnitten der Familie)
function hatZeichen() {
  const dateien = { Andika: ['Andika-Regular.ttf', 'Andika-Bold.ttf'], Nunito: ['Nunito-Variable.ttf', 'Nunito-Italic-Variable.ttf'] };
  const fonts = Object.fromEntries(Object.entries(dateien).map(([fam, l]) => [fam, l.map((d) => opentype.loadSync(path.join(SRC, 'fonts', d)))]));
  return (fam, c) => fonts[fam] && fonts[fam].every((f) => f.charToGlyphIndex(c) > 0);
}

const chromePfad = process.env.WERKSTATT_CHROME;
const browser = await chromium.launch(chromePfad ? { executablePath: chromePfad } : { channel: 'chrome' });
try {
  const page = await browser.newPage({ viewport: { width: 665, height: 1100 } }); // 176 mm = Satzspiegel der Anleitung
  const konsole = [];
  page.on('console', (m) => { if (m.type() === 'error') konsole.push(m.text()); });
  page.on('pageerror', (e) => konsole.push(e.message));
  // Keine Anfragen ins Netz: nur Dateien aus dem Repo
  await page.route('**/*', (r) => (r.request().url().startsWith('file:') ? r.continue() : (konsole.push('Netzwerk-Anfrage blockiert: ' + r.request().url()), r.abort())));
  await page.emulateMedia({ media: 'print' });
  await page.goto(pathToFileURL(htmlDatei).href);
  await page.waitForFunction(() => window.__fertig === true, null, { timeout: 60000 });
  await page.evaluate(() => document.fonts.ready);

  const erg = await page.evaluate(() => window.__pruefe());
  alleFehler.push(...erg.fehler, ...konsole.map((k) => 'Browser: ' + k));

  // Jedes Zeichen muss in der Schrift sein, mit der es gesetzt ist
  const hat = hatZeichen();
  for (const [fam, zeichen] of Object.entries(erg.zeichen)) {
    if (!['Andika', 'Nunito'].includes(fam)) { alleFehler.push('Text in unbekannter Schrift „' + fam + '“: ' + zeichen.slice(0, 40).join('')); continue; }
    const fehlt = zeichen.filter((c) => !hat(fam, c));
    if (fehlt.length) alleFehler.push('Zeichen fehlen in ' + fam + ': ' + fehlt.map((c) => '„' + c + '“ (U+' + c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0') + ')').join(', '));
  }

  // PDF erzeugen, Seitenzahlen eintragen, bis sie stabil sind
  const pdf = path.join(OUT, name + '.pdf');
  const pdfOpt = { path: pdf, preferCSSPageSize: true, printBackground: true, outline: false, tagged: true };
  await page.pdf(pdfOpt);
  let fehlend = [];
  let stabil = false;
  for (let runde = 0; runde < 4 && !stabil; runde++) {
    const vorher = JSON.stringify(ziele(pdf));
    fehlend = await page.evaluate((m) => window.__setzeSeiten(m), ziele(pdf));
    await page.pdf(pdfOpt);
    stabil = JSON.stringify(ziele(pdf)) === vorher;
  }
  if (!stabil) alleFehler.push('Seitenzahlen werden nicht stabil');
  if (!nur) for (const f of fehlend) alleFehler.push('Seitenzahl für Ziel „' + f + '“ nicht gefunden (fehlt ein Link darauf?)');

  const zielMap = ziele(pdf);
  const gesamt = seitenAnzahl(pdf);
  console.log('\n📄 ' + path.relative(WURZEL, pdf) + ' – ' + gesamt + ' Seiten');

  // Spickzettel: genau eine Seite (vom Spickzettel bis zur Anleitung derselben Einheit)
  let spickSeiten = 0;
  for (const n of await page.evaluate(() => Array.from(document.querySelectorAll('section.spick')).map((s) => s.dataset.einheit))) {
    const von = zielMap['spick-' + n], bis = zielMap['einheit-' + n];
    if (!von || !bis) { if (!nur) alleFehler.push('Spickzettel Einheit ' + n + ': Seitenzahl nicht gefunden'); continue; }
    spickSeiten += bis - von;
    if (bis - von !== 1) alleFehler.push('Spickzettel Einheit ' + n + ': ' + (bis - von) + ' Seiten, soll genau 1 sein – bitte kürzen');
  }
  // Feste Seiten: zwischen zwei aufeinanderfolgenden festen Seiten darf keine Leerseite entstehen
  const festeIds = await page.evaluate(() => Array.from(document.querySelectorAll('.seite[id]')).filter((s) => !s.closest('.loesungsmodus')).map((s) => s.id));
  for (const id of festeIds) if (!zielMap[id] && !nur) alleFehler.push('Seite ' + id + ': kein Sprungziel (Link darauf fehlt)');

  // QR-Codes aus dem gerenderten Seitenbild zurücklesen
  const qrSoll = await page.evaluate(() => Array.from(document.querySelectorAll('.qr[data-url]'))
    .filter((q) => !q.closest('.loesungsmodus')).map((q) => ({ seite: q.closest('[id]') && q.closest('[id]').id, url: q.dataset.url })));
  const qrOrdner = path.join(OUT, '.qr-' + name);
  fs.rmSync(qrOrdner, { recursive: true, force: true });
  fs.mkdirSync(qrOrdner, { recursive: true });
  let qrGelesen = 0;
  const cache = {};
  const lies = (s) => (cache[s] = cache[s] || liesQr(pdf, s, qrOrdner));
  for (const q of qrSoll) {
    const s = zielMap[q.seite];
    // QR in einer fließenden Anleitung: ab der ersten Seite des Abschnitts suchen
    const kandidaten = s ? Array.from({ length: Math.min(8, gesamt - s + 1) }, (_, i) => s + i) : Array.from({ length: gesamt }, (_, i) => i + 1);
    if (kandidaten.some((k) => lies(k).includes(q.url))) qrGelesen++;
    else alleFehler.push('QR-Code ' + q.url + ' (' + q.seite + ') ' + (s ? 'auf Seite ' + s : 'auf keiner Seite') + ' nicht lesbar');
  }

  // Kopiervorlagen (nur die Seiten des Kindes) und Spickzettel
  if (!nur) {
    await page.evaluate(() => document.body.classList.add('vorlagen'));
    const sichtbar = await page.evaluate(() => Array.from(document.querySelectorAll('.seite')).filter((s) => !s.closest('.loesungsmodus') && getComputedStyle(s).display !== 'none').length);
    const vorlagenPdf = path.join(OUT, 'kopiervorlagen.pdf');
    await page.pdf({ ...pdfOpt, path: vorlagenPdf });
    const n = seitenAnzahl(vorlagenPdf);
    console.log('📄 ' + path.relative(WURZEL, vorlagenPdf) + ' – ' + n + ' Seiten');
    if (n !== sichtbar) alleFehler.push('Kopiervorlagen: ' + n + ' PDF-Seiten, aber ' + sichtbar + ' feste Seiten – irgendwo entsteht eine Leerseite');
    await page.evaluate(() => document.body.classList.remove('vorlagen'));

    await page.evaluate(() => document.body.classList.add('spickzettel'));
    const spickPdf = path.join(OUT, 'spickzettel.pdf');
    await page.pdf({ ...pdfOpt, path: spickPdf });
    const ns = seitenAnzahl(spickPdf);
    console.log('📄 ' + path.relative(WURZEL, spickPdf) + ' – ' + ns + ' Seiten');
    if (ns !== spickSeiten) alleFehler.push('spickzettel.pdf: ' + ns + ' Seiten, im Buch sind es ' + spickSeiten);
    await page.evaluate(() => document.body.classList.remove('spickzettel'));
  }

  if (mitPng) {
    const ordner = path.join(OUT, nur ? 'seiten-' + nur.replace(/[^\w-]+/g, '_') : 'seiten');
    fs.rmSync(ordner, { recursive: true, force: true });
    fs.mkdirSync(ordner, { recursive: true });
    poppler('pdftoppm', ['-r', String(dpi), '-png', pdf, path.join(ordner, 's')]);
    console.log('🖼  Seitenbilder: ' + path.relative(WURZEL, ordner) + '/ (' + fs.readdirSync(ordner).length + ' Bilder, ' + dpi + ' dpi)');
  }

  const s = erg.statistik;
  console.log('🔢 Geprüft: ' + s.seiten + ' feste Seiten, davon ' + s.blaetter + ' Blätter, ' + s.aufgaben + ' Aufgaben auf Blättern, ' +
    qrGelesen + '/' + qrSoll.length + ' QR-Codes zurückgelesen, ' + Object.values(erg.zeichen).reduce((a, z) => a + z.length, 0) + ' verschiedene Zeichen');
  if (erg.warnungen.length) {
    console.log('\n⚠️  ' + erg.warnungen.length + ' Warnung(en):');
    for (const w of erg.warnungen) console.log('  • ' + w);
  }
} finally {
  await browser.close();
}
if (alleFehler.length) {
  console.log('\n❌ ' + alleFehler.length + ' Fehler:');
  for (const f of alleFehler) console.log('  • ' + f);
} else {
  console.log('\n✅ Keine Fehler.');
}
process.exit(alleFehler.length ? 1 : 0);
