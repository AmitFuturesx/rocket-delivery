/* /legal — the landing page for the legal-service campaign.
 *
 * WHY THIS IS A SEPARATE PAGE FROM /מסירה-משפטית
 * ----------------------------------------------
 * Two pages about process serving sounds like cannibalisation, and would be,
 * if they said the same thing. They do not, because the two readers are not
 * the same person:
 *
 *   /מסירה-משפטית   organic. Someone — often not a lawyer — typing "מסירה
 *                    משפטית" to find out what the service IS. It explains the
 *                    thing, prices nothing, and hubs out to 26 city pages.
 *   /legal           paid. A lawyer who already knows what process serving is,
 *                    clicked an ad, and wants to know whether THIS courier's
 *                    affidavit will survive being filed. It sells, it names
 *                    the deliverable, and it offers firms an arrangement.
 *
 * Nothing is copied between them: the five-step explanation stays on the hub
 * and this page carries a three-step one written for someone who does not need
 * the concept explained. Measured rather than assumed — node tools/dupcheck.mjs
 * scores the two at 0.052 Jaccard on 5-word shingles, against 0.60 for "the
 * same page twice". Re-run it if either page is rewritten.
 *
 * NO CALCULATOR, by the brief. Legal work is quoted per case on this site, so
 * a price box would have to say "we will get back to you" — which is a worse
 * version of the WhatsApp button standing next to it.
 *
 * NO GSAP. This is an ad landing page: load time is both a Quality Score input
 * and a conversion input, and 100KB of scroll library to fade four cards in is
 * the wrong trade. Reveals run off a ~15-line IntersectionObserver, and the
 * hero carries no entrance animation at all — it simply stands still.
 */

/* ── the one claim that needs the client's word before it goes live ────────
 * The brief asks for "תצהיר מסירה חתום". In Israeli practice a תצהיר is sworn
 * before a lawyer or notary, which is a different product from the signed,
 * documented proof-of-service form this site has always promised — and a
 * lawyer who files the wrong one finds out in court. So the page ships with
 * the wording the business already stands behind, and the upgrade is this one
 * constant: when Or confirms he swears an affidavit, change these two strings
 * and nothing else.
 */
const PROOF = 'אישור מסירה חתום ומתועד';
const PROOF_SHORT = 'אישור מסירה חתום';

/* Extra icons this page uses, appended to the shell's three. Kept here rather
   than added to the shared defs so the other 359 pages do not carry them. */
export const LEGAL_ICONS = `<symbol id="i-star" viewBox="0 0 24 24"><path fill="currentColor" d="m12 2.6 2.94 5.96 6.58.96-4.76 4.64 1.12 6.55L12 17.62l-5.88 3.09 1.12-6.55L2.48 9.52l6.58-.96L12 2.6Z"/></symbol>
  <symbol id="i-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5m0 0 5.5-5.5M5 12l5.5 5.5"/></symbol>
  <symbol id="i-pin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21.5s7-5.9 7-11.5a7 7 0 1 0-14 0c0 5.6 7 11.5 7 11.5Z"/><circle cx="12" cy="10" r="2.6"/></symbol>
  <symbol id="i-clock" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9.2"/><path d="M12 6.8V12l3.4 2"/></symbol>
  <symbol id="i-shield" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.6 4.4 5.6v6c0 5 3.2 8.3 7.6 9.8 4.4-1.5 7.6-4.8 7.6-9.8v-6L12 2.6Z"/><path d="m8.8 11.8 2.3 2.3 4.1-4.3"/></symbol>
  <symbol id="i-clipboard" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="4.6" y="4.2" width="14.8" height="17" rx="2.4"/><path d="M9 4.2V3.4A1.4 1.4 0 0 1 10.4 2h3.2A1.4 1.4 0 0 1 15 3.4v.8"/><path d="M8.6 10.6h6.8M8.6 14.6h4.4"/></symbol>`;

/* ── copy ────────────────────────────────────────────────────────────────── */

