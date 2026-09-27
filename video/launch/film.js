/* Snipflag launch film. Every frame is a pure function of time: seek(t) sets every property,
   so the renderer can capture any frame in any order and the preview scrubber is exact. */
(() => {
const DUR = 57, FPS = 60, D = 3;
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const E = {
  lin: t => t,
  outCubic: t => 1 - (1 - t) ** 3, inCubic: t => t ** 3, inOutCubic: t => t < .5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2,
  outQuart: t => 1 - (1 - t) ** 4, outQuint: t => 1 - (1 - t) ** 5, inQuart: t => t ** 4,
  outExpo: t => t >= 1 ? 1 : 1 - 2 ** (-10 * t), inExpo: t => t <= 0 ? 0 : 2 ** (10 * t - 10),
  inOutExpo: t => t <= 0 ? 0 : t >= 1 ? 1 : t < .5 ? 2 ** (20 * t - 10) / 2 : (2 - 2 ** (-20 * t + 10)) / 2,
  inOutQuart: t => t < .5 ? 8 * t ** 4 : 1 - (-2 * t + 2) ** 4 / 2,
  outBack: t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2; },
};
const P = (t, a, b, e = E.outExpo) => e(clamp((t - a) / (b - a)));
/** Damped spring step response, 0 → 1 with overshoot. */
function spring(dt, f = 1.6, z = 0.42) {
  if (dt <= 0) return 0;
  const w = 2 * Math.PI * f, wd = w * Math.sqrt(1 - z * z);
  return 1 - Math.exp(-z * w * dt) * (Math.cos(wd * dt) + (z * w / wd) * Math.sin(wd * dt));
}
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function tf(el, o) {
  const t = [];
  if (o.x || o.y || o.z) t.push(`translate3d(${(o.x || 0).toFixed(2)}px,${(o.y || 0).toFixed(2)}px,${(o.z || 0).toFixed(2)}px)`);
  if (o.rx) t.push(`rotateX(${o.rx.toFixed(3)}deg)`);
  if (o.ry) t.push(`rotateY(${o.ry.toFixed(3)}deg)`);
  if (o.r) t.push(`rotate(${o.r.toFixed(3)}deg)`);
  if (o.s !== undefined && o.s !== 1) t.push(`scale(${o.s.toFixed(4)})`);
  el.style.transform = t.join(' ');
  if (o.o !== undefined) el.style.opacity = clamp(o.o).toFixed(4);
  el.style.filter = o.blur > 0.05 ? `blur(${o.blur.toFixed(2)}px)` : '';
}
const show = (el, on) => { el.style.display = on ? 'block' : 'none'; };

/* ---------- Icons (the app's own 24px set) ---------- */
const ICON = {
  select: ['M6.2 3.8v14.4l3.9-3.7 2.6 5.8 2.5-1.1-2.6-5.7h5.5z', 'M6.2 3.8v14.4l3.9-3.7 2.6 5.8 2.5-1.1-2.6-5.7h5.5z', .18],
  arrow: ['M5.5 18.5L17.5 6.5M10 6h8v8', 'M18 6l-.1 8.1-8-8z'],
  rectangle: ['M4.5 7a2.5 2.5 0 012.5-2.5h10A2.5 2.5 0 0119.5 7v10a2.5 2.5 0 01-2.5 2.5H7A2.5 2.5 0 014.5 17z'],
  ellipse: ['M12 5c4.4 0 8 3.1 8 7s-3.6 7-8 7-8-3.1-8-7 3.6-7 8-7z'],
  pen: ['M4.5 19.5l1-4.2L15.6 5.2a2 2 0 012.8 0l.4.4a2 2 0 010 2.8L8.7 18.5zM13.8 7l3.2 3.2'],
  highlight: ['M9.5 16.5l-3-3 8.3-8.3a2 2 0 012.8 0l.2.2a2 2 0 010 2.8zM6.5 13.5L4 19l5.5-2.5M13 20h7', 'M6.5 13.5L4 19l5.5-2.5z'],
  text: ['M5.5 7.5V5h13v2.5M12 5v14M9.5 19h5'],
  step: ['M12 3.8a8.2 8.2 0 110 16.4 8.2 8.2 0 010-16.4zM10.6 9.6L12.6 8v8.2'],
  pixelate: ['M4.5 7A2.5 2.5 0 017 4.5h10A2.5 2.5 0 0119.5 7v10a2.5 2.5 0 01-2.5 2.5H7A2.5 2.5 0 014.5 17z', 'M8 8h2.7v2.7H8zM13.3 8H16v2.7h-2.7zM10.7 10.7h2.6v2.6h-2.6zM8 13.3h2.7V16H8zM13.3 13.3H16V16h-2.7z'],
  undo: ['M9 14L4 9l5-5M4 9h10a6 6 0 010 12h-3'], redo: ['M15 14l5-5-5-5M20 9H10a6 6 0 000 12h3'],
  zoomIn: ['M11 18a7 7 0 100-14 7 7 0 000 14zM20 20l-4-4M11 8v6M8 11h6'], zoomOut: ['M11 18a7 7 0 100-14 7 7 0 000 14zM20 20l-4-4M8 11h6'],
  fit: ['M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5'], copy: ['M9 9h11v11H9zM5 15H4V4h11v1'], save: ['M12 4v11M7 10l5 5 5-5M5 20h14'],
  image: ['M4 5h16v14H4zM4 16l5-5 4 4 2-2 5 5M15 9.5a1.5 1.5 0 100-.01'], history: ['M4 12a8 8 0 102.3-5.7M4 4v4h4M12 8v4l3 2'],
  settings: ['M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z'],
  plus: ['M12 5v14M5 12h14'], right: ['M9 6l6 6-6 6'], external: ['M14 4h6v6M20 4l-9 9M18 14v6H4V6h6'],
  lock: ['M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 017 0v3M12 15v1.5'],
};
function icon(name) {
  const [d, fill, op] = ICON[name];
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/>${fill ? `<path d="${fill}" fill="currentColor" stroke="none" opacity="${op ?? 1}"/>` : ''}</svg>`;
}
const MARK = `<svg viewBox="96 96 320 320" fill="none" stroke="currentColor" stroke-width="38" stroke-linecap="round" stroke-linejoin="round"><path d="M204 135h-69v69m173 173h69v-69M135 308v69h69"/><path d="M235 277l139-139m-89 0h89v89" stroke="#8CDCC1"/></svg>`;

/* ---------- Screenshot content (same fixtures the website hero uses) ---------- */
const BILLING = `<div class="hd"><b>Acme</b><span>Account · Billing</span></div><div class="bd"><div class="ttl">Billing</div>
<div class="row"><span>Email</span><span class="email">jane.doe@example.com</span></div>
<div class="row"><span>Plan</span><span>Team · 5 seats</span></div>
<div class="tot"><span>Total due</span><b class="due">$0.00</b></div><div class="pay">Pay now</div></div>`;
const INVOICE = `<div class="k">INVOICE #1042</div><div class="ttl">Team plan</div>
<div class="ln"><span>5 seats × $12</span><span>$60.00</span></div><div class="tt"><span>Total</span><span>$60.00</span></div>`;
function makeShot(kind, scale, ann) {
  const el = document.createElement('div');
  el.className = 'shot' + (kind === 'inv' ? ' inv' : '');
  el.innerHTML = kind === 'inv' ? INVOICE : BILLING;
  el.style.transform = `scale(${scale})`;
  let refs = null;
  if (ann) {
    const a = document.createElement('div'); a.className = 'ann';
    a.innerHTML = `<canvas width="640" height="400"></canvas><div class="rect"></div>
      <svg viewBox="0 0 640 400"><path class="aline" fill="none" stroke="#EF4444" stroke-width="8" stroke-linecap="round"/><path class="ahead" fill="#EF4444"/></svg><div class="stepm">1</div>`;
    el.appendChild(a);
    refs = { cv: a.querySelector('canvas'), rect: a.querySelector('.rect'), line: a.querySelector('.aline'), head: a.querySelector('.ahead'), step: a.querySelector('.stepm') };
  }
  return { el, refs };
}

/* Geometry measured once at init (image-space px). */
const G = {};
let pixMaster;
/** True block averages over the email region, like the app's pixelation tool (12 px blocks on the image grid). */
function buildPixelation() {
  const [x0, y0, x1, y1] = G.pix;
  const c = document.createElement('canvas'); c.width = 640; c.height = 400;
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, 640, 400);
  g.fillStyle = '#f5f6f3'; roundRect(g, G.emailRow[0], G.emailRow[1], G.emailRow[2] - G.emailRow[0], G.emailRow[3] - G.emailRow[1], 8); g.fill();
  g.fillStyle = '#1f2d2a'; g.font = '15px Inter'; g.textBaseline = 'alphabetic';
  g.fillText('jane.doe@example.com', G.email[0], G.emailBase);
  const out = document.createElement('canvas'); out.width = 640; out.height = 400;
  const o = out.getContext('2d');
  const B = 12;
  const data = g.getImageData(0, 0, 640, 400).data;
  for (let by = Math.floor(y0 / B) * B; by < y1; by += B) for (let bx = Math.floor(x0 / B) * B; bx < x1; bx += B) {
    let r = 0, gg = 0, b = 0, n = 0;
    for (let y = by; y < by + B; y++) for (let x = bx; x < bx + B; x++) { const i = (y * 640 + x) * 4; r += data[i]; gg += data[i + 1]; b += data[i + 2]; n++; }
    o.fillStyle = `rgb(${r / n | 0},${gg / n | 0},${b / n | 0})`;
    const cx0 = Math.max(bx, x0), cy0 = Math.max(by, y0), cx1 = Math.min(bx + B, x1), cy1 = Math.min(by + B, y1);
    o.fillRect(cx0, cy0, cx1 - cx0, cy1 - cy0);
  }
  pixMaster = out;
}
function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function setAnn(r, st) {
  if (st.rect) { const [a, b, c, d] = st.rect; Object.assign(r.rect.style, { display: 'block', left: Math.min(a, c) + 'px', top: Math.min(b, d) + 'px', width: Math.abs(c - a) + 'px', height: Math.abs(d - b) + 'px' }); }
  else r.rect.style.display = 'none';
  if (st.pix) { const [a, b, c, d] = st.pix; r.cv.style.display = 'block'; r.cv.style.clipPath = `polygon(${a}px ${b}px, ${c}px ${b}px, ${c}px ${d}px, ${a}px ${d}px)`; }
  else r.cv.style.display = 'none';
  const ap = st.arrow ?? 0;
  if (ap > 0) {
    const [x0, y0, x1, y1] = G.arrow; const ex = lerp(x0, x1, ap), ey = lerp(y0, y1, ap);
    const ang = Math.atan2(y1 - y0, x1 - x0), hl = 30, hw = 17;
    const bx = ex - Math.cos(ang) * hl * .8, by = ey - Math.sin(ang) * hl * .8;
    r.line.setAttribute('d', `M${x0} ${y0}L${bx} ${by}`);
    const hs = clamp(ap * 3);
    const lx = ex - Math.cos(ang) * hl * hs, ly = ey - Math.sin(ang) * hl * hs;
    r.head.setAttribute('d', `M${ex} ${ey}L${lx - Math.sin(ang) * hw * hs} ${ly + Math.cos(ang) * hw * hs}L${lx + Math.sin(ang) * hw * hs} ${ly - Math.cos(ang) * hw * hs}Z`);
    r.line.style.display = r.head.style.display = '';
  } else r.line.style.display = r.head.style.display = 'none';
  if (st.step > 0) { r.step.style.display = 'block'; r.step.style.left = G.stepAt[0] + 'px'; r.step.style.top = G.stepAt[1] + 'px'; r.step.style.transform = `scale(${st.step})`; }
  else r.step.style.display = 'none';
}
const FINAL_ANN = () => ({ rect: G.rect, pix: G.pix, arrow: 1, step: 1 });

/* ---------- Text splitting ---------- */
function split(el) {
  const chars = [];
  const walk = node => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === 3) {
        const frag = document.createDocumentFragment();
        child.textContent.split(/(\s+)/).forEach(part => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
          const w = document.createElement('span'); w.className = 'wd';
          for (const ch of part) { const c = document.createElement('span'); c.className = 'ch'; c.textContent = ch; w.appendChild(c); chars.push(c); }
          frag.appendChild(w);
        });
        child.replaceWith(frag);
      } else if (child.nodeType === 1 && child.tagName.toLowerCase() !== 'svg') walk(child);
    }
  };
  walk(el);
  return chars;
}
/** Masked character rise in, optional rise out. */
function chars(list, t, a, stagger = .03, dur = .9, out = Infinity, outStagger = .012) {
  list.forEach((c, i) => {
    const pin = P(t, a + i * stagger, a + i * stagger + dur, E.outExpo);
    const pout = out === Infinity ? 0 : P(t, out + i * outStagger, out + i * outStagger + .45, E.inExpo);
    const y = (1 - pin) * 115 - pout * 115;
    c.style.transform = `translateY(${y.toFixed(2)}%) rotate(${((1 - pin) * 8 - pout * 4).toFixed(2)}deg)`;
  });
}

/* ---------- Build ---------- */
const S = {};
let shotEd, shotSrc, shotFly, annEd;
const TOOLS = ['select', 'arrow', 'rectangle', 'ellipse', 'pen', 'highlight', 'text', 'step', 'pixelate'];
function build() {
  $$('[data-i]').forEach(el => { el.innerHTML = icon(el.dataset.i); });
  $('.util .mk').innerHTML = MARK;
  // Toolbar
  const tb = $('#toolbar');
  tb.innerHTML = TOOLS.map(n => `<span class="tb" data-tool="${n}">${icon(n).replace('<svg', '<svg width="24" height="24"')}</span>`).join('') +
    '<span class="tsep"></span>' +
    ['#EF4444', '#F59E0B', '#22C55E', '#3B82F6', '#A855F7', '#0F172A', '#FFFFFF'].map((c, i) => `<span class="sw${i === 0 ? ' on' : ''}" style="background:${c}"></span>`).join('') +
    `<span class="sw" style="background:conic-gradient(#ef4444,#f59e0b,#22c55e,#3b82f6,#a855f7,#ef4444)"></span>` +
    `<span class="wd2">${[4, 7, 10, 13, 16].map((s, i) => `<span class="${i === 2 ? 'on' : ''}"><i style="width:${s}px;height:${s}px"></i></span>`).join('')}</span>` +
    `<span style="flex:1"></span><span class="tb ur">${icon('undo')}</span><span class="tb ur">${icon('redo')}</span>`;
  $$('.tb svg').forEach(s => { s.setAttribute('width', 24); s.setAttribute('height', 24); });
  // Shots
  shotSrc = makeShot('bill', 1.25, false); $('#srcShot').appendChild(shotSrc.el);
  shotFly = makeShot('bill', 1, false); $('#flyer').appendChild(shotFly.el);
  shotEd = makeShot('bill', 853 / 640, true); $('#edImg').appendChild(shotEd.el); annEd = shotEd.refs;
  $('#tileB .thumb').appendChild(makeShot('bill', .2, false).el);
  $('#tileI .thumb').appendChild(makeShot('inv', .2, false).el);
  $('#iShot1').appendChild(makeShot('inv', 1.25, false).el);
  const i2 = makeShot('bill', 1.25, true); $('#iShot2').appendChild(i2.el); S.issueAnn = i2.refs;
  $('#p1shot').appendChild(makeShot('bill', 1.1, false).el);
  $('#toastThumb').appendChild(makeShot('bill', .1625, false).el);
  // Windows-style line icons for the Paint and Linear mock-ups.
  const W = { save: 'M5 4h11l3 3v13H5zM8 4v5h7V4M8 20v-6h8v6', undo: 'M9 14L4 9l5-5M4 9h10a6 6 0 010 12h-3', redo: 'M15 14l5-5-5-5M20 9H10a6 6 0 000 12h3',
    pencil: 'M4.5 19.5l1-4.2L15.6 5.2a2 2 0 012.8 0l.4.4a2 2 0 010 2.8L8.7 18.5zM13.8 7l3.2 3.2', fill: 'M5 12l7-7 7 7-7 7zM19 15c1 1.5 1.5 2.5 1.5 3a1.5 1.5 0 01-3 0c0-.5.5-1.5 1.5-3z',
    text: 'M6 19l6-14 6 14M8.5 14h7', eraser: 'M4 16l9-9 6 6-6 6H8zM9 11l5 5M13 19h7', picker: 'M14 4l6 6-3 1-8 8H6v-3l8-8zM12 8l4 4', zoom: 'M11 18a7 7 0 100-14 7 7 0 000 14zM20 20l-4-4',
    select: 'M4 7V4h3M10 4h4M17 4h3v3M20 10v4M20 17v3h-3M14 20h-4M7 20H4v-3M4 14v-4', brush: 'M14 4l6 6-7 7-4-4zM9 13c-3 0-5 2-5 5v2h2c3 0 5-2 5-5', size: 'M4 6h16M4 11h16M4 16.5h16',
    crop: 'M7 3v14h14M3 7h14v14', resize: 'M4 9V4h5M20 15v5h-5M4 4l7 7M20 20l-7-7', rotate: 'M4 12a8 8 0 1014-5.3M18 3v4h-4', clip: 'M16 8l-7 7a2.5 2.5 0 01-3.5-3.5l7.5-7.5a4 4 0 015.7 5.7L11 18' };
  $$('[data-w]').forEach(el => { el.innerHTML = `<svg viewBox="0 0 24 24"><path d="${W[el.dataset.w]}"/></svg>`; });
  $('#p2shot').appendChild(makeShot('bill', 1, false).el);
  S.ots = $$('.ot').map(split);
  // Burst
  $('#burst').innerHTML = Array.from({ length: 14 }, () => '<i></i>').join('');
  // Chaos pile
  const r = rng(7);
  const names = ['Screenshot 2026-09-27 141102.png', 'image (3).png', 'Screenshot (14).png', 'bug-maybe.png', 'IMG_2041.PNG', 'Untitled.png', 'Screen Shot final FINAL.png', 'Screenshot 2026-09-27 141355.png', 'checkout-broken.png', 'image (4).png', 'Capture.PNG', 'this one.png', 'Screenshot (15).png', 'image.png'];
  const hl = ['#FCA5A5', '#FDE68A', '#A7F3D0', '#BFDBFE', '#DDD6FE', '#FBCFE8'];
  const spots = [[260, 220], [1560, 260], [520, 760], [1380, 800], [150, 560], [1700, 600], [820, 180], [1120, 880], [380, 380], [1500, 440], [960, 700], [700, 520], [1240, 300], [240, 900]];
  S.cards = spots.map(([x, y], i) => {
    const el = document.createElement('div'); el.className = 'card';
    let body = '';
    const n = 3 + (r() * 4 | 0);
    for (let k = 0; k < n; k++) body += k === 1 + (r() * 2 | 0) ? `<i class="hl" style="--c:${hl[(r() * hl.length) | 0]}"></i>` : `<i style="width:${40 + r() * 60 | 0}%"></i>`;
    el.innerHTML = `<div class="cbar"><i></i><i></i><i></i></div><div class="cbody">${body}</div><div class="fname">${names[i]}</div>`;
    el.style.zIndex = i;
    $('#pile').appendChild(el);
    return { el, x: x - 150, y: y - 97, r: (r() - .5) * 26, a: 8.45 + i * .1, jx: (r() - .5) * 60 };
  });
  const bubbles = [['Priya', 'which screenshot?', 110, 120, 8.85], ['Marco', 'where exactly??', 1420, 150, 9.1], ['Sam', 'can you circle it', 1300, 900, 9.35], ['Jules', 'is this the latest one?', 90, 820, 9.6]];
  S.bubbles = bubbles.map(([who, txt, x, y, a]) => {
    const el = document.createElement('div'); el.className = 'bubble'; el.innerHTML = `<b>${who}</b>${txt}`;
    $('#chats').appendChild(el); return { el, x, y, a };
  });
  // Bento visuals
  $('#bDots').innerHTML = '<i></i><i></i><i></i>';
  const pr = rng(3);
  const pg = $('#pixGrid');
  S.pix = Array.from({ length: 50 }, (_, i) => { const e = document.createElement('i'); pg.appendChild(e); return { e, k: pr() }; });
  $('#funnel').innerHTML = Array.from({ length: 10 }, () => '<i></i>').join('') + '<div class="doc">1 issue<br><span style="color:#8a919c;font-weight:500">10 images</span></div>';
  // Split kinetic text
  ['#s1a', '#s2a', '#s8a', '#word3', '#word9'].forEach(id => { S[id] = split($(id)); });
  S.s2b = split($('#s2b')); S.s8b = split($('#s8b'));
}

function measure() {
  $$('.scene').forEach(s => s.style.display = 'block');
  const rel = (el, root) => {
    const a = el.getBoundingClientRect(), b = root.getBoundingClientRect(), k = root.offsetWidth / b.width;
    return { x: (a.left - b.left) * k, y: (a.top - b.top) * k, w: a.width * k, h: a.height * k, cx: (a.left - b.left + a.width / 2) * k, cy: (a.top - b.top + a.height / 2) * k };
  };
  // Image-space geometry from the editor's shot (scaled 853/640).
  const img = $('#edImg .shot');
  const k = 640 / img.getBoundingClientRect().width;
  const ir = img.getBoundingClientRect();
  const iq = el => { const a = el.getBoundingClientRect(); return [(a.left - ir.left) * k, (a.top - ir.top) * k, (a.right - ir.left) * k, (a.bottom - ir.top) * k]; };
  const em = iq(img.querySelector('.email')), row = iq(img.querySelector('.email').parentElement), due = iq(img.querySelector('.due'));
  G.email = em; G.emailRow = row; G.emailBase = em[3] - 4.5;
  G.pix = [Math.round(em[0] - 10), Math.round(row[1] + 3), Math.round(em[2] + 10), Math.round(row[3] - 3)];
  G.rect = [Math.round(due[0] - 44), Math.round(due[1] - 16), Math.round(due[2] + 30), Math.round(due[3] + 16)];
  G.arrow = [G.rect[0] - 230, G.rect[3] + 70, G.rect[0] - 14, (G.rect[1] + G.rect[3]) / 2 + 8];
  G.stepAt = [G.rect[0], G.rect[1]];
  // Editor-space targets.
  const ed = $('#ed');
  G.ed = {};
  TOOLS.forEach(n => G.ed[n] = rel($(`[data-tool="${n}"]`), ed));
  G.ed.img = rel($('#edImg'), ed);
  G.ed.add = rel($('#addImg'), ed);
  G.ed.title = rel($('#fTitle'), ed); G.ed.desc = rel($('#fDesc'), ed); G.ed.team = rel($('#fTeam'), ed);
  G.ed.eng = rel($('#optEng'), ed); G.ed.details = rel($('#details'), ed); G.ed.create = rel($('#createBtn'), ed);
  G.ed.tileB = rel($('#tileB'), ed);
  G.slot = [16, 172];
  // Stage-space rects for the capture hand-off.
  const stage = $('#stage');
  G.src = rel($('#srcShot'), stage);
  G.edImgStage = { x: 160 + G.ed.img.x, y: 40 + G.ed.img.y, w: G.ed.img.w, h: G.ed.img.h };
  G.word3 = $('#word3').getBoundingClientRect().width * (stage.offsetWidth / stage.getBoundingClientRect().width);
  G.word9 = $('#word9').getBoundingClientRect().width * (stage.offsetWidth / stage.getBoundingClientRect().width);
  $$('.logo path').forEach(p => { p.dataset.len = p.getTotalLength(); p.style.strokeDasharray = p.dataset.len; });
  const scr = $('.scribble path'); scr.dataset.len = scr.getTotalLength(); scr.style.strokeDasharray = scr.dataset.len;
  const p2 = $('#p2'), p3 = $('#p3'), p4 = $('#p4in');
  G.p = { pencil: rel($('#pencil'), p2), save: rel($('#sSave'), p3), sname: rel($('#sname'), p3), title: rel($('#tTitle'), p4), desc: rel($('#tDesc'), p4), hit: rel($('.dlist .hit'), p4), drop: rel($('#tDrop'), p4),
    shot: rel($('#p1shot'), $('#p1')), paintTop: rel($('#paintbg'), p2).y };
  { // A hand-drawn circle around the wrong total, the way people do it in Paint.
    const ps = rel($('#p2shot'), $('#paintbg'));
    const ox = ps.x, oy = ps.y, cx = ox + (G.rect[0] + G.rect[2]) / 2 + 6, cy = oy + (G.rect[1] + G.rect[3]) / 2;
    const rx = (G.rect[2] - G.rect[0]) / 2 + 18, ry = (G.rect[3] - G.rect[1]) / 2 + 12, r = rng(11), pts = [];
    for (let i = 0; i <= 48; i++) { const a = -2.6 + i / 48 * Math.PI * 2.25, w = 1 + Math.sin(i * .7) * .05 + (r() - .5) * .05 + i / 48 * .12; pts.push([cx + Math.cos(a) * rx * w, cy + Math.sin(a) * ry * w]); }
    let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
    for (let i = 1; i < pts.length - 1; i++) { const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2; d += `Q${pts[i][0].toFixed(1)} ${pts[i][1].toFixed(1)} ${mx.toFixed(1)} ${my.toFixed(1)}`; }
    const w = $('#wob'); w.setAttribute('d', d); w.dataset.len = w.getTotalLength(); w.style.strokeDasharray = w.dataset.len;
  }
  $$('.scene').forEach(s => s.style.display = '');
  // Pixelation master and the static annotated copy in the issue.
  buildPixelation();
  [annEd.cv, S.issueAnn.cv].forEach(cv => cv.getContext('2d').drawImage(pixMaster, 0, 0));
  setAnn(S.issueAnn, FINAL_ANN());
}

/* ---------- Editor camera and cursor ---------- */
function kf(keys, t) {
  if (t <= keys[0].t) return keys[0];
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i].t) {
      const a = keys[i - 1], b = keys[i], p = (keys[i].e || E.inOutCubic)((t - a.t) / (b.t - a.t));
      const o = {}; for (const k in b) if (k !== 't' && k !== 'e') o[k] = lerp(a[k] ?? b[k], b[k], p);
      return o;
    }
  }
  return keys[keys.length - 1];
}
const ID = { px: 800, py: 500, s: 1, cx: 960, cy: 540, rx: 0, ry: 0 };
let CAM, CUR, CLICKS;
function plan() {
  const g = G.ed, I = G.ed.img, q = I.w / 640;
  const im = (x, y) => [I.x + x * q, I.y + y * q];
  const c = r => [r.cx, r.cy];
  const R = G.rect, X = G.pix, A = G.arrow;
  CAM = [
    { t: 17.3, ...ID }, { t: 19.0, ...ID },
    { t: 19.9, px: 560, py: 330, s: 1.5, cx: 960, cy: 540, rx: 0, ry: 0, e: E.inOutQuart },
    { t: 24.8, px: 600, py: 370, s: 1.62, cx: 960, cy: 540, rx: 0, ry: 0, e: E.lin },
    { t: 25.7, px: 800, py: 500, s: .74, cx: 1270, cy: 560, rx: 7, ry: -18, e: E.inOutQuart },
    { t: 27.7, px: 800, py: 500, s: .76, cx: 1250, cy: 550, rx: 5, ry: -13, e: E.lin },
    { t: 28.5, px: 380, py: 830, s: 1.55, cx: 960, cy: 560, rx: 0, ry: 0, e: E.inOutQuart },
    { t: 30.0, px: 400, py: 830, s: 1.6, cx: 960, cy: 560, rx: 0, ry: 0, e: E.lin },
    { t: 30.6, px: 1355, py: 300, s: 1.7, cx: 960, cy: 540, rx: 0, ry: 0, e: E.inOutQuart },
    { t: 32.2, px: 1355, py: 360, s: 1.72, cx: 960, cy: 540, rx: 0, ry: 0, e: E.lin },
    { t: 33.0, px: 1355, py: 520, s: 1.45, cx: 960, cy: 540, rx: 0, ry: 0 },
    { t: 33.9, px: 1355, py: 700, s: 1.45, cx: 960, cy: 540, rx: 0, ry: 0 },
    { t: 35.55, px: 1355, py: 640, s: 1.5, cx: 960, cy: 540, rx: 0, ry: 0, e: E.lin },
    { t: 35.95, px: 1355, py: 330, s: 1.55, cx: 960, cy: 540, rx: 0, ry: 0, e: E.outCubic },
    { t: 36.5, px: 1355, py: 320, s: 1.62, cx: 960, cy: 540, rx: 0, ry: 0, e: E.lin },
    { t: 37.5, px: 1355, py: 320, s: 1.2, cx: 760, cy: 520, rx: 16, ry: 22, e: E.inCubic },
  ];
  const tileB0 = [G.slot[0] + 71 + 14, 820 + 14 + 16 + 59];
  CUR = [
    [19.2, ...im(420, 300)], [19.85, ...c(g.rectangle)], [20.15, ...c(g.rectangle)],
    [20.5, ...im(R[0], R[1])], [20.55, ...im(R[0], R[1])], [21.25, ...im(R[2], R[3])], [21.45, ...im(R[2], R[3])],
    [21.75, ...c(g.pixelate)], [21.95, ...c(g.pixelate)],
    [22.15, ...im(X[0], X[1])], [22.2, ...im(X[0], X[1])], [22.9, ...im(X[2], X[3])], [23.05, ...im(X[2], X[3])],
    [23.3, ...c(g.arrow)], [23.45, ...c(g.arrow)],
    [23.65, ...im(A[0], A[1])], [23.7, ...im(A[0], A[1])], [24.3, ...im(A[2], A[3])], [24.45, ...im(A[2], A[3])],
    [24.65, ...c(g.step)], [24.75, ...c(g.step)], [24.95, ...im(...G.stepAt)], [25.3, ...im(G.stepAt[0] + 60, G.stepAt[1] + 60)],
    // Filmstrip
    [28.3, g.add.cx + 180, g.add.cy + 60], [28.65, ...c(g.add)], [28.9, ...c(g.add)],
    [29.25, G.slot[1] + 14 + 71 + 20, 820 + 14 + 16 + 50], [29.35, G.slot[1] + 14 + 71 + 20, 820 + 14 + 16 + 50],
    [29.95, tileB0[0] + 20, tileB0[1] - 9], [30.1, tileB0[0] + 20, tileB0[1] - 9],
    // Composer
    [30.45, g.title.x + 280, g.title.cy], [31.0, g.title.x + 290, g.title.cy + 4], [31.05, g.desc.x + 300, g.desc.y + 60], [32.3, g.desc.x + 310, g.desc.y + 70],
    [32.5, g.team.x + 300, g.team.cy], [32.6, g.team.x + 300, g.team.cy], [32.85, g.eng.x + 160, g.eng.cy], [33.0, g.eng.x + 160, g.eng.cy],
    [33.2, g.details.x + 80, g.details.cy], [33.3, g.details.x + 80, g.details.cy],
    [33.85, g.create.cx + 30, g.create.cy], [35.7, g.create.cx + 30, g.create.cy],
  ];
  CLICKS = [20.12, 21.92, 23.42, 24.72, 24.97, 28.72, 29.35, 30.45, 32.56, 32.98, 33.26, 34.0];
}
function curAt(t) {
  if (t <= CUR[0][0]) return CUR[0].slice(1);
  for (let i = 1; i < CUR.length; i++) if (t <= CUR[i][0]) {
    const a = CUR[i - 1], b = CUR[i], p = E.inOutCubic((t - a[0]) / (b[0] - a[0]));
    return [lerp(a[1], b[1], p), lerp(a[2], b[2], p)];
  }
  return CUR[CUR.length - 1].slice(1);
}

/* ---------- Scenes ---------- */
const scene = id => document.getElementById(id);
function s1(T) {
  const el = scene('s1');
  const outP = P(T, 1.15, 1.45, E.inCubic);
  tf(el, { s: 1 + T * .02 + outP * .15, o: 1 - outP, blur: outP * 12 });
  chars(S['#s1a'], T, .08, .025, .7, 1.12, .008);
  const scr = $('.scribble path');
  scr.style.strokeDashoffset = scr.dataset.len * (1 - P(T, .5, .95, E.inOutCubic));
  scr.parentNode.style.opacity = 1 - P(T, 1.1, 1.3);
}
/* The old way: six manual steps, each in its own window. */
const STEPS = [[1.3, 2.5], [2.5, 3.7], [3.7, 4.9], [4.9, 6.0], [6.0, 7.2], [7.2, 8.4]];
const PANES = [['#p1', 1.3, 2.5], ['#p2', 2.5, 3.7], ['#p3', 3.7, 4.9], ['#p4', 4.9, 8.45]];
const CLOCK = [[1.3, 0], [2.5, 9], [3.7, 41], [4.9, 78], [6.0, 104], [7.2, 183], [8.4, 236], [9.0, 251]];
function path(keys, T) {
  if (T <= keys[0][0]) return keys[0].slice(1);
  for (let i = 1; i < keys.length; i++) if (T <= keys[i][0]) { const a = keys[i - 1], b = keys[i], p = E.inOutCubic((T - a[0]) / (b[0] - a[0])); return a.slice(1).map((v, k) => lerp(v, b[k + 1], p)); }
  return keys[keys.length - 1].slice(1);
}
function pcur(el, x, y, vis, down) { el.style.opacity = vis ? 1 : 0; el.style.transformOrigin = '7px 4px'; el.style.transform = `translate(${(x - 7).toFixed(1)}px,${(y - 4).toFixed(1)}px) scale(${down ? .86 : 1})`; }
function s0(T) {
  const el = scene('s0');
  const out = P(T, 8.35, 8.75, E.inCubic);
  el.style.opacity = P(T, 1.2, 1.45, E.lin) * (1 - out);
  el.style.transform = `scale(${(1 + out * .12).toFixed(4)})`;
  el.style.filter = out > .01 ? `blur(${(out * 10).toFixed(1)}px)` : '';
  // Left column: step, title, progress rail, clock.
  const si = STEPS.findIndex(([a, b]) => T < b), idx = si < 0 ? 5 : si;
  $('#oldStep').textContent = `0${idx + 1} / 06`;
  S.ots.forEach((c, i) => chars(c, T, STEPS[i][0] + .02, .016, .7, i === 5 ? Infinity : STEPS[i][1] - .16, .005));
  $$('#rail i').forEach((r, i) => { r.style.setProperty('--p', P(T, STEPS[i][0], STEPS[i][1], E.lin).toFixed(3)); r.style.setProperty('--fill', i >= 3 ? '#FF8799' : '#F3B66B'); });
  let sec = 0;
  for (let i = 1; i < CLOCK.length; i++) if (T <= CLOCK[i][0] || i === CLOCK.length - 1) { const a = CLOCK[i - 1], b = CLOCK[i]; sec = lerp(a[1], b[1], clamp((T - a[0]) / (b[0] - a[0]))); break; }
  sec = Math.floor(sec);
  const tm = $('#timer'); tm.textContent = `${String(sec / 60 | 0).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
  tm.style.color = sec > 90 ? '#FF8799' : '';
  $('#win').style.perspective = '2200px';
  PANES.forEach(([id, a, b]) => {
    const pe = $(id), p = P(T, a - .05, a + .5, E.outExpo), q = P(T, b - .12, b + .25, E.inCubic);
    const on = T >= a - .05 && T < b + .25;
    pe.style.display = on ? 'block' : 'none';
    if (on) tf(pe, { x: (1 - p) * 460 - q * 460, ry: (1 - p) * -14 + q * 10, s: lerp(.94, 1, p) - q * .04, o: clamp(p * 2) * (1 - q), blur: (1 - p) * 12 + q * 12 });
  });
  // P1: Win+Shift+S, the Snipping Tool overlay, a region drag, the Windows toast.
  const k = $('#prt'), kin = P(T, 1.36, 1.5) * (1 - P(T, 1.66, 1.78, E.lin));
  k.style.opacity = kin; k.style.transform = `translateX(-50%) translateY(${((1 - kin) * 12).toFixed(1)}px)`;
  [...k.children].forEach((kb, i) => { const d = T >= 1.44 + i * .05 && T < 1.7 ? 1 : 0; kb.style.transform = `translateY(${d * 4}px)`; kb.style.borderColor = d ? 'rgba(140,220,193,.8)' : ''; kb.style.color = d ? '#8CDCC1' : ''; });
  const snipOn = T >= 1.6 && T < 2.16, sr = G.p.shot;
  $('#snipdim').style.opacity = snipOn && T < 1.84 ? P(T, 1.6, 1.68, E.lin) : 0;
  const sb = $('#snipbar'), sbp = P(T, 1.62, 1.8);
  sb.style.opacity = snipOn ? sbp : 0; sb.style.transform = `translateX(-50%) translateY(${((1 - sbp) * -20).toFixed(1)}px)`;
  const dragP = P(T, 1.84, 2.12, E.inOutCubic);
  const cx1 = T < 1.84 ? lerp(620, sr.x, P(T, 1.64, 1.82, E.inOutCubic)) : lerp(sr.x, sr.x + sr.w, dragP);
  const cy1 = T < 1.84 ? lerp(560, sr.y, P(T, 1.64, 1.82, E.inOutCubic)) : lerp(sr.y, sr.y + sr.h, dragP);
  const pc = $('#pcross'); pc.style.opacity = snipOn && T >= 1.64 ? 1 : 0; pc.style.transform = `translate(${cx1.toFixed(1)}px,${cy1.toFixed(1)}px)`;
  const ss = $('#snipsel');
  ss.style.opacity = snipOn && T >= 1.84 ? 1 : 0;
  Object.assign(ss.style, { left: sr.x + 'px', top: sr.y + 'px', width: Math.max(0, cx1 - sr.x) + 'px', height: Math.max(0, cy1 - sr.y) + 'px' });
  $('#p1flash').style.opacity = T >= 2.16 ? .85 * (1 - P(T, 2.16, 2.45, E.outCubic)) : 0;
  const tp = P(T, 2.2, 2.45);
  $('#toast').style.opacity = tp; $('#toast').style.transform = `translateX(${((1 - tp) * 60).toFixed(1)}px)`;
  // P2: scribble with the pencil; the cursor rides the stroke.
  const w = $('#wob'), len = +w.dataset.len, dp = P(T, 3.0, 3.5, E.inOutCubic);
  w.style.strokeDashoffset = (len * (1 - dp)).toFixed(1);
  const pt = w.getPointAtLength(len * dp), p0 = w.getPointAtLength(0), pen = G.p.pencil;
  const c2 = T < 2.98 ? path([[2.62, pen.cx + 60, pen.cy + 90], [2.78, pen.cx, pen.cy], [2.85, pen.cx, pen.cy], [2.98, p0.x, p0.y + G.p.paintTop]], T) : [pt.x, pt.y + G.p.paintTop];
  pcur($('#c2'), c2[0], c2[1], T >= 2.62 && T < 3.62, (T > 2.8 && T < 2.9) || (T >= 3 && T < 3.5));
  // P3: Save As
  const fname = 'Screenshot (14).png', n = Math.floor(P(T, 4.0, 4.42, E.lin) * fname.length);
  $('#sname').innerHTML = esc(fname.slice(0, n)) + (T < 4.7 && (Math.floor(T * 2.4) % 2 === 0 || (T > 4 && T < 4.42)) ? '<span class="caret" style="background:#111"></span>' : '');
  const sv = G.p.save, sn = G.p.sname;
  const c3 = path([[4.4, sn.x + 260, sn.cy + 6], [4.62, sv.cx, sv.cy], [4.9, sv.cx, sv.cy]], T);
  const saveDown = T >= 4.66 && T < 4.78;
  $('#sSave').style.background = saveDown ? '#1e40af' : '';
  pcur($('#c3'), c3[0], c3[1], T >= 4.4 && T < 4.95, saveDown);
  // P4: the tracker; zoom inside the window per step.
  const Z = [{ t: 4.9, s: 1, px: 520, py: 330 }, { t: 5.3, s: 1.3, px: 560, py: 250 }, { t: 6.0, s: 1.32, px: 575, py: 262, e: E.lin }, { t: 6.35, s: 1.28, px: 590, py: 300 }, { t: 7.2, s: 1.25, px: 590, py: 312, e: E.lin }, { t: 7.5, s: 1, px: 520, py: 330 }];
  const z = kf(Z, T);
  $('#p4in').style.transform = `translate(${(520 - z.px * z.s).toFixed(1)}px,${(330 - z.py * z.s).toFixed(1)}px) scale(${z.s.toFixed(4)})`;
  const blink = Math.floor(T * 2.4) % 2 === 0, tc = '<span class="caret" style="background:#8CDCC1"></span>';
  const title = 'Billing broken??', nt = Math.floor(P(T, 5.3, 5.75, E.lin) * title.length);
  $('#tTitle').innerHTML = nt ? esc(title.slice(0, nt)) + (T < 6.05 && (blink || T < 5.75) ? tc : '') : '<span class="ph2">Issue title</span>' + (T >= 5.2 && blink ? tc : '');
  const desc = 'Total looks wrong, see screenshot. It’s near the bottom right I think?? (ignore my email in it, sorry)';
  const nd = Math.floor(P(T, 6.15, 7.1, E.lin) * desc.length);
  $('#tDesc').innerHTML = nd ? esc(desc.slice(0, nd)) + (T < 7.3 && (blink || T < 7.1) ? tc : '') : '<span class="ph2">Add description…</span>';
  const dlp = P(T, 7.22, 7.5);
  $('#dl').style.opacity = dlp; $('#dl').style.transform = `translateY(${((1 - dlp) * 40).toFixed(1)}px)`;
  const hit = G.p.hit, drop = G.p.drop, ti = G.p.title, de = G.p.desc;
  const c4 = path([[5.02, ti.x + 300, ti.cy + 60], [5.2, ti.x + 8, ti.cy], [6.0, ti.x + 190, ti.cy + 4], [6.12, de.x + 12, de.y + 16], [7.12, de.x + 260, de.y + 70], [7.42, hit.x + 60, hit.cy], [7.5, hit.x + 60, hit.cy], [8.0, drop.cx, drop.cy], [8.4, drop.cx + 20, drop.cy + 10]], T);
  const dragging = T >= 7.48 && T < 8.0;
  pcur($('#c4'), c4[0], c4[1], T >= 5.02 && T < 8.4, dragging || (T > 5.18 && T < 5.26) || (T > 6.1 && T < 6.18));
  const chip = $('#dragchip');
  chip.style.opacity = dragging ? 1 : 0;
  chip.style.transform = `translate(${(c4[0] + 12).toFixed(1)}px,${(c4[1] + 14).toFixed(1)}px) rotate(-3deg)`;
  $('#tDrop').classList.toggle('hot', T >= 7.68 && T < 8.02);
  const up = P(T, 8.02, 8.45, E.lin);
  $('#tUp').style.opacity = T >= 8.02 ? 1 : 0;
  $('#tDropTxt').textContent = `Uploading Screenshot (14).png… ${Math.round(up * 64)}%`;
  $('#tProg').style.width = (up * 64) + '%';
}
function s2(T) {
  const el = scene('s2');
  el.style.opacity = P(T, 8.3, 8.5, E.lin);
  const implode = P(T, 10.25, 10.9, E.inExpo);
  let shake = 0;
  S.cards.forEach(c => { const d = T - c.a; if (d > 0) shake += Math.exp(-d * 9) * Math.sin(d * 60) * 4; });
  const cam = 1 + P(T, 8.4, 10.3, E.lin) * .08;
  tf($('#pile'), { s: cam, y: shake, blur: P(T, 8.9, 9.4) * 5 * (1 - implode) });
  $('#pile').style.filter += ` brightness(${(1 - P(T, 8.9, 9.4) * .5).toFixed(3)})`;
  S.cards.forEach((c, i) => {
    const sp = spring(T - c.a, 1.7, .45);
    const x = lerp(c.x + c.jx, 810, implode), y = lerp(c.y - 90 * (1 - sp), 443, implode);
    c.el.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) rotate(${(c.r * sp + implode * (i % 2 ? 160 : -160)).toFixed(2)}deg) scale(${(lerp(.5, 1, sp) * (1 - implode * .95)).toFixed(3)})`;
    c.el.style.opacity = (T >= c.a ? 1 : 0) * (1 - P(T, 10.7, 10.9, E.lin));
  });
  S.bubbles.forEach(b => {
    const sp = spring(T - b.a, 2, .5);
    const x = lerp(b.x, 860, implode), y = lerp(b.y + 30 * (1 - sp), 500, implode);
    b.el.style.transformOrigin = '0 100%';
    b.el.style.transform = `translate(${x}px,${y}px) scale(${(lerp(.6, 1, sp) * (1 - implode)).toFixed(3)})`;
    b.el.style.opacity = (T >= b.a ? clamp(sp * 2) : 0) * (1 - P(T, 10.55, 10.85, E.lin));
  });
  const head = $('.s2-head');
  tf(head, { o: 1 - P(T, 10.3, 10.75, E.lin), blur: implode * 20 });
  head.style.transform = `translateY(-50%) scale(${(1 - implode * .5 + P(T, 8.9, 10.3, E.lin) * .04).toFixed(4)})`;
  chars(S['#s2a'], T, 8.85, .022, .8);
  chars(S.s2b, T, 9.35, .03, .9);
}
function logoDraw(root, t, a) {
  const p = root.querySelectorAll('path');
  const seg = [[a, a + .5], [a + .08, a + .58], [a + .16, a + .66], [a + .45, a + .8], [a + .66, a + .95]];
  p.forEach((el, i) => el.style.strokeDashoffset = el.dataset.len * (1 - P(t, seg[i][0], seg[i][1], i >= 3 ? E.outQuart : E.inOutCubic)));
  const tile = root.querySelector('.tile');
  const sp = spring(t - (a + .72), 1.8, .5);
  tile.style.transform = `scale(${Math.max(0, sp).toFixed(4)})`;
  tile.style.opacity = t > a + .72 ? 1 : 0;
  return spring(t - a, 1.2, .55);
}
function s3(t) {
  const el = scene('s3');
  el.style.opacity = 1;
  const exitTag = P(t, 11.2, 11.55, E.inCubic);
  const zoom = P(t, 11.45, 12.2, E.inExpo);
  const sp = logoDraw($('#logo3'), t, 8.05);
  const slide = P(t, 9.25, 10.1, E.inOutQuart);
  const off = (G.word3 + 44) / 2;
  const lock = $('#s3 .lockup');
  lock.style.transform = `translate(calc(-50% + ${(off * (1 - slide)).toFixed(1)}px), -50%)`;
  const logo = $('#logo3');
  logo.style.transform = `translateX(${(zoom * -40).toFixed(1)}px) scale(${(lerp(.55, 1, sp) * (1 + zoom * 16)).toFixed(4)})`;
  logo.style.opacity = 1 - P(t, 11.95, 12.25, E.lin);
  logo.style.filter = zoom > .02 ? `blur(${(zoom * 6).toFixed(2)}px)` : '';
  const word = $('#word3');
  word.style.opacity = 1 - exitTag;
  word.style.filter = exitTag > .01 ? `blur(${exitTag * 16}px)` : '';
  chars(S['#word3'], t, 9.45, .045, 1.0);
  const tag = $$('#tag3 span');
  tag.forEach((s, i) => {
    const p = P(t, 10.05 + i * .42, 10.85 + i * .42);
    s.style.transform = `translateY(${((1 - p) * 30).toFixed(1)}px)`; s.style.opacity = p * (1 - exitTag);
    s.style.filter = (1 - p) * 12 + exitTag * 14 > .1 ? `blur(${((1 - p) * 12 + exitTag * 14).toFixed(1)}px)` : '';
  });
  const rays = $('#rays');
  rays.style.opacity = P(t, 8.1, 9.2, E.outCubic) * (1 - P(t, 11.3, 11.9, E.lin));
  rays.style.transform = `rotate(${(t * 4).toFixed(2)}deg) scale(${(1 + zoom * 2).toFixed(3)})`;
}
function s4(t) {
  const el = scene('s4');
  el.style.opacity = P(t, 11.55, 11.95, E.lin);
  const intro = P(t, 11.55, 12.7, E.outExpo);
  const post = P(t, 15.2, 15.9, E.outCubic);
  const desk = $('#desk');
  desk.style.transform = `scale(${(lerp(1.22, 1, intro) + P(t, 13.3, 15.2, E.inOutCubic) * .03).toFixed(4)})`;
  desk.style.filter = post > 0 ? `blur(${(post * 8).toFixed(2)}px) brightness(${(1 - post * .55).toFixed(3)})` : '';
  desk.style.opacity = 1 - P(t, 17.1, 17.8, E.lin);
  // Shortcut keys
  const keys = $('#keys');
  const kin = P(t, 12.25, 12.6), kout = P(t, 13.2, 13.45, E.inCubic);
  keys.style.opacity = kin * (1 - kout);
  keys.style.transform = `translateX(-50%) translateY(${((1 - kin) * 40 + kout * 20).toFixed(1)}px)`;
  [['#k1', 12.6], ['#k2', 12.75], ['#k3', 12.9]].forEach(([id, a]) => {
    const k = $(id), d = P(t, a, a + .08, E.outCubic);
    k.style.transform = `translateY(${(d * 5).toFixed(2)}px)`;
    k.style.boxShadow = d > 0 ? `inset 0 1px 0 rgba(255,255,255,.12), 0 ${6 - d * 5}px 0 #0C1412, 0 0 ${d * 34}px rgba(140,220,193,${(d * .45).toFixed(2)})` : '';
    k.style.borderColor = d > .5 ? 'rgba(140,220,193,.8)' : '';
    k.style.color = d > .5 ? '#8CDCC1' : '';
  });
  // Freeze and region
  const fr = P(t, 13.15, 13.4, E.outCubic);
  const src = G.src;
  const selOn = t >= 13.97 && t < 15.7;
  $('#freeze').style.opacity = selOn || t >= 15.7 ? 0 : fr;
  const cr = $('#cross');
  const startX = 1350, startY = 820;
  let cx, cy;
  if (t < 13.97) { const p = P(t, 13.4, 13.95, E.inOutCubic); cx = lerp(startX, src.x, p); cy = lerp(startY, src.y, p); }
  else { const p = P(t, 14.0, 15.1, E.inOutCubic); cx = lerp(src.x, src.x + src.w, p); cy = lerp(src.y, src.y + src.h, p); }
  cr.style.opacity = t >= 13.35 && t < 15.18 ? 1 : 0;
  cr.style.transform = `translate(${cx.toFixed(1)}px,${cy.toFixed(1)}px)`;
  const sel = $('#sel');
  if (selOn) {
    const w = Math.max(0, cx - src.x), h = Math.max(0, cy - src.y);
    const done = P(t, 15.2, 15.65, E.lin);
    Object.assign(sel.style, { opacity: 1, left: src.x + 'px', top: src.y + 'px', width: w + 'px', height: h + 'px' });
    sel.style.boxShadow = `0 0 0 ${(1.5 + done * 6).toFixed(1)}px rgba(140,220,193,${(.95 * (1 - done)).toFixed(2)}), 0 0 0 4000px rgba(2,8,7,${(.62 * fr * (1 - done)).toFixed(3)})`;
    sel.querySelectorAll('.c').forEach(c => c.style.opacity = 1 - done);
    $('#dims').textContent = `${Math.round(w / 1.25)} × ${Math.round(h / 1.25)}`;
    $('#dims').style.opacity = 1 - done;
  } else sel.style.opacity = 0;
}
function flyer(t) {
  const f = $('#flyer');
  const on = t >= 15.15 && t < 18.45;
  f.style.display = on ? 'block' : 'none';
  if (!on) return;
  const src = G.src, dst = G.edImgStage;
  const lift = P(t, 15.2, 15.9, E.outExpo), fly = P(t, 17.2, 18.4, E.inOutExpo);
  const hx = src.x + 260 * lift, hy = src.y - 10 * lift, hw = src.w * (1 + .02 * lift);
  const drift = P(t, 15.9, 17.2, E.lin);
  const x = lerp(hx + drift * 14, dst.x, fly), y = lerp(hy - drift * 4, dst.y, fly), w = lerp(hw * (1 + drift * .015), dst.w, fly);
  const rot = (1 - fly) * lift * -1.2 + Math.sin(fly * Math.PI) * 3;
  f.style.transform = `translate(${x.toFixed(2)}px,${y.toFixed(2)}px) rotate(${rot.toFixed(3)}deg) scale(${(w / 640).toFixed(5)})`;
  f.style.boxShadow = `0 ${50 * (1 - fly)}px ${100 * (1 - fly) + 20}px -20px rgba(0,0,0,.8), 0 0 0 ${(1.5 / (w / 640)).toFixed(2)}px rgba(140,220,193,${(.6 * (1 - fly)).toFixed(2)})`;
}
function s5(t) {
  const el = scene('s5');
  el.style.opacity = 1 - P(t, 36.9, 37.5, E.lin);
  const ed = $('#ed');
  const c = kf(CAM, t);
  // Gentle hand-held life on top of the keyed camera.
  const hx = Math.sin(t * .9) * 3, hy = Math.cos(t * .7) * 2.5;
  const win = P(t, 17.55, 18.3, E.outExpo);
  const pulse = t > 35.55 ? (1 - spring(t - 35.55, 2.4, .35)) * -.05 : 0;
  ed.style.transform = `translate(${(c.cx + hx).toFixed(2)}px,${(c.cy + hy).toFixed(2)}px) rotateX(${c.rx.toFixed(3)}deg) rotateY(${c.ry.toFixed(3)}deg) scale(${(c.s * lerp(.965, 1, win) * (1 + pulse)).toFixed(4)}) translate(${-c.px}px,${-c.py}px)`;
  ed.style.opacity = win;
  const out = P(t, 36.6, 37.5, E.inCubic);
  ed.style.filter = out > .01 ? `blur(${(out * 10).toFixed(2)}px)` : '';
  // Chrome build-in
  const part = (sel, a, dx, dy) => { const p = P(t, a, a + .75); const e = $(sel); e.style.transform = `translate(${((1 - p) * dx).toFixed(1)}px,${((1 - p) * dy).toFixed(1)}px)`; e.style.opacity = p; };
  part('#toolbar', 17.85, 0, -30); part('#util', 18.0, 30, 0); part('#composer', 18.05, 60, 0); part('#bottombar', 18.15, 0, 24); part('#film', 18.25, 0, 30);
  $('#edImg').style.opacity = t >= 18.4 ? 1 : 0;
  // Tools
  const toolAt = t < 20.12 ? 'select' : t < 21.92 ? 'rectangle' : t < 23.42 ? 'pixelate' : t < 24.72 ? 'arrow' : t < 25.8 ? 'step' : 'select';
  const since = [[20.12, 'rectangle'], [21.92, 'pixelate'], [23.42, 'arrow'], [24.72, 'step']].find(([a, n]) => n === toolAt);
  $$('.tb[data-tool]').forEach(b => {
    const on = b.dataset.tool === toolAt; b.classList.toggle('on', on);
    b.style.transform = on && since ? `scale(${(.8 + .2 * spring(t - since[0], 3, .35)).toFixed(4)})` : '';
  });
  // Annotations
  const R = G.rect, X = G.pix;
  const rp = P(t, 20.55, 21.25, E.inOutCubic), xp = P(t, 22.2, 22.9, E.inOutCubic);
  setAnn(annEd, {
    rect: t >= 20.55 ? [R[0], R[1], lerp(R[0] + 1, R[2], rp), lerp(R[1] + 1, R[3], rp)] : null,
    pix: t >= 22.2 ? [X[0], X[1], lerp(X[0], X[2], xp), lerp(X[1], X[3], xp)] : null,
    arrow: P(t, 23.7, 24.3, E.inOutCubic),
    step: t >= 24.97 ? spring(t - 24.97, 2.6, .4) : 0,
  });
  // Filmstrip
  const tI = $('#tileI'), tB = $('#tileB');
  const addP = spring(t - 28.85, 2.2, .45);
  const re = P(t, 29.38, 29.95, E.inOutCubic);
  tI.style.opacity = t >= 28.85 ? clamp(addP * 3) : 0;
  const lift = t >= 29.35 && t < 30.05 ? Math.sin(P(t, 29.35, 30.05, E.lin) * Math.PI) : 0;
  tI.style.left = lerp(G.slot[1], G.slot[0], re) + 'px'; tI.style.transform = `translateY(${(-lift * 14).toFixed(1)}px) scale(${(lerp(.5, 1, addP) + lift * .06).toFixed(4)}) rotate(${(lift * -3).toFixed(2)}deg)`;
  tI.style.zIndex = 3; tI.style.boxShadow = lift > 0 ? `0 ${20 * lift}px ${40 * lift}px -10px rgba(0,0,0,.7)` : '';
  tB.style.left = lerp(G.slot[0], G.slot[1], re) + 'px';
  tB.classList.add('on');
  tI.querySelector('.num').textContent = t >= 29.95 ? '1' : '2';
  tB.querySelector('.num').textContent = t >= 29.95 ? '2' : '1';
  const addBtn = $('#addImg');
  addBtn.style.left = (t >= 28.85 ? lerp(G.slot[1], G.slot[1] + 156, P(t, 28.85, 29.25)) + 158 : 330 - 156 + 0) + 'px';
  if (t < 28.85) addBtn.style.left = '172px';
  addBtn.style.transform = Math.abs(t - 28.72) < .12 ? 'scale(.95)' : '';
  // Title and description typing
  const title = 'Billing shows $0.00 for a paid team plan';
  const desc = 'Total due is $0.00 in @image2, but the invoice in @image1 says $60.00.';
  const nT = Math.floor(P(t, 30.5, 31.0, E.lin) * title.length), nD = Math.floor(P(t, 31.08, 32.3, E.lin) * desc.length);
  const blink = Math.floor(t * 2.4) % 2 === 0;
  const fT = $('#fTitle'), fD = $('#fDesc');
  const tFocus = t >= 30.45 && t < 31.05, dFocus = t >= 31.05 && t < 32.5;
  fT.classList.toggle('focus', tFocus); fD.classList.toggle('focus', dFocus);
  fT.querySelector('.ph').style.display = nT ? 'none' : ''; fD.querySelector('.ph').style.display = nD ? 'none' : '';
  const caret = on => on ? '<span class="caret"></span>' : '';
  fT.querySelector('.val').innerHTML = esc(title.slice(0, nT)) + caret(tFocus && (blink || (t > 30.5 && t < 31.0)));
  fD.querySelector('.val').innerHTML = esc(desc.slice(0, nD)).replace(/@image\d?/g, m => `<span class="chip">${m}</span>`) + caret(dFocus && (blink || (t > 31.08 && t < 32.3)));
  // Team select
  const menu = $('#teamMenu');
  const mo = P(t, 32.58, 32.75, E.outCubic) * (1 - P(t, 33.0, 33.12, E.inCubic));
  menu.style.opacity = mo; menu.style.transform = `scale(${lerp(.96, 1, mo).toFixed(4)}) translateY(${((1 - mo) * -6).toFixed(1)}px)`;
  $('#optEng').classList.toggle('hover', t >= 32.82);
  const team = $('#fTeam');
  team.classList.toggle('set', t >= 33.0); team.classList.toggle('focus', t >= 32.56 && t < 33.1);
  team.querySelector('.val').textContent = t >= 33.0 ? 'Engineering' : 'Choose a team';
  // Details
  const dp = P(t, 33.28, 33.7, E.outExpo);
  $('#drows').style.height = (dp * 168).toFixed(1) + 'px';
  $('#details .chev').style.transform = `rotate(${(dp * 90).toFixed(1)}deg)`;
  // Create
  const btn = $('#createBtn');
  const press = t >= 34.0 && t < 34.14 ? .965 : 1;
  btn.style.transform = `scale(${press})`;
  const up = P(t, 34.1, 35.45, E.inOutCubic);
  $('#createFill').style.width = (up * 100).toFixed(2) + '%';
  $('#createTxt').textContent = t < 34.08 ? 'Create issue' : t < 34.75 ? 'Uploading 1 of 2' : t < 35.2 ? 'Uploading 2 of 2' : t < 35.55 ? 'Creating issue' : 'Create issue';
  $('#createChev').style.opacity = t >= 34.08 && t < 35.55 ? 0 : 1;
  // Success
  const form = $('#form'), sent = $('#sent');
  const fo = P(t, 35.5, 35.7, E.lin);
  form.style.opacity = 1 - fo; form.style.transform = `translateY(${(-fo * 16).toFixed(1)}px)`;
  sent.style.opacity = P(t, 35.58, 35.7, E.lin);
  const circ = sent.querySelector('circle'), chk = sent.querySelector('path');
  circ.style.strokeDashoffset = 145 * (1 - P(t, 35.6, 36.2, E.outCubic));
  chk.style.strokeDashoffset = 36 * (1 - P(t, 36.02, 36.36, E.outCubic));
  const bp = P(t, 36.05, 36.95, E.outCubic);
  const cols = ['#F3B66B', '#76D5A8', '#8CDCC1'];
  $$('#burst i').forEach((p, i) => {
    const ang = i / 14 * Math.PI * 2 + .2, d = 22 + bp * (46 + (i % 3) * 12);
    p.style.background = cols[i % 3]; p.style.borderRadius = i % 3 === 0 ? '50%' : '2px';
    p.style.transform = `translate(${(Math.cos(ang) * d).toFixed(1)}px,${(Math.sin(ang) * d).toFixed(1)}px) rotate(${(bp * 180 + i * 20).toFixed(0)}deg) scale(${(1 - bp * .6).toFixed(3)})`;
    p.style.opacity = t >= 36.05 ? 1 - P(t, 36.5, 36.95, E.lin) : 0;
  });
  [...sent.children].slice(1).forEach((c2, i) => { const p = P(t, 36.05 + i * .08, 36.55 + i * .08); c2.style.opacity = p; c2.style.transform = `translateY(${((1 - p) * 16).toFixed(1)}px)`; });
  // Cursor
  const cur = $('#cursor');
  const [x, y] = curAt(t);
  const vis = (t >= 19.2 && t < 25.3) || (t >= 28.3 && t < 35.7);
  cur.style.opacity = vis ? 1 : 0;
  const lastClick = CLICKS.filter(c3 => c3 <= t).pop() ?? -9, dc = t - lastClick;
  const dragging = (t > 20.55 && t < 21.25) || (t > 22.2 && t < 22.9) || (t > 23.7 && t < 24.3) || (t > 29.35 && t < 29.95);
  const sq = dc < .12 || dragging ? .86 : 1;
  cur.style.transform = `translate(${(x - 7).toFixed(1)}px,${(y - 5).toFixed(1)}px) scale(${sq / Math.max(.9, c.s * .72)})`;
  cur.style.transformOrigin = '7px 5px';
  const ring = cur.querySelector('.ring');
  ring.style.opacity = dc < .45 ? (1 - dc / .45) : 0;
  ring.style.transform = `scale(${(.4 + dc * 2.2).toFixed(3)})`;
}
function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
function s7(t) {
  const el = scene('s7');
  el.style.opacity = P(t, 36.4, 36.9, E.lin) * (1 - P(t, 40.05, 40.5, E.lin));
  const p = P(t, 36.4, 37.9, E.outExpo);
  const issue = $('#issue');
  const out = P(t, 39.9, 40.5, E.inCubic);
  issue.style.transform = `translate(${lerp(120, 0, p).toFixed(1)}px,${(lerp(380, 0, p) - out * 60).toFixed(1)}px) rotateX(${lerp(34, 9, p).toFixed(2)}deg) rotateY(${(lerp(-24, -12, p) + P(t, 37.9, 40.4, E.lin) * 4).toFixed(2)}deg) rotateZ(${lerp(4, 1.5, p).toFixed(2)}deg) scale(${lerp(.82, .9, p).toFixed(4)})`;
  issue.style.left = '760px'; issue.style.top = '120px';
  issue.style.filter = out > .01 ? `blur(${out * 12}px)` : '';
  $('#imain').style.transform = `translateY(${(-P(t, 37.6, 40.4, E.inOutCubic) * 520).toFixed(1)}px)`;
}
function s8(t) {
  const el = scene('s8');
  el.style.opacity = P(t, 40.0, 40.35, E.lin);
  const out = P(t, 47.3, 48.1, E.inExpo);
  chars(S['#s8a'], t, 40.2, .03, .85);
  chars(S.s8b, t, 40.5, .03, .9);
  $('.s8-head').style.opacity = 1 - P(t, 47.2, 47.7, E.lin);
  const bento = $('#bento');
  bento.style.transform = `scale(${(1 + P(t, 40.9, 47.3, E.lin) * .025).toFixed(4)})`;
  ['#c1', '#c2', '#c3', '#c4', '#c5'].forEach((id, i) => {
    const c = $(id), a = 40.95 + i * .25;
    const sp = spring(t - a, 1.5, .55);
    const cx = [-420, 540, -540, 0, 540][i], cy = [-180, -180, 180, 180, 180][i];
    c.style.transform = `translate(${(-cx * out * .9).toFixed(1)}px,${((1 - sp) * 110 - cy * out * .9).toFixed(1)}px) scale(${(lerp(.9, 1, sp) * (1 - out * .7)).toFixed(4)}) rotate(${((1 - sp) * (i % 2 ? 2 : -2)).toFixed(2)}deg)`;
    c.style.opacity = (t >= a ? clamp(sp * 1.6) : 0) * (1 - out);
    c.style.filter = out > .01 ? `blur(${out * 14}px)` : '';
  });
  const foot = $('#s8foot'), fp = P(t, 42.5, 43.2);
  foot.style.opacity = fp * (1 - P(t, 47.2, 47.6, E.lin)); foot.style.transform = `translateY(${((1 - fp) * 20).toFixed(1)}px)`;
  // c1: screenshots approach the boundary and stay on this side.
  $$('#bDots i').forEach((d, i) => {
    const ph = (t * .55 + i / 3) % 1, x = 10 + 196 * Math.sin(ph * Math.PI);
    d.style.transform = `translate(${x.toFixed(1)}px,${(40 + i * 64).toFixed(1)}px) rotate(${(Math.sin(ph * 6.28) * 4).toFixed(2)}deg)`;
  });
  const near = Math.max(...[0, 1, 2].map(i => Math.sin(((t * .55 + i / 3) % 1) * Math.PI)));
  $('.boundary .lock').style.boxShadow = `0 0 ${(20 + near ** 8 * 40).toFixed(0)}px rgba(140,220,193,${(.2 + near ** 8 * .4).toFixed(2)})`;
  // c2: pixel blocks
  const step = Math.floor(t * 5);
  S.pix.forEach((b, i) => {
    const x = i % 10, y = i / 10 | 0;
    const base = 70 + (Math.sin(x * .9 + y * 1.3) * .5 + .5) * 120;
    const flick = (Math.sin(step * 1.7 + i * 12.9898) * 43758.5453) % 1;
    const v = clamp((base + (flick - .5) * 50 * b.k) / 255);
    const tint = x > 5 && y > 1 ? [140, 220, 193] : [235, 243, 238];
    b.e.style.background = `rgb(${tint.map(c => (c * v * .9 + 20) | 0).join(',')})`;
  });
  // c3: keys
  const kt = (t - 41) % 1.8;
  [['#kk1', .1], ['#kk2', .22], ['#kk3', .34]].forEach(([id, a]) => {
    const k = $(id), d = kt > a && kt < 1.0 ? 1 : 0;
    k.style.transform = `translateY(${d * 5}px)`; k.style.borderColor = d ? 'rgba(140,220,193,.8)' : ''; k.style.color = d ? '#8CDCC1' : '';
    k.style.boxShadow = d ? 'inset 0 1px 0 rgba(255,255,255,.12), 0 1px 0 #0C1412, 0 0 26px rgba(140,220,193,.4)' : '';
  });
  // c4: restore ring
  const rt = (t - 41.5) % 2.4, rp = E.inOutCubic(clamp(rt / 1.2));
  $('#rArc').style.strokeDashoffset = (188.5 * (1 - rp)).toFixed(2);
  $('#rTxt').textContent = rt < 1.2 ? 'Restoring draft…' : 'Draft restored ✓';
  $('#rTxt').style.color = rt < 1.2 ? '#97ADA5' : '#8CDCC1';
  // c5: ten images funnel into one issue
  $$('#funnel i').forEach((f, i) => {
    const ph = ((t - 41.6) * .5 + i / 10) % 1;
    const x0 = (i % 5) * 50, y0 = (i / 5 | 0) * 58 + 22;
    const p = E.inOutCubic(clamp(ph * 1.4));
    f.style.transform = `translate(${lerp(x0, 330, p).toFixed(1)}px,${lerp(y0, 62, p).toFixed(1)}px) scale(${lerp(1, .3, p).toFixed(3)})`;
    f.style.opacity = (1 - clamp((p - .85) / .15)) * clamp(ph * 8);
  });
}
function s9(t) {
  const el = scene('s9');
  el.style.opacity = P(t, 47.6, 48.0, E.lin);
  const sp = logoDraw($('#logo9'), t, 47.85);
  const slide = P(t, 48.75, 49.5, E.inOutQuart);
  const off = (G.word9 + 44) / 2;
  const lock = $('#s9 .lockup');
  lock.style.transform = `translate(calc(-50% + ${(off * (1 - slide)).toFixed(1)}px), -50%) scale(${(1 + P(t, 48, 54, E.lin) * .03).toFixed(4)})`;
  $('#logo9').style.transform = `scale(${lerp(.55, 1, sp).toFixed(4)})`;
  chars(S['#word9'], t, 48.9, .045, 1.0);
  $$('#tag9 span').forEach((s, i) => {
    const a = 49.55 + i * .5, p = P(t, a, a + .8), pop = spring(t - a, 2.2, .45);
    s.style.opacity = p; s.style.transform = `translateY(${((1 - p) * 26).toFixed(1)}px) scale(${lerp(.9, 1, pop).toFixed(4)})`;
    s.style.filter = p < .98 ? `blur(${((1 - p) * 10).toFixed(1)}px)` : '';
  });
  const cta = $('#cta'), cp = spring(t - 51.0, 1.6, .55);
  cta.style.opacity = t >= 51.0 ? clamp(cp * 1.5) : 0;
  cta.style.transform = `translateX(-50%) translateY(${((1 - cp) * 40).toFixed(1)}px) scale(${lerp(.92, 1, cp).toFixed(4)})`;
  const pl = P(t, 51.4, 52.2);
  $('#plat').style.opacity = pl; $('#plat').style.transform = `translateY(${((1 - pl) * 16).toFixed(1)}px)`;
}

/* ---------- Global layers ---------- */
function bigword(id, t, a, b) {
  const el = $(id);
  const p = P(t, a, a + .9), o = P(t, b - .45, b, E.inCubic);
  el.style.opacity = t >= a && t < b ? 1 : 0;
  const bw = el.querySelector('b'), st = el.querySelector('.step'), sm = el.querySelector('small');
  bw.style.transform = `translateX(${((1 - p) * -80 - o * 60).toFixed(1)}px)`; bw.style.opacity = clamp(p * 1.5) * (1 - o);
  bw.style.filter = (1 - p) * 20 + o * 20 > .1 ? `blur(${((1 - p) * 20 + o * 20).toFixed(1)}px)` : '';
  bw.style.letterSpacing = `${(-0.06 + (1 - p) * .08).toFixed(4)}em`;
  const q = P(t, a + .25, a + 1.0);
  st.style.opacity = sm.style.opacity = q * (1 - o);
  sm.style.transform = `translateY(${((1 - q) * 20).toFixed(1)}px)`;
}
const CAPS = [[19.55, 21.45, 'Box what’s wrong'], [21.6, 23.25, 'Pixelate anything private'], [23.35, 25.05, 'Point straight at it'],
  [28.35, 30.2, 'Add every screenshot it takes'], [30.3, 32.4, 'Reference images with @image'], [32.5, 33.9, 'Pick the team and details'], [34.0, 35.55, 'Nothing uploads until you press Create']];
function caption(t) {
  const c = $('#cap');
  const cur = CAPS.find(([a, b]) => t >= a && t < b);
  if (!cur) { c.style.opacity = 0; return; }
  const [a, b, txt] = cur;
  const pi = P(t, a, a + .35), po = P(t, b - .2, b, E.inCubic);
  c.style.opacity = pi * (1 - po);
  c.style.transform = `translateX(-50%) translateY(${((1 - pi) * 24 + po * 10).toFixed(1)}px) scale(${lerp(.94, 1, pi).toFixed(4)})`;
  if ($('#capTxt').textContent !== txt) $('#capTxt').textContent = txt;
}
function globals(t) {
  const flashes = [[7.95, .85, .55], [15.15, .9, .45], [35.6, .14, .5], [47.85, .45, .7]];
  let f = 0; flashes.forEach(([a, pk, d]) => { if (t >= a) f = Math.max(f, pk * (1 - P(t, a, a + d, E.outCubic))); });
  $('#flash').style.opacity = f;
  $('#fade').style.opacity = P(t, 52.9, 54, E.inOutCubic);
  const g = f2 => f2;
  const lit = P(t, 8.0, 9.0, E.lin);
  $('.g1').style.opacity = lit * (1 - P(t, 11.5, 12, E.lin)) + P(t, 17.4, 18.4, E.lin) * (1 - P(t, 47.2, 47.8, E.lin)) + P(t, 47.6, 48.6, E.lin);
  $('.g2').style.opacity = lit * (1 - P(t, 11.5, 12, E.lin)) + P(t, 17.4, 18.4, E.lin) * (1 - P(t, 47.2, 47.8, E.lin)) + P(t, 47.6, 48.6, E.lin);
  $('.g1').style.transform = `translate(${(Math.sin(t * .2) * 80).toFixed(1)}px,${(Math.cos(t * .17) * 50).toFixed(1)}px)`;
  $('.g2').style.transform = `translate(${(Math.cos(t * .23) * 90).toFixed(1)}px,${(Math.sin(t * .19) * 60).toFixed(1)}px)`;
  const bloom = spring(t - 7.95, .8, .6) * (1 - P(t, 11.3, 12, E.lin)) + spring(t - 47.8, .6, .7);
  $('.g3').style.opacity = clamp(bloom);
  $('.g3').style.transform = `scale(${lerp(.3, 1, clamp(bloom)).toFixed(3)})`;
  const fr = Math.floor(t * 24), r = rng(fr + 1);
  $('#grain').style.transform = `translate(${(r() * 200 - 100) | 0}px,${(r() * 200 - 100) | 0}px)`;
  bigword('#bw1', t, 15.45, 17.25);
  bigword('#bw2', t, 25.4, 27.75);
  bigword('#bw3', t, 37.0, 39.95);
  caption(t);
}

const INTRO = { s1: [0, 1.5], s0: [1.2, 8.75], s2: [8.3, 10.95] };
const RANGES = { s3: [7.95, 12.3], s4: [11.5, 17.85], s5: [17.3, 37.6], s7: [36.3, 40.6], s8: [40.0, 48.2], s9: [47.6, 54.1] };
const FN = { s0, s1, s2, s3, s4, s5, s7, s8, s9 };
/** T is film time. The intro runs on T; everything from the brand reveal on runs on t = T - D. */
function seek(T) {
  const t = T - D;
  for (const id in INTRO) { const [a, b] = INTRO[id], on = T >= a && T < b; scene(id).style.display = on ? 'block' : 'none'; if (on) FN[id](T); }
  for (const id in RANGES) { const [a, b] = RANGES[id], on = t >= a && t < b; scene(id).style.display = on ? 'block' : 'none'; if (on) FN[id](t); }
  flyer(t);
  globals(t);
}

/* ---------- Boot and preview ---------- */
const render = new URLSearchParams(location.search).has('render');
if (render) document.body.classList.add('render');
function fit() {
  const st = $('#stage');
  if (render) { st.style.transform = ''; return; }
  const k = Math.min(innerWidth / 1920, (innerHeight - 48) / 1080);
  st.style.transform = `translate(${(innerWidth - 1920 * k) / 2}px, ${(innerHeight - 48 - 1080 * k) / 2}px) scale(${k})`;
}
async function boot() {
  await document.fonts.ready;
  await Promise.all(['700 100px "Inter Tight"', '800 100px "Inter Tight"', '500 100px "Inter Tight"', 'italic 400 100px "Instrument Serif"', '400 15px Inter', '600 15px Inter', '700 15px Inter', '500 20px "JetBrains Mono"', '600 20px "JetBrains Mono"', '400 13px "Open Sans"', '600 13px "Open Sans"'].map(f => document.fonts.load(f)));
  build();
  measure();
  plan();
  fit(); addEventListener('resize', fit);
  const q = new URLSearchParams(location.search);
  let t = parseFloat(q.get('t') || '0');
  seek(t);
  window.__film = { seek, DUR, FPS, ready: true };
  if (render) return;
  const scrub = $('#scrub'), time = $('#time'), play = $('#play'), snd = $('#snd');
  let playing = false, t0 = 0, start = 0, src = null, ctx = null, buf = null, sound = false;
  const set = v => { t = clamp(v, 0, DUR); scrub.value = t; time.textContent = t.toFixed(2); seek(t); };
  scrub.oninput = () => { stop(); set(+scrub.value); };
  function stopAudio() { if (src) { try { src.stop(); } catch { } src = null; } }
  function stop() { playing = false; play.textContent = 'Play'; stopAudio(); }
  async function startAudio() {
    if (!sound) return;
    ctx ??= new AudioContext();
    buf ??= await window.buildSoundtrack(48000);
    src = ctx.createBufferSource(); src.buffer = buf; src.connect(ctx.destination); src.start(0, t);
  }
  play.onclick = async () => {
    if (playing) return stop();
    if (t >= DUR - .01) set(0);
    await startAudio();
    playing = true; play.textContent = 'Pause'; t0 = t; start = performance.now();
    const loop = () => { if (!playing) return; set(t0 + (performance.now() - start) / 1000); if (t >= DUR) return stop(); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  };
  snd.onclick = () => { sound = !sound; snd.textContent = 'Sound: ' + (sound ? 'on' : 'off'); if (!sound) stopAudio(); };
  addEventListener('keydown', e => { if (e.code === 'Space') { e.preventDefault(); play.onclick(); } if (e.key === 'ArrowRight') { stop(); set(t + (e.shiftKey ? 1 : 1 / FPS)); } if (e.key === 'ArrowLeft') { stop(); set(t - (e.shiftKey ? 1 : 1 / FPS)); } });
  set(t);
}
boot();
})();
