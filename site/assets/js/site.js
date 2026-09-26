/* Snipflag site behavior. Calm motion only: smooth scroll, heading reveals, fade-ups, gentle hero parallax. */
(function () {
  'use strict';
  var root = document.documentElement;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ---------- Download button: pick the visitor's platform ---------- */
  var REL = 'https://github.com/Razee4315/snipflag/releases/download/v1.0.0/';
  function detectOS() {
    var p = ((navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '').toLowerCase();
    var ua = navigator.userAgent.toLowerCase();
    if (/android|iphone|ipad|ipod/.test(ua)) return 'mobile';
    if (p.indexOf('win') > -1 || ua.indexOf('windows') > -1) return 'windows';
    if (p.indexOf('mac') > -1 || ua.indexOf('mac os') > -1) return 'mac';
    if (p.indexOf('linux') > -1 || ua.indexOf('linux') > -1) return 'linux';
    return 'other';
  }
  (function downloads() {
    var os = detectOS();
    var map = {
      windows: { href: REL + 'unsigned-Snipflag_1.0.0_x64-setup.exe', label: 'Download for Windows', meta: 'Free' },
      mac: { href: '#download', label: 'Download for macOS', meta: 'Free' },
      linux: { href: REL + 'unsigned-Snipflag_1.0.0_amd64.AppImage', label: 'Download for Linux', meta: 'Free' }
    };
    var pick = map[os];
    if (pick) {
      $$('[data-download]').forEach(function (a) {
        a.href = pick.href;
        var l = $('[data-dl-label]', a), m = $('[data-dl-meta]', a);
        if (l) l.textContent = pick.label;
        if (m) m.textContent = pick.meta;
      });
    }
    var card = $('.dl[data-os="' + os + '"]');
    if (card) { card.classList.add('is-you'); card.parentNode.prepend(card); }
  })();

  /* ---------- Header ---------- */
  var header = $('.site-header');
  var menuBtn = $('.menu-btn');
  var lenis = null;
  if (menuBtn) {
    menuBtn.addEventListener('click', function () {
      var open = menuBtn.getAttribute('aria-expanded') !== 'true';
      menuBtn.setAttribute('aria-expanded', String(open));
      menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      header.classList.toggle('open', open);
      if (lenis) open ? lenis.stop() : lenis.start();
    });
    $$('#nav a').forEach(function (a) { a.addEventListener('click', function () { if (header.classList.contains('open')) menuBtn.click(); }); });
  }
  var lastY = 0;
  function onScrollHeader(y) {
    if (!header) return;
    header.classList.toggle('scrolled', y > 16);
    if (y < lastY - 4 || y < 400) header.classList.remove('hidden');
    else if (y > lastY + 4 && !header.classList.contains('open')) header.classList.add('hidden');
    lastY = y;
  }
  window.addEventListener('scroll', function () { onScrollHeader(window.scrollY); }, { passive: true });

  /* ---------- Motion ---------- */
  function start() {
    if (!window.gsap || !window.ScrollTrigger || !window.SplitText) return false;
    window.__snipflagReady = true;
    var gsap = window.gsap, ScrollTrigger = window.ScrollTrigger, SplitText = window.SplitText;
    gsap.registerPlugin(ScrollTrigger, SplitText);
    gsap.defaults({ ease: 'expo.out', duration: 0.9 });
    if (reduce) return true;

    if (window.Lenis && finePointer) {
      lenis = new window.Lenis({ lerp: 0.12, smoothWheel: true, syncTouch: false });
      lenis.on('scroll', function (e) { ScrollTrigger.update(); onScrollHeader(e.scroll); });
      gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
      gsap.ticker.lagSmoothing(0);
      root.classList.add('lenis');
      $$('a[href^="#"]').forEach(function (a) {
        a.addEventListener('click', function (e) {
          var id = a.getAttribute('href');
          var target = id.length > 1 && document.getElementById(id.slice(1));
          if (!target) return;
          e.preventDefault();
          lenis.scrollTo(target, { offset: -80, duration: 1.2 });
          history.replaceState(null, '', id);
          if (target.tagName === 'DETAILS') target.open = true;
        });
      });
    }

    var split = function (el) {
      el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
      var s = SplitText.create(el, { type: 'lines', mask: 'lines' });
      s.lines.forEach(function (l) { l.setAttribute('aria-hidden', 'true'); });
      return s;
    };

    document.fonts.ready.then(function () {
      var h1 = $('h1[data-split]');
      var tl = gsap.timeline();
      if (h1) tl.from(split(h1).lines, { yPercent: 105, duration: 1, stagger: 0.08 }, 0);
      var fades = $$('[data-hero-fade], .page-hero .lede, .page-hero .checked, .crumbs');
      if (fades.length) tl.from(fades, { opacity: 0, y: 14, stagger: 0.07, duration: 0.8 }, 0.25);
      var shot = $('[data-hero-shot]');
      if (shot) {
        tl.from(shot, { opacity: 0, y: 40, duration: 1.2 }, 0.45);
        gsap.to(shot, { yPercent: -4, ease: 'none', scrollTrigger: { trigger: shot, start: 'top 80%', end: 'bottom top', scrub: true } });
      }
      $$('[data-split]').forEach(function (el) {
        if (el === h1) return;
        gsap.from(split(el).lines, { yPercent: 105, stagger: 0.06, duration: 0.9, scrollTrigger: { trigger: el, start: 'top 88%', once: true } });
      });
      ScrollTrigger.refresh();
    });

    ScrollTrigger.batch('[data-reveal]', {
      start: 'top 90%', once: true,
      onEnter: function (els) { gsap.to(els, { opacity: 1, y: 0, stagger: 0.07, duration: 0.8, overwrite: true }); }
    });
    window.addEventListener('load', function () { ScrollTrigger.refresh(); });
    return true;
  }

  if (!start()) window.addEventListener('load', start, { once: true });
})();