const WHY = [
  ['i-clipboard', 'מסמך שאפשר להגיש',
   `בסוף כל מסירה מגיע טופס שמפרט כל הגעה בנפרד — תאריך, שעה, כתובת ומה קרה בה — כולל ההגעות שלא הסתיימו במסירה. התיעוד נכתב בזמן אמת בכל הגעה, לא מורכב בדיעבד בסוף התהליך, וזה ההבדל בין מסמך שעומד לבין מסמך שמתערער.`],
  ['i-clock', 'עד שלוש הגעות, במכוון לא באותה שעה',
   `אחת בבוקר, אחת בשעות הערב, ואם צריך אחת בסוף השבוע. מסירה שכל שלושת הניסיונות בה נעשו בעשר בבוקר של יום חמישי קלה לתקוף — הפיזור הזה הוא מה שמחזיק אותה, ולכן הוא מתוכנן ולא מקרי.`],
  ['i-shield', 'אתם יודעים איפה זה עומד בלי להתקשר',
   `עדכון בוואטסאפ אחרי כל הגעה: מה קרה, באיזו שעה, ומה השלב הבא. בלי לגלות בסוף התהליך שהניסיון הראשון נכשל לפני שבוע ואף אחד לא אמר כלום.`],
  ['i-pin', 'שליחים שלנו, ופריסה ארצית',
   `המסירה לא עוברת לקבלן באזור. אותו איש קשר ואותו מספר טלפון מרגע קבלת המסמך ועד האישור — גם כשהכתובת היא בפריפריה ולא בגוש דן.`],
];

const STEPS = [
  ['שולחים את פרטי המסירה',
   `בוואטסאפ: המסמך, שם הנמען, הכתובת, ואם יש מועד שחייב להיעמד — אומרים אותו כאן ולא אחרי שהשליח יצא. חוזרים אליכם עם מחיר, בדרך כלל תוך חמש דקות.`],
  ['יוצאים למסירה',
   `ההגעה הראשונה בדרך כלל תוך יום עסקים אחד. כל הגעה מתועדת בשעתה — גם כשהנמען לא בכתובת — ואתם מקבלים עדכון מיד אחריה, בלי לשאול.`],
  ['מקבלים את האישור',
   `${PROOF_SHORT} בסוף התהליך, עם כל ההגעות ושעותיהן, מוכן לצרף לתיק.`],
];

const FIRM = [
  ['מחיר אחיד לכל מסירה',
   `מוסכם מראש לפי אזורי העבודה שלכם במקום להיות מחושב מחדש בכל תיק. מתמחרים פעם אחת — ומכאן אתם יודעים מה מסירה עולה לפני שאתם שולחים אותה, וזה מספר שאפשר להעמיס על הלקוח.`],
  ['חשבון חודשי אחד',
   `במקום תשלום נפרד לכל מסירה: ריכוז חודשי עם פירוט לפי תיק. הנהלת החשבונות של המשרד מקבלת מסמך אחד בחודש ולא שתים־עשרה קבלות.`],
  ['קו ישיר, בלי מוקד',
   `המסירות של המשרד מגיעות לאותו איש קשר. הוא כבר מכיר את סוג התיקים שאתם שולחים ואת האזורים שבהם אתם עובדים.`],
];

const FAQ = [
  ['כמה הגעות כלולות במסירה?',
   `עד שלוש, בימים ובשעות שונות — כולל שעות ערב. הפיזור מכוון: מסירה שכל הניסיונות בה נעשו באותה שעה ביום קלה יותר לתקוף.`],
  ['מה קורה אם הנמען מסרב לקבל?',
   `סירוב הוא בעצמו אירוע שמתועד — מתי, איפה, ומה נאמר. כשלא ניתן למסור לידיו, מבצעים הדבקה ומתעדים את מקומה ואת שעתה. האם הסירוב נחשב מסירה זו החלטה שלכם ולא שלנו: אנחנו מספקים את התיעוד, לא את הפרשנות המשפטית שלו.`],
  ['מה בדיוק מקבלים בסוף?',
   `טופס ${PROOF} שמפרט כל הגעה בנפרד: תאריך, שעה, כתובת ומה קרה בה — כולל ההגעות שלא הסתיימו במסירה, שהן לרוב מה שבית המשפט בודק קודם.`],
  ['תוך כמה זמן מתבצעת המסירה?',
   `ההגעה הראשונה בדרך כלל תוך יום עסקים אחד מקבלת המסמך, ותיק דחוף יוצא באותו יום. תהליך של שלוש הגעות נפרש על כמה ימים במכוון. בכתובת בפריפריה זה לפעמים יום נוסף — ואנחנו אומרים את זה מראש ולא אחרי.`],
  ['איך מתמחרים מסירה משפטית?',
   `לגופו של תיק. שתי מסירות באותה כתובת יכולות להיות שונות לחלוטין: אחת נסגרת בהגעה הראשונה בעשר בבוקר, השנייה דורשת שלוש הגעות, אחת מהן בשמונה בערב, והדבקה מתועדת. תמחור לפי טבלה היה אומר שאחד מכם משלם על עבודה שלא נעשתה. למשרד ששולח באופן קבוע אנחנו כן קובעים מחיר אחיד מראש.`],
];

