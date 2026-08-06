import { cp, mkdir, readFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const source = resolve(root, 'public');
const output = resolve(root, 'dist');
const required = [
  'index.html',
  'privacy.html',
  'terms.html',
  'contact.html',
  '404.html',
  'robots.txt',
  'sitemap.xml',
  'cora-icon.png',
  'og.png',
  'assets/css/styles.css',
  'assets/js/ads.js',
  'assets/js/app.js',
  'assets/js/reaction-core.js',
  'assets/js/result-card.js',
  'assets/js/share-result.js',
  'assets/js/sound.js',
];

for (const file of required) await readFile(resolve(source, file));
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(source, output, { recursive: true });
console.log(`Built ${required.length} required assets into dist/.`);
