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

const copies = [
  ['icons', '.'], // favicon.ico, icon-dark.svg, icon-dark-180.png … at the site root
  ['site.webmanifest', 'site.webmanifest'],
  ['social', 'social'],
  ['logo', 'logo'],
];

for (const [from, to] of copies) {
  cpSync(join(brand, from), join(out, to), { recursive: true });
}

console.log('[sync-brand] brand assets copied to public/');
