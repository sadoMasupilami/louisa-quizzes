// Lädt den gemeinsamen Kern (web/kern/*.js) in Node: dieselben Dateien wie in Blättern und Web-App.
//   import { kern, bilderDaten, bilderDatenJs } from './kern.mjs'
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

export const WURZEL = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
export const KERN_DATEIEN = ['bilder.js', 'symbole.js', 'aufgaben.js'];

// Katalog und SVG-Dateien der Bilder-Sammlung
export function bilderDaten() {
  const katalog = JSON.parse(fs.readFileSync(path.join(WURZEL, 'bilder', 'katalog.json'), 'utf8')).bilder;
  const svg = {};
  const ordner = path.join(WURZEL, 'bilder', 'openmoji');
  for (const b of Object.values(katalog)) {
    if (!b.quelle.startsWith('openmoji:')) continue;
    const hex = b.quelle.slice(9);
    const lies = (sub) => {
      const f = path.join(ordner, sub, hex + '.svg');
      if (!fs.existsSync(f)) throw new Error('Bild fehlt: bilder/openmoji/' + sub + '/' + hex + '.svg (node werkzeuge/bilder-holen.mjs)');
      return fs.readFileSync(f, 'utf8').trim();
    };
    svg[hex] = { farbe: lies('farbe'), umriss: lies('umriss') };
  }
  return { katalog, svg };
}

// Als Skript für den Browser (vor den Kern-Dateien laden). nur: Liste von Bild-ids, sonst alle
export function bilderDatenJs(nur) {
  const d = bilderDaten();
  if (nur) {
    const k = {};
    for (const id of nur) if (d.katalog[id]) k[id] = d.katalog[id];
    const hexe = new Set(Object.values(k).filter((b) => b.quelle.startsWith('openmoji:')).map((b) => b.quelle.slice(9)));
    d.katalog = k;
    d.svg = Object.fromEntries(Object.entries(d.svg).filter(([h]) => hexe.has(h)));
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
