// Aufgaben-Kern: prüft jede Aufgabe (eindeutig? lösbar?), rechnet die Lösung aus und macht daraus
// die Schritte für die Web-App. Dieselbe Datei verwenden die Prüfung beim Bauen (werkzeuge/pruefe.mjs),
// die Blätter (Lösungen in der Anleitung) und die Web-App (prüft das Antippen).
//
//   Aufgaben.pruefe(aufgabe)  → { fehler: [...], loesung }      aufgabe: ein Eintrag aus raetsel/eN.json
//   Aufgaben.schritte(aufgabe) → [{ zeige, optionen, richtig } | { zeige, optionen, reihe }]
//
// Aufgabenarten (Felder siehe vorlagen/AUTOREN-LEITFADEN.md):
//   sortieren        Dinge in Körbe. Jedes Ding passt in genau einen Korb.
//   groesse          dasselbe Bild in mehreren Größen: das größte / kleinste antippen oder ordnen
//   groessen-paare   (nur Papier) Figuren in Größen zu Höhlen in denselben Größen verbinden
//   passtnicht       4 Bilder, genau eines passt nicht (und zwar nur in einem Merkmal eindeutig)
//   schatten         ein Bild und mehrere Schatten (oder umgekehrt): der richtige ist genau einer
//   schatten-paare   (nur Papier) Bilder mit ihren Schatten verbinden
//   paare            zu einem Bild das passende finden (frisst, gehoert, gleich)
//   paare-verbinden  (nur Papier) linke und rechte Reihe, genau eine Zuordnung
//   ausmalen         (nur Papier) „Male alle an, die …“: Merkmal und Wert, mindestens 2 Treffer und 2 andere
//   alle-antippen    (nur App) „Tipp alle an, die …“: bedingung, dinge (3 bis 4), hinweis { bild } oder { farbe } (optional)
//   suchbild         (nur App) szene, suche (1 bis 3 Bilder), vorlage ('farbe' | 'schatten', optional),
//                    figuren [{ bild, feld (0 bis 8, 3 · 3-Gitter), versteck }]: alle gesuchten antippen
//   aufdecken        (nur App) karten: 2 bis 4 Paare, jedes Bild genau zweimal, in fester Reihenfolge
//   weggenommen      (nur App) dinge (3 bis 4), weg, optionen, frage: zuerst schauen, dann den Kobold antippen, dann raten
//   turm             (nur App) bild, stufen (3 bis 4), anordnung: vom größten zum kleinsten antippen, der Turm wächst
(function (g) {
  'use strict';
  const B = () => g.Bilder;
  // Merkmale, nach denen ein Kind „passt nicht“ begründen kann
  const MERKMALE = ['farbe', 'art', 'bewegt', 'form', 'muster'];
  const MERKMAL_WORT = { farbe: 'Farbe', art: 'Art', bewegt: 'schwimmt, fliegt oder läuft', form: 'Form', muster: 'Muster' };
  const ART_WORT = { tier: 'Tier', wesen: 'Fantasie-Wesen', essen: 'Essen', pflanze: 'Pflanze', ding: 'Ding', form: 'Form' };
  const BEWEGT_WORT = { schwimmt: 'schwimmt', fliegt: 'fliegt', laeuft: 'läuft' };

  const mm = (id) => {
    const m = B().merkmale(id);
    if (!m) throw new Error('Unbekanntes Bild „' + id + '“');
    return m;
  };
  const passt = (id, bed) => (Array.isArray(bed) ? bed : [bed]).every((b) => mm(id)[b.merkmal] === b.wert);
  const istPermutation = (p, n) => Array.isArray(p) && p.length === n && p.slice().sort((a, b) => a - b).every((x, i) => x === i);
  const doppelte = (liste) => liste.filter((x, i) => liste.indexOf(x) !== i);

  // Beziehungen für Paare (in beide Richtungen)
  function beziehung(art, a, b) {
    if (art === 'gleich') return a === b;
    const ma = mm(a), mb = mm(b);
    if (art === 'frisst') return ma.frisst.includes(b) || mb.frisst.includes(a);
    if (art === 'gehoert') return ma.gehoert.includes(b) || mb.gehoert.includes(a);
    throw new Error('Unbekannte Beziehung „' + art + '“');
  }

  // Wer könnte bei „passt nicht“ der Ausreißer sein? Für jedes Merkmal: Teilen alle außer einem denselben Wert
  // (nicht null) und hat dieser eine einen anderen Wert (auch null = unklar), ist er ein Kandidat.
  function ausreisser(ids) {
    const kandidaten = [];
    for (const merkmal of MERKMALE) {
      for (let i = 0; i < ids.length; i++) {
        const andere = ids.filter((_, j) => j !== i).map((id) => mm(id)[merkmal]);
        if (andere[0] == null || !andere.every((w) => w === andere[0])) continue;
        if (mm(ids[i])[merkmal] !== andere[0]) kandidaten.push({ id: ids[i], merkmal, wert: andere[0] });
      }
    }
    return kandidaten;
  }

  const PRUEFER = {
    sortieren(a) {
      const f = [];
      if (!Array.isArray(a.koerbe) || a.koerbe.length < 2 || a.koerbe.length > 4) f.push('2 bis 4 Körbe');
      if (!Array.isArray(a.dinge) || a.dinge.length < 2) f.push('mindestens 2 Dinge');
      if (f.length) return { fehler: f };
      const dop = doppelte(a.dinge);
      if (dop.length) f.push('Bild doppelt: ' + dop.join(', '));
      const loesung = {};
      for (const id of a.dinge) {
        const treffer = a.koerbe.map((k, i) => (passt(id, k.bedingung) ? i : -1)).filter((i) => i >= 0);
        if (treffer.length !== 1) f.push(mm(id).name + ' passt in ' + treffer.length + ' Körbe (soll genau 1)');
        else loesung[id] = treffer[0];
      }
      a.koerbe.forEach((k, i) => {
        if (!a.dinge.some((id) => loesung[id] === i)) f.push('Korb ' + (i + 1) + ' bleibt leer');
        if (!k.farbe && !k.etikett) f.push('Korb ' + (i + 1) + ': braucht eine Farbe oder ein Etikett-Bild');
      });
      return { fehler: f, loesung };
    },

    groesse(a) {
      const f = [];
      const st = a.stufen || [];
      if (st.length < 2 || st.length > 5) f.push('2 bis 5 Größen');
      if (!['groesste', 'kleinste', 'ordnen'].includes(a.frage)) f.push('frage: groesste, kleinste oder ordnen');
      if (!istPermutation(a.anordnung, st.length)) f.push('anordnung muss jede Stufe genau einmal enthalten');
      if (st.some((s) => !(s > 0 && s <= 1))) f.push('Größen zwischen 0 und 1');
      const sortiert = st.slice().sort((x, y) => x - y);
      const minAbstand = a.knapp ? 1.1 : 1.2; // knapp: im Schwerer-Teil dürfen Größen näher beisammen sein
      for (let i = 1; i < sortiert.length; i++) {
        if (sortiert[i] / sortiert[i - 1] < minAbstand - 1e-9) f.push('Größen ' + sortiert[i - 1] + ' und ' + sortiert[i] + ' zu ähnlich (mindestens ' + minAbstand + '-fach)');
      }
      if (f.length) return { fehler: f };
      mm(a.bild);
      const gezeigt = a.anordnung.map((i) => st[i]); // Größe an Platz 0, 1, 2 …
      let loesung;
      if (a.frage === 'groesste') loesung = gezeigt.indexOf(Math.max(...gezeigt));
      else if (a.frage === 'kleinste') loesung = gezeigt.indexOf(Math.min(...gezeigt));
      else {
        loesung = gezeigt.map((s, i) => [s, i]).sort((x, y) => x[0] - y[0]).map((x) => x[1]); // Plätze von klein nach groß
        if (loesung.every((p, i) => p === i)) f.push('ordnen: steht schon der Größe nach');
      }
      return { fehler: f, loesung };
    },

    'groessen-paare'(a) {
      const f = [];
      const n = (a.stufen || []).length;
      if (n < 2 || n > 4) f.push('2 bis 4 Größen');
      if (!istPermutation(a.links, n) || !istPermutation(a.rechts, n)) f.push('links und rechts: jede Stufe genau einmal');
      if (f.length) return { fehler: f };
      mm(a.bild);
      if (a.partner !== 'hoehle') mm(a.partner);
      if (a.links.every((x, i) => x === a.rechts[i])) f.push('links und rechts in derselben Reihenfolge: zu leicht');
      const sortiert = a.stufen.slice().sort((x, y) => x - y);
      for (let i = 1; i < n; i++) if (sortiert[i] / sortiert[i - 1] < 1.2) f.push('Größen zu ähnlich');
      // Lösung: Platz links → Platz rechts
      const loesung = a.links.map((stufe) => a.rechts.indexOf(stufe));
      return { fehler: f, loesung };
    },

    passtnicht(a) {
      const f = [];
      if (!Array.isArray(a.dinge) || a.dinge.length < 3 || a.dinge.length > 5) return { fehler: ['3 bis 5 Bilder'] };
      const dop = doppelte(a.dinge);
      if (dop.length) f.push('Bild doppelt: ' + dop.join(', '));
      if (!a.dinge.includes(a.loesung)) f.push('loesung „' + a.loesung + '“ ist nicht unter den Bildern');
      if (!MERKMALE.includes(a.merkmal)) f.push('merkmal: eines von ' + MERKMALE.join(', '));
      if (f.length) return { fehler: f };
      const k = ausreisser(a.dinge);
      if (!k.some((x) => x.id === a.loesung && x.merkmal === a.merkmal)) {
        f.push(mm(a.loesung).name + ' fällt beim Merkmal ' + a.merkmal + ' nicht als einziges heraus');
      }
      for (const x of k) {
        if (x.id !== a.loesung) f.push('nicht eindeutig: auch ' + mm(x.id).name + ' passt nicht (' + a.merkmal + ' gemeint, aber ' + x.merkmal + ': die anderen sind alle ' + x.wert + ')');
      }
      // Mit Korb (Blatt „Kobold in den Körben“): Alle außer dem Kobold-Ding passen zum Korb, das Kobold-Ding nicht
      if (a.korb) {
        for (const id of a.dinge) {
          if ((id === a.loesung) === passt(id, a.korb.bedingung)) f.push(mm(id).name + (id === a.loesung ? ' passt in den Korb, soll aber nicht' : ' passt nicht in den Korb'));
        }
      }
      const grund = k.filter((x) => x.id === a.loesung);
      return { fehler: f, loesung: a.dinge.indexOf(a.loesung), grund };
    },

    schatten(a) {
      const f = [];
      const o = a.optionen || [];
      if (o.length < 2 || o.length > 4) f.push('2 bis 4 Optionen');
      if (doppelte(o).length) f.push('Option doppelt');
      if (o.filter((x) => x === a.bild).length !== 1) f.push('das Bild muss genau einmal unter den Optionen sein');
      if (!['zum-schatten', 'zum-bild'].includes(a.richtung)) f.push('richtung: zum-schatten oder zum-bild');
      o.forEach(mm);
      return { fehler: f, loesung: o.indexOf(a.bild) };
    },

    'schatten-paare'(a) {
      const f = [];
      const n = (a.bilder || []).length;
      if (n < 2 || n > 5) f.push('2 bis 5 Bilder');
      if (doppelte(a.bilder || []).length) f.push('Bild doppelt');
      if (!istPermutation(a.schatten, n)) f.push('schatten: jede Stelle genau einmal');
      if (f.length) return { fehler: f };
      a.bilder.forEach(mm);
      if (a.schatten.every((x, i) => x === i)) f.push('Schatten in derselben Reihenfolge: zu leicht');
      const loesung = a.bilder.map((_, i) => a.schatten.indexOf(i)); // Bild i → Platz des Schattens
      return { fehler: f, loesung };
    },

    paare(a) {
      const f = [];
      const o = a.optionen || [];
      if (o.length < 2 || o.length > 4) f.push('2 bis 4 Optionen');
      if (doppelte(o).length) f.push('Option doppelt');
      if (f.length) return { fehler: f };
      const treffer = o.map((x, i) => (beziehung(a.beziehung, a.zeige, x) ? i : -1)).filter((i) => i >= 0);
      if (treffer.length !== 1) f.push(mm(a.zeige).name + ': ' + treffer.length + ' passende Optionen (soll genau 1)');
      return { fehler: f, loesung: treffer[0] };
    },

    'paare-verbinden'(a) {
      const f = [];
      const L = a.links || [], R = a.rechts || [];
      if (L.length < 2 || L.length !== R.length || L.length > 5) return { fehler: ['links und rechts gleich viele (2 bis 5)'] };
      if (a.beziehung !== 'gleich' && (doppelte(L).length || doppelte(R).length)) f.push('Bild doppelt');
      // Zuordnung muss eindeutig sein: Jedes links hat genau ein rechts und umgekehrt
      const loesung = [];
      L.forEach((l, i) => {
        const t = R.map((r, j) => (beziehung(a.beziehung, l, r) ? j : -1)).filter((j) => j >= 0);
        if (t.length !== 1) f.push(mm(l).name + ': ' + t.length + ' Partner rechts (soll genau 1)');
        loesung[i] = t[0];
      });
      R.forEach((r) => {
        const t = L.filter((l) => beziehung(a.beziehung, l, r));
        if (t.length !== 1) f.push(mm(r).name + ': ' + t.length + ' Partner links (soll genau 1)');
      });
      if (!f.length && loesung.every((j, i) => j === i)) f.push('alle Paare gerade nebeneinander: zu leicht');
      return { fehler: f, loesung };
    },

    ausmalen(a) {
      const f = [];
      const d = a.dinge || [];
      if (doppelte(d).length) f.push('Bild doppelt');
      const treffer = d.map((id, i) => (passt(id, a.bedingung) ? i : -1)).filter((i) => i >= 0);
      if (treffer.length < 2) f.push('mindestens 2 Bilder zum Anmalen');
      if (d.length - treffer.length < 2) f.push('mindestens 2 Bilder, die nicht angemalt werden');
      // Kein Bild darf „unklar“ sein (Merkmal null): sonst weiß man nicht, ob es dazugehört
      for (const id of d) {
        for (const b of [].concat(a.bedingung)) if (mm(id)[b.merkmal] == null) f.push(mm(id).name + ': ' + b.merkmal + ' unklar');
      }
      return { fehler: f, loesung: treffer };
    },

    'alle-antippen'(a) {
      const f = [];
      const d = a.dinge || [];
      if (d.length < 3 || d.length > 4) return { fehler: ['3 bis 4 Bilder'] };
      if (doppelte(d).length) f.push('Bild doppelt');
      const treffer = d.map((id, i) => (passt(id, a.bedingung) ? i : -1)).filter((i) => i >= 0);
      if (treffer.length < 2) f.push('mindestens 2 Bilder zum Antippen');
      if (d.length === treffer.length) f.push('mindestens 1 Bild, das nicht passt');
      for (const id of d) {
        for (const b of [].concat(a.bedingung)) if (mm(id)[b.merkmal] == null) f.push(mm(id).name + ': ' + b.merkmal + ' unklar');
      }
      if (a.hinweis) {
        if (a.hinweis.bild) mm(a.hinweis.bild);
        else if (!g.Symbole.KORB_FARBEN.includes(a.hinweis.farbe)) f.push('hinweis: Bild oder Korb-Farbe');
      }
      return { fehler: f, loesung: treffer };
    },

    suchbild(a) {
      const f = [];
      if (!g.Symbole.SZENEN.includes(a.szene)) f.push('szene: eine von ' + g.Symbole.SZENEN.join(', '));
      const suche = a.suche || [];
      const fig = a.figuren || [];
      if (suche.length < 1 || suche.length > 3 || doppelte(suche).length) f.push('suche: 1 bis 3 verschiedene Bilder');
      if (fig.length < 3 || fig.length > 7) f.push('3 bis 7 Figuren');
      if (a.vorlage && !['farbe', 'schatten'].includes(a.vorlage)) f.push('vorlage: farbe oder schatten');
      if (f.length) return { fehler: f };
      suche.forEach(mm);
      fig.forEach((x) => mm(x.bild));
      const felder = fig.map((x) => x.feld);
      if (felder.some((n) => !Number.isInteger(n) || n < 0 || n > 8)) f.push('feld: 0 bis 8');
      if (doppelte(felder).length) f.push('zwei Figuren im selben Feld');
      const treffer = fig.map((x, i) => (suche.includes(x.bild) ? i : -1)).filter((i) => i >= 0);
      for (const id of suche) if (!fig.some((x) => x.bild === id)) f.push(mm(id).name + ' ist nicht in der Szene');
      if (treffer.length > 4) f.push('höchstens 4 Figuren zum Finden');
      if (treffer.length === fig.length) f.push('mindestens 1 Figur, die nicht gesucht ist');
      if (!treffer.some((i) => fig[i].versteck)) f.push('mindestens 1 gesuchte Figur muss versteckt sein');
      return { fehler: f, loesung: treffer };
    },

    aufdecken(a) {
      const f = [];
      const k = a.karten || [];
      if (k.length < 4 || k.length > 8 || k.length % 2) return { fehler: ['2 bis 4 Paare (4, 6 oder 8 Karten)'] };
      k.forEach(mm);
      const loesung = [];
      for (const id of new Set(k)) {
        const orte = k.map((x, i) => (x === id ? i : -1)).filter((i) => i >= 0);
        if (orte.length !== 2) f.push(mm(id).name + ': ' + orte.length + ' Karten (soll genau 2)');
        else loesung.push(orte);
      }
      if (!f.length && loesung.every(([x, y]) => y === x + 1)) f.push('alle Paare liegen nebeneinander: zu leicht');
      return { fehler: f, loesung };
    },

    weggenommen(a) {
      const f = [];
      const d = a.dinge || [];
      const o = a.optionen || [];
      if (d.length < 3 || d.length > 4) f.push('3 bis 4 Bilder');
      if (o.length < 2 || o.length > 4) f.push('2 bis 4 Optionen');
      if (!a.frage) f.push('frage fehlt (der zweite Satz für Mama oder Papa)');
      if (f.length) return { fehler: f };
      d.concat(o).forEach(mm);
      if (doppelte(d).length) f.push('Bild doppelt');
      if (doppelte(o).length) f.push('Option doppelt');
      if (d.includes('kobold')) f.push('der Kobold ist der Knopf und darf nicht unter den Bildern sein');
      if (!d.includes(a.weg)) f.push('weg „' + a.weg + '“ ist nicht unter den Bildern');
      if (o.filter((x) => x === a.weg).length !== 1) f.push('weg muss genau einmal unter den Optionen sein');
      return { fehler: f, loesung: o.indexOf(a.weg) };
    },

    turm(a) {
      const f = [];
      const st = a.stufen || [];
      if (st.length < 3 || st.length > 4) f.push('3 bis 4 Größen');
      if (!istPermutation(a.anordnung, st.length)) f.push('anordnung muss jede Stufe genau einmal enthalten');
      if (st.some((s) => !(s > 0 && s <= 1))) f.push('Größen zwischen 0 und 1');
      const sortiert = st.slice().sort((x, y) => x - y);
      for (let i = 1; i < sortiert.length; i++) {
        if (sortiert[i] / sortiert[i - 1] < 1.2 - 1e-9) f.push('Größen ' + sortiert[i - 1] + ' und ' + sortiert[i] + ' zu ähnlich (mindestens 1.2-fach)');
      }
      if (f.length) return { fehler: f };
      mm(a.bild);
      const gezeigt = a.anordnung.map((i) => st[i]);
      const loesung = gezeigt.map((s, i) => [s, i]).sort((x, y) => y[0] - x[0]).map((x) => x[1]); // Plätze von groß nach klein
      if (loesung.every((p, i) => p === i)) f.push('turm: steht schon der Größe nach');
      return { fehler: f, loesung };
    }
  };

  function pruefe(a) {
    const p = PRUEFER[a && a.art];
    if (!p) return { fehler: ['unbekannte Aufgabenart „' + (a && a.art) + '“'] };
    try {
      const e = p(a);
      e.fehler = e.fehler || [];
      if (a.web !== false && !a.satz) e.fehler.push('satz fehlt (der Satz für Mama oder Papa)');
      return e;
    } catch (err) {
      return { fehler: [err.message] };
    }
  }

  // ---------------------------------------------------------------------
  // Schritte für die Web-App. Ein Bild-Verweis: { bild, stil, gross } oder { korb: { farbe, etikett } } oder { hoehle, gross }
  // ---------------------------------------------------------------------
  const NUR_PAPIER = ['groessen-paare', 'schatten-paare', 'paare-verbinden', 'ausmalen'];
  function schritte(a) {
    const e = pruefe(a);
    if (e.fehler.length) throw new Error('Aufgabe fehlerhaft: ' + e.fehler.join('; '));
    if (NUR_PAPIER.includes(a.art)) throw new Error('Aufgabenart ' + a.art + ' gibt es nur am Papier');
    const bild = (id, stil, gross) => ({ bild: id, stil: stil || 'farbe', gross: gross || 1 });
    if (a.art === 'sortieren') {
      const koerbe = a.koerbe.map((k) => ({ korb: { farbe: k.farbe || 'braun', etikett: k.etikett || null } }));
      return a.dinge.map((id) => ({ zeige: [bild(id)], optionen: koerbe, richtig: e.loesung[id], wohin: 'korb' }));
    }
    if (a.art === 'groesse') {
      const optionen = a.anordnung.map((i) => bild(a.bild, 'farbe', a.stufen[i]));
      if (a.frage === 'ordnen') return [{ zeige: [], optionen, reihe: e.loesung, unten: true }];
      return [{ zeige: [], optionen, richtig: e.loesung, unten: true }];
    }
    if (a.art === 'passtnicht') return [{ zeige: [], optionen: a.dinge.map((id) => bild(id)), richtig: e.loesung }];
    if (a.art === 'schatten') {
      const zum = a.richtung === 'zum-schatten';
      return [{ zeige: [bild(a.bild, zum ? 'farbe' : 'schatten')], optionen: a.optionen.map((id) => bild(id, zum ? 'schatten' : 'farbe')), richtig: e.loesung }];
    }
    if (a.art === 'paare') return [{ zeige: [bild(a.zeige)], optionen: a.optionen.map((id) => bild(id)), richtig: e.loesung }];
    if (a.art === 'alle-antippen') {
      const h = a.hinweis;
      const zeige = !h ? [] : [h.bild ? bild(h.bild) : { korb: { farbe: h.farbe, etikett: null } }];
      return [{ zeige, optionen: a.dinge.map((id) => bild(id)), alle: e.loesung }];
    }
    if (a.art === 'suchbild') {
      return [{
        typ: 'suchbild', brett: true, szene: a.szene,
        zeige: a.suche.map((id) => bild(id, a.vorlage || 'farbe')),
        optionen: a.figuren.map((x) => ({ ...bild(x.bild), feld: x.feld, versteck: !!x.versteck })),
        alle: e.loesung
      }];
    }
    if (a.art === 'aufdecken') return [{ typ: 'aufdecken', brett: true, zeige: [], optionen: a.karten.map((id) => bild(id)), paare: e.loesung }];
    if (a.art === 'weggenommen') {
      return [
        { typ: 'anschauen', zeige: a.dinge.map((id) => bild(id)), optionen: [bild('kobold')], richtig: 0 },
        { satz: a.frage, zeige: a.dinge.map((id) => (id === a.weg ? { luecke: true } : bild(id))), optionen: a.optionen.map((id) => bild(id)), richtig: e.loesung }
      ];
    }
    if (a.art === 'turm') return [{ typ: 'turm', zeige: [], optionen: a.anordnung.map((i) => bild(a.bild, 'farbe', a.stufen[i])), reihe: e.loesung }];
    throw new Error('schritte: ' + a.art);
  }

  g.Aufgaben = { pruefe, schritte, ausreisser, beziehung, ARTEN: Object.keys(PRUEFER), NUR_PAPIER, MERKMALE, MERKMAL_WORT, ART_WORT, BEWEGT_WORT };
})(typeof window !== 'undefined' ? window : globalThis);
