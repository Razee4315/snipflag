/* A frame-exact original canvas film. All source imagery is already public in this repo. */
const canvas=document.querySelector('canvas'), c=canvas.getContext('2d',{alpha:false});
const W=1920,H=1080,DURATION=42,FPS=60;
const C={ink:'#0b1916',forest:'#142a24',mint:'#a9edce',paper:'#f2f0e7',dim:'#79978a',coral:'#fa795b'};
const clamp=x=>Math.max(0,Math.min(1,x));
const ease=x=>1-Math.pow(1-clamp(x),4);
const smooth=x=>{x=clamp(x);return x*x*(3-2*x)};
const lerp=(a,b,t)=>a+(b-a)*t;
const image=src=>new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(new Error(src));i.src=src});
let hero,logo,shot,shotId=-1;
function rect(x,y,w,h,color,r=0){c.fillStyle=color;c.beginPath();c.roundRect(x,y,w,h,r);c.fill()}
function text(s,x,y,size=30,color=C.paper,weight=500,align='left'){c.fillStyle=color;c.font=`${weight} ${size}px Studio, Arial, sans-serif`;c.textAlign=align;c.textBaseline='alphabetic';c.fillText(s,x,y)}
function line(x1,y1,x2,y2,color=C.mint,width=2){c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.stroke()}
function label(s,x,y,color=C.dim){c.save();c.letterSpacing='3px';text(s.toUpperCase(),x,y,17,color,650);c.restore()}
function clip(x,y,w,h,r,fn){c.save();c.beginPath();c.roundRect(x,y,w,h,r);c.clip();fn();c.restore()}
function fade(a,fn){c.save();c.globalAlpha=clamp(a);fn();c.restore()}
function move(x,y,s,rot,fn){c.save();c.translate(x,y);c.rotate(rot);c.scale(s,s);fn();c.restore()}
function frame(x,y,w,h,progress=1,color=C.mint,len=45){c.save();c.strokeStyle=color;c.lineWidth=4;c.lineCap='square';const p=ease(progress);for(const [px,py,sx,sy] of [[x,y,1,1],[x+w,y,-1,1],[x,y+h,1,-1],[x+w,y+h,-1,-1]]){c.beginPath();c.moveTo(px,py+len*p*sy);c.lineTo(px,py);c.lineTo(px+len*p*sx,py);c.stroke()}c.restore()}
function bg(color=C.ink){rect(0,0,W,H,color)}
function chrome(n,title,light=false){const col=light?C.forest:C.dim;label('SNIPFLAG',84,65,col);label(title,1836,65,col);c.save();c.textAlign='right';c.restore();line(84,997,1836,997,light?'#cfdbce':'#284237',1);label('SEE IT. MARK IT. FLAG IT.',84,1036,col);text(n,1836,1036,17,col,600,'right')}
// The title enters through an actual clipping plane instead of fading like a slide deck.
function reveal(s,x,y,size,t,delay=0,color=C.paper,weight=650){const p=ease((t-delay)/.75);clip(x-10,y-size*1.2,1800,size*1.5,0,()=>text(s,x,y+(1-p)*size*1.25,size,color,weight))}
function arrow(x,y,w,h,p,color=C.coral){c.save();c.strokeStyle=color;c.lineWidth=11;c.lineCap='round';c.lineJoin='round';c.setLineDash([900]);c.lineDashOffset=900*(1-clamp(p));c.beginPath();c.moveTo(x,y);c.bezierCurveTo(x+w*.15,y-h*.3,x+w*.72,y+h*1.12,x+w,y+h);c.stroke();c.setLineDash([]);fade((p-.8)*5,()=>{c.beginPath();c.moveTo(x+w-42,y+h-25);c.lineTo(x+w,y+h);c.lineTo(x+w-40,y+h+28);c.stroke()});c.restore()}
function bill(x,y,w,h,kind=0){rect(x,y,w,h,C.paper,20);text('acme',x+38,y+61,30,C.ink,800);text(kind?'Invoice #1042':'Account / Billing',x+w-34,y+58,18,'#6d8076',500,'right');line(x+32,y+85,x+w-32,y+85,'#d6ded5',1);text(kind?'Team plan':'Billing',x+38,y+148,38,C.forest,700);text('Team · 5 seats',x+38,y+202,22,'#64766d');rect(x+30,y+h-124,w-60,88,'#e4e8df',12);text('Total due',x+52,y+h-69,26,C.forest);text(kind?'$60.00':'$0.00',x+w-54,y+h-65,39,C.ink,750,'right')}
function ui(x,y,w,h){clip(x,y,w,h,20,()=>c.drawImage(hero,x,y,w,h));c.strokeStyle='#466354';c.lineWidth=1;c.beginPath();c.roundRect(x,y,w,h,20);c.stroke()}
function dot(x,y,r,color){c.fillStyle=color;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill()}
function opening(t){bg();chrome('01 / 06','');const p=ease(t/.9);fade(p,()=>{label('A SMALL DETAIL. A REAL PROBLEM.',98,204);reveal('Something’s',90,381,140,t-.08);reveal('not right.',90,535,140,t-.25);});
 move(1322+140*(1-p),556,lerp(.85,1,p),-.035*(1-p),()=>{bill(-330,-285,660,500);frame(104,78,198,102,ease((t-1.1)/.5),C.coral,24);});
 fade(ease((t-1.6)/.5),()=>{text('The screenshot sees it.',98,817,32,C.dim);text('Your team should, too.',98,869,32,C.paper)});
 // A precise scanning line leaves the composition as a match-cut cue.
 if(t>3.1){const q=ease((t-3.1)/.9);rect(lerp(-40,W,q),0,6,H,C.mint)}
}
function statement(t){bg(C.mint);chrome('02 / 06','',true);reveal('Make it',92,349,160,t,0,C.ink,750);reveal('impossible',92,534,160,t,.10,C.ink,750);reveal('to miss.',92,719,160,t,.20,C.ink,750);arrow(1065,330,570,340,ease((t-.45)/1.1),C.ink);fade(ease((t-1)/.6),()=>{frame(1532,578,165,165,1,C.ink,34);dot(1615,660,17,C.ink)});label('CONTEXT, WITHOUT THE BACK-AND-FORTH.',98,918,C.forest)}
function brand(t){bg();const p=ease(t/.95);for(let i=0;i<4;i++){let inset=lerp(-750+i*80,300+i*30,p);fade(.14-i*.025,()=>frame(inset,inset*.45,W-inset*2,H-inset*.9,1,C.mint,120))}fade(p,()=>{move(960,465,lerp(.6,1,p),0,()=>{c.drawImage(logo,-64,-160,128,128);text('Snipflag',0,100,160,C.paper,750,'center')});label('FROM SCREENSHOT TO LINEAR ISSUE.',641,713)});}
function footage(t){bg();const k=t<4?0:t<8?1:2;const titles=['Catch the moment.','Point to the problem.','Give it somewhere to go.'];const tags=['01  CAPTURE','02  ANNOTATE','03  CREATE IN LINEAR'];label(tags[k],88,82,C.mint);reveal(titles[k],84,179,65,t-k*4);text('Actual product recording',1834,80,17,C.dim,500,'right');const p=ease(t/.8);const x=lerp(285,235,p),y=208,w=1450,h=770;rect(x-1,y-1,w+2,h+2,'#355045',20);clip(x,y,w,h,19,()=>{rect(x,y,w,h,C.forest);if(shot){const s=Math.max(w/shot.width,h/shot.height);c.drawImage(shot,x+(w-shot.width*s)/2,y+(h-shot.height*s)/2,shot.width*s,shot.height*s)}});frame(x-15,y-15,w+30,h+30,p,C.mint,29);const phrases=['A detail worth capturing.','Draw attention. Keep the context.','The visual problem becomes actionable.'];text(phrases[k],88,1040,22,C.paper);for(let i=0;i<3;i++){rect(1520+i*110,1030,85,3,i===k?C.mint:'#314a3f',2)} }
function many(t){bg(C.paper);chrome('04 / 06','',true);reveal('Different angles.',86,227,92,t,0,C.ink);reveal('One clear issue.',86,335,92,t,.14,C.ink);label('MULTIPLE IMAGES · INDEPENDENT ANNOTATIONS',92,418,'#667d70');const p=ease(t/.8), converge=smooth((t-2.7)/1.1);
 for(let i=0;i<3;i++){const x=lerp(395+i*560,960,converge),y=lerp(683+(i===1?-30:15),699,converge);move(x,y,lerp(.78,.88,converge)*p,lerp((i-1)*.045,0,converge),()=>{rect(-264+10,-200+16,528,398,'#d7dfd3',20);bill(-264,-200,528,398,i===0?1:0);if(i>0)frame(64,82,173,98,1,C.coral,20);rect(-241,-227,127,41,C.ink,20);text(`@image${i+1}`,-178,-199,18,C.mint,600,'center')})}
 fade(ease((t-3.25)/.5),()=>{rect(702,900,516,61,C.ink,30);text('One session. One Linear issue.',960,940,23,C.mint,600,'center')})}
