/**
 * Copies the web-facing brand assets from ../diadem-consults-brand into
 * public/ so Angular can serve them. The brand pack stays the single source
 * of truth; the copies are gitignored.
 *
 * Runs automatically before start, build and test.
 */
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const brand = join(root, '..', 'diadem-consults-brand');
const out = join(root, 'public');

if (!existsSync(brand)) {
  console.warn(`[sync-brand] ${brand} not found — keeping whatever is already in public/.`);
  process.exit(0);
}

mkdirSync(out, { recursive: true });

// Only the files the site actually references (src/index.html, site.webmanifest).
// The in-app logo is inline SVG (src/app/layout/logo.component.ts).
const copies = [
  ['icons/favicon.ico', 'favicon.ico'],
  ['icons/icon-dark.svg', 'icon-dark.svg'],
  ['icons/icon-dark-180.png', 'icon-dark-180.png'], // apple-touch-icon
  ['icons/icon-dark-192.png', 'icon-dark-192.png'], // manifest
  ['icons/icon-dark-512.png', 'icon-dark-512.png'], // manifest
  ['site.webmanifest', 'site.webmanifest'],
  ['social/og-image.png', 'social/og-image.png'], // og:image
];

for (const [from, to] of copies) {
  const dest = join(out, to);
  mkdirSync(dirname(dest), { recursive: true });
  cpSync(join(brand, from), dest);
}

console.log('[sync-brand] brand assets copied to public/');
