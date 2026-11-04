// Tests der Web-App: jedes Level einmal durchspielen, Tippflächen, kein Scrollen, keine fremden Anfragen,
// keine Fehler in der Konsole, Ende-Bild, „Für Erwachsene“, offline. Bildschirmfotos nach test-results/bilder/<projekt>/.
//   node werkzeuge/web-bauen.mjs && npx playwright test
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const WURZEL = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
// Dieselben Daten wie die App (aus _site/daten.js)
const ctx = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(WURZEL, '_site', 'daten.js'), 'utf8'), ctx);
const PAKETE = ctx.window.WERKSTATT_PAKETE;
const MIN_TIPP = 72;

test.beforeEach(async ({ page }, info) => {
  info.fremd = [];
  info.konsole = [];
  await page.route('**/*', (r) => {
    const u = new URL(r.request().url());
    if (u.hostname === 'localhost' || u.protocol === 'data:') return r.continue();
    info.fremd.push(u.href);
    return r.abort();
  });
  page.on('console', (m) => { if (m.type() === 'error') info.konsole.push(m.text()); });
  page.on('pageerror', (e) => info.konsole.push(e.message));
});
test.afterEach(async ({}, info) => {
  expect(info.fremd, 'Anfragen an fremde Hosts').toEqual([]);
  expect(info.konsole, 'Fehler in der Konsole').toEqual([]);
});

const foto = async (page, info, name) => {
  const ordner = path.join(WURZEL, 'test-results', 'bilder', info.project.name);
  fs.mkdirSync(ordner, { recursive: true });
  await page.screenshot({ path: path.join(ordner, name + '.png') });
};

async function keinScrollen(page) {
  const m = await page.evaluate(() => ({ sh: document.documentElement.scrollHeight, sw: document.documentElement.scrollWidth, h: innerHeight, w: innerWidth }));
  expect(m.sh, 'senkrecht scrollen').toBeLessThanOrEqual(m.h + 1);
  expect(m.sw, 'waagrecht scrollen').toBeLessThanOrEqual(m.w + 1);
}
async function grossGenugUndSichtbar(page, selektor) {
  const vp = page.viewportSize();
  for (const el of await page.locator(selektor).all()) {
    const b = await el.boundingBox();
    expect(Math.min(b.width, b.height), selektor + ' zu klein').toBeGreaterThanOrEqual(MIN_TIPP);
    expect(b.x).toBeGreaterThanOrEqual(-0.5);
    expect(b.y).toBeGreaterThanOrEqual(-0.5);
    expect(b.x + b.width).toBeLessThanOrEqual(vp.width + 0.5);
    expect(b.y + b.height).toBeLessThanOrEqual(vp.height + 0.5);
  }
}
const stand = (page) => page.evaluate(() => document.body.dataset.stand);
const warteAufStand = (page, s) => page.waitForFunction((x) => document.body.dataset.stand === x, s, { timeout: 10000 });

