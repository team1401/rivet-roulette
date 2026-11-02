import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.dirname(__dirname);

// app.js touches the DOM while its module body runs, so the browser globals it
// needs must exist before it is evaluated. Hence a dynamic import.
function installBrowserGlobals() {
  const store = {};
  const elements = new Map();

  const makeElement = (id) => {
    const classes = new Set();
    return {
      id,
      tagName: 'DIV',
      children: [],
      textContent: '',
      innerHTML: '',
      offsetHeight: 0,
      classList: {
        add(...names) {
          names.forEach((name) => classes.add(name));
        },
        remove(...names) {
          names.forEach((name) => classes.delete(name));
        },
        contains(name) {
          return classes.has(name);
        },
      },
      appendChild(child) {
        this.children.push(child);
        return child;
      },
      querySelector() {
        return null;
      },
    };
  };

  const documentStub = {
    addEventListener() {},
    createElement(tag) {
      return makeElement(tag);
    },
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, makeElement(id));
      return elements.get(id);
    },
  };

  const localStorageStub = {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
    },
    setItem(key, value) {
      store[key] = String(value);
    },
    removeItem(key) {
      delete store[key];
    },
  };

  globalThis.localStorage = localStorageStub;
  globalThis.document = documentStub;
  globalThis.window = {
    localStorage: localStorageStub,
    addEventListener() {},
    setTimeout: (fn) => fn(),
    speechSynthesis: undefined,
  };

  return { store, elements, document: documentStub };
}

const dom = installBrowserGlobals();
const app = await import('../public/js/app.js');

const {
  SESSION_DURATION_MS,
  PRIZE_VALIDITY_MS,
  ADMIN_PIN,
  BOOK_PROVIDER,
  getBestFallbackVoice,
  formatDateTime,
  escapeHtml,
  generateUUID,
  renderPrizeProof,
} = app;

test('app.js: exposes its documented module surface', () => {
  for (const [name, value] of Object.entries(app)) {
    assert.ok(name.length > 0, 'Every export must be named');
    assert.ok(value !== undefined, `Export ${name} must be defined`);
  }

  assert.strictEqual(typeof SESSION_DURATION_MS, 'number');
  assert.strictEqual(typeof PRIZE_VALIDITY_MS, 'number');
  assert.strictEqual(typeof ADMIN_PIN, 'string');
  assert.strictEqual(typeof BOOK_PROVIDER, 'string');
  for (const fn of [getBestFallbackVoice, formatDateTime, escapeHtml, generateUUID, renderPrizeProof]) {
    assert.strictEqual(typeof fn, 'function');
  }
});

test('app.js: session and prize timing constants match the product spec', () => {
  assert.strictEqual(SESSION_DURATION_MS, 30_000, 'Session lock must last 30 seconds');
  assert.strictEqual(PRIZE_VALIDITY_MS, 60 * 60 * 1000, 'Prizes must be valid for exactly one hour');
  assert.strictEqual(ADMIN_PIN, '4167', 'Admin PIN must match the documented value');
  assert.strictEqual(BOOK_PROVIDER, 'Brian Smith - Author');
});

test('escapeHtml: escapes all markup-significant characters', () => {
  assert.strictEqual(escapeHtml(`<b>a & b</b>`), '&lt;b&gt;a &amp; b&lt;/b&gt;');
  assert.strictEqual(escapeHtml(`"quoted" and 'single'`), '&quot;quoted&quot; and &#039;single&#039;');
});

test('escapeHtml: returns an empty string for non-string input', () => {
  for (const value of [undefined, null, 42, {}, [], NaN]) {
    assert.strictEqual(escapeHtml(value), '', `escapeHtml(${String(value)}) must return ''`);
  }
});

test('escapeHtml: neutralizes an injected script payload', () => {
  const injected = '<img src=x onerror="alert(1)">Rivet</img>';
  const escaped = escapeHtml(injected);
  assert.ok(!escaped.includes('<'), 'No raw angle brackets may survive escaping');
  assert.ok(escaped.includes('&lt;img'), 'Tag name must be preserved as text');
});

test('formatDateTime: renders a fixed instant as a US date with timezone', () => {
  const rendered = formatDateTime(new Date('2026-03-14T18:30:45Z'));
  assert.strictEqual(typeof rendered, 'string');
  assert.match(rendered, /2026/, 'Must include the year');
  assert.ok(/[AP]M/.test(rendered), 'Must use a 12-hour clock');
  assert.ok(/\s[A-Z]{3,}/.test(rendered), 'Must include an abbreviated timezone name');
});

test('formatDateTime: matches Intl output for the same options', () => {
  const date = new Date('2026-01-02T03:04:05Z');
  const expected = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    timeZoneName: 'short',
  }).format(date);
  assert.strictEqual(formatDateTime(date), expected);
});

test('generateUUID: returns RFC 4122 v4 identifiers that are unique', () => {
  const ids = new Set();
  for (let i = 0; i < 50; i++) {
    const id = generateUUID();
    assert.match(
      id,
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      `Not a valid v4 UUID: ${id}`
    );
    ids.add(id);
  }
  assert.strictEqual(ids.size, 50, 'generateUUID must not repeat identifiers');
});

