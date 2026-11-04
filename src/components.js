// Bausteine für Blätter und Anleitung. Läuft im Browser beim Bauen (build.mjs).
// Die Bausteine stehen als <k-…>-Elemente im HTML und werden beim Laden ersetzt. Daten kommen aus
// window.__WERKSTATT (Aufgaben mit Lösungen aus raetsel/eN.json, QR-Codes), Bilder aus web/kern/bilder.js.
//
// Blätter:
//   <k-kopf>                                  Kopf: Geschafft-Stern, Bild der Einheit, Namenslinie
//   <k-aufgabe ref="e1:farben-kleben" tun="schneiden kleben" [mm] [spalten] [stil] [wachsen] [satz]>
//        ref: eine oder mehrere Aufgaben (mit Leerzeichen getrennt, dann nebeneinander)
//        tun: Aufgaben-Bilder (anmalen verbinden einkreisen kleben schneiden zeigen schauen sagen)
//   <k-karten ref="…" | bilder="a b c" [doppelt] [spalten] [mm] [stil]>   Ausschneide-Karten
//   <k-qr paket="e1">                         QR-Code zum Web-Paket (für Mama oder Papa)
//   <k-fuss>                                  Fußzeile mit Blatt-Nummer und Seitenzahl
// Anleitung:
//   <k-bild b="einhorn" [stil]>  <k-tun name="kleben">   kleine Bilder im Text
//   <k-titel>                                  Überschrift der Einheit mit Bild
//   <k-loesungen von="blatt-1-1 blatt-1-2">    verkleinerte Blätter mit roten Lösungen
//   <a class="blattref" href="#blatt-1-1"></a>  wird zu „Blatt 1-1 (S. 12)“
(function () {
  'use strict';
  const W = window.__WERKSTATT;
  const fehler = [];
  const warnungen = [];
  const benutzt = new Set();
  const MM = 96 / 25.4; // px pro mm

  const sym = window.Symbole;
  const bild = (id, opt) => window.Bilder.svg(id, opt);
  const name = (id) => (window.Bilder.merkmale(id) || { name: id }).name;

  function komponentenFehler(el, text) {
    fehler.push(text + ' (' + el.outerHTML.slice(0, 90) + ')');
    const d = document.createElement('div');
    d.className = 'komp-fehler';
    d.textContent = '⚠ ' + text;
    el.replaceWith(d);
  }
  function aufgabe(ref) {
    const [e, id] = ref.split(':');
    const ein = W.einheiten[e];
    const a = ein && ein.aufgaben[id];
    if (!a) throw new Error('Aufgabe ' + ref + ' gibt es nicht');
    benutzt.add(ref);
    return a;
  }
  const zahl = (el, attr, def) => (el.hasAttribute(attr) ? parseFloat(el.getAttribute(attr)) : def);
  const box = (inner, mm, extra) => '<div class="feld"' + (extra || '') + ' style="width:' + mm + 'mm;height:' + mm + 'mm">' + inner + '</div>';
  const RING = '<div class="lsg lsg-ring"></div>';
  // Bild in einem Feld, unten ausgerichtet, in einer Größe (Anteil 0–1)
  const bildBox = (id, mm, opt) => {
    opt = opt || {};
    const s = (opt.gross || 1) * mm;
    return '<div style="width:' + s + 'mm;height:' + s + 'mm"' + (opt.klein ? ' data-klein' : '') + '>' + bild(id, { stil: opt.stil }) + '</div>';
  };

  // ---------------------------------------------------------------------
  // Körper der Aufgaben, je nach Art
  // ---------------------------------------------------------------------
  const KOERPER = {
    sortieren(a, el) {
      // Klebeflächen mit Korb unten. Lösung: kleine Bilder in der Fläche
      return '<div class="klebe-koerbe">' + a.koerbe.map((k, i) =>
        '<div class="klebe-korb"><div class="flaeche"><div class="lsg flex lsg-bilder">' +
        a.dinge.filter((d) => a.loesung[d] === i).map((d) => bild(d)).join('') + '</div></div>' +
        '<div class="korb-bild" data-klein>' + sym.korb(k.farbe || 'braun', k.etikett) + '</div></div>').join('') + '</div>';
    },

    ausmalen(a, el) {
      const mm = zahl(el, 'mm', 38);
      const sp = zahl(el, 'spalten', 4);
      const stil = el.getAttribute('stil') || 'umriss';
      return '<div class="malgitter" style="grid-template-columns:repeat(' + sp + ',' + (mm + 6) + 'mm)">' +
        a.dinge.map((d, i) => box(bild(d, { stil }) + (a.loesung.includes(i) ? RING : ''), mm + 6)).join('') + '</div>';
    },

    groesse(a, el) {
      const mm = zahl(el, 'mm', 50);
      const stil = el.getAttribute('stil') || 'umriss';
      if (el.getAttribute('darstellung') === 'stiege') return stiege(a, el, mm, stil);
      const gezeigt = a.anordnung.map((i) => a.stufen[i]);
      return '<div class="reihe basis">' + gezeigt.map((s, pos) => {
        let lsg = '';
        if (a.frage === 'ordnen') lsg = '<div class="lsg lsg-nr">' + sym.punkte(a.loesung.indexOf(pos) + 1, 'var(--rot)') + '</div>';
        else if (a.loesung === pos) lsg = RING;
        return '<div class="feld" style="border:0;padding:0 1mm;width:auto">' + bildBox(a.bild, mm, { gross: s, stil, klein: s < 0.999 }) + lsg + '</div>';
      }).join('') + '</div>';
    },

    passtnicht(a, el) {
      const mm = zahl(el, 'mm', 34);
      const stil = el.getAttribute('stil') || 'farbe';
      if (a.korb) {
        return '<div class="kobold-korb"><div class="inhalt">' +
          a.dinge.map((d, i) => box(bild(d, { stil }) + (i === a.loesung ? RING : ''), mm)).join('') + '</div>' +
          '<div class="korb-bild" data-klein>' + sym.korb(a.korb.farbe || 'braun', a.korb.etikett) + '</div></div>';
      }
      return '<div class="reihe">' + a.dinge.map((d, i) => box(bild(d, { stil }) + (i === a.loesung ? RING : ''), mm)).join('') + '</div>';
    },

    schatten(a, el) {
      const mm = zahl(el, 'mm', 34);
      const zum = a.richtung === 'zum-schatten';
      return '<div class="reihe" style="align-items:center">' +
        box(bild(a.bild, { stil: zum ? 'farbe' : 'schatten' }), mm, ' data-vorne').replace('class="feld"', 'class="feld vorne"') +
        '<div class="trenner" data-klein>' + sym.weiter() + '</div>' +
        a.optionen.map((d, i) => box(bild(d, { stil: zum ? 'schatten' : 'farbe' }) + (i === a.loesung ? RING : ''), mm)).join('') + '</div>';
    },

    'groessen-paare'(a, el) {
      const n = a.stufen.length;
      const L = a.links.map((st) => ({ id: a.bild, gross: a.stufen[st] }));
      const R = a.rechts.map((st) => ({ hoehle: true, gross: a.stufen[st] }));
      return verbinden(el, L, R, a.loesung, { stilL: el.getAttribute('stil') || 'umriss' });
    },
    'schatten-paare'(a, el) {
      const L = a.bilder.map((id) => ({ id }));
      const R = a.schatten.map((i) => ({ id: a.bilder[i], stil: 'schatten' }));
      return verbinden(el, L, R, a.loesung, {});
    },
    'paare-verbinden'(a, el) {
      return verbinden(el, a.links.map((id) => ({ id })), a.rechts.map((id) => ({ id })), a.loesung, { stilL: el.getAttribute('stil') });
    }
  };

  // Zwei Spalten mit Punkten, Lösung als rote Linien. Alle Maße in mm (viewBox in mm)
  function verbinden(el, L, R, loesung, opt) {
    const breite = zahl(el, 'breite', 170);
    const hoehe = zahl(el, 'hoehe', 46 * L.length);
    const n = L.length;
    const zeile = hoehe / n;
    const s = Math.min(zahl(el, 'mm', 36), zeile - 4);
    const inhalt = (o, x, y, stil) => {
      const g = o.gross || 1;
      const k = s * g;
      const xx = x + (s - k) / 2, yy = y + (s - k);
      const innen = o.hoehle ? sym.hoehle().replace('class="sym-svg', 'class="bild-svg sym-svg') : bild(o.id, { stil: o.stil || stil });
      return innen.replace('<svg ', '<svg x="' + xx.toFixed(2) + '" y="' + yy.toFixed(2) + '" width="' + k.toFixed(2) + '" height="' + k.toFixed(2) + '"' + (g < 0.999 ? ' data-klein="1"' : '') + ' ');
    };
    const xL = 0, xR = breite - s;
    const pL = xL + s + 5, pR = xR - 5;
    let svg = '<svg class="verbinden" viewBox="0 0 ' + breite + ' ' + hoehe + '" style="width:' + breite + 'mm;height:' + hoehe + 'mm">';
    for (let i = 0; i < n; i++) {
      const y = i * zeile + (zeile - s) / 2;
      svg += inhalt(L[i], xL, y, opt.stilL || 'farbe') + inhalt(R[i], xR, y, opt.stilR || 'farbe');
      const cy = i * zeile + zeile / 2;
      svg += '<circle cx="' + pL + '" cy="' + cy + '" r="2.4" fill="#1f2340"/><circle cx="' + pR + '" cy="' + cy + '" r="2.4" fill="#1f2340"/>';
    }
    loesung.forEach((j, i) => {
      svg += '<line class="lsg-linie" x1="' + pL + '" y1="' + (i * zeile + zeile / 2) + '" x2="' + pR + '" y2="' + (j * zeile + zeile / 2) + '"/>';
    });
    return svg + '</svg>';
  }

  // Stiege zum Kleben (Größen ordnen) und darunter die Karten zum Ausschneiden
  function stiege(a, el, mm, stil) {
    const n = a.stufen.length;
    const k = zahl(el, 'karte', 55); // Kartengröße
    const breite = n * k + (n - 1) * 4;
    const stufeH = 14;
    const h = k + (n - 1) * stufeH + 6;
    let s = '<svg class="stiege" viewBox="0 0 ' + breite + ' ' + h + '" style="width:' + breite + 'mm;height:' + h + 'mm">';
    // Stufen von links (unten) nach rechts (oben)
    for (let i = 0; i < n; i++) {
      const x = i * (k + 4);
      const top = h - 3 - k - i * stufeH;
      s += '<rect x="' + (x - 2) + '" y="' + (top + k) + '" width="' + (k + 4 + (i < n - 1 ? 0 : 0)) + '" height="' + (h - top - k) + '" fill="#e8dcc8" stroke="#1f2340" stroke-width="0.6"/>';
      s += '<rect x="' + x + '" y="' + top + '" width="' + k + '" height="' + k + '" rx="3" fill="none" stroke="#6b6f86" stroke-width="0.6" stroke-dasharray="3 2"/>';
      // Lösung: der Größe nach
      const st = a.stufen.slice().sort((p, q) => p - q)[i];
      s += '<g class="lsg-linie" style="stroke:none">' + bild(a.bild, { stil }).replace('<svg ', '<svg x="' + (x + (k - 0.8 * k * st) / 2) + '" y="' + (top + k - 0.8 * k * st - 2) + '" width="' + (0.8 * k * st) + '" height="' + (0.8 * k * st) + '" ') + '</g>';
    }
    s += '</svg>';
    const karten = '<div class="karten" style="grid-template-columns:repeat(' + n + ',' + k + 'mm);margin-top:6mm">' +
      a.anordnung.map((i) => '<div class="karte" style="width:' + k + 'mm;height:' + k + 'mm;align-items:flex-end;padding-bottom:3mm">' +
        bildBox(a.bild, k * 0.8, { gross: a.stufen[i], stil, klein: true }) + '</div>').join('') +
      '<div class="karten-schere" data-klein>' + bild('schere') + '</div></div>';
    return '<div style="display:flex;flex-direction:column;align-items:center">' + s + karten + '</div>';
  }

  // ---------------------------------------------------------------------
  // Elemente ersetzen
  // ---------------------------------------------------------------------
  const RENDER = {
    'k-kopf'(el) {
      const seite = el.closest('.seite');
      const e = W.einheiten['e' + (seite && seite.dataset.einheit)];
      const bildId = el.getAttribute('bild') || (e && e.bild) || 'stern';
      return '<div class="kopf"><div class="stern">' + sym.stern(true) + '</div>' +
        '<div class="einheit-bild" data-klein>' + bild(bildId) + '</div>' +
        '<div class="name"><div class="stift" data-klein>' + bild('stift', { stil: 'umriss' }) + '</div><div class="linie"></div></div></div>';
    },

    'k-aufgabe'(el) {
      const refs = el.getAttribute('ref').trim().split(/\s+/);
      const as = refs.map(aufgabe);
      const satz = el.hasAttribute('satz') ? el.getAttribute('satz') : as[0].satz;
      const tun = (el.getAttribute('tun') || '').split(/\s+/).filter(Boolean);
      const kopf = '<div class="aufgabe-kopf">' + tun.map((t) => '<div class="tun" data-klein>' + sym.aufgabe(t) + '</div>').join('') +
        (satz ? '<p class="fuer-mich">' + satz + '</p>' : '') + '</div>';
      const koerper = as.map((a) => {
        const f = KOERPER[a.art];
        if (!f) throw new Error('keine Darstellung für ' + a.art);
        return f(a, el);
      });
      const zusammen = as.length > 1 ? '<div class="kobold-koerbe">' + koerper.join('') + '</div>' : koerper[0];
      // kompakt: Aufgaben-Bild links neben der Reihe, kein Satz (für weitere Reihen derselben Art)
      if (el.hasAttribute('kompakt')) {
        return '<div class="aufgabe kompakt">' + tun.map((t) => '<div class="tun" data-klein>' + sym.aufgabe(t) + '</div>').join('') + '<div class="koerper">' + zusammen + '</div></div>';
      }
      return '<div class="aufgabe' + (el.hasAttribute('wachsen') ? ' wachsen' : '') + '">' + kopf + '<div class="koerper">' + zusammen + '</div></div>';
    },

    'k-karten'(el) {
      let ids = el.hasAttribute('bilder') ? el.getAttribute('bilder').trim().split(/\s+/) : aufgabe(el.getAttribute('ref')).dinge.slice();
      if (el.hasAttribute('doppelt')) {
        // zweimal jedes Bild; die zweite Hälfte um 4 verschoben, damit kein Paar nebeneinander oder untereinander liegt
        const r = Math.min(4, ids.length - 1);
        ids = el.hasAttribute('mischen') ? ids.concat(ids.slice(r), ids.slice(0, r)) : ids.flatMap((i) => [i, i]);
      }
      const sp = zahl(el, 'spalten', 3);
      const mm = zahl(el, 'mm', 55);
      const stil = el.getAttribute('stil') || 'farbe';
      return '<div class="karten" style="grid-template-columns:repeat(' + sp + ',' + mm + 'mm)">' +
        ids.map((id) => '<div class="karte" style="width:' + mm + 'mm;height:' + mm + 'mm"><div style="width:' + (mm * 0.72) + 'mm;height:' + (mm * 0.72) + 'mm">' + bild(id, { stil }) + '</div></div>').join('') +
        '<div class="karten-schere" data-klein>' + bild('schere') + '</div></div>';
    },

    'k-qr'(el) {
      const p = el.getAttribute('paket');
      const q = W.qr[p];
      if (!q) throw new Error('kein Web-Paket ' + p);
      return '<div class="qr" data-url="' + q.url + '">' + q.svg + '<span class="fuer-mich">Bildschirm-Bonus für danach (QR-Code für dich zum Scannen)</span></div>';
    },

    'k-fuss'(el) {
      const seite = el.closest('.seite');
      const e = W.einheiten['e' + seite.dataset.einheit];
      const text = el.getAttribute('text') || ('Blatt ' + seite.id.replace(/^blatt-/, '') + (e ? ' · ' + e.titel : ''));
      return '<div class="fuss fuer-mich"><span>' + text + '</span><span class="seitenzahl" data-ziel="' + seite.id + '"></span></div>';
    },

    'k-bild'(el) {
      return '<span class="bild-inline" data-klein>' + bild(el.getAttribute('b'), { stil: el.getAttribute('stil') || 'farbe' }) + '</span>';
    },
    'k-tun'(el) {
      if (el.hasAttribute('box')) return '<div class="tun" data-klein>' + sym.aufgabe(el.getAttribute('name')) + '</div>';
      return '<span class="bild-inline" data-klein>' + sym.aufgabe(el.getAttribute('name')) + '</span>';
    },
    'k-sammelpass'() {
      // 20 Felder: Bild der Einheit (1–5 schon da, später Sterne), Stempel-Kreis, drei Gesichter zum Anmalen
      let s = '<div class="felder">';
      for (let n = 1; n <= 20; n++) {
        const e = W.einheiten['e' + n];
        s += '<div class="feld"><div class="oben"><div class="bild-klein" data-klein>' + (e ? bild(e.bild) : sym.stern(true)) + '</div>' +
          '<span class="fuer-mich">' + n + '</span></div><div class="stempel"></div>' +
          '<div class="gesichter">' + ['froh', 'mittel', 'muede'].map((g) => sym.gesicht(g)).join('') + '</div></div>';
      }
      return s + '</div>';
    },
    'k-bilderleiste'(el) {
      const mm = zahl(el, 'mm', 38);
      const stil = el.getAttribute('stil') || 'farbe';
      return '<div class="bilder">' + el.getAttribute('bilder').trim().split(/\s+/).map((id) => '<div style="width:' + mm + 'mm;height:' + mm + 'mm">' + bild(id, { stil }) + '</div>').join('') + '</div>';
    },
    'k-titel'(el) {
      const sec = el.closest('[data-einheit]');
      const e = W.einheiten['e' + sec.dataset.einheit];
      const zusatz = el.getAttribute('zusatz') || '';
      return '<h1><span class="einheit-bild" data-klein>' + bild(e.bild) + '</span><span>Einheit ' + e.einheit + ': ' + e.titel + zusatz + '</span></h1>';
    },
    'k-loesungen'(el) {
      // Platzhalter, wird nach dem Rendern der Blätter gefüllt (siehe unten)
      return '<div class="loesungen-raster" data-von="' + el.getAttribute('von') + '"></div>';
    }
  };

  function ersetze(el) {
    const tag = el.tagName.toLowerCase();
    try {
      const html = RENDER[tag](el);
      const t = document.createElement('template');
      t.innerHTML = html;
      el.replaceWith(t.content);
    } catch (e) {
      komponentenFehler(el, tag + ': ' + e.message);
    }
  }

  function fuelleLoesungen() {
    for (const r of document.querySelectorAll('.loesungen-raster[data-von]')) {
      for (const id of r.dataset.von.trim().split(/\s+/)) {
        const s = document.getElementById(id);
        if (!s) { fehler.push('Lösungen: Blatt ' + id + ' gibt es nicht'); continue; }
        const k = s.cloneNode(true);
        k.removeAttribute('id');
        k.querySelectorAll('[id]').forEach((x) => x.removeAttribute('id'));
        k.querySelectorAll('.seitenzahl').forEach((x) => x.remove());
        const m = document.createElement('div');
        m.className = 'loesung-mini loesungsmodus';
        m.innerHTML = '<div class="rahmen-mini"></div><div class="titel-mini">Blatt ' + id.replace('blatt-', '') + '</div>';
        m.firstChild.appendChild(k);
        r.appendChild(m);
      }
    }
  }

  // ---------------------------------------------------------------------
  // Prüfungen (aufgerufen von build.mjs)
  // ---------------------------------------------------------------------
  const BUNDESDEUTSCH = { Treppe: 'Stiege', Tüte: 'Sackerl', Schrank: 'Kasten', Bonbon: 'Zuckerl', Januar: 'Jänner', Kissen: 'Polster', Brötchen: 'Semmel', Sahne: 'Schlagobers', Quark: 'Topfen', Mülleimer: 'Mistkübel', Tomate: 'Paradeiser', Pflaume: 'Zwetschke', Aprikose: 'Marille', Klebeband: 'Malerkrepp oder Tixo', Wäscheklammer: 'Wäschekluppe', Gummiband: 'Gummiringerl', Kartoffel: 'Erdäpfel' };
  const PFLICHT = [['.kasten.ziel', 'Ziel'], ['.kasten.material', 'Material und Vorbereitung'], ['.kasten.kurz', '„Wenn nur Zeit für eins ist“'],
    ['ol.ablauf', 'Ablauf'], ['.sag', 'Sätze zum Sagen'], ['.kasten.stolper', 'Stolpersteine'], ['.kasten.leichter-schwerer', 'Leichter/Schwerer'],
    ['.kasten.knobelei', 'Bonus-Knobelei'], ['.kasten.hintergrund', 'Hintergrund'], ['.kasten.schwester', 'Mit der großen Schwester'],
    ['.kasten.bildschirm', 'Bildschirm-Bonus'], ['.loesungen-raster', 'Lösungen']];

  function textKnoten(wurzel) {
    const w = document.createTreeWalker(wurzel, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (n.nodeValue.trim() && !n.parentElement.closest('style,script') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT)
    });
    const out = [];
    while (w.nextNode()) out.push(w.currentNode);
    return out;
  }
  const sichtbar = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; };

  window.__pruefe = function () {
    const f = fehler.slice();
    const w = warnungen.slice();
    const echteSeiten = Array.from(document.querySelectorAll('.seite')).filter((s) => !s.closest('.loesungsmodus'));
    for (const s of echteSeiten) {
      const name = s.id || (s.className + ' ' + (s.dataset.einheit || ''));
      const R = s.getBoundingClientRect();
      const rand = 5 * MM;
      // Überlauf: kein sichtbares Element ragt über die Seite oder in den Druckrand
      for (const el of s.querySelectorAll('*')) {
        if (el.closest('.lsg,svg') && el.tagName.toLowerCase() !== 'svg') continue;
        if (!sichtbar(el)) continue;
        const r = el.getBoundingClientRect();
        if (r.bottom > R.bottom - rand + 0.5 || r.right > R.right - rand + 0.5 || r.left < R.left + rand - 0.5 || r.top < R.top + rand - 0.5) {
          f.push(name + ': ' + el.tagName.toLowerCase() + '.' + (el.getAttribute('class') || '') + ' ragt in den Druckrand oder über die Seite (unten ' + ((r.bottom - R.top) / MM).toFixed(1) + ' mm)');
          break;
        }
      }
      if (s.scrollHeight > s.clientHeight + 1) f.push(name + ': Inhalt zu hoch für eine A4-Seite');
      if (!s.classList.contains('blatt') && !s.classList.contains('kind')) continue;
      // Kein Text für das Kind: alles, was Text ist, muss in .fuer-mich stehen
      for (const t of textKnoten(s)) {
        if (!t.parentElement.closest('.fuer-mich,.lsg')) f.push(name + ': Text auf dem Blatt des Kindes: „' + t.nodeValue.trim().slice(0, 40) + '“ (nur in .fuer-mich erlaubt)');
      }
      // Bildgrößen
      for (const b of s.querySelectorAll('svg.bild-svg')) {
        if (b.closest('.lsg, .tun') || !sichtbar(b)) continue; // Aufgaben-Bilder im Kästchen sind Symbole, keine Bilder zum Erkennen
        let min;
        if (b.ownerSVGElement) {
          // verschachteltes SVG (z. B. beim Verbinden): Größe aus width/height in Einheiten des äußeren SVG
          const aussen = b.ownerSVGElement;
          const proEinheit = aussen.getBoundingClientRect().width / aussen.viewBox.baseVal.width;
          min = Math.min(b.width.baseVal.value, b.height.baseVal.value) * proEinheit / MM;
        } else {
          const r = b.getBoundingClientRect();
          min = Math.min(r.width, r.height) / MM;
        }
        const klein = b.closest('[data-klein]') || b.hasAttribute('data-klein');
        if (min < (klein ? 12 : 25) - 0.2) f.push(name + ': Bild ' + b.dataset.bild + ' nur ' + min.toFixed(1) + ' mm groß (mindestens ' + (klein ? 12 : 25) + ' mm)');
      }
      for (const k of s.querySelectorAll('.karte')) {
        const r = k.getBoundingClientRect();
        if (Math.min(r.width, r.height) / MM < 49.5) f.push(name + ': Ausschneide-Karte kleiner als 5 cm');
      }
      if (s.classList.contains('blatt') && !s.querySelector('.kopf')) f.push(name + ': Kopf fehlt (<k-kopf>)');
      if (s.classList.contains('blatt') && !s.querySelector('.fuss')) f.push(name + ': Fußzeile fehlt (<k-fuss>)');
    }
    // Anleitungen: Pflichtteile, Ablauf mit Minuten, Spickzettel passt dazu
    for (const a of document.querySelectorAll('section.anleitung[data-einheit]')) {
      const n = a.dataset.einheit;
      for (const [sel, wort] of PFLICHT) if (!a.querySelector(sel)) f.push('Anleitung Einheit ' + n + ': ' + wort + ' fehlt');
      const min = Array.from(a.querySelectorAll('ol.ablauf > li')).map((li) => +li.dataset.min);
      if (min.some((m) => !(m > 0))) f.push('Anleitung Einheit ' + n + ': jeder Schritt im Ablauf braucht data-min');
      const summe = min.reduce((x, y) => x + y, 0);
      if (summe < 10 || summe > 20) f.push('Anleitung Einheit ' + n + ': Ablauf dauert ' + summe + ' Minuten (soll 10–20)');
      const sp = document.querySelector('section.spick[data-einheit="' + n + '"]');
      if (!sp) f.push('Spickzettel für Einheit ' + n + ' fehlt');
      else {
        const smin = Array.from(sp.querySelectorAll('ol.ablauf > li')).map((li) => +li.dataset.min);
        if (JSON.stringify(smin) !== JSON.stringify(min)) f.push('Spickzettel Einheit ' + n + ': Minuten ' + smin.join('+') + ' passen nicht zur Anleitung (' + min.join('+') + ')');
      }
      if (a.querySelector('.loesungen-raster') && !a.querySelector('.loesungen-raster .loesung-mini')) f.push('Anleitung Einheit ' + n + ': Lösungen leer');
    }
    // Blatt-Verweise zeigen auf echte Blätter
    for (const r of document.querySelectorAll('a.blattref')) {
      const id = (r.getAttribute('href') || '').slice(1);
      if (!document.getElementById(id)) f.push('Verweis auf ' + id + ' zeigt ins Leere');
    }
    // Aufgaben nur fürs Papier, die nirgends verwendet werden
    for (const [e, ein] of Object.entries(W.einheiten)) {
      for (const [id, a] of Object.entries(ein.aufgaben)) {
        if (a.web === false && !benutzt.has(e + ':' + id) && !W.teilBuild) w.push('Aufgabe ' + e + ':' + id + ' steht auf keinem Blatt');
      }
    }
    // Österreichisches Deutsch (Warnung)
    const alleTexte = textKnoten(document.body).filter((t) => !t.parentElement.closest('.loesungsmodus'));
    const text = alleTexte.map((t) => t.nodeValue).join(' ');
    for (const [wort, at] of Object.entries(BUNDESDEUTSCH)) {
      if (new RegExp('\\b' + wort + '(n|e|en|s)?\\b').test(text)) w.push('„' + wort + '“: in Österreich eher „' + at + '“');
    }
    // Zeichen pro Schrift (für die Prüfung in build.mjs)
    const zeichen = {};
    for (const t of alleTexte) {
      const fam = getComputedStyle(t.parentElement).fontFamily.split(',')[0].replace(/["']/g, '').trim();
      (zeichen[fam] = zeichen[fam] || new Set());
      for (const c of t.nodeValue) if (!/\s/.test(c)) zeichen[fam].add(c);
    }
    const blaetter = echteSeiten.filter((s) => s.classList.contains('blatt')).length;
    return {
      fehler: f, warnungen: w,
      zeichen: Object.fromEntries(Object.entries(zeichen).map(([k, v]) => [k, [...v]])),
      statistik: { seiten: echteSeiten.length, blaetter, aufgaben: benutzt.size }
    };
  };

  // Seitenzahlen eintragen: map Ziel-id → Seite (aus pdfinfo -dests)
  window.__setzeSeiten = function (map) {
    const fehlt = [];
    for (const el of document.querySelectorAll('.seitenzahl[data-ziel]')) {
      const s = map[el.dataset.ziel];
      if (!s) fehlt.push(el.dataset.ziel);
      el.textContent = s ? String(s) : '';
    }
    for (const a of document.querySelectorAll('a.blattref')) {
      const id = a.getAttribute('href').slice(1);
      const s = map[id];
      if (!s) fehlt.push(id);
      a.textContent = 'Blatt ' + id.replace('blatt-', '') + (s ? ' (S. ' + s + ')' : '');
    }
    return [...new Set(fehlt)];
  };

  function los() {
    // Erst die Blätter und Rahmen, dann die Lösungen (sie klonen die fertigen Blätter)
    let el;
    while ((el = document.querySelector(Object.keys(RENDER).join(',')))) ersetze(el);
    for (const a of document.querySelectorAll('a.blattref')) a.textContent = 'Blatt ' + a.getAttribute('href').replace('#blatt-', '');
    fuelleLoesungen();
    window.__fertig = true;
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', los);
  else los();
})();
