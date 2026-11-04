// Lädt den gemeinsamen Kern (web/kern/*.js) in Node: dieselben Dateien wie in Blättern und Web-App.
//   import { kern, bilderDaten, bilderDatenJs } from './kern.mjs'
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

export const WURZEL = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
export const KERN_DATEIEN = ['bilder.js', 'symbole.js', 'aufgaben.js'];

// Katalog und SVG-Dateien der Bilder-Sammlung (bilder/erzeugt/<stil>/<id>.svg)
export function bilderDaten() {
  const katalog = JSON.parse(fs.readFileSync(path.join(WURZEL, 'bilder', 'katalog.json'), 'utf8')).bilder;
  const svg = {};
  const erzeugt = path.join(WURZEL, 'bilder', 'erzeugt');
  for (const [id, b] of Object.entries(katalog)) {
    if (b.quelle !== 'erzeugt') continue;
    const lies = (sub) => {
      const f = path.join(erzeugt, sub, id + '.svg');
      if (!fs.existsSync(f)) throw new Error('Bild fehlt: bilder/erzeugt/' + sub + '/' + id + '.svg (werkzeuge/bilder-verarbeiten.sh)');
      return fs.readFileSync(f, 'utf8').trim();
    };
    svg[id] = { farbe: lies('farbe'), umriss: lies('umriss'), schatten: lies('schatten') };
  }
  // Szenen fürs Suchbild als data-Adresse: Die App lädt nichts nach
  const szenen = {};
  const szenenOrdner = path.join(erzeugt, 'szenen');
  if (fs.existsSync(szenenOrdner)) {
    for (const d of fs.readdirSync(szenenOrdner).filter((x) => x.endsWith('.webp'))) {
      szenen[d.slice(0, -5)] = 'data:image/webp;base64,' + fs.readFileSync(path.join(szenenOrdner, d)).toString('base64');
    }
  }
  return { katalog, svg, szenen };
}

// Als Skript für den Browser (vor den Kern-Dateien laden). nur: Liste von Bild-ids, sonst alle
export function bilderDatenJs(nur) {
  const d = bilderDaten();
  if (nur) {
    const k = {};
    for (const id of nur) if (d.katalog[id]) k[id] = d.katalog[id];
    d.katalog = k;
    d.svg = Object.fromEntries(Object.entries(d.svg).filter(([id]) => k[id]));
  }
  return 'window.BILDER_DATEN = ' + JSON.stringify(d).replace(/</g, '\\u003c') + ';\n';
}

let geladen = null;
export function kern() {
  if (geladen) return geladen;
  const ctx = { console, BILDER_DATEN: bilderDaten() };
  ctx.window = ctx;
  vm.createContext(ctx);
  for (const d of KERN_DATEIEN) {
    const f = path.join(WURZEL, 'web', 'kern', d);
    if (fs.existsSync(f)) vm.runInContext(fs.readFileSync(f, 'utf8'), ctx, { filename: f });
  }
  geladen = ctx;
  return ctx;
}
