/* "Try it" editor: a small in-browser version of Snipflag's annotation tools. Nothing is uploaded. */
(function () {
  'use strict';
  var root = document.querySelector('[data-editor]');
  if (!root) return;
  var canvas = root.querySelector('canvas');
  var ctx = canvas.getContext('2d');
  var status = root.querySelector('[data-editor-status]');
  var hint = root.querySelector('.hint');
  var W = canvas.width, H = canvas.height;
  var K = W / 920;            // stroke scale for the 2x sample image
  var BLOCK = 24;
  var RED = '#EF4444', YELLOW = '#FDE047';
  var names = { arrow: 'Arrow', pen: 'Pen', highlighter: 'Highlighter', pixelate: 'Pixelate' };

  var base = document.createElement('canvas'); base.width = W; base.height = H;
  var bctx = base.getContext('2d');
  var baseData = null;
  var marks = [];
  var draft = null;
  var tool = 'arrow';
  var shift = false;

  var img = new Image();
  img.decoding = 'async';
  img.onload = function () { bctx.drawImage(img, 0, 0, W, H); baseData = bctx.getImageData(0, 0, W, H); render(); };
  img.src = 'assets/img/sample.webp';

  function setTool(t) {
    tool = t;
    root.querySelectorAll('[data-tool]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.tool === t)); });
    if (status) status.textContent = 'Tool: ' + names[t];
  }
  root.querySelectorAll('[data-tool]').forEach(function (b) { b.addEventListener('click', function () { setTool(b.dataset.tool); }); });
  root.querySelector('[data-act="undo"]').addEventListener('click', function () { marks.pop(); render(); });
  root.querySelector('[data-act="clear"]').addEventListener('click', function () { marks = []; render(); });
  root.querySelector('[data-act="save"]').addEventListener('click', function () {
    canvas.toBlob(function (blob) {
      if (!blob) return;
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = 'snipflag-demo.png';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
    }, 'image/png');
  });

  // Keyboard shortcuts like the app, active while the editor is on screen and no field is focused.
  var visible = false;
  if ('IntersectionObserver' in window) new IntersectionObserver(function (e) { visible = e[0].isIntersecting; }, { threshold: 0.3 }).observe(root);
  window.addEventListener('keydown', function (e) {
    shift = e.shiftKey;
    if (!visible || /input|textarea|select/i.test((document.activeElement || {}).tagName || '')) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); marks.pop(); render(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var k = { a: 'arrow', p: 'pen', h: 'highlighter', b: 'pixelate' }[e.key.toLowerCase()];
    if (k) setTool(k);
  });
  window.addEventListener('keyup', function (e) { shift = e.shiftKey; });

  function pos(e) {
    var r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (W / r.width), y: (e.clientY - r.top) * (H / r.height) };
  }
  function snap(a, b) {
    if (!shift) return b;
    var dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
    var step = Math.PI / 12, ang = Math.round(Math.atan2(dy, dx) / step) * step;
    return { x: a.x + Math.cos(ang) * len, y: a.y + Math.sin(ang) * len };
  }

  canvas.addEventListener('pointerdown', function (e) {
    if (!baseData) return;
    canvas.setPointerCapture(e.pointerId);
    shift = e.shiftKey;
    var p = pos(e);
    draft = { type: tool, pts: [p], a: p, b: p };
    if (hint) hint.style.opacity = '0';
  });
  canvas.addEventListener('pointermove', function (e) {
    if (!draft) return;
    shift = e.shiftKey;
    var evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    if (draft.type === 'pen' || draft.type === 'highlighter') evs.forEach(function (ev) { draft.pts.push(pos(ev)); });
    else draft.b = draft.type === 'arrow' ? snap(draft.a, pos(e)) : pos(e);
    render();
  });
  function finish() {
    if (!draft) return;
    var d = draft; draft = null;
    var big = d.type === 'pen' || d.type === 'highlighter' ? d.pts.length > 1 : Math.hypot(d.b.x - d.a.x, d.b.y - d.a.y) > 6 * K;
    if (big) marks.push(d);
    render();
  }
  canvas.addEventListener('pointerup', finish);
  canvas.addEventListener('pointercancel', finish);

  /* Rendering order: pixelation is burned into the image first, then highlights, then strokes on top. */
  function render() {
    if (!baseData) return;
    var all = draft ? marks.concat([draft]) : marks;
    ctx.putImageData(baseData, 0, 0);
    all.filter(function (m) { return m.type === 'pixelate'; }).forEach(pixelate);
    all.filter(function (m) { return m.type === 'highlighter'; }).forEach(highlight);
    all.forEach(function (m) { if (m.type === 'pen') stroke(m.pts, RED, 6 * K); if (m.type === 'arrow') arrow(m.a, m.b); });
    if (draft && draft.type === 'pixelate') {
      var r = rect(draft);
      ctx.save(); ctx.setLineDash([8 * K, 6 * K]); ctx.strokeStyle = '#FFB25B'; ctx.lineWidth = 2 * K; ctx.strokeRect(r.x, r.y, r.w, r.h); ctx.restore();
    }
  }
  function rect(m) {
    var x = Math.min(m.a.x, m.b.x), y = Math.min(m.a.y, m.b.y);
    return { x: x, y: y, w: Math.abs(m.b.x - m.a.x), h: Math.abs(m.b.y - m.a.y) };
  }
  // True block averages aligned to the image grid, sampled from the original pixels.
  function pixelate(m) {
    var r = rect(m), src = baseData.data;
    var x0 = Math.floor(r.x / BLOCK) * BLOCK, y0 = Math.floor(r.y / BLOCK) * BLOCK;
    var x1 = Math.min(W, Math.ceil((r.x + r.w) / BLOCK) * BLOCK), y1 = Math.min(H, Math.ceil((r.y + r.h) / BLOCK) * BLOCK);
    for (var by = Math.max(0, y0); by < y1; by += BLOCK) {
      for (var bx = Math.max(0, x0); bx < x1; bx += BLOCK) {
        var R = 0, G = 0, B = 0, n = 0, ex = Math.min(bx + BLOCK, W), ey = Math.min(by + BLOCK, H);
        for (var y = by; y < ey; y++) for (var x = bx; x < ex; x++) { var i = (y * W + x) * 4; R += src[i]; G += src[i + 1]; B += src[i + 2]; n++; }
        ctx.fillStyle = 'rgb(' + (R / n | 0) + ',' + (G / n | 0) + ',' + (B / n | 0) + ')';
        ctx.fillRect(bx, by, ex - bx, ey - by);
      }
    }
  }
  function path(pts) {
    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
    for (var i = 1; i < pts.length - 1; i++) {
      var mx = (pts[i].x + pts[i + 1].x) / 2, my = (pts[i].y + pts[i + 1].y) / 2;
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
    }
    var last = pts[pts.length - 1]; ctx.lineTo(last.x, last.y);
  }
  function stroke(pts, color, width) {
    if (pts.length < 2) return;
    ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    path(pts); ctx.stroke(); ctx.restore();
  }
  function highlight(m) {
    if (m.pts.length < 2) return;
    ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 0.7;
    ctx.strokeStyle = YELLOW; ctx.lineWidth = 24 * K; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    path(m.pts); ctx.stroke(); ctx.restore();
  }
  function arrow(a, b) {
    var ang = Math.atan2(b.y - a.y, b.x - a.x), head = 26 * K, w = 7 * K;
    ctx.save(); ctx.strokeStyle = RED; ctx.fillStyle = RED; ctx.lineWidth = w; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x - Math.cos(ang) * head * 0.6, b.y - Math.sin(ang) * head * 0.6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x - head * Math.cos(ang - 0.45), b.y - head * Math.sin(ang - 0.45));
    ctx.lineTo(b.x - head * Math.cos(ang + 0.45), b.y - head * Math.sin(ang + 0.45));
    ctx.closePath(); ctx.fill(); ctx.restore();
  }
})();
