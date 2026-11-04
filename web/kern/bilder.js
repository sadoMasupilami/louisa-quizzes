// Bilder-Sammlung: ein Ort für alle Bilder (Blätter, Anleitung, Web-App, Prüfung).
//
//   Bilder.init({ katalog, svg })   katalog aus bilder/katalog.json, svg: { id: { farbe, umriss, schatten } } aus bilder/fluent/
//   Bilder.merkmale(id)              { id, name, art, farbe, bewegt, form, muster, frisst, gehoert } oder null
//   Bilder.svg(id, { stil, klasse }) stil: 'farbe' (Standard) | 'umriss' (zum Anmalen) | 'schatten'
//   Bilder.alle()                    alle ids aus dem Katalog
//
// Die Tiere und Dinge sind Fluent Emoji (Microsoft, MIT-Lizenz), viewBox 0 0 32 32.
// Selbst gezeichnet im selben weichen Stil (ohne schwarze Ränder, Ränder in einer dunkleren Farbe), viewBox 0 0 72 72:
//   kobold (der Fehler-Kobold)
//   form-<kreis|dreieck|viereck|stern|herz>-<rot|blau|gelb|gruen>
//   socke-<uni|streifen|punkte|herzen>-<rot|blau|gelb|gruen>
(function (g) {
  'use strict';

  const TINTE = '#1f2340';
  const SCHATTEN = '#3b3d4f';
  // Farben wie in Fluent Emoji
  const FARBEN = { rot: '#f8312f', blau: '#00a6ed', gelb: '#fcd53f', gruen: '#00d26a', orange: '#ff822d', lila: '#8d65c5', rosa: '#ff6dc6', braun: '#a56953', grau: '#9b9b9b' };
  const FARB_NAMEN = { rot: 'rot', blau: 'blau', gelb: 'gelb', gruen: 'grün', orange: 'orange', braun: 'braun', grau: 'grau', rosa: 'rosa', weiss: 'weiß', lila: 'lila', schwarz: 'schwarz' };
  const FORM_NAMEN = { kreis: 'der Kreis', dreieck: 'das Dreieck', viereck: 'das Viereck', stern: 'der Stern', herz: 'das Herz' };
  const MUSTER_NAMEN = { uni: 'ohne Muster', streifen: 'mit Streifen', punkte: 'mit Punkten', herzen: 'mit Herzen' };

  let katalog = {};
  let svgDaten = {};

  // Dunklere Variante einer Farbe (für Ränder, wie bei Fluent)
  function dunkel(hex, anteil) {
    const a = anteil == null ? 0.7 : anteil;
    const n = parseInt(hex.slice(1), 16);
    const k = (v) => Math.round(v * a).toString(16).padStart(2, '0');
    return '#' + k(n >> 16) + k((n >> 8) & 255) + k(n & 255);
  }
  const rand = (farbe, w) => ' stroke="' + farbe + '" stroke-width="' + (w || 2.2) + '" stroke-linecap="round" stroke-linejoin="round"';
  const flaeche = (f, w) => ' fill="' + f + '"' + rand(dunkel(f), w);
  // Glanzlicht: fällt beim Umriss und beim Schatten weg
  const glanz = (d) => '<path class="glanz" d="' + d + '" fill="#fff" opacity="0.45"/>';

  function sternPfad(cx, cy, ra, ri) {
    let d = '';
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? ri : ra;
      const w = -Math.PI / 2 + i * Math.PI / 5;
      d += (i ? 'L' : 'M') + (cx + r * Math.cos(w)).toFixed(2) + ' ' + (cy + r * Math.sin(w)).toFixed(2) + ' ';
    }
    return d + 'Z';
  }
  const HERZ = (x, y, s) => 'M' + x + ' ' + (y + 0.9 * s) + ' C' + (x - 1.6 * s) + ' ' + (y - 0.1 * s) + ' ' + (x - 0.9 * s) + ' ' + (y - 1.1 * s) + ' ' + x + ' ' + (y - 0.35 * s) +
    ' C' + (x + 0.9 * s) + ' ' + (y - 1.1 * s) + ' ' + (x + 1.6 * s) + ' ' + (y - 0.1 * s) + ' ' + x + ' ' + (y + 0.9 * s) + ' Z';

  // ---------------------------------------------------------------------
  // Selbst gezeichnete Bilder (viewBox 0 0 72 72)
  // ---------------------------------------------------------------------
  const FORMEN = {
    kreis: (f) => '<circle cx="36" cy="36" r="27"' + flaeche(f) + '/>' + glanz('M20 26 C24 16 34 12 42 13 C34 16 27 21 24 30 Z'),
    dreieck: (f) => '<path d="M36 8 L65 60 L7 60 Z"' + flaeche(f) + '/>' + glanz('M33 18 L36 13 L39 18 L24 46 L20 46 Z'),
    viereck: (f) => '<rect x="11" y="11" width="50" height="50" rx="5"' + flaeche(f) + '/>' + glanz('M17 17 H40 L37 21 H21 V40 L17 43 Z'),
    stern: (f) => '<path d="' + sternPfad(36, 38, 30, 13) + '"' + flaeche(f) + '/>' + glanz('M33 17 L36 10 L38 19 L31 32 Z'),
    herz: (f) => '<path d="M36 63 C10 47 5 31 13 20 C20 11 32 12 36 23 C40 12 52 11 59 20 C67 31 62 47 36 63 Z"' + flaeche(f) + '/>' + glanz('M16 24 C19 17 26 15 30 18 C25 19 21 23 19 30 Z')
  };

  // Socke: Schaft links oben, Fuß nach rechts. Muster im Schaft und am Fuß. Weiße Socken haben einen grauen Rand.
  const SOCKE = 'M17 4 H43 V37 L59 44 C69 48 69 64 59 66 C55 67 49 66 45 65 L25 61 C14 58 12 49 17 42 Z';
  function socke(muster, farbe) {
    const f = FARBEN[farbe];
    const r = dunkel(f);
    const grund = muster === 'uni' ? f : '#ffffff';
    const randFarbe = muster === 'uni' ? r : '#b4acbc';
    let s = '<path d="' + SOCKE + '" fill="' + grund + '"' + rand(randFarbe) + '/>';
    if (muster === 'streifen') s += [15, 24, 33].map((y) => '<rect x="18.2" y="' + y + '" width="23.6" height="5" fill="' + f + '"/>').join('');
    else if (muster === 'punkte') s += [[24, 17], [36, 22], [24, 29], [36, 34], [50, 56], [60, 54]].map((p) => '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="3.9" fill="' + f + '"/>').join('');
    else if (muster === 'herzen') s += [[25, 18, 5], [36, 30, 5], [53, 56, 4.5]].map((p) => '<path d="' + HERZ(p[0], p[1], p[2]) + '" fill="' + f + '"/>').join('');
    // Bündchen oben in der Farbe der Socke
    s += '<path d="M18.2 5.2 H41.8 V11 H18.2 Z" fill="' + (muster === 'uni' ? dunkel(f, 0.85) : f) + '"/>';
    s += '<path d="' + SOCKE + '" fill="none"' + rand(randFarbe) + '/>';
    if (muster === 'uni') s += glanz('M21 14 H25 V40 L21 44 Z');
    return s;
  }

  // Der Fehler-Kobold (wie in der Werkstatt der großen Schwester): lieb und frech, nie gruselig
  const K = { haut: '#7bd67b', mantel: '#9b5bd4', gold: '#fcd53f', auge: '#402a32' };
  const KOBOLD = '<g transform="translate(1 0) scale(0.7)">' +
    '<path d="M22 40 L3 25 L27 31 Z M78 40 L97 25 L73 31 Z"' + flaeche(K.haut, 2.6) + '/>' +
    '<ellipse cx="50" cy="67" rx="25" ry="22"' + flaeche(K.mantel, 2.8) + '/>' +
    glanz('M32 58 C36 50 44 47 50 47 C42 51 37 56 35 64 Z') +
    '<ellipse cx="37" cy="90" rx="8" ry="5.5"' + flaeche(K.haut, 2.4) + '/><ellipse cx="63" cy="90" rx="8" ry="5.5"' + flaeche(K.haut, 2.4) + '/>' +
    '<circle cx="50" cy="42" r="25"' + flaeche(K.haut, 2.8) + '/>' +
    glanz('M31 34 C34 25 42 21 49 21 C41 25 36 30 34 38 Z') +
    '<path d="M27 31 C29 5 71 5 73 31 C62 24 38 24 27 31 Z"' + flaeche(K.mantel, 2.6) + '/>' +
    '<circle cx="79" cy="9" r="6"' + flaeche(K.gold, 2.2) + '/><path d="M70 22 L77 13" fill="none"' + rand(dunkel(K.mantel), 2.6) + '/>' +
    '<ellipse cx="41" cy="42" rx="6" ry="6.5" fill="#fff"/><ellipse cx="59" cy="42" rx="6" ry="6.5" fill="#fff"/>' +
    '<circle cx="42.5" cy="43" r="3.4" fill="' + K.auge + '"/><circle cx="57.5" cy="43" r="3.4" fill="' + K.auge + '"/>' +
    '<circle cx="43.6" cy="41.8" r="1.1" fill="#fff"/><circle cx="58.6" cy="41.8" r="1.1" fill="#fff"/>' +
    '<path d="M39 54 C45 61 55 61 61 54" fill="none"' + rand(K.auge, 2.8) + '/>' +
    '<path d="M46 57 L48 61 L50 57.5" fill="#fff"/>' +
    '<circle cx="33" cy="51" r="3.5" fill="#ff8fb1" opacity="0.6" class="glanz"/><circle cx="67" cy="51" r="3.5" fill="#ff8fb1" opacity="0.6" class="glanz"/></g>';

  function eigenesInneres(id) {
    let m;
    if (id === 'kobold') return KOBOLD;
    if ((m = /^form-(\w+)-(\w+)$/.exec(id)) && FORMEN[m[1]] && FARBEN[m[2]]) return FORMEN[m[1]](FARBEN[m[2]]);
    if ((m = /^socke-(\w+)-(\w+)$/.exec(id)) && MUSTER_NAMEN[m[1]] && FARBEN[m[2]]) return socke(m[1], m[2]);
    return null;
  }

  // ---------------------------------------------------------------------
  // Merkmale
  // ---------------------------------------------------------------------
  function merkmale(id) {
    let m;
    if ((m = /^form-(\w+)-(\w+)$/.exec(id)) && FORMEN[m[1]] && FARBEN[m[2]]) {
      return { id, name: FORM_NAMEN[m[1]] + ' (' + FARB_NAMEN[m[2]] + ')', art: 'form', form: m[1], farbe: m[2], bewegt: null, frisst: [], gehoert: [] };
    }
    if ((m = /^socke-(\w+)-(\w+)$/.exec(id)) && MUSTER_NAMEN[m[1]] && FARBEN[m[2]]) {
      return { id, name: 'die Socke ' + MUSTER_NAMEN[m[1]] + ' (' + FARB_NAMEN[m[2]] + ')', art: 'ding', muster: m[1], farbe: m[2], bewegt: null, frisst: [], gehoert: [] };
    }
    const b = katalog[id];
    if (!b) return null;
    return { id, name: b.name, art: b.art, farbe: b.farbe ?? null, bewegt: b.bewegt ?? null, form: b.form ?? null, frisst: b.frisst || [], gehoert: b.gehoert || [], quelle: b.quelle };
  }

  // Eigene Bilder als Umriss (Flächen weiß, Ränder dunkel) oder Schatten (alles dunkel). Glanzlichter fallen weg.
  const ohneGlanz = (s) => s.replace(/<[^>]*class="glanz"[^>]*\/>/g, '');
  const zuUmriss = (s) => ohneGlanz(s)
    .replace(/fill="(?!none)[^"]*"/g, 'fill="#fff"')
    .replace(/stroke="(?!none)[^"]*"/g, 'stroke="' + TINTE + '"');
  const zuSchatten = (s) => '<g fill="' + SCHATTEN + '">' + ohneGlanz(s)
    .replace(/fill="(?!none)[^"]*"/g, 'fill="' + SCHATTEN + '"')
    .replace(/stroke="(?!none)[^"]*"/g, 'stroke="' + SCHATTEN + '"') + '</g>';

  function svg(id, opt) {
    opt = opt || {};
    const stil = opt.stil || 'farbe';
    const attr = ' class="bild-svg' + (opt.klasse ? ' ' + opt.klasse : '') + '" aria-hidden="true" data-bild="' + id + '" data-stil="' + stil + '"';
    const eigen = eigenesInneres(id);
    if (eigen !== null) {
      let inner = eigen;
      if (stil === 'umriss') {
        inner = zuUmriss(eigen);
        // beim Kobold die Pupillen dunkel lassen
        if (id === 'kobold') inner = inner.replace(/<circle cx="(42\.5|57\.5)" cy="43" r="3\.4" fill="#fff"/g, '<circle cx="$1" cy="43" r="3.4" fill="' + TINTE + '"');
      } else if (stil === 'schatten') inner = zuSchatten(eigen);
      return '<svg viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg"' + attr + '>' + inner + '</svg>';
    }
    const b = katalog[id];
    if (!b) throw new Error('Unbekanntes Bild: ' + id);
    const d = svgDaten[id];
    if (!d || !d[stil]) throw new Error('SVG fehlt für ' + id + ' (' + stil + ')');
    let out = d[stil];
    // Jede eingesetzte Kopie bekommt eigene ids: Sonst zeigen Farbverläufe auf eine versteckte Kopie
    // (z. B. in den Lösungen oder in einem ausgeblendeten Teil) und das Bild bleibt leer.
    if (out.indexOf(' id="') >= 0) {
      const n = ++zaehler;
      const e = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      out = out.replace(new RegExp('(id="|#)' + e + '-', 'g'), '$1' + id + '-' + n + '-');
    }
    return out.replace(/^<svg/, '<svg' + attr);
  }
  let zaehler = 0;

  g.Bilder = {
    init(daten) { katalog = daten.katalog || {}; svgDaten = daten.svg || {}; },
    merkmale, svg, dunkel,
    gibt: (id) => merkmale(id) !== null,
    alle: () => Object.keys(katalog),
    FARBEN, FARB_NAMEN, FORM_NAMEN, MUSTER_NAMEN,
    FORM_LISTE: Object.keys(FORMEN), MUSTER_LISTE: Object.keys(MUSTER_NAMEN)
  };
  if (g.BILDER_DATEN) g.Bilder.init(g.BILDER_DATEN);
})(typeof window !== 'undefined' ? window : globalThis);