// Spielt einen Schritt: einmal falsch (Das Bild wackelt, nichts geht weiter), dann richtig. Jede Spielart auf ihre Art.
async function spieleSchritt(page, info, name, soll, s) {
  const opt = page.locator('.option');
  if (s.typ === 'aufdecken') {
    // Zwei verschiedene Karten: Sie wackeln und drehen sich wieder um
    const [a, b] = [s.paare[0][0], s.paare[1][0]];
    await opt.nth(a).tap();
    await expect(opt.nth(a)).toHaveClass(/offen/);
    await opt.nth(b).tap();
    await expect(opt.nth(b)).toHaveClass(/falsch/);
    await foto(page, info, name + '-offen');
    await expect(page.locator('.option.offen')).toHaveCount(0);
    expect(await stand(page)).toBe(soll);
    for (const [i, paar] of s.paare.entries()) {
      for (const karte of paar) await opt.nth(karte).tap();
      await expect(page.locator('.option.gefunden')).toHaveCount((i + 1) * 2);
    }
    return;
  }
  if (s.typ === 'anschauen') { await opt.first().tap(); return; }
  if (s.alle) {
    const falsch = s.optionen.findIndex((_, i) => !s.alle.includes(i));
    await opt.nth(falsch).tap();
    await expect(opt.nth(falsch)).toHaveClass(/falsch/);
    expect(await stand(page)).toBe(soll);
    for (const [n, i] of s.alle.entries()) {
      await opt.nth(i).tap();
      await expect(page.locator('.option.treffer')).toHaveCount(n + 1);
      if (n === 0 && s.alle.length > 1) await foto(page, info, name + '-treffer');
    }
    return;
  }
  const falsch = s.reihe ? s.reihe[1] : (s.richtig + 1) % s.optionen.length;
  await opt.nth(falsch).tap();
  await expect(opt.nth(falsch)).toHaveClass(/falsch/);
  expect(await stand(page)).toBe(soll);
  for (const i of s.reihe || [s.richtig]) await opt.nth(i).tap();
  if (s.typ === 'turm') {
    await expect(page.locator('.turm-stapel .teil')).toHaveCount(s.reihe.length);
    await keinScrollen(page);
    // Der Turm ist wirklich groß: Das unterste Teil nimmt seinen Anteil an der Höhe ein, und alles bleibt im Bild
    const hoehe = await page.locator('.turm-stapel').evaluate((t) => ({ turm: t.clientHeight, unten: t.firstElementChild.getBoundingClientRect().height, teile: [...t.children].reduce((n, x) => n + x.offsetHeight, 0) }));
    expect(hoehe.unten).toBeGreaterThan(hoehe.turm / (s.reihe.length + 1));
    expect(hoehe.teile).toBeLessThanOrEqual(hoehe.turm + 1);
    await page.waitForTimeout(320); // Animation des letzten Teils abwarten
    await foto(page, info, name + '-turm');
  } else if (s.reihe) await expect(page.locator('.option .nr')).toHaveCount(s.reihe.length);
}

test('Startseite: eine große Kachel pro Paket, nichts scrollt', async ({ page }, info) => {
  await page.goto('./');
  await warteAufStand(page, 'start');
  await expect(page.locator('.kachel')).toHaveCount(Object.keys(PAKETE).length);
  await grossGenugUndSichtbar(page, '.kachel');
  await keinScrollen(page);
  await foto(page, info, 'start');
  await page.locator('.kachel').first().tap();
  await warteAufStand(page, 'e1/0/0');
});

for (const [k, p] of Object.entries(PAKETE)) {
  test('Paket ' + k + ': alle Levels durchspielen bis zum Ende-Bild', async ({ page }, info) => {
    await page.goto('./#' + k);
    for (let li = 0; li < p.levels.length; li++) {
      const l = p.levels[li];
      for (let si = 0; si < l.schritte.length; si++) {
        const s = l.schritte[si];
        await warteAufStand(page, k + '/' + li + '/' + si);
        await expect(page.locator('.satz')).toHaveText(s.satz || l.satz);
        await grossGenugUndSichtbar(page, '.option');
        await keinScrollen(page);
        if (si === 0) await foto(page, info, k + '-' + (li + 1));
        await spieleSchritt(page, info, k + '-' + (li + 1), k + '/' + li + '/' + si, s);
      }
    }
    await warteAufStand(page, k + '/ende');
    await expect(page.locator('.ende')).toBeVisible();
    await keinScrollen(page);
    // Fläche des Ende-Bilds bleibt ganz im Bild (body schneidet sonst still ab)
    const ende = await page.locator('.ende .bilder > div').last().boundingBox();
    expect(ende.x + ende.width).toBeLessThanOrEqual(page.viewportSize().width + 0.5);
    await foto(page, info, k + '-ende');
    // Zurück zum Anfang: alle Sterne des Pakets sind voll
    await page.locator('.haus-knopf').tap();
    await warteAufStand(page, 'start');
    const kachel = page.locator('.kachel[data-paket="' + k + '"]');
    await expect(kachel.locator('.sterne > div')).toHaveCount(p.levels.length);
    const leer = await kachel.locator('.sterne svg.leer').count();
    expect(leer).toBe(0);
  });

  test('Paket ' + k + ': jedes Level ist direkt über die Adresse erreichbar', async ({ page }) => {
    for (let li = 0; li < p.levels.length; li++) {
      await page.goto('./#' + k + '-' + (li + 1));
      await warteAufStand(page, k + '/' + li + '/0');
      await expect(page.locator('.fortschritt .punkt.jetzt')).toHaveCount(1);
    }
  });
}