const voice = (name, lang, { localService = false, voiceURI = '', defaultVoice = false } = {}) => ({
  name,
  lang,
  localService,
  voiceURI,
  default: defaultVoice,
});

test('getBestFallbackVoice: prefers a Siri voice over every other option', () => {
  const voices = [
    voice('Samantha', 'en-US', { localService: true, voiceURI: 'Apple Samantha' }),
    voice('Siri', 'en-GB', { localService: true }),
    voice('Zira', 'en-US'),
  ];
  assert.strictEqual(getBestFallbackVoice(voices).name, 'Siri');
});

test('getBestFallbackVoice: ignores non-English Siri voices', () => {
  const voices = [
    voice('Siri', 'fr-FR'),
    voice('Samantha', 'en-US', { localService: true, voiceURI: 'Apple Samantha' }),
  ];
  assert.strictEqual(getBestFallbackVoice(voices).name, 'Samantha');
});

test('getBestFallbackVoice: falls back through the documented voice tiers', () => {
  const enhanced = voice('Ava (Enhanced)', 'en-US', { localService: true });
  assert.strictEqual(getBestFallbackVoice([voice('Zira', 'en-US'), enhanced]).name, 'Ava (Enhanced)');

  const apple = voice('Daniel', 'en-GB', { localService: true, voiceURI: 'Apple Daniel' });
  assert.strictEqual(getBestFallbackVoice([voice('Zira', 'en-US'), apple]).name, 'Daniel');

  const local = voice('Karen', 'en-AU', { localService: true });
  assert.strictEqual(getBestFallbackVoice([voice('Zira', 'en-US'), local]).name, 'Karen');

  const remote = voice('Microsoft David', 'en-US');
  assert.strictEqual(getBestFallbackVoice([voice('Amelie', 'fr-FR'), remote]).name, 'Microsoft David');
});

test('getBestFallbackVoice: uses the browser default, then the first voice', () => {
  const asDefault = voice('Amelie', 'fr-FR', { defaultVoice: true });
  assert.strictEqual(getBestFallbackVoice([voice('Mei-Juia', 'zh-HK'), asDefault]).name, 'Amelie');

  assert.strictEqual(getBestFallbackVoice([voice('Mei-Juia', 'zh-HK')]).name, 'Mei-Juia');
});

test('getBestFallbackVoice: returns null when no voices are available', () => {
  assert.strictEqual(getBestFallbackVoice([]), null);
  assert.strictEqual(getBestFallbackVoice(null), null);
  assert.strictEqual(getBestFallbackVoice(undefined), null);
});

test('renderPrizeProof: renders a book voucher with escaped provider and offer', () => {
  const container = dom.document.getElementById('prize-proof-container');
  const prize = {
    type: 'book',
    offer: '50% off <Rivet & Rust>',
    awardedAt: new Date('2026-03-14T18:30:45Z').getTime(),
  };

  renderPrizeProof(prize);

  const html = container.innerHTML;
  assert.ok(html.includes('BOOK DISCOUNT VOUCHER'), 'Book prizes render a book discount headline');
  assert.ok(html.includes(BOOK_PROVIDER), 'Must name the awarding provider');
  assert.ok(html.includes('50% off &lt;Rivet &amp; Rust&gt;'), 'Offer text must be HTML-escaped');
  assert.ok(html.includes('Take a photo of this screen and show it to the vendor.'));
});

test('renderPrizeProof: renders a partner perk voucher using the vendor name', () => {
  const container = dom.document.getElementById('prize-proof-container');
  const prize = {
    type: 'partner',
    vendor: 'Ev <Towers> Live',
    offer: 'Free episode download',
    awardedAt: new Date('2026-03-14T18:30:45Z').getTime(),
  };

  renderPrizeProof(prize);

  const html = container.innerHTML;
  assert.ok(html.includes('PARTNER PERK VOUCHER'), 'Partner prizes render a partner perk headline');
  assert.ok(html.includes('Ev &lt;Towers&gt; Live'), 'Vendor name must be HTML-escaped');
  assert.ok(!html.includes(BOOK_PROVIDER), 'Partner vouchers must not name the book provider');
});

test('renderPrizeProof: clears the container when no prize was awarded', () => {
  const container = dom.document.getElementById('prize-proof-container');
  container.innerHTML = 'stale voucher';
  const stage = dom.document.getElementById('result-stage');
  stage.classList.add('has-prize');

  renderPrizeProof(null);

  assert.strictEqual(container.innerHTML, '', 'A spin without a prize must clear the voucher markup');
  assert.ok(!stage.classList.contains('has-prize'), 'The prize styling must be removed');
});

test('app.js: every element id it queries exists in index.html', () => {
  const html = fs.readFileSync(path.join(rootDir, 'public', 'index.html'), 'utf8');
  const source = fs.readFileSync(path.join(rootDir, 'public', 'js', 'app.js'), 'utf8');

  const declaredIds = new Set([...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
  const queriedIds = [...source.matchAll(/getElementById\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1]);

  assert.ok(queriedIds.length > 0, 'app.js must query at least one element');
  const missing = [...new Set(queriedIds)].filter((id) => !declaredIds.has(id));
  assert.deepStrictEqual(missing, [], `app.js queries ids missing from index.html: ${missing.join(', ')}`);
});
