/* /business — the landing page for business accounts (חשבון עסקי).
 *
 * WHO IT IS FOR
 * -------------
 * A business that already sends, or is about to send, more than the odd
 * parcel: an office, a clinic, a nursery, a shop. The deal Or offers them is
 * an OPEN ACCOUNT — each delivery at its own price, ordered in WhatsApp as
 * usual, and one payment at the end of the month against an itemised list.
 *
 * WHY IT IS NOT /משלוחים-לעסקים
 * -----------------------------
 * That page is organic: someone searching "שליחויות לעסקים" to find a courier
 * at all. This one sells the account itself, is the target of the menu link
 * and of any business campaign, and is where the client login will live once
 * the accounts app ships. No prose is shared between the two — measured with
 * node tools/dupcheck.mjs, which carries the pair as a standing check.
 *
 * NOTHING HERE IS NEW. Every claim — no minimum, fixed price per route, one
 * consolidated payment with a line per delivery, our own couriers, the same
 * contact — is something this site already says on /משלוחים-לעסקים or the
 * home page. The sample statement uses prices from his own rate card
 * (ROUTE_PRICES in app.js) and is labelled as a sample on screen.
 *
 * Same engine as /legal: no GSAP, a CSS-only loop on the sample sheet, and a
 * 15-line IntersectionObserver for reveals.
 */

/* Icons this page needs beyond the shell's three. */
export const BUSINESS_ICONS = `<symbol id="i-star" viewBox="0 0 24 24"><path fill="currentColor" d="m12 2.6 2.94 5.96 6.58.96-4.76 4.64 1.12 6.55L12 17.62l-5.88 3.09 1.12-6.55L2.48 9.52l6.58-.96L12 2.6Z"/></symbol>
  <symbol id="i-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5m0 0 5.5-5.5M5 12l5.5 5.5"/></symbol>
  <symbol id="i-clock" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9.2"/><path d="M12 6.8V12l3.4 2"/></symbol>
  <symbol id="i-shield" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.6 4.4 5.6v6c0 5 3.2 8.3 7.6 9.8 4.4-1.5 7.6-4.8 7.6-9.8v-6L12 2.6Z"/><path d="m8.8 11.8 2.3 2.3 4.1-4.3"/></symbol>
  <symbol id="i-clipboard" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="4.6" y="4.2" width="14.8" height="17" rx="2.4"/><path d="M9 4.2V3.4A1.4 1.4 0 0 1 10.4 2h3.2A1.4 1.4 0 0 1 15 3.4v.8"/><path d="M8.6 10.6h6.8M8.6 14.6h4.4"/></symbol>
  <symbol id="i-wallet" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5.4" width="18" height="14" rx="2.6"/><path d="M3 9.6h18"/><path d="M15.4 14.6h2.4"/></symbol>`;

/* ── copy ────────────────────────────────────────────────────────────────── */

const WHY = [
  ['i-wallet', 'לא משלמים בכל משלוח',
   'השליח לא מחכה בדלת להעברה, ואף אחד במשרד לא צריך לרדוף אחרי כרטיס אשראי באמצע היום. המשלוח יוצא, נרשם בחשבון, וזהו.'],
  ['i-clipboard', 'שורה לכל משלוח',
   'בסוף החודש מגיע פירוט: תאריך, מאיפה, לאן וכמה. הנהלת החשבונות מצליבה אותו מול הרישומים שלכם בדקות, ולא משחזרת חודש שלם מתוך שיחות.'],
  ['i-clock', 'מחיר סגור למסלול שחוזר',
   'מסלול שאתם שולחים בו שוב ושוב מקבל מחיר קבוע, והוא לא קופץ ביום עמוס. ככה אפשר לגלגל את עלות המשלוח ללקוח שלכם בלי הפתעות.'],
  ['i-shield', 'השליחים שלנו, ואיש קשר אחד',
   'המשלוח לא מועבר לקבלן משנה. מי שעונה לכם בוואטסאפ בפעם הראשונה הוא מי שעונה גם בפעם המאה, ומכיר כבר את הכתובות ואת השעות שלכם.'],
];

