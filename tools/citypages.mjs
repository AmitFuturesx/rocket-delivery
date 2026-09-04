/* Generates one page per city we actually serve.
 *
 * The competitor has 325 of these and they are worth nothing: every one of them
 * ships the same empty HTML with the same title. The whole point of ours is the
 * opposite — each page carries the real quote for real routes out of that town,
 * taken from the same measured table the calculator uses, plus the towns around
 * it that we actually cover. That is content no competitor can copy without
 * having the prices.
 *
 * Pages are written as <slug>/index.html so the URL is /משלוחים-ב<עיר> with no
 * extension, which works with cleanUrls:false.
 *
 *   node tools/citypages.mjs           build
 *   node tools/citypages.mjs --dry     list what it would build, write nothing
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/* fileURLToPath, not url.pathname — this machine's home directory is Hebrew and
   pathname hands back the percent-encoded form, which fs cannot open. */
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const APP  = path.join(ROOT, 'assets/js/app.js');
const SITE = 'https://rocket-deliveries.com';
const WA   = '972537232057';
const TEL  = '053-7232057';
const DRY  = process.argv.includes('--dry');

/* ── pull the live data out of app.js so the pages can never drift from the
      calculator: one source of truth, read at build time ─────────────────── */
const src = fs.readFileSync(APP, 'utf8');

const grab = (re, what) => {
  const m = src.match(re);
  if (!m) { console.error('לא נמצא ב-app.js: ' + what); process.exit(1); }
  return m[1];
};

