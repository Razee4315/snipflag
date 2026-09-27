/**
 * Renders one demo in video/<demo>/ to MP4. Runs on GitHub Actions only (see .github/workflows/demo-videos.yml).
 *   node render.mjs <demo>
 * Environment:
 *   QUALITY=final  1920×1080 at the demo's FPS, near-lossless intermediates, slow final encode (default)
 *   QUALITY=draft  1280×720 at 30 fps, JPEG frames, fast encode: for checking timing and story quickly
 *   LIMIT_SECONDS=10  render only the first N seconds
 *   WORKERS=4      parallel browser pages (the standard Actions runner has 4 vCPUs)
 * Every frame comes from window.__film.seek(t) (see shared/player.js), split across parallel pages. The soundtrack
 * is rendered in-page with OfflineAudioContext when the demo defines window.buildSoundtrack; otherwise it is silent.
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, rm, stat } from 'node:fs/promises';
import { extname, join, dirname, resolve, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const demo = process.argv[2] || process.env.DEMO;
if (!demo || !/^[a-z0-9][a-z0-9-]*$/.test(demo)) throw new Error('Usage: node render.mjs <demo-folder> (lowercase letters, digits, dashes)');
await stat(join(root, demo, 'index.html')).catch(() => { throw new Error(`video/${demo}/index.html not found`); });

const DRAFT = (process.env.QUALITY || 'final') === 'draft';
const WORKERS = Number(process.env.WORKERS || 4);
const ONLY = process.env.LIMIT_SECONDS ? Number(process.env.LIMIT_SECONDS) : null;
const out = join(root, 'out', demo);

// Serves video/ so demos can load ../shared/*.
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (path.endsWith('/')) path += 'index.html';
    const file = resolve(root, '.' + path);
    if (!file.startsWith(root + sep)) throw new Error('outside root');
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream' }); res.end(body);
  } catch { res.writeHead(404); res.end(); }
}).listen(0, '127.0.0.1');
await new Promise(r => server.once('listening', r));
const url = `http://127.0.0.1:${server.address().port}/${demo}/?render`;

function run(cmd, args) {
  return new Promise((ok, fail) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'inherit', 'inherit'] });
    p.on('error', fail); p.on('exit', code => code === 0 ? ok() : fail(new Error(`${cmd} exited ${code}`)));
  });
}

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ args: ['--force-color-profile=srgb', '--disable-lcd-text', '--font-render-hinting=none'] });
async function open() {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => { console.error('page error:', e); process.exitCode = 1; });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__film?.ready, null, { timeout: 60000 });
  const duplicates = await page.evaluate(() => {
    const ids = [...document.querySelectorAll('[id]')].map(el => el.id);
    return ids.filter((id, i) => ids.indexOf(id) !== i);
  });
  if (duplicates.length) throw new Error(`Duplicate IDs in ${demo}: ${duplicates.join(', ')}`);
  return page;
}
const seekTo = (page, t) => page.evaluate(t => { window.__film.seek(t); return new Promise(r => requestAnimationFrame(() => r())); }, t);

const first = await open();
const film = await first.evaluate(() => { const { DUR, FPS, checks, away, review, poster } = window.__film; return { DUR, FPS, checks, away, review, poster }; });
const LEN = Math.min(ONLY ?? film.DUR, film.DUR);
const FPS = DRAFT ? 30 : film.FPS;
const total = Math.round(LEN * FPS);
const inRange = ts => ts.filter(t => t < LEN);
const final = join(out, DRAFT ? `${demo}-draft-720p30.mp4` : `${demo}-1080p${FPS}.mp4`);

// Random seeking must reproduce the exact same frame, including after later scenes.
if (!DRAFT) {
  const checks = inRange(film.checks ?? [.2, .45, .7].map(k => +(k * film.DUR).toFixed(2)));
  const away = film.away ?? +(film.DUR * .95).toFixed(2);
  const frameHash = async t => { await seekTo(first, t); return createHash('sha256').update(await first.screenshot({ type: 'png' })).digest('hex'); };
  for (const t of checks) {
    const before = await frameHash(t);
    await frameHash(away);
    if (before !== await frameHash(t)) throw new Error(`Non-deterministic seek at ${t}s (seek(t) must set every property from t alone)`);
  }
  console.log(`Random-seek frame checks passed at ${checks.join(', ')} s`);
}

const hasAudio = await first.evaluate(() => typeof window.buildSoundtrack === 'function');
const wav = join(out, 'soundtrack.wav');
if (hasAudio) {
  const audio = await first.evaluate(() => window.soundtrackWavBase64());
  await writeFile(wav, Buffer.from(audio.b64, 'base64'));
  console.log(`Soundtrack rendered (pre-normalize peak ${audio.peak.toFixed(3)})`);
} else console.log('No window.buildSoundtrack: the video gets a silent audio track');
await first.close();

// Frames: each worker encodes one contiguous segment.
console.log(`Rendering ${demo}: ${total} frames at ${FPS} fps (${DRAFT ? 'draft 720p' : 'final 1080p'}) with ${WORKERS} workers`);
const per = Math.ceil(total / WORKERS);
const started = Date.now();
let done = 0;
const segArgs = DRAFT
  ? ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-vf', 'scale=1280:720:flags=lanczos', '-pix_fmt', 'yuv420p']
  : ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '8', '-pix_fmt', 'yuv444p'];
await Promise.all(Array.from({ length: WORKERS }, async (_, w) => {
  const a = w * per, b = Math.min(total, a + per);
  if (a >= b) return;
  const page = await open();
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', DRAFT ? 'mjpeg' : 'png', '-i', '-',
    ...segArgs, join(out, `seg${w}.mp4`)], { stdio: ['pipe', 'inherit', 'inherit'] });
  const closed = new Promise((ok, fail) => ff.on('exit', c => c === 0 ? ok() : fail(new Error('ffmpeg segment failed'))));
  for (let f = a; f < b; f++) {
    await seekTo(page, f / FPS);
    const img = await page.screenshot(DRAFT ? { type: 'jpeg', quality: 90 } : { type: 'png' });
    if (!ff.stdin.write(img)) await new Promise(r => ff.stdin.once('drain', r));
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
const audioIn = hasAudio ? ['-i', wav] : ['-f', 'lavfi', '-t', String(LEN), '-i', 'anullsrc=r=48000:cl=stereo'];
const videoOut = DRAFT
  ? ['-c:v', 'copy']
  : ['-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-tune', 'animation', '-pix_fmt', 'yuv420p', '-profile:v', 'high'];
await run('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', join(out, 'segments.txt'), ...audioIn,
  '-map', '0:v', '-map', '1:a', ...videoOut, '-movflags', '+faststart', '-c:a', 'aac', '-b:a', DRAFT ? '192k' : '320k', '-shortest', final]);
for (let w = 0; w < WORKERS; w++) await rm(join(out, `seg${w}.mp4`), { force: true });
await rm(join(out, 'segments.txt'), { force: true });

const posterAt = Math.min(film.poster ?? film.DUR * .9, LEN - .1);
await run('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(posterAt), '-i', final, '-frames:v', '1', join(out, 'poster.png')]);
console.log('Done:', final);

// Review the encoded deliverable, not just the HTML source: contact sheets (1 frame/s) and chosen stills.
const review = join(out, 'review');
await mkdir(review, { recursive: true });
await run('ffmpeg', ['-y', '-loglevel', 'error', '-i', final,
  '-vf', "fps=1,scale=480:270,drawtext=text='%{pts\\:hms}':x=12:y=12:fontsize=20:fontcolor=white:box=1:boxcolor=black@0.7,tile=4x5:padding=4:margin=4",
  '-fps_mode', 'vfr', join(review, 'contact-%02d.jpg')]);
const stills = inRange(film.review ?? Array.from({ length: 12 }, (_, i) => +((i + .5) * film.DUR / 12).toFixed(2)));
for (const t of stills) await run('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(t), '-i', final, '-frames:v', '1', join(review, `frame-${t.toFixed(1)}.png`)]);
