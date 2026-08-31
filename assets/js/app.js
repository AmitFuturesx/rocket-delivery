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

  /* The estimate for pairs the client has NOT priced yet, fitted by least
     squares to the 35 city pairs his own rate card does cover. Each size gets
     its own base and they share a distance rate — that is what his numbers
     actually do, and it fits them better than a size multiplier.
     Worst case across his quoted routes is 18% (Modiin, which he prices
     unusually low for the distance); most land inside 3–8%.

     This mirrors the competitor's calculator on purpose — the client's
     instruction is that his price for a route must equal theirs. Their engine,
     read off their own JS bundle, is

         net = max(roadKm x perKm, 120)     // and a flat 120 at or under 12 km

     with perKm coming from the SERVICE only. Package size does not move their
     price at all: their two vehicle classes carry the same 120 floor and the
     size field only picks between them.

     Two deliberate departures, both on the client's instruction:
       - same-day and next-day cost the SAME here. Theirs charges MORE for
         next-day (5/km against 4/km); he charges the same-day rate for both.
       - size does move the price: medium is +10% on small, large is +10% on
         medium (so 1.21x small). That is his margin, laid on top of their
         number.

     Checked 2026-08-31 against their live calculator: Tel Aviv to Haifa,
     small, same-day returned 370 net + VAT = 437, i.e. 92.5 km x 4. Our table
     gives 92 km for that route, so we land inside half a percent. */
  var PRICING = {
    perKm:      4,       // same-day AND next-day — see note above
    minCharge:  120,
    inCityKm:   12,      // at or under this they bill the flat minimum
    sizeFactor: { small: 1, medium: 1.1, large: 1.21 },
    vatRate:    0.18
  };

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
  /* Superseded on 2026-08-31, when the client moved to matching the
     competitor's calculator instead. The data below is his own rate card,
     entered block by block from what he sent — it is kept, and kept correct,
     because re-entering eleven blocks would be a bad afternoon if he changes
     his mind again. Flip this to true to put it back in front of the
     distance model. */
  var USE_ZONE_RATES = false;

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
      to:   ['באר שבע', 'רהט', 'עומר', 'נבטים'],
      small: 370, medium: 400, large: 450,
      nextDayFactor: 1            // "מהיום למחר אותו מחיר"
    },
    {
      from: ['תל אביב'],
      to:   ['גני תקווה', 'סביון', 'אור יהודה', 'קריית אונו'],
      small: 130, medium: 140, large: 180
    },
    {
      from: ['תל אביב', 'חולון', 'ראשון לציון', 'נס ציונה', 'רחובות', 'הרצליה',
             'רמת השרון', 'פתח תקווה', 'בני ברק', 'רמת גן', 'גבעתיים',
             'באר יעקב', 'יהוד', 'סביון', 'אור יהודה', 'גנות', 'בית דגן',
             'צריפין', 'לוד', 'רמלה', 'פלמחים'],
      to:   ['ירושלים', 'מבשרת ציון', 'גבעת זאב', 'ביתר עילית'],
      small: 320, medium: 350, large: 400
    },
    {
      from: ['תל אביב', 'חולון', 'ראשון לציון', 'נס ציונה', 'רחובות', 'הרצליה',
             'רמת השרון', 'פתח תקווה', 'בני ברק', 'רמת גן', 'גבעתיים',
             'באר יעקב', 'יהוד', 'סביון', 'אור יהודה', 'גנות', 'בית דגן',
             'צריפין', 'לוד', 'רמלה', 'פלמחים'],
      to:   ['בית שמש', 'הר טוב', 'זכריה', 'זנוח', 'צרעה', 'מחסיה', 'אשתאול'],
      small: 250, medium: 275, large: 300
    },
    {
      from: ['תל אביב', 'חולון', 'ראשון לציון', 'נס ציונה', 'רחובות', 'הרצליה',
             'רמת השרון', 'פתח תקווה', 'בני ברק', 'רמת גן', 'גבעתיים',
             'באר יעקב', 'יהוד', 'סביון', 'אור יהודה', 'גנות', 'בית דגן',
             'צריפין', 'לוד', 'רמלה', 'פלמחים'],
      to:   ['מעלה אדומים', 'מישור אדומים', 'קדר'],
      small: 350, medium: 375, large: 400
    },
    {
      from: ['תל אביב', 'חולון', 'ראשון לציון', 'נס ציונה', 'רחובות', 'הרצליה',
             'רמת השרון', 'פתח תקווה', 'בני ברק', 'רמת גן', 'גבעתיים',
             'באר יעקב', 'יהוד', 'סביון', 'אור יהודה', 'גנות', 'בית דגן',
             'צריפין', 'לוד', 'רמלה', 'פלמחים'],
      to:   ['נתיב העשרה', 'שדרות', 'גבים', 'דורות', 'מפלסים', 'ברור חיל',
             'אור הנר', 'יד מרדכי', 'יכיני'],
      small: 300, medium: 330, large: 350
    },
    {
      from: ['תל אביב', 'חולון', 'ראשון לציון', 'נס ציונה', 'רחובות', 'הרצליה',
             'רמת השרון', 'פתח תקווה', 'בני ברק', 'רמת גן', 'גבעתיים',
             'באר יעקב', 'יהוד', 'סביון', 'אור יהודה', 'גנות', 'בית דגן',
             'צריפין', 'לוד', 'רמלה', 'פלמחים'],
      to:   ['בארי', 'נתיבות', 'כפר עזה', 'נחל עוז', 'רעים', 'תקומה',
             'מלילות', 'גבעולים', 'תדהר', 'אופקים', 'פטיש', 'רנן',
             'משמר הנגב', 'בית קמה', 'שובל', 'דביר'],
      small: 350, medium: 380, large: 410
    },
    {
      from: ['תל אביב', 'הרצליה', 'רמת השרון', 'הוד השרון', 'ראש העין',
             'נחשונים', 'בארות יצחק', 'מגשימים', 'יהוד', 'סביון',
             'קריית אונו', 'אור יהודה'],
      to:   ['פתח תקווה', 'גבעת שמואל'],
      small: 110, medium: 125, large: 150,
      nextDayFactor: 1            // "מהיום למחר אותו מחיר"
    },
    {
      from: ['רמלה', 'נס ציונה', 'לוד', 'באר יעקב'],
      to:   ['תל אביב', 'רמת גן', 'גבעתיים', 'פתח תקווה', 'גבעת שמואל',
             'קריית אונו', 'גני תקווה', 'סביון'],
      small: 130, medium: 150, large: 180,
      nextDayFactor: 1            // "מהיום למחר אותו מחיר"
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
  /* Off since 2026-08-31. The rule existed because he had no rates up north
     or down south; matching the competitor gave him a price for every pair in
     the country, so the reason for it is gone — and with it on, Haifa, the
     third-largest city in Israel, could not be quoted at all. Set to true to
     bring the hand-off back exactly as it was. */
  var QUOTE_EDGES_BY_HAND = false;

  var EDGE_NORTH_LAT = 32.60;
  var EDGE_SOUTH_LAT = 31.30;

  function isEdgeCity(city) {
    return QUOTE_EDGES_BY_HAND && !!city && typeof city.lat === 'number' &&
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
    ['הר טוב', 31.7583, 34.9833],
    ['זכריה', 31.7086, 34.9439],
    ['זנוח', 31.7150, 34.9639],
    ['צרעה', 31.7658, 34.9550],
    ['מחסיה', 31.7222, 34.9556],
    ['אשתאול', 31.7833, 35.0000],
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
    ['עומר', 31.2686, 34.8478],
    ['נבטים', 31.2167, 34.9333],
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
    ['נחשונים', 32.0656, 34.9425],
    ['בארות יצחק', 32.0203, 34.8975],
    ['מגשימים', 32.0464, 34.9106],
    ['גנות', 32.0167, 34.8167],
    ['צריפין', 31.9542, 34.8397],
    ['פלמחים', 31.9308, 34.7000],
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
    ['נתיבות', 31.4222, 34.5886],
    ['בארי', 31.4256, 34.4936],
    ['כפר עזה', 31.4831, 34.5347],
    ['נחל עוז', 31.4736, 34.4972],
    ['רעים', 31.3833, 34.4547],
    ['תקומה', 31.4269, 34.5581],
    ['מלילות', 31.4167, 34.5667],
    ['גבעולים', 31.4033, 34.5667],
    ['תדהר', 31.3925, 34.6403],
    ['פטיש', 31.3236, 34.5464],
    ['רנן', 31.3319, 34.5528],
    ['משמר הנגב', 31.3617, 34.7028],
    ['בית קמה', 31.3889, 34.7597],
    ['שובל', 31.3897, 34.7431],
    ['דביר', 31.4197, 34.7869],
    ['שדרות', 31.5250, 34.5964],
    ['נתיב העשרה', 31.5878, 34.4844],
    ['גבים', 31.5333, 34.5833],
    ['דורות', 31.5028, 34.6497],
    ['מפלסים', 31.5083, 34.5583],
    ['ברור חיל', 31.5461, 34.6086],
    ['אור הנר', 31.5544, 34.5833],
    ['יד מרדכי', 31.5936, 34.5556],
    ['יכיני', 31.4936, 34.6208],
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
    ['מישור אדומים', 31.8006, 35.3167],
    ['קדר', 31.7375, 35.3181],
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
    ['ראש פינה', 32.9694, 35.5417],
    ['יסוד המעלה', 33.0553, 35.5936],
    ['רמות', 32.7856, 35.6600],
    ['עין גב', 32.7778, 35.6389],
    ['שעל', 33.0006, 35.7539],
    ['בית הלל', 33.1922, 35.6136],
    ['מטולה', 33.2794, 35.5789],
    ['מג׳דל שמס', 33.2678, 35.7683, ['מגדל שמס', "מג'דל שמס"]],
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
    CITIES.forEach(function (c, ci) {
      var names = [c[0]].concat(c[3] || []);
      names.forEach(function (n) {
        list.push({ key: normalize(n), label: c[0], lat: c[1], lng: c[2], ci: ci });
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


  /* ── Road distance ──────────────────────────────────────────────────────
     A precomputed OSRM driving-distance matrix over CITIES, in CITIES order.
     Upper triangle only, whole km, base 36, two characters each: 159 towns,
     12,561 pairs, 25 KB.

     This replaces straight-line distance times a single fudge factor. That
     approach cannot be made to work here — the real road-to-air ratio across
     these towns runs from 1.11 (Beer Sheva to Tel Aviv, straight down the
     motorway) to 1.42 (Petah Tikva to Netanya, no direct road). Any one
     factor is therefore wrong by up to 15% at one end of the range or the
     other, and 15% of a long run is real money in both directions.

     Rebuild with tools/distances.mjs whenever CITIES changes — the index into
     this table IS the row's position in CITIES, so the two must stay in step. */
  var DIST_N = 159;
  var DIST =
    '1u2k0g0c150w2u060a061l0q0c1i1g1o1q1j1m1a0k0e1c112u2v0m0k0o132g2y3d0i042w3k20243d9c0d3s3n1w2k0l0l190s' +
    '3332350a0b0f0n0g0k0b0l0r0k4i3x2f2w2x2g1v1p1o1l1k1w0s10130p2d2g2a2d2n2h2f2h2p2y2z2l2g2g2b222020262421' +
    '1x1t292r3q5738140u0v0x0x130y1f170d0g0d0q0o0a1p2120271h0x0t0t14403v534e4w4c4o403z4x555d5r313j35392j2l' +
    '3i3u060m0r3o3032451g1n1s2n2e1s1m1q211d1p0v0u12110x0z0s1z22320y404118241a122a282e1u1t434r0i394i8g204x' +
    '4s1s3p1f1e1o1k48474a1n1o1j1n1h1i1j1b1p1o5n384741423l3g343a3e3c3128292c1u2s2w2p2s322w2v2s2x2y2z2h2b2b' +
    '272h2f2f2j2k2b2c282p2s2h4m3p2m2b2d2e2f1f181i1m1g1s1r1d1i1r080d0d0j0i251y212c5550685j615h5t4q4p626a6i' +
    '6w464o4a4e3o3q4n4z1r241c4t2i472w2n3o1r5c2k2r2m433h2t3u3s3z423v3x3q2d2b1e3d12143c27353e4x5f5v2a2m0d0x' +
    '4c170obu2d1q164e173b3f353j0d0c0e2u302x2p2v2r333f3h2l216f09070u0n0x1f1315151f2c211y2k555952555f595759' +
    '5k5l5m534x4y4t4u4s4s4y4w4t4p4l515e687p1w1t221w1w1w3p3k3w3z342t2s2v2p2v404c4b4i3t2a2j2f2m1g1a2t242m22' +
    '2d2e2d2q2v323g0k130p150h0e101i2m263g175i0n0i0u192i0f080d19090a14121b1c15180x0s0o1k0p32330a0s0e0w232l' +
    '310r0e343s1n2b3j900n3y3t1k2q05061f0f3a393b0d0b0c0o0c0g07050d0p4p3l2l32332n211v1u1u1s220z171a0w21251y' +
    '222b2524252d2m2n2923241z1q1o1o1v1t1p1l1h1y2g3e4v3f1a101214140k0g0w0v050j0f0j0o0e1b1s1s1y1b150z111c47' +
    '425a4l534j4u4746535c5j5x383q3c3g2q2s3o400e0t0b3v2o39190y2u070i091p0s0k1c1a1j1k1d1g180e0g160v2i2j0o0e' +
    '0i0x2g2x3d090a2l391x1r2z9f0e3e391z270n0n0x0v2q2p2r060c0c0a0b070f0n0t0b4540282i2j231n1m1g1g1f1i0k0s0v' +
    '0e2h2k2e2h2r2l2j2l2t32332o2j2j2e2624242a2825211x2d2v3t5a2v0w0n0o0q0q120y1i1b0f05040h0a061l1v1u211c0o' +
    '0j0k0u3n3i4q414j3z4b3n3m4k4s505e2o362s2w2628343h0a0f0t3b332p1y26160v140l0r0x1918151c1b18131k1g2b1a3t' +
    '3u111j111l1r292p1j153w4k1s334c8n1f4r4m0y3j0v0x280h4341441513171h181b100z101i5h393e3v3w3f2u2o2n2m2l2v' +
    '1r20231p1d1h1a1e1o1h1g1i1p1y1z1x1r1r1n1310101715110x0t1a1s314j48231t1v1w1w0i0q0h0a101c171f1h161n2324' +
    '29211y1s1u25504u635d5w5b5n4z4y5w656c6q404j45493j3k4h4t161l0u4n2b413n0v130y2e1j142c2a2i2l2e2g290o0m0j' +
    '1u23241f0m1h1w393q450q0x232l2v1d2ca50p2x2r2p1s1e1e1m1l21202213161a171612141e1k123n4q1k1v211l110v0t0r' +
    '0q100n0k0h10353932363g3a383a3i3r3s3e3939342v2t2s2z2x2u2q2m323k4j602h0a0i0d0c0c1v1r28201619151e18102j' +
    '2u2t302a0s0z0y193530483j413h3t3938424a4i4w262o2a2e1o1q2m2z0y0n1k2t3t272t2o2r1o2b2r1z1z1s1w211v233633' +
    '492h58592a3b2b2r0k070k312s5a5y2a4h5p6g31645z174w2h2e3l2c5g5f5h2r2p2q2u2p2p2l2d2r2v6v145f58594s4o4b4i' +
    '4l4k483f3g3k320w19151716130y0z0t0u0v0n0k0l0k161q1713171a1a1i150k1a2c5l3t3e3g3i3i20271p262i2z2y2k2p2s' +
    '2n333439363c35393j6d677g6q796o706d6b797i7p835d5w5i5m4w4x5u662s372e61075f0e021m0p0f1h1f1n1p1i1l180g0a' +
    '180z2r2s0l0h0n112e2v3b0e042u3h1z20389b093n3i1v2f0k0k140s2z2y3006090d0g0e0d0c0k0q0h4e3w2a2r2s2b1q1k1j' +
    '1j1h1r0n0w0z0l2e2i2b2e2o2i2g2i2q2z302k2f2f2a2321212725221y1u2a2s3p56340z0p0r0s0t120x1e180c0b080n0h03' +
    '1o201z261h0t0o0p0z3w3q4z494s474j3w3u4s51585m2w3f31352f2g3d3p020h0q3k2z2y0c1b0h031a181h1i1b1e140t0l1k' +
    '0v32330g0s0k0z2a2r370s0a353s1v2c3k960j3z3u1k2s0d0f1g0i3b3a3c0e0c0f0p0f0j060f0j0q4q3r2k33342o211v1t1r' +
    '1q2310181b0x232720232d2725272f2o2p2g2a2a261s1q1q1w1u1r1n1j1z2i3k523g1b121315150u0p150x090k0g0n0p0f1k' +
    '1x1w231e1710131d48435b4m544k4w4847555d5k5y393r3d3h2r2t3p420c0u0k3w2v3a1k0n0d1f1d1l1n1g1j160i0c1a0y2u' +
    '2u0j0i0l102d2u3a0i032w3k1y243c990b3r3m1t2k0i0j160q33323405070b0h0c0e0a0i0o0i4i3u2c2v2w2g1s1m1l1l1j1v' +
    '0p0y110n2c2g292c2m2g2e2g2o2x2y2i2d2d29211z1z2523201w1s282r3n5538110r0t0u0v100v1c160b0c090o0h041m1y1x' +
    '241f0w0q0s13403v534e4w4c4o403z4x555c5q313j35392j2l3h3u010j0p3o2y32121c1m1l1e1i1n1h1d1z1v2r1k494a1g1z' +
    '1f1w1a1y261y1l4b4z1x3i4q821u55500n3y151c2m0v4h4g4i1k1i1m1v1m1q1e1d1e1w5w2y3t494a3u383231312z39262e2h' +
    '230v0z0s0w16100y10181h1i1i1g1h1c0l0f0j0p0n0k0g0c0s1a2r3y4m2h27292b2b0w140k0m1f1q1m1o1v1l1w2c2d2i2a2d' +
    '26292j5e596h5s6a5q625e5d6a6j6q744f4x4j4n3x3z4v581l2014521t4g0j0v0u11140x0z0p120y1u0m3d3e0a120d0u1w2e' +
    '2t110p3g441e2m3u8t0x4944123207091q0a3l3k3m0n0l0m0z0p0p0h0b0j10503e2w3d3e2y2b2h2424232d191m1p171u1y1r' +
    '1v241y1x1y262f2g221x1x1s1j1h1h1o1m1i1e1a1r29374o3q1k1b1c1e1e0c070n0k0f0t0p0o0t0o181p1p1v171i1a1e1o4i' +
    '4d5l4w5e4u564i4h5f5n5u683j413n3r31333z4c0o1303462h3k1e1c1k1m1f1i170t0m1k0y35360j0s0m132d2u3a0r0b373v' +
    '1x2e3m990j413w1l2u0f0h1i0k3d3c3e0f0d0h0q0i0l090i0j0s4s3u2l35362q211v1u1r1q2510181b0z242821252e282729' +
    '2g2p2q2i2d2d291t1r1r1y1w1s1o1k212j3n553i1b111414150z0q170y0e0m0i0r0r0g1l2122271i1512111c4a455d4o564m' +
    '4y4a49575f5m603b3t3f3j2t2v3r440d0u0l3y2y3c02090b0507061o1r2r0n3p3q0w1t0w0v1l222i1j1i3s4g0l2y478h1p4m' +
    '4h123e140z23123x3w3z1c1d181b1617170z1e1d5c333w3q3r3a352t2z33312q1w1y211j1y2922262g2621222729291r1l1l' +
    '1h1t1y1u1t1x1r1w1r1x222w4d422a202223240x0p0x14131h1g12171g0q16171c151u1n1q214u4p5x585q565i4u4t5r5z67' +
    '6l3v4d3z433d3f4c4o1g1t0x4i263w080a0306041m1p2p0m3n3o0u1q0v0t1k222i1h1g3q4e0l2x458g1n4k4f113c130y2111' +
    '3w3v3x1a1b161a1515150x1c1b5b323v3o3p38342s2y31302o1v1w201i1x2821252f2520212628281q1k1k1g1s1x1t1s1w1p' +
    '1v1q1w212v4c41291z2022220v0o0w12121f1e10151e0p15161b141s1l1p1z4t4n5w565p555g4t4s5p5y656j3u4c3y423c3e' +
    '4a4m1e1r0w4h253v090b040c1u1x2y0u3v3w121y13111d1v2a1q1o3y4m0p364e8a1w4t4o0u3l1c162a134544461j1k1f1j1e' +
    '1e1e161l1k5j2v443x3y3h3d30363a392x2425281r1r211u1y281y1t1v2021221j1e1e191l1r1m1m1p1j1o1k1p1u2o454a2i' +
    '27292b2b0t0x0q0x1b1o1n191e1n0x1e1e1k1d211u1x28524w655f5y5d5p52505y676e6s424l474b3l3m4j4v1n20144q1y44' +
    '0d060e1w1z2z0v3y3y142114131i1z2f1r1q404o0m364f8e1x4u4p0z3m1d172b1b4644471k1l1g1k1e1f1f171m1l5k2z443y' +
    '3z3i3d31373b3a2y2526291s1v261z222c221y1z2425261o1i1i1e1q1v1r1q1u1n1s1o1t1z2s4a4b2j282a2c2c110y0y151c' +
    '1p1o1a1f1o0y1f1f1l1d221v1y29534x665g5z5e5q52515z686f6t434m484c3m3n4k4w1o21154q234409071p1s2s0p3r3r0x' +
    '1u0x0w1n242k1k1j3t4h0o2z488j1q4n4i143f161024143z3x401d1e191d171818101f1e5d343x3r3s3b362u3034332r1y1z' +
    '221l202b24272h272324292a2b1s1n1n1j1v201w1v1z1s1x1t1y242x4f442c212325250y0r0z15151i1h13181h0r18181e16' +
    '1v1o1r224w4q5z595s575j4v4u5s61686m3w4f41453f3g4d4p1h1u0z4j283x0a1s1v2v0r3t3u101w100z1g1y2d1n1m3w4k0m' +
    '324b8d1t4q4l0x3i191327154240431g1h1c1g1a1b1b131i1h5g2y403u3v3e392x3337362u2122251o1u241x212b211w1y23' +
    '24251m1h1h1c1o1u1p1p1s1m1r1n1s1x2r48472f242627280w0u0t0z181l1k161b1k0u1b1b1h191y1r1u254y4t625c5u5a5m' +
    '4y4x5v646b6p3z4i44483h3j4g4s1k1x114m21401k1i2n0k3m3n0p1p0q0s1o252l1f183o4c0o2v438k1g4i4d153a0x0t1z0w' +
    '3u3t3v161414181313100t161959363t3m3n36322q2w2z2y2m1t1v1y1g212721242e2924252a2b2c1u1o1o1k1w1r1r1w1v1t' +
    '1o1k20252y4g3z271x1y20200r0j0t0y0x1d1c0y13170n131419121q1j1n1x4r4l5u545n535e4r4q5n5w636h3s4a3w403a3c' +
    '484k171p0r4f293t090w17292a0y040t192s3a3p050j2c2z261i2q9o0c3530281x0y0y0y152h2g2i0k0m0n0j0m0i0p0x140e' +
    '3w491y292a1t1e1d17171519090h0k0b2r2v2o2s322v2u2w333f3g2x2s2s2n2h2e2e2l2j2f2b272o38425j2m0n0d0f0g0h1f' +
    '1a1r1l0q0j0i0p0j0h1u27252d1n0e0b0a0l3e384h3r4a3p413e3d4a4j4q542f2x2j2n1x1y2v370j0514323c2g111a2h2i0v' +
    '050v1b2o353l0b0c2k382a1r2z9k023e3925260u0u13112q2p2r0f0i0m0m0o0k0l0t100j4546242i2j221l1f1e1b1a1i0g0o' +
    '0r0j2n2r2k2o2x2r2q2r2z38392u2o2o2k2c2a2a2h2f2b27232k323z5g2v0u0i0k0l0l1b161n1h0m0l0h0t0n0d1y2a282g1q' +
    '0n0i0j0u3n3h4q404j3z4a3n3m4j4s4z5d2o362s2w2628343g0c0a103b392p291i1j1q0v1l2b3u4c4r0y1b1k273a0r1yas15' +
    '2e293d161p1q231x1n1m1o1b1e1i1n1e1a1h1p1v1j355d141h1j130k090d0c0b0g0v0s0p183j3n3g3j3t3n3l3n3v4445423w' +
    '3w3s3836363c3a37332z3f3x566o1v0h0q0l0k0k27222v2d1i1g1d1u1n182z3b3a3h2s18171d1k2n2i3q313j2z3b2n2m3k3s' +
    '3z4d1o261s1w1618242h1a0u1w2b4h1p38390g1c0i09222k2z11103b3z162h3p8z19443z1j2x0o0n1l0w3g3f3h0u0v0q0u0p' +
    '0p0s0k0x0v4v3k3f38392t2o2c2i2m2k281f1h1k122b2f282b2l2f2d2f2p2q2r2823231y201y1y20221u1v1r272j3d4u3l1t' +
    '1j1k1m1m0u0q10150p100y0k0p0y0u15141b0l1c15191j4d485g4r594p514d4c595i5p633e3w3i3m2w2y3u470y1b0l412n3f' +
    '02372c303a4t5a5q2d2t0r1d480u14bk2n0v1e4a0d373b303f0y0y0z2q2w2t2k2r2n2z3b3d2g1o6b190y090r1a1c1g1n1m1a' +
    '281x1u2g50544x515b5553555f5h5h4z4t4u4p4q4o4o4u4s4p4l4h4x5a647l121w232524213l3g3s3v2z2p2o2r2l2q3w4847' +
    '4e3p262f2a2h1s1n271i201g1s1k1j21292g2u0m150x091416190y2t2b3c1g5e0m382d313b4u5b5r2e2u0r1c480v13bl2o0t' +
    '1d4b0e383c313g0x0x0y2r2x2t2l2s2o303c3e2h1m6c1b100b0u1c1d1j1p1p1b291y1v2h51554y525c5654565g5h5i504u4u' +
    '4q4r4o4o4v4t4p4m4h4y5b647m131x242625223m3h3t3w302q2p2s2m2r3x49484f3q262g2b2i1r1m251g1y1e1p1i1h1y272e' +
    '2s0l130w071718180v2u2c3d1f5f0l0y050p1v2e2s0u0k3a3y1e2g3o8r0t433y1b2w09051k0l3f3e3g0j0h0h0t0i0i0d050k' +
    '0v4u3c2r37382s272b20201y27151g1j11282c25292j2d2b2d2h2i2j201v1v1r1y1v1v1u201o1t1o252c354n3k1g1618191a' +
    '0i0d0u0s0a0p0l0h0m0j121j1j1p141c14181j4c475f4q584o504c4b595h5p633d3v3h3l2v2x3t460j0z09402g3e0t1d2w3e' +
    '3u060j2f332b1o2w9t083b362d230x0y13152n2m2o0j0m0q0n0m0i0p0x130j414e1y2f2g1z1e181716151f0b0j0n0g2r2v2o' +
    '2r312v2t2v333c3d322w2x2s2g2e2e2k2i2f2b272n36475o2s0m0d0e0g0g1f1a1v1l0q0o0l0u0o0g1z2b2a2h1s0i0f0g0r3k' +
    '3e4n3x4g3v473k3i4g4p4w5a2k332p2t2324313d0i0414383h2m0j1w2d2t0p0o333r1g293i8t0u3x3s1d2p0f091e0o38373a' +
    '0i0j0e0m0c0d0h090p0o4n3e2n31322l23241w1w1u2110191c0u262a23262g2a292a2j2k2l221x1x1s1v1t1t1v1y1p1q1m22' +
    '2d374o3d1l121415160l0h0v0v0d0k0i0b0g0m151i1g1o0y150y0z1a4540584j514h4t4544525a5i5w363o3a3e2o2q3n3z0m' +
    '0v0c3t2h372d2u3a13123d401h2j3r991b46411u2z0w0t1n163i3h3j0w0x0s0w0r0r0w0t150x4x3v3h3a3b2v2q2e2k2o2m2a' +
    '1h1j1m142m2q2j2n2x2r2p2r2z30312j2d2d292c29292c2e2627232j2u3n553n1v1l1m1o1o140z1c1g0t12100m0r10121918' +
    '1f0p1e171b1l4f4a5i4t5b4r524f4e5b5k5r653g3y3k3o2y303w48101d0v432y3h0n132n2e4w5j1w425b712m5q5l0s4i231z' +
    '371x5150532c2a2c2f2a2b271z2c2h6g1n504u4v4e493x4347453u3032352n0r141012130z0u0v0r0s0s0a0103080t1b0u0m' +
    '0x0t0v130q0l1i2x563e303233331l1s1b1s232l2k252b2d282o2p2u2s2y2r2u355y5t716c6u6a6m5y5x6v737b7p4z5h5357' +
    '4h4j5g5s2d2s205m0q500k342v5d612d4j5s6j336762194z2k2g3o2e5i5h5k2u2r2t2x2r2s2o2g2u2y6x145h5b5c4v4q4e4k' +
    '4o4m4b3i3j3m34131g1c1e1d1a15161011120u0n0n0n1c1v1e161e1d1f1n190r152f5n3w3h3j3k3l22291s292l32312n2s2u' +
    '2p2m2u2s393f383b3m6f6a7i6t7b6r736f6e7c7k7s865g5y5k5o4y505x692u3a2h630b5h3k3b5t6h2t4z686d3j6m6h1p5f30' +
    '2w432u5y5x5z3937383c3737342w393e7d0q5x5q5r5b564u5054524q3x3z423k1e1q1n1o1o1l1g1h1b1c1d141213131o281p' +
    '1l1p1s1s201n120y2m634b3x3z40402i2p282p303i3h32383a352s302y3o3v3n3r426v6q7y797r777j6v6u7s80888m5w6e60' +
    '645e5g6c6p3a3p2x6j0k5x0h2g34231m2v9l0d3a3425220x0x0w152l2k2m0g0m0j0g0i0e0p0x130c4046202e2e1y1f191818' +
    '171d0c0l0o0d2q2u2n2r312v2t2v333c3d2u2p2p2k2g2d2d2k2i2e2b262n363z5g2q0o0f0g0i0i19141o1l0p0f0d0n0g0d1r' +
    '24232a1k0j0e0f0p3i3d4l3w4e3u463i3h4f4n4v592j312n2r21232z3c0i071036392k2w3k20223b9b0a3q3l1v2i0k0k160s' +
    '31303307080c0j0d0g0b0k0q0k4g3w2e2u2v2e1s1m1l1k1j1u0q0y110n2c2g292d2n2h2f2h2p2y2y2k2f2f2a221z1z262420' +
    '1x1s292r3p5636110s0t0v0v110x1e170d0e090q0j051o211z271h0v0q0r123y3t514c4u4a4m3y3x4v535b5p2z3h33372h2j' +
    '3g3s030k0q3m2z300p4a150gbs2q1b0u4c133a3e333h0706082s2y2v2n2u2q313d3g2j1q6d0k0e0t0l131e1a1g1g1d2b201w' +
    '2i535750545e5756585i5j5k514w4w4s4t4q4q4x4v4r4n4j505d667o1s1y252827243n3j3v3x322s2q2u2n2t3z4b4a4h3r28' +
    '2h2d2k17122i1s2b1q22201z2f2k2r35080r0d0s0r0o0p162v2d3e0w5h0c4y1t0acg3e1w0v501o3y413r450l0m0l3g3m3j3b' +
    '3i3e3p4143371i71140z1h191r221y1z1y212z2o2k365r5v5o5r615v5u5v6667685p5k5k5f5g5e5e5l5j5f5b575o606u8b2d' +
    '2m2t2v2v2s4b474j4l3q3f3e3h3b3h4m4z4x554f2w3531380j0e221s2b1r222e2c2f242c350t0x0r1e1d1a0i1a3j31420w64' +
    '0w3g4o8s27534y1d3w1l1h251k4f4e4g1u1t1p1t1o1o1o1h1v1u5u304d47483s3n3a3g3k3j372e2g2j21292k2d2g2q2h2c2d' +
    '2i2j2k221w1w1s2429252428212622272d294o3o2s2i2k2l2l1f171c1j1l1z1x1j1p1x0l0r0z0w0w2c24282j5c576f5q685o' +
    '605c5b696h6p734d4v4h4l3v3x4t561x2a1f502h4e1kay1s1n1u3j0j2g2k292o1a191c1z24211t201x292k2m1o2f5j1e120u' +
    '0q0x0k0q0y0x0j1i17141q4b4f484b4l4f4e4f4q4r4s4944443z403y3y44433z3v3r474k5e6v17161d1f1e1b2v2q33352a1z' +
    '1y211v21363j3h3p2z1g1p1l1s27222y292r272j1z1y2s30383m181q1c1217181p1p231l2m1v4o19c7311m0m4r1f3p3t3h3w' +
    '0c0d0c373d393138353g3s3v2x1h6r0v0q17101i1t1o1q1p1s2q2f2b2x5i5m5f5j5s5m5l5m5x5y5z5g5b5b565755555c5a56' +
    '524y5f5s6l82242d2k2m2m2j423y4a4c3h36353932384d4q4p4w462n2w2s2z0s0n2a1k231i1u2524272c2j2x0k0p0j151411' +
    '0g123a2s3t0o5v0n9ibjch7ob98y8va38tbxbwbz9996979b9697938v989dcg5rbvbpbjbab5asayb2b1aq9w9ya19j7a7e7j7l' +
    '767h7d7e786y71717272727l847m7l7l7s7p7w7j6z6146avaa9w9y9za08h8o878o8z9h9g929799948e8a8l9o9u9n9qa1cucp' +
    'dbcmcockcwbvbucpdddkdqbvcdbzc3bdbfccco999o8wci6ebw3g3b23280s0s110z2s2r2t0e0g0k0k0m0i0j0r0y0h4643262k' +
    '2l241m1g1f1b1b1k0k0t0w0i2l2p2i2m2w2p2o2q2x36372s2m2m2i2b28282f2d2925212i303x5e2x0w0m0o0p0q19141l1f0k' +
    '0j0f0r0l0b1w28262e1o0p0k0l0w3p3j4s424l404c3p3n4l4u515f2p382u2y2829363i0a0e0y3d372r13561643473w4b1g1g' +
    '1h3m3s3o3g3n3j3v47493c0z761w1l141f1x27232a2927342t2q3c5x615u5x67615z616c6d6d5v5p5q5l5m5k5k5q5o5l5h5d' +
    '5t66708h132s2z31302x4h4c4o4r3v3l3k3n3h3n4s4h4d4o4l323b373e1c251j0u140s140q0p161l1s2614111f0n1r1t1e0j' +
    '3p3748176a14511p3y423r460v0w0v3h3n3j3b3i3e3q4244370x711d171h1a1s221y2524222z2o2l375s5w5p5s625w5u5w67' +
    '68695q5k5l5g5h5f5f5l5j5g5c585o616v8c2e2n2u2w2v2s4c474j4m3q3g3f3i3c3i4n4z4y554g2x3632390n0z1q101j0y1a' +
    '1l1k1n1s1z2d0s0d0o161n1g0d0i3k324304650v3z161g2n124i4h4j1t1q1r1w1q1r1n1g1n1x5x294f4a4b3v3q3d3j3n3l3a' +
    '2h2j2m24171b14181i1d1a1b1e1f1g0y0s0s0o0v100w0y0z0t0y0u0z19223k4n2v2h2i2k2k0t110i0z1k22201m1s1u1p2526' +
    '2b282f272b2l5f5a6i5t6b5r635f5e6c6k6r754g4y4k4o3y404w591u2914531d4h2w302p3418191a2f2k2h282f2c2o303224' +
    '1y5z1e130d0s1710161e1d0z1x1m1j254q4t4m4q504u4s4u5456564o4i4j4e4f4d4d4j4h4e4a464m4z5t7a0r1l1s1u1t1q3a' +
    '353h3k2o2e2d2g2a2g3l3x3w433e1v242027231y2h1s2a1q221i1h2b2j2r350y1f180l12141l182i20311r530x051l0a3f3e' +
    '3g0i0f0g0t0h0l0c070d0u4u3j2r37382s26201z1z1y27141c1f111v1z1s1w251z1y20272g2h2721221x1l1i1i1p1n1j1f1b' +
    '1s2a3c4t3k1f161719190f0b0r0l0a0o0k0p0u0j191q1q1w181b15171h4c475f4q584o504c4b595h5p633d3v3h3l2v2x3t46' +
    '0j0y06402m3e1l0f3j3i3k0i0f0g0y0h0l0c020f0z4y3g2r3b3c2w2721201z1y2c141c1g11242821252f2927292g2n2n251z' +
    '201v1u1r1r1y1w1s1p1k212g3a4r3p1f161719190n0i0y0q090p0k0l0q0j191p1q1v171g19171h4h4b5k4u5d4s544g4f5d5m' +
    '5t673h403m3q30313y4a0j0y09442k3i1s383739111a160u15111d1l1r0p4n4n3630312l2g23292d2c2017191c0n3f3j3c3f' +
    '3p3j3h3j3r3v3w3d3738333432323836332z2v3b3o4i5z2p1l1a1b1d1d1z1u26291d1312140y111r1s1o1y1l140u0y0m4540' +
    '584j514h4t4544515a5h5v363o3a3e2o2q3m3z16121q3t3s373n3m3o0q0o0r110s0w0k0h0k12523e2z3f3g302e282727252f' +
    '1c1k1n191n1r1k1o1y1r1q1s1z2829221w1x1s1d1a1a1h1f1b17131k22374o3s1n1e1f1h1h0e0d0n0d0l0w0s0z110r1f1w1w' +
    '221l1j1c1f1p4k4f5n4y5g4w584k4j5h5p5w6a3l433p3t3335414e0r160c482h3m03022y34302s2z2v373j3l2n1q6i0k0f0y' +
    '0r191j1f1e1e1j2g25222n585c55595j5d5b5d5n5o5p5751514x4y4v4v52504w4t4o555i6b7t1x232b2625293t3o4043372x' +
    '2w2z2t2y444g4f4m3x2d2n2i2p140y2i1t2b1r2325242f2k2r350c0v0h0y0s0q0o1a312j3k0x5m0g042x322z2r2y2u363i3k' +
    '2m1r6h0j0d0x0q181i1e1d1d1i2f24212n585c55585i5c5a5c5n5o5p5650514w4x4v4v514z4w4s4o545h6b7s1y232a252428' +
    '3s3n3z42372w2v2y2s2y434g4e4m3w2d2m2i2p140z2j1t2c1r2326252g2l2s360d0w0i0y0s0p0p1b302i3j0x5l0g2z35312t' +
    '302w383k3m2p1q6j0l0g0z0s1a1k1g1g1f1k2h26232p5a5e575a5k5e5c5e5p5q5r5852534y4z4x4x53514y4u4q565j6d7u1y' +
    '252c27262a3u3p4144382y2x302u30454h4g4n3y2f2o2k2r150z2j1u2c1s2426252h2l2t370e0x0j0z0u0r0p1c322k3l0y5n' +
    '0h05050c07090b0i0o0d4d3t2c2q2r2b1s1t1l1l1j1q0q0z120j2d2h2a2d2n2h2f2h2p2y2z2j2e2e292220202624211x1t29' +
    '2r3o5533110r0t0v0v110w1d170b07020j0c041i1v1t211b0v0n0r113v3q4y494r474j3v3u4s50585m2w3e30342e2g3c3p06' +
    '0k0p3j2y2x050h060a080f0m0j4i3r2g2w2x2g1v1p1o1o1n1w0t11150q2a2e272b2l2e2d2f2m2v2w2f2a2a25201x1x24221y' +
    '1u1q272p3k5139140v0x0y0y0y0t1914070a060g0i081h1t1s1z1a100t0w16403v544e4w4c4o403z4x565d5r313k363a2j2l' +
    '3i3u080n0p3o2u320e03060b0g0q0f4f3s2j2s2t2d1z1v1s1r1q1s0t11140n2d2h2a2e2o2h2g2i2p2y2z2g2b2b2723202027' +
    '25211x1t2a2s3l5335170y1011110x0s1a180809070d0e0b1d1q1p1w160x0p0s133x3s504b4t494l3x3w4u52595n2y3g3236' +
    '2g2i3e3r0b0q0o3l2w2z0d0a0l0t1006473w2q2k2l25201n1t1x1w1k0r0t0w0b2n2r2k2o2x2r2q2r2z33342m2g2g2c2c2a2a' +
    '2h2f2b27232k2x3q582x150v0w0y0y18131f1h0m0b0a0b050d1j1v1u211c0o0h0l0v3p3k4s434l414c3p3o4l4u515f2q382u' +
    '2y282a363i0h0n0y3d312r050c0h0r0e4e3r2f2r2s2c1v1u1o1o1m1r0s10130m2f2j2c2g2q2k2i2k2r2x2y2f2a2a25252222' +
    '292723201v2c2q3k5134140u0w0y0y0w0r191a0a0c090c0d0e1c1p1n1v150v0o0r123w3r4z4a4s484j3w3v4s51585m2x3f31' +
    '352f2h3d3p0d0n0n3k2u2y0g0l0u0b4b3r2c2n2p281s1q1k1k1j1o0p0w100j2i2m2f2i2s2m2l2m2u2y2z2g2b2b262725252c' +
    '2a26221y2f2r3l5231110r0t0u0v0x0s1a1c0d09080d0a0b1d1q1o1w160s0l0o0z3t3n4w464p444g3t3r4p4y555j2t3c2y32' +
    '2c2d3a3m0e0k0o3h2v2v0c0i0m4n3n2j2z302k1y1s1r1r1q200x15180u262a23262g2a292a2i2r2s2c2727221v1t1t201y1u' +
    '1q1m232l3h4y3d180y1011120v0q1610050h0d0j0m0b1e1u1t201b130x0z1a453z584i514g4s4544515a5h5v353o3a3e2o2p' +
    '3m3y0b0r0m3t2r370h0v4y3g2r3b3c2w26201z1z1y2c141c1f11262a23272g2a292a2i2m2n251z1z1v1v1t1t201y1u1q1m23' +
    '2g3a4r3o1f161719190n0j0y0s090o0k0l0q0j171n1o1t181g19171h4g4b5j4u5c4s544g4f5d5l5t673h3z3l3p2z313y4a0j' +
    '0y0b442k3i11503t2x3d3e2y2d272525242e1a1j1m18262a23272h2b292b2j2s2s2h2c2c271w1t1t201y1u1r1m232l3m533r' +
    '1m1c1e1f1g0u0p150v0j0v0q0x100p1k2020261i1h1b1d1o4j4d5m4w5f4u564i4h5f5o5v693j423o3s3233404c0p140j462w' +
    '3k423x2m2g2h201v1j1p1t1r1g0m0o0r062o2s2l2p2z2s2r2t3034352n2h2h2d2e2b2b2i2g2c29242l2y3s592s100p0r0s0t' +
    '19141g1j0n0d0b0d060e1k1w1v221d0k0b0f0q3k3f4n3y4g3w483k3j4h4p4x5b2l332p2t2325323e0i0i1038322m7x28221x' +
    '272o2y2t30302x3w3l3i446p6t6m6p6z6t6r6t7475766n6i6i6d6e6c6c6i6g6d69656l6y7s99213k3r3t3s3p59545g5j4o4d' +
    '4c4f494f5k5x5v635d3u433z46101e120d0v0a0m1a1914141b1p1n141j1f2k2b190r4h3z5012721q6g6a6b5v5q5e5k5o5m5a' +
    '4h4j4m441y2a2728282520211v1w1x1o1m1n1n282s2925292c2c2k271m191y6n4v4h4i4k4k32392s393k42403m3s3u3b3h3o' +
    '3m3m4f474b4m7f7a8i7t8b7r837f7e8c8k8r956g6y6k6o5y606w793u493h73146h0e110u0p120v0y0x1b1w1u1q2l4k4o4h4l' +
    '4v4p4n4p4w5656544z4z4v4a47474e4c4845404h4z697r231j1r1m1l1m38343y3f2j2v2e2x2q2a424e4d4k3v2b2l2g2n1n1h' +
    '302a2t292k2l2k2x32393n0r1a0v1c0n0k171o2c1w2x1e5k0u0q0j111b1718181b281x1u2g50544x515b5553555f5h5h4z4t' +
    '4t4p4q4n4n4u4s4p4l4h4x5a647l1s1w232524213l3g3s3v2z2p2o2r2l2q3w48474e3p262f2a2h1h1c2u242n222e2a292r2w' +
    '333h0l130p130g0e121i2t2b3c185e0m0k121d181f1e1c2a1z1v2h52564z525c5655565h5i5j504v4v4q4r4p4p4w4u4q4m4i' +
    '4z5b657m111x242626233m3i3u3w312q2p2s2m2s3x4a484g3q272g2c2j1v1p2g1r291p211q1p292i2p330m0z100i0x0y1c17' +
    '2u2c3d1j5f0l0m0w0r0y0y0v1t1i1f214l4p4i4m4w4q4o4q5052524k4e4f4a4b49494f4d4a46424i4v5p761g1h1o1q1p1m36' +
    '313d3g2k2a292c262c3h3t3s3z3a1r201w221o1j2r222k202c24232k2t303e0p170t0x0g0i151h2e1w2x1c4z0q0d070e0b0n' +
    '1c1a161p40443x414a4443444c4l4m4j4d4e493p3n3n3u3s3o3k3g3x4f5o751w0z171211122o2j3c2u1z1y1u2b251p3g3s3r' +
    '3y391q1p1u212621392k322i2u2m2l323b3i3w171p1b1f0p0r1n201s1c2d1u4y18070c0b0a1b100x1i3u3y3r3v453y3x3z46' +
    '4j4k423w3w3s3k3h3h3o3m3i3e3a3r4d566o1p0t110w0v0w2o2j2v2o1t1s1r1u1o1k2z3b3a3h2s181i1d1k2h2b3k2u3d2s34' +
    '2g2f3d3m3t471h201m1q10111y2a1m162f254h1j07050g15120z1i3t3x3q3t433x3v3x454e4f4842423y3i3g3g3m3l3h3d39' +
    '3p485d6u1v0r100v0u0u2h2c312n1s1r1n201u1i353h3g3n2y1f1h1j1q2c263f2p382n2z2s2r383h3o421c1v1h1l0v0w1t25' +
    '1k1426204n1e030o15120z1i3t3x3q3t433x3v3x454e4f4c4646423i3g3g3m3l3h3d393p485g6y230r100v0u0u2h2c352n1s' +
    '1r1n241y1i393l3k3r321i1h1n1u2j2d3m2w3f2u362z2x3f3o3v491j221o1s1213202c1k1426264r1k0n13110y1h3r3v3o3s' +
    '423w3u3w444d4e4a4545403h3e3e3l3j3g3c383o465f6w210q0z0t0t0t2f2b342m1q1p1m231w1h373k3j3q301h1g1m1t2i2d' +
    '3l2w3e2u362y2x3e3n3u481j211n1r11131z2c1j1324264p1k1a0z0v1h42463z434d4745474h4i4j413v3v3r3s3p3p3w3u3q' +
    '3n3i3z4c556n1o0x151111132n2i2u2x211r1p1t1m1s2y3a393g2r171h1c1j2g2a3j2t3c2r332f2e3c3l3s461g1z1l1p0z10' +
    '1x291u1d2e234g1h080c0k2y312v2y383230323a3j3k3630302w2m2l2l2r2q2m2i2e2u3c4a5s2l0e050c0e0a1l1h1z1s0x0w' +
    '0s0y0s0n232f2e2l1w070j0f0m3d374g3q493o403d3b494i4p532d2w2i2m1w1x2u360q0a1b313l2f040m363a33363g3a393a' +
    '3i3p3q3832322x2u2t2t302y2v2q2m323j4c5t2a0c0d0l0h0g1t1p2121150y0x100u0w252h2g2n1y090l0i0p322x453g3y3e' +
    '3q32313z474f4t232l272b1l1n2k2w0y0i1l2q3n240p393d363a3j3d3c3d3l3s3t3b3535302x2w2w33312x2t2p363m4f5w27' +
    '090g0i0e0d1x1s2424181110130x0z282k2j2q210c0o0k0r2z2t423c3v3a3m2z2x3v444b4p1z2i24281i1j2g2s110l1o2n3q' +
    '212v2z2s2v352z2x2z373b3c2t2n2n2j2j2i2i2o2n2j2f2b2r343x5f2t100o0p0r0r1f1a1m1p0u0j0i0i0c0h1q2321291j0i' +
    '070e0o3l3g4o3z4h3x493l3k4i4q4y5c2m342q2u2426323f0m0g1639382n0e0b0c0l0703050f0o0p0l0s0q0o0d0x0f0k0e0g' +
    '0i0p0c0i24355e382z3032331o1w1b1e272i2e2f2n2c2n33343931342y303b68627b6l746k6v6867747d7k7y595r5d5h4r4t' +
    '5p612c2s1w5w115a090a080d0g0j0s0l0o0y1513110h110i0o0c0k0l0t0o0u2g395h3c333436371s201e1h2a2m2i2j2r2g2r' +
    '37383d353832343f6c667f6p786n6z6c6a787h7o825c5v5h5l4v4w5t652g2w20601e5e050f090c0f0o0s0v0u110z0y0a0u0c' +
    '0h050d0f0m0g0r2d3e5b352w2x2z301l1t181b242f2b2c2k292k3031362y312v2x38655z786i716h6s6564717a7h7v565o5a' +
    '5e4o4q5m5y292p1t5t1a570h0b0e0h0q0u0x0w13110z0e0y0f0l090h0i0q0j0t2e3g5e39303033331o1x1b1e272j2e2g2o2d' +
    '2n34343a32352z313b68637b6m746k6w6867757d7l7z595r5d5h4r4t5q622d2s1w5w1c5a0j0m0p0y0d0g0w1211190o170p0v' +
    '0j0r0s0z0u0l2e315o3j3a3a3d3d1y261l1o2h2s2o2p2y2n2x3d3e3j3b3f393b3l6i6d7l6w7e6u766i6h7f7n7v895j615n5r' +
    '51535z6c2n3226661b5k04030k0u0u0t0x0w0u0i110j0o0d0l0m0t0g0n293b5i3d333437371s201f1i2b2m2i2j2r2h2r3738' +
    '3d353932343f6c677f6q786o706c6b787h7o825d5v5h5l4v4x5t662h2w2060165e040i0r0s0o0v0t0r0g100h0n0g0j0k0s0f' +
    '0k26385g3b323335351r1z1d1g292l2g2i2q2f2p36363c343731333e6b657e6o776m6y6a69777g7n815b5u5g5k4u4v5s642f' +
    '2u1y5y135c0i0s0s0p0v0u0t0i110j0p0i0l0m0t0h0l27395i3d343437371s201f1i2b2m2i2j2s2h2r37383d353933353f6c' +
    '677f6q786o706c6b797h7p835d5v5h5l4v4x5t662h2w2060145e0m0n080q0o0w0p190r0w0q0t0u110o0f21335s3l3b3c3e3f' +
    '20281n1q2j2u2q2s2x2o2v3b3c3h3e3k3d3c3n6l6f7o6y7h6w786l6j7h7q7x8b5l645q5u5455626e2p3428690z5n040k0r0p' +
    '0x0z1i10150w12131a0x09222t5u413l3l3o3o282g1w1z2s332z2t2y2y2w3c3c3i3f3l3e3h3s6m6g7p6z7i6x796m6k7i7r7y' +
    '8c5m655r5v5556636f2y3d2h6a105o0l0s0q0y101j11161012141b0y0a232w5u423l3m3p3p292g1x202t34302u2z2z2w3d3d' +
    '3j3g3m3f3i3t6n6h7q707j6y7a6m6l7j7s7z8d5n665s5w5657646g2z3e2i6a105o09070h0w1f0x0s0w0z10170u0d1o2s5c3j' +
    '393b3c3c1q211k1w2c2u2s2e2k2m2h2x2y3330372z333e67627a6l736j6v6766747c7k7y585q5c5g4q4s5o612m31295v0n59' +
    '02070t1c0u0m0x0t0v140q0k1h2x563d303233341l1s1b1s242l2k262b2d282p2p2v2s2y2r2u355y5t716c6u6a6m5y5x6v73' +
    '7b7p4z5h53574h4j5g5s2d2t205m0q50090t1c0u0m0x0t0v140q0i1i2y563e303233341l1s1b1s232l2k262b2d282p2p2v2s' +
    '2y2r2u355y5t716c6u6a6m5y5x6v737b7p4z5h53574h4j5g5s2d2s205m0s500q190r0j0v0q0s110n0r1g2x52392v2x2y2z1g' +
    '1n161n1z2g2f212628242k2k2q2n2t2m2p305u5o6x676q656h5t5s6q6z767k4u5d4z534d4e5b5n282o1v5h0r4v0l03080503' +
    '050d0a0s243g532x2o2p2r2r1c1k0z121v2622232c212b2r2s2x2p2t2n2p2z5w5r6z6a6s686k5w5v6t71797n4x5f51554f4h' +
    '5d5q212g1k5k1c4y0k0r0p0l0h0b0u1c2n3z512w2m2n2p2q1b1j0y111u2521222a1z2a2q2r2w2o2r2l2n2y5v5p6y686r676i' +
    '5v5u6r70777l4w5e50544e4g5c5o202f1j5j1v4x090604040c0b0t263h512w2m2n2q2q1b1j0y111u2521222a1z2a2q2r2w2o' +
    '2r2l2n2y5v5q6y696r676i5v5u6r70777l4w5e50544e4g5c5o202f1j5j1d4x0c080a0j030z1y3f55322t2u2w2w1i1q101720' +
    '2c27242a262g2x2x332r2x2s2u355x5s706b6t696l5x5w6u727a7o4y5g52564g4i5f5r262l1p5l184z08090h0b0t293g5530' +
    '2s2s2v2v1g1o13161z2a26272f252f2v2w312t2x2q2t33605v736e6w6c6o605z6w757c7q515j55594j4l5h5u252k1o5o1c52' +
    '050d0d0v253m4z2x2o2o2r2r171f0u121v27221z2421262n2n2t2l2r2k2p305r5m6u656n636f5r5q6o6w747i4s5a4w504a4c' +
    '595l212g1k5f1e4t090e0w273k4y2t2j2k2n2n181g0v0y1r221y1z271x272n2o2t2l2o2i2k2v5s5n6v666o646f5s5r6o6x74' +
    '7i4t5b4x514b4d595l1x2c1g5g1g4u0m142f3r4u2p2f2g2j2j141c0r0u1n1y1u1v231t232j2k2p2h2l2e2g2r5o5j6r626k60' +
    '6c5o5n6k6t707e4p574t4x4749555h1t281c5c1n4q0r213f5a352w2x2z2z1k1s171a232f2a2c2k292j3030362y312v2x3764' +
    '5z776i706g6s646371797h7v555n595d4n4p5m5y292o1s5s1a561w2u5n3u3e3f3h3i21291p1s2l2x2s2m2s2r2p35363b383f' +
    '373b3m6f6a7i6t7b6r736f6e7c7k7s865g5y5k5o4y505w692r362a630p5h306g4o4a4b4d4d2v322k323d3u3t3f3k3n2k2q2x' +
    '2v2v4740444e78728b7l847k7v7877848d8k8y696r6d6h5r5t6p713n42396w1e6a7y655r5t5v5v4c4k424j4v5c5b4x525550' +
    '505g555j5p5i5m5w8q8k9t939m919d8q8o9m9va2ag7q897v7z797a878j555k4r8e297s292g2i2e2d3y3t45483c3231342y34' +
    '3a3i3e3p342j2s2o2e2e2n2l1w1y1u2615141z2n2u301m1u1x1a1q1s291n362o3p275r1m090a06061w1s2c231719131b150y' +
    '2g2s2r2y290k0z0v12312v443e3x3d3o31303x464d4r222k262a1k1m2i2u100k1w2p3y230709051n1l271w11100w150z0r2a' +
    '2n2l2t230c0r0k0r38334b3m443k3w3837454d4k4y292r2d2h1r1t2p320t0e1f2w3s2a04051o1j251u0z0y0u140x0p282l2k' +
    '2r210j0p0n0y3a344d3n463l3x3a39464f4m502b2t2f2j1t1u2r330s0c1d2y3q2c041q1n281y12110y17110t2c2o2n2u250p' +
    '0s0r123630493j423h3t3634424b4i4w262p2b2f1p1q2n2z0v0f1g2u3u281r1m281x12110x17100s2b2o2n2u240h0s0q1135' +
    '30483j413h3s3534414a4h4v262o2a2e1o1q2m2y0v0f1g2t3t270a0d0c0s14120v11101a1q1r1w1e1p1i1m1w4q4k5t535m52' +
    '5d4q4p5m5v626g3r493v3z393b474j101g0d4e253s0l0k0n0z0x0r0w0w131j1j1p1a1l1d1h1r4l4g5o4z5h4x594l4k5i5q5x' +
    '6b3m443q3u3436424f0w1b08492d3n0f131j1i151a1c1d1t1t1z1r1x1q1t244x4s605b5t595l4x4w5u63696n3y4g42473g3i' +
    '4e4r1d1s0p4l1v400y1915191e141i1y1y241v1v1p1r224x4s605b5t595k4x4w5t62696n3y4g42463g3i4e4q141j0m4l2c3z' +
    '0h0a0f0k0b1c1q1p1w17120v0y19433x564g4z4e4q43414z585f5t333m383c2m2n3k3w0b0q0k3r2q35040i0b081n1w1v221d' +
    '0t0m0q103u3o4x474q454h3u3t4r4z565k2u3d2z332d2e3b3o0c0l0u3i352w0h0a041l1v1t211b0s0l0o0z3t3n4v464p444g' +
    '3t3r4p4y555j2t3c2y322b2d3a3m080k0r3h332v080j191k1j1q110v0n0r123v3q4y494r474j3v3u4s50585m2w3e30342e2g' +
    '3d3p0p0u0n3j2r2x0d1e1p1o1v160p0h0l0w3p3k4s434l414d3p3o4m4u525g2q382u2y282a363j0h0n0r3d2w2r1n1z1x251f' +
    '0r0k0n0y3v3q4y494r474j3v3u4s51585m2w3e30352e2g3d3q040g0q3k2z2y0k0k0q0i201u1x27514v645e5x5c5o51505y67' +
    '6d6r414k464a3k3l4i4v1n20194q2w44050a0p2d26292k5d586g5r5b5p614i4h5c6j6q6d4e4w4i4n3w3y4u571z2c1o522r4g' +
    '0d0o2b24282i5c576f5p575o5z4e4d586h6o694d4v4h4l3v3x4t551x2a1o503b4e0v2j2c2f2q5j5e6m5x5i5v674p4o5k6p6w' +
    '6k4k524o4t4244505e252i1v582x4m1t1m1q204u4o5x575q555h4u4t5q5z666k3u4d3z433d3e4b4n1f1s164i3d3w0h0d0k3a' +
    '354d3o463m3y3a39474f4n512b2t2f2j1t1v2r340w0g1g2y3i2c0d0n3k3e4n3x4g3v473k3j4h4q4w5a2k332p2t2324313e0q' +
    '0f1a393c2n0f3f3a4i3t4b3r433f3e4c4k4r552g2y2k2o1y202w390s0d1d333f2h3m3h4p404i3y4a3m3l4j4r4y5c2n352r2v' +
    '2527333g130o1n3a3p2o0k1k191s171j1u1t1w1m1u2d160w111f1v1s0e0r3y3g4h0p6j191y1o271m1y2e2d2f20272q10120w' +
    '1n1q1n0k1b3s3a4b116d140s140u0l1u1s1d060a0t2f1w2b1y3333201h504i5j1u7m2f0l040d14130v0u121g1q161l192e2e' +
    '1b0r4b3t4u146w1q0n0t0x0w0a101e13281p241r2w2w1u1a4u4c5d1n7f280e12110w0w131h1o141j172c2c190p493r4s136u' +
    '1o1e1d130n0v1e201g1v1i2o2o1l114l43541e7620030y1w231z1t1q241b2g2i1w1a3y3g4h1q6j1s0x1v221y1s1p231a2f2h' +
    '1v163w3e4f1p6i1r191n192a1s281r2x2z1y1c4u4c5d1r7g290d0s2h1y2d203536231k534l5m1x7p2i0x2p252k273d3d2a1q' +
    '5a4s5t237v2p332j2y2l3r3r2o245o56672h89330j0b0n110v0n0y2y2g3h0u5j030k0v1j1d0o0g3h2z400d620l0x150z0j0z' +
    '332l3m0p5o0e191b190o372p3q185s0m031i1u2g1y2z1o52121b1s2i20311i530w0v3f2x3y0f600q3r394a0m6c100k0p3m2y' +
    '2z14343h2h452k3i670x5l';

  function roadKm(a, b) {
    var i = a && a.ci, j = b && b.ci;
    if (typeof i === 'number' && typeof j === 'number') {
      if (i === j) return 0;
      if (i > j) { var t = i; i = j; j = t; }
      var k = i * DIST_N - i * (i + 1) / 2 + (j - i - 1);
      var v = parseInt(DIST.substr(k * 2, 2), 36);
      if (isFinite(v)) return v;
    }
    /* only reachable if a town is missing from the table */
    return haversineKm(a, b) * 1.22;
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

      var km = Math.round(roadKm(from.city, to.city));

      /* Off by default — see USE_ZONE_RATES. */
      var listed = USE_ZONE_RATES
        ? zoneRate(from.city.label, to.city.label, size, service)
        : null;


      /* No price he has quoted, and either end sits in the far north or the
         far south → a person prices it. */
      if (listed === null && (isEdgeCity(from.city) || isEdgeCity(to.city))) {
        return { quoteOnly: 'longHaul', from: from.text, to: to.text, service: service,
                 size: size, fragile: fragile, km: km,
                 fromCity: from.city.label, toCity: to.city.label };
      }

      /* Their engine, exactly: distance x rate, floored at the minimum, with
         anything inside the in-city radius billed at that minimum flat. Then
         the client's own size step on top. Service level is deliberately not
         read — he charges one rate for same-day and next-day alike. */
      var sizeFactor = PRICING.sizeFactor[size] || 1;

      var net, minApplied = false, listedPrice = false, minFloor = 0;
      if (listed !== null) {
        net = listed;                         // his rate card
        listedPrice = true;
      } else {
        var raw = km * PRICING.perKm;
        minApplied = km <= PRICING.inCityKm || raw < PRICING.minCharge;
        net = (minApplied ? PRICING.minCharge : raw) * sizeFactor;
        minFloor = PRICING.minCharge * sizeFactor;
      }

      var vat = net * PRICING.vatRate;

      return {
        from: from.text, to: to.text,
        service: service, size: size, fragile: fragile,
        km: km, listedPrice: listedPrice, minFloor: minFloor,
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
            ? 'שלום, אשמח לקבל הצעת מחיר למשלוח:\n\n' +
              'איסוף: ' + q.from + '\n' +
              'מסירה: ' + q.to + '\n' +
              'גודל החבילה: ' + SIZE_NAMES[q.size] +
              (q.fragile ? ' (תכולה שבירה או בעלת ערך)' : '') + '\n' +
              'סוג השירות: ' + SERVICE_NAMES[q.service] + '\n' +
              'מרחק משוער: ' + q.km + ' ק"מ\n\n' +
              'אשמח לחזרה עם מחיר וזמן איסוף. תודה!'
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

      var note = $('#r-note');

      if (q.listedPrice) {
        /* a real price from the client's rate card — say so, and do not dress
           it up with a distance breakdown it was not derived from */
        $('#r-service-label').textContent = SERVICE_NAMES[q.service] +
          ' — ' + q.fromCity + ' ← ' + q.toCity;
        $('#r-service').textContent = shekel(q.net);
        $('#r-distance-label').textContent = 'מרחק נסיעה';
        $('#r-distance').textContent = q.km + ' ק"מ';
        if (note) note.textContent = 'המחיר לפי מחירון החברה לאזור הזה, לפני תוספות. ' +
          'שעות לילה, סופי שבוע או דרישות מיוחדות עשויים לשנות אותו.';
      } else {
        $('#r-service-label').textContent = SERVICE_NAMES[q.service];
        $('#r-service').textContent = shekel(q.net);
        $('#r-distance-label').textContent = 'מרחק נסיעה';
        $('#r-distance').textContent = q.km + ' ק"מ';
      }
      if (!q.listedPrice && note) {
        note.textContent = 'המחיר מחושב לפי מרחק הנסיעה בפועל. שעות לילה, ' +
          'סופי שבוע או דרישות מיוחדות עשויים לשנות אותו — לאישור סופי דברו איתנו.';
      }

      $('#r-size-row').hidden = false;
      $('#r-size-label').textContent = 'גודל חבילה';
      $('#r-size').textContent = SIZE_NAMES[q.size];

      var fragileRow = $('#r-fragile-row');
      fragileRow.hidden = !q.fragile;
      if (q.fragile) $('#r-fragile').textContent = 'טיפול מוגן';

      var minRow = $('#r-min-row');
      minRow.hidden = !q.minApplied;
      if (q.minApplied) $('#r-min').textContent = 'הושלם ל-' + shekel(q.minFloor || PRICING.minCharge);

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
