/* Pre-deploy integrity check. No dependencies.
 *
 *   node tools/preflight.mjs            checks the source folder
 *   node tools/preflight.mjs dist       checks the built artifact
 *
 * Catches the things that have actually broken this site: a deleted asset
 * still referenced, an anchor pointing at a section that was removed, a
 * <use href="#i-x"> whose symbol is gone, an unbalanced <section> after a
 * patch script, and the usual SEO/a11y basics.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.argv[2] || '.');
const PAGES = ['index.html', 'privacy.html', '404.html'];
const CSS = 'assets/css/style.css';

let fails = 0, warns = 0;
const fail = m => { fails++; console.log('  FAIL  ' + m); };
const warn = m => { warns++; console.log('  warn  ' + m); };

const attrs = (html, name) => {
  const out = [];
  const re = new RegExp(name + '=["\']([^"\']*)["\']', 'g');
  let m;
  while ((m = re.exec(html))) out.push(m[1]);
  return out;
};

/* a reference resolves to a file: drop any ?query and #fragment first, and
   treat a leading / as relative to the site root, not the disk root */
const resolves = ref => {
  const file = ref.split('#')[0].split('?')[0];
  if (!file) return true;
  return fs.existsSync(path.join(ROOT, file.startsWith('/') ? file.slice(1) : file));
};

for (const page of PAGES) {
  const file = path.join(ROOT, page);
  if (!fs.existsSync(file)) continue;
  console.log('--- ' + page + ' ---');
  const before = fails + warns;
  const html = fs.readFileSync(file, 'utf8');
  const ids = new Set(attrs(html, 'id'));

  for (const raw of [...attrs(html, 'src'), ...attrs(html, 'href'), ...attrs(html, 'srcset')]) {
    const ref = raw.split(' ')[0];
    if (!ref || ref[0] === '#' || /^(https?:|mailto:|tel:|data:)/.test(ref)) continue;
    if (!resolves(ref)) fail('missing file: ' + ref);
  }
  for (const h of attrs(html, 'href')) {
    if (h.length > 1 && h[0] === '#' && !ids.has(h.slice(1))) fail('dead anchor: ' + h);
  }
  for (const m of html.matchAll(/<use href="#([a-z0-9-]+)"/g)) {
    if (!ids.has(m[1])) fail('missing sprite symbol: #' + m[1]);
  }

  const open = (html.match(/<section[\s>]/g) || []).length;
  const close = (html.match(/<\/section>/g) || []).length;
  if (open !== close) fail('section open/close mismatch: ' + open + ' / ' + close);

  const h1 = (html.match(/<h1[\s>]/g) || []).length;
  if (page === 'index.html' && h1 !== 1) fail('h1 count = ' + h1 + ' (should be 1)');
  if (!/rel="canonical"/.test(html) && page !== '404.html') fail('no canonical');

  const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1] || '';
  if (!title) fail('no <title>');
  else if (title.length > 62) warn('title is ' + title.length + ' chars (>62 truncates in search)');

  const imgs = html.match(/<img[^>]*>/g) || [];
  const noAlt = imgs.filter(i => !/alt=/.test(i));
  if (noAlt.length) fail(noAlt.length + ' <img> without alt');
  const noDim = imgs.filter(i => !(/width=/.test(i) && /height=/.test(i)));
  if (noDim.length) warn(noDim.length + ' of ' + imgs.length + ' <img> lack width/height (CLS risk)');

  if (fails + warns === before) console.log('  clean');
}

console.log('--- ' + CSS + ' ---');
const css = fs.readFileSync(path.join(ROOT, CSS), 'utf8');
const urls = [...new Set((css.match(/url\([^)]*\)/g) || []).map(u => u.slice(4, -1).replace(/["']/g, '').trim()))];
let checked = 0;
for (const u of urls) {
  if (/^(data:|https?:)/.test(u)) continue;
  checked++;
  if (!fs.existsSync(path.join(ROOT, 'assets/css', u.split('?')[0]))) fail('css missing file: ' + u);
}
console.log('  checked ' + checked + ' url() references');

console.log('');
console.log(fails + ' failures, ' + warns + ' warnings');
process.exit(fails ? 1 : 0);
