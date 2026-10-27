/* Builds the Content-Security-Policy from what the site actually contains, and
 * writes it into vercel.json.
 *
 * A CSP with hard-coded hashes is a trap: the day someone edits an inline
 * script the hash stops matching, the browser refuses to run it, and the page
 * breaks in a way that looks nothing like the edit that caused it. So the
 * hashes are computed here, at build time, from the files being shipped.
 *
 * Run it after tools/citypages.mjs — it hashes the generated pages too.
 *
 *   node tools/csp.mjs           write the policy
 *   node tools/csp.mjs --check   fail if vercel.json is out of date, write nothing
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHECK = process.argv.includes('--check');

/* every HTML file we publish, including the generated directories */
function htmlFiles(dir = ROOT, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || e.name === 'node_modules' ||
        e.name === 'dist' || e.name === 'tools') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) htmlFiles(p, out);
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

/* Inline scripts that actually execute. A type the browser does not run —
   application/ld+json, importmap, a template — is not subject to script-src,
   so hashing it would only bloat the header. */
const EXECUTES = t => !t || /^(text\/javascript|application\/javascript|module)$/i.test(t.trim());

const files = htmlFiles();
const hashes = new Map();          // hash → the snippet it came from, for the report

for (const f of files) {
  const html = fs.readFileSync(f, 'utf8');
  for (const m of html.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g)) {
    const type = (m[1].match(/type\s*=\s*["']([^"']*)["']/) || [])[1];
    if (!EXECUTES(type)) continue;
    const body = m[2];
    const h = 'sha256-' + crypto.createHash('sha256').update(body, 'utf8').digest('base64');
    if (!hashes.has(h)) hashes.set(h, body.trim().replace(/\s+/g, ' ').slice(0, 64));
  }
}

const sorted = [...hashes.keys()].sort();

/* The policy itself.
 *
 * script-src has no 'unsafe-inline' and no CDN: every library on this site is
 * self-hosted, so an injected <script> has nowhere to load from and an injected
 * inline script will not match a hash. That is the directive that matters.
 *
 * style-src keeps 'unsafe-inline' because the markup carries style attributes
 * throughout. Worth being explicit about the trade: it means an attacker who
 * can already inject markup could restyle the page. That is defacement, not
 * code execution, and removing it would mean rewriting every style attribute
 * on 341 pages for a much smaller gain than script-src already buys.
 *
 * object-src and base-uri are shut entirely — both are pure attack surface
 * here, since the site has no plugins and no <base> tag. */
/* Google Ads conversion tracking, and nothing wider.
 *
 * The tag is the one third party on this site, so each origin it needs is
 * named rather than letting a wildcard in. gtag.js itself comes from
 * googletagmanager; the conversion beacon goes to googleadservices and
 * doubleclick; the pixel variants come back as images; and the conversion
 * linker opens a frame on td.doubleclick.net, which is why frame-src stops
 * being 'none'. google.co.il is listed beside google.com because the ping
 * follows the visitor's country domain and the audience here is Israeli. */
const G = {
  /* doubleclick belongs in script-src, not only in img-src: the conversion
     ping is fetched as a SCRIPT (viewthroughconversion), which the first
     version of this policy blocked outright. Found by loading it. */
  script:  ['https://www.googletagmanager.com', 'https://www.googleadservices.com',
            'https://www.google.com', 'https://googleads.g.doubleclick.net'],
  /* ad.doubleclick.net is the cross-domain conversion linker. It only fires
     when a gclid is present — that is, only on the ad traffic this whole job
     exists to measure — so leaving it out would have cost attribution on
     exactly the clicks that matter, and quietly. Found by loading the page
     with a gclid rather than without one.
     img and connect cannot execute anything, so the list here is a little
     wider than script-src, which stays tight. */
  img:     ['https://www.google.com', 'https://www.google.co.il',
            'https://www.googleadservices.com', 'https://googleads.g.doubleclick.net',
            'https://ad.doubleclick.net', 'https://pagead2.googlesyndication.com',
            'https://www.googletagmanager.com'],
  connect: ['https://www.google.com', 'https://www.google.co.il',
            'https://www.googleadservices.com', 'https://googleads.g.doubleclick.net',
            'https://ad.doubleclick.net', 'https://pagead2.googlesyndication.com',
            'https://www.googletagmanager.com', 'https://stats.g.doubleclick.net'],
  frame:   ['https://td.doubleclick.net', 'https://bid.g.doubleclick.net',
            'https://www.googletagmanager.com'],
};

