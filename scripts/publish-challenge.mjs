// Host-only: builds today's shared challenge from the newest eligible hardware window, proves it is finishable
// with the shared rules, then publishes it to D1. Safe to re-run: the same window gives the same id and is ignored.
//   node scripts/publish-challenge.mjs <keys.env>            (dry run: add --publish to write to D1)
import fs from 'node:fs';import {spawnSync} from 'node:child_process';
import {challengeFromRuns} from '../challenge.mjs';import {solveRoute} from './solve-route.mjs';import {validateReplay,RULES} from '../simulation.mjs';
const [keyFile,...flags]=process.argv.slice(2),publish=flags.includes('--publish');
if(!keyFile)throw Error('Usage: node scripts/publish-challenge.mjs <keys.env> [--publish]');
let cursor=null,challenge=null,header;const seen=new Set(),items=[];
for(let page=0;page<5&&!challenge;page++){
  const u=new URL('https://api.squeekchain.com/v1/measurement/runs');u.searchParams.set('limit','100');if(cursor)u.searchParams.set('cursor',cursor);
  const response=await fetch(u);if(!response.ok)throw Error('Hardware history HTTP '+response.status);
  const body=await response.json();if(header&&body.installationId!==header.installationId)throw Error('Installation changed while paging');header=body;items.push(...body.items);
  try{challenge=await challengeFromRuns({...body,items});}catch(e){if(e.message!=='No continuous hardware window of at least 30 seconds')throw e;}
  cursor=body.nextCursor;if(!cursor||seen.has(cursor)||!body.items.length)break;seen.add(cursor);await new Promise(r=>setTimeout(r,550));
}
if(!challenge){console.log('No continuous 30s+ hardware window available right now. Nothing to publish.');process.exit(0);}
console.log('window',challenge.source.startAt,'→',challenge.source.endAt,'| segments',challenge.source.segmentIds.length,'| id',challenge.id.slice(0,12),'| rules',challenge.rules);
if(challenge.rules!==RULES)throw Error('Rules mismatch');
console.log('proving the challenge is finishable…');
const witness=solveRoute(challenge),proof=validateReplay(challenge,witness);
if(!proof.completed)throw Error('Challenge is not finishable; refusing to publish');
console.log('finishable ✓ witness inputs',witness.inputs.length,'score',proof.score);
if(!publish){console.log('Dry run. Re-run with --publish to add it to the leaderboard database.');process.exit(0);}
const body=JSON.stringify(challenge).replace(/'/g,"''");
fs.mkdirSync('work',{recursive:true});fs.writeFileSync('work/publish-challenge.sql',`INSERT OR IGNORE INTO challenges VALUES ('${challenge.id}','${body}',${Date.now()});\n`);
const result=spawnSync(process.execPath,['scripts/cloudflare.mjs',keyFile,'d1','execute','squeek-run-leaderboard','--remote','--file','work/publish-challenge.sql'],{stdio:'inherit'});
if(result.status)throw Error('Publishing to D1 failed');
console.log('Published (or already present):',challenge.id);
