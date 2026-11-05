import {setEligibleRun} from './onchain.js';
import {refreshProgress,ensureWalletNetwork} from './wallet.js';
import {TAU,groupPolygons,obstaclePolygon,readMeasurement,liveSpeed} from './engine.mjs';
import {RULES,HZ,MAX_INPUTS,createRun,stepRun} from './simulation.mjs';
const API=location.hostname.endsWith('.chatgpt.site')?'https://squeek-run-api.kattyfury1403.workers.dev':location.origin;
const canvas=document.querySelector('#game'),ctx=canvas.getContext('2d'),$=id=>document.getElementById(id),cx=480,cy=82,r=228,floor=cy+r;
ctx.imageSmoothingEnabled=false;
let state='ready',run=null,active=null,challenge=null,attempt=null,inputs=[],lastInput=-6,lastReplay=null,playbackIndex=0,best=0,last=0,accumulator=0,overAt=0,measurement=null,runEpoch=null,apiError='Connecting',lastBody=null,etag=null,landingAt=-1,previousHeight=0,visibleInfo='';
try{best=Number(localStorage.getItem('squeek-practice-best'))||0}catch{}$('best').textContent=String(best).padStart(4,'0');
const valid=()=>measurement&&Date.now()<=measurement.expiresAt;
const available=()=>valid()&&measurement.active;
const frozen=()=>state==='playing'&&active?.kind==='live'&&(!available()||measurement.epoch!==runEpoch);
const selected=()=>$('play-mode').value;
function resetView(){if(state==='loading')return;state='ready';run=null;active=null;attempt=null;$('submit').disabled=true;$('duration').textContent=selected()==='recorded'?(challenge?challenge.durationTicks/HZ+'s · same wheel for everyone':'Waiting for a hardware recording'):selected()==='live'?'Current hardware · unranked':'No ranking in practice';}
$('play-mode').addEventListener('change',resetView);
async function start(){
  if(state==='loading')return;const choice=selected();state='loading';attempt=null;
  try{
    if(choice==='recorded'){
      await ensureWalletNetwork();
      if(!challenge)throw Error('Shared challenge unavailable. Choose Practice.');
      const response=await fetch(API+'/api/attempt',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({challenge:challenge.id}),signal:AbortSignal.timeout(8000)});const body=await response.json();if(!response.ok)throw Error(body.error||'Could not start challenge');attempt=body.attempt;active=body.challenge;
    }else if(choice==='live'){
      if(!available())throw Error(valid()?'Hardware is idle. Choose Practice or Shared challenge.':'Fresh hardware unavailable. Choose Practice.');
      active={rules:RULES,kind:'live',seed:measurement.work.toString(),durationTicks:7200,speeds:[{tick:0,speed:Math.round(liveSpeed(measurement)*1e6)}]};runEpoch=measurement.epoch;
    }else active={rules:RULES,kind:'practice',seed:String(crypto.getRandomValues(new Uint32Array(1))[0]),durationTicks:7200};
    run=createRun(active);inputs=[];lastInput=-6;last=0;accumulator=0;state='playing';$('submit').disabled=true;$('submission').textContent=choice==='recorded'?'Recording Space inputs. Your score will be recomputed by the server.':'This run is unranked.';canvas.focus({preventScroll:true});
  }catch(e){state='ready';$('submission').textContent=e.message;}
}
const KEY=matchMedia('(pointer:coarse)').matches?'TAP':'SPACE';
function press(){
  if(document.hidden)return;
  if(state==='ready'||state==='over'&&performance.now()-overAt>400||state==='playing'&&active.kind==='live'&&valid()&&measurement.epoch!==runEpoch){start();return;}
  if(state==='playing'&&!frozen()&&run.tick-lastInput>=6&&run.jumps<2&&inputs.length<MAX_INPUTS){inputs.push(run.tick);lastInput=run.tick;}
}
window.addEventListener('keydown',e=>{
  if(e.code!=='Space'||['INPUT','SELECT','BUTTON','SUMMARY','TEXTAREA'].includes(e.target?.tagName))return;e.preventDefault();if(e.repeat)return;press();
});
// Touch / mouse: a press anywhere in the game area (the whole stage) does what Space does; holds don't repeat.
$('stage').addEventListener('pointerdown',e=>{if(e.button>0)return;e.preventDefault();press();});
for(const b of document.querySelectorAll('[data-open]'))b.addEventListener('click',()=>$(b.dataset.open).showModal());
for(const b of document.querySelectorAll('[data-close]'))b.addEventListener('click',()=>b.closest('dialog').close());
for(const d of document.querySelectorAll('dialog'))d.addEventListener('click',e=>{if(e.target===d)d.close();});
function finish(){const replaying=state==='replay';if(replaying)$('submit').disabled=!lastReplay?.attempt;state='over';overAt=performance.now();if(!replaying){$('result').hidden=false;$('ranked-actions').hidden=active.kind!=='recorded';$('submission').textContent=active.kind==='recorded'?(attempt?'Finished with '+run.score+' points. Submit it to rank on the leaderboard.':'Finished with '+run.score+' points.'):'Finished with '+run.score+' points · unranked.';lastReplay={challenge:structuredClone(active),replay:{rules:RULES,inputs:[...inputs],endTick:run.tick},attempt};$('replay').disabled=false;$('submit').disabled=active.kind!=='recorded'||!attempt;if(active.kind==='practice'&&run.score>best){best=run.score;try{localStorage.setItem('squeek-practice-best',String(best))}catch{}$('best').textContent=String(best).padStart(4,'0');}}}
function update(){if(!['playing','replay'].includes(state)||document.hidden||frozen())return;if(state==='playing'&&active.kind==='live'){const speed=Math.round(liveSpeed(measurement)*1e6);if(active.speeds.at(-1).speed!==speed)active.speeds.push({tick:run.tick,speed});}const replaying=state==='replay',press=replaying?lastReplay.replay.inputs[playbackIndex]===run.tick:inputs.at(-1)===run.tick;if(replaying&&press)playbackIndex++;previousHeight=run.height;stepRun(run,active,press);if(previousHeight>0&&run.height===0)landingAt=run.tick;if(run.dead||run.complete||replaying&&run.tick>=lastReplay.replay.endTick)finish();}
$('replay').addEventListener('click',()=>{if(!lastReplay||state==='loading')return;active=structuredClone(lastReplay.challenge);run=createRun(active);playbackIndex=0;state='replay';last=0;accumulator=0;$('submit').disabled=true;});
$('submit').addEventListener('click',async()=>{
  if(!lastReplay?.attempt)return;const saved=lastReplay,name=$('runner-name').value.trim();if(!/^[a-zA-Z0-9 _.-]{1,20}$/.test(name)){$('submission').textContent='Use 1–20 letters, numbers, spaces, dots or dashes.';return;}$('submit').disabled=true;$('submission').textContent='Checking replay on the server…';
  try{const response=await fetch(API+'/api/replay',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({attempt:saved.attempt,name,replay:saved.replay}),signal:AbortSignal.timeout(15000)});const body=await response.json();if(!response.ok)throw Error(body.error||'Submission failed');$('submission').textContent='Replay checked · '+body.score+' points · '+(body.ticks/HZ).toFixed(2)+'s. This is an offchain game result.';if(body.wallet)setEligibleRun(saved.attempt);await loadBoard();await refreshProgress();}catch(e){$('submission').textContent=e.message+' Your replay is still here; you can retry.';$('submit').disabled=false;}
});
// Hamster pixel art, built once from simple shapes: chubby body + head, ear, eye, nose, cheek, belly shading.
// '#' outline/ink, '.' white fill, 'g' soft grey. Legs swap between two run frames and tuck in the air.
const HW=16,HH=14,PX=3,ellipse=(x,y,cx,cy,rx,ry)=>((x-cx)/rx)**2+((y-cy)/ry)**2<=1;
function hamsterFrame(frame){
  const shape=(x,y)=>{x+=.5;y+=.5;return ellipse(x,y,6.6,9.2,6.4,4.2)||ellipse(x,y,11,6.8,4.8,4.4)||ellipse(x,y,8.4,2.4,2,2.2)||ellipse(x,y,15,7.6,1.3,1.2)||ellipse(x,y,.9,9.4,1.1,1.1)};
  const g=Array.from({length:HH},()=>Array(HW).fill(' '));
  for(let y=0;y<HH;y++)for(let x=0;x<HW;x++)if(shape(x,y))g[y][x]=[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>!shape(x+dx,y+dy))?'#':'.';
  const put=(x,y,c)=>{if(y>=0&&y<HH&&x>=0&&x<HW&&g[y][x]!==' ')g[y][x]=c;};
  put(8,2,'g');put(8,3,'g');put(9,3,'g');                    // inner ear
  put(12,5,'#');put(13,5,'#');put(12,6,'#');put(13,6,'#');   // eye
  put(15,7,'#');put(15,8,'#');                               // nose tip
  put(12,8,'g');put(13,8,'g');put(13,9,'g');                 // cheek
  for(let x=3;x<=9;x++)put(x,11,'g');                        // belly
  const feet=frame===2?[[4,5],[10,11]]:frame===0?[[3,5],[9,11]]:[[5,7],[8,10]];
  for(const [x0,x1] of feet)for(let x=x0;x<=x1;x++){g[12][x]='#';if(frame!==2)g[13][x]='#';}
  return g;
}
const FRAMES=[hamsterFrame(0),hamsterFrame(1),hamsterFrame(2)];
// Squeek holders wear a tiny crown (a perk read from the wallet's Squeek NFT balance).
const CROWNED=FRAMES.map(frame=>{const g=frame.map(row=>[...row]);for(const [x,y] of [[11,1],[13,1],[15,1],[11,2],[12,2],[13,2],[14,2],[15,2]])g[y][x]='#';return g;});
function hamster(){
  const h=run?.height||0,x=cx-HW*PX/2,y=floor-h-HH*PX+1,grounded=h===0||run?.velocity===0,frame=!run||state!=='playing'&&state!=='replay'?0:grounded?(Math.floor(run.tick/9)%2):2,g=(holder?CROWNED:FRAMES)[frame];
  for(let row=0;row<HH;row++)for(let col=0;col<HW;col++){const c=g[row][col];if(c===' ')continue;ctx.fillStyle=c==='#'?'#000':c==='g'?'#C9D1DE':'#fff';ctx.fillRect(Math.round(x+col*PX),Math.round(y+row*PX),PX,PX);}
  if(grounded&&h===0&&run&&run.tick-landingAt<16){ctx.fillStyle='#8B95A8';const spread=(run.tick-landingAt)*2;ctx.fillRect(cx-30-spread,floor-3,4,3);ctx.fillRect(cx+30+spread,floor-3,4,3);}
}
function text(t,y,s=16){ctx.fillStyle='#000';ctx.font=s+'px monospace';ctx.textAlign='center';ctx.fillText(t,cx,y);}
function draw(){const angle=run?.angle||0;ctx.fillStyle='#fff';ctx.fillRect(0,0,960,440);ctx.strokeStyle='#DCE3EE';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(cx-85,388);ctx.lineTo(cx,cy);ctx.lineTo(cx+85,388);ctx.stroke();ctx.fillStyle='#ECF0F8';ctx.fillRect(cx-105,388,210,8);ctx.save();ctx.translate(cx,cy);ctx.rotate(angle);ctx.strokeStyle='#ECF0F8';ctx.lineWidth=3;for(let i=0;i<12;i++){ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(Math.cos(i*TAU/12)*(r-9),Math.sin(i*TAU/12)*(r-9));ctx.stroke();}ctx.restore();ctx.strokeStyle='#000';ctx.lineWidth=5;ctx.beginPath();ctx.arc(cx,cy,r+5,0,TAU);ctx.stroke();ctx.lineWidth=2;ctx.beginPath();ctx.arc(cx,cy,r-1,0,TAU);ctx.stroke();
  for(const o of run?.groups||[]){if(Math.abs(o.offset+angle)>2.5)continue;for(const {part,poly} of groupPolygons(o,angle,r,cx,cy)){ctx.fillStyle='#000';ctx.beginPath();poly.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fill();if(part.kind==='tower'){const seam=obstaclePolygon(Math.PI/2+o.offset+angle+part.delta,r-part.height/2,3,part.width+2,cx,cy);ctx.fillStyle='#fff';ctx.beginPath();seam.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fill();}if(part.kind==='air'){const a=Math.PI/2+o.offset+angle+part.delta;ctx.strokeStyle='#8B95A8';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(cx+Math.cos(a)*r,cy+Math.sin(a)*r);ctx.lineTo(cx+Math.cos(a)*(r-part.lift),cy+Math.sin(a)*(r-part.lift));ctx.stroke();}}}ctx.fillStyle='#fff';ctx.fillRect(0,0,960,cy);hamster();
  if(run){ctx.fillStyle='#000';for(let j=0;j<2;j++)if(j>=run.jumps)ctx.fillRect(cx-10+j*12,floor+18,7,5);else ctx.strokeRect(cx-10+j*12,floor+18,7,5);}
  if(['ready','over','loading'].includes(state)){ctx.fillStyle='#fffffff2';ctx.fillRect(cx-205,cy+38,410,108);text(state==='loading'?'PREPARING RUN':state==='ready'?'ONE WHEEL. ONE KEY.':run?.complete&&!run.dead?'CHALLENGE COMPLETE':'GAME OVER',cy+70,22);text(state==='loading'?'Fetching the shared rules…':state==='ready'?KEY+' TO START':KEY+' TO RETRY',cy+104,14);}
  if(state==='playing'&&frozen()){ctx.fillStyle='#fffffff2';ctx.fillRect(cx-200,cy+38,400,90);text('LIVE PAUSED',cy+72,20);text(valid()&&measurement.epoch!==runEpoch?'Counter changed · choose a new run':'Waiting for fresh, active hardware',cy+100,12);}
  $('score').textContent=String(run?.score||0).padStart(4,'0');$('mode').textContent=state==='replay'?'REPLAY · LOCAL':active?.kind==='recorded'?'RECORDED HARDWARE · SHARED':active?.kind==='live'?'LIVE · HARDWARE':'PRACTICE · LOCAL';const info=valid()?(measurement.active?'Hardware running · ':'Hardware idle · ')+measurement.rpm.toFixed(1)+' RPM':apiError||'Stale hardware · live unavailable';if(info!==visibleInfo){$('info').textContent=info;visibleInfo=info;}$('telemetry').textContent=valid()?'HARDWARE / API-REPORTED SETTLED BLOCK '+(measurement.block??'UNKNOWN'):'SQUEEKCHAIN / LIVE UNAVAILABLE';}