let privatePixels;
function averagedEmail(){
    if(privatePixels)return privatePixels;
    const surface=document.createElement('canvas');surface.width=947;surface.height=126;
    const ctx=surface.getContext('2d');ctx.fillStyle=C.paper;ctx.fillRect(0,0,947,126);
    ctx.font='600 63px Studio';ctx.fillStyle=C.ink;ctx.fillText('jane.doe@example.com',34,86);
    const pixels=ctx.getImageData(0,0,947,126).data;
    for(let by=0;by<126;by+=30)for(let bx=0;bx<947;bx+=30){
        const bw=Math.min(30,947-bx),bh=Math.min(30,126-by);let r=0,g=0,b=0;
        for(let yy=by;yy<by+bh;yy++)for(let xx=bx;xx<bx+bw;xx++){const i=(yy*947+xx)*4;r+=pixels[i];g+=pixels[i+1];b+=pixels[i+2]}
        const n=bw*bh;ctx.fillStyle=`rgb(${Math.round(r/n)},${Math.round(g/n)},${Math.round(b/n)})`;ctx.fillRect(bx,by,bw,bh);
    }
    return privatePixels=surface;
}
function privacy(t){bg();chrome('05 / 06','');reveal('Show what matters.',88,249,99,t);reveal('Hide what doesn’t.',88,369,99,t,.14,C.mint);label('PIXELATE SENSITIVE DETAILS BEFORE SHARING.',94,468);const x=180,y=568,w=1560,h=233;rect(x,y,w,h,C.paper,22);text('Email',x+50,y+133,35,C.forest,650);text('jane.doe@example.com',x+555,y+139,63,C.ink,600);
 const p=ease((t-.65)/1.2);clip(x+521,y+53,Math.max(.01,947*p),126,0,()=>{c.drawImage(averagedEmail(),x+521,y+53)});frame(x+510,y+40,968,151,p,C.mint,24);text('Screenshots stay local until you choose Create issue.',94,915,29,C.dim)}
