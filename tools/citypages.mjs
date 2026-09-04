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

/* ── the areas mega-menu ──────────────────────────────────────────────────
   The competitor's header carries the same idea and gets nothing for it: their
   menu is built in JavaScript, so a crawler fetching the page sees none of it.
   Ours is plain markup inside <details>, which means it works with no script,
   opens with the keyboard, and — the point — is a real link on every page.

   Curated rather than all 150: past roughly a hundred links on a page each one
   carries less, so this is the towns worth spending that on, with the hub
   catching the rest. */
let BUILT = new Set();

const MENU_CITIES = {
  dan:       ['תל אביב', 'רמת גן', 'גבעתיים', 'בני ברק', 'פתח תקווה', 'גבעת שמואל',
              'קריית אונו', 'אור יהודה', 'יהוד', 'גני תקווה', 'ראש העין', 'אלעד'],
  sharon:    ['נתניה', 'הרצליה', 'רעננה', 'כפר סבא', 'הוד השרון', 'רמת השרון',
              'כפר יונה', 'תל מונד', 'קדימה', 'אבן יהודה'],
  shfela:    ['ראשון לציון', 'חולון', 'בת ים', 'רחובות', 'נס ציונה', 'רמלה', 'לוד',
              'באר יעקב', 'יבנה', 'גדרה', 'מודיעין', 'שוהם', 'אשדוד', 'אשקלון'],
  jerusalem: ['ירושלים', 'בית שמש', 'מבשרת ציון', 'מעלה אדומים', 'גבעת זאב'],
  south:     ['באר שבע', 'קריית גת', 'אילת', 'דימונה', 'נתיבות', 'שדרות'],
  north:     ['חיפה', 'חדרה', 'קריית אתא', 'נהריה', 'עכו', 'טבריה', 'צפת',
              'כרמיאל', 'עפולה', 'נצרת', 'זכרון יעקב'],
};

const SERVICE_MENU = [
  { label: 'לפי שירות', items: ['מסירה-משפטית', 'משלוחים-דחופים', 'שליח-עד-הבית', 'משלוחים-לעסקים'] },
  { label: 'לפי תחום',  items: ['משלוחים-לעורכי-דין', 'משלוחים-לרואי-חשבון', 'משלוחים-לבתי-דפוס', 'משלוחים-למרפאות', 'משלוחים-לחנויות'] },
];

function servicesMenu() {
  const NL = String.fromCharCode(10);
  const name = s => {
    const sv = SERVICES.find(x => x.s === s);
    return sv ? sv.h1.join(' ').replace(/\.$/, '') : s;
  };
  const cols = SERVICE_MENU.map(g => `          <div class="mega__col">
            <p class="mega__region">${esc(g.label)}</p>
            <ul>
${g.items.map(i => `              <li><a href="/${i}">${esc(name(i))}</a></li>`).join(NL)}
            </ul>
          </div>`).join(NL);
  return `<details class="mega mega--svc">
        <summary aria-label="שירותים — פתיחת רשימת השירותים">שירותים</summary>
        <div class="mega__panel mega__panel--svc">
          <div class="mega__grid">
${cols}
          </div>
          <a class="mega__all" href="/#calculator">חשבו מחיר לכל שירות ←</a>
        </div>
      </details>`;
}

function megaMenu(built) {
  const order = ['dan', 'sharon', 'shfela', 'jerusalem', 'south', 'north'];
  const cols = order.map(k => {
    const list = MENU_CITIES[k].filter(c => built.has(c));
    if (!list.length) return '';
    return `          <div class="mega__col">
            <p class="mega__region">${esc(REGIONS[k].label)}</p>
            <ul>
${list.map(c => `              <li><a href="/${slug(c)}">${esc(c)}</a></li>`).join('\n')}
            </ul>
          </div>`;
  }).filter(Boolean).join('\n');

  return `<details class="mega">
        <summary aria-label="אזורי שירות — פתיחת רשימת יישובים">אזורי שירות</summary>
        <div class="mega__panel">
          <div class="mega__grid">
${cols}
          </div>
          <a class="mega__all" href="/אזורי-שירות">כל ${built.size} אזורי השירות ←</a>
        </div>
      </details>`;
}

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
      <nav class="nav" aria-label="ניווט ראשי">
        <a href="/">ראשי</a>
        ${servicesMenu()}
        <a href="/#calculator">מחשבון מחיר</a>
        ${megaMenu(BUILT)}
        <a href="/#faq">שאלות ותשובות</a>
      </nav>

      <div class="header__actions">
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
        <article><h3>מסירה משפטית</h3><p>מסירת כתבי בי־דין ב${esc(city.name)} עם עד שלוש הגעות, תיעוד כל ניסיון ואישור מסירה חתום. מתומחרת לגופו של תיק.${
          LEGAL_CITIES.includes(city.name)
            ? ` <a href="/${legalSlug(city.name)}">מסירה משפטית ב${esc(city.name)} ←</a>`
            : ''}</p></article>
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

