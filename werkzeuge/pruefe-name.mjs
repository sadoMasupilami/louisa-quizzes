// Datenschutz (AUFTRAG.md Abschnitt 8, Variante B): Kein Name aus kind.json darf in einer Datei stehen,
// die ins Repo kommt (eingecheckt oder neu und nicht ignoriert), weder im Inhalt noch im Dateinamen.
// Geprüft werden "KIND", "SCHWESTER" und "KUSCHELTIER" aus kind.json.
//   node werkzeuge/pruefe-name.mjs
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const WURZEL = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

export function namenAusKind() {
  const f = path.join(WURZEL, 'kind.json');
  if (!fs.existsSync(f)) return [];
  const k = JSON.parse(fs.readFileSync(f, 'utf8'));
  return ['KIND', 'SCHWESTER', 'KUSCHELTIER'].map((s) => String(k[s] || '').trim()).filter((n) => n.length >= 3);
}

export function pruefeNamen(namen) {
  namen = namen || namenAusKind();
  if (!namen.length) return [];
  let dateien;
  try {
    dateien = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: WURZEL, encoding: 'utf8' }).split('\0').filter(Boolean);
  } catch (e) {
    return ['Namens-Prüfung: git ls-files geht nicht (' + e.message + ')'];
  }
  const fehler = [];
  const muster = namen.map((n) => new RegExp(n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
  for (const d of dateien) {
    const voll = path.join(WURZEL, d);
    if (!fs.existsSync(voll) || fs.statSync(voll).isDirectory()) continue;
    for (const m of muster) {
      if (m.test(d)) fehler.push('Name im Dateinamen: ' + d);
      const inhalt = fs.readFileSync(voll);
      if (inhalt.includes(0) && !/\.(svg|json|md|html|js|mjs|css|txt|yml)$/.test(d)) continue; // Binärdateien (Schriften, Bilder) überspringen
      if (m.test(inhalt.toString('utf8'))) fehler.push('Name steht in ' + d + ' – dort {{KIND}} (bzw. Platzhalter) verwenden');
    }
  }
  return fehler;
}

const direkt = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (direkt) {
  const namen = namenAusKind();
  if (!namen.length) { console.log('ℹ️  kind.json fehlt oder ist leer: nichts zu prüfen'); process.exit(0); }
  const f = pruefeNamen(namen);
  if (f.length) { console.log('❌ ' + f.length + ' Fundstelle(n):'); for (const x of f) console.log('  • ' + x); process.exit(1); }
  console.log('✅ Kein Name in den Dateien des Repos (' + namen.length + ' Namen geprüft)');
}