const STEPS = [
  ['פותחים חשבון',
   'שולחים בוואטסאפ את שם העסק, איש קשר ובערך כמה משלוחים יוצאים בחודש. מקבלים מספר לקוח, ומכאן כל משלוח שלכם נרשם עליו.'],
  ['מזמינים כמו תמיד',
   'הודעה בוואטסאפ עם כתובת איסוף וכתובת מסירה, והשליח יוצא. בלי לשלם במקום ובלי טפסים.'],
  ['משלמים פעם בחודש',
   'בסוף החודש מקבלים את רשימת כל המשלוחים, עם תאריך, מסלול וסכום לכל אחד, ומסדירים תשלום אחד.'],
];

/* Sector pages that already exist on the site, so every chip goes somewhere. */
const SECTORS = [
  ['משלוחים-למרפאות', 'מרפאות ומעבדות'],
  ['משלוחים-לחנויות', 'חנויות'],
  ['משלוחים-לעסקי-מזון', 'עסקי מזון'],
  ['משלוחים-לבתי-דפוס', 'בתי דפוס'],
  ['משלוחים-לרואי-חשבון', 'רואי חשבון'],
  ['legal', 'משרדי עורכי דין'],
];

const FAQ = [
  ['מי יכול לפתוח חשבון עסקי?',
   'כל עסק ששולח באופן קבוע: משרד, מרפאה, מעון, חנות או מחסן. אין מינימום משלוחים בחודש — גם עסק ששולח כמה פעמים בחודש מקבל חשבון.'],
  ['איך מזמינים משלוח על החשבון?',
   'בדיוק כמו היום: הודעה בוואטסאפ עם כתובת איסוף, כתובת מסירה ומה שולחים. אומרים שזה לחשבון, והמשלוח נרשם אצלכם ולא נגבה במקום.'],
  ['מה מופיע בפירוט החודשי?',
   'כל משלוח בשורה משלו: התאריך, מאיפה נאסף, לאן נמסר והמחיר שלו, ובסוף הסכום הכולל לחודש. מקבלים גם חשבונית מרוכזת אחת.'],
  ['חשבון עסקי משנה את השירות?',
   'לא. אותם שליחים ואותן אפשרויות: משלוח מהיום להיום, מהיום למחר, ומסירה משפטית. מה שמשתנה הוא רק איך ומתי משלמים.'],
];

/* The sample statement. Prices are his real figures from ROUTE_PRICES; the
   business is generic and the whole card is captioned as a sample. The three
   last rows reuse /legal's tries animation, so a row "arrives" the way a
   delivery is added to the account. */
const SAMPLE = {
  account: '1042',
  biz: 'עסק לדוגמה · נתניה',
  month: 'נובמבר',
  earlier: [
    ['03.11', 'נתניה ← בנימינה', 150],
    ['06.11', 'נתניה ← תל אביב', 180],
    ['11.11', 'נתניה ← בנימינה', 150],
  ],
  live: [
    ['17.11', 'נתניה ← חדרה', 200],
    ['19.11', 'נתניה ← תל אביב', 180],
    ['24.11', 'נתניה ← בנימינה', 150],
  ],
};

const nis = n => n.toLocaleString('he-IL') + ' ₪';

/* ── render ──────────────────────────────────────────────────────────────── */