function heroScene(t){bg();label('LESS EXPLAINING. MORE FIXING.',88,82,C.mint);const p=ease(t/.95);move(1285,570,lerp(.70,.74,p)+t*.002,-.018*(1-p),()=>ui(-720,-456,1440,912));rect(0,0,710,H,C.ink);reveal('See it.',87,361,123,t);reveal('Mark it.',87,503,123,t,.18);reveal('Flag it.',87,645,123,t,.36,C.mint);fade(ease((t-.9)/.7),()=>{text('A clearer way to report bugs.',94,792,30,C.dim);arrow(160,909,380,-55,1,C.mint)});}
function outro(t){bg(C.mint);const p=ease(t/.9);const origin=lerp(240,0,p);c.save();c.translate(0,origin);c.drawImage(logo,91,110,106,106);label('THE SCREENSHOT-TO-LINEAR WORKFLOW',231,177,C.forest);reveal('Snipflag',78,548,244,t,0,C.ink,750);line(93,632,1827,632,'#86bea3',2);reveal('Make it clear.',91,765,94,t,.3,C.ink,650);fade(ease((t-.9)/.6),()=>{text('Get Snipflag',99,940,31,C.ink,750);text('razee4315.github.io/snipflag',1830,940,30,C.forest,550,'right');line(327,929,391,929,C.ink,3);line(378,916,391,929,C.ink,3);line(378,942,391,929,C.ink,3)});c.restore();}
const scenes=[{at:0,end:4,fn:opening},{at:4,end:7,fn:statement},{at:7,end:10,fn:brand},{at:10,end:22,fn:footage},{at:22,end:27,fn:many},{at:27,end:31,fn:privacy},{at:31,end:35,fn:heroScene},{at:35,end:42,fn:outro}];
window.ready=(async()=>{[hero,logo]=await Promise.all([image('../../site/assets/img/hero-dark.webp'),image('../../public/icon.svg')]);await document.fonts.load('650 100px Studio');await document.fonts.ready;return true})();
window.seek=async t=>{await window.ready;t=Math.max(0,Math.min(41.999,t));if(t>=10&&t<22){const id=Math.min(359,Math.floor((t-10)*30));if(id!==shotId){shot=await image(`./footage/${String(id+1).padStart(5,'0')}.jpg`);shotId=id}}c.setTransform(1,0,0,1,0,0);c.globalAlpha=1;const s=scenes.find(s=>t>=s.at&&t<s.end);s.fn(t-s.at);};
window.filmMetadata={duration:DURATION,fps:FPS,width:W,height:H,scenes:scenes.map(({at,end})=>({at,end}))};
