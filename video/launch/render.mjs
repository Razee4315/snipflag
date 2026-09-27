/**
 * Renders the Snipflag launch film to MP4 (1920×1080, 60 fps, AAC audio).
 * Runs on GitHub Actions only (see .github/workflows/launch-video.yml).
 * Every frame is captured from seek(t), split across parallel pages; the soundtrack is rendered in-page with
 * OfflineAudioContext, so picture and sound come from the same timeline.
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const out = join(root, 'out');
const WORKERS = Number(process.env.WORKERS || 4);
const ONLY = process.env.SECONDS ? Number(process.env.SECONDS) : null; // optional short test render

const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = createServer(async (req, res) => {
  try {
    const path = new URL(req.url, 'http://x').pathname;
    const body = await readFile(join(root, path === '/' ? 'index.html' : path));
    res.writeHead(200, { 'content-type': types[extname(path)] || 'text/html' }); res.end(body);
  } catch { res.writeHead(404); res.end(); }
}).listen(0, '127.0.0.1');
await new Promise(r => server.once('listening', r));
const url = `http://127.0.0.1:${server.address().port}/?render`;

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['pipe', 'inherit', 'inherit'], ...opts });
    p.on('error', reject); p.on('exit', code => code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`)));
    if (opts.feed) opts.feed(p.stdin);
  });
}

await mkdir(out, { recursive: true });
const browser = await chromium.launch({ args: ['--force-color-profile=srgb', '--disable-lcd-text', '--font-render-hinting=none'] });
async function open() {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => { console.error('page error:', e); process.exitCode = 1; });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__film?.ready, null, { timeout: 60000 });
  return page;
}

// Soundtrack
const first = await open();
const { DUR, FPS } = await first.evaluate(() => ({ DUR: window.__film.DUR, FPS: window.__film.FPS }));
const total = Math.round((ONLY ?? DUR) * FPS);
console.log(`Rendering ${total} frames at ${FPS} fps with ${WORKERS} workers`);
const audio = await first.evaluate(() => window.soundtrackWavBase64());
await writeFile(join(out, 'soundtrack.wav'), Buffer.from(audio.b64, 'base64'));
console.log(`Soundtrack rendered (pre-normalize peak ${audio.peak.toFixed(3)})`);
await first.close();

// Frames: each worker encodes a contiguous segment near-losslessly.
const per = Math.ceil(total / WORKERS);
const started = Date.now();
let done = 0;
await Promise.all(Array.from({ length: WORKERS }, async (_, w) => {
  const a = w * per, b = Math.min(total, a + per);
  if (a >= b) return;
  const page = await open();
  const seg = join(out, `seg${w}.mp4`);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '8', '-pix_fmt', 'yuv444p', seg], { stdio: ['pipe', 'inherit', 'inherit'] });
  const closed = new Promise((res, rej) => ff.on('exit', c => c === 0 ? res() : rej(new Error('ffmpeg segment failed'))));
  for (let f = a; f < b; f++) {
    await page.evaluate(t => { window.__film.seek(t); return new Promise(r => requestAnimationFrame(() => r())); }, f / FPS);
    const png = await page.screenshot({ type: 'png' });
    if (!ff.stdin.write(png)) await new Promise(r => ff.stdin.once('drain', r));
    if (++done % 120 === 0) console.log(`${done}/${total} frames, ${((Date.now() - started) / 1000).toFixed(0)} s`);
  }
  ff.stdin.end();
  await closed;
  await page.close();
}));
await browser.close();
server.close();

const segs = Array.from({ length: WORKERS }, (_, w) => w).filter(w => w * per < total).map(w => `file 'seg${w}.mp4'`).join('\n');
await writeFile(join(out, 'segments.txt'), segs + '\n');
// Final: high-quality H.264 in yuv420p for universal playback, AAC 320k.
await run('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', join(out, 'segments.txt'), '-i', join(out, 'soundtrack.wav'),
  '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-tune', 'animation', '-pix_fmt', 'yuv420p', '-profile:v', 'high',
  '-movflags', '+faststart', '-c:a', 'aac', '-b:a', '320k', '-shortest', join(out, 'snipflag-launch-1080p60.mp4')]);
// Poster frame.
await run('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(Math.min(51.8, (ONLY ?? DUR) - .1)), '-i', join(out, 'snipflag-launch-1080p60.mp4'), '-frames:v', '1', join(out, 'poster.png')]);
console.log('Done:', join(out, 'snipflag-launch-1080p60.mp4'));
