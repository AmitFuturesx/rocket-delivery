# ROCKET DELIVERY — Premium Landing Page Build Brief

You are building a **premium, conversion-focused, Hebrew RTL landing page** for ROCKET DELIVERY (rocket-deliveries.com) — an Israeli same-day courier company. The client paid for top-tier work. The previous site was a generic template built with zero SEO. This build is the corrective experience: **it must look like it was crafted by a premium web designer, never like a template or an AI default.**

**Design Read:** Premium consumer/service landing for Israeli businesses & private customers who need urgent deliveries, with an energetic-but-trustworthy language, brand-driven (deep navy + rocket orange), leaning toward custom CSS/Tailwind + motivated motion.
**Dials:** DESIGN_VARIANCE: 8 · MOTION_INTENSITY: 6 · VISUAL_DENSITY: 4

---

## 1. Hard Requirements (non-negotiable)

1. **Language & direction:** Hebrew, `<html lang="he" dir="rtl">`. Full RTL. All copy in Hebrew (masculine-plural address to customers: "קבלו", "הזמינו").
2. **Static-first, SEO-readable:** All content lives in semantic HTML rendered on load. JavaScript only *enhances* (calculator logic, animations). Google must be able to read 100% of the content with JS disabled. No SPA shell.
3. **Stack:** Single-page static site — `index.html` + `privacy.html`, one CSS file, one JS file (vanilla or minimal). No framework needed; if you use a build step, output must be static files deployable to any host. No React unless there is a compelling reason — this is a landing page, not an app.
4. **Fonts:** Google Sans — the woff2 files are bundled in `assets/fonts/` (gs-book.woff2 = 450, gs-med.woff2 = 500, gs-bold.woff2 = 700; full Hebrew + ₪ coverage). Self-host via `@font-face` with `font-display: swap`. **Do NOT link Google Fonts CDN for the display font.** Fallback stack: `'Google Sans', 'Heebo', 'Assistant', sans-serif` (Heebo via Google Fonts as fallback only is acceptable).
5. **Mobile-first.** Most visitors arrive from paid campaigns on phones. Design and test 375px first, then scale up. Breakpoints: 640/768/1024/1280. Touch targets ≥ 44×44px. Hero uses `min-h-[100dvh]` logic, never `h-screen`.
6. **Performance:** Convert all images to WebP (keep jpg fallback via `<picture>` if trivial). `loading="lazy"` on everything below the fold, explicit `width`/`height` to prevent CLS. Target Lighthouse ≥ 90 mobile on Performance & SEO.
7. **`prefers-reduced-motion` respected globally** — all animations collapse to opacity-only or none.

---

## 2. Brand System

### Colors (extracted from the actual logo — lock these)
```css
:root {
  --navy-950: #070A14;   /* page-dark sections, near-black navy */
  --navy-900: #0B1023;   /* primary dark surface */
  --navy-800: #111834;   /* raised dark cards */
  --orange-600: #F04800; /* primary brand orange (logo flame) */
  --orange-500: #F06000; /* hover/gradient partner */
  --white: #FFFFFF;
  --off-white: #F6F7FB;  /* light section background */
  --ink: #0B1023;        /* text on light */
  --muted: #5A6178;      /* secondary text on light */
  --whatsapp: #25D366;   /* ONLY for WhatsApp CTAs — nowhere else */
}
```
- **One accent (orange), locked across the whole page.** Green appears exclusively on WhatsApp buttons.
- Theme: light page with **deep-navy full-bleed "power sections"** (hero, calculator, testimonials strip, final CTA). This is a deliberate composition, not random alternation — the navy sections are the emotional/conversion peaks. Never sandwich random light/dark; follow the section map in §4.
- Shadows tinted to navy (`rgba(11,16,35,0.12)`), never pure black.

### Typography
- Display/headlines: Google Sans 700, `tracking` slightly tight, `line-height: 1.15`. Hebrew headlines: never letter-space Hebrew aggressively (Hebrew hates tracking > 0.02em).
- Working weight for labels/UI: 500. Body: 450 (book), 16–18px, line-height 1.6–1.7, `max-width: 60ch`.
- **Signature move (borrowed from the best reference in this niche):** one emphasized word per major headline gets an **orange highlight marker** (rounded background box behind the word, slight rotation −1deg). Example: "משלוחים מהיום להיום — **בסטנדרט** אחר". Use on hero + 2–3 section headlines max. This replaces eyebrows.
- Emphasis inside headlines = bold/color of the SAME font. Never mix font families for emphasis.

