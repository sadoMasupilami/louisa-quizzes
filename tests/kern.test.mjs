// Tests für den Aufgaben-Kern: Richtige Aufgaben gehen durch, kaputte werden erkannt.
//   node --test tests/kern.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { kern } from '../werkzeuge/kern.mjs';
import { pruefeAlle, pruefeBilder } from '../werkzeuge/pruefe.mjs';

const { Aufgaben, Bilder } = kern();
// Arrays aus dem Kern stammen aus einem anderen Kontext (vm): für deepEqual in ein normales Array kopieren
const fehler = (a) => [...Aufgaben.pruefe({ satz: 'x', ...a }).fehler];

test('alle Aufgaben im Repo sind in Ordnung', () => {
  const erg = pruefeAlle();
  assert.deepEqual([...erg.fehler], []);
  assert.equal(Object.keys(erg.pakete).length, 5);
});

test('Bilder-Sammlung: jedes Bild hat Farbe, Umriss und Schatten', () => {
  assert.deepEqual([...pruefeBilder()], []);
  for (const id of Bilder.alle()) {
    for (const stil of ['farbe', 'umriss', 'schatten']) assert.match(Bilder.svg(id, { stil }), /^<svg[^>]*viewBox="0 0 72 72"/);
  }
  assert.equal(Bilder.merkmale('form-kreis-rot').form, 'kreis');
  assert.equal(Bilder.merkmale('socke-punkte-blau').muster, 'punkte');
  assert.equal(Bilder.merkmale('gibtsnicht'), null);
});

test('Schatten enthält keine Farben mehr', () => {
  const s = Bilder.svg('einhorn', { stil: 'schatten' });
  const farben = new Set((s.match(/(?:fill|stroke)="#[0-9a-f]+"/gi) || []).map((x) => x.split('"')[1].toLowerCase()));
  assert.deepEqual([...farben], ['#3b3d4f']);
});

test('sortieren: Ding in zwei Körben oder in keinem wird erkannt', () => {
  const rot = { farbe: 'rot', bedingung: { merkmal: 'farbe', wert: 'rot' } };
  const tier = { etikett: 'pfote', bedingung: { merkmal: 'art', wert: 'tier' } };
  assert.match(fehler({ art: 'sortieren', koerbe: [rot, tier], dinge: ['marienkaefer', 'apfel', 'hund'] }).join(), /Marienkäfer passt in 2 Körbe/);
  assert.match(fehler({ art: 'sortieren', koerbe: [rot, tier], dinge: ['banane', 'apfel', 'hund'] }).join(), /Banane passt in 0 Körbe/);
  assert.deepEqual(fehler({ art: 'sortieren', koerbe: [rot, tier], dinge: ['apfel', 'hund'] }), []);
});

test('passtnicht: zweiter möglicher Ausreißer wird erkannt', () => {
  // Frosch ist das einzige Tier, Zitrone das einzige Gelbe: nicht eindeutig
  const f = fehler({ art: 'passtnicht', dinge: ['gurke', 'frosch', 'brokkoli', 'zitrone'], loesung: 'zitrone', merkmal: 'farbe' });
  assert.match(f.join(), /auch der Frosch passt nicht/);
  // Falsche Lösung
  assert.ok(fehler({ art: 'passtnicht', dinge: ['banane', 'kueken', 'apfel', 'stern'], loesung: 'banane', merkmal: 'farbe' }).length > 0);
  // Unklare Farbe (null) zählt als möglicher Ausreißer
  assert.ok(fehler({ art: 'passtnicht', dinge: ['katze', 'hund', 'fuchs', 'einhorn'], loesung: 'einhorn', merkmal: 'art' }).length === 0);
});

test('passtnicht mit Korb: Korb muss zu den anderen passen', () => {
  const korb = { farbe: 'gelb', bedingung: { merkmal: 'farbe', wert: 'gelb' } };
  assert.match(fehler({ art: 'passtnicht', korb, dinge: ['erdbeere', 'pilz', 'banane', 'marienkaefer'], loesung: 'banane', merkmal: 'farbe' }).join(), /passt in den Korb, soll aber nicht/);
});

test('groesse: zu ähnliche Größen und schon geordnete Reihen werden erkannt', () => {
  assert.match(fehler({ art: 'groesse', bild: 'drache', frage: 'groesste', stufen: [0.9, 1], anordnung: [0, 1] }).join(), /zu ähnlich/);
  assert.deepEqual(fehler({ art: 'groesse', bild: 'drache', frage: 'groesste', stufen: [0.9, 1], anordnung: [0, 1], knapp: true }), []);
  assert.match(fehler({ art: 'groesse', bild: 'drache', frage: 'ordnen', stufen: [0.5, 1], anordnung: [0, 1] }).join(), /schon der Größe nach/);
  assert.equal(Aufgaben.pruefe({ art: 'groesse', satz: 'x', bild: 'eule', frage: 'kleinste', stufen: [0.45, 0.7, 1], anordnung: [2, 0, 1] }).loesung, 1);
});

test('paare: genau ein Partner', () => {
  // Hase und Pferd fressen beide Karotten
  assert.match(fehler({ art: 'paare-verbinden', beziehung: 'frisst', links: ['hase', 'pferd'], rechts: ['karotte', 'knochen'] }).join(), /Partner/);
  assert.match(fehler({ art: 'paare', beziehung: 'gleich', zeige: 'socke-uni-rot', optionen: ['socke-uni-blau', 'socke-punkte-rot'] }).join(), /0 passende/);
  assert.equal(Aufgaben.pruefe({ art: 'paare', satz: 'x', beziehung: 'frisst', zeige: 'maus', optionen: ['knochen', 'kaese'] }).loesung, 1);
});

test('ausmalen: unklare Bilder sind verboten', () => {
  assert.match(fehler({ art: 'ausmalen', bedingung: { merkmal: 'bewegt', wert: 'fliegt' }, dinge: ['eule', 'biene', 'frosch', 'hund'] }).join(), /Frosch: bewegt unklar/);
});

test('Schritte für die App: richtige Antwort zeigt auf die Lösung', () => {
  const erg = pruefeAlle();
  for (const p of Object.values(erg.pakete)) {
    for (const l of p.levels) {
      for (const s of l.schritte) {
        assert.ok(s.optionen.length >= 2 && s.optionen.length <= 4);
        if (s.reihe) assert.equal(s.reihe.length, s.optionen.length);
        else assert.ok(s.richtig >= 0 && s.richtig < s.optionen.length);
      }
    }
  }
  const s = Aufgaben.schritte({ art: 'schatten', satz: 'x', richtung: 'zum-bild', bild: 'pferd', optionen: ['einhorn', 'pferd'] });
  assert.equal(s[0].zeige[0].stil, 'schatten');
  assert.equal(s[0].optionen[s[0].richtig].bild, 'pferd');
});
