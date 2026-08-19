import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compliments, insults } from '../public/js/lines.js';
import { Deck, getRandomInt, shuffle, generateNewRound } from '../public/js/deck.js';
import {
  normalizeConfig,
  validateConfig,
  createDailySchedule,
  claimDuePrize,
  countAwardedByPrize,
  reconcileDailySchedule
} from '../public/js/prizes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Mock localStorage for testing
const mockStorage = {};
globalThis.window = {
  localStorage: {
    getItem(key) {
      return mockStorage[key] || null;
    },
    setItem(key, value) {
      mockStorage[key] = String(value);
    },
    removeItem(key) {
      delete mockStorage[key];
    }
  }
};

test('Lines: exact content counts and case-insensitive uniqueness', () => {
  assert.strictEqual(compliments.length, 72, 'Must have exactly 72 compliments');
  assert.strictEqual(insults.length, 72, 'Must have exactly 72 insults');

  const seen = new Set();
  for (const line of [...compliments, ...insults]) {
    assert.strictEqual(typeof line, 'string', 'All lines must be strings');
    assert.ok(line.trim().length > 0, 'Lines must not be empty');

    const lower = line.toLowerCase();
    assert.ok(!seen.has(lower), `Found duplicate or case-insensitive duplicate: "${line}"`);
    seen.add(lower);
  }
});

test('getRandomInt: returns numbers within expected bounds', () => {
  for (let i = 0; i < 100; i++) {
    const r = getRandomInt(10);
    assert.ok(r >= 0 && r < 10, `getRandomInt(10) returned out-of-bounds: ${r}`);
  }

  assert.strictEqual(getRandomInt(1), 0, 'getRandomInt(1) must return 0');
  assert.throws(() => getRandomInt(0), RangeError, 'getRandomInt(0) must reject an invalid range');
  assert.throws(() => getRandomInt(1.5), RangeError, 'getRandomInt must reject non-integers');
});

test('getRandomInt: supports ranges beyond eight bits', () => {
  const originalGetRandomValues = globalThis.crypto.getRandomValues.bind(globalThis.crypto);
  globalThis.crypto.getRandomValues = array => {
    array[0] = 299;
    return array;
  };
  try {
    assert.strictEqual(getRandomInt(300), 299);
  } finally {
    globalThis.crypto.getRandomValues = originalGetRandomValues;
  }
});

test('Deck: deterministic full-deck no-repeat behavior', () => {
  const deck = new Deck('compliment', compliments, 'test-compliment-deck');

  const drawn = [];
  for (let i = 0; i < 72; i++) {
    drawn.push(deck.draw());
  }

  // Check that all 72 drawn items are unique (every item drawn exactly once)
  const uniqueDrawn = new Set(drawn);
  assert.strictEqual(uniqueDrawn.size, 72, 'All 72 draws in a round must be unique');

  // Check that all drawn items match the original compliment list
  for (const item of drawn) {
    assert.ok(compliments.includes(item), 'Drawn item must be in the compliments list');
  }
});

test('Deck: forced reshuffle collision cannot repeat across the boundary', () => {
  const items = ['A', 'B', 'C'];
  const alwaysZero = () => 0;
  const round = generateNewRound(items, 'A', alwaysZero);

  assert.notStrictEqual(items[round[0]], 'A', 'Forced boundary collision must be swapped away');
  assert.strictEqual(new Set(round).size, items.length, 'The forced swap must preserve a full permutation');
});

test('Deck: invalid persisted state recovery', () => {
  const storageKey = 'test-corrupt-deck';

  // Scenario 1: JSON is syntactically invalid
  window.localStorage.setItem(storageKey, '{invalid json}');
  let deck = new Deck('compliment', compliments, storageKey);
  assert.strictEqual(deck.currentIndex, 0, 'Corrupt JSON should fall back to 0 index');
  assert.strictEqual(deck.shuffledIndices.length, 72, 'Should regenerate deck');

  // Scenario 2: JSON is valid but indices array has wrong size
  window.localStorage.setItem(storageKey, JSON.stringify({
    shuffledIndices: [0, 1, 2],
    currentIndex: 1,
    lastDrawnItem: null
  }));
  deck = new Deck('compliment', compliments, storageKey);
  assert.strictEqual(deck.currentIndex, 0, 'Wrong size indices should recover to 0 index');
  assert.strictEqual(deck.shuffledIndices.length, 72, 'Should regenerate deck');

  // Scenario 3: JSON has indices that are out of bounds
  const badIndices = Array.from({ length: 72 }, (_, i) => i);
  badIndices[10] = 999; // Out of bounds index
  window.localStorage.setItem(storageKey, JSON.stringify({
    shuffledIndices: badIndices,
    currentIndex: 5,
    lastDrawnItem: null
  }));
  deck = new Deck('compliment', compliments, storageKey);
  assert.strictEqual(deck.currentIndex, 0, 'Out-of-bounds indices should trigger recovery');

  // Scenario 4: JSON has invalid currentIndex (e.g. out of range or negative)
  const goodIndices = Array.from({ length: 72 }, (_, i) => i);
  window.localStorage.setItem(storageKey, JSON.stringify({
    shuffledIndices: goodIndices,
    currentIndex: -1,
    lastDrawnItem: null
  }));
  deck = new Deck('compliment', compliments, storageKey);
  assert.strictEqual(deck.currentIndex, 0, 'Negative currentIndex should trigger recovery');

  // Scenario 5: indices are in range but contain duplicates
  window.localStorage.setItem(storageKey, JSON.stringify({
    shuffledIndices: Array(72).fill(0),
    currentIndex: 5,
    lastDrawnItem: compliments[0]
  }));
  deck = new Deck('compliment', compliments, storageKey);
  assert.strictEqual(deck.currentIndex, 0, 'Duplicate indices should trigger recovery');
  assert.strictEqual(new Set(deck.shuffledIndices).size, 72, 'Recovered deck must be a full permutation');
});

