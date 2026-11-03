// Bilder-Sammlung: ein Ort für alle Bilder (Blätter, Anleitung, Web-App, Prüfung).
//
//   Bilder.init({ katalog, svg })   katalog aus bilder/katalog.json, svg: { HEX: { farbe, umriss } } aus bilder/openmoji/
//   Bilder.merkmale(id)              { id, name, art, farbe, bewegt, form, muster, frisst, gehoert } oder null
//   Bilder.svg(id, { stil })         stil: 'farbe' (Standard) | 'umriss' (zum Anmalen) | 'schatten'
//   Bilder.alle()                    alle ids aus dem Katalog
//
// Neben dem Katalog gibt es Bilder, die aus ihrer id entstehen (selbst gezeichnet, im Stil von OpenMoji):
//   form-<kreis|dreieck|viereck|stern|herz>-<rot|blau|gelb|gruen>
//   socke-<uni|streifen|punkte|herzen>-<rot|blau|gelb|gruen>
// Alle Bilder haben viewBox 0 0 72 72 wie OpenMoji.
(function (g) {
  'use strict';

  const TINTE = '#000';
  const SCHATTEN = '#3b3d4f';
  // Farben wie in der OpenMoji-Palette
  const FARBEN = { rot: '#ea5a47', blau: '#61b2e4', gelb: '#fcea2b', gruen: '#b1cc33', orange: '#f4aa41', lila: '#b399c8', rosa: '#e67a94', braun: '#a57939', grau: '#9b9b9a' };
  const FARB_NAMEN = { rot: 'rot', blau: 'blau', gelb: 'gelb', gruen: 'grün', orange: 'orange', braun: 'braun', grau: 'grau', rosa: 'rosa', weiss: 'weiß', lila: 'lila', schwarz: 'schwarz' };
  const FORM_NAMEN = { kreis: 'der Kreis', dreieck: 'das Dreieck', viereck: 'das Viereck', stern: 'der Stern', herz: 'das Herz' };
  const MUSTER_NAMEN = { uni: 'ohne Muster', streifen: 'mit Streifen', punkte: 'mit Punkten', herzen: 'mit Herzen' };

  let katalog = {};
  let svgDaten = {};

  const strich = (w) => ' stroke="' + TINTE + '" stroke-width="' + (w || 2) + '" stroke-linecap="round" stroke-linejoin="round"';

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
  // Selbst gezeichnete Bilder
  // ---------------------------------------------------------------------
  const FORMEN = {
    kreis: (f) => '<circle cx="36" cy="36" r="26" fill="' + f + '"' + strich() + '/>',
    dreieck: (f) => '<path d="M36 9 L64 59 L8 59 Z" fill="' + f + '"' + strich() + '/>',
    viereck: (f) => '<rect x="12" y="12" width="48" height="48" fill="' + f + '"' + strich() + '/>',
    stern: (f) => '<path d="' + sternPfad(36, 38, 28, 12) + '" fill="' + f + '"' + strich() + '/>',
    herz: (f) => '<path d="M36 62 C10 46 6 30 14 20 C21 11 32 13 36 23 C40 13 51 11 58 20 C66 30 62 46 36 62 Z" fill="' + f + '"' + strich() + '/>'
  };

  // Socke: Schaft links oben, Fuß nach rechts. Muster nur im Schaft (Streifen genau so breit wie der Schaft) und an Ferse/Spitze.
  const SOCKE_UMRISS = 'M17 4 H43 V37 L59 44 C69 48 69 64 59 66 C55 67 49 66 45 65 L25 61 C14 58 12 49 17 42 Z';
  function socke(muster, farbe) {
    const f = FARBEN[farbe];
    let s = '<path d="' + SOCKE_UMRISS + '" fill="#fff"' + strich() + '/>';
    if (muster === 'uni') s = '<path d="' + SOCKE_UMRISS + '" fill="' + f + '"' + strich() + '/>';
    else if (muster === 'streifen') s += [15, 23, 31].map((y) => '<rect x="17" y="' + y + '" width="26" height="5" fill="' + f + '"/>').join('');
    else if (muster === 'punkte') s += [[24, 17], [36, 22], [24, 29], [36, 34], [50, 56], [60, 53]].map((p) => '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="3.8" fill="' + f + '"/>').join('');
    else if (muster === 'herzen') s += [[25, 18, 5], [36, 30, 5], [53, 56, 4.5]].map((p) => '<path d="' + HERZ(p[0], p[1], p[2]) + '" fill="' + f + '"/>').join('');
    // Bündchen oben, Umriss nochmal drüber (Muster bleibt innen)
    s += '<path d="M17 11 H43" fill="none"' + strich() + '/>';
    s += '<path d="' + SOCKE_UMRISS + '" fill="none"' + strich() + '/>';
    return s;
  }

  // Der Fehler-Kobold (wie in der Werkstatt der großen Schwester): lieb und frech, nie gruselig
  const KOBOLD = '<g transform="translate(1 0) scale(0.7)">' +
    '<path d="M22 40 L4 26 L26 32 Z M78 40 L96 26 L74 32 Z" fill="#9ad16b"' + strich(3) + '/>' +
    '<ellipse cx="50" cy="66" rx="24" ry="22" fill="#c25a9e"' + strich(3.2) + '/>' +
    '<ellipse cx="38" cy="90" rx="7" ry="5" fill="#9ad16b"' + strich(3) + '/><ellipse cx="62" cy="90" rx="7" ry="5" fill="#9ad16b"' + strich(3) + '/>' +
    '<circle cx="50" cy="42" r="24" fill="#9ad16b"' + strich(3.2) + '/>' +
    '<path d="M28 30 C30 6 70 6 72 30 C62 24 38 24 28 30 Z" fill="#c25a9e"' + strich(3) + '/>' +
    '<circle cx="78" cy="10" r="5" fill="#fcea2b"' + strich(2.5) + '/><path d="M70 22 L77 13" fill="none"' + strich(2.5) + '/>' +
    '<circle cx="41" cy="42" r="5" fill="#fff"' + strich(2) + '/><circle cx="59" cy="42" r="5" fill="#fff"' + strich(2) + '/>' +
    '<circle cx="42" cy="43" r="2.3" fill="' + TINTE + '"/><circle cx="58" cy="43" r="2.3" fill="' + TINTE + '"/>' +
    '<path d="M40 54 C46 60 54 60 60 54" fill="none"' + strich(3) + '/>' +
    '<path d="M46 56 L48 60 L50 56" fill="#fff"' + strich(1.5) + '/></g>';

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

  // Schatten: alle Flächen und Linien in einer dunklen Farbe
  const zuSchatten = (inner) => '<g fill="' + SCHATTEN + '">' + inner
    .replace(/fill="(?!none)[^"]*"/g, 'fill="' + SCHATTEN + '"')
    .replace(/stroke="(?!none)[^"]*"/g, 'stroke="' + SCHATTEN + '"') + '</g>';
  // Umriss eines eigenen Bildes: Flächen weiß, schwarze Teile (Augen) bleiben
  const zuUmriss = (inner) => inner.replace(/fill="(?!none|#000|#fff)[^"]*"/g, 'fill="#fff"');
  const innen = (svg) => svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');

  function inneres(id, stil) {
    const eigen = eigenesInneres(id);
    if (eigen !== null) return stil === 'schatten' ? zuSchatten(eigen) : stil === 'umriss' ? zuUmriss(eigen) : eigen;
    const b = katalog[id];
    if (!b) throw new Error('Unbekanntes Bild: ' + id);
    if (b.quelle.startsWith('openmoji:')) {
      const hex = b.quelle.slice(9);
      const d = svgDaten[hex];
      if (!d) throw new Error('SVG fehlt für ' + id + ' (' + hex + ')');
      if (stil === 'umriss') return innen(d.umriss);
      if (stil === 'schatten') return zuSchatten(innen(d.farbe));
      return innen(d.farbe);
    }
    throw new Error('Bild ' + id + ': Quelle ' + b.quelle + ' unbekannt');
  }

  function svg(id, opt) {
    opt = opt || {};
    const stil = opt.stil || 'farbe';
    return '<svg class="bild-svg' + (opt.klasse ? ' ' + opt.klasse : '') + '" viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" data-bild="' + id + '" data-stil="' + stil + '">' +
      inneres(id, stil) + '</svg>';
  }

  g.Bilder = {
    init(daten) { katalog = daten.katalog || {}; svgDaten = daten.svg || {}; },
    merkmale, svg,
    gibt: (id) => merkmale(id) !== null,
    alle: () => Object.keys(katalog),
    FARBEN, FARB_NAMEN, FORM_NAMEN, MUSTER_NAMEN,
    FORM_LISTE: Object.keys(FORMEN), MUSTER_LISTE: Object.keys(MUSTER_NAMEN)
  };
  if (g.BILDER_DATEN) g.Bilder.init(g.BILDER_DATEN);
})(typeof window !== 'undefined' ? window : globalThis);
