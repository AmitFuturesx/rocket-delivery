/* Bumps the ?v= on style.css and app.js in every HTML file.
 *
 * Those two files keep their names across releases, so a browser that cached
 * them will happily render new markup against an old stylesheet — which is
 * exactly what shipped once. A version in the URL makes that impossible: the
 * browser has never seen the new URL, so it cannot serve it from cache.
 *
 *   node tools/bump.mjs        -> next version
 *   node tools/bump.mjs 12     -> that version
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const PAGES = ['index.html', 'privacy.html', '404.html'];
const TARGETS = ['assets/css/style.css', 'assets/js/app.js'];

/* read the current version off index.html so the number survives without a
   separate state file to drift out of sync */
const first = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const current = Number((first.match(/assets\/css\/style\.css\?v=(\d+)/) || [])[1] || 0);
const next = Number(process.argv[2]) || current + 1;

let edits = 0;
for (const page of PAGES) {
  const file = path.join(ROOT, page);
  if (!fs.existsSync(file)) continue;
  let html = fs.readFileSync(file, 'utf8');
  const before = html;
  for (const target of TARGETS) {
    /* matches the bare path and any existing ?v=, so re-running is safe */
    const re = new RegExp('(["\'/])' + target.replace(/[/.]/g, m => '\\' + m) + '(\\?v=\\d+)?', 'g');
    html = html.replace(re, (_m, lead) => lead + target + '?v=' + next);
  }
  if (html !== before) { fs.writeFileSync(file, html); edits++; }
}

console.log('asset version -> ' + next + '  (' + edits + ' page' + (edits === 1 ? '' : 's') + ' updated)');