/* ── legal-delivery pages ─────────────────────────────────────────────────
   The client's highest-margin work, and the competitor's biggest bet: 67 pages
   under /legal-service plus 36 under /lawyer-couriers. Nobody spends 103 pages
   on a category that does not pay.

   These carry no price on purpose — he quotes process serving per case, so the
   page collects the details and hands them to a person, exactly like the
   calculator does.

   Only the towns where a person plausibly searches this. A kibbutz in the Negev
   does not need a process-serving page, and building one would be the thin
   filler this whole approach is meant to avoid. */
const LEGAL_CITIES = [
  'תל אביב', 'ירושלים', 'חיפה', 'ראשון לציון', 'פתח תקווה', 'אשדוד', 'נתניה',
  'באר שבע', 'בני ברק', 'חולון', 'רמת גן', 'אשקלון', 'רחובות', 'בת ים',
  'בית שמש', 'כפר סבא', 'הרצליה', 'חדרה', 'מודיעין', 'רמלה', 'רעננה', 'לוד',
  'גבעתיים', 'הוד השרון', 'קריית גת', 'נס ציונה',
];

const legalSlug = name => 'מסירה-משפטית-ב' + name.replace(/\s+/g, '-').replace(/["']/g, '');

function renderLegal(city, ver) {
  const reg = REGIONS[regionOf(city)];
  const nb = neighbours(city.name, 6);
  const url = SITE + '/' + legalSlug(city.name);
  const wa = `https://wa.me/${WA}?text=` + encodeURIComponent(
    `שלום, אבקש הצעת מחיר למסירה משפטית ב${city.name}. אשמח לפרט את סוג המסמך וכתובת הנמען.`);

  const title = `מסירה משפטית ב${city.name} — מסירת כתבי בי־דין | רוקט משלוחים`;
  const desc = `מסירת כתבי בי־דין ומסמכים משפטיים ב${city.name}. עד שלוש הגעות בימים ובשעות שונות כולל ערב, תיעוד כל ניסיון ואישור מסירה חתום. מענה אנושי תוך 5 דקות.`;

  const faq = [
    { q: `כמה עולה מסירה משפטית ב${city.name}?`,
      a: `מסירה משפטית מתומחרת לגופו של תיק ולא לפי טבלה — המחיר נגזר ממספר ההגעות הנדרשות, מדחיפות התיק ומהאזור בתוך ${city.name}. שלחו לנו את פרטי המסירה ותקבלו הצעה מסודרת, בדרך כלל תוך חמש דקות.` },
    { q: `מה קורה אם הנמען לא נמצא בכתובת?`,
      a: `אנחנו מגיעים עד שלוש פעמים, בימים ובשעות שונות כולל שעות ערב, ומתעדים כל הגעה בנפרד. אם לא ניתן למסור לידי הנמען, מבצעים הדבקה על הדלת עם תיעוד מלא של מקום ההדבקה ושעתה — כך שהתיעוד עומד בדרישות בית המשפט.` },
    { q: `אילו מסמכים אתם מוסרים?`,
      a: `כתבי תביעה, הזמנות לדין, צווים, התראות לפני נקיטת הליכים, הודעות פינוי ומסמכים משפטיים אחרים. אם אתם לא בטוחים שהמסמך שלכם מתאים — שאלו אותנו לפני שאתם מזמינים.` },
    { q: `תוך כמה זמן מתבצעת המסירה?`,
      a: `ההגעה הראשונה ל${city.name} מתבצעת בדרך כלל תוך יום עסקים אחד מרגע אישור ההזמנה. בתיקים דחופים אפשר לצאת באותו יום — ציינו זאת כשאתם פונים אלינו.` },
  ];

  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'Service', '@id': url + '#service',
        name: `מסירה משפטית ב${city.name}`,
        serviceType: 'מסירת כתבי בי־דין',
        provider: { '@id': SITE + '/#business' },
        areaServed: { '@type': 'City', name: city.name,
          geo: { '@type': 'GeoCoordinates', latitude: city.lat, longitude: city.lon } },
        url,
        description: `מסירת כתבי בי־דין ומסמכים משפטיים ב${city.name} עם עד שלוש הגעות, תיעוד מלא ואישור מסירה חתום.` },
      { '@type': 'FAQPage', '@id': url + '#faq',
        mainEntity: faq.map(f => ({ '@type': 'Question', name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'ראשי', item: SITE + '/' },
        { '@type': 'ListItem', position: 2, name: `משלוחים ב${city.name}`, item: SITE + '/' + slug(city.name) },
        { '@type': 'ListItem', position: 3, name: `מסירה משפטית ב${city.name}`, item: url } ] },
    ],
  };

  return shell({ title, desc, url, ver, schema, body: `
<main class="city legal-page">
  <div class="container">

    <nav class="crumbs" aria-label="מיקום בתוך האתר">
      <a href="/">ראשי</a><span aria-hidden="true">›</span>
      <a href="/${slug(city.name)}">משלוחים ב${esc(city.name)}</a><span aria-hidden="true">›</span>
      <span aria-current="page">מסירה משפטית</span>
    </nav>

    <h1 class="city__h1">מסירה משפטית<br><em>ב${esc(city.name)}.</em></h1>

    <p class="city__lead">
      מסירת כתבי בי־דין ומסמכים משפטיים לנמען ב${esc(city.name)}, בהליך מתועד כחוק.
      עד <strong>שלוש הגעות</strong> בימים ובשעות שונות כולל שעות ערב, תיעוד נפרד של כל
      ניסיון, ובסיום אישור מסירה חתום שאפשר להגיש לבית המשפט.
    </p>

    <div class="city__cta">
      <a class="btn btn--wa btn--lg" href="${wa}" target="_blank" rel="noopener">
        <svg width="20" height="20" aria-hidden="true"><use href="#i-whatsapp"></use></svg>לקבלת הצעה למסירה ב${esc(city.name)}</a>
      <a class="btn btn--ghost btn--lg" href="tel:+${WA}">
        <svg width="18" height="18" aria-hidden="true"><use href="#i-phone"></use></svg>${TEL}</a>
    </div>
    <p class="legal-page__resp"><span class="price__dot" aria-hidden="true"></span>מענה אנושי תוך 5 דקות</p>

    <section class="city__block">
      <h2>איך המסירה מתבצעת</h2>
      <ol class="legal-steps">
        <li><b>קבלת המסמך</b><span>שולחים לנו את כתב בי־הדין, שם הנמען וכתובתו ב${esc(city.name)}. אם יש חלון זמן שחשוב לעמוד בו — מציינים אותו כאן.</span></li>
        <li><b>הגעה ראשונה</b><span>בדרך כלל תוך יום עסקים אחד. השליח מתעד את מועד ההגעה ואת מה שקרה בה, גם אם הנמען לא נמצא.</span></li>
        <li><b>הגעות נוספות</b><span>עד שלוש בסך הכול, במכוון בימים ובשעות שונות — כולל ערב — כדי שלא ייטען שהניסיונות נעשו כולם באותה שעה.</span></li>
        <li><b>הדבקה, אם צריך</b><span>כשלא ניתן למסור לידי הנמען, מבצעים הדבקה על הדלת ומתעדים את מקום ההדבקה ואת שעתה.</span></li>
        <li><b>אישור מסירה</b><span>בסיום מקבלים טופס מפורט עם חתימה דיגיטלית ותיעוד כל ההגעות, מוכן להגשה.</span></li>
      </ol>
    </section>

    <section class="city__block">
      <h2>מה אנחנו מוסרים</h2>
      <div class="city__grid">
        <article><h3>כתבי תביעה והזמנות לדין</h3><p>מסירה אישית לנמען ב${esc(city.name)} עם תיעוד מלא, כנדרש בתקנות סדר הדין האזרחי.</p></article>
        <article><h3>צווים והחלטות</h3><p>צווי מניעה, עיקול והחלטות בית משפט — כולל תיקים דחופים שיוצאים באותו יום.</p></article>
        <article><h3>התראות לפני הליכים</h3><p>מכתבי התראה של עורכי דין, שבהם התיעוד של המסירה חשוב לא פחות מהמסמך עצמו.</p></article>
        <article><h3>הודעות פינוי ודרישות</h3><p>מסמכים שבהם מועד המסירה המדויק הוא זה שמפעיל את השעון — ולכן הוא מתועד לדקה.</p></article>
      </div>
    </section>

    ${nb.length ? `<section class="city__block">
      <h2>גם באזור ${esc(reg.label)}</h2>
      <p class="city__nb">אותו שליח מטפל במסירות גם ב${nb.map(n => esc(n.name)).join('، ')} — כל היישובים האלה בטווח של ${Math.max(...nb.map(n => n.km))} ק״מ מ${esc(city.name)}, כך שאפשר לשלב כמה מסירות באותה יציאה.</p>
    </section>` : ''}

    <section class="city__block">
      <h2>למה אין כאן מחיר</h2>
      <p class="city__nb">
        מסירה משפטית לא מתומחרת לפי טבלה. שתי מסירות באותה כתובת ב${esc(city.name)} יכולות
        להיות שונות לגמרי במחיר — אחת נמסרת בהגעה הראשונה, השנייה דורשת שלוש הגעות בשעות
        ערב ותיעוד מורחב. לכן אנחנו מעדיפים לשמוע את פרטי התיק ולתת מחיר שנעמוד בו,
        במקום להציג מספר שישתנה אחר כך.
      </p>
    </section>

    <section class="city__block">
      <h2>שאלות נפוצות</h2>
      ${faq.map(f => `<details class="fq">
        <summary>${esc(f.q)}</summary>
        <div class="faq__answer"><p>${esc(f.a)}</p></div>
      </details>`).join('\n      ')}
    </section>

    <section class="city__end">
      <h2>יש לכם מסירה ב${esc(city.name)}?</h2>
      <p>שלחו את פרטי המסירה ונחזור אליכם עם הצעת מחיר מסודרת — בדרך כלל תוך חמש דקות.</p>
      <div class="city__cta">
        <a class="btn btn--wa btn--lg" href="${wa}" target="_blank" rel="noopener">
          <svg width="20" height="20" aria-hidden="true"><use href="#i-whatsapp"></use></svg>שלחו פרטים בוואטסאפ</a>
        <a class="btn btn--ghost btn--lg" href="/${slug(city.name)}">משלוחים רגילים ב${esc(city.name)}</a>
      </div>
    </section>

  </div>
</main>` });
}