function frame(t){const dt=last?Math.min((t-last)/1000,.05):0;last=t;accumulator+=document.hidden?0:dt;while(accumulator>=1/HZ){update();accumulator-=1/HZ;}draw();requestAnimationFrame(frame);}document.addEventListener('visibilitychange',()=>{last=0;accumulator=0;});

const EXPLORER='https://eth-sepolia.blockscout.com',short=a=>a.slice(0,6)+'…'+a.slice(-4);
function holderBadge(count){const b=document.createElement('span');b.className='badge';b.textContent='✦';b.title='Holds '+count+' Squeek NFT'+(count===1?'':'s');return b;}
async function loadOnchainBoard(){
  const table=$('onchain-board');if(!challenge){table.replaceChildren();return;}
  try{const response=await fetch(API+'/api/onchain/leaderboard?challenge='+challenge.id,{signal:AbortSignal.timeout(20000)});const body=await response.json();if(!response.ok)throw Error(body.error||'Unavailable');
    table.replaceChildren();if(!body.entries.length){const cell=table.insertRow().insertCell();cell.colSpan=4;cell.textContent=body.contract?'Nothing saved onchain for this challenge yet. Be the first.':'Onchain saving is not open yet.';return;}
    body.entries.forEach((entry,i)=>{const row=table.insertRow();row.insertCell().textContent=String(i+1);
      const who=row.insertCell(),link=document.createElement('a');link.href=EXPLORER+'/address/'+entry.wallet;link.target='_blank';link.rel='noreferrer';link.textContent=short(entry.wallet);who.append(link);if(entry.squeeks>0)who.append(holderBadge(entry.squeeks));
      row.insertCell().textContent=String(entry.score)+(entry.completed?' ✓':'');
      const tx=row.insertCell(),txLink=document.createElement('a');txLink.href=EXPLORER+'/tx/'+entry.tx;txLink.target='_blank';txLink.rel='noreferrer';txLink.textContent='↗';txLink.setAttribute('aria-label','View transaction');tx.append(txLink);});
  }catch(e){table.replaceChildren();const cell=table.insertRow().insertCell();cell.colSpan=4;cell.textContent='Could not read Sepolia: '+e.message;}
}
for(const tab of document.querySelectorAll('[data-tab]'))tab.addEventListener('click',()=>{for(const t of document.querySelectorAll('[data-tab]'))t.setAttribute('aria-selected',String(t===tab));$('board-run').hidden=tab.dataset.tab!=='run';$('board-chain').hidden=tab.dataset.tab!=='chain';if(tab.dataset.tab==='chain')loadOnchainBoard();});
window.addEventListener('squeek:saved',()=>{if(!$('board-chain').hidden)loadOnchainBoard();});
let holder=false;window.addEventListener('squeek:holder',event=>{holder=!!event.detail?.holder;});
async function loadBoard(){if(!challenge)return;const response=await fetch(API+'/api/leaderboard?challenge='+challenge.id,{signal:AbortSignal.timeout(8000)});if(!response.ok)throw Error('Leaderboard unavailable');const body=await response.json(),table=$('leaderboard');table.replaceChildren();if(!body.entries.length){const row=table.insertRow(),cell=row.insertCell();cell.colSpan=4;cell.textContent='No checked runs yet. Set the first score.';}body.entries.forEach((entry,i)=>{const row=table.insertRow();[i+1,entry.name+(entry.wallet_address?' · '+entry.wallet_address.slice(0,6)+'…'+entry.wallet_address.slice(-4):' · guest'),entry.score,(entry.ticks/HZ).toFixed(2)+'s'+(entry.completed?' ✓':'')].forEach((value,col)=>{const cell=row.insertCell();cell.textContent=String(value);if(col===1&&entry.squeeks>0)cell.append(holderBadge(entry.squeeks));});});}
async function loadChallenge(){try{const response=await fetch(API+'/api/challenge',{signal:AbortSignal.timeout(10000)});const body=await response.json();if(!response.ok)throw Error(body.error||'Challenge unavailable');if(body.rules!==RULES||body.kind!=='recorded')throw Error('Unsupported challenge rules');challenge=body;$('challenge-state').textContent=body.id.slice(0,10)+' · '+body.durationTicks/HZ+' seconds';$('challenge-source').textContent='Recorded '+body.source.startAt+' · '+body.source.segmentIds.length+' hardware segments · device evidence, not certified core work';if(state==='ready')resetView();await loadBoard();await refreshProgress();}catch(e){$('challenge-state').textContent='Unavailable';$('challenge-source').textContent=e.message;$('leaderboard').rows[0].cells[0].textContent='Leaderboard unavailable. Practice still works.';}}
async function poll(){let wait=2500;try{const headers={accept:'application/json'};if(etag)headers['If-None-Match']=etag;const response=await fetch('https://api.squeekchain.com/v1/status',{headers,signal:AbortSignal.timeout(8000)});if(response.status===429||response.status===503){const n=Number(response.headers.get('Retry-After'));wait=Math.min(60000,Math.max(5000,Number.isFinite(n)?n*1000:10000));throw Error('Hardware API busy');}if(response.status!==304){if(!response.ok)throw Error('Hardware API HTTP '+response.status);const body=await response.json();measurement=readMeasurement(body);lastBody=body;etag=response.headers.get('ETag');}else if(lastBody)measurement=readMeasurement(lastBody);apiError='';}catch(e){measurement=null;apiError=e.message;wait=Math.max(wait,5000);}finally{setTimeout(poll,wait);}}
requestAnimationFrame(frame);poll();loadChallenge();