### Shape & materials
- Corner-radius rule (document it in CSS comments and follow everywhere): cards 20px, inputs 12px, buttons full-pill, images 16px.
- Cards only where elevation means hierarchy; elsewhere use borders/space.
- A subtle **dashed "delivery route" SVG line** motif may wind between 2–3 sections (light gray, decorative, `aria-hidden`) — it tells the story of a package's journey. Keep it subtle; this is the one decorative flourish.

### Icons
- One library only: **Phosphor** (via CDN web font or inline SVGs copied from Phosphor). `strokeWidth` consistent. **Zero emojis anywhere in the UI.**

---

## 3. Assets (all local, already organized)

`assets/images/` — semantic names, use exactly these:

| Folder | Files | Use in |
|---|---|---|
| `hero/` | `storefront-team-fleet.jpg` (branch + team + fleet lineup — **primary hero image**), `courier-riding-highway.jpg`, `speed-reliability-banner.jpg` | Hero |
| `fleet/` | `full-fleet-skyline.jpg`, `two-vans-sunset.jpg`, `two-couriers-scooters.jpg`, `full-fleet-parking.jpg`, `vans-and-box-truck.jpg`, `fleet-feature-icons-banner.jpg` | Fleet section |
| `handover/` | `courier-door-delivery-1/2.jpg`, `courier-door-documents.jpg`, `car-trunk-loading.jpg`, `van-loading-tv-box.jpg`, `van-loading-sony-box.jpg` | Trust moments, sprinkled |
| `sectors/` | `lawyer-office-delivery.jpg`, `medical-lab-samples.jpg`, `office-business-delivery.jpg`, `workshop-parts-delivery.jpg`, `phone-lab-delivery.jpg`, `construction-materials.jpg`, `hvac-technician-delivery.jpg` | Audiences section |
| `coverage/` | `israel-map-van-night.jpg`, `israel-map-scooter-night.jpg`, `courier-israel-map-3d.jpg` | Nationwide-coverage section |
| `legal/` | `legal-delivery-infographic.jpg` | Legal-delivery section (reference for content — rebuild as HTML, don't just embed the image) |
| `brand/` | `logo-clean-white-bg.jpg` (**extract/cut out the logo from this** → transparent PNG/SVG-traced for header+footer), `poster-full-services*.jpg`, `thank-you-handshake-banner.jpg` | Header, footer, about |

Every `<img>` gets a descriptive **Hebrew `alt`** containing a natural keyword (e.g. `alt="שליח של רוקט משלוחים מוסר חבילה ללקוחה בתל אביב"`).

---

## 4. Page Structure (section map, in order)

Follow this map. Vary layout families — no two adjacent sections share the same composition. Max ONE marquee on the page. Zigzag image/text splits: max 2 consecutive.

1. **Header (sticky, rounded floating bar).** Logo (right, RTL), nav: ראשי · שירותים · מחשבון מחיר · אזורי שירות · שאלות ותשובות · צור קשר. Primary pill CTA "חשבו מחיר משלוח" (anchors to calculator) + phone icon-button. ≤72px tall, one line at 1024px. On scroll: gains backdrop blur + shadow.
2. **Hero (navy, full-bleed).** Split layout — NOT centered. Right (RTL-first): headline max 2 lines with one orange-highlighted word, subtext ≤20 words, 2 CTAs (primary orange pill "חשבו מחיר תוך 30 שניות" → calculator anchor; secondary ghost with WhatsApp icon "דברו איתנו בוואטסאפ"). Left: `storefront-team-fleet.jpg` in a rounded mask with a subtle parallax drift. Below fold-line inside hero: thin trust strip (זמינות מיידית · פריסה ארצית · שירות אנושי) — icons + 3 words, no more.
   - Suggested headline: `משלוחים מהיום להיום, <mark>בלי הפתעות</mark> במחיר` (or better — write 3 options, pick strongest).
3. **THE CALCULATOR — "מחשבון עלות משלוח" (navy card floating over light section, the visual centerpiece).** Full spec in §5.
4. **Audiences — "נותנים שירות לכל סוגי העסקים".** 6 sector cards using `sectors/` photos: עורכי דין ומשרדים (מסירות משפטיות) · מעבדות ורפואה · מעבדות סלולר ואלקטרוניקה · עסקים וחנויות · קבלנים וטכנאים · לקוחות פרטיים. Card grid with real photos (not white-on-white), hover lift.
5. **Legal delivery spotlight — "מסירה משפטית — כל השלבים, כחוק".** Rebuild the 5-step flow from `legal/legal-delivery-infographic.jpg` as an HTML numbered timeline (1 קבלת הזמנה → 2 עד 3 הגעות לכתובת → 3 הגעה בימים ושעות שונות → 4 הדבקה על הדלת + תיעוד מלא → 5 מילוי טופס אישור מסירה מלא). This is a flagship differentiator + SEO magnet. Horizontal steps desktop / vertical mobile.
6. **Fleet — "צי רכבים לכל גודל משלוח".** קטנועים · רכבים ווואנים · משאיות. Use fleet photos. Different layout family than §4 (e.g., large media + overlay chips, or horizontal scroll-snap).
7. **Coverage — "פריסה ארצית".** `israel-map-van-night.jpg` as the visual + short copy + city keyword links (see SEO §7).
8. **Social proof (navy strip).** Google-rating card (number + stars) + 3 testimonial cards in a scroll-snap row. ⚠️ Use `<!-- PLACEHOLDER: real Google reviews pending from client -->` with realistic mock structure, clearly marked mock.
9. **How it works — "איך זה עובד?"** 4 steps: מחשבים מחיר → מאשרים בוואטסאפ → שליח בדרך → המשלוח נמסר + עדכון. Minimal, numbered, one line each.
10. **FAQ — accordion,** `<details>/<summary>` based (SEO-readable). 6–8 questions: כמה עולה משלוח? · תוך כמה זמן אוספים? · מה זה מסירה משפטית? · האם יש אחריות על החבילה? · לאילו אזורים מגיעים? · איך משלמים? Write full Hebrew answers.
11. **Final CTA (navy, full-bleed).** "צריכים שליח? קבלו מחיר עכשיו." One orange CTA to calculator + WhatsApp secondary + phone. Plus compact "תחזרו אליי" form (שם, טלפון, הודעה) — static form posting via `mailto:` fallback or form service placeholder `<!-- TODO: connect form endpoint -->`.
12. **Footer.** 3 columns: (a) logo + tagline + contact (phone, WhatsApp, email placeholder) + social icons; (b) ניווט מהיר; (c) **SEO keyword architecture** — see §7. Bottom bar: © + מדיניות פרטיות link + "נבנה ע"י Amitzur Digital".
13. **Floating WhatsApp button** — bottom-left (RTL page → left side), green, subtle attention pulse every ~8s (respect reduced-motion), `aria-label="שלחו הודעת וואטסאפ"`.
14. **Cookie banner** — bottom, navy, "אני מסכים" primary + "הגדרות/דחייה" secondary, stores consent in `localStorage`, gates the analytics snippet.

**CTA intent discipline:** ONE label per intent across the whole page. Calculator intent = "חשבו מחיר משלוח" everywhere. WhatsApp intent = "דברו איתנו בוואטסאפ". Never invent synonyms per section.

---

## 5. The Calculator — flagship feature, engineer it properly

**Goal:** visitor gets a transparent price estimate in under 30 seconds, then jumps to WhatsApp with a pre-filled order message. This is the conversion engine of the whole page.

### Inputs (in order, RTL form)
1. **סוג השירות** — 4 selectable cards (radio behavior): מהיום להיום (default) · מהיום למחר · עד 5 ימי עסקים · מסירה משפטית. Each card: title + one-line description.
2. **כתובת איסוף / כתובת מסירה** — two text inputs with labels ABOVE (never placeholder-as-label). Placeholder examples: "למשל: אבן גבירול 30, תל אביב". Autocomplete: build a lightweight local dataset of ~80 Israeli cities/areas with approximate lat/lng for distance estimation (no paid API). Match on city name typed anywhere in the string. `<!-- TODO: optional upgrade to Google Places API when client provides key -->`
3. **גודל החבילה** — 3 cards: קטן (עד 30×25×15 ס"מ, עד 5 ק"ג — מעטפה, מסמכים) · בינוני (עד 50×40×30, עד 15 ק"ג) · גדול (מעל זה — קרטונים, ציוד).
4. **Checkbox:** תכולה שבירה / בעלת ערך גבוה — "נדאג לשליח עם רכב וטיפול מוגן במיוחד".

### Pricing engine
```js
// ⚠️ PLACEHOLDER RATES — Amit must confirm the real price table with the client before launch.
const PRICING = {
  base:      { sameDay: 60, nextDay: 45, upTo5Days: 35, legal: 120 },
  perKm:     { sameDay: 1.6, nextDay: 1.2, upTo5Days: 0.9, legal: 1.6 }, // straight-line km × 1.3 road factor
  sizeMult:  { small: 1.0, medium: 1.25, large: 1.6 },
  fragileAdd: 25,
  minCharge: 100,           // מינימום חיוב
  vatRate:   0.18
};
```
Flow: compute distance (haversine × 1.3) → `price = (base + km*perKm) * sizeMult + fragileAdd?` → apply `max(price, minCharge)` → show breakdown.

### Result panel (the trust moment)
Animated reveal (height+fade). Shows an itemized, transparent breakdown exactly like a mini-quote:
- שירות (e.g. מהיום להיום) — X ₪
- מרחק משוער — Y ק"מ
- מינימום חיוב (if applied) — 100 ₪
- סה"כ לפני מע"מ — Z ₪ · מע"מ 18% — W ₪
- **מחיר סופי כולל מע"מ — BIG number, orange, count-up animation**
- Small print: "המחיר הוא הערכה על בסיס מרחק הנסיעה. שעות לילה, סופי שבוע או דרישות מיוחדות עשויים לשנות אותו — לאישור סופי דברו איתנו."
- Two buttons: **green WhatsApp "הזמינו עכשיו בוואטסאפ"** (primary, biggest) + ghost "התקשרו: 053-7232057".

### WhatsApp deep link (the money feature)
```js
const msg = `היי, בדקתי במחשבון באתר: ${serviceName} מ-${pickup} ל-${dropoff} (חבילה ${sizeName}${fragile ? ', תכולה שבירה' : ''}) — הערכת מחיר ${total} ₪ כולל מע"מ. אשמח להזמין משלוח 🚀`;
location.href = `https://wa.me/972537232057?text=${encodeURIComponent(msg)}`;
```
⚠️ Phone 053-7232057 appears on the client's brand posters — **confirm with Amit before launch.** The floating button uses the same number with a generic greeting message.

### States (all of them)
- Empty/default, focused inputs (visible focus rings), **error** (missing address → inline red text below field, never alert()), **loading** (button turns to inline skeleton shimmer 400ms — makes the calculation feel "real"), **result**, and result-updates-on-change (recalc live once first result shown).
- Full keyboard operability. Labels + `aria-describedby` on errors.

---

## 6. Motion Spec (motivated, premium, never noisy)

Every animation must answer "what does this communicate?" — hierarchy, feedback, storytelling, or state. Nothing loops infinitely except the WhatsApp pulse and (optionally) one subtle marquee.

| Where | What | Why |
|---|---|---|
| Hero on load | Staggered rise+fade of headline words (60ms stagger), then CTA, then image slides in with mask reveal | First-impression hierarchy |
| Highlight marker | Marker background "draws" itself width 0→100% when headline enters viewport | Signature brand moment |
| Section entries | IntersectionObserver: `opacity 0→1, translateY 24px→0`, 500ms cubic-bezier(0.22,1,0.36,1), stagger children 80ms. Once only | Storytelling rhythm |
| Calculator cards | Selected card: spring scale 0.97→1 + orange border sweep | Feedback |
| Result reveal | Height auto-animate + count-up on final price (600ms) | The payoff moment |
| Legal timeline | Steps connect: dashed line draws between steps on scroll | Narrative |
| Buttons | Hover: lift −2px + shadow grow; active: scale 0.98 | Tactility |
| Stats/numbers | Count-up when visible | Credibility |
| Testimonials | Scroll-snap row, free swipe on mobile | Breadth |
| WhatsApp float | Gentle scale pulse 1→1.06 every 8s, ×3 then stop | Attention w/o annoyance |

Implementation: vanilla IntersectionObserver + CSS transitions/keyframes (no GSAP needed at this scope — keep the bundle tiny). All gated behind `@media (prefers-reduced-motion: no-preference)`.

---

## 7. SEO Spec (this is WHY the client came — do not shortcut it)

### Head
- `<title>רוקט משלוחים | משלוחים מהיום להיום ושליחויות בפריסה ארצית</title>`
- Meta description (~150 chars, Hebrew, includes מחשבון מחיר + מהיום להיום + פריסה ארצית + CTA).
- Canonical `https://rocket-deliveries.com/`, `og:*` + `twitter:card` with a branded share image (use `brand/poster-full-services.jpg` resized 1200×630), favicon from logo.

### Heading map (exactly one H1)
- H1: hero headline (contains "משלוחים מהיום להיום").
- H2 per section using search phrasing: "מחשבון עלות משלוח", "שירותי שליחויות לכל סוגי העסקים", "מסירה משפטית כחוק", "צי רכבים לכל משלוח", "משלוחים בפריסה ארצית", "שאלות ותשובות".

### Structured data (JSON-LD, all three)
1. `LocalBusiness` (name, url, telephone, areaServed: IL, logo, image, openingHours placeholder).
2. `FAQPage` mirroring the FAQ accordion exactly.
3. `Service` ×3 (משלוח מהיום להיום, מסירה משפטית, שליחויות לעסקים).

### Keyword architecture
Weave naturally into copy (never stuffed): משלוחים מהיום להיום · חברת שליחויות · שליח עד הבית · משלוח דחוף · מסירה משפטית · שליחויות לעסקים · דואר שליחים · משלוח חבילה · שליחויות בפריסה ארצית.
**Footer "אזורי שירות" block:** styled, readable link-look list (not spam-wall): שליחויות בתל אביב · בירושלים · בחיפה · בראשון לציון · בפתח תקווה · בנתניה · באשדוד · בבאר שבע · ברמת גן · בבני ברק · בחולון · ברחובות. Each is an anchor to the coverage section for now (`<!-- future: dedicated city pages -->`). Clean 3-column layout, muted color — professional, not a keyword dump.

### Technical
`robots.txt` (allow all + sitemap line), `sitemap.xml` (2 URLs), semantic landmarks (`header/main/section/footer` + aria-labels), all images with Hebrew alt text.

### Analytics
GA4 + Search Console snippet slots, loaded **only after cookie consent**: `<!-- TODO: GA4 ID from Amit -->`.

---

## 8. Anti-Generic Bans (hard fails — audit before finishing)

- ❌ Centered hero over gradient blob. ❌ Three identical white feature cards. ❌ AI-purple/glassmorphism-everywhere. ❌ Inter as display font. ❌ Emoji as icons. ❌ Eyebrow label above every section (max 1 per 3 sections — prefer the orange marker instead). ❌ `alert()` for errors. ❌ Lorem ipsum anywhere. ❌ Fake precise stats (only use numbers the brand can claim; mark mocks). ❌ White-text-on-white-button contrast fails. ❌ Two CTAs with the same intent but different labels. ❌ Left/right CSS properties — **use logical properties only** (`inset-inline-start`, `margin-inline-end`, `padding-inline`) so RTL never breaks. ❌ Section theme flip-flopping outside the §4 map.

## 9. QA Checklist (run before declaring done)

1. Open at 375px, 768px, 1440px — screenshot each, actually look. No horizontal scroll, no clipped Hebrew descenders, nav one line.
2. Calculator: run 5 scenarios incl. same-city (min charge kicks in), long distance, legal delivery, fragile, missing-field error. Verify WhatsApp URL opens with correctly encoded Hebrew message.
3. Disable JS → all content readable, calculator area shows graceful fallback ("לקבלת מחיר מיידי — וואטסאפ/טלפון" links).
4. Copy self-audit: reread EVERY visible Hebrew string for grammar, gender consistency (customers = masculine plural), and AI-sounding fluff. Rewrite anything questionable.
5. Contrast: every CTA and form element passes WCAG AA. Focus visible everywhere.
6. Validate JSON-LD (paste into schema validator logic mentally / lint structure).
7. Lighthouse pass: Performance, SEO, Accessibility, Best Practices ≥ 90 mobile.

## 10. Open items — surface these to Amit at the end, do not block the build
- [ ] Real pricing table from client (replace PLACEHOLDER rates)
- [ ] Confirm WhatsApp number 053-7232057
- [ ] Google reviews link → replace testimonial mocks
- [ ] GA4 / Search Console IDs
- [ ] Form endpoint (or keep WhatsApp-only)
- [ ] Hosting target + accessibility-plugin subscription (Enable etc.) to embed