/* ── service pages ────────────────────────────────────────────────────────
   Twelve pages, each written rather than generated from a noun. A template
   with the trade swapped out is exactly the thin content the competitor is
   full of; what makes a page about print shops worth having is knowing what a
   print shop actually ships and what goes wrong when it arrives late. */
const SERVICES = [
  {
    s: 'מסירה-משפטית', hub: true,
    h1: ['מסירה משפטית', 'בכל הארץ.'],
    kw: 'מסירת כתבי בי־דין',
    desc: 'מסירת כתבי בי־דין ומסמכים משפטיים בפריסה ארצית. עד שלוש הגעות בימים ובשעות שונות, תיעוד כל ניסיון ואישור מסירה חתום. מענה אנושי תוך 5 דקות.',
    lead: 'מסירה משפטית היא לא משלוח. מה שנמסר שם הוא לא החבילה אלא <strong>ההוכחה שהמסירה בוצעה</strong> — ובית המשפט בודק את התיעוד לא פחות מאשר את עצם ההגעה. לכן אנחנו מתעדים כל ניסיון בנפרד, גם כשהנמען לא נמצא.',
    blocks: [
      { h: 'מה שמבדיל מסירה משפטית ממשלוח', p: 'במשלוח רגיל מה שחשוב הוא שהחבילה תגיע. במסירה משפטית חשוב באותה מידה מה קרה בכל ניסיון שלא הצליח: באיזו שעה, באיזה יום, מה נמצא בכתובת. תיעוד חלקי הוא הסיבה הנפוצה ביותר שמסירה נדחית, ובשלב הזה כבר בזבזתם שבועיים.' },
      { h: 'למה אין כאן מחיר', p: 'שתי מסירות באותה כתובת יכולות להיות שונות לחלוטין. אחת נמסרת בהגעה הראשונה בעשר בבוקר; השנייה דורשת שלוש הגעות, אחת מהן בשמונה בערב, והדבקה מתועדת. תמחור לפי טבלה היה אומר שאחד מכם משלם על עבודה שלא נעשתה — לכן אנחנו שומעים את פרטי התיק ונותנים מחיר שנעמוד בו.' },
    ],
    faq: [
      { q: 'כמה הגעות כלולות?', a: 'עד שלוש, בימים ובשעות שונות — כולל שעות ערב. הפיזור הזה מכוון: מסירה שכל שלושת הניסיונות בה נעשו באותה שעה ביום קלה יותר לתקוף.' },
      { q: 'מה קורה אם הנמען מסרב לקבל?', a: 'סירוב הוא בעצמו אירוע שמתועד — מתי, איפה, ומה נאמר. ברוב המקרים סירוב מתועד נחשב מסירה לכל דבר, אבל זו החלטה של עורך הדין שלכם ולא שלנו.' },
      { q: 'מקבלים אישור מסירה?', a: 'כן. טופס מפורט עם חתימה דיגיטלית שמתעד את כל ההגעות, כולל אלה שלא הסתיימו במסירה, מוכן להגשה.' },
    ],
  },
  {
    s: 'משלוחים-דחופים',
    h1: ['משלוחים דחופים', 'יוצאים עכשיו.'],
    kw: 'משלוח דחוף',
    desc: 'משלוח דחוף בישראל — שליח יוצא לאיסוף בסמוך לאישור ההזמנה, נסיעה ישירה בלי תחנות ביניים. מחיר ידוע מראש מ־142 ₪ כולל מע"מ.',
    lead: 'משלוח דחוף אצלנו הוא לא רמת שירות שאפשר לשלם עליה יותר — <strong>זו הדרך שבה כל משלוח מהיום להיום עובד ממילא</strong>. השליח נוסע ישירות מכתובת האיסוף לכתובת המסירה, בלי לאסוף עוד חמש חבילות בדרך.',
    blocks: [
      { h: 'למה זה מהיר יותר מחברת שילוח', p: 'חברת שילוח גדולה אוספת למרכז מיון, ממיינת, ומחלקת למחרת לפי קווים. שלושה שלבים, ולפחות יום. אצלנו יש שלב אחד: מהדלת שלכם לדלת שלהם. בגלל זה מסלול של 90 ק״מ נסגר בשעתיים ולא ביומיים.' },
      { h: 'מה נחשב דחוף', p: 'מסמך שצריך להיות חתום היום, חלק חילוף שעוצר קו ייצור, דגימה שצריכה להגיע למעבדה בזמן, טופס שהמועד להגשתו נגמר בסוף היום. בכל המקרים האלה מה שקובע הוא שעה, לא יום.' },
    ],
    faq: [
      { q: 'תוך כמה זמן שליח יוצא?', a: 'בסמוך לאישור ההזמנה, בהתאם לזמינות באזור. אחרי שאתם מאשרים בוואטסאפ אנחנו מעדכנים אתכם בזמן האיסוף המשוער — ואם אנחנו לא יכולים לעמוד בחלון הזמן שלכם, אומרים את זה מראש ולא אחרי.' },
      { q: 'כמה עולה משלוח דחוף?', a: 'אותו מחיר כמו כל משלוח מהיום להיום — לפי מרחק הנסיעה בפועל, החל מ־142 ₪ כולל מע"מ. אנחנו לא גובים תוספת על דחיפות.' },
    ],
  },
  {
    s: 'שליח-עד-הבית',
    h1: ['שליח עד הבית', 'בלי לצאת מהדלת.'],
    kw: 'שליח עד הבית',
    desc: 'שליח שאוסף מהבית ומוסר עד הדלת, בכל הארץ. מתאים למסמכים, חבילות אישיות ומשלוחים בין בני משפחה. מחיר מראש מ־142 ₪ כולל מע"מ.',
    lead: 'לא כל משלוח הוא עסקי. הרבה מהנסיעות שלנו הן חבילה שנשארה אצל ההורים, מסמך שצריך להגיע לאח בצפון, או מפתח שמישהו שכח. <strong>אותו שירות בדיוק, בלי מינימום הזמנות ובלי חשבונית חודשית.</strong>',
    blocks: [
      { h: 'איך זה עובד', p: 'אתם אומרים לנו מאיפה ולאן, אנחנו נותנים מחיר לפני שאתם מתחייבים, ואם זה מתאים — שליח יוצא. אין צורך בחשבון, בהרשמה או בפרטי אשראי מראש.' },
      { h: 'מה כדאי לדעת מראש', p: 'אם אין מי שיקבל בכתובת, עדיף לומר את זה מראש ולא לגלות בשטח: אפשר לתאם השארה עם שכן, המתנה קצרה, או מועד אחר. נסיעה חוזרת עולה כסף, ואנחנו מעדיפים לחסוך לכם אותה.' },
    ],
    faq: [
      { q: 'צריך להיות בבית בזמן האיסוף?', a: 'עדיף, אבל לא חובה. אפשר לתאם השארה עם שכן או במקום מוסכם — רק תגידו לנו מראש כדי שהשליח יידע.' },
      { q: 'אפשר לשלוח משהו שביר?', a: 'כן. סמנו את התיבה במחשבון ונשלח שליח עם רכב וטיפול מוגן. אין על זה תוספת מחיר.' },
    ],
  },
  {
    s: 'משלוחים-לעסקים',
    h1: ['שליחויות לעסקים', 'עם חשבונית אחת.'],
    kw: 'שליחויות לעסקים',
    desc: 'שירות שליחויות לעסקים: איסוף קבוע מהחנות, המשרד או המחסן, מחיר סגור מראש לכל מסלול וחשבונית מרוכזת בסוף החודש.',
    lead: 'עסק ששולח כמה משלוחים בשבוע לא צריך לקבל הצעת מחיר בכל פעם מחדש. <strong>אנחנו סוגרים מחיר לכל מסלול, ואתם מזמינים בהודעה אחת.</strong> חשבונית אחת מרוכזת בסוף החודש במקום עשרים קבלות.',
    blocks: [
      { h: 'איסוף קבוע', p: 'אם יש לכם שעה קבועה שבה החבילות מוכנות — נגיע בה. השליח לומד את הכתובת, את מי לחפש ואיפה החבילות מחכות, וזה חוסך את חמש הדקות של הסבר בכל פעם.' },
      { h: 'אותו איש קשר', p: 'לא מוקד. אותו מספר טלפון שדיברתם איתו בפעם הראשונה הוא זה שיענה גם בפעם העשרים, וגם כשמשהו משתבש. זה נשמע קטן עד שמשלוח נתקע.' },
      { h: 'מחיר שלא זז', p: 'אחרי שסגרנו מחיר למסלול, הוא לא משתנה בגלל שהיום עמוס. אתם יכולים לתמחר את המשלוח ללקוח שלכם בלי לחשוש שתפסידו עליו.' },
    ],
    faq: [
      { q: 'יש מינימום משלוחים?', a: 'לא. גם עסק ששולח שלוש פעמים בחודש מקבל את אותו מחיר ואותו שירות.' },
      { q: 'איך מתבצע התשלום?', a: 'חשבונית מרוכזת בסוף החודש עם פירוט כל המשלוחים — תאריך, מסלול וסכום — כך שאפשר להצליב מול הרישומים שלכם.' },
    ],
  },
  {
    s: 'משלוחים-לעורכי-דין',
    h1: ['שליחויות', 'לעורכי דין.'],
    kw: 'שליח לעורכי דין',
    desc: 'שירות שליחויות למשרדי עורכי דין: מסירת כתבי בי־דין, הגשות לבית משפט, העברת מסמכים בין משרדים וללקוחות. תיעוד מלא ואישור מסירה.',
    lead: 'משרד עורכי דין שולח שני סוגי דברים: מסמכים שצריכים להגיע, ומסמכים שצריכים <strong>להוכיח</strong> שהגיעו. אנחנו מטפלים בשניהם, ויודעים מתי מדובר בשני.',
    blocks: [
      { h: 'מסירת כתבי בי־דין', p: 'עד שלוש הגעות בימים ובשעות שונות, תיעוד נפרד של כל ניסיון, הדבקה מתועדת אם לא ניתן למסור, ואישור מסירה חתום בסיום. מתומחר לגופו של תיק.' },
      { h: 'הגשות ומסמכים דחופים', p: 'כשמועד ההגשה נגמר היום, נסיעה ישירה בלי תחנות ביניים היא ההבדל בין להגיש לבין לבקש הארכה. הזמן המשוער נמסר לכם מראש, לא אחרי.' },
      { h: 'חומר רגיש', p: 'תיקים, מקור של חוזה, מסמכי זיהוי — לא עוברים דרך מרכז מיון ולא יושבים במחסן. אותו שליח מרגע האיסוף ועד המסירה.' },
    ],
    faq: [
      { q: 'אתם מבצעים מסירות בכל הארץ?', a: 'כן, ולערים המרכזיות יש דף ייעודי עם פרטי השירות. מסירות מחוץ לאזורי הליבה מתואמות מראש.' },
      { q: 'אפשר הסדר חודשי למשרד?', a: 'כן — מחיר סגור לכל סוג מסירה וחשבונית מרוכזת בסוף החודש, במקום הצעה נפרדת לכל תיק.' },
    ],
  },
  {
    s: 'משלוחים-לבתי-דפוס',
    h1: ['שליחויות', 'לבתי דפוס.'],
    kw: 'משלוחים לבתי דפוס',
    desc: 'שירות שליחויות לבתי דפוס: איסוף פרוּפים לאישור, מסירת עבודות מודפסות ללקוח והעברת חומרים בין בית הדפוס למגמרה.',
    lead: 'בבית דפוס כמעט כל נסיעה היא נסיעה שממתינים לה. <strong>פרוּף שלא חוזר חתום עוצר את המכונה</strong>, ועבודה שלא מגיעה ללקוח בזמן הופכת אירוע שלם לבעיה.',
    blocks: [
      { h: 'פרוּפים הלוך ושוב', p: 'איסוף הפרוּף ללקוח, המתנה קצרה לאישור אם צריך, וחזרה עם החתימה. במקום שני משלוחים נפרדים ביומיים — יציאה אחת.' },
      { h: 'עבודות גמורות', p: 'קרטונים של הזמנות מודפסות מגיעים ללקוח הסופי ישירות מבית הדפוס. גודל גדול במחשבון מכסה את רוב ההזמנות; לכמויות חריגות דברו איתנו מראש.' },
      { h: 'מועדים שלא זזים', p: 'הזמנה לאירוע לא יכולה להגיע יום אחרי. כשיש תאריך אמיתי — תגידו לנו אותו, ואם אנחנו לא יכולים לעמוד בו נאמר את זה לפני שתתחייבו ללקוח שלכם.' },
    ],
    faq: [
      { q: 'אתם אוספים ישירות מהמגמרה?', a: 'כן. איסוף ומסירה בין בית הדפוס, המגמרה והלקוח — כולל שלוש נקודות באותה יציאה כשהמסלול מאפשר.' },
      { q: 'מה עם הזמנות כבדות?', a: 'עד גודל גדול במחשבון מטופל ברכב רגיל. לכמויות שדורשות רכב מסחרי — שלחו לנו את הפרטים ונחזור עם מחיר.' },
    ],
  },
  {
    s: 'משלוחים-למרפאות',
    h1: ['שליחויות', 'למרפאות וקליניקות.'],
    kw: 'משלוחים למרפאות',
    desc: 'שירות שליחויות למרפאות וקליניקות: העברת דגימות למעבדה, ציוד רפואי, מסמכי מטופלים ותיאומים בין סניפים.',
    lead: 'במרפאה יש דברים שאי אפשר לשלוח שוב מחר. <strong>דגימה שלא הגיעה למעבדה בזמן היא בדיקה שצריך לחזור עליה</strong>, והמטופל הוא זה שמשלם על זה בזמן.',
    blocks: [
      { h: 'דגימות למעבדה', p: 'נסיעה ישירה בלי תחנות ביניים, עם זמן הגעה ידוע מראש. כשיש חלון זמן שהמעבדה עומדת בו — תגידו לנו אותו כשאתם מזמינים ולא אחרי שהשליח יצא.' },
      { h: 'מסמכים ותיקי מטופלים', p: 'חומר רפואי לא עובר דרך מרכז מיון ולא נשאר במחסן. אותו שליח מרגע האיסוף ועד המסירה, ואישור על המסירה עצמה.' },
      { h: 'ציוד בין סניפים', p: 'מכשור שצריך לעבור בין קליניקות באותו יום. סמנו במחשבון תכולה שברירית ונשלח רכב וטיפול מוגן, בלי תוספת מחיר.' },
    ],
    faq: [
      { q: 'יש טיפול מיוחד בדגימות?', a: 'אנחנו מעבירים דגימות באריזה שאתם מספקים ובנסיעה ישירה. אם נדרש קירור — אמרו לנו מראש כדי שנבדוק שאנחנו הכתובת הנכונה, ואם לא, נגיד את זה.' },
      { q: 'אפשר איסוף קבוע בשעה קבועה?', a: 'כן. הרבה מרפאות עובדות איתנו בשעה קבועה בסוף היום, וזה גם המחיר הזול ביותר כי המסלול ידוע מראש.' },
    ],
  },
  {
    s: 'משלוחים-לחנויות',
    h1: ['שליחויות', 'לחנויות וקמעונאות.'],
    kw: 'משלוחים לחנויות',
    desc: 'שירות שליחויות לחנויות: משלוח הזמנות ללקוח הסופי באותו יום, העברת מלאי בין סניפים ואיסוף החזרות.',
    lead: 'לקוח שקנה בחנות ורוצה שזה יגיע היום לא ישווה אתכם לחנות ברחוב — הוא ישווה אתכם לאתר שמבטיח משלוח מהיר. <strong>משלוח באותו יום הוא מה שסוגר את הפער הזה.</strong>',
    blocks: [
      { h: 'הזמנות ללקוח הסופי', p: 'איסוף מהחנות ומסירה ללקוח באותו יום עסקים, עם מחיר שאתם יודעים מראש ויכולים לגלגל או לספוג — בלי הפתעות אחרי המשלוח.' },
      { h: 'מלאי בין סניפים', p: 'פריט שנגמר בסניף אחד ויש בשני לא צריך לחכות לספק. העברה ישירה באותו יום, לרוב בפחות מהמחיר של מכירה שלא נסגרה.' },
      { h: 'איסוף החזרות', p: 'החזרה שנאספת מהלקוח במקום שהוא יגיע לחנות היא לקוח שנשאר. אותו מסלול, כיוון הפוך.' },
    ],
    faq: [
      { q: 'אפשר לגבות את דמי המשלוח מהלקוח?', a: 'זה עניין שלכם מולו — אנחנו נותנים לכם מחיר קבוע וידוע לכל מסלול, כך שתוכלו לתמחר אותו ללקוח בלי לנחש.' },
      { q: 'מה עם כמה משלוחים באותו יום?', a: 'אפשר. כשכמה כתובות נמצאות באותו אזור נסגור מחיר ליציאה ולא לכל משלוח בנפרד.' },
    ],
  },
  {
    s: 'משלוחים-לרואי-חשבון',
    h1: ['שליחויות', 'לרואי חשבון.'],
    kw: 'שליח לרואי חשבון',
    desc: 'שירות שליחויות למשרדי רואי חשבון והנהלת חשבונות: איסוף חומר מלקוחות, הגשות לרשויות והעברת מסמכים חתומים.',
    lead: 'משרד רואי חשבון מנהל חודש שנגמר בתאריך קבוע, וכל שנה אותם שבועיים לחוצים. <strong>החומר שלא הגיע מהלקוח בזמן הוא הצוואר של כל התהליך.</strong>',
    blocks: [
      { h: 'איסוף חומר מלקוחות', p: 'במקום להתקשר ללקוח שלוש פעמים ולבקש שיביא — שליח אוסף ממנו ישירות. במיוחד לפני מועדי הדיווח, כשכמה לקוחות מתעכבים באותו שבוע.' },
      { h: 'הגשות ומסמכים חתומים', p: 'מסמכים שדורשים חתימה מקורית, הגשות פיזיות לרשויות, ותיקים שצריך להעביר בין משרדים. נסיעה ישירה עם אישור מסירה.' },
      { h: 'שבועות עומס', p: 'בסוף חודש ולקראת מועדי דיווח אפשר לסגור מראש מחיר וכמות, כך שלא תחפשו שליח ביום שבו כולם מחפשים.' },
    ],
    faq: [
      { q: 'אפשר איסוף מכמה לקוחות באותה יציאה?', a: 'כן, כשהכתובות באותו אזור. זה גם זול יותר מכמה משלוחים נפרדים — שלחו לנו את הרשימה ונחזור עם מחיר ליציאה.' },
      { q: 'החומר מגיע חתום ומאובטח?', a: 'החומר לא עובר דרך מרכז מיון. אותו שליח מרגע האיסוף ועד המסירה, ואישור מסירה בסיום.' },
    ],
  },
];

