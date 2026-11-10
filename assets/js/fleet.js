/* The fleet podium's mobile carousel — the functional layer only.
 *
 * Moved out of app.js so the /legal landing page can show the fleet without
 * loading the whole cinematic stack (GSAP, Lenis, ~100KB) on paid traffic.
 * The CSS for the carousel is gated on .js, and that class is set on every
 * page — so any page with the fleet section MUST load this file, or a phone
 * gets three vehicles stacked on top of each other in one slot.
 */
(function () {
  'use strict';
  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };

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
})();
