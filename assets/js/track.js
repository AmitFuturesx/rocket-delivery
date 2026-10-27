/* Measurement for the Google Ads search campaign.
 *
 * Kept in its own file, out of app.js, for two reasons. The generated pages do
 * not load app.js at all — they are static and fast on purpose — and they still
 * need to measure. And an external file needs no CSP hash, so editing this
 * cannot silently break the policy the way editing an inline block would.
 *
 * Nothing here changes what the site looks like or does. It reads the URL,
 * remembers where the visitor came from, stamps a reference number on every
 * WhatsApp message, and reports three conversions.
 */
(function () {
  'use strict';

  var AW = 'AW-18291568679';
  var LABEL = {
    whatsapp: AW + '/PpWnCMzV_KUdEKfgjJJE',
    phone:    AW + '/QSZ8CM_V_KUdEKfgjJJE',
    calc:     AW + '/4ZT0CNLV_KUdEKfgjJJE'
  };

  var KEY = 'rd_src';
  var TTL = 30 * 24 * 60 * 60 * 1000;          // 30 days
  var STAMP = 'מס׳ פנייה: ';

  /* Storage can throw outright in a private window or with site data blocked,
     so every access is wrapped. When it is unavailable we fall back to reading
     the URL alone, which still gets the first visit from an ad right. */
  function readStore() {
    try {
      var raw = window.localStorage.getItem(KEY);
      if (!raw) return null;
      var o = JSON.parse(raw);
      if (!o || typeof o.ts !== 'number') return null;
      if (Date.now() - o.ts > TTL) return null;
      return o.src === 'G' ? 'G' : 'W';
    } catch (e) { return null; }
  }
  function writeStore(src) {
    try {
      window.localStorage.setItem(KEY, JSON.stringify({ src: src, ts: Date.now() }));
    } catch (e) { /* nothing to do; the URL still drives this page view */ }
  }

  /* G when the click came from a Google ad, W for everything else. */
  function fromUrl() {
    var q;
    try { q = new URLSearchParams(window.location.search); } catch (e) { return null; }
    if (q.get('gclid') || q.get('gbraid') || q.get('wbraid')) return 'G';
    var s = (q.get('utm_source') || '').toLowerCase();
    var m = (q.get('utm_medium') || '').toLowerCase();
    if (s === 'google' && m === 'cpc') return 'G';
    return null;
  }

  var SRC = (function () {
    var url = fromUrl();
    var saved = readStore();
    /* A stored G outranks a later direct visit — someone who arrived from the
       ad and came back a week later is still the ad's lead. */
    var src = url === 'G' ? 'G' : (saved === 'G' ? 'G' : 'W');
    /* Refresh the window on a fresh ad click, and seed it on a first visit,
       but do not keep rewriting W on every page view. */
    if (url === 'G' || saved === null) writeStore(src);
    return src;
  })();

  function leadCode() {
    return SRC + '-' + (1000 + Math.floor(Math.random() * 9000));
  }

  function push(name) {
    try {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({ event: name, lead_source: SRC });
    } catch (e) { /* ignore */ }
  }

  /* Report a conversion, then run `after` — once, whichever comes first. The
     timeout is the point: if the link navigates this tab away, the beacon has
     to have left before it does, and 800ms is the budget the brief sets. */
  function convert(label, after) {
    var done = false;
    function go() { if (done) return; done = true; if (after) after(); }
    if (typeof window.gtag === 'function') {
      window.gtag('event', 'conversion', { send_to: label, event_callback: go });
      window.setTimeout(go, 800);
    } else {
      go();
    }
  }

  function isWhatsApp(u) {
    return u.hostname === 'wa.me' || u.hostname === 'api.whatsapp.com';
  }

  /* Stamp the reference number on the message. Rewritten at click time rather
     than on load, which is what lets this cover the message the calculator
     builds from the quote without the calculator knowing anything about it. */
  function stamp(a) {
    var u;
    try { u = new URL(a.href, window.location.href); } catch (e) { return; }
    if (!isWhatsApp(u)) return;

    var text = u.searchParams.get('text') || 'היי, אשמח לפרטים על משלוח';
    if (text.indexOf(STAMP) !== -1) return;        // already stamped

    /* Built by hand rather than with searchParams, which encodes a space as +.
       WhatsApp reads that literally in some clients, so the text is encoded
       once, properly, and nothing else is appended. */
    a.href = u.origin + u.pathname + '?text=' +
             encodeURIComponent(text + '\n' + STAMP + leadCode());
  }

  document.addEventListener('click', function (e) {
    var el = e.target;
    var a = el && el.closest ? el.closest('a[href]') : null;
    if (!a) return;

    var raw = a.getAttribute('href') || '';

    if (raw.slice(0, 4).toLowerCase() === 'tel:') {
      push('phone_click');
      /* A tel: link hands off to the dialler rather than unloading the page,
         so there is nothing to hold back here. */
      convert(LABEL.phone);
      return;
    }

    var u;
    try { u = new URL(a.href, window.location.href); } catch (err) { return; }
    if (!isWhatsApp(u)) return;

    stamp(a);
    push('whatsapp_click');

    if (a.target === '_blank') {
      convert(LABEL.whatsapp);                     // this tab stays put
      return;
    }
    e.preventDefault();
    var href = a.href;
    convert(LABEL.whatsapp, function () { window.location.href = href; });
  }, true);

  /* Declining cookies is the one case where consent has to be withdrawn. The
     tag itself loads on page load, per the brief. */
  document.addEventListener('click', function (e) {
    var el = e.target;
    var b = el && el.closest ? el.closest('[data-cookie="decline"]') : null;
    if (!b || typeof window.gtag !== 'function') return;
    window.gtag('consent', 'update', {
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      analytics_storage: 'denied'
    });
  }, true);

  /* Called by the calculator the first time it shows a price. Guarded here
     rather than there, so the caller can stay a single unconditional line. */
  var calcFired = false;
  window.rdCalcResult = function () {
    if (calcFired) return;
    calcFired = true;
    push('calc_result');
    convert(LABEL.calc);
  };

  /* exposed for the console checks in the brief */
  window.rdSource = function () { return SRC; };
})();