let LEGAL_BUILT = [];

function renderService(sv, ver) {
  const url = SITE + '/' + sv.s;
  const wa = `https://wa.me/${WA}?text=` + encodeURIComponent(`היי, אשמח לפרטים על ${sv.h1[0].trim()}`);

  const title = `${sv.h1.join(' ').replace(/\.$/, '')} | רוקט משלוחים`;

  const hubList = sv.hub
    ? `<section class="city__block">
      <h2>מסירה משפטית לפי עיר</h2>
      <p class="city__sub">לכל אחת מהערים האלה יש דף עם פרטי השירות באזור.</p>
      <div class="areas__list" style="margin-block-start:.6rem">
${LEGAL_BUILT.map(n => `        <div><a href="/${legalSlug(n)}">מסירה משפטית ב${esc(n)}</a></div>`).join('\n')}
      </div>
    </section>`
    : '';

  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'Service', '@id': url + '#service', name: sv.h1.join(' ').replace(/\.$/, ''),
        serviceType: sv.kw, provider: { '@id': SITE + '/#business' },
        areaServed: { '@type': 'Country', name: 'IL' }, url, description: sv.desc },
      { '@type': 'FAQPage', '@id': url + '#faq',
        mainEntity: sv.faq.map(f => ({ '@type': 'Question', name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'ראשי', item: SITE + '/' },
        { '@type': 'ListItem', position: 2, name: sv.h1.join(' ').replace(/\.$/, ''), item: url } ] },
    ],
  };

  return shell({ title, desc: sv.desc, url, ver, schema, body: `
<main class="city">
  <div class="container">

    <nav class="crumbs" aria-label="מיקום בתוך האתר">
      <a href="/">ראשי</a><span aria-hidden="true">›</span>
      <span aria-current="page">${esc(sv.h1.join(' ').replace(/\.$/, ''))}</span>
    </nav>

    <h1 class="city__h1">${esc(sv.h1[0])}<br><em>${esc(sv.h1[1])}</em></h1>

    <p class="city__lead">${sv.lead}</p>

    <div class="city__cta">
      <a class="btn btn--primary btn--lg" href="/#calculator">חשבו מחיר משלוח</a>
      <a class="btn btn--wa btn--lg" href="${wa}" target="_blank" rel="noopener">
        <svg width="20" height="20" aria-hidden="true"><use href="#i-whatsapp"></use></svg>דברו איתנו בוואטסאפ</a>
    </div>

${sv.blocks.map(b => `    <section class="city__block">
      <h2>${esc(b.h)}</h2>
      <p class="city__nb">${esc(b.p)}</p>
    </section>`).join('\n')}

${hubList}

    <section class="city__block">
      <h2>שאלות נפוצות</h2>
      ${sv.faq.map(f => `<details class="fq">
        <summary>${esc(f.q)}</summary>
        <div class="faq__answer"><p>${esc(f.a)}</p></div>
      </details>`).join('\n      ')}
    </section>

    <section class="city__end">
      <h2>נתחיל?</h2>
      <p>מחשבון המחיר ייתן לכם הערכה תוך פחות מדקה, בלי להשאיר פרטים ובלי התחייבות.</p>
      <div class="city__cta">
        <a class="btn btn--primary btn--lg" href="/#calculator">למחשבון המחיר</a>
        <a class="btn btn--ghost btn--lg" href="/אזורי-שירות">אזורי השירות שלנו</a>
      </div>
    </section>

  </div>
</main>` });
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