/* The sample affidavit in the hero. Rendered in markup rather than as an image
   so it costs nothing to load, stays selectable, and reads at any width.
   Initials and a generic address on purpose, and labelled "דוגמה" in the
   markup AND on screen: this is an illustration of the form, and a page that
   showed what looked like a real person's service record would be a different
   kind of document altogether. */
const SAMPLE = {
  ref: 'RD-2418',
  to: 'י. כ.',
  at: 'רח׳ הרצל, חולון',
  doc: 'כתב תביעה + הזמנה לדין',
  tries: [
    ['1', '18.11', '10:42', 'לא נמצא בכתובת', false],
    ['2', '19.11', '19:05', 'לא נמצא בכתובת', false],
    ['3', '20.11', '08:20', 'נמסר אישית לנמען', true],
  ],
};

/* ── render ──────────────────────────────────────────────────────────────── */

export default function renderLegalLanding(ctx) {
  const { shell, esc, SITE, WA, TEL, legalCities, legalSlug, ver, sections } = ctx;
  const url = SITE + '/legal';

  const waText = 'היי, אני צריך מסירה משפטית.\n\nשם הנמען:\nכתובת:\nסוג המסמך:\n';
  const wa = `https://wa.me/${WA}?text=` + encodeURIComponent(waText);
  const waFirm = `https://wa.me/${WA}?text=` +
    encodeURIComponent('היי, אני ממשרד עורכי דין ורוצה לשמוע על הסדר קבוע למסירות.\n\nשם המשרד:\nכמה מסירות בחודש:\nאזורי עבודה:\n');

  const title = `מסירות משפטיות לעורכי דין — בכל הארץ | רוקט משלוחים`;
  const desc = `מסירת כתבי בי־דין לעורכי דין ומשרדי עורכי דין, בפריסה ארצית. מסירה אישית, עד שלוש הגעות בימים ובשעות שונות, ${PROOF} ועדכון בוואטסאפ בכל שלב. מחיר למשרד — מוסכם מראש.`;

  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'Service',
        '@id': url + '#service',
        name: 'מסירות משפטיות לעורכי דין',
        serviceType: 'מסירת כתבי בי־דין',
        provider: { '@id': SITE + '/#business' },
        areaServed: { '@type': 'Country', name: 'IL' },
        audience: { '@type': 'Audience', audienceType: 'עורכי דין ומשרדי עורכי דין' },
        url, description: desc },
      { '@type': 'FAQPage', '@id': url + '#faq',
        mainEntity: FAQ.map(([q, a]) => ({ '@type': 'Question', name: q,
          acceptedAnswer: { '@type': 'Answer', text: a } })) },
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'ראשי', item: SITE + '/' },
        { '@type': 'ListItem', position: 2, name: 'מסירה משפטית', item: SITE + '/מסירה-משפטית' },
        { '@type': 'ListItem', position: 3, name: 'מסירות משפטיות לעורכי דין', item: url } ] },
    ],
  };

  /* The sample form. The stamp uses PHYSICAL right/top — it is screen-space
     layout art pinned to a corner, not text flow, and inset-inline-end would
     park it on the left of an RTL page. */
  const card = `      <figure class="lp-doc" aria-labelledby="lp-doc-cap">
        <div class="lp-doc__toast" aria-hidden="true">
          <span class="lp-doc__toast-ic"><svg width="18" height="18"><use href="#i-whatsapp"></use></svg></span>
          <span class="lp-doc__toast-t"><b>עדכון נשלח למשרד · 08:21</b><span>המסירה בוצעה. האישור החתום מצורף.</span></span>
        </div>
        <div class="lp-doc__sheet">
          <span class="lp-doc__progress" aria-hidden="true"></span>
          <div class="lp-doc__top">
            <span class="lp-doc__brand"><svg width="22" height="22" aria-hidden="true"><use href="#i-rocket"></use></svg><span>ROCKET<small>אישור מסירה</small></span></span>
            <span class="lp-doc__status" aria-hidden="true"><span class="lp-doc__st lp-doc__st--wait">בטיפול</span><span class="lp-doc__st lp-doc__st--done">נמסר</span></span>
          </div>

          <dl class="lp-doc__meta">
            <div><dt>מספר פנייה</dt><dd>${SAMPLE.ref}</dd></div>
            <div><dt>נמען</dt><dd>${esc(SAMPLE.to)}</dd></div>
            <div><dt>כתובת</dt><dd>${esc(SAMPLE.at)}</dd></div>
            <div><dt>מסמך</dt><dd>${esc(SAMPLE.doc)}</dd></div>
          </dl>

          <p class="lp-doc__label">ניסיונות מסירה</p>
          <ol class="lp-doc__tries">
${SAMPLE.tries.map(([i, d, t, what, ok]) => `            <li class="lp-doc__try-${i}${ok ? ' is-done' : ''}">
              <span class="lp-doc__n" aria-hidden="true">${i}</span>
              <span class="lp-doc__when"><b>${d}</b><span>${t}</span></span>
              <span class="lp-doc__what">${esc(what)}</span>
            </li>`).join('\n')}
          </ol>

          <div class="lp-doc__sign">
            <span>חתימה דיגיטלית</span>
            <svg class="lp-doc__scribble" viewBox="0 0 120 34" aria-hidden="true" focusable="false">
              <path d="M4 24c8-14 13 6 19-4s9 8 15-2 10 7 16-3 11 6 17-4 10 5 15 1"
                    fill="none" stroke="currentColor" stroke-width="2.1"
                    stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>

          <span class="lp-doc__stamp" aria-hidden="true"><b>נמסר</b><span>20.11</span></span>
        </div>
        <figcaption class="lp-doc__cap" id="lp-doc-cap">דוגמה לאישור מסירה. הפרטים מודגמים.</figcaption>
      </figure>`;

  return shell({ title, desc, url, ver, schema, icons: LEGAL_ICONS, bodyClass: 'hdr-dark',
    headerCta: { href: wa, label: 'שלחו פרטי מסירה', wa: true },
    body: `
<main class="lp" id="main">

  <!-- ===================== HERO — the deliverable, not the van ========== -->
  <section class="lp-hero" aria-labelledby="lp-title">
    <div class="container container--wide lp-hero__grid">

      <div class="lp-hero__copy">
        <p class="lp-eyebrow"><span><span class="lp-eyebrow__lead">מסירת כתבי בי־דין<b aria-hidden="true"> · </b></span>לעורכי דין ומשרדי עורכי דין</span></p>

        <h1 class="lp-h1" id="lp-title">
          <span>מסירות משפטיות לעורכי דין</span>
          <span>בכל <em>הארץ</em>.</span>
        </h1>

        <p class="lp-hero__sub">מסירה אישית, ${PROOF}, ועדכון בוואטסאפ בכל שלב.</p>

        <div class="lp-hero__cta">
          <a class="btn btn--primary btn--lg" href="${wa}" target="_blank" rel="noopener">
            <svg width="20" height="20" aria-hidden="true"><use href="#i-whatsapp"></use></svg>שלחו פרטי מסירה</a>
          <a class="btn btn--ghost-light btn--lg" href="tel:+${WA}">
            <svg width="19" height="19" aria-hidden="true"><use href="#i-phone"></use></svg><span class="nowrap">${TEL}</span></a>
        </div>

        <!-- The spec strip: the three facts a lawyer checks first, set like
             figures on a page rather than ticks in a list. Every one of them
             is already a claim this site makes — nothing here is new. -->
        <dl class="lp-spec">
          <div><dt>3</dt><dd>הגעות לכל מסירה, בימים ובשעות שונות</dd></div>
          <div><dt>5<small>דק׳</small></dt><dd>למענה אנושי בוואטסאפ</dd></div>
          <div><dt><svg width="30" height="30" aria-hidden="true"><use href="#i-clipboard"></use></svg></dt><dd>תיעוד של כל הגעה, בשעתה</dd></div>
        </dl>
      </div>

${card}

    </div>
  </section>

  <!-- ===================== WHY ========================================== -->
  <section class="lp-sec" aria-labelledby="lp-why">
    <div class="container container--wide">
      <h2 class="lp-h2" id="lp-why">
        <span>למה משרדים</span>
        <span>בוחרים <em>בנו</em>.</span>
      </h2>

      <div class="lp-why">
${WHY.map(([ic, h, p]) => `        <article class="lp-card rv-up">
          <span class="lp-card__ic" aria-hidden="true"><svg width="22" height="22"><use href="#${ic}"></use></svg></span>
          <h3>${esc(h)}</h3>
          <p>${esc(p)}</p>
        </article>`).join('\n')}
      </div>
    </div>
  </section>

  <!-- ===================== HOW — navy marks the thing itself ============ -->
  <section class="lp-sec lp-sec--navy" aria-labelledby="lp-how">
    <div class="container container--wide">
      <h2 class="lp-h2 lp-h2--light" id="lp-how">
        <span>שלושה שלבים</span>
        <span>ואתם <em>מחוץ לזה</em>.</span>
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

  <!-- ===================== FLEET + REVIEWS =============================
       Taken from the home page at build time, not copied into this file, so
       a review added there or a vehicle that changes lands here as well. -->
${sections.fleet}

${sections.reviews}

  <!-- ===================== FOR FIRMS ==================================== -->
  <section class="lp-sec" aria-labelledby="lp-firm">
    <div class="container container--wide lp-firm">
      <div class="lp-firm__copy">
        <h2 class="lp-h2" id="lp-firm">
          <span>למשרד ששולח</span>
          <span>יותר <em>ממסירה אחת</em>.</span>
        </h2>
        <p class="lp-firm__lead">מסירה בודדת מתומחרת לגופו של תיק — אין דרך אחרת לתמחר אותה בכבוד. אבל משרד ששולח מסירות באופן קבוע לא צריך לעבור את השיחה הזאת כל פעם מחדש, ולכן איתו אנחנו קובעים הסדר.</p>
        <a class="btn btn--primary btn--lg" href="${waFirm}" target="_blank" rel="noopener">
          <svg width="20" height="20" aria-hidden="true"><use href="#i-whatsapp"></use></svg>לדבר על הסדר למשרד</a>
      </div>

      <ul class="lp-firm__list">
${FIRM.map(([h, p]) => `        <li class="rv-up"><b>${esc(h)}</b><span>${esc(p)}</span></li>`).join('\n')}
      </ul>
    </div>
  </section>

  <!-- ===================== FAQ ========================================== -->
  <section class="lp-sec lp-sec--soft" aria-labelledby="lp-faq">
    <div class="container container--wide">
      <h2 class="lp-h2" id="lp-faq">
        <span>שאלות שעורכי דין</span>
        <span>שואלים <em>אותנו</em>.</span>
      </h2>

      <div class="lp-faq">
${FAQ.map(([q, a]) => `        <details class="fq">
          <summary>${esc(q)}</summary>
          <div class="faq__answer"><p>${esc(a)}</p></div>
        </details>`).join('\n')}
      </div>
    </div>
  </section>

  <!-- ===================== CLOSE ======================================== -->
  <section class="lp-close" aria-labelledby="lp-close-t">
    <div class="container">
      <h2 class="lp-h2 lp-h2--light lp-h2--mid" id="lp-close-t">
        <span>שלחו את פרטי המסירה</span>
        <span>ונחזור <em>עם מחיר</em>.</span>
      </h2>
      <p class="lp-close__sub">שם הנמען, הכתובת וסוג המסמך — זה כל מה שצריך כדי לתת לכם מחיר. מענה אנושי, בדרך כלל תוך חמש דקות.</p>
      <div class="lp-close__cta">
        <a class="btn btn--primary btn--lg" href="${wa}" target="_blank" rel="noopener">
          <svg width="20" height="20" aria-hidden="true"><use href="#i-whatsapp"></use></svg>שלחו פרטי מסירה</a>
        <a class="btn btn--ghost-light btn--lg" href="tel:+${WA}">
          <svg width="19" height="19" aria-hidden="true"><use href="#i-phone"></use></svg>התקשרו: <span class="nowrap">${TEL}</span></a>
      </div>
    </div>
  </section>

  <!-- A quiet rail, not a link farm: it tells a reader in Netanya there is a
       page about their town, and it tells Google which of the two legal pages
       is the hub and which is this one. -->
  <section class="lp-cities" aria-labelledby="lp-cities-t">
    <div class="container container--wide">
      <h2 id="lp-cities-t">מסירה משפטית לפי עיר</h2>
      <p>לכל אחת מהערים האלה יש דף עם פרטי השירות באזור, ו<a href="/מסירה-משפטית">דף ההסבר המלא על מסירה משפטית</a> מרכז את כולן.</p>
      <div class="lp-cities__list">
${legalCities.map(n => `        <a href="/${legalSlug(n)}">${esc(n)}</a>`).join('\n')}
      </div>
    </div>
  </section>

</main>

<a class="wa-float" href="${wa}" target="_blank" rel="noopener" aria-label="שלחו פרטי מסירה בוואטסאפ">
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
