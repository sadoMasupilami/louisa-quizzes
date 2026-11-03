// Schau- und Spiel-Werkstatt – Web-App
// Daten: window.WERKSTATT_PAKETE (aus raetsel/eN.json, beim Bauen geprüft und gelöst, siehe werkzeuge/web-bauen.mjs).
// Adressen: #            Startseite (große Bild-Kacheln)
//           #e1          Paket 1 ab Level 1
//           #e1-3        Paket 1, Level 3
// Kein Text für das Kind, kein Ton, nur Antippen. Falsch: das Bild wackelt. Richtig: es hüpft.
(function () {
  'use strict';
  const PAKETE = window.WERKSTATT_PAKETE || {};
  const app = document.getElementById('app');
  const overlay = document.getElementById('erwachsene');
  const B = window.Bilder, S = window.Symbole;
  const SPEICHER = 'schau-werkstatt-v1';
  const reduziert = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const warte = (ms) => new Promise((r) => setTimeout(r, reduziert ? Math.min(ms, 150) : ms));

  // ---------------------------------------------------------------------
  // Fortschritt (nur in diesem Browser)
  // ---------------------------------------------------------------------
  function lade() { try { return JSON.parse(localStorage.getItem(SPEICHER)) || {}; } catch (e) { return {}; } }
  function speichere(f) { try { localStorage.setItem(SPEICHER, JSON.stringify(f)); } catch (e) { /* privat oder voll: egal */ } }
  function geschafft(paket, level) {
    const f = lade();
    f[paket] = f[paket] || [];
    f[paket][level] = true;
    speichere(f);
  }

  const bild = (id, stil) => B.svg(id, { stil: stil || 'farbe' });
  const knopf = (cls, label, svg) => '<button class="knopf ' + cls + '" aria-label="' + label + '">' + svg + '</button>';
  const reihenfolge = () => Object.keys(PAKETE).sort((a, b) => PAKETE[a].einheit - PAKETE[b].einheit);

  // ---------------------------------------------------------------------
  // Startseite
  // ---------------------------------------------------------------------
  function start() {
    const f = lade();
    let h = '<div class="start-kopf"><div class="titel-bilder"><div>' + bild('einhorn') + '</div><div>' + bild('drache') + '</div><div>' + bild('fee') + '</div></div>' +
      knopf('klein erwachsene-knopf', 'Für Erwachsene', S.erwachsene()) + '</div>';
    h += '<p class="fuer-mich">Tipp auf ein Bild. Jedes Bild ist ein kleines Spiel zu einer Einheit.</p><div class="kacheln">';
    for (const k of reihenfolge()) {
      const p = PAKETE[k];
      h += '<button class="kachel" data-paket="' + k + '" aria-label="Paket ' + p.einheit + ': ' + p.titel + '">' +
        '<div class="bild">' + bild(p.bild) + '</div>' +
        '<div class="nummer">' + S.punkte(Math.min(p.einheit, 6), '#7a4fd1') + '</div>' +
        '<div class="sterne">' + p.levels.map((_, i) => '<div>' + S.stern(!(f[k] || [])[i]) + '</div>').join('') + '</div>' +
        '</button>';
    }
    app.innerHTML = h + '</div>';
    document.body.dataset.stand = 'start';
    app.querySelectorAll('.kachel').forEach((b) => b.addEventListener('click', () => { location.hash = '#' + b.dataset.paket; }));
    app.querySelector('.erwachsene-knopf').addEventListener('click', erwachsene);
  }

  // ---------------------------------------------------------------------
  // Ein Level
  // ---------------------------------------------------------------------
  function inhalt(ref) {
    if (ref.korb) return S.korb(ref.korb.farbe, ref.korb.etikett);
    const g = Math.round((ref.gross || 1) * 1000) / 10;
    return '<div class="innen"><div style="width:' + g + '%;height:' + g + '%">' + bild(ref.bild, ref.stil) + '</div></div>';
  }

  let lauf = 0; // wechselt bei jedem neuen Bildschirm: alte Zeitgeber tun dann nichts mehr

  function level(k, li) {
    const p = PAKETE[k];
    const l = p.levels[li];
    const meinLauf = ++lauf;
    const zustand = { schritt: 0, reihe: 0, gesperrt: false };
    app.innerHTML =
      '<div class="leiste">' + knopf('haus-knopf', 'Zurück zum Anfang', S.haus()) +
      '<div class="fortschritt">' + p.levels.map((_, i) => '<div class="punkt' + (i < li ? ' fertig' : i === li ? ' jetzt' : '') + '"></div>').join('') + '</div>' +
      knopf('klein erwachsene-knopf', 'Für Erwachsene', S.erwachsene()) + '</div>' +
      '<p class="fuer-mich satz">' + l.satz + '</p>' +
      '<div class="level" data-paket="' + k + '" data-level="' + li + '"><div class="zeige"></div><div class="optionen"></div></div>';
    app.querySelector('.haus-knopf').addEventListener('click', () => { location.hash = ''; });
    app.querySelector('.erwachsene-knopf').addEventListener('click', erwachsene);
    const zeige = app.querySelector('.zeige');
    const optionen = app.querySelector('.optionen');

    function zeigeSchritt() {
      const s = l.schritte[zustand.schritt];
      zustand.reihe = 0;
      zustand.gesperrt = false;
      zeige.className = 'zeige' + (s.zeige.length ? '' : ' leer');
      zeige.innerHTML = s.zeige.map((r) => '<div class="vorne">' + inhalt(r) + '</div>').join('') +
        (l.schritte.length > 1 ? '<div class="schritte">' + l.schritte.map((_, i) => '<div class="s' + (i < zustand.schritt ? ' fertig' : '') + '"></div>').join('') + '</div>' : '');
      optionen.className = 'optionen n' + s.optionen.length + (s.unten ? ' unten' : '');
      optionen.innerHTML = s.optionen.map((r, i) => '<button class="option' + (r.korb ? ' korb' : '') + '" data-i="' + i + '" aria-label="Antwort ' + (i + 1) + '">' + inhalt(r) + '</button>').join('');
      optionen.querySelectorAll('.option').forEach((o) => o.addEventListener('click', () => tippe(o, +o.dataset.i)));
      document.body.dataset.stand = k + '/' + li + '/' + zustand.schritt; // für die Tests
    }

    async function tippe(o, i) {
      if (zustand.gesperrt || o.classList.contains('erledigt') || meinLauf !== lauf) return;
      const s = l.schritte[zustand.schritt];
      const soll = s.reihe ? s.reihe[zustand.reihe] : s.richtig;
      if (i !== soll) {
        o.classList.remove('falsch');
        void o.offsetWidth; // Animation neu starten
        o.classList.add('falsch');
        return;
      }
      if (s.reihe) {
        o.classList.add('erledigt');
        o.insertAdjacentHTML('beforeend', '<div class="nr">' + S.punkte(zustand.reihe + 1, '#3aa356') + '</div>');
        zustand.reihe++;
        if (zustand.reihe < s.reihe.length) return;
      }
      zustand.gesperrt = true;
      o.classList.add('richtig');
      // Beim Sortieren fliegt das Bild in den Korb
      const vorne = zeige.querySelector('.vorne');
      if (o.classList.contains('korb') && vorne) {
        const a = vorne.getBoundingClientRect(), z = o.getBoundingClientRect();
        vorne.style.transform = 'translate(' + (z.left + z.width / 2 - a.left - a.width / 2) + 'px,' + (z.top + z.height / 2 - a.top - a.height / 2) + 'px) scale(0.3)';
        vorne.style.opacity = '0.2';
      }
      await warte(650);
      if (meinLauf !== lauf) return;
      zustand.schritt++;
      if (zustand.schritt < l.schritte.length) { zeigeSchritt(); return; }
      // Level geschafft
      geschafft(k, li);
      app.insertAdjacentHTML('beforeend', '<div class="stern-gross"><div>' + S.stern(false) + '</div></div>');
      await warte(900);
      if (meinLauf !== lauf) return;
      if (li + 1 < p.levels.length) {
        history.replaceState(null, '', '#' + k + '-' + (li + 2));
        level(k, li + 1);
      } else {
        ende(k);
      }
    }
    zeigeSchritt();
  }

  // ---------------------------------------------------------------------
  // Ende-Bild: klares Ende, kein „noch ein Level“
  // ---------------------------------------------------------------------
  function ende(k) {
    const p = PAKETE[k];
    ++lauf;
    app.innerHTML = '<div class="ende" data-ende="' + k + '"><div class="bilder"><div>' + bild(p.bild) + '</div><div>' + S.stern(false) + '</div></div>' +
      '<p class="fuer-mich">Fertig! Super gemacht. Jetzt kommt das Gerät weg, und wir spielen weiter am Tisch.</p>' +
      knopf('haus-knopf', 'Zurück zum Anfang', S.haus()) + '</div>';
    app.querySelector('.haus-knopf').addEventListener('click', () => { location.hash = ''; });
    document.body.dataset.stand = k + '/ende';
  }

  // ---------------------------------------------------------------------
  // Für Erwachsene: hinter einer kleinen Rechenfrage
  // ---------------------------------------------------------------------
  function erwachsene() {
    const a = 5 + Math.floor(Math.random() * 5), b = 4 + Math.floor(Math.random() * 6);
    overlay.innerHTML = '<div class="karte" role="dialog" aria-label="Für Erwachsene"><h2>Für Erwachsene</h2>' +
      '<p>Wie viel ist ' + a + ' + ' + b + '?</p><div class="zeile"><input type="text" inputmode="numeric" autocomplete="off" autocapitalize="off" autocorrect="off" aria-label="Antwort">' +
      '<button class="knopf-text ok">OK</button><button class="knopf-text hell zu">Zurück</button></div></div>';
    overlay.hidden = false;
    const input = overlay.querySelector('input');
    const pruefe = () => { if (parseInt(input.value, 10) === a + b) bereich(); else { input.value = ''; input.focus(); } };
    overlay.querySelector('.ok').addEventListener('click', pruefe);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') pruefe(); });
    overlay.querySelector('.zu').addEventListener('click', schliessen);
  }
  function bereich() {
    overlay.innerHTML = '<div class="karte" role="dialog" aria-label="Für Erwachsene"><h2>Für Erwachsene</h2>' +
      '<p>Diese App gehört zur Schau- und Spiel-Werkstatt (Guide zum Ausdrucken). Sie ist ein kurzer Bonus: höchstens 5 Minuten, gemeinsam, ohne Ton. Du sagst die Aufgabe (der kleine graue Satz), dein Kind tippt.</p>' +
      '<div class="zeile"><button class="knopf-text loeschen">Fortschritt löschen</button><button class="knopf-text hell zu">Zurück</button></div>' +
      '<p><small>Die Sterne bleiben nur in diesem Browser. Die App sammelt nichts und lädt nichts aus dem Internet nach.</small></p>' +
      '<p><small>Bilder: OpenMoji, das Open-Source-Emoji-Projekt (openmoji.org), Lizenz CC BY-SA 4.0. Der Fehler-Kobold, die Formen, die Socken und die Knöpfe sind selbst gezeichnet. Version ' + (window.WERKSTATT_VERSION || '') + '</small></p></div>';
    overlay.querySelector('.loeschen').addEventListener('click', (e) => {
      if (e.target.dataset.sicher) { speichere({}); schliessen(); route(); return; }
      e.target.dataset.sicher = '1';
      e.target.textContent = 'Wirklich löschen?';
    });
    overlay.querySelector('.zu').addEventListener('click', schliessen);
  }
  function schliessen() { overlay.hidden = true; overlay.innerHTML = ''; }

  // ---------------------------------------------------------------------
  // Adressen
  // ---------------------------------------------------------------------
  function route() {
    schliessen();
    ++lauf;
    const m = /^#(e\d+)(?:-(\d+))?$/.exec(location.hash);
    if (m && PAKETE[m[1]]) {
      const li = m[2] ? Math.min(Math.max(parseInt(m[2], 10) - 1, 0), PAKETE[m[1]].levels.length - 1) : 0;
      level(m[1], li);
    } else start();
  }
  window.addEventListener('hashchange', route);
  route();

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => { /* offline geht dann eben nicht */ });
  }
})();
