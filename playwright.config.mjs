// Tests der Web-App: Handy und Tablet, hoch und quer, Touch. Chromium immer, WebKit, wenn installiert
// (npx playwright install webkit). Vorher bauen: node werkzeuge/web-bauen.mjs
import { defineConfig, devices } from '@playwright/test';
import { webkit } from 'playwright-core';
import fs from 'node:fs';

const port = +(process.env.WERKSTATT_TEST_PORT || 4173);
let mitWebkit = false;
try { mitWebkit = fs.existsSync(webkit.executablePath()); } catch (e) { mitWebkit = false; }

const geraete = {
  'iphone-hoch': { ...devices['iPhone 8'] },           // 375 · 667, kleinstes Zielgerät
  'iphone-quer': { ...devices['iPhone 8 landscape'] },
  'iphone-se-hoch': { ...devices['iPhone SE'] },       // 320 · 568, noch kleiner (Reserve)
  'android-hoch': { ...devices['Pixel 5'] },
  'ipad-hoch': { ...devices['iPad (gen 7)'] },
  'ipad-quer': { ...devices['iPad (gen 7) landscape'] }
};
const projekte = [];
for (const [name, g] of Object.entries(geraete)) {
  projekte.push({ name: 'chromium-' + name, use: { ...g, browserName: 'chromium', ...(process.env.WERKSTATT_CHROMIUM ? { launchOptions: { executablePath: process.env.WERKSTATT_CHROMIUM } } : {}) } });
  if (mitWebkit) projekte.push({ name: 'webkit-' + name, use: { ...g, browserName: 'webkit' } });
}
if (!mitWebkit) console.log('ℹ️  WebKit ist nicht installiert: Tests nur in Chromium (npx playwright install webkit)');

export default defineConfig({
  testDir: 'tests',
  testMatch: /web\.spec\.mjs/,
  fullyParallel: true,
  reporter: [['list']],
  timeout: 120000,
  use: { baseURL: 'http://localhost:' + port + '/', hasTouch: true },
  webServer: { command: 'node tests/server.mjs ' + port, url: 'http://localhost:' + port + '/', reuseExistingServer: true },
  projects: projekte
});
