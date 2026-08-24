/* ==========================================================================
   ROCKET DELIVERY — app.js
   Vanilla, no dependencies. JavaScript only ENHANCES: every word on the page
   is already in the HTML, and the calculator degrades to WhatsApp/phone.
   --------------------------------------------------------------------------
   01. Config & helpers
   02. Israeli locality dataset (distance estimation, no paid API)
   03. Header, mobile nav
   04. Scroll motion (reveal, marker, route line, count-up, parallax)
   05. Calculator
   06. Callback form
   07. WhatsApp float, cookie consent & analytics gate
   ========================================================================== */
(function () {
  'use strict';

  /* 01. CONFIG & HELPERS =================================================== */

  /* Matched to the market on 19 Aug 2026 by reading the competitor's own
     calculator bundle, not by guessing: a per-km rate by service, a flat price
     under 12 km, and that flat price acting as the floor on longer trips.
     Package size only matters through the vehicle it needs, and fragile
     content upgrades the vehicle rather than adding a fee.
     Legal delivery is deliberately absent — a human quotes it. */
  var PRICING = {
    perKm:       { sameDay: 7, nextDay: 5 },   // ₪ per km, before VAT
    vehicleBase: { motorcycle: 100, car: 120 },
    sizeVehicle: { small: 'motorcycle', medium: 'car', large: 'car' },
    inCityKm:    12,
    vatRate:     0.18
  };
  var VEHICLE_NAMES = { motorcycle: 'אופנוע', car: 'רכב' };

  /* ── The client's own rate card ────────────────────────────────────────
     He prices by ZONE PAIR, not by distance: a group of pickup towns, a group
     of delivery towns, and one price per package size. Blocks arrive from him
     in exactly this shape, so they are stored in exactly this shape — adding
     the next one is a paste, not a translation, and he can proof-read it.

     Prices are BEFORE VAT and are the SAME-DAY rate.
     Next-day is 10% below same-day.
     Matching is symmetric: תל אביב → נתניה costs the same as נתניה → תל אביב.

     Any pair not covered here still falls back to the distance estimate, and
     the quote says so, so we never present a guess as if it were his price. */
  var ZONE_RATES = [
    {
      from: ['פתח תקווה', 'גבעתיים', 'רמת גן', 'תל אביב'],
      to:   ['נתניה', 'קדימה', 'כפר יונה'],
      small: 170, medium: 200, large: 250
    },
    {
      from: ['פתח תקווה', 'גני תקווה', 'ראשון לציון', 'חולון', 'בת ים', 'תל אביב'],
      to:   ['מודיעין', 'שוהם'],
      small: 165, medium: 180, large: 230
    },
    {
      from: ['ראשון לציון', 'תל אביב', 'פתח תקווה', 'חולון', 'בת ים',
             'באר יעקב', 'נס ציונה'],
      to:   ['באר שבע'],
      small: 370, medium: 400, large: 450,
      nextDayFactor: 1            // "מהיום למחר אותו מחיר"
    },
    {
      from: ['תל אביב'],
      to:   ['גני תקווה', 'סביון', 'אור יהודה', 'קריית אונו'],
      small: 130, medium: 140, large: 180
    }
  ];
  /* Most blocks price next-day 10% below same-day, but not all — the client
     charges the same for both on the Beer Sheva run. A block can therefore
     carry its own `nextDayFactor`; this is only the default. */
  var NEXT_DAY_FACTOR = 0.9;   // "מהיום למחר — 10% פחות"

  /* The far north and the far south are quoted by a person. This is about
     REGION, not distance — Tiberias→Safed is only 35 km and still counts,
     because the client has no rates up there yet and a driver has to be
     positioned for it.

     The lines sit in the gaps between real towns, so nothing lands ambiguously:
       north 32.60 — takes Afula 32.608, Tiberias and Haifa 32.794, Safed
                     32.965, up to Kiryat Shmona 33.208. Leaves Zichron 32.571
                     and Hadera 32.434 on the normal track.
       south 31.30 — takes Beer Sheva 31.253, Arad, Dimona, Mitzpe Ramon and
                     Eilat 29.558. Leaves Ofakim 31.312 and Kiryat Gat 31.610.

     A price the client has actually quoted still wins, so his Dan→Beer Sheva
     block keeps returning 370 ₪ rather than becoming a quote request. */
  var EDGE_NORTH_LAT = 32.60;
  var EDGE_SOUTH_LAT = 31.30;

  function isEdgeCity(city) {
    return !!city && typeof city.lat === 'number' &&
           (city.lat >= EDGE_NORTH_LAT || city.lat <= EDGE_SOUTH_LAT);
  }

  /* Both directions, by canonical city label. Returns null when the client
     has not priced this pair yet. */
  function zoneRate(cityA, cityB, size, service) {
    for (var i = 0; i < ZONE_RATES.length; i++) {
      var z = ZONE_RATES[i];
      var hit = (z.from.indexOf(cityA) !== -1 && z.to.indexOf(cityB) !== -1) ||
                (z.from.indexOf(cityB) !== -1 && z.to.indexOf(cityA) !== -1);
      if (!hit) continue;
      var price = z[size];
      if (typeof price !== 'number') return null;
      if (service !== 'nextDay') return price;
      var f = typeof z.nextDayFactor === 'number' ? z.nextDayFactor : NEXT_DAY_FACTOR;
      return price * f;
    }
    return null;
  }

  /* straight-line km → road distance. 1.25 was fitted against ten routes priced
     by the competitor's own calculator: it lands the long, expensive runs
     (Eilat) within 1% instead of the 5% that 1.3 gave. */
  var ROAD_FACTOR = 1.25;
  var INTRA_CITY_KM = 5;      // floor when pickup and drop-off share a locality
  var WA_NUMBER = '972537232057';   // ⚠️ confirm 053-7232057 with the client

  var SERVICE_NAMES = {
    sameDay: 'מהיום להיום',
    nextDay: 'מהיום למחר',
    legal: 'מסירה משפטית'
  };
  var SIZE_NAMES = { small: 'קטן', medium: 'בינוני', large: 'גדול' };

  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) {
    return Array.prototype.slice.call((ctx || document).querySelectorAll(sel));
  };
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function shekel(n) { return Math.round(n).toLocaleString('he-IL') + ' ₪'; }


  /* 02. LOCALITY DATASET ================================================== */
  /* ~85 Israeli localities with approximate centre coordinates. Good enough
     for a distance ESTIMATE; the quote is explicitly labelled as such.
     TODO: optional upgrade to Google Places API when the client provides a key. */
  var CITIES = [
    ['תל אביב', 32.0853, 34.7818, ['תל אביב יפו', 'תל אביב-יפו', 'ת"א', 'תא']],
    ['ירושלים', 31.7683, 35.2137, ['י-ם']],
    ['חיפה', 32.7940, 34.9896],
    ['ראשון לציון', 31.9730, 34.8066, ['ראשל"צ', 'ראשון']],
    ['פתח תקווה', 32.0840, 34.8878, ['פ"ת']],
    ['אשדוד', 31.8014, 34.6435],
    ['נתניה', 32.3215, 34.8532],
    ['באר שבע', 31.2530, 34.7915, ['ב"ש']],
    ['בני ברק', 32.0807, 34.8338],
    ['חולון', 32.0117, 34.7725],
    ['רמת גן', 32.0684, 34.8248, ['ר"ג']],
    ['אשקלון', 31.6688, 34.5742],
    ['רחובות', 31.8928, 34.8113],
    ['בת ים', 32.0171, 34.7457],
    ['בית שמש', 31.7497, 34.9887],
    ['כפר סבא', 32.1750, 34.9070],
    ['הרצליה', 32.1624, 34.8447, ['הרצליה פיתוח']],
    ['חדרה', 32.4340, 34.9196],
    ['מודיעין', 31.8928, 35.0104, ['מודיעין מכבים רעות', 'מכבים', 'רעות']],
    ['נצרת', 32.6996, 35.3035],
    ['נוף הגליל', 32.7050, 35.3200, ['נצרת עילית']],
    ['רמלה', 31.9288, 34.8667],
    ['רעננה', 32.1848, 34.8713],
    ['לוד', 31.9514, 34.8953],
    ['מודיעין עילית', 31.9319, 35.0417],
    ['רהט', 31.3925, 34.7539],
    ['הוד השרון', 32.1500, 34.8886],
    ['גבעתיים', 32.0723, 34.8115],
    ['קריית אתא', 32.8058, 35.1122, ['קרית אתא']],
    ['נהריה', 33.0058, 35.0946],
    ['ביתר עילית', 31.6997, 35.1176],
    ['אום אל פחם', 32.5197, 35.1522, ['אום אל-פחם']],
    ['עכו', 32.9281, 35.0818],
    ['אילת', 29.5577, 34.9519],
    ['רמת השרון', 32.1462, 34.8394],
    ['טבריה', 32.7940, 35.5320],
    ['כרמיאל', 32.9192, 35.2952],
    ['קריית גת', 31.6100, 34.7642, ['קרית גת']],
    ['עפולה', 32.6078, 35.2897],
    ['נס ציונה', 31.9293, 34.7986],
    ['באר יעקב', 31.9439, 34.8353],
    ['אריאל', 32.1056, 35.1719],
    ['יבנה', 31.8783, 34.7386],
    ['קריית מוצקין', 32.8397, 35.0785, ['קרית מוצקין']],
    ['קריית ביאליק', 32.8272, 35.0861, ['קרית ביאליק']],
    ['קריית ים', 32.8467, 35.0692, ['קרית ים']],
    ['קריית אונו', 32.0578, 34.8556, ['קרית אונו']],
    ['אור יהודה', 32.0300, 34.8500],
    ['יהוד', 32.0333, 34.8833, ['יהוד מונוסון']],
    ['ראש העין', 32.0956, 34.9564],
    ['צפת', 32.9646, 35.4960],
    ['דימונה', 31.0700, 35.0333],
    ['טירת כרמל', 32.7614, 34.9722],
    ['נשר', 32.7683, 35.0397],
    ['מגדל העמק', 32.6753, 35.2408],
    ['יקנעם', 32.6600, 35.1100, ['יוקנעם']],
    ['זכרון יעקב', 32.5714, 34.9539],
    ['פרדס חנה', 32.4711, 34.9769, ['פרדס חנה כרכור']],
    ['בנימינה', 32.5153, 34.9486],
    ['קיסריה', 32.5000, 34.9000],
    ['אור עקיבא', 32.5083, 34.9167],
    ['חריש', 32.4611, 35.0472],
    ['טירה', 32.2333, 34.9500],
    ['טייבה', 32.2667, 35.0092],
    ['קלנסווה', 32.2853, 34.9814],
    ['כפר קאסם', 32.1147, 34.9772],
    ['נתיבות', 31.4222, 34.5889],
    ['שדרות', 31.5250, 34.5964],
    ['אופקים', 31.3122, 34.6206],
    ['ערד', 31.2589, 35.2128],
    ['מצפה רמון', 30.6094, 34.8014],
    ['בית שאן', 32.4969, 35.4997],
    ['כפר יונה', 32.3167, 34.9333],
    ['תל מונד', 32.2500, 34.9167],
    ['אבן יהודה', 32.2700, 34.8850],
    ['פרדסיה', 32.3000, 34.9000],
    ['קדימה', 32.2833, 34.9167, ['קדימה צורן', 'קדימה-צורן', 'צורן']],
    ['גדרה', 31.8133, 34.7794],
    ['מזכרת בתיה', 31.8517, 34.8358],
    ['קריית מלאכי', 31.7286, 34.7481, ['קרית מלאכי']],
    ['גן יבנה', 31.7833, 34.7075],
    ['בית דגן', 32.0000, 34.8333],
    ['סביון', 32.0500, 34.8833],
    ['גני תקווה', 32.0644, 34.8722],
    ['שוהם', 31.9989, 34.9469],
    ['אלעד', 32.0522, 34.9511],
    ['גבעת שמואל', 32.0781, 34.8500],
    ['מבשרת ציון', 31.7972, 35.1500],
    ['מעלה אדומים', 31.7772, 35.2983],
    ['גבעת זאב', 31.8600, 35.1700],
    ['כוכב יאיר', 32.2231, 34.9992, ['צור יגאל']],
    ['אורנית', 32.1333, 34.9833],
    ['אלפי מנשה', 32.1667, 35.0000],
    ['קרני שומרון', 32.1700, 35.0900],
    ['מעלות תרשיחא', 33.0167, 35.2667, ['מעלות']],
    ['שלומי', 33.0733, 35.1450],
    ['קרית שמונה', 33.2075, 35.5697, ['קריית שמונה']],
    ['חצור הגלילית', 32.9800, 35.5450],
    ['קצרין', 32.9925, 35.6906],
    ['שפרעם', 32.8056, 35.1697],
    ['סחנין', 32.8642, 35.2967],
    ['טמרה', 32.8500, 35.2000],
    ['כפר כנא', 32.7469, 35.3419],
    ['דאלית אל כרמל', 32.6947, 35.0472],
    ['עוספיא', 32.7100, 35.0700],
    ['ירכא', 32.9550, 35.2000],
    ['מגאר', 32.8875, 35.4067, ["מג'אר"]],
    /* Broad areas — so "מרכז" or "השרון" still yields a usable estimate. */
    ['גוש דן', 32.0700, 34.8200, ['המרכז', 'מרכז']],
    ['השרון', 32.2000, 34.8900, ['שרון']],
    ['השפלה', 31.9000, 34.8300, ['שפלה']],
    ['הגליל', 32.9000, 35.3000, ['גליל']],
    ['הנגב', 31.2000, 34.8000, ['נגב', 'הדרום']],
    ['הצפון', 32.8000, 35.2000]
  ];

  function normalize(s) {
    return String(s || '')
      .replace(/[֑-ׇ]/g, '')          // niqqud / cantillation
      .replace(/[״"”“'’׳`]/g, '')               // quote marks & geresh
      .replace(/[־–—]/g, ' ')                   // maqaf / dashes → space
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Every searchable name → its record, longest names first so that
  // "קריית אתא" wins over a shorter accidental substring.
  var CITY_INDEX = (function () {
    var list = [];
    CITIES.forEach(function (c) {
      var names = [c[0]].concat(c[3] || []);
      names.forEach(function (n) {
        list.push({ key: normalize(n), label: c[0], lat: c[1], lng: c[2] });
      });
    });
    return list.sort(function (a, b) { return b.key.length - a.key.length; });
  })();

  function findCity(text) {
    var t = normalize(text);
    if (!t) return null;
    for (var i = 0; i < CITY_INDEX.length; i++) {
      if (t.indexOf(CITY_INDEX[i].key) !== -1) return CITY_INDEX[i];
    }
    return null;
  }

  function suggestCities(query, limit) {
    var q = normalize(query);
    if (q.length < 2) return [];
    var seen = {}, out = [];
    // Prefix matches read as the most natural completions, then contains.
    [true, false].forEach(function (prefixPass) {
      CITY_INDEX.forEach(function (c) {
        if (out.length >= limit || seen[c.label]) return;
        var idx = c.key.indexOf(q);
        if (idx === -1) return;
        if (prefixPass ? idx === 0 : idx > 0) { seen[c.label] = 1; out.push(c.label); }
      });
    });
    return out;
  }

  function haversineKm(a, b) {
    var R = 6371, toRad = Math.PI / 180;
    var dLat = (b.lat - a.lat) * toRad;
    var dLng = (b.lng - a.lng) * toRad;
    var s = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(a.lat * toRad) * Math.cos(b.lat * toRad) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
  }


  /* 03. HEADER & MOBILE NAV =============================================== */
  var header = $('#site-header');
  if (header) {
    var onScroll = function () {
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  var mobileNav = $('#mobile-nav');
  var navToggle = $('.nav-toggle');
  if (mobileNav && navToggle) {
    mobileNav.hidden = false;                    // JS is on: the panel can animate
    var openNav = function (open) {
      mobileNav.classList.toggle('is-open', open);
      navToggle.setAttribute('aria-expanded', String(open));
      navToggle.setAttribute('aria-label', open ? 'סגרו תפריט' : 'פתחו תפריט');
      document.body.classList.toggle('is-locked', open);
      if (open) { var f = $('a', mobileNav); if (f) f.focus(); } else { navToggle.focus(); }
    };
    navToggle.addEventListener('click', function () {
      openNav(!mobileNav.classList.contains('is-open'));
    });
    $$('[data-nav-close], .mobile-nav a', mobileNav).forEach(function (el) {
      el.addEventListener('click', function () { openNav(false); });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && mobileNav.classList.contains('is-open')) openNav(false);
    });
  }

  // Highlight the section currently in view in the desktop nav.
  var navLinks = $$('.nav a[href^="#"]');
  if (navLinks.length && 'IntersectionObserver' in window) {
    var linkFor = {};
    navLinks.forEach(function (a) { linkFor[a.getAttribute('href').slice(1)] = a; });
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        navLinks.forEach(function (a) { a.classList.remove('is-active'); });
        var a = linkFor[en.target.id];
        if (a) a.classList.add('is-active');
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    Object.keys(linkFor).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) spy.observe(el);
    });
  }


  /* 04. SCROLL MOTION ===================================================== */
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add('in');
        io.unobserve(en.target);                 // once only
        if (en.target.hasAttribute('data-count')) countUp(en.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.15 });

    $$('.reveal, .mark, [data-count]').forEach(function (el) { io.observe(el); });
  } else {
    $$('.reveal, .mark').forEach(function (el) { el.classList.add('in'); });
  }

  /* Counts from 0 to `to`, writing through `format`. A guard timer always
     lands on the final value, so a throttled rAF can never leave a stale
     number (a half-counted price would be worse than no animation). */
  function countTo(el, to, dur, format) {
    var settle = function () { el.textContent = format(to); };
    if (reduceMotion) { settle(); return; }
    // clock from the first rAF tick and clamped progress — mixing
    // performance.now() with rAF timestamps can go negative and loop forever
    var start = null;
    function frame(now) {
      if (start === null) start = now;
      var p = Math.min(Math.max((now - start) / dur, 0), 1);
      el.textContent = format(to * (1 - Math.pow(1 - p, 3)));
      if (p < 1) { requestAnimationFrame(frame); } else { settle(); }
    }
    requestAnimationFrame(frame);
  }

  function countUp(el) {
    if (el.dataset.counted) return;            // fire once, whichever observer wins
    el.dataset.counted = '1';
    var target = parseFloat(el.getAttribute('data-count'));
    if (isNaN(target)) return;
    var suffix = el.getAttribute('data-suffix') || '';
    countTo(el, target, 1300, function (v) {
      return Math.round(v).toLocaleString('he-IL') + suffix;
    });
  }

  /* -- GSAP + Lenis choreography ------------------------------------------
     The cinematic layer: smooth scroll, hero scene, painted statement,
     the drive scene, title wipes, rail progress. Everything is layered on
     top of a fully readable static page and skipped under reduced motion. */
  if (!reduceMotion && window.gsap && window.ScrollTrigger) (function () {
    gsap.registerPlugin(ScrollTrigger);
    if (window.MotionPathPlugin) gsap.registerPlugin(MotionPathPlugin);

    /* history.scrollRestoration covers a normal reload; the back/forward cache
       can still hand an offset back on pageshow, so pin the top there too.
       Guarded on location.hash so /#calculator still lands on the calculator. */
    function toTopUnlessAnchored() {
      if (location.hash) return;
      window.scrollTo(0, 0);
      if (lenis) lenis.scrollTo(0, { immediate: true });
    }
    window.addEventListener('pageshow', toTopUnlessAnchored);

    /* Lenis smooth scroll driving ScrollTrigger */
    var lenis = null;
    if (window.Lenis) {
      lenis = new Lenis({ lerp: 0.11, wheelMultiplier: 1, autoRaf: false });
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
      gsap.ticker.lagSmoothing(0);
      // anchor links go through Lenis, or the page fights the tween
      $$('a[href^="#"]').forEach(function (link) {
        link.addEventListener('click', function (e) {
          var id = link.getAttribute('href');
          if (id.length < 2) return;
          var target = document.querySelector(id);
          if (!target) return;
          e.preventDefault();
          lenis.scrollTo(target, { offset: -96, duration: 1.15 });
          history.pushState(null, '', id);
        });
      });
    }

    var mm = gsap.matchMedia();

    /* Reveals ride ScrollTrigger so they stay in lock-step with Lenis —
       they fire a beat earlier than the IO fallback, so content is already
       settled by the time it is comfortably in view. */
    $$('.reveal, .mark').forEach(function (el) {
      ScrollTrigger.create({
        trigger: el, start: 'top 94%', once: true,
        onEnter: function () { el.classList.add('in'); }
      });
    });
    $$('[data-count]').forEach(function (el) {
      ScrollTrigger.create({
        trigger: el, start: 'top 94%', once: true,
        onEnter: function () { countUp(el); }
      });
    });

    /* ---- HERO: deliberately un-animated ---------------------------------
       Amit asked for the hero to simply stand still: no entrance stagger and
       no scroll scrub. The scrub used to fade the copy and the ticker out
       while the hero was still on screen, which read as the menu and text
       "disappearing". The only motion left in the hero is the road loop. */

    /* ---- STATEMENT: words painted by the scroll -------------------------- */
    var words = $('.st2__para .w');
    if (words.length) {
      gsap.to(words, {
        color: '#0B1023',
        stagger: 0.6,
        ease: 'none',
        scrollTrigger: { trigger: '.st2__para', start: 'top 88%', end: 'bottom 55%', scrub: 0.4 }
      });
    }

    /* ---- DRV: two-angle drive with a follow-cam (UC 1:1) ----------------- */
    var drv = $('.drv');
    if (drv && window.MotionPathPlugin) {
    /* The breakpoint must be read PER BUILD, not once at load. The CSS follows
       the live viewport, so a flag captured at load lets the two disagree:
       resize a desktop window down and the phone CSS stacks all three service
       cards into one grid cell while the desktop timeline keeps them all
       visible — text piled on text. That is also what DevTools device mode
       does, since it resizes without reloading.
       gsap.matchMedia() rebuilds this block on every crossing and reverts the
       previous one, so the JS and the CSS can never disagree again. */
    gsap.matchMedia().add({
      phone: '(max-width: 899px)',
      desk:  '(min-width: 900px)'
    }, function (mmCtx) {
      var drvPhone = mmCtx.conditions.phone;
      var drvSpeedo = $('#speedo');
      var drvSpeedWrap = $('.drv__speed');
      var drvSide = $('.drv__side');
      var drvTruckSide = $('.drv__truck-side');
      var drvGhost = $('.drv__ghost');
      var drvHead = $('.drv__panel-head');
      var drvSvcs = $$('.drv__panel-svcs .drv__panel-item');
      var drvTop = $('.drv__top');
      var drvSheet = $('#drv-sheet');
      var drvMap = $('.drv__map');
      var drvPath = $('#drv-path');
      var drvRider = $('#drv-rider');
      var drvCopy = $('.drv__copy');
      var drvGhostWords = $$('.drv__t-ghost');
      var drvFeats = $$('.drv__feat');
      var drvFeatsWrap = $('.drv__feats');

      var VBW = 2600;
      var pathLen = drvPath.getTotalLength();

      /* The follow-cam: the truck rides the SVG path; the sheet counter-
         translates so the truck stays anchored on screen while it turns. */
      /* one source of truth: sample the path once, place rider AND camera */
      var drvProxy = { p: 0 };
      function drvCam() {
        var rect = drvMap.getBoundingClientRect();
        var scale = rect.width / VBW;
        var len = drvProxy.p * pathLen;
        var pt = drvPath.getPointAtLength(len);
        var ahead = drvPath.getPointAtLength(Math.min(pathLen, len + 24));
        var behind = drvPath.getPointAtLength(Math.max(0, len - 24));
        var angle = Math.atan2(ahead.y - behind.y, ahead.x - behind.x) * 180 / Math.PI;
        // sprite front points down (+90°), so rotate by angle − 90
        // the image is centred on the group origin, so bbox-centre rotation
        // spins the truck in place and the translate parks it on the path
        gsap.set(drvRider, { x: pt.x, y: pt.y, rotation: angle - 90, transformOrigin: '50% 50%' });
        var ax = innerWidth * 0.5;              // screen anchor
        var ay = innerHeight * 0.42;
        /* A phone renders the copy ON the asphalt, so a 42% anchor drove the
           car straight through the paragraph. There the car rides the clear
           band between the copy and the feature card instead. offsetTop /
           offsetHeight are used on purpose — both elements carry GSAP
           transforms, so their client rects move while they animate. */
        if (drvPhone && drvFeatsWrap) {
          var bandTop = drvCopy.offsetTop + drvCopy.offsetHeight;
          var bandEnd = drvFeatsWrap.offsetTop;
          if (bandEnd > bandTop) ay = (bandTop + bandEnd) / 2;
        }
        var x = gsap.utils.clamp(innerWidth - rect.width, 0, ax - pt.x * scale);
        var y = gsap.utils.clamp(innerHeight - rect.height, 0, ay - pt.y * scale);
        gsap.set(drvSheet, { x: x, y: y });
      }
      drvCam();                                  // park everything at the start
      gsap.set(drvFeats, { y: 40 });
      gsap.set(drvCopy, { y: 30 });
      // panel layers start hidden — scrubbed fromTo tweens render lazily, so
      // without this both layers would overlap until their first render
      gsap.set(drvHead, { opacity: 0, y: 36 });
      gsap.set(drvSvcs, { opacity: 0, y: 36 });

      var drvTl = gsap.timeline({
        scrollTrigger: {
          trigger: drv, start: 'top top', end: 'bottom bottom', scrub: 0.5,
          invalidateOnRefresh: true,
          onUpdate: function (st) {
            var v = Math.min(94, Math.round(Math.abs(st.getVelocity()) / 24));
            if (drvSpeedo) drvSpeedo.textContent = (v < 10 ? '0' : '') + v;
          }
        }
      })
        /* ── Part A (0 → 0.34): side drive ── */
        .to(drvSpeedWrap, { opacity: 1, duration: 0.02 }, 0.01)
        // the truck rolls forward (RTL: right → left); its static slot is at
        // the inline-start (right) edge, so it crosses the full frame
        .fromTo(drvTruckSide, { x: '28vw' }, { x: '-96vw', ease: 'none', duration: 0.34 }, 0)
        // ghost mega-text glides the opposite way
        .fromTo(drvGhost, { x: '-8%' }, { x: '8%', ease: 'none', duration: 0.34 }, 0)
        // the headline fades in, hands off to the services, all scrub-reversible
        .fromTo(drvHead, { opacity: 0, y: 36 }, { opacity: 1, y: 0, duration: 0.045, ease: 'power2.out' }, 0.015)
        .to(drvHead, { opacity: 0, y: -30, duration: 0.04, ease: 'power2.in' }, 0.135)
        /* ── the cut (0.34): side out, top in ── */
        .to(drvSide, { opacity: 0, duration: 0.015, ease: 'none' }, 0.335)
        .set(drvTop, { opacity: 1 }, 0.35)
        /* ── Part B (0.35 → 1): the L-road with the sweeping turn ── */
        .to(drvProxy, {
          p: 1, ease: 'none', duration: 0.63,
          onUpdate: drvCam
        }, 0.35)
        // after the turn (~0.62) the vertical-phase copy fades in
        .to(drvCopy, { opacity: 1, y: 0, duration: 0.05, ease: 'power2.out' }, 0.60)
        // the ghost word resolves to the page ink on a light ground, but a
        // phone renders this copy ON the asphalt, so there it resolves to white
        .to(drvGhostWords, { color: drvPhone ? '#FFFFFF' : '#0B1023', ease: 'none', duration: 0.08 }, 0.63)
        // on a phone the speedo would sit dark-on-dark over the road, and right
        // where the headline starts — so it leaves with the side-drive phase
        .to(drvSpeedWrap, { opacity: 0, duration: 0.03 }, drvPhone ? 0.32 : 0.96);

      /* The three services, timed inside Part A's window (0.175 → 0.33).
         Desktop shows them side by side, so they simply stagger in and stay.
         A phone stacks them in ONE slot, so there they hand over: each fades
         in, fades out, and the next takes its place — otherwise the later
         cards pile on top of the earlier ones and only the last is readable. */
      if (drvPhone) {
        drvSvcs.forEach(function (el, i) {
          var at = 0.175 + i * 0.055;
          drvTl.fromTo(el, { opacity: 0, y: 26 },
                           { opacity: 1, y: 0, duration: 0.028, ease: 'power2.out' }, at);
          if (i < drvSvcs.length - 1) {
            drvTl.to(el, { opacity: 0, y: -22, duration: 0.022, ease: 'power2.in' }, at + 0.033);
          }
        });
      } else {
        drvTl.fromTo(drvSvcs, { opacity: 0, y: 36 },
                              { opacity: 1, y: 0, duration: 0.05, stagger: 0.035, ease: 'power2.out' }, 0.175);
      }

      /* The three trust features, same story. A desktop stacks them in a column
         so they arrive one after another and stay. A phone shows ONE at a time
         in a single slot: three cards WITH their descriptions do not fit a
         667px screen, and dropping the descriptions left a bare title. */
      if (drvPhone) {
        drvFeats.forEach(function (el, i) {
          var fAt = 0.66 + i * 0.09;
          drvTl.fromTo(el, { opacity: 0, y: 26 },
                           { opacity: 1, y: 0, duration: 0.04, ease: 'power2.out' }, fAt);
          if (i < drvFeats.length - 1) {
            drvTl.to(el, { opacity: 0, y: -22, duration: 0.03, ease: 'power2.in' }, fAt + 0.055);
          }
        });
      } else {
        drvFeats.forEach(function (el, i) {
          drvTl.to(el, { opacity: 1, y: 0, duration: 0.05, ease: 'power2.out' }, 0.66 + i * 0.10);
        });
      }

      window.addEventListener('resize', drvCam);
      /* GSAP reverts its own tweens and triggers; this listener is ours */
      return function () { window.removeEventListener('resize', drvCam); };
    });
    }

    /* ---- SVC cards: living line icons (lottie-style loops) --------------- */
    (function () {
      var loops = [];
      var mk = function (sel, vars) {
        $$(sel).forEach(function (el) { loops.push(gsap.to(el, vars)); });
      };
      mk('.ic-pen',  { x: -5, y: 5, rotation: -6, duration: 0.7, yoyo: true, repeat: -1, ease: 'sine.inOut' });
      mk('.ic-box',  { y: -6, duration: 0.8, yoyo: true, repeat: -1, ease: 'sine.inOut' });
      mk('.ic-pkg',  { y: -5, rotation: 3, duration: 0.9, yoyo: true, repeat: -1, ease: 'sine.inOut' });
      mk('.ic-gear', { rotation: 360, duration: 5, repeat: -1, ease: 'none' });
      mk('.ic-w1',   { opacity: 0.25, scale: 0.86, duration: 0.8, yoyo: true, repeat: -1, ease: 'sine.inOut' });
      mk('.ic-w2',   { opacity: 0.25, scale: 0.86, duration: 0.8, yoyo: true, repeat: -1, ease: 'sine.inOut', delay: 0.4 });
      mk('.ic-b1',   { y: -12, opacity: 0, duration: 1.4, repeat: -1, ease: 'power1.out' });
      mk('.ic-b2',   { y: -14, opacity: 0, duration: 1.4, repeat: -1, ease: 'power1.out', delay: 0.7 });
      /* the calculator's choice tiles use the same living-line language: one
         moving part per icon, so a plate reads as alive without a library */
      mk('.ic-c-flap',  { scaleY: 0.55, duration: 1.1, yoyo: true, repeat: -1, ease: 'sine.inOut', transformOrigin: '50% 0%' });
      mk('.ic-c-lid',   { y: -4, duration: 0.9, yoyo: true, repeat: -1, ease: 'sine.inOut' });
      mk('.ic-c-tape',  { opacity: 0.35, duration: 1.2, yoyo: true, repeat: -1, ease: 'sine.inOut' });
      mk('.ic-c-top',   { y: -7, duration: 0.9, yoyo: true, repeat: -1, ease: 'sine.inOut' });
      mk('.ic-c-bolt',  { scale: 1.14, duration: 0.6, yoyo: true, repeat: -1, ease: 'sine.inOut', transformOrigin: '50% 50%' });
      mk('.ic-c-hand',  { rotation: 360, duration: 3.6, repeat: -1, ease: 'none' });
      mk('.ic-c-check', { scale: 1.16, opacity: 0.55, duration: 0.75, yoyo: true, repeat: -1, ease: 'sine.inOut', transformOrigin: '50% 50%' });
      mk('.ic-c-stamp', { y: -6, scale: 1.08, duration: 0.85, yoyo: true, repeat: -1, ease: 'sine.inOut', transformOrigin: '50% 50%' });
      // run only while the grid is on screen
      var grid = $('.svc__grid');
      var calcLoops = loops.splice(loops.length - 8, 8);   // the eight added just above
      var calcGrid = $('.calc');
      if (calcGrid && calcLoops.length) {
        calcLoops.forEach(function (t) { t.pause(); });
        ScrollTrigger.create({
          trigger: calcGrid, start: 'top 95%', end: 'bottom top',
          onEnter:     function () { calcLoops.forEach(function (t) { t.play(); }); },
          onEnterBack: function () { calcLoops.forEach(function (t) { t.play(); }); },
          onLeave:     function () { calcLoops.forEach(function (t) { t.pause(); }); },
          onLeaveBack: function () { calcLoops.forEach(function (t) { t.pause(); }); }
        });
      }
      if (grid && loops.length) {
        loops.forEach(function (t) { t.pause(); });
        ScrollTrigger.create({
          trigger: grid, start: 'top 95%', end: 'bottom top',
          onEnter: function () { loops.forEach(function (t) { t.play(); }); },
          onEnterBack: function () { loops.forEach(function (t) { t.play(); }); },
          onLeave: function () { loops.forEach(function (t) { t.pause(); }); },
          onLeaveBack: function () { loops.forEach(function (t) { t.pause(); }); }
        });
      }
    })();

    /* ---- Scroll-typed headings ------------------------------------------
       Characters are split at runtime, so the HTML source keeps the whole
       sentence for Google, and aria-label keeps it whole for screen readers. */
    $$('.type-scrub').forEach(function (el) {
      var lines = $$('.tl', el);
      if (!lines.length) return;
      var chars = [];
      lines.forEach(function (line) {
        var text = line.textContent;
        line.textContent = '';
        line.setAttribute('aria-hidden', 'true');
        // Split per WORD first: each word is one unbreakable box, and only the
        // spaces between words are line-break opportunities. Splitting straight
        // into characters lets the browser break mid-word (a lone "א" wrapping).
        text.split(/(\s+)/).forEach(function (token) {
          if (!token) return;
          if (/^\s+$/.test(token)) {
            line.appendChild(document.createTextNode(token));
            return;
          }
          var word = document.createElement('span');
          word.className = 'wd';
          token.split('').forEach(function (glyph) {
            var s = document.createElement('span');
            s.className = 'ch';
            s.textContent = glyph;
            word.appendChild(s);
            chars.push(s);
          });
          line.appendChild(word);
        });
      });
      gsap.fromTo(chars,
        { opacity: 0.08 },
        {
          opacity: 1, ease: 'none', stagger: 1,
          scrollTrigger: { trigger: el, start: 'top 88%', end: 'top 32%', scrub: 0.35 }
        });
    });

    /* ---- Title wipes on scrub ------------------------------------------- */
    $$('.wipe').forEach(function (el) {
      gsap.fromTo(el, { '--wipe': 0 }, {
        '--wipe': 1, ease: 'none',
        scrollTrigger: { trigger: el, start: 'top 90%', end: 'top 55%', scrub: 0.4 }
      });
    });

    /* ---- Fleet podium: vehicles rise onto their blocks, centre first ------ */
    mm.add('(min-width: 760px)', function () {
      var stage = $('.fleet2__stage');
      if (!stage) return;
      /* The vehicle only clears the card title by ~19px, so the rise starts
         just below its resting spot — a bigger offset literally animates the
         vehicle across the heading. fromTo + immediateRender:false also means
         a trigger that never fires leaves the card in its correct static
         state instead of stranding the vehicle low and invisible. */
      gsap.fromTo($$('.fv__media', stage),
        { y: 16, autoAlpha: 0, scale: 0.965, transformOrigin: '50% 100%' },
        { y: 0, autoAlpha: 1, scale: 1, duration: 0.9, ease: 'power3.out',
          stagger: { each: 0.13, from: 'center' }, immediateRender: false,
          scrollTrigger: { trigger: stage, start: 'top 88%', once: true } });

      gsap.fromTo($$('.fv__panel', stage),
        { y: 34, autoAlpha: 0 },
        { y: 0, autoAlpha: 1, duration: 0.8, ease: 'power3.out', delay: 0.12,
          stagger: { each: 0.1, from: 'center' }, immediateRender: false,
          scrollTrigger: { trigger: stage, start: 'top 88%', once: true } });
      /* Slow parallax drift while the section crosses the viewport. This runs
         on the IMAGE, not on .fv__media: the wrapper owns the entrance tween,
         and two tweens writing one transform (plus a CSS transition on it)
         made the vehicle lag downward onto the card title. */
      $$('.fv__media img', stage).forEach(function (img) {
        gsap.fromTo(img, { yPercent: 2.5 }, {
          yPercent: -2.5, ease: 'none',
          scrollTrigger: { trigger: stage, start: 'top bottom', end: 'bottom top', scrub: 0.5 }
        });
      });
    });

    /* ---- LEGAL: a ring that fills, one step at a time --------------------
       Same mechanic as enigma.jetdomains.co.il: the arc's FIRST dash is
       stretched from 0 to the circumference, rather than sliding an offset.
       They pin with GSAP over 2000px; we hold the stage with CSS sticky
       because a GSAP pin shifts this RTL page by the scrollbar width. */
    (function () {
      var lg = $('.lg');
      if (!lg) return;
      var arc = $('.lg__arc', lg);
      var panels = $$('.lg__panel', lg);
      var dots = $$('.lg__dot', lg);
      if (!arc || !panels.length) return;

      var LEN = arc.getTotalLength();
      var current = -1;
      gsap.set(arc, { strokeDasharray: '0 ' + LEN });

      var ghost = $('#lg-ghost', lg);

      function show(i) {
        /* one numeral for the whole stage: inside the panels it inherited
           their transform as a containing block and drifted with panel
           height (measured 133px of jump between steps) */
        if (ghost) ghost.textContent = '0' + (i + 1);
        panels.forEach(function (p, n) {
          p.classList.toggle('is-on', n === i);
          if (n === i) { p.removeAttribute('aria-hidden'); }
          else { p.setAttribute('aria-hidden', 'true'); }
        });
        dots.forEach(function (d, n) {
          d.classList.toggle('is-active', n === i);
          d.classList.toggle('is-done', n < i);
        });
      }
      current = 0;
      show(0);

      /* ONE scroll-driven source of truth at every width. Per-step triggers
         were wrong here: all five panels sit stacked in the ring's centre, so
         they shared a trigger position and fired together. Driving index and
         arc off a single progress makes scrolling back up walk the steps
         backwards for free. */
      /* Below 1080px the stage is not pinned — the copy scrolls and the RING
         is the sticky element, so the run has to start when the circle lands
         in the middle of the screen, not when the section's top does. */
      var lgRing = $('.lg__ring', lg);
      var lgLoose = lgRing && window.matchMedia('(max-width: 1079px)').matches;
      ScrollTrigger.create({
        trigger: lgLoose ? lgRing : lg,
        start: lgLoose ? 'center center' : 'top top',
        endTrigger: lg, end: 'bottom bottom', scrub: true,
        invalidateOnRefresh: true,
        onUpdate: function (self) {
          var p = self.progress;
          gsap.set(arc, { strokeDasharray: (LEN * p) + ' ' + (LEN * (1 - p) + 0.1) });
          /* hold each step for an equal slice; the last one keeps the stage
             while the arc closes the circle */
          var i = Math.min(panels.length - 1, Math.floor(p * panels.length));
          if (i !== current) { current = i; show(i); }
        }
      });
    })();

    /* ---- COVERAGE: the country wakes up — arcs draw, comets ride, pins pop */
    (function () {
      var map = $('.cov__map');
      if (!map) return;
      var arcs = $$('.ilmap__arcs path', map);

      /* No entrance tween on the map itself: a ScrollTrigger that misses its
         start leaves the whole country hidden. The life comes from the routes
         below, which loop independently of scroll position. */

      /* each route draws itself, holds, then clears — a rolling dispatch loop */
      arcs.forEach(function (arc, i) {
        var len = arc.getTotalLength();
        gsap.set(arc, { strokeDasharray: len, strokeDashoffset: len });
        gsap.timeline({ repeat: -1, delay: i * 0.9, repeatDelay: arcs.length * 0.9 - 0.9 })
          .to(arc, { strokeDashoffset: 0, duration: 1.6, ease: 'power2.inOut' })
          .to(arc, { opacity: 0.14, duration: 0.9, ease: 'power1.in' }, '+=1.1')
          .set(arc, { strokeDashoffset: len, opacity: 0.9 });
      });

      /* couriers travelling the routes */
      if (window.MotionPathPlugin) {
        var svg = $('.ilmap', map);
        [0, 2, 4].forEach(function (idx, n) {
          var arc = arcs[idx];
          if (!arc || !svg) return;
          var comet = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          comet.setAttribute('r', '3.2');
          comet.setAttribute('class', 'ilmap__comet');
          svg.appendChild(comet);
          gsap.to(comet, {
            motionPath: { path: arc, alignOrigin: [0.5, 0.5] },
            duration: 2.6, delay: n * 1.4 + 0.8, repeat: -1, repeatDelay: 2.2,
            ease: 'power1.inOut'
          });
        });
      }

      /* live dispatch chips popping over the cities */
      var layer = $('#cov-events');
      if (layer) {
        var VB = { w: 300, h: 925 };
        var EV = [
          { x: 110.7, y: 297.1, t: 'חבילה נאספה — תל אביב', pick: true },
          { x: 153,   y: 127,   t: 'נמסר ✓ — חיפה' },
          { x: 197.3, y: 371.4, t: 'שליח בדרך — ירושלים', pick: true },
          { x: 126.8, y: 239.6, t: 'איסוף חדש — נתניה', pick: true },
          { x: 112.8, y: 496,   t: 'נמסר ✓ — באר שבע' }
        ];
        var tl = gsap.timeline({ repeat: -1 });
        EV.forEach(function (e) {
          var chip = document.createElement('span');
          chip.className = 'cov__event' + (e.pick ? ' cov__event--pick' : '');
          chip.style.insetInlineEnd = (e.x / VB.w * 100) + '%';
          chip.style.insetBlockStart = (e.y / VB.h * 100) + '%';
          chip.innerHTML = '<i></i>' + e.t;
          layer.appendChild(chip);
          tl.fromTo(chip,
            { opacity: 0, y: 8, scale: 0.85 },
            { opacity: 1, y: 0, scale: 1, duration: 0.45, ease: 'back.out(2)' })
            .to(chip, { opacity: 0, y: -8, duration: 0.4, ease: 'power2.in' }, '+=2.1');
        });
      }
    })();

    /* ---- HOW: pinned stage, the steps travel sideways as you scroll ------ */
    var hwSteps = $$('.hw__step');
    if (hwSteps.length) {
      var hwCount = $('.hw__count b');
      var hwReal = hwSteps.filter(function (s) { return !s.classList.contains('hw__step--cta'); });

      function hwFocus(i) {
        hwSteps.forEach(function (s, n) { s.classList.toggle('is-on', n === i); });
        if (hwCount && i < hwReal.length) hwCount.textContent = ('0' + (i + 1)).slice(-2);
      }

      /* Which card is actually in the spotlight? Measure it — deriving the
         index from scroll progress alone highlighted a card that had already
         slid off the edge. The spotlight sits toward the RTL start (right). */
      function hwFocusByPosition(vp) {
        var box = vp.getBoundingClientRect();
        var spot = box.left + box.width * 0.74;
        var best = -1, bestDist = Infinity, fallback = 0, fallbackDist = Infinity;
        hwSteps.forEach(function (s, n) {
          var r = s.getBoundingClientRect();
          var d = Math.abs((r.left + r.width / 2) - spot);
          /* how much of this card is actually on screen */
          var seen = Math.min(r.right, box.right) - Math.max(r.left, box.left);
          if (d < fallbackDist) { fallbackDist = d; fallback = n; }
          if (seen > r.width * 0.85 && d < bestDist) { bestDist = d; best = n; }
        });
        hwFocus(best > -1 ? best : fallback);
      }

      /* desktop: the sticky stage holds while the track slides. RTL — the
         track overflows to the LEFT, so a POSITIVE x pulls later steps in. */
      mm.add('(min-width: 1080px)', function () {
        var hw = $('.hw'), track = $('.hw__track'), vp = $('.hw__viewport');
        if (!hw || !track || !vp) return;

        var travel = function () { return Math.max(0, track.scrollWidth - vp.clientWidth); };

        var tl = gsap.timeline({
          scrollTrigger: {
            trigger: hw, start: 'top top', end: 'bottom bottom', scrub: 0.5,
            onUpdate: function () { hwFocusByPosition(vp); }
          }
        });
        tl.fromTo(track, { x: 0 }, { x: travel, ease: 'none' }, 0)
          .fromTo('.hw__rail-live', { scaleX: 0 }, { scaleX: 1, ease: 'none' }, 0);

        hwFocusByPosition(vp);
        return function () {                    // leaving the breakpoint
          gsap.set(track, { clearProps: 'x' });
          hwSteps.forEach(function (s) { s.classList.remove('is-on'); });
        };
      });

      /* below it: a normal vertical timeline that lights up step by step */
      mm.add('(max-width: 1079px)', function () {
        gsap.from(hwSteps, {
          y: 40, autoAlpha: 0, duration: 0.6, ease: 'power3.out', stagger: 0.12,
          scrollTrigger: { trigger: '.hw__steps', start: 'top 82%' }
        });
        hwSteps.forEach(function (step, i) {
          ScrollTrigger.create({
            trigger: step, start: 'top 70%',
            onEnter: function () { hwFocus(i); }
          });
        });
      });
    }

    /* ---- Ride rail: page progress as a delivery -------------------------- */
    var rail = $('#ride-rail'), railBox = $('#ride-rail-box');
    if (rail && railBox) {
      gsap.to(railBox, {
        y: 134, ease: 'none',
        scrollTrigger: {
          trigger: document.body, start: 'top top', end: 'bottom bottom', scrub: 0.4,
          onUpdate: function (st) { rail.classList.toggle('is-shown', st.progress > 0.04 && st.progress < 0.985); }
        }
      });
    }

    ScrollTrigger.refresh();

    /* Positions are measured before the hero film, fonts and lazy images
       settle, which left triggers pointing at stale offsets (vehicles that
       never animated in). Re-measure once everything has actually landed. */
    window.addEventListener('load', function () {
      ScrollTrigger.refresh();
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
      }
    });
  })();


  /* 05. CALCULATOR ======================================================== */
  var form = $('#calc-form');
  if (form) {
    var resultBox = $('#calc-result');
    var submitBtn = $('#calc-submit');
    var pickupEl = $('#pickup');
    var dropoffEl = $('#dropoff');
    var hasResult = false;
    var lastQuote = null;

    /* -- Address suggestions (combobox) ---------------------------------- */
    function attachSuggest(input, listEl) {
      var active = -1;

      function close() {
        listEl.classList.remove('is-open');
        listEl.innerHTML = '';
        input.setAttribute('aria-expanded', 'false');
        active = -1;
      }

      function tail() {
        // Only the text after the last comma is treated as the locality.
        var parts = input.value.split(',');
        return parts[parts.length - 1].trim();
      }

      function apply(city) {
        var parts = input.value.split(',');
        parts[parts.length - 1] = ' ' + city;
        input.value = parts.join(',').replace(/^\s+/, '');
        close();
        input.focus();
        if (hasResult) recalc();
      }

      function render() {
        var items = suggestCities(tail(), 6);
        if (!items.length) { close(); return; }
        listEl.innerHTML = items.map(function (c, i) {
          return '<li role="option" id="' + listEl.id + '-o' + i + '" aria-selected="false">' + c + '</li>';
        }).join('');
        listEl.classList.add('is-open');
        input.setAttribute('aria-expanded', 'true');
        active = -1;
        $$('li', listEl).forEach(function (li) {
          li.addEventListener('mousedown', function (e) { e.preventDefault(); apply(li.textContent); });
        });
      }

      function move(dir) {
        var items = $$('li', listEl);
        if (!items.length) return;
        active = (active + dir + items.length) % items.length;
        items.forEach(function (li, i) { li.setAttribute('aria-selected', String(i === active)); });
        input.setAttribute('aria-activedescendant', items[active].id);
      }

      input.addEventListener('input', render);
      input.addEventListener('focus', function () { if (input.value.trim()) render(); });
      input.addEventListener('blur', function () { setTimeout(close, 120); });
      input.addEventListener('keydown', function (e) {
        var items = $$('li', listEl);
        if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
        else if (e.key === 'Enter' && active > -1 && items[active]) { e.preventDefault(); apply(items[active].textContent); }
        else if (e.key === 'Escape') close();
      });
    }
    attachSuggest(pickupEl, $('#pickup-suggest'));
    attachSuggest(dropoffEl, $('#dropoff-suggest'));

    /* -- Errors ---------------------------------------------------------- */
    function setError(input, message) {
      var box = document.getElementById(input.id + '-err');
      var span = box ? $('span', box) : null;
      if (message) {
        input.setAttribute('aria-invalid', 'true');
        if (span) span.textContent = message;
        if (box) box.classList.add('is-shown');
      } else {
        input.removeAttribute('aria-invalid');
        if (box) box.classList.remove('is-shown');
      }
    }

    function readField(input) {
      var value = input.value.trim();
      if (!value) {
        setError(input, 'נא למלא כתובת — מספיק שם היישוב.');
        return null;
      }
      var city = findCity(value);
      if (!city) {
        setError(input, 'לא זיהינו את היישוב. הוסיפו שם עיר, למשל: תל אביב.');
        return null;
      }
      setError(input, '');
      return { text: value, city: city };
    }

    /* -- Pricing --------------------------------------------------------- */
    function quote() {
      var from = readField(pickupEl);
      var to = readField(dropoffEl);
      if (!from || !to) {
        (from ? dropoffEl : pickupEl).focus();
        return null;
      }

      var service = $('input[name="service"]:checked', form).value;
      var size = $('input[name="size"]:checked', form).value;
      var fragile = $('#fragile').checked;

      /* Legal delivery is priced per case — number of attempts, area, urgency —
         so the calculator must not invent a figure for it. It collects the
         same details and hands them to a human instead. */
      if (service === 'legal') {
        return { quoteOnly: 'legal', from: from.text, to: to.text, service: service,
                 size: size, fragile: fragile };
      }

      /* Pickup and drop-off in the SAME town. The client prices these per area
         and per job, so no package size and no service level produces a
         figure — it always goes to a person. */
      if (from.city.label === to.city.label) {
        return { quoteOnly: 'internal', from: from.text, to: to.text, service: service,
                 size: size, fragile: fragile, city: from.city.label };
      }

      var km = haversineKm(from.city, to.city) * ROAD_FACTOR;
      if (km < INTRA_CITY_KM) km = INTRA_CITY_KM;
      km = Math.round(km);

      /* The client's own price for this pair wins over any estimate. */
      var listed = zoneRate(from.city.label, to.city.label, size, service);

      /* fragile content needs a protected vehicle, so it upgrades the van
         rather than adding a surcharge */
      var vehicle = fragile ? 'car' : PRICING.sizeVehicle[size];
      var vehicleBase = PRICING.vehicleBase[vehicle];
      var inCity = km <= PRICING.inCityKm;
      var distanceCost = km * PRICING.perKm[service];

      /* No price he has quoted, and either end sits in the far north or the
         far south → a person prices it. */
      if (listed === null && (isEdgeCity(from.city) || isEdgeCity(to.city))) {
        return { quoteOnly: 'longHaul', from: from.text, to: to.text, service: service,
                 size: size, fragile: fragile, km: km,
                 fromCity: from.city.label, toCity: to.city.label };
      }

      var net, minApplied = false, listedPrice = false;
      if (listed !== null) {
        net = listed;                         // his rate card
        listedPrice = true;
      } else if (inCity) {
        net = vehicleBase;                    // one flat price inside a town
      } else {
        minApplied = distanceCost < vehicleBase;
        net = minApplied ? vehicleBase : distanceCost;
      }

      var vat = net * PRICING.vatRate;

      return {
        from: from.text, to: to.text,
        service: service, size: size, fragile: fragile,
        km: km, vehicle: vehicle, vehicleBase: vehicleBase, inCity: inCity,
        distanceCost: distanceCost, listedPrice: listedPrice,
        fromCity: from.city.label, toCity: to.city.label,
        minApplied: minApplied, net: net, vat: vat, total: net + vat
      };
    }

    /* -- Render ---------------------------------------------------------- */
    var priceBox = $('#r-price');
    var quoteBox = $('#r-quote');
    var waLabel = $('#r-wa-label');

    /* the two cases a human prices, and the words each one gets */
    var QUOTE_COPY = {
      legal: {
        title: 'מסירה משפטית',
        lead: 'מסירה משפטית מתומחרת לגופו של תיק — לפי מספר ההגעות הנדרשות, האזור ולוח הזמנים. לכן היא לא עוברת דרך המחשבון.',
        sub: 'שלחו לנו את פרטי המסירה ונחזור אליכם עם הצעת מחיר מסודרת.',
        cta: 'שלחו פרטים לקבלת הצעה'
      },
      longHaul: {
        title: 'משלוח לקצוות הארץ',
        lead: 'משלוחים בצפון הרחוק ובדרום הרחוק מתומחרים באופן אישי — זמינות השליח באזור, זמן הנסיעה ותנאי המסלול משתנים מיום ליום. לכן הם אינם עוברים דרך המחשבון.',
        sub: 'שלחו לנו את פרטי המשלוח ונחזור אליכם עם הצעת מחיר אישית תוך דקות.',
        cta: 'שלחו פרטים לקבלת הצעה'
      },
      internal: {
        title: 'משלוח פנימי בתוך העיר',
        lead: 'משלוח בתוך אותה עיר מתומחר לגופו של אזור — המרחק בין השכונות, הנגישות לחניה וזמן ההמתנה משנים אותו. לכן הוא לא עובר דרך המחשבון.',
        sub: 'שלחו לנו את הכתובות המדויקות ונחזור אליכם עם מחיר תוך דקות.',
        cta: 'שלחו כתובות לקבלת מחיר'
      }
    };

    function render(q) {
      lastQuote = q;

      if (q.quoteOnly) {
        var copy = QUOTE_COPY[q.quoteOnly];
        if (priceBox) priceBox.hidden = true;
        if (quoteBox) quoteBox.hidden = false;
        $('#r-quote-title').textContent = copy.title;
        $('#r-quote-lead').textContent = copy.lead;
        $('#r-quote-sub').textContent = copy.sub;
        if (waLabel) waLabel.textContent = copy.cta;

        var msg = q.quoteOnly === 'legal'
          /* deliberately formal — this one is read by a law office */
          ? 'שלום, התעניינתי בשירות מסירה משפטית מ-' + q.from +
            ' ל-' + q.to + '. אשמח לקבל הצעת מחיר ולתאם את פרטי המסירה. תודה.'
          : q.quoteOnly === 'longHaul'
            ? 'היי, אשמח להצעת מחיר למשלוח מ-' + q.from + ' ל-' + q.to +
              ' (' + q.km + ' ק"מ), חבילה ' + SIZE_NAMES[q.size] +
              (q.fragile ? ', תכולה שבירה' : '') + ', ' + SERVICE_NAMES[q.service] + '.'
            : 'היי, אשמח למחיר למשלוח פנימי בתוך ' + q.city +
              ' (' + q.from + ' → ' + q.to + '), חבילה ' + SIZE_NAMES[q.size] +
              (q.fragile ? ', תכולה שבירה' : '') + '.';
        $('#r-wa').href = 'https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(msg);
        resultBox.classList.add('is-open');
        hasResult = true;
        return;
      }

      if (priceBox) priceBox.hidden = false;
      if (quoteBox) quoteBox.hidden = true;
      if (waLabel) waLabel.textContent = 'הזמינו עכשיו בוואטסאפ';

      var veh = VEHICLE_NAMES[q.vehicle];
      var note = $('#r-note');

      if (q.listedPrice) {
        /* a real price from the client's rate card — say so, and do not dress
           it up with a distance breakdown it was not derived from */
        $('#r-service-label').textContent = SERVICE_NAMES[q.service] +
          ' — ' + q.fromCity + ' ← ' + q.toCity;
        $('#r-service').textContent = shekel(q.net);
        $('#r-distance-label').textContent = 'מרחק משוער';
        $('#r-distance').textContent = q.km + ' ק"מ';
        if (note) note.textContent = 'המחיר לפי מחירון החברה לאזור הזה, לפני תוספות. ' +
          'שעות לילה, סופי שבוע או דרישות מיוחדות עשויים לשנות אותו.';
      } else if (q.inCity) {
        /* inside a town it is one flat price, so there is no distance line to show */
        $('#r-service-label').textContent = 'משלוח פנימי בתוך העיר (' + veh + ')';
        $('#r-service').textContent = shekel(q.net);
        $('#r-distance-label').textContent = 'מרחק משוער';
        $('#r-distance').textContent = q.km + ' ק"מ';
      } else {
        $('#r-service-label').textContent = SERVICE_NAMES[q.service] + ' (' + veh + ')';
        $('#r-service').textContent = shekel(q.distanceCost);
        $('#r-distance-label').textContent = 'מרחק משוער';
        $('#r-distance').textContent = q.km + ' ק"מ';
      }
      if (!q.listedPrice && note) {
        note.textContent = 'המחיר הוא הערכה על בסיס מרחק הנסיעה. שעות לילה, ' +
          'סופי שבוע או דרישות מיוחדות עשויים לשנות אותו — לאישור סופי דברו איתנו.';
      }

      /* size is not a surcharge — it decides the vehicle, so say that plainly */
      $('#r-size-row').hidden = false;
      $('#r-size-label').textContent = 'גודל חבילה — ' + SIZE_NAMES[q.size];
      $('#r-size').textContent = veh;

      var fragileRow = $('#r-fragile-row');
      fragileRow.hidden = !q.fragile;
      if (q.fragile) $('#r-fragile').textContent = 'רכב מוגן';

      var minRow = $('#r-min-row');
      minRow.hidden = !q.minApplied;
      if (q.minApplied) $('#r-min').textContent = 'הושלם ל-' + shekel(q.vehicleBase);

      $('#r-net').textContent = shekel(q.net);
      $('#r-vat').textContent = shekel(q.vat);
      countTo($('#r-total'), q.total, 600, shekel);

      var msg = 'היי, בדקתי במחשבון באתר: ' + SERVICE_NAMES[q.service] +
        ' מ-' + q.from + ' ל-' + q.to +
        ' (חבילה ' + SIZE_NAMES[q.size] + (q.fragile ? ', תכולה שבירה' : '') + ')' +
        ' — הערכת מחיר ' + Math.round(q.total) + ' ₪ כולל מע"מ. אשמח להזמין משלוח 🚀';
      $('#r-wa').href = 'https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(msg);

      resultBox.classList.add('is-open');
      hasResult = true;
    }

    function recalc() {
      var q = quote();
      if (q) render(q);
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var q = quote();
      if (!q) return;

      // A short, honest "working" beat — the quote feels calculated, not canned.
      submitBtn.classList.add('is-loading');
      submitBtn.setAttribute('aria-busy', 'true');
      setTimeout(function () {
        submitBtn.classList.remove('is-loading');
        submitBtn.removeAttribute('aria-busy');
        render(q);
        if (window.matchMedia('(max-width: 979px)').matches) {
          resultBox.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
        }
      }, reduceMotion ? 0 : 420);
    });

    /* The button must not promise a price for the one service that has none. */
    function syncSubmitLabel() {
      var picked = $('input[name="service"]:checked', form);
      if (picked && picked.value === 'legal') {
        submitBtn.textContent = 'קבלו הצעה למסירה משפטית';
        return;
      }
      /* same town in both fields → this will be a quote, not a calculation */
      var a = findCity(pickupEl.value), b = findCity(dropoffEl.value);
      submitBtn.textContent = (a && b && a.label === b.label)
        ? 'קבלו מחיר למשלוח פנימי'
        : 'חשבו מחיר משלוח';
    }
    syncSubmitLabel();

    // Once a price is on screen, keep it in sync with every change.
    $$('input[name="service"], input[name="size"], #fragile', form).forEach(function (el) {
      el.addEventListener('change', function () {
        syncSubmitLabel();
        if (hasResult) recalc();
      });
    });
    var typeTimer;
    [pickupEl, dropoffEl].forEach(function (el) {
      el.addEventListener('input', function () {
        syncSubmitLabel();
        if (!hasResult) return;
        clearTimeout(typeTimer);
        typeTimer = setTimeout(recalc, 450);
      });
    });
  }


  /* 06. CALLBACK FORM ===================================================== */
  /* TODO: connect form endpoint. Until then this composes a mail draft so no
     lead is ever silently dropped. */
  var cb = $('#callback-form');
  if (cb) {
    cb.addEventListener('submit', function (e) {
      e.preventDefault();
      var status = $('#cb-status');
      var name = $('#cb-name').value.trim();
      var phone = $('#cb-phone').value.trim();
      var message = $('#cb-msg').value.trim();

      if (!name || !phone) {
        status.textContent = 'נא למלא שם וטלפון כדי שנוכל לחזור אליכם.';
        (!name ? $('#cb-name') : $('#cb-phone')).focus();
        return;
      }

      var body = 'שם: ' + name + '\nטלפון: ' + phone + '\n\n' + (message || '(ללא פירוט)');
      status.textContent = 'פותחים לכם חלון שליחה. אם זה לא נפתח — שלחו לנו הודעה בוואטסאפ.';
      window.location.href = 'mailto:info@rocket-delivery.co.il' +
        '?subject=' + encodeURIComponent('בקשה לחזרה מהאתר — ' + name) +
        '&body=' + encodeURIComponent(body);
    });
  }


  /* 07. WHATSAPP FLOAT, COOKIES & ANALYTICS =============================== */
  var waFloat = $('#wa-float');
  if (waFloat && !reduceMotion) {
    var pulses = 0;
    var pulse = setInterval(function () {
      waFloat.classList.add('is-pulsing');
      setTimeout(function () { waFloat.classList.remove('is-pulsing'); }, 1700);
      if (++pulses >= 3) clearInterval(pulse);      // three nudges, then quiet
    }, 8000);
  }

  var GA4_ID = '';   // TODO: GA4 ID from Amit — analytics stay off until it is set
  function loadAnalytics() {
    if (!GA4_ID) return;
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA4_ID;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', GA4_ID, { anonymize_ip: true });
  }

  var cookieBar = $('#cookie');
  if (cookieBar) {
    var KEY = 'rocket-consent';
    var saved = null;
    try { saved = localStorage.getItem(KEY); } catch (err) { /* private mode */ }

    if (saved === 'accepted') {
      loadAnalytics();
    } else if (saved !== 'declined') {
      setTimeout(function () { cookieBar.classList.add('is-shown'); }, 1200);
    }

    $$('[data-cookie]', cookieBar).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var accepted = btn.getAttribute('data-cookie') === 'accept';
        try { localStorage.setItem(KEY, accepted ? 'accepted' : 'declined'); } catch (err) {}
        cookieBar.classList.remove('is-shown');
        if (accepted) loadAnalytics();
      });
    });
  }

  /* 09. FLEET PODIUM ====================================================== */
  /* Functional layer, deliberately outside the GSAP gate: the carousel must
     work with reduced motion and without the cinematic stack. The cards
     themselves are plain WhatsApp links — no JS needed to order. */
  (function () {
    var stage = $('.fleet2__stage');
    if (!stage) return;
    var items = $$('.fv', stage);

    /* mobile: 3-position carousel — centre big, sides small + blurred */
    if (items.length !== 3) return;
    var mq = window.matchMedia('(max-width: 759px)');
    var dots = $$('.fleet2__dots i');
    var idx = 1;                      // start on the truck, the podium star
    var lock = false;

    function apply() {
      items.forEach(function (el, i) {
        el.classList.remove('is-center', 'is-left', 'is-right');
        if (!mq.matches) return;
        if (i === idx) el.classList.add('is-center');
        else if (i === (idx + 1) % 3) el.classList.add('is-left');
        else el.classList.add('is-right');
      });
      dots.forEach(function (d, i) { d.classList.toggle('on', mq.matches && i === idx); });
    }

    function go(step) {
      if (lock || !mq.matches) return;
      lock = true;
      idx = (idx + step + 3) % 3;
      apply();
      setTimeout(function () { lock = false; }, 660);
    }

    $$('.fleet2__arrow').forEach(function (btn) {
      btn.addEventListener('click', function () { go(parseInt(btn.getAttribute('data-dir'), 10)); });
    });

    /* tapping a side vehicle brings it to the centre instead of navigating */
    items.forEach(function (item, i) {
      item.addEventListener('click', function (e) {
        if (mq.matches && i !== idx) {
          e.preventDefault();
          e.stopImmediatePropagation();
          go(i === (idx + 1) % 3 ? 1 : -1);
        }
      }, true);
    });

    /* swipe — visual mapping: drag toward a side pulls that side's vehicle in */
    var x0 = null;
    stage.addEventListener('pointerdown', function (e) { x0 = e.clientX; }, { passive: true });
    stage.addEventListener('pointerup', function (e) {
      if (x0 === null) return;
      var dx = e.clientX - x0;
      x0 = null;
      if (Math.abs(dx) < 42) return;
      go(dx < 0 ? -1 : 1);           // drag left reveals the item on the left
    }, { passive: true });

    mq.addEventListener ? mq.addEventListener('change', apply) : mq.addListener(apply);
    apply();
  })();

  var yearEl = $('#year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();
})();
