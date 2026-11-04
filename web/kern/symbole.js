// Symbole: Aufgaben-Bilder (was {{KIND}} tun soll), Körbe, Höhlen, Geschafft-Stern, Gesichter, Punkte.
// Einmal als SVG gezeichnet, überall gleich (Blätter, Anleitung, Web-App). Nie als Schriftzeichen.
//
//   Symbole.aufgabe(name)        anmalen | verbinden | einkreisen | kleben | schneiden | zeigen | schauen | sagen
//   Symbole.korb(farbe, etikett) Korb in einer Farbe (rot, blau …) oder weiß; etikett: Bild-id fürs Schild vorne
//   Symbole.hoehle()             Höhle (für „Welcher Drache passt hinein?“)
//   Symbole.stern(leer)          Geschafft-Stern (leer = zum Anmalen)
//   Symbole.gesicht(art)         froh | mittel | muede (Sammelpass: „Wie hat's dir gefallen?“)
//   Symbole.punkte(n, farbe)     n Punkte wie am Würfel (1–6), für Nummern ohne Ziffern
//   Symbole.haus(), Symbole.erwachsene()   Knöpfe der Web-App
(function (g) {
  'use strict';
  const T = '#3d3850';
  const strich = (w, farbe) => ' stroke="' + (farbe || T) + '" stroke-width="' + (w || 2) + '" stroke-linecap="round" stroke-linejoin="round"';
  // Fläche mit Rand in einer dunkleren Farbe (weicher Stil wie Fluent Emoji)
  const weich = (f, w) => ' fill="' + f + '"' + strich(w || 2, g.Bilder.dunkel(f));
  const svg = (inner, vb, klasse) => '<svg class="sym-svg' + (klasse ? ' ' + klasse : '') + '" viewBox="' + (vb || '0 0 72 72') + '" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' + inner + '</svg>';
  const B = () => g.Bilder;
  // Bild aus der Bilder-Sammlung als verschachteltes SVG an eine Stelle setzen
  const bildAn = (id, x, y, gr) => B().svg(id).replace(/^<svg/, '<svg x="' + x + '" y="' + y + '" width="' + gr + '" height="' + gr + '"');

  function sternPfad(cx, cy, ra, ri) {
    let d = '';
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? ri : ra;
      const w = -Math.PI / 2 + i * Math.PI / 5;
      d += (i ? 'L' : 'M') + (cx + r * Math.cos(w)).toFixed(2) + ' ' + (cy + r * Math.sin(w)).toFixed(2) + ' ';
    }
    return d + 'Z';
  }

  // ---------------------------------------------------------------------
  // Aufgaben-Bilder
  // ---------------------------------------------------------------------
  const WACHSMAL = (x, y, farbe) =>
    '<g transform="translate(' + x + ' ' + y + ') rotate(40)">' +
    '<rect x="-5" y="-22" width="10" height="34" rx="2"' + weich(farbe) + '/>' +
    '<path d="M-5 12 L0 22 L5 12 Z"' + weich(farbe) + '/>' +
    '<path d="M-5 -14 H5 M-5 4 H5" fill="none"' + strich(1.5, g.Bilder.dunkel(farbe)) + '/></g>';
  const AUFGABEN = {
    // Wachsmalkreide und Gekritzel
    anmalen: '<path d="M8 58 C14 48 20 62 26 52 C32 42 36 58 42 48 C46 42 50 52 54 46" fill="none" stroke="#f8312f" stroke-width="5" stroke-linecap="round"/>' +
      WACHSMAL(46, 28, '#00a6ed'),
    // zwei Bilder, mit einer Linie verbunden
    verbinden: '<rect x="5" y="8" width="20" height="20" rx="4"' + weich('#fcd53f') + '/>' +
      '<circle cx="57" cy="54" r="10"' + weich('#00d26a') + '/>' +
      '<path d="M25 24 C40 30 36 46 47 50" fill="none" stroke="#f8312f" stroke-width="4" stroke-linecap="round"/>' +
      '<circle cx="25" cy="24" r="3" fill="#f8312f"/><circle cx="47" cy="50" r="3" fill="#f8312f"/>',
    // ein Bild mit einem Kreis außen herum
    einkreisen: '<path d="' + sternPfad(36, 38, 15, 7) + '"' + weich('#fcd53f') + '/>' +
      '<path d="M50 14 C64 20 66 50 46 60 C30 68 8 58 8 38 C8 20 26 10 44 14" fill="none" stroke="#f8312f" stroke-width="4.5" stroke-linecap="round"/>',
    // Klebestift
    kleben: '<rect x="24" y="30" width="24" height="34" rx="3"' + weich('#00a6ed') + '/>' +
      '<rect x="26" y="20" width="20" height="10"' + weich('#ffffff') + '/>' +
      '<path d="M28 20 C28 12 44 12 44 20"' + weich('#f3eef8') + '/>' +
      '<path d="M24 42 H48" fill="none"' + strich(1.5, g.Bilder.dunkel('#00a6ed')) + '/>' +
      '<path d="M14 10 L18 16 M36 4 V10 M58 10 L54 16" fill="none"' + strich(2) + '/>',
    schneiden: null, zeigen: null, schauen: null, sagen: null
  };
  const AUFGABE_BILD = { schneiden: 'schere', zeigen: 'zeigefinger', schauen: 'augen', sagen: 'sprechen' };
  function aufgabe(name) {
    if (AUFGABE_BILD[name]) return B().svg(AUFGABE_BILD[name], { klasse: 'sym-svg aufgabe-' + name });
    if (!AUFGABEN[name]) throw new Error('Unbekanntes Aufgaben-Bild: ' + name);
    return svg(AUFGABEN[name], null, 'aufgabe-' + name);
  }

  // ---------------------------------------------------------------------
  // Korb (viewBox 0 0 120 90), optional mit Schild vorne
  // ---------------------------------------------------------------------
  const KORB_FARBEN = { rot: '#f8312f', blau: '#00a6ed', gelb: '#fcd53f', gruen: '#00d26a', weiss: '#ffffff', braun: '#d9a066' };
  function korb(farbe, etikett) {
    const f = KORB_FARBEN[farbe || 'braun'] || KORB_FARBEN.braun;
    const r = farbe === 'weiss' ? '#b4acbc' : g.Bilder.dunkel(f);
    let s = '<path d="M28 34 C28 6 92 6 92 34" fill="none"' + strich(5, r) + '/>' +
      '<path d="M8 34 H112 L100 86 H20 Z" fill="' + f + '"' + strich(2.5, r) + '/>' +
      '<path d="M13 52 H107 M17 70 H103" fill="none"' + strich(1.8, r) + '/>' +
      '<path d="M40 34 L44 86 M60 34 V86 M80 34 L76 86" fill="none"' + strich(1.8, r) + '/>' +
      '<path d="M14 40 H34 L32 46 H15 Z" fill="#fff" opacity="0.35"/>' +
      '<rect x="4" y="28" width="112" height="10" rx="4" fill="' + f + '"' + strich(2.5, r) + '/>';
    if (etikett) s += '<circle cx="60" cy="60" r="23" fill="#f1ebff"' + strich(2.5, r) + '/>' + bildAn(etikett, 44, 44, 32);
    return svg(s, '0 0 120 90', 'korb');
  }

  // Höhle (viewBox 0 0 72 72): Felsbogen mit dunklem Eingang
  const HOEHLE = '<path d="M4 66 C4 30 16 8 36 8 C56 8 68 30 68 66 Z" fill="#c9b8a5"' + strich(2.5, '#8f7c68') + '/>' +
    '<path d="M18 66 C18 42 26 28 36 28 C46 28 54 42 54 66 Z" fill="#5c4d40"' + strich(2, '#3e332a') + '/>' +
    '<path d="M12 30 L20 34 M54 22 L60 28 M8 50 L14 50" fill="none"' + strich(1.8, '#8f7c68') + '/>' +
    '<path d="M14 22 C18 14 26 11 32 11 C25 15 20 19 18 26 Z" fill="#fff" opacity="0.35"/>' +
    '<path d="M2 66 H70" fill="none"' + strich(2.5, '#8f7c68') + '/>';

  const STERN_VOLL = '<path d="' + sternPfad(36, 38, 32, 14) + '" fill="#fcd53f"' + strich(2.5, '#e1a100') + '/><path d="M33 16 L36 8 L38 18 L30 32 Z" fill="#fff" opacity="0.5"/>';
  const STERN_LEER = '<path d="' + sternPfad(36, 38, 32, 14) + '" fill="#fff"' + strich(2.5) + '/>';

  const GESICHT = {
    froh: '<path d="M22 44 C28 56 44 56 50 44" fill="none"' + strich(3) + '/>',
    mittel: '<path d="M24 48 H48" fill="none"' + strich(3) + '/>',
    muede: '<path d="M20 30 C24 33 28 33 31 30 M41 30 C44 33 48 33 52 30" fill="none"' + strich(2.5) + '/><ellipse cx="36" cy="50" rx="5" ry="6" fill="none"' + strich(2.5) + '/>'
  };
  function gesicht(art) {
    const augen = art === 'muede' ? '' : '<circle cx="26" cy="30" r="3.5" fill="' + T + '"/><circle cx="46" cy="30" r="3.5" fill="' + T + '"/>';
    return svg('<circle cx="36" cy="36" r="30" fill="#fff"' + strich(2.5) + '/>' + augen + GESICHT[art], null, 'gesicht');
  }

  // Würfelpunkte 1–6 (viewBox 0 0 72 72), ohne Rahmen
  const PUNKT_LAGEN = {
    1: [[36, 36]], 2: [[20, 20], [52, 52]], 3: [[18, 18], [36, 36], [54, 54]], 4: [[20, 20], [52, 20], [20, 52], [52, 52]],
    5: [[18, 18], [54, 18], [36, 36], [18, 54], [54, 54]], 6: [[20, 16], [52, 16], [20, 36], [52, 36], [20, 56], [52, 56]]
  };
  function punkte(n, farbe) {
    const lagen = PUNKT_LAGEN[n];
    if (!lagen) throw new Error('punkte: 1 bis 6, nicht ' + n);
    return svg(lagen.map(([x, y]) => '<circle cx="' + x + '" cy="' + y + '" r="8" fill="' + (farbe || T) + '"/>').join(''), null, 'punkte');
  }

  const HAUS = '<path d="M10 36 L36 12 L62 36" fill="none"' + strich(5) + '/><path d="M18 32 V62 H54 V32" fill="#fff"' + strich(4) + '/><rect x="30" y="44" width="12" height="18" fill="#00d26a"' + strich(3) + '/>';
  // Für Erwachsene: zwei Figuren, eine groß, eine klein
  const ERWACHSENE = '<circle cx="26" cy="18" r="9" fill="#fff"' + strich(3) + '/><path d="M12 64 V44 C12 32 40 32 40 44 V64" fill="#fff"' + strich(3) + '/>' +
    '<circle cx="52" cy="34" r="7" fill="#fff"' + strich(3) + '/><path d="M42 64 V54 C42 44 62 44 62 54 V64" fill="#fff"' + strich(3) + '/>';
  // Pfeil nach rechts (weiter) für die App
  const WEITER = '<path d="M14 36 H54 M38 18 L56 36 L38 54" fill="none"' + strich(7) + '/>';

  g.Symbole = {
    aufgabe, korb, punkte, gesicht,
    hoehle: () => svg(HOEHLE, null, 'hoehle'),
    stern: (leer) => svg(leer ? STERN_LEER : STERN_VOLL, null, leer ? 'stern leer' : 'stern'),
    haus: () => svg(HAUS), erwachsene: () => svg(ERWACHSENE), weiter: () => svg(WEITER),
    AUFGABEN: Object.keys(AUFGABEN), KORB_FARBEN: Object.keys(KORB_FARBEN)
  };
})(typeof window !== 'undefined' ? window : globalThis);
