/* Snipflag site motion + behavior. Spec: site/docs/02-art-direction.md (motion inventory 1-13). */
(function () {
  'use strict';
  var root = document.documentElement;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ---------- Behavior that works without GSAP ---------- */
  var RELEASE = 'https://github.com/Razee4315/snipflag/releases/download/v1.0.0/';
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
      windows: { href: RELEASE + 'unsigned-Snipflag_1.0.0_x64-setup.exe', label: 'Download for Windows', meta: 'Free · 4.4 MB' },
      mac: { href: '#download', label: 'Download for macOS', meta: 'Free · Apple silicon or Intel' },
      linux: { href: RELEASE + 'unsigned-Snipflag_1.0.0_amd64.AppImage', label: 'Download for Linux', meta: 'Free · AppImage' },
      mobile: { href: '#download', label: 'Get it for your desktop', meta: 'Windows · macOS · Linux' }
    };
    var pick = map[os];
    $$('[data-download]').forEach(function (a) {
      if (!pick) return;
      a.href = pick.href;
      var l = $('[data-dl-label]', a), m = $('[data-dl-meta]', a);
      if (l) l.textContent = pick.label;
      if (m) m.textContent = pick.meta;
    });
    // Put the visitor's platform first in the footer list.
    var list = $('.foot-dl');
    if (list && (os === 'mac' || os === 'linux')) {
      $$('[data-os="' + os + '"]', list).reverse().forEach(function (b) { list.prepend(b); });
    }
  })();

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
    $$('#nav a').forEach(function (a) {
      a.addEventListener('click', function () {
        if (header.classList.contains('open')) menuBtn.click();
      });
    });
  }
  var lastY = 0;
  function onScrollHeader(y) {
    if (!header) return;
    header.classList.toggle('scrolled', y > 24);
    var hide = y > 480 && y > lastY + 4 && !header.classList.contains('open');
    if (y < lastY - 4 || y < 480) header.classList.remove('hidden');
    else if (hide) header.classList.add('hidden');
    lastY = y;
  }
  window.addEventListener('scroll', function () { onScrollHeader(window.scrollY); }, { passive: true });

  // Curtain footer only when it fits in the viewport; otherwise it scrolls normally.
  var footer = $('.site-footer');
  function fitFooter() { if (footer) footer.classList.toggle('static', footer.scrollHeight > window.innerHeight + 2 || window.innerWidth < 861); }
  fitFooter();
  window.addEventListener('resize', fitFooter);

  // Custom crosshair cursor (motion #12). Fine pointers only, never under reduced motion.
  var cursor = $('.cursor');
  var hudXY = $('[data-hud-xy]');
  if (cursor && finePointer && !reduce) {
    root.classList.add('has-cursor');
    var xy = $('.xy', cursor);
    var cx = -100, cy = -100, tx = -100, ty = -100, raf = 0;
    var pad = function (n) { n = Math.max(0, Math.round(n)); return ('000' + n).slice(-4); };
    var loop = function () {
      cx += (tx - cx) * 0.35; cy += (ty - cy) * 0.35;
      cursor.style.transform = 'translate3d(' + cx + 'px,' + cy + 'px,0)';
      raf = Math.abs(tx - cx) + Math.abs(ty - cy) > 0.1 ? requestAnimationFrame(loop) : 0;
    };
    window.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse') return;
      tx = e.clientX; ty = e.clientY;
      cursor.classList.add('on');
      xy.textContent = Math.round(tx) + ', ' + Math.round(ty);
      if (hudXY) hudXY.textContent = 'x ' + pad(tx) + ' · y ' + pad(ty);
      if (!raf) raf = requestAnimationFrame(loop);
    }, { passive: true });
    document.addEventListener('pointerleave', function () { cursor.classList.remove('on'); });
    document.addEventListener('pointerover', function (e) {
      var t = e.target.closest && e.target.closest('a, button, summary, [role="button"]');
      cursor.classList.toggle('link', !!t);
      cursor.classList.toggle('ink', !!(e.target.closest && e.target.closest('.site-footer, .marquee, .btn-primary, .pick.us, [aria-pressed="true"]')));
      if (e.target.closest && e.target.closest('input, textarea, select')) cursor.classList.remove('on');
    });
  }

  /* ---------- Motion (needs GSAP) ---------- */
  function start() {
    if (!window.gsap || !window.ScrollTrigger || !window.SplitText) return false;
    window.__snipflagReady = true;
    var gsap = window.gsap, ScrollTrigger = window.ScrollTrigger, SplitText = window.SplitText;
    gsap.registerPlugin(ScrollTrigger, SplitText);
    gsap.defaults({ ease: 'expo.out', duration: 0.9 });

    var shutter = $('.shutter');
    if (reduce) {
      if (shutter) shutter.remove();
      $$('[data-reveal]').forEach(function (el) { el.style.opacity = 1; el.style.transform = 'none'; });
      return true;
    }

    // Lenis on the GSAP ticker (motion #5). Desktop / fine pointer only.
    if (window.Lenis && finePointer) {
      lenis = new window.Lenis({ lerp: 0.1, smoothWheel: true, syncTouch: false });
      lenis.on('scroll', function (e) { ScrollTrigger.update(); onScrollHeader(e.scroll); });
      gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
      gsap.ticker.lagSmoothing(0);
      root.classList.add('lenis');
      $$('a[href^="#"]').forEach(function (a) {
        a.addEventListener('click', function (e) {
          var id = a.getAttribute('href');
          if (id.length < 2) return;
          var target = document.getElementById(id.slice(1));
          if (!target) return;
          e.preventDefault();
          lenis.scrollTo(target, { offset: -80, duration: 1.4 });
          history.replaceState(null, '', id);
          if (target.tagName === 'DETAILS') target.open = true;
        });
      });
    }

    var mm = gsap.matchMedia();

    document.fonts.ready.then(function () {
      var heroTitle = $('.hero h1, .page-hero h1');
      var heroTL = gsap.timeline({ paused: true });

      // Masked line reveal on every h1 (motion #6), choreographed with the hero (motion #9).
      if (heroTitle) {
        heroTitle.setAttribute('aria-label', heroTitle.textContent.replace(/\s+/g, ' ').trim());
        var hs = SplitText.create(heroTitle, { type: 'lines', mask: 'lines', linesClass: 'line' });
        hs.lines.forEach(function (l) { l.setAttribute('aria-hidden', 'true'); });
        heroTL.from(hs.lines, { yPercent: 112, duration: 1.1, stagger: 0.1 }, 0.1);
      }
      var some = function (sel) { var els = $$(sel); return els.length ? els : null; };
      var hud = some('.hero-hud, .crumbs'), fades = some('[data-hero-fade], .page-hero .lede, .page-hero .checked, .page-hero .hero-actions');
      if (hud) heroTL.from(hud, { opacity: 0, y: 10, duration: 0.6 }, 0);
      if (fades) heroTL.from(fades, { opacity: 0, y: 22, stagger: 0.08, duration: 0.9 }, 0.4);
      // clearProps: buttons carry a CSS transform transition that would otherwise fight the tween.
      heroTL.from($$('.site-header .wrap > *'), { opacity: 0, y: -12, stagger: 0.05, duration: 0.6, clearProps: 'transform,opacity' }, 0);
      var heroShot = $('[data-hero-shot]');
      if (heroShot) heroTL.fromTo(heroShot, { clipPath: 'inset(0 0 100% 0)', y: 40 }, { clipPath: 'inset(-10% -10% -10% -10%)', y: 0, duration: 1.2, ease: 'expo.out' }, 0.55);
      if (heroShot) heroTL.from('.hero-shot .sel', { scale: 1.08, opacity: 0, duration: 0.8 }, 1.1);

      // Preloader: capture flash tied to font readiness + hero image decode (motion #11).
      var heroImg = $('.hero-shot img');
      var decoded = heroImg && heroImg.decode ? heroImg.decode().catch(function () {}) : Promise.resolve();
      var cap = new Promise(function (r) { setTimeout(r, 1400); });
      Promise.race([decoded, cap]).then(function () {
        if (!shutter) { heroTL.play(); runCapture(heroTL); return; }
        var readout = $('.readout', shutter), frame = $('.frame', shutter), o = { w: 0 };
        gsap.timeline({ onComplete: function () { shutter.remove(); } })
          .from(frame, { scale: 0.4, rotate: -8, duration: 0.6, ease: 'expo.out' })
          .to(o, { w: 1, duration: 0.45, ease: 'power2.out', onUpdate: function () {
            readout.textContent = Math.round(o.w * window.innerWidth) + ' × ' + Math.round(o.w * window.innerHeight);
          } }, 0.1)
          .to($('.flash', shutter), { opacity: 0.85, duration: 0.08, ease: 'none' }, 0.55)
          .to(shutter, { opacity: 0, duration: 0.45, ease: 'power2.in', onStart: function () { heroTL.play(); runCapture(heroTL); } }, 0.63);
      });

      // Section headings: masked line reveals on scroll.
      $$('[data-split]').forEach(function (el) {
        if (el === heroTitle) return;
        el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
        SplitText.create(el, {
          type: 'lines', mask: 'lines', autoSplit: true,
          onSplit: function (self) {
            self.lines.forEach(function (l) { l.setAttribute('aria-hidden', 'true'); });
            return gsap.from(self.lines, { yPercent: 110, stagger: 0.08, duration: 1, scrollTrigger: { trigger: el, start: 'top 85%', once: true } });
          }
        });
      });

      // Scroll-linked word opacity.
      $$('[data-words]').forEach(function (el) {
        el.setAttribute('aria-label', el.textContent.trim());
        var s = SplitText.create(el, { type: 'words' });
        s.words.forEach(function (w) { w.setAttribute('aria-hidden', 'true'); });
        gsap.fromTo(s.words, { opacity: 0.14 }, { opacity: 1, stagger: 0.1, ease: 'none', scrollTrigger: { trigger: el, start: 'top 80%', end: 'bottom 45%', scrub: true } });
      });

      // Footer title.
      var ft = $('[data-foot-title]');
      if (ft) {
        ft.setAttribute('aria-label', ft.textContent.replace(/\s+/g, ' ').trim());
        var fs = SplitText.create(ft, { type: 'lines', mask: 'lines' });
        fs.lines.forEach(function (l) { l.setAttribute('aria-hidden', 'true'); });
        gsap.from(fs.lines, { yPercent: 110, stagger: 0.1, duration: 1.1, scrollTrigger: { trigger: ft, start: 'top 90%', once: true } });
      }
      ScrollTrigger.refresh();
    });

    // Reveal-on-scroll with stagger (motion #1).
    ScrollTrigger.batch('[data-reveal]', {
      start: 'top 88%', once: true,
      onEnter: function (els) { gsap.to(els, { opacity: 1, y: 0, stagger: 0.08, duration: 1, overwrite: true }); }
    });

    // Hero parallax + exit (motion #8).
    var par = $('[data-parallax]');
    if (par) {
      gsap.to(par, { yPercent: -10, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
      gsap.to('.hero-copy', { yPercent: -18, opacity: 0.2, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
    }

    // Problem: files tumble into a pile as the section arrives.
    var files = $$('[data-file]');
    if (files.length) {
      gsap.from(files, { y: -260, rotate: function (i) { return (i % 2 ? 1 : -1) * (14 + i * 3); }, opacity: 0, stagger: 0.12, ease: 'none',
        scrollTrigger: { trigger: '.files', start: 'top 95%', end: 'bottom 70%', scrub: 1 } });
    }

    // Pinned, scrubbed session sequence (motion #7). Wide screens only; static diagram elsewhere.
    var session = $('.session');
    if (session) {
      mm.add('(min-width: 861px)', function () {
        session.classList.add('animated');
        var steps = $$('[data-step]', session);
        var setStep = function (n) { steps.forEach(function (s, i) { s.classList.toggle('on', i <= n); }); };
        var draws = $$('[data-draw]', session);
        draws.forEach(function (p) { var L = p.getTotalLength(); p.style.strokeDasharray = L; p.style.strokeDashoffset = L; });
        var a = $('[data-card-a]', session), b = $('[data-card-b]', session), issue = $('[data-issue]', session);
        var marksA = $$('.card-a [data-draw]', session), marksB = $$('.card-b [data-draw]', session);
        var tl = gsap.timeline({
          defaults: { ease: 'none' },
          scrollTrigger: {
            trigger: '.session-pin', start: 'top top', end: '+=260%', pin: true, scrub: 1,
            onUpdate: function (self) { setStep(Math.min(4, Math.floor(self.progress * 5.2))); }
          }
        });
        tl.from(a, { xPercent: -30, rotate: -6, opacity: 0, duration: 1, ease: 'power2.out' })
          .to(marksA, { strokeDashoffset: 0, duration: 1, stagger: 0.3 })
          .from(b, { xPercent: 40, yPercent: 20, rotate: 8, opacity: 0, duration: 1, ease: 'power2.out' })
          .to(marksB, { strokeDashoffset: 0, duration: 0.8 })
          .to(a, { left: '0%', top: '22%', width: '48%', rotate: -2, duration: 1 }, '+=0.2')
          .to(b, { right: '0%', top: '22%', width: '48%', rotate: 2, duration: 1 }, '<')
          .to([a, b], { scale: 0.55, opacity: 0, y: 60, duration: 1, stagger: 0.1 }, '+=0.3')
          .fromTo(issue, { opacity: 0, scale: 0.9, yPercent: -40 }, { opacity: 1, scale: 1, yPercent: -50, duration: 1, ease: 'power2.out' }, '<0.3')
          .to({}, { duration: 0.6 });
        return function () { session.classList.remove('animated'); draws.forEach(function (p) { p.style.strokeDasharray = ''; p.style.strokeDashoffset = ''; }); };
      });
    }

    // Tool marquee, speed driven by scroll velocity (motion #13a).
    var track = $('.marquee-track');
    if (track) {
      var loop = gsap.to(track, { xPercent: -50, duration: 28, ease: 'none', repeat: -1 });
      var boost = gsap.quickTo(loop, 'timeScale', { duration: 0.6, ease: 'power3.out' });
      ScrollTrigger.create({
        trigger: '.marquee', start: 'top bottom', end: 'bottom top',
        onUpdate: function (self) {
          var v = self.getVelocity();
          boost((v < 0 ? -1 : 1) * Math.min(6, 1 + Math.abs(v) / 400));
          clearTimeout(track.__t);
          track.__t = setTimeout(function () { boost(v < 0 ? -1 : 1); }, 140);
        }
      });
    }

    // Compare pages: table rows cascade.
    $$('.matrix tbody tr').forEach(function (tr) { tr.setAttribute('data-row', ''); });

    window.addEventListener('load', function () { ScrollTrigger.refresh(); });
    return true;

    /* Signature: the page captures its own headline, then points an arrow at Download (motion #10). */
    function runCapture() {
      var hero = $('.hero'), h1 = $('.hero h1'), box = $('.capture-box'), wh = $('.capture-box .wh');
      var svg = $('.capture-arrow'), path = svg && $('path', svg), btn = $('#dl-main'), flash = $('.capture-flash');
      if (!hero || !h1 || !box || !btn) return;
      var hr = hero.getBoundingClientRect(), r = h1.getBoundingClientRect(), br = btn.getBoundingClientRect();
      var pad = 18;
      var x = r.left - hr.left - pad, y = r.top - hr.top - pad, w = r.width + pad * 2, h = r.height + pad * 2;
      gsap.set(box, { left: x, top: y, width: 0, height: 0, opacity: 1 });
      var o = { p: 0 };
      var tl = gsap.timeline({ delay: 1.05 });
      tl.to(o, { p: 1, duration: 1.1, ease: 'power3.inOut', onUpdate: function () {
          var cw = w * o.p, ch = h * Math.min(1, o.p * 1.15);
          box.style.width = cw + 'px'; box.style.height = ch + 'px';
          wh.textContent = Math.round(cw * devicePixelRatio) + ' × ' + Math.round(ch * devicePixelRatio);
        } })
        .to(flash, { opacity: 0.35, duration: 0.06, ease: 'none' })
        .to(flash, { opacity: 0, duration: 0.5, ease: 'power2.out' })
        .set(box, { borderStyle: 'solid' }, '<');
      if (path && window.innerWidth > 860) {
        // Route the arrow right of the lede (max 36ch) so it never crosses body text.
        var lede = $('.hero .lede'), lr = lede ? lede.getBoundingClientRect() : r;
        var sx = Math.max(x + w - 20, lr.right - hr.left + 40), sy = y + h + 4;
        var ex = br.right - hr.left + 16, ey = br.top - hr.top + br.height / 2;
        var c1x = Math.max(sx, lr.right - hr.left) + 70, c1y = ey - 10;
        svg.setAttribute('width', hr.width); svg.setAttribute('height', hr.height);
        svg.style.left = '0px'; svg.style.top = '0px';
        var ang = Math.atan2(ey - c1y, ex - c1x), hl = 18;
        var d = 'M' + sx + ' ' + sy + ' Q ' + c1x + ' ' + c1y + ' ' + ex + ' ' + ey +
          ' M' + ex + ' ' + ey + ' L ' + (ex - hl * Math.cos(ang - 0.5)) + ' ' + (ey - hl * Math.sin(ang - 0.5)) +
          ' M' + ex + ' ' + ey + ' L ' + (ex - hl * Math.cos(ang + 0.5)) + ' ' + (ey - hl * Math.sin(ang + 0.5));
        path.setAttribute('d', d);
        var L = path.getTotalLength();
        gsap.set(svg, { opacity: 1 });
        gsap.set(path, { strokeDasharray: L, strokeDashoffset: L });
        tl.to(path, { strokeDashoffset: 0, duration: 0.9, ease: 'power2.inOut' }, '-=0.2');
        window.addEventListener('resize', function () { gsap.to(svg, { opacity: 0, duration: 0.2 }); }, { once: true });
      }
      tl.to(box, { opacity: 0, duration: 0.6, ease: 'power2.in' }, '+=1.6');
    }
  }

  // Libraries are deferred; wait for them.
  if (!start()) window.addEventListener('load', start, { once: true });
})();