BUILT = new Set(targets);

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
const legalTargets = LEGAL_CITIES.filter(n => byName[n] && BUILT.has(n));
for (const name of legalTargets) {
  const dir = path.join(ROOT, legalSlug(name));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), renderLegal(byName[name], ver));
}
LEGAL_BUILT = legalTargets;
console.log(`נכתבו ${legalTargets.length} דפי מסירה משפטית.`);

for (const sv of SERVICES) {
  const dir = path.join(ROOT, sv.s);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), renderService(sv, ver));
}
console.log(`נכתבו ${SERVICES.length} דפי שירות.`);

/* the home page gets the same menu, injected between markers so the city list
   lives in exactly one place and cannot drift between the two templates */
{
  const idx = path.join(ROOT, 'index.html');
  let html = fs.readFileSync(idx, 'utf8');
  const nl = html.includes('\r\n') ? '\r\n' : '\n';
  const put = (start, end, content) => {
    const re = new RegExp(start.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
                          '[\\s\\S]*?' + end.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    if (!re.test(html)) { console.error('סימון חסר ב-index.html: ' + start); process.exit(1); }
    html = html.replace(re, start + content.split('\n').join(nl) + end);
  };
  put('<!-- MEGA:START -->', '<!-- MEGA:END -->', megaMenu(BUILT));
  put('<!-- SVC:START -->', '<!-- SVC:END -->', servicesMenu());

  const mobile = `<details class="mega mega--mobile">
        <summary>אזורי שירות</summary>
        <div class="mega__panel">
          <div class="mega__grid">
${['dan', 'sharon', 'shfela', 'jerusalem', 'south', 'north'].map(k => {
    const list = MENU_CITIES[k].filter(c => BUILT.has(c));
    return !list.length ? '' : `            <div class="mega__col">
              <p class="mega__region">${esc(REGIONS[k].label)}</p>
              <ul>
${list.map(c => `                <li><a href="/${slug(c)}">${esc(c)}</a></li>`).join('\n')}
              </ul>
            </div>`;
  }).filter(Boolean).join('\n')}
          </div>
          <a class="mega__all" href="/אזורי-שירות">כל ${BUILT.size} אזורי השירות ←</a>
        </div>
      </details>`;
  put('<!-- MEGAM:START -->', '<!-- MEGAM:END -->', mobile);

  fs.writeFileSync(idx, html);
  console.log('התפריט הוזרק לדף הבית.');
}

const hubDir = path.join(ROOT, 'אזורי-שירות');
fs.mkdirSync(hubDir, { recursive: true });
fs.writeFileSync(path.join(hubDir, 'index.html'), renderHub());
console.log('דף אזורי השירות נכתב.');

const today = new Date().toISOString().slice(0, 10);
const entries = [
  { loc: SITE + '/', pri: '1.0', freq: 'weekly' },
  { loc: SITE + '/אזורי-שירות', pri: '0.9', freq: 'monthly' },
  ...SERVICES.map(sv => ({ loc: SITE + '/' + sv.s, pri: '0.9', freq: 'monthly' })),
  ...legalTargets.map(n => ({ loc: SITE + '/' + legalSlug(n), pri: '0.9', freq: 'monthly' })),
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
