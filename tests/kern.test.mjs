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
    for (const stil of ['farbe', 'umriss', 'schatten']) assert.match(Bilder.svg(id, { stil }), /^<svg[^>]*viewBox="0 0 [\d.]+ [\d.]+"/);
  }
  assert.equal(Bilder.merkmale('form-kreis-rot').form, 'kreis');
  assert.equal(Bilder.merkmale('socke-punkte-blau').muster, 'punkte');
  assert.equal(Bilder.merkmale('gibtsnicht'), null);
});

const farbenIn = (s) => [...new Set((s.match(/(?:fill|stroke)="#[0-9a-f]+"/gi) || []).map((x) => x.split('"')[1].toLowerCase()))].sort();
const beispiele = () => Bilder.alle().concat(['kobold', 'form-kreis-rot', 'socke-punkte-blau']);

test('Schatten enthält keine Farben mehr, Umriss nur Weiß und Tinte', () => {
  for (const id of beispiele()) {
    assert.deepEqual(farbenIn(Bilder.svg(id, { stil: 'schatten' })), ['#3b3d4f'], id + ' (Schatten)');
    const u = farbenIn(Bilder.svg(id, { stil: 'umriss' }));
    assert.ok(u.every((f) => ['#fff', '#ffffff', '#1f2340'].includes(f)), id + ' (Umriss): ' + u.join(' '));
  }
});