const policy = [
  "default-src 'self'",
  /* Hash sources MUST be quoted. Unquoted, the browser reports each one as an
     invalid source, drops it, and then blocks every inline script on the page —
     which on this site means the `js` class never lands and the whole thing
     renders in its no-JavaScript state. Caught by loading the policy rather
     than by reading it. */
  "script-src 'self' " + G.script.join(' ') + ' ' + sorted.map(h => `'${h}'`).join(' '),
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: " + G.img.join(' '),
  "font-src 'self'",
  "connect-src 'self' " + G.connect.join(' '),
  "manifest-src 'self'",
  "media-src 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  "frame-src " + G.frame.join(' '),
  "object-src 'none'",
  "base-uri 'none'",
  'upgrade-insecure-requests',
].join('; ');

const VERCEL = path.join(ROOT, 'vercel.json');
const conf = JSON.parse(fs.readFileSync(VERCEL, 'utf8'));

const global = conf.headers.find(h => h.source === '/(.*)');
if (!global) { console.error('לא נמצא בלוק הכותרות הגלובלי ב-vercel.json'); process.exit(1); }

/* A static courier site needs none of these. Naming them explicitly means a
   script that somehow does run still cannot reach the camera, the clipboard or
   a payment sheet — and it closes them for embedded content too, not just for
   us. The three that were already here (geolocation, microphone, camera) stay
   first so the diff reads as an extension rather than a replacement. */
const PERMISSIONS = [
  'geolocation', 'microphone', 'camera', 'payment', 'usb', 'serial', 'bluetooth',
  'midi', 'magnetometer', 'gyroscope', 'accelerometer', 'display-capture',
  'screen-wake-lock', 'idle-detection', 'local-fonts', 'xr-spatial-tracking',
].map(f => `${f}=()`).join(', ');

const WANT = {
  'Content-Security-Policy': policy,
  'Permissions-Policy': PERMISSIONS,
  /* isolates the browsing context, so a window we open cannot reach back
     into ours even if rel=noopener were ever dropped from a link */
  'Cross-Origin-Opener-Policy': 'same-origin',
  /* our assets may not be embedded by other origins */
  'Cross-Origin-Resource-Policy': 'same-origin',
  /* no crossdomain.xml here; say so rather than leave it to a default */
  'X-Permitted-Cross-Domain-Policies': 'none',
};

let changed = false;
for (const [key, value] of Object.entries(WANT)) {
  const row = global.headers.find(h => h.key === key);
  if (row) { if (row.value !== value) { row.value = value; changed = true; } }
  else { global.headers.push({ key, value }); changed = true; }
}

console.log(`קבצי HTML שנסרקו: ${files.length}`);
console.log(`סקריפטים inline ייחודיים: ${sorted.length}`);
for (const h of sorted) console.log(`  ${h.slice(0, 26)}…  ${hashes.get(h)}`);

if (CHECK) {
  if (changed) { console.error('\n✗ vercel.json לא מעודכן — הריצו node tools/csp.mjs'); process.exit(1); }
  console.log('\n✓ ה-CSP ב-vercel.json תואם לקבצים');
  process.exit(0);
}

if (changed) {
  fs.writeFileSync(VERCEL, JSON.stringify(conf, null, 2) + '\n');
  console.log('\n✓ vercel.json עודכן');
} else {
  console.log('\n✓ vercel.json כבר מעודכן');
}
console.log(`\nאורך ה-CSP: ${policy.length} תווים`);
