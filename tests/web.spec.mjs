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
        await expect(page.locator('.satz')).toHaveText(l.satz);
        await grossGenugUndSichtbar(page, '.option');
        await keinScrollen(page);
        if (si === 0) await foto(page, info, k + '-' + (li + 1));
        const opt = page.locator('.option');
        // Einmal falsch tippen: Das Bild wackelt, nichts geht weiter
        const falsch = s.reihe ? s.reihe[1] : (s.richtig + 1) % s.optionen.length;
        await opt.nth(falsch).tap();
        await expect(opt.nth(falsch)).toHaveClass(/falsch/);
        expect(await stand(page)).toBe(k + '/' + li + '/' + si);
        // Richtig tippen
        for (const i of s.reihe || [s.richtig]) await opt.nth(i).tap();
        if (s.reihe) await expect(page.locator('.option .nr')).toHaveCount(s.reihe.length);
      }
    }
    await warteAufStand(page, k + '/ende');
    await expect(page.locator('.ende')).toBeVisible();
    await keinScrollen(page);
    await foto(page, info, k + '-ende');
    // Zurück zum Anfang: alle Sterne des Pakets sind voll
    await page.locator('.haus-knopf').tap();
    await warteAufStand(page, 'start');
    const kachel = page.locator('.kachel[data-paket="' + k + '"]');
    await expect(kachel.locator('.sterne > div')).toHaveCount(p.levels.length);
    const leer = await kachel.locator('.sterne path[fill="#fff"]').count();
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
  await expect(page.locator('.overlay')).toContainText('OpenMoji');
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