test('ids in den Farbbildern sind eindeutig (beginnen mit dem Bildnamen)', () => {
  for (const id of Bilder.alle()) {
    for (const m of Bilder.svg(id).matchAll(/\sid="([^"]+)"/g)) assert.ok(m[1].startsWith(id + '-'), id + ': id ' + m[1]);
  }
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

test('alle-antippen: Treffer, unklare Bilder, keine Falschen', () => {
  const fliegt = { merkmal: 'bewegt', wert: 'fliegt' };
  assert.deepEqual([...Aufgaben.pruefe({ art: 'alle-antippen', satz: 'x', bedingung: fliegt, dinge: ['eule', 'hund', 'biene', 'fisch'] }).loesung], [0, 2]);
  assert.match(fehler({ art: 'alle-antippen', bedingung: fliegt, dinge: ['eule', 'frosch', 'biene'] }).join(), /Frosch: bewegt unklar/);
  assert.match(fehler({ art: 'alle-antippen', bedingung: fliegt, dinge: ['eule', 'biene', 'vogel'] }).join(), /nicht passt/);
  assert.match(fehler({ art: 'alle-antippen', bedingung: fliegt, dinge: ['eule', 'hund', 'fisch'] }).join(), /mindestens 2/);
  assert.match(fehler({ art: 'alle-antippen', bedingung: fliegt, dinge: ['eule', 'biene', 'hund', 'fisch', 'wal'] }).join(), /3 bis 4/);
});

test('suchbild: Szene, Felder, Verstecke', () => {
  const gut = { art: 'suchbild', szene: 'wiese', suche: ['hase'], figuren: [{ bild: 'hase', feld: 0, versteck: true }, { bild: 'hase', feld: 4 }, { bild: 'igel', feld: 8 }] };
  assert.deepEqual(fehler(gut), []);
  assert.deepEqual([...Aufgaben.pruefe({ ...gut, satz: 'x' }).loesung], [0, 1]);
  assert.match(fehler({ ...gut, szene: 'mond' }).join(), /szene/);
  assert.match(fehler({ ...gut, suche: ['fuchs'] }).join(), /nicht in der Szene/);
  assert.match(fehler({ ...gut, figuren: [gut.figuren[0], { bild: 'hase', feld: 0 }, gut.figuren[2]] }).join(), /selben Feld/);
  assert.match(fehler({ ...gut, figuren: [gut.figuren[0], { bild: 'igel', feld: 9 }, gut.figuren[2]] }).join(), /feld: 0 bis 8/);
  assert.match(fehler({ ...gut, figuren: [{ bild: 'hase', feld: 0 }, { bild: 'igel', feld: 1 }, { bild: 'igel', feld: 2 }] }).join(), /versteckt/);
  assert.match(fehler({ ...gut, figuren: [gut.figuren[0], { bild: 'hase', feld: 1 }, { bild: 'hase', feld: 2 }] }).join(), /nicht gesucht/);
  const s = Aufgaben.schritte({ ...gut, satz: 'x', vorlage: 'schatten' })[0];
  assert.equal(s.zeige[0].stil, 'schatten');
  assert.equal(s.optionen[0].versteck, true);
  assert.equal(s.optionen[1].versteck, false);
});

test('aufdecken: jedes Bild genau zweimal, nicht alle nebeneinander', () => {
  assert.deepEqual(fehler({ art: 'aufdecken', karten: ['hase', 'igel', 'hase', 'igel'] }), []);
  assert.match(fehler({ art: 'aufdecken', karten: ['hase', 'hase', 'igel', 'igel'] }).join(), /nebeneinander/);
  assert.match(fehler({ art: 'aufdecken', karten: ['hase', 'igel', 'hase', 'hase'] }).join(), /Karten \(soll genau 2\)/);
  assert.match(fehler({ art: 'aufdecken', karten: ['hase', 'igel', 'hase'] }).join(), /Paare/);
});

test('weggenommen: weg ist dabei und genau einmal unter den Optionen', () => {
  const gut = { art: 'weggenommen', frage: 'y', dinge: ['apfel', 'banane', 'birne'], weg: 'banane', optionen: ['kirschen', 'banane', 'zitrone'] };
  assert.deepEqual(fehler(gut), []);
  assert.match(fehler({ ...gut, weg: 'kirschen' }).join(), /nicht unter den Bildern/);
  assert.match(fehler({ ...gut, optionen: ['kirschen', 'zitrone'] }).join(), /genau einmal/);
  assert.match(fehler({ ...gut, dinge: ['apfel', 'banane', 'kobold'] }).join(), /Knopf/);
  assert.match(fehler({ ...gut, frage: '' }).join(), /frage fehlt/);
  const [a, b] = Aufgaben.schritte({ ...gut, satz: 'x' });
  assert.equal(a.optionen[0].bild, 'kobold');
  assert.equal(b.satz, 'y');
  assert.equal(b.zeige[1].luecke, true);
  assert.equal(b.optionen[b.richtig].bild, 'banane');
});

test('turm: vom größten zum kleinsten, nicht schon geordnet', () => {
  const gut = { art: 'turm', bild: 'teddy', stufen: [0.5, 0.75, 1], anordnung: [0, 2, 1] };
  assert.deepEqual(fehler(gut), []);
  assert.deepEqual([...Aufgaben.pruefe({ ...gut, satz: 'x' }).loesung], [1, 2, 0]);
  assert.match(fehler({ ...gut, anordnung: [2, 1, 0] }).join(), /schon der Größe nach/);
  assert.match(fehler({ ...gut, stufen: [0.9, 0.95, 1] }).join(), /zu ähnlich/);
  assert.match(fehler({ ...gut, stufen: [0.5, 1], anordnung: [1, 0] }).join(), /3 bis 4/);
});

test('Schritte für die App: richtige Antwort zeigt auf die Lösung', () => {
  const erg = pruefeAlle();
  for (const p of Object.values(erg.pakete)) {
    for (const l of p.levels) {
      for (const s of l.schritte) {
        const n = s.optionen.length;
        if (s.brett) assert.ok(n >= 3 && n <= 8);
        else if (s.typ === 'anschauen') assert.equal(n, 1);
        else assert.ok(n >= 2 && n <= 4);
        if (s.reihe) assert.equal(s.reihe.length, n);
        else if (s.alle) assert.ok(s.alle.length >= 1 && s.alle.length < n && s.alle.every((i) => i >= 0 && i < n));
        else if (s.paare) assert.equal(s.paare.length * 2, n);
        else assert.ok(s.richtig >= 0 && s.richtig < n);
      }
    }
  }
  const s = Aufgaben.schritte({ art: 'schatten', satz: 'x', richtung: 'zum-bild', bild: 'pferd', optionen: ['einhorn', 'pferd'] });
  assert.equal(s[0].zeige[0].stil, 'schatten');
  assert.equal(s[0].optionen[s[0].richtig].bild, 'pferd');
});