test('Aufdecken: Zwei gleiche Karten bleiben offen, offene Karten zählen nicht doppelt', async ({ page }) => {
  const paket = Object.entries(PAKETE).find(([, p]) => p.levels.some((l) => l.schritte[0].typ === 'aufdecken'));
  const li = paket[1].levels.findIndex((l) => l.schritte[0].typ === 'aufdecken');
  const s = paket[1].levels[li].schritte[0];
  await page.goto('./#' + paket[0] + '-' + (li + 1));
  await warteAufStand(page, paket[0] + '/' + li + '/0');
  const opt = page.locator('.option');
  await expect(page.locator('.option.offen')).toHaveCount(0);
  const [a, b] = s.paare[0];
  await opt.nth(a).tap();
  await opt.nth(a).tap(); // dieselbe Karte nochmal: Sie darf nicht als Paar zählen
  await expect(page.locator('.option.gefunden')).toHaveCount(0);
  await opt.nth(b).tap();
  await expect(page.locator('.option.gefunden')).toHaveCount(2);
});

test('Weggenommen: Der Kobold nimmt erst nach dem Antippen etwas weg', async ({ page }) => {
  const paket = Object.entries(PAKETE).find(([, p]) => p.levels.some((l) => l.schritte[0].typ === 'anschauen'));
  const li = paket[1].levels.findIndex((l) => l.schritte[0].typ === 'anschauen');
  const [a] = paket[1].levels[li].schritte;
  await page.goto('./#' + paket[0] + '-' + (li + 1));
  await warteAufStand(page, paket[0] + '/' + li + '/0');
  await expect(page.locator('.zeige .vorne')).toHaveCount(a.zeige.length);
  await expect(page.locator('.luecke')).toHaveCount(0);
  await page.waitForTimeout(1500); // keine Zeitgrenze: Es passiert nichts, solange niemand tippt
  await expect(page.locator('.luecke')).toHaveCount(0);
  await page.locator('.option').first().tap();
  await warteAufStand(page, paket[0] + '/' + li + '/1');
  await expect(page.locator('.luecke')).toHaveCount(1);
});

test('Für Erwachsene: Rechenfrage, Fortschritt löschen', async ({ page }) => {
  await page.goto('./#e1');
  await warteAufStand(page, 'e1/0/0');
  await page.locator('.option').nth(PAKETE.e1.levels[0].schritte[0].richtig).tap();
  await page.goto('./');
  await warteAufStand(page, 'start');
  await page.locator('.erwachsene-knopf').tap();
  const frage = await page.locator('.overlay p').first().textContent();
  const [, a, b] = frage.match(/(\d+) \+ (\d+)/);
  await page.locator('.overlay input').fill('1');
  await page.locator('.overlay .ok').tap();
  await expect(page.locator('.overlay .loeschen')).toHaveCount(0);
  await page.locator('.overlay input').fill(String(+a + +b));
  await page.locator('.overlay .ok').tap();
  await expect(page.locator('.overlay')).toContainText('Bilder:');
  await page.locator('.overlay .loeschen').tap();
  await page.locator('.overlay .loeschen').tap();
  await expect(page.locator('.overlay')).toBeHidden();
  expect(await page.evaluate(() => localStorage.getItem('schau-werkstatt-v1'))).toBe('{}');
});

test('Offline: nach dem ersten Besuch geht die App ohne Netz', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', 'Service-Worker-Offline-Test nur in Chromium');
  await page.goto('./');
  await warteAufStand(page, 'start');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload(); // jetzt steuert der Service Worker die Seite
  await warteAufStand(page, 'start');
  await context.setOffline(true);
  await page.goto('./#e3-2');
  await warteAufStand(page, 'e3/1/0');
  await expect(page.locator('.option')).toHaveCount(4);
  await context.setOffline(false);
});
