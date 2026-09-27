import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import path from 'node:path';
import {spawn,execFileSync} from 'node:child_process';
import {once} from 'node:events';
const root=path.resolve('../..'), out=path.resolve('out');
await mkdir(out,{recursive:true});
const mime={'.html':'text/html','.js':'text/javascript','.webp':'image/webp','.jpg':'image/jpeg','.svg':'image/svg+xml','.ttf':'font/ttf'};
const server=createServer(async(req,res)=>{try{const file=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));if(!file.startsWith(root+path.sep))throw Error('path');const bytes=await readFile(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});res.end(bytes)}catch{res.writeHead(404);res.end()}}).listen(8099,'127.0.0.1');
await once(server,'listening');
const browser=await chromium.launch({headless:true});
const failures=[];
async function page(){const p=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});p.on('pageerror',e=>failures.push(e.message));p.on('response',r=>{if(r.status()>=400)failures.push(`${r.status()} ${new URL(r.url()).pathname}`)});await p.goto('http://127.0.0.1:8099/video/studio/index.html');await p.evaluate(()=>window.ready);return p}
const proof=await page();
for(const t of [.5,2.5,4.8,6.5,8.8,11,13.5,15.5,19,21.5,23.5,26.5,29,33,36.5,40]){await proof.evaluate(t=>window.seek(t),t);await proof.screenshot({path:`${out}/frame-${String(t).replace('.','_')}.png`})}
await proof.evaluate(()=>window.seek(38));await proof.screenshot({path:`${out}/poster.png`});
await proof.close();
if(process.argv.includes('--proof')){await browser.close();server.close();if(failures.length)throw Error(JSON.stringify(failures));process.exit(0)}
// Four encoders keep browser screenshot work independent and preserve exact frame order.
await Promise.all(Array.from({length:4},async(_,part)=>{
 const p=await page();const ff=spawn('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','image2pipe','-framerate','60','-vcodec','mjpeg','-i','-','-an','-c:v','libx264','-preset','fast','-crf','17','-pix_fmt','yuv420p','-threads','1',`${out}/part-${part}.mp4`],{stdio:['pipe','inherit','inherit']});
 const done=once(ff,'close');ff.stdin.on('error',e=>failures.push(e.message));
 for(let f=part*630;f<(part+1)*630;f++){
   await p.evaluate(t=>window.seek(t),f/60);
   const jpg=await p.screenshot({type:'jpeg',quality:96});
   if(!ff.stdin.write(jpg))await once(ff.stdin,'drain');
   if(f%180===0)console.log(`part ${part}: frame ${f}/2520`);
 }
 ff.stdin.end();const [code]=await done;if(code!==0)throw Error(`Encoder ${part} failed: ${code}`);await p.close();
}));
await browser.close();server.close();
if(failures.length)throw Error(JSON.stringify(failures));
await writeFile(`${out}/concat.txt`,[0,1,2,3].map(i=>`file 'part-${i}.mp4'`).join('\n'));
execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',`${out}/concat.txt`,'-i',`${out}/score.wav`,'-c:v','copy','-af','loudnorm=I=-16:TP=-1.5:LRA=9','-c:a','aac','-b:a','256k','-ar','48000','-t','42','-movflags','+faststart',`${out}/Snipflag-Make-it-clear-1080p60.mp4`]);
const info=JSON.parse(execFileSync('ffprobe',['-v','quiet','-show_format','-show_streams','-of','json',`${out}/Snipflag-Make-it-clear-1080p60.mp4`],{encoding:'utf8'}));
const v=info.streams.find(s=>s.codec_type==='video'),a=info.streams.find(s=>s.codec_type==='audio');
if(v.width!==1920||v.height!==1080||v.nb_frames!=='2520'||v.avg_frame_rate!=='60/1'||!a||Math.abs(Number(info.format.duration)-42)>.05)throw Error('Media verification failed');
await writeFile(`${out}/verification.json`,JSON.stringify({commit:process.env.GITHUB_SHA,consoleErrors:failures,verified:true,...info},null,2));
execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',`${out}/Snipflag-Make-it-clear-1080p60.mp4`,'-vf','fps=1/2.625,scale=480:270,tile=4x4','-frames:v','1',`${out}/contact-sheet.jpg`]);
console.log('Verified 2520 frames, 1080p60, 42 seconds, stereo soundtrack.');
