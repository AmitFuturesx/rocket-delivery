# ROCKET DELIVERY — landing page

Static Hebrew RTL landing page for rocket-delivery.co.il. No build step, no
framework, no dependencies — upload the folder to any host and it runs.

```
index.html          the whole page
privacy.html        privacy policy
assets/css/style.css
assets/js/app.js    calculator, motion, nav, cookie consent
assets/fonts/       self-hosted Google Sans (450 / 500 / 700)
assets/images/      source jpg + generated webp for every photo
favicon.svg  apple-touch-icon.png  robots.txt  sitemap.xml
CLAUDE.md           the build brief this was built against
```

## Local preview

Any static server works, e.g.:

```bash
npx --yes serve -l 3210 .
```

## How it is put together

- **Static first.** Every word is in the HTML on load. JavaScript only enhances.
  With JS disabled the page reads fully: hero copy + marker, calculator fallback
  panel, van centered in the drive scene, all steps and FAQ visible.
- **Motion stack (self-hosted, no CDN):** GSAP + ScrollTrigger + MotionPathPlugin
  + Lenis in `assets/js/vendor/` — the same class of stack behind the
  reference site (unitedcarriers.com: Webflow + Lenis + scrubbed scenes).
- **Cinematic scenes** (all gated behind prefers-reduced-motion, all RTL-safe —
  CSS sticky stages instead of GSAP pins, which shift by the scrollbar width on
  RTL pages):
  - Hero — a 14s AI-generated brand film (pickup → drive → delivery, one
    branded box, golden-hour Israeli street) as a full-bleed background video:
    `assets/video/hero-story.mp4` (16:9) with a 9:16 centre-cut for phones,
    posters for reduced-motion/no-JS, live ticker on top; scrubbed descent
    releases the copy and pushes slowly into the film.
  - Statement — brand promise painted word-by-word by the scroll.
  - Drive — the AI-generated ROCKET van cutout crosses a full-bleed road line
    with a live קמ"ש speed read-out tied to scroll velocity and a ghost
    mega-word gliding behind.
  - Scrubbed clip-path title wipes, fleet photo drift, delivery-progress rail.
- **AI-generated brand assets** in `assets/images/vehicles/` (photoreal
  studio cutouts: branded van side view, scooter with rider, scooter top view)
  — generated to match the client's real fleet livery, background-removed,
  webp + png fallback.
- **Logical properties only** (`inset-inline-*`, `margin-inline`, …) so
  nothing breaks in RTL.
- **Design tokens** at the top of `style.css`, corner-radius rule documented.

### One deliberate deviation from the brief

The brief asks for the legal-delivery timeline to run **horizontally** on
desktop. Five steps with a title plus two lines of Hebrew each would leave
~230px per step at 1440px — cramped, and it would read as a generic feature
row. It is built instead as a vertical numbered timeline paired with a navy
positioning card, which keeps the flagship copy legible and still differs from
the layout family of every adjacent section. Easy to flip back if you prefer.

### The accessible orange

The locked brand orange `#F04800` scores 3.7:1 against white — fine for large
type and solid shapes, short of WCAG AA for button labels and small links. Two
extra tokens (`--orange-ink` / `--orange-ink-hover`) are the same hue darkened
to clear 4.5:1, and they are used **only** where text sits on or in the orange.
Every decorative use — the highlight marker, step numbers, icons, borders —
still uses the exact brand `#F04800`.

## The calculator

`assets/js/app.js` → sections 01–02 and 05.

- ~110 Israeli localities with approximate coordinates, plus area aliases
  (גוש דן, השרון, הנגב …). Matching normalises quotes/geresh/maqaf and finds
  the longest locality name appearing anywhere in the typed address.
- Distance = haversine × 1.3 road factor, with a 5 km floor inside one city.
- `price = (base + km × perKm) × sizeMult + fragile`, then `max(price, 100)`,
  then 18% VAT. The breakdown shown to the visitor mirrors that maths line by
  line, so the number is always explainable.
- The result recalculates live on any change once it has been shown once.
- The WhatsApp button deep-links to `wa.me` with the full quote pre-written.

Verified scenarios: same-city (minimum charge applies), Tel Aviv → Eilat with a
large fragile package, legal delivery, economy, empty field, unrecognised
locality.

## Before launch — open items for Amit

| # | Item | Where |
|---|---|---|
| 1 | **Real price table** — the rates are placeholders | `app.js`, `PRICING` |
| 2 | **Phone conflict — must resolve**: posters say 053-7232057, the Google listing says 053-548-9989. Site currently uses 053-7232057 everywhere | `app.js` `WA_NUMBER` + `tel:`/`wa.me` links |
| 3 | ~~Google reviews~~ — DONE: real 5.0 rating, 12-review count, 3 real quotes + link to the Maps listing (snapshot Aug 2026; live auto-refresh would need the Places API) | social-proof section |
| 4 | **GA4 ID** — analytics stay off until this is set, and only load after cookie consent | `app.js` `GA4_ID` |
| 5 | **Form endpoint** — "תחזרו אליי" currently opens a mail draft | `app.js` section 06 |
| 6 | **Real email + social profile URLs** | footer in both HTML files |
| 7 | **Accessibility plugin** (Enable etc.) if the client subscribes | before `</body>` |
| 8 | Optional: Google Places API for address autocomplete instead of the local dataset | `app.js` section 02 |

Every one of these is marked with a `TODO`/`⚠️` comment at the exact spot in the
source.

## QA performed

- Rendered and reviewed at 375 / 768 / 1024 / 1440. No horizontal scroll, nav
  on one line at 1024, headline two lines at every breakpoint.
- Contrast audit over every rendered text node: zero WCAG AA failures.
- Scripts disabled: full content readable, calculator fallback shown, menu
  button hidden, cookie banner absent.
- `prefers-reduced-motion`: all entrance states resolve to visible.
- JSON-LD parses; `FAQPage` verified to mirror the accordion question for
  question and answer for answer.
- All photos converted to WebP (~4× smaller) with jpg fallbacks via `<picture>`,
  explicit `width`/`height`, and lazy loading below the fold.