export default function renderBusinessLanding(ctx) {
  const { shell, esc, SITE, WA, TEL, ver, sections } = ctx;
  const url = SITE + '/business';

  const waText = 'היי, אני רוצה לפתוח חשבון עסקי ברוקט.\n\nשם העסק:\nאיש קשר:\nכמה משלוחים בחודש בערך:\nמאיפה שולחים בדרך כלל:\n';
  const wa = `https://wa.me/${WA}?text=` + encodeURIComponent(waText);

  const title = 'חשבון עסקי למשלוחים — תשלום אחד בסוף החודש | רוקט משלוחים';
  const desc = 'חשבון עסקי ברוקט משלוחים: מזמינים בוואטסאפ, כל משלוח נרשם בחשבון, ומשלמים פעם אחת בסוף החודש עם פירוט מלא של כל משלוח. בלי מינימום משלוחים.';

  const rows = [...SAMPLE.earlier, ...SAMPLE.live];
  const total = rows.reduce((s, r) => s + r[2], 0);

  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'Service', '@id': url + '#service',
        name: 'חשבון עסקי למשלוחים', serviceType: 'שליחויות לעסקים בחשבון חודשי',
        provider: { '@id': SITE + '/#business' },
        areaServed: { '@type': 'Country', name: 'IL' },
        audience: { '@type': 'BusinessAudience', audienceType: 'עסקים' },
        url, description: desc },
      { '@type': 'FAQPage', '@id': url + '#faq',
        mainEntity: FAQ.map(([q, a]) => ({ '@type': 'Question', name: q,
          acceptedAnswer: { '@type': 'Answer', text: a } })) },
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'ראשי', item: SITE + '/' },
        { '@type': 'ListItem', position: 2, name: 'חשבון עסקי', item: url } ] },
    ],
  };

  /* Row numbers run 1..6 across both groups; only the last three animate. */
  const row = ([d, route, price], n, anim) => `            <li${anim ? ` class="lp-doc__try-${anim}"` : ''}>
              <span class="lp-doc__n" aria-hidden="true">${n}</span>
              <span class="lp-doc__when"><b>${d}</b></span>
              <span class="lp-doc__what bz-row"><span>${esc(route)}</span><b class="bz-amt">${nis(price)}</b></span>
            </li>`;

  const card = `      <figure class="lp-doc bz-doc" aria-labelledby="bz-doc-cap">
        <div class="lp-doc__toast" aria-hidden="true">
          <span class="lp-doc__toast-ic"><svg width="18" height="18"><use href="#i-whatsapp"></use></svg></span>
          <span class="lp-doc__toast-t"><b>המשלוח נמסר · 14:05</b><span>נתניה ← בנימינה. נרשם בחשבון החודשי.</span></span>
        </div>
        <div class="lp-doc__sheet">
          <span class="lp-doc__progress" aria-hidden="true"></span>
          <div class="lp-doc__top">
            <span class="lp-doc__brand"><svg width="22" height="22" aria-hidden="true"><use href="#i-rocket"></use></svg><span>ROCKET<small>חשבון עסקי</small></span></span>
            <span class="lp-doc__status" aria-hidden="true"><span class="lp-doc__st lp-doc__st--wait">מתעדכן</span><span class="lp-doc__st lp-doc__st--done">מעודכן</span></span>
          </div>

          <dl class="lp-doc__meta">
            <div><dt>מספר לקוח</dt><dd>${SAMPLE.account}</dd></div>
            <div><dt>עסק</dt><dd>${esc(SAMPLE.biz)}</dd></div>
            <div><dt>חודש</dt><dd>${SAMPLE.month}</dd></div>
          </dl>

          <p class="lp-doc__label">המשלוחים החודש</p>
          <ol class="lp-doc__tries bz-rows">
${SAMPLE.earlier.map((r, i) => row(r, i + 1, 0)).join('\n')}
${SAMPLE.live.map((r, i) => row(r, SAMPLE.earlier.length + i + 1, i + 1)).join('\n')}
          </ol>

          <div class="lp-doc__sign bz-total">
            <span>סה״כ ${SAMPLE.month} · ${rows.length} משלוחים</span>
            <b>${nis(total)} <small>+ מע״מ</small></b>
          </div>

          <span class="lp-doc__stamp" aria-hidden="true"><b>תשלום</b><span>אחד בחודש</span></span>
        </div>
        <figcaption class="lp-doc__cap" id="bz-doc-cap">דוגמה לפירוט חודשי. העסק מודגם, המחירים מתוך המחירון.</figcaption>
      </figure>`;

  return shell({ title, desc, url, ver, schema, icons: BUSINESS_ICONS, bodyClass: 'hdr-dark',
    headerCta: { href: wa, label: 'פתיחת חשבון עסקי', wa: true },
    body: `
<main class="lp bz" id="main">

  <!-- ===================== HERO — the statement, not the van ============ -->
  <section class="lp-hero" aria-labelledby="bz-title">
    <div class="container container--wide lp-hero__grid">

      <div class="lp-hero__copy">
        <p class="lp-eyebrow"><span><span class="lp-eyebrow__lead">חשבון עסקי<b aria-hidden="true"> · </b></span>לעסקים ששולחים באופן קבוע</span></p>

        <h1 class="lp-h1" id="bz-title">
          <span>כל המשלוחים של העסק</span>
          <span>בחשבון <em>אחד</em>.</span>
        </h1>

        <p class="lp-hero__sub">מזמינים בוואטסאפ כמו תמיד, כל משלוח נרשם בחשבון שלכם, ומשלמים פעם אחת בסוף החודש — עם פירוט מלא.</p>

        <div class="lp-hero__cta">
          <a class="btn btn--primary btn--lg" href="${wa}" target="_blank" rel="noopener">
            <svg width="20" height="20" aria-hidden="true"><use href="#i-whatsapp"></use></svg>פתיחת חשבון עסקי</a>
          <a class="btn btn--ghost-light btn--lg" href="tel:+${WA}">
            <svg width="19" height="19" aria-hidden="true"><use href="#i-phone"></use></svg><span class="nowrap">${TEL}</span></a>
        </div>

        <dl class="lp-spec">
          <div><dt>1</dt><dd>תשלום בחודש, במקום תשלום על כל משלוח</dd></div>
          <div><dt>0</dt><dd>מינימום משלוחים לפתיחת חשבון</dd></div>
          <div><dt><svg width="30" height="30" aria-hidden="true"><use href="#i-clipboard"></use></svg></dt><dd>שורה לכל משלוח: תאריך, מסלול וסכום</dd></div>
        </dl>
      </div>

${card}

    </div>
  </section>

  <!-- ===================== HOW — navy marks the thing itself ============ -->
  <section class="lp-sec lp-sec--navy" aria-labelledby="bz-how">
    <div class="container container--wide">
      <h2 class="lp-h2 lp-h2--light" id="bz-how">
        <span>ככה עובד</span>
        <span>חשבון <em>עסקי</em>.</span>
      </h2>

      <ol class="lp-steps">
${STEPS.map(([h, p], i) => `        <li class="rv-up">
          <span class="lp-steps__n" aria-hidden="true">${i + 1}</span>
          <h3>${esc(h)}</h3>
          <p>${esc(p)}</p>
        </li>`).join('\n')}
      </ol>
    </div>
  </section>

  <!-- ===================== WHY ========================================== -->
  <section class="lp-sec" aria-labelledby="bz-why">
    <div class="container container--wide">
      <h2 class="lp-h2" id="bz-why">
        <span>מה העסק שלכם</span>
        <span>מרוויח <em>מזה</em>.</span>
      </h2>

      <div class="lp-why">
${WHY.map(([ic, h, p]) => `        <article class="lp-card rv-up">
          <span class="lp-card__ic" aria-hidden="true"><svg width="22" height="22"><use href="#${ic}"></use></svg></span>
          <h3>${esc(h)}</h3>
          <p>${esc(p)}</p>
        </article>`).join('\n')}
      </div>

      <div class="bz-sectors rv-up">
        <p>חשבון עסקי מתאים ל־</p>
        <ul>
${SECTORS.map(([s, n]) => `          <li><a href="/${s}">${esc(n)}</a></li>`).join('\n')}
        </ul>
      </div>
    </div>
  </section>

  <!-- ===================== FLEET + REVIEWS (lifted from the home page) == -->
${sections.fleet}

${sections.reviews}

  <!-- ===================== FAQ ========================================== -->
  <section class="lp-sec lp-sec--soft" aria-labelledby="bz-faq">
    <div class="container container--wide">
      <h2 class="lp-h2" id="bz-faq">
        <span>שאלות על</span>
        <span>חשבון <em>עסקי</em>.</span>
      </h2>

      <div class="lp-faq">
${FAQ.map(([q, a]) => `        <details class="fq">
          <summary>${esc(q)}</summary>
          <div class="faq__answer"><p>${esc(a)}</p></div>
        </details>`).join('\n')}
      </div>
      <p class="bz-more">עוד על <a href="/משלוחים-לעסקים">שליחויות לעסקים</a>, ועל <a href="/legal">מסירות משפטיות למשרדי עורכי דין</a>.</p>
    </div>
  </section>

  <!-- ===================== CLOSE ======================================== -->
  <section class="lp-close" aria-labelledby="bz-close-t">
    <div class="container">
      <h2 class="lp-h2 lp-h2--light lp-h2--mid" id="bz-close-t">
        <span>פותחים חשבון היום,</span>
        <span>והמשלוח הבא כבר <em>בחשבון</em>.</span>
      </h2>
      <p class="lp-close__sub">שם העסק, איש קשר ובערך כמה משלוחים בחודש — זה כל מה שצריך כדי לפתוח.</p>
      <div class="lp-close__cta">
        <a class="btn btn--primary btn--lg" href="${wa}" target="_blank" rel="noopener">
          <svg width="20" height="20" aria-hidden="true"><use href="#i-whatsapp"></use></svg>פתיחת חשבון עסקי</a>
        <a class="btn btn--ghost-light btn--lg" href="tel:+${WA}">
          <svg width="19" height="19" aria-hidden="true"><use href="#i-phone"></use></svg>התקשרו: <span class="nowrap">${TEL}</span></a>
      </div>
    </div>
  </section>

</main>

<a class="wa-float" href="${wa}" target="_blank" rel="noopener" aria-label="פתיחת חשבון עסקי בוואטסאפ">
  <svg width="28" height="28" aria-hidden="true"><use href="#i-whatsapp"></use></svg>
</a>

<script src="/assets/js/fleet.js?v=${ver}" defer></script>
<script>
/* Reveals. Fifteen lines instead of a scroll library, because this page is
   paid traffic and every kilobyte is charged twice — once at load and again
   at the bounce. An element with no observer support, or with reduced motion
   asked for, is simply visible: the class is added, never removed.

   The safety net matters more than the effect. Everything below the hero
   starts at opacity 0, so if the callback never arrives the page is blank
   below the fold and the click is paid for twice over. An observer always
   delivers an initial record — so if nothing has arrived after four seconds
   the rendering loop is not running and never will here. That is a real
   failure detector, not a timer racing the animation: when the observer is
   working this branch does nothing, and when it is not, the reader gets the
   page instead of a white screen. */
(function () {
  var els = document.querySelectorAll('.rv-up');
  var showAll = function () {
    for (var k = 0; k < els.length; k++) els[k].classList.add('is-in');
  };
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !('IntersectionObserver' in window)) { showAll(); return; }

  var fired = false;
  var io = new IntersectionObserver(function (rows) {
    fired = true;
    rows.forEach(function (r) {
      if (!r.isIntersecting) return;
      r.target.classList.add('is-in');
      io.unobserve(r.target);
    });
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.15 });
  for (var j = 0; j < els.length; j++) io.observe(els[j]);

  window.setTimeout(function () { if (!fired) showAll(); }, 4000);
})();
</script>
` });
}
