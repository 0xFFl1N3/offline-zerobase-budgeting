// Turns the normal build (dist/) into one self-contained HTML file that works offline,
// opened straight from disk with a double-click. Run with: npm run build:single
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dist = 'dist';
const out = join(dist, 'offline-zerobase-budgeting.html');
let html = readFileSync(join(dist, 'index.html'), 'utf8');

const asset = (path) => readFileSync(join(dist, path.replace(/^\.?\//, '')), 'utf8');

// Inline the app script. "</script" inside the code would end the tag early, so it is escaped.
html = html.replace(/<script type="module" crossorigin src="([^"]+)"><\/script>/g, (_, src) =>
  `<script type="module">${asset(src).replace(/<\/script/gi, '<\\/script')}</script>`,
);
// Inline the styles.
html = html.replace(/<link rel="stylesheet" crossorigin href="([^"]+)">/g, (_, href) => `<style>${asset(href)}</style>`);

const left = html.match(/(src|href)="\.\/assets\/[^"]+"/g);
if (left) throw new Error(`Not inlined: ${left.join(', ')}`);
writeFileSync(out, html);
console.log(`Wrote ${out} (${Math.round(html.length / 1024)} KB)`);
