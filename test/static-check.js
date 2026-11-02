import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import { fileURLToPath } from 'node:url';

const baseDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

console.log('Running static, PWA, and accessibility checks...');

// 1. File existence checks
const requiredFiles = [
  'public/index.html',
  'public/styles.css',
  'public/js/app.js',
  'public/js/deck.js',
  'public/js/lines.js',
  'public/js/prizes.js',
  'public/manifest.webmanifest',
  'public/sw.js',
  'public/favicon.svg',
  'public/apple-touch-icon.png',
  'public/icon-192.png',
  'public/icon-512.png',
  'wrangler.jsonc',
  'package.json',
  'README.md'
];

for (const file of requiredFiles) {
  const filePath = path.join(baseDir, file);
  assert.ok(fs.existsSync(filePath), `Missing required file: ${file}`);
}
console.log('✓ All required files exist.');

// 2. Validate manifest.webmanifest
const manifestPath = path.join(baseDir, 'public/manifest.webmanifest');
const manifestContent = fs.readFileSync(manifestPath, 'utf8');
const manifest = JSON.parse(manifestContent);

assert.strictEqual(typeof manifest.name, 'string', 'Manifest must have a name');
assert.strictEqual(typeof manifest.short_name, 'string', 'Manifest must have a short_name');
assert.strictEqual(manifest.display, 'standalone', 'Manifest display mode must be standalone for iPad installation');
assert.ok(Array.isArray(manifest.icons) && manifest.icons.length > 0, 'Manifest must declare at least one icon');
assert.ok(manifest.theme_color, 'Manifest must declare a theme_color');
assert.ok(manifest.background_color, 'Manifest must declare a background_color');
console.log('✓ manifest.webmanifest is valid and configured correctly.');

// 3. Validate index.html accessibility and PWA metadata
const htmlPath = path.join(baseDir, 'public/index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

// Viewport fitness
assert.ok(html.includes('viewport-fit=cover'), 'HTML viewport meta tag should include viewport-fit=cover for safe-areas');
// Apple meta tags
assert.ok(html.includes('apple-mobile-web-app-capable'), 'HTML should declare apple-mobile-web-app-capable');
assert.ok(html.includes('apple-mobile-web-app-status-bar-style'), 'HTML should declare apple-mobile-web-app-status-bar-style');
// Apple touch icon strategy
assert.ok(html.includes('apple-touch-icon') && html.includes('apple-touch-icon.png'), 'HTML must reference a PNG apple-touch-icon');

// Typography & Landmarks
assert.ok(html.includes('<h1') && html.includes('</h1>'), 'HTML must contain a main header (h1)');
assert.ok(html.includes('<main') || html.includes('role="main"'), 'HTML must contain a main landmark');

// Live region
assert.ok(
  html.includes('aria-live="polite"') || html.includes('aria-live="assertive"'),
  'HTML must contain a live region to announce content changes to screen readers'
);

// Primary action buttons
assert.ok(html.includes('COMPLIMENT'), 'HTML must contain the COMPLIMENT button/label');
assert.ok(html.includes('INSULT'), 'HTML must contain the INSULT button/label');
console.log('✓ index.html conforms to PWA, responsive, and accessibility requirements.');

// 4. Validate sw.js
const swPath = path.join(baseDir, 'public/sw.js');
const swContent = fs.readFileSync(swPath, 'utf8');
assert.ok(swContent.includes('install'), 'Service worker must handle the install event');
assert.ok(swContent.includes('fetch'), 'Service worker must handle the fetch event');
assert.ok(swContent.includes('activate'), 'Service worker must handle the activate event');
assert.ok(swContent.includes('ignoreSearch: true'), 'Service worker must support cached navigation URLs with query strings');
console.log('✓ Service Worker sw.js contains base lifecycle hooks.');

// 5. Validate wrangler.jsonc
const wranglerPath = path.join(baseDir, 'wrangler.jsonc');
const wranglerContent = fs.readFileSync(wranglerPath, 'utf8');
// Simple check to make sure it points to public/
assert.ok(wranglerContent.includes('"public"'), 'wrangler.jsonc must configure the static asset directory as "public"');
console.log('✓ wrangler.jsonc static assets config is valid.');

console.log('\nAll static checks passed successfully!');
