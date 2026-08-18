/* Builds dist/ — exactly what gets published, nothing else.
 *
 * The site itself has no build step; this only exists so internal files
 * (CLAUDE.md, .claude/, tools/, README) never end up on a public URL.
 *
 *   node tools/pack.mjs          -> dist/
 *   node tools/pack.mjs --zip    -> dist/ + rocket-delivery-site.zip
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist');

/* everything a browser can request, and nothing that is only ours */
const PUBLISH = [
  'index.html',
  'privacy.html',
  '404.html',
  'favicon.svg',
  'apple-touch-icon.png',
  'robots.txt',
  'sitemap.xml',
  'vercel.json',
  'assets',
];

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });

let files = 0;
let bytes = 0;

function copy(rel) {
  const from = path.join(ROOT, rel);
  const to = path.join(DIST, rel);
  if (!fs.existsSync(from)) throw new Error('missing from the source folder: ' + rel);
  const stat = fs.statSync(from);
  if (stat.isDirectory()) {
    fs.mkdirSync(to, { recursive: true });
    for (const entry of fs.readdirSync(from)) copy(path.join(rel, entry));
  } else {
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(from, to);
    files++;
    bytes += stat.size;
  }
}

for (const item of PUBLISH) copy(item);

console.log('dist/  ' + files + ' files, ' + (bytes / 1024 / 1024).toFixed(1) + ' MB');

if (process.argv.includes('--zip')) {
  const zip = path.join(ROOT, 'rocket-delivery-site.zip');
  fs.rmSync(zip, { force: true });
  /* Compress-Archive ships with Windows, so this needs nothing installed.
     The wildcard keeps dist/ itself out of the archive — Netlify Drop wants
     index.html at the root of the zip, not one folder down. */
  execFileSync('powershell', [
    '-NoProfile', '-Command',
    'Compress-Archive -Path ' + JSON.stringify(path.join(DIST, '*')) +
    ' -DestinationPath ' + JSON.stringify(zip) + ' -CompressionLevel Optimal',
  ], { stdio: 'inherit' });
  console.log('zip    ' + (fs.statSync(zip).size / 1024 / 1024).toFixed(1) + ' MB  ->  ' + zip);
}