test('Session: static constants check', () => {
  const appPath = path.join(__dirname, '../public/js/app.js');
  const app = fs.readFileSync(appPath, 'utf8');
  assert.ok(app.includes('const SESSION_DURATION_MS = 30_000;'), 'Production session lock must be exactly 30 seconds');
  assert.ok(app.includes('const PRIZE_VALIDITY_MS = 60 * 60 * 1000;'), 'Production prize validity must be exactly one hour');
  assert.ok(app.includes('lockApp(SESSION_DURATION_MS)'), 'The selection flow must use the production session constant');
});

test('HTML: PIN dialog and prize proof elements exist', () => {
  const htmlPath = path.join(__dirname, '../public/index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');

  // Verify PIN dialog elements
  assert.ok(html.includes('id="pin-dialog"'), 'HTML must have an element with id="pin-dialog"');
  assert.ok(html.includes('id="pin-input"'), 'HTML must have an input with id="pin-input"');
  assert.ok(html.includes('id="pin-error"'), 'HTML must have an element with id="pin-error"');

  // Verify Settings extensions exist
  assert.ok(html.includes('id="expo-opens"'), 'HTML must have an input with id="expo-opens"');
  assert.ok(html.includes('id="expo-closes"'), 'HTML must have an input with id="expo-closes"');
  assert.ok(html.includes('type="time" id="expo-opens"'), 'Expo opening must use the native time input');
  assert.ok(html.includes('type="time" id="expo-closes"'), 'Expo closing must use the native time input');
  assert.ok(html.includes('id="awards-rows-container"'), 'HTML must have container with id="awards-rows-container"');
  assert.ok(html.includes('id="btn-add-award"'), 'HTML must have Add Award button');
  assert.ok(html.includes('id="partner-rows-container"'), 'HTML must have container with id="partner-rows-container"');
  assert.ok(html.includes('id="btn-add-partner"'), 'HTML must have Add Partner button');
  assert.ok(html.includes('id="btn-save-settings"'), 'HTML must have Save Settings button');
  assert.ok(html.includes('id="admin-summary-container"'), 'HTML must have summary container');
  assert.ok(html.includes('id="report-scope"'), 'HTML must have report scope selector');
  assert.ok(html.includes('id="report-metrics"'), 'HTML must have report metrics container');
  assert.ok(html.includes('id="report-breakdown"'), 'HTML must have report breakdown container');
  assert.ok(html.includes('id="btn-export-reports"'), 'HTML must have report export button');
  assert.ok(html.includes('id="btn-reset-reports"'), 'HTML must have report reset button');

  // Verify Prize proof container inside result-stage
  assert.ok(html.includes('id="prize-proof-container"'), 'HTML must have container with id="prize-proof-container"');
});

test('SW: prize and report modules are listed in cache v7', () => {
  const swPath = path.join(__dirname, '../public/sw.js');
  const sw = fs.readFileSync(swPath, 'utf8');

  assert.ok(sw.includes('js/prizes.js'), 'Service worker assets must include js/prizes.js');
  assert.ok(sw.includes('js/reports.js'), 'Service worker assets must include js/reports.js');
  assert.ok(sw.includes("rivet-roulette-v7"), 'Service worker cache version must be updated to v7');
});

test('Admin reports: settings dialog is wide enough for the full breakdown table', () => {
  const cssPath = path.join(__dirname, '../public/styles.css');
  const css = fs.readFileSync(cssPath, 'utf8');
  assert.match(
    css,
    /#settings-dialog\s*\{[^}]*max-width:\s*780px/s,
    'the main settings dialog must be wider than the compact PIN dialog'
  );
});

test('Admin reports: iPad CSV download keeps the Blob URL alive long enough', () => {
  const appPath = path.join(__dirname, '../public/js/app.js');
  const app = fs.readFileSync(appPath, 'utf8');
  assert.ok(app.includes("type: 'text/csv;charset=utf-8'"), 'CSV MIME type must be valid');
  assert.ok(
    app.includes('window.setTimeout(() => URL.revokeObjectURL(url), 120_000);'),
    'CSV Blob URL must remain available while iPad Safari confirms the download'
  );
});
