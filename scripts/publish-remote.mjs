// Runs on the host VPS (no Cloudflare credentials needed): solves the newest hardware challenge and hands the proof
// to the Worker, which rebuilds the challenge from the hardware API itself and verifies the proof before publishing.
//   SQUEEK_RUN_URL=https://… SQUEEK_RUN_PUBLISH_TOKEN=… node scripts/publish-remote.mjs
import {latestHardwareChallenge} from '../hardware.mjs';import {solveRoute} from './solve-route.mjs';import {validateReplay} from '../simulation.mjs';
const BASE=(process.env.SQUEEK_RUN_URL||'').replace(/\/$/,''),TOKEN=process.env.SQUEEK_RUN_PUBLISH_TOKEN;
const log=(...a)=>console.log(new Date().toISOString(),...a);
if(!BASE||!TOKEN)throw Error('Set SQUEEK_RUN_URL and SQUEEK_RUN_PUBLISH_TOKEN');
const challenge=await latestHardwareChallenge();
if(!challenge){log('no continuous 30s+ hardware window yet; nothing to publish');process.exit(0);}
const current=await fetch(BASE+'/api/challenge').then(r=>r.json()).catch(()=>null);
if(current?.id===challenge.id){log('up to date: challenge',challenge.id.slice(0,12),'window',challenge.source.startAt);process.exit(0);}
log('new hardware window',challenge.source.startAt,'→ solving challenge',challenge.id.slice(0,12));
const started=Date.now(),witness=solveRoute(challenge),proof=validateReplay(challenge,witness);
if(!proof.completed)throw Error('Solver could not finish this challenge; not publishing');
log('proof ready in',Date.now()-started,'ms | inputs',witness.inputs.length,'score',proof.score);
const response=await fetch(BASE+'/api/admin/publish',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+TOKEN},body:JSON.stringify({witness})});
const body=await response.json().catch(()=>({}));
log('publish',response.status,JSON.stringify(body));
if(!response.ok)process.exitCode=1;
