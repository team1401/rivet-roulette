import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compliments, insults } from '../public/js/lines.js';
import { Deck, getRandomInt, shuffle, generateNewRound } from '../public/js/deck.js';
import {
  normalizeBookOffers,
  normalizePartners,
  normalizeConfig,
  validateConfig,
  filterEligiblePartners,
  selectPrize,
  decrementPartnerInventory
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

test('Prizes: config normalization and invalid config handling', () => {
  // Test normalizeConfig defaults
  const emptyNorm = normalizeConfig(null);
  assert.strictEqual(emptyNorm.bookChance, 0);
  assert.strictEqual(emptyNorm.partnerChance, 0);
  assert.deepStrictEqual(emptyNorm.bookOffers, []);
  assert.deepStrictEqual(emptyNorm.partners, []);

  // Test normalizeConfig with some valid/invalid values
  const input = {
    bookChance: '15.5',
    partnerChance: 'abc',
    bookOffers: 'Offer 1\n\nOffer 2  \n',
    partners: [
      { vendor: 'V1', offer: 'O1', inventory: '5' },
      { vendor: '  ', offer: 'O2', inventory: -2 }
    ]
  };
  const norm = normalizeConfig(input);
  assert.strictEqual(norm.bookChance, 0, 'Decimal chances must not be silently truncated');
  assert.strictEqual(norm.partnerChance, 0);
  assert.deepStrictEqual(norm.bookOffers, ['Offer 1', 'Offer 2']);
  assert.strictEqual(norm.partners.length, 2);
  assert.strictEqual(norm.partners[0].vendor, 'V1');
  assert.strictEqual(norm.partners[0].inventory, 5);
  assert.strictEqual(norm.partners[1].vendor, '');
  assert.strictEqual(norm.partners[1].inventory, 0);

  // Test validateConfig
  const invalidConfig = {
    bookChance: 60,
    partnerChance: 50, // sum = 110 > 100
    partners: [
      { vendor: '', offer: 'O1', inventory: 5 },
      { vendor: 'V2', offer: '', inventory: -1 }
    ]
  };
  const validation = validateConfig(invalidConfig);
  assert.strictEqual(validation.valid, false);
  assert.ok(validation.errors.some(e => e.includes('Combined chance')));
  assert.ok(validation.errors.some(e => e.includes('Vendor name is required')));
  assert.ok(validation.errors.some(e => e.includes('Offer text is required')));
  assert.ok(validation.errors.some(e => e.includes('Inventory must be a non-negative')));

  const decimalValidation = validateConfig({
    bookChance: 12.5,
    partnerChance: 0,
    bookOffers: ['Valid offer'],
    partners: []
  });
  assert.strictEqual(decimalValidation.valid, false);
  assert.ok(decimalValidation.errors.some(e => e.includes('integer')));
});

test('Prizes: exact probability boundaries', () => {
  const config = {
    bookChance: 10,
    partnerChance: 20,
    bookOffers: ['Book Offer'],
    partners: [{ vendor: 'PV', offer: 'Partner Offer', inventory: 5 }]
  };

  // If roll is < 10 (e.g. 0, 9), it should select book
  let rollVal = 0;
  const mockRandomInt = (max) => {
    if (max === 100) return rollVal;
    return 0; // selection index
  };

  rollVal = 0;
  assert.strictEqual(selectPrize(config, mockRandomInt).type, 'book');
  rollVal = 9;
  assert.strictEqual(selectPrize(config, mockRandomInt).type, 'book');

  // If roll is >= 10 and < 30 (e.g. 10, 29), it should select partner
  rollVal = 10;
  assert.strictEqual(selectPrize(config, mockRandomInt).type, 'partner');
  rollVal = 29;
  assert.strictEqual(selectPrize(config, mockRandomInt).type, 'partner');

  // If roll is >= 30, it should select null
  rollVal = 30;
  assert.strictEqual(selectPrize(config, mockRandomInt), null);
  rollVal = 99;
  assert.strictEqual(selectPrize(config, mockRandomInt), null);

  assert.strictEqual(selectPrize({ ...config, bookChance: 90, partnerChance: 20 }, mockRandomInt), null,
    'Tampered configs above a combined 100% must not award a prize');
});

test('Prizes: no eligible offers yields nothing', () => {
  const config = {
    bookChance: 50,
    partnerChance: 50,
    bookOffers: [], // no book offers
    partners: [] // no partners
  };

  // Even if roll falls in book/partner band, it must return null (does not transfer probability)
  let rollVal = 10; // book band
  const mockRandomInt = (max) => (max === 100 ? rollVal : 0);

  assert.strictEqual(selectPrize(config, mockRandomInt), null);

  rollVal = 60; // partner band
  assert.strictEqual(selectPrize(config, mockRandomInt), null);
});

test('Prizes: zero-inventory partner exclusion', () => {
  const config = {
    bookChance: 0,
    partnerChance: 100,
    bookOffers: [],
    partners: [
      { vendor: 'P1', offer: 'O1', inventory: 0 }, // ineligible
      { vendor: 'P2', offer: 'O2', inventory: 1 }  // eligible
    ]
  };

  // Should only ever select P2
  const mockRandomInt = (max) => {
    if (max === 100) return 50; // falls in partner band
    return 0; // index of eligible partners array
  };

  const prize = selectPrize(config, mockRandomInt);
  assert.ok(prize);
  assert.strictEqual(prize.vendor, 'P2');
  assert.strictEqual(prize.partnerIndex, 1); // original index is preserved
});

test('Prizes: deterministic partner offer selection', () => {
  const config = {
    bookChance: 0,
    partnerChance: 100,
    bookOffers: [],
    partners: [
      { vendor: 'P1', offer: 'O1', inventory: 5 },
      { vendor: 'P2', offer: 'O2', inventory: 5 },
      { vendor: 'P3', offer: 'O3', inventory: 5 }
    ]
  };

  // Mock random to select index 1 (P2)
  const mockRandomInt = (max) => {
    if (max === 100) return 50;
    return 1; // select index 1 of eligible array
  };

  const prize = selectPrize(config, mockRandomInt);
  assert.ok(prize);
  assert.strictEqual(prize.vendor, 'P2');
  assert.strictEqual(prize.partnerIndex, 1);
});

test('Prizes: partner inventory decrement without going negative', () => {
  const partners = [
    { vendor: 'P1', offer: 'O1', inventory: 1 },
    { vendor: 'P2', offer: 'O2', inventory: 0 }
  ];

  const decremented1 = decrementPartnerInventory(partners, 0);
  assert.strictEqual(decremented1[0].inventory, 0);

  const decremented2 = decrementPartnerInventory(partners, 1);
  assert.strictEqual(decremented2[1].inventory, 0, 'Must not go negative');
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
  assert.ok(html.includes('id="book-chance"'), 'HTML must have an input with id="book-chance"');
  assert.ok(html.includes('id="partner-chance"'), 'HTML must have an input with id="partner-chance"');
  assert.ok(html.includes('id="book-offers"'), 'HTML must have textarea with id="book-offers"');
  assert.ok(html.includes('id="partner-rows-container"'), 'HTML must have container with id="partner-rows-container"');
  assert.ok(html.includes('id="btn-add-partner"'), 'HTML must have Add Partner button');
  assert.ok(html.includes('id="btn-save-settings"'), 'HTML must have Save Settings button');

  // Verify Prize proof container inside result-stage
  assert.ok(html.includes('id="prize-proof-container"'), 'HTML must have container with id="prize-proof-container"');
});

test('SW: prize.js listed in offline cache assets', () => {
  const swPath = path.join(__dirname, '../public/sw.js');
  const sw = fs.readFileSync(swPath, 'utf8');

  assert.ok(sw.includes('js/prizes.js'), 'Service worker assets must include js/prizes.js');
  assert.ok(sw.includes('rivet-roulette-v4'), 'Service worker cache version must be updated to v4');
});