const CITIES = [...grab(/var CITIES = \[([\s\S]*?)\n {2}\];/, 'CITIES')
  .matchAll(/\['([^']+)',\s*([\d.]+),\s*([\d.]+)/g)]
  .map((m, i) => ({ i, name: m[1], lat: +m[2], lon: +m[3] }));

const DIST_N = +grab(/var DIST_N = (\d+);/, 'DIST_N');
const DIST = grab(/var DIST =\n([\s\S]*?);\n/, 'DIST')
  .split('\n').filter(l => /^\s+'/.test(l))
  .map(l => l.match(/'([^']*)'/)[1]).join('');

const ALUF = (() => {
  const blk = grab(/var ALUF_NET = \{([\s\S]*?)\n {2}\};/, 'ALUF_NET');
  const origin = blk.match(/'([^']+)':/)[1];
  const flat = blk.split('\n')
    .filter(l => /^\s+'/.test(l) && !/':\s*$/.test(l))
    .map(l => l.match(/'([^']*)'/)[1]).join('');
  const out = {};
  for (const p of flat.split(',')) {
    const [city, net] = p.split(':');
    if (!city || !net) continue;
    out[origin + '|' + city] = +net;
    out[city + '|' + origin] = +net;
  }
  return out;
})();

const PRICING = { perKm: 4, minCharge: 120, inCityKm: 12, vat: 0.18,
                  size: { small: 1, medium: 1.1, large: 1.21 } };

const byName = Object.fromEntries(CITIES.map(c => [c.name, c]));

function roadKm(a, b) {
  let i = byName[a]?.i, j = byName[b]?.i;
  if (i == null || j == null || i === j) return 0;
  if (i > j) { const t = i; i = j; j = t; }
  const k = i * DIST_N - i * (i + 1) / 2 + (j - i - 1);
  return parseInt(DIST.substr(k * 2, 2), 36);
}

/* the calculator's own precedence: a measured competitor price beats the model */
function quote(a, b, size = 'small') {
  const measured = ALUF[a + '|' + b];
  const f = PRICING.size[size];
  if (typeof measured === 'number') {
    const net = measured * f;
    return { net: Math.round(net), gross: Math.round(net * (1 + PRICING.vat)),
             km: roadKm(a, b), measured: true };
  }
  const km = roadKm(a, b);
  const raw = km * PRICING.perKm;
  const net = (km <= PRICING.inCityKm || raw < PRICING.minCharge ? PRICING.minCharge : raw) * f;
  return { net: Math.round(net), gross: Math.round(net * (1 + PRICING.vat)), km, measured: false };
}

/* ── regions, so 78 pages do not read as 78 copies ───────────────────────── */
const REGIONS = {
  dan:       { label: 'גוש דן',        hub: 'תל אביב' },
  sharon:    { label: 'השרון',          hub: 'נתניה' },
  shfela:    { label: 'השפלה',          hub: 'ראשון לציון' },
  jerusalem: { label: 'ירושלים והסביבה', hub: 'ירושלים' },
  south:     { label: 'הדרום',          hub: 'באר שבע' },
  north:     { label: 'הצפון',          hub: 'חיפה' },
};

function regionOf(c) {
  const { lat, lon } = c;
  if (lat >= 32.60) return 'north';
  if (lat <= 31.30) return 'south';
  if (lon >= 34.95 && lat >= 31.60 && lat <= 32.00) return 'jerusalem';
  if (lat >= 32.20) return 'sharon';
  if (lat >= 31.95) return 'dan';
  return 'shfela';
}

/* towns within 15 km — the "we also collect from" list, computed not invented */
function neighbours(name, max = 8) {
  return CITIES
    .filter(c => c.name !== name)
    .map(c => ({ name: c.name, km: roadKm(name, c.name) }))
    .filter(c => c.km > 0 && c.km <= 15)
    .sort((a, b) => a.km - b.km)
    .slice(0, max);
}

/* the destinations worth showing a price for, from this town */
function routesFrom(name) {
  const targets = ['תל אביב', 'ירושלים', 'חיפה', 'באר שבע', 'נתניה', 'פתח תקווה',
                   'ראשון לציון', 'אשדוד', 'רחובות', 'מודיעין'];
  return targets
    .filter(t => t !== name && byName[t])
    .map(t => ({ to: t, ...quote(name, t) }))
    .filter(r => r.km > 0)
    .sort((a, b) => a.km - b.km)
    .slice(0, 6);
}

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const slug = name => 'משלוחים-ב' + name.replace(/\s+/g, '-').replace(/["']/g, '');
const nis = n => n.toLocaleString('he-IL') + ' ₪';

/* ── shared page shell ───────────────────────────────────────────────────
   Head, icon defs, header and footer live here once. Both the city pages
   and the service-area hub render through it, so a change to the header
   cannot land on one and miss the other. */
function shell({ title, desc, url, ver, schema, body }) {
  return `<!DOCTYPE html>
<html lang="he" dir="rtl" class="no-js">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
<meta name="robots" content="index, follow, max-image-preview:large">
<meta name="theme-color" content="#0B1023">
<meta property="og:type" content="website">
<meta property="og:locale" content="he_IL">
<meta property="og:site_name" content="רוקט משלוחים">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE}/assets/images/brand/og-cover.jpg">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="stylesheet" href="/assets/css/style.css?v=${ver}">
<script>document.documentElement.className='js';</script>
<script type="application/ld+json">
${JSON.stringify(schema, null, 2)}
</script>
</head>
<body>

<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>
  <symbol id="i-rocket" viewBox="0 0 40 40"><g transform="rotate(-45 20 20)">
    <path d="M20 3.6c4.4 4.9 6.5 10.9 6.5 17.1 0 3.4-.7 6.7-2 9.7h-9c-1.3-3-2-6.3-2-9.7 0-6.2 2.1-12.2 6.5-17.1Z" fill="currentColor"/>
    <circle cx="20" cy="14.6" r="3" fill="#F04800"/>
    <path d="M13.6 20.8 8.2 27v5.4l5.4-3.3Zm12.8 0 5.4 6.2v5.4l-5.4-3.3Z" fill="#F04800"/>
    <path d="M17.2 31.6h5.6L20 37.4Z" fill="#F04800"/></g></symbol>
  <symbol id="i-phone" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M7.6 3.5H4.9A1.9 1.9 0 0 0 3 5.4C3 14.6 9.4 21 18.6 21a1.9 1.9 0 0 0 1.9-1.9v-2.7l-4.4-1.8-1.9 2.3a13.7 13.7 0 0 1-5.1-5.1l2.3-1.9L7.6 3.5Z"/></symbol>
  <symbol id="i-whatsapp" viewBox="0 0 24 24"><path fill="currentColor" d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.64.08-.3-.15-1.26-.47-2.4-1.48-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.44-.53.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.87 1.21 3.07.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.7.62.71.23 1.36.2 1.87.12.57-.09 1.75-.72 2-1.41.25-.7.25-1.29.18-1.41-.08-.13-.28-.2-.57-.35M12.05 21.8a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.89 9.89-9.89 2.64 0 5.12 1.03 6.99 2.9a9.83 9.83 0 0 1 2.89 6.99c0 5.45-4.43 9.89-9.89 9.89m8.42-18.3A11.82 11.82 0 0 0 12.05 0C5.5 0 .16 5.34.16 11.9c0 2.09.55 4.14 1.59 5.94L.06 24l6.3-1.65a11.88 11.88 0 0 0 5.69 1.45c6.55 0 11.89-5.34 11.89-11.9 0-3.17-1.24-6.16-3.48-8.4Z"/></symbol>
</defs></svg>

<header class="header is-stuck" id="site-header">
  <div class="container container--wide">
    <div class="header__bar">
      <a class="logo" href="/" aria-label="רוקט משלוחים — לדף הבית">
        <svg class="logo__mark" viewBox="0 0 40 40" aria-hidden="true"><use href="#i-rocket"></use></svg>
        <span class="logo__type"><b>ROCKET</b><span>DELIVERY</span></span>
      </a>
      <div class="header__actions" style="margin-inline-start:auto">
        <a class="btn btn--primary" href="/#calculator">חשבו מחיר משלוח</a>
        <a class="icon-btn" href="tel:+${WA}" aria-label="התקשרו אלינו: ${TEL}">
          <svg width="21" height="21" aria-hidden="true"><use href="#i-phone"></use></svg>
        </a>
      </div>
    </div>
  </div>
</header>
${body}

<footer class="footer">
  <div class="container">
    <div class="footer__bottom" style="margin-block-start:0;border:0">
      <span>© <span id="year">2026</span> רוקט משלוחים. כל הזכויות שמורות.</span>
      <span>נבנה ע"י <a href="https://amitzur.digital" target="_blank" rel="noopener">Amitzur Digital</a></span>
    </div>
  </div>
</footer>

<script>document.getElementById('year').textContent=new Date().getFullYear();</script>
</body>
</html>
`;
}

/* ── the page ─────────────────────────────────────────────────────────────── */
function render(city, ver) {
  const reg = REGIONS[regionOf(city)];
  const nb = neighbours(city.name);
  const routes = routesFrom(city.name);
  const cheapest = routes.length ? Math.min(...routes.map(r => r.gross)) : 142;
  const url = SITE + '/' + slug(city.name);

  const title = `משלוחים ב${city.name} — מהיום להיום | רוקט משלוחים`;
  const desc = `שירות שליחויות ב${city.name} ובכל ${reg.label}. איסוף באותו יום, מסירה מתועדת, מחיר ידוע מראש מ־${nis(cheapest)} כולל מע"מ. מסירה משפטית ומשלוחים לעסקים.`;

  const routeRows = routes.map(r => `
        <tr>
          <td>${esc(city.name)} ← ${esc(r.to)}</td>
          <td class="num">${r.km} ק״מ</td>
          <td class="num">${nis(r.net)}</td>
          <td class="num strong">${nis(r.gross)}</td>
        </tr>`).join('');

  const nbList = nb.length
    ? `<p class="city-nb">אנחנו אוספים גם מ${nb.map(n => esc(n.name)).join('، ')} — כל היישובים האלה נמצאים בטווח של ${Math.max(...nb.map(n => n.km))} ק״מ מ${esc(city.name)} ומשויכים לאותו שליח.</p>`
    : '';

  const faq = [
    { q: `כמה עולה משלוח מ${city.name}?`,
      a: `משלוח קטן מ${city.name} מתחיל ב־${nis(cheapest)} כולל מע"מ. המחיר נקבע לפי מרחק הנסיעה בפועל וגודל החבילה — במחשבון שבאתר תקבלו הערכה מדויקת תוך פחות מדקה.` },
    { q: `תוך כמה זמן אוספים חבילה ב${city.name}?`,
      a: `בשירות מהיום להיום אנחנו יוצאים לאיסוף ב${city.name} בסמוך לאישור ההזמנה, בהתאם לזמינות השליחים ב${reg.label}. אחרי האישור בוואטסאפ נעדכן אתכם בזמן האיסוף המשוער.` },
    { q: `אתם מבצעים מסירה משפטית ב${city.name}?`,
      a: `כן. מסירת כתבי בי־דין ב${city.name} כוללת עד שלוש הגעות בימים ובשעות שונות, תיעוד מלא של כל הגעה, ואישור מסירה חתום. מסירה משפטית מתומחרת לגופו של תיק — דברו איתנו.` },
  ];

  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'Service',
        '@id': url + '#service',
        name: `משלוחים ושליחויות ב${city.name}`,
        serviceType: 'שירותי שליחויות',
        provider: { '@id': SITE + '/#business' },
        areaServed: { '@type': 'City', name: city.name,
                      geo: { '@type': 'GeoCoordinates', latitude: city.lat, longitude: city.lon } },
        url,
        offers: { '@type': 'Offer', priceCurrency: 'ILS', price: String(cheapest),
                  availability: 'https://schema.org/InStock' } },
      { '@type': 'FAQPage',
        '@id': url + '#faq',
        mainEntity: faq.map(f => ({ '@type': 'Question', name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
      { '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'ראשי', item: SITE + '/' },
          { '@type': 'ListItem', position: 2, name: 'אזורי שירות', item: SITE + '/אזורי-שירות' },
          { '@type': 'ListItem', position: 3, name: `משלוחים ב${city.name}`, item: url },
        ] },
    ],
  };

  return shell({ title, desc, url, ver, schema, body: `
<main class="city">
  <div class="container">

    <nav class="crumbs" aria-label="מיקום בתוך האתר">
      <a href="/">ראשי</a><span aria-hidden="true">›</span>
      <a href="/אזורי-שירות">אזורי שירות</a><span aria-hidden="true">›</span>
      <span aria-current="page">${esc(city.name)}</span>
    </nav>

    <h1 class="city__h1">משלוחים ב${esc(city.name)}<br><em>מהיום להיום.</em></h1>

    <p class="city__lead">
      רוקט משלוחים מפעילה שליחים ב${esc(city.name)} ובכל ${esc(reg.label)}. איסוף מהעסק
      או מהבית, נסיעה ישירה בלי תחנות ביניים, ומסירה עם אישור — עם מחיר שאתם יודעים
      מראש ולא אחרי המשלוח. משלוח קטן מ${esc(city.name)} מתחיל ב־<strong>${nis(cheapest)}</strong>
      כולל מע״מ.
    </p>

    <div class="city__cta">
      <a class="btn btn--primary btn--lg" href="/#calculator">חשבו מחיר מ${esc(city.name)}</a>
      <a class="btn btn--wa btn--lg" href="https://wa.me/${WA}?text=${encodeURIComponent('היי, אני צריך משלוח מ' + city.name)}" target="_blank" rel="noopener">
        <svg width="20" height="20" aria-hidden="true"><use href="#i-whatsapp"></use></svg>דברו איתנו בוואטסאפ</a>
    </div>

    <section class="city__block" aria-labelledby="prices-${esc(slug(city.name))}">
      <h2 id="prices-${esc(slug(city.name))}">מחירי משלוח מ${esc(city.name)}</h2>
      <p class="city__sub">חבילה קטנה, מהיום להיום. מחירי בינוני וגדול גבוהים ב־10% וב־21% בהתאמה.</p>
      <div class="city__scroll">
        <table class="city__table">
          <thead>
            <tr><th>מסלול</th><th>מרחק</th><th>לפני מע״מ</th><th>כולל מע״מ</th></tr>
          </thead>
          <tbody>${routeRows}
          </tbody>
        </table>
      </div>
      <p class="city__note">
        המחירים מחושבים לפי מרחק הנסיעה בפועל. שעות לילה, סופי שבוע, המתנה בכתובת
        או טיפול חריג עשויים לשנות אותם — לאישור סופי דברו איתנו.
      </p>
    </section>

    <section class="city__block">
      <h2>מה אנחנו עושים ב${esc(city.name)}</h2>
      <div class="city__grid">
        <article><h3>מהיום להיום</h3><p>איסוף ומסירה באותו יום עסקים ב${esc(city.name)} ובכל הארץ. השירות המבוקש ביותר, ומה שרוב הלקוחות מזמינים.</p></article>
        <article><h3>מהיום למחר</h3><p>איסוף היום, מסירה ביום העסקים הבא — <strong>באותו מחיר בדיוק</strong> כמו מהיום להיום. בלי תוספת על דחיפות.</p></article>
        <article><h3>מסירה משפטית</h3><p>מסירת כתבי בי־דין ב${esc(city.name)} עם עד שלוש הגעות, תיעוד כל ניסיון ואישור מסירה חתום. מתומחרת לגופו של תיק.</p></article>
        <article><h3>משלוחים לעסקים</h3><p>איסוף קבוע מחנות, מחסן או משרד ב${esc(city.name)}. חשבונית מרוכזת, שליח מוכר ומחיר סגור מראש.</p></article>
      </div>
    </section>

    ${nbList ? `<section class="city__block"><h2>יישובים נוספים באזור</h2>${nbList}</section>` : ''}

    <section class="city__block">
      <h2>שאלות נפוצות — ${esc(city.name)}</h2>
      ${faq.map(f => `<details class="fq">
        <summary>${esc(f.q)}</summary>
        <div class="faq__answer"><p>${esc(f.a)}</p></div>
      </details>`).join('\n      ')}
    </section>

    <section class="city__end">
      <h2>צריכים משלוח מ${esc(city.name)} עכשיו?</h2>
      <p>מחשבון המחיר באתר ייתן לכם הערכה תוך פחות מדקה, בלי להשאיר פרטים ובלי התחייבות.</p>
      <div class="city__cta">
        <a class="btn btn--primary btn--lg" href="/#calculator">למחשבון המחיר</a>
        <a class="btn btn--ghost btn--lg" href="tel:+${WA}">
          <svg width="18" height="18" aria-hidden="true"><use href="#i-phone"></use></svg>${TEL}</a>
      </div>
    </section>

  </div>
</main>
` });
}

/* ── build ────────────────────────────────────────────────────────────────── */
const ver = (fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')
  .match(/style\.css\?v=(\d+)/) || [, '1'])[1];

/* every town the client priced, plus every town we measured a price for */
const zoneBlk = src.match(/var ZONE_RATES = \[([\s\S]*?)\n {2}\];/)[1];
const priced = new Set();
for (const m of zoneBlk.matchAll(/'([^']+)'/g)) if (byName[m[1]]) priced.add(m[1]);
const measured = new Set(Object.keys(ALUF).map(k => k.split('|')[1]).filter(c => byName[c]));
const REGION_ALIASES = new Set(['גוש דן', 'השרון', 'השפלה', 'הגליל', 'הנגב', 'הצפון']);
const targets = [...new Set([...priced, ...measured])]
  .filter(n => !REGION_ALIASES.has(n))
  .sort((a, b) => a.localeCompare(b, 'he'));

console.log(`ערים לבנייה: ${targets.length}  (גרסת CSS: v=${ver})`);
if (DRY) { targets.forEach((t, i) => console.log(`  ${String(i + 1).padStart(3)}. ${t} → /${slug(t)}`)); process.exit(0); }

let written = 0;
for (const name of targets) {
  const city = byName[name];
  const dir = path.join(ROOT, slug(name));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), render(city, ver));
  written++;
}
console.log(`נכתבו ${written} דפים.`);

/* ── the hub ──────────────────────────────────────────────────────────────
   Every city page's breadcrumb points here, so it has to exist — but it earns
   its place on its own: it is the one page that links to all of them, which is
   how crawl equity reaches a page nobody links to from the home page. */
function renderHub() {
  const url = SITE + '/אזורי-שירות';
  const groups = {};
  for (const n of targets) (groups[regionOf(byName[n])] ||= []).push(n);

  const order = ['dan', 'sharon', 'shfela', 'jerusalem', 'south', 'north'];
  const blocks = order.filter(k => groups[k]?.length).map(k => `
      <section class="areas__group">
        <h2>${esc(REGIONS[k].label)} <span>${groups[k].length}</span></h2>
        <ul class="areas__list">
${groups[k].sort((a, b) => a.localeCompare(b, 'he'))
    .map(n => `          <li><a href="/${slug(n)}">${esc(n)}</a></li>`).join('\n')}
        </ul>
      </section>`).join('\n');

  const title = 'אזורי שירות — משלוחים בכל הארץ | רוקט משלוחים';
  const desc = `רוקט משלוחים פועלת ב־${targets.length} יישובים בכל הארץ. בחרו את היישוב שלכם וראו מחירי משלוח, זמני איסוף והשירותים הזמינים באזור.`;

  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'CollectionPage', '@id': url + '#page', name: title, description: desc, url,
        isPartOf: { '@id': SITE + '/#business' } },
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'ראשי', item: SITE + '/' },
        { '@type': 'ListItem', position: 2, name: 'אזורי שירות', item: url } ] },
    ],
  };

  return shell({ title, desc, url, ver, schema, body: `
<main class="city areas">
  <div class="container">
    <nav class="crumbs" aria-label="מיקום בתוך האתר">
      <a href="/">ראשי</a><span aria-hidden="true">›</span>
      <span aria-current="page">אזורי שירות</span>
    </nav>

    <h1 class="city__h1">אזורי שירות<br><em>בכל הארץ.</em></h1>
    <p class="city__lead">
      אנחנו פועלים ב־<strong>${targets.length} יישובים</strong>. לכל אחד מהם יש דף עם
      מחירי המשלוח בפועל מאותו יישוב, זמני האיסוף באזור והשירותים הזמינים בו —
      כולל מסירה משפטית ומשלוחים לעסקים.
    </p>
    <div class="city__cta">
      <a class="btn btn--primary btn--lg" href="/#calculator">חשבו מחיר משלוח</a>
    </div>
${blocks}
  </div>
</main>` });
}

/* sitemap — the two originals plus everything we just built */
const hubDir = path.join(ROOT, 'אזורי-שירות');
fs.mkdirSync(hubDir, { recursive: true });
fs.writeFileSync(path.join(hubDir, 'index.html'), renderHub());
console.log('דף אזורי השירות נכתב.');

const today = new Date().toISOString().slice(0, 10);
const entries = [
  { loc: SITE + '/', pri: '1.0', freq: 'weekly' },
  { loc: SITE + '/אזורי-שירות', pri: '0.9', freq: 'monthly' },
  ...targets.map(n => ({ loc: SITE + '/' + slug(n), pri: '0.8', freq: 'monthly' })),
  { loc: SITE + '/privacy.html', pri: '0.3', freq: 'yearly' },
];
fs.writeFileSync(path.join(ROOT, 'sitemap.xml'),
`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.map(e => `  <url>
    <loc>${e.loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${e.freq}</changefreq>
    <priority>${e.pri}</priority>
  </url>`).join('\n')}
</urlset>
`);
console.log(`sitemap.xml עודכן: ${entries.length} כתובות.`);
