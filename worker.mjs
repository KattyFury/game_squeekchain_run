import {walletSession,walletNonce,walletVerify,walletLogout} from './wallet-auth.mjs';
import {readSepoliaSnapshot} from './sepolia.mjs';
import {challengeFromRuns,digest} from './challenge.mjs';
import {RULES,validateReplay} from './simulation.mjs';
import approved from './evidence/challenge.json' with {type:'json'};
import witness from './evidence/route-witness.json' with {type:'json'};
const SITE='https://squeek-run-test.plaidspice8.chatgpt.site';
const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export async function readBody(request,max=16384){
  if(!request.headers.get('content-type')?.startsWith('application/json'))throw Object.assign(Error('Expected JSON'),{status:415});
  const reader=request.body?.getReader();if(!reader)throw Error('Missing payload');let size=0,parts=[];
  try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>max){await reader.cancel();throw Object.assign(Error('Payload too large'),{status:413});}parts.push(value);}}finally{reader.releaseLock();}
  const buffer=new Uint8Array(size);let at=0;for(const p of parts){buffer.set(p,at);at+=p.length;}return JSON.parse(new TextDecoder().decode(buffer));
}
async function limit(request,db,category,budget){
  const now=Date.now(),bucket=Math.floor(now/60000),ip=request.headers.get('CF-Connecting-IP')||'local';
  const key=await digest(category+':'+ip+':'+bucket);
  const row=await db.prepare('INSERT INTO rate_limits(key,count,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').bind(key,now+120000).first();
  if(row.count>budget)throw Object.assign(Error('Too many requests. Try again in a minute.'),{status:429});
}
async function latest(db){return db.prepare('SELECT body FROM challenges ORDER BY created_at DESC LIMIT 1').first();}
export async function refreshChallenge(db){
  let cursor=null,items=[],header;const seen=new Set();
  for(let page=0;page<5;page++){
    const u=new URL('https://api.squeekchain.com/v1/measurement/runs');u.searchParams.set('limit','100');if(cursor)u.searchParams.set('cursor',cursor);
    const response=await fetch(u,{signal:AbortSignal.timeout(8000)});if(!response.ok)throw Error('Hardware history HTTP '+response.status);
    const body=await response.json();if(body.schemaVersion!=='measurement-runs.v1')throw Error('Unsupported hardware history');
    if(header&&body.installationId!==header.installationId)throw Error('Installation changed while paging');header=body;items.push(...body.items);
    try{const challenge=await challengeFromRuns({...body,items});if(challenge.id!==approved.id||!validateReplay(challenge,witness).completed)throw Error('New source needs a full-route check before admission');await db.prepare('INSERT OR IGNORE INTO challenges(id,body,created_at) VALUES (?,?,?)').bind(challenge.id,JSON.stringify(challenge),Date.now()).run();return challenge;}catch(e){if(e.message!=='No continuous hardware window of at least 30 seconds')throw e;}
    cursor=body.nextCursor;if(!cursor||seen.has(cursor)||!body.items.length)break;seen.add(cursor);
    await new Promise(resolve=>setTimeout(resolve,550));
  }throw Error('No usable hardware recording yet');
}
export async function api(request,env){
  const url=new URL(request.url),db=env.DB;if(!db)return json({error:'Leaderboard is not configured'},503);
  if(request.method==='GET'&&url.pathname==='/api/chain'){
    const cache=globalThis.caches?.default,cacheKey=new Request(url.origin+'/api/chain');const hit=cache?await cache.match(cacheKey):null;if(hit)return hit;
    try{const snapshot=await readSepoliaSnapshot(env.SEPOLIA_RPC_URL);const response=Response.json(snapshot,{headers:{'Cache-Control':'public, max-age=45'}});if(cache)await cache.put(cacheKey,response.clone());return response;}catch{return json({verified:false,error:'Sepolia RPC verification unavailable. Hardware gameplay remains separate.'},503);}
  }
  if(request.method==='POST'&&url.pathname==='/api/wallet/nonce'){await limit(request,db,'wallet',10);const body=await readBody(request,1024);return json(await walletNonce(request,db,body.address));}
  if(request.method==='POST'&&url.pathname==='/api/wallet/verify'){await limit(request,db,'signature',10);const result=await walletVerify(request,db,await readBody(request,2048));return Response.json({address:result.address,chainId:11155111},{headers:{'Set-Cookie':result.cookie,'Cache-Control':'no-store'}});}
  if(request.method==='POST'&&url.pathname==='/api/wallet/logout'){return Response.json({signedOut:true},{headers:{'Set-Cookie':await walletLogout(request,db),'Cache-Control':'no-store'}});}
  if(request.method==='GET'&&url.pathname==='/api/wallet/progress'){
    const address=await walletSession(request,db);if(!address)return json({address:null,entries:[]});
    const {results}=await db.prepare('SELECT challenge_id,MAX(score) AS best_score,COUNT(*) AS runs,MAX(completed) AS completed FROM entries WHERE wallet_address=? AND rules=? GROUP BY challenge_id ORDER BY best_score DESC LIMIT 20').bind(address,RULES).all();return json({address,chainId:11155111,entries:results});
  }
  if(request.method==='GET'&&url.pathname==='/api/challenge'){
    const row=await latest(db);if(!row)return json({error:'Hardware challenge is being prepared. Practice remains available.'},503);return json(JSON.parse(row.body));
  }
  if(request.method==='GET'&&url.pathname==='/api/leaderboard'){
    const id=url.searchParams.get('challenge');if(!/^[a-f0-9]{64}$/.test(id||''))return json({error:'Invalid challenge'},400);
    const {results}=await db.prepare('SELECT name,score,ticks,completed,created_at,wallet_address FROM entries WHERE challenge_id=? AND rules=? ORDER BY score DESC,ticks ASC,created_at ASC LIMIT 20').bind(id,RULES).all();return json({entries:results});
  }
  if(request.method==='POST'&&url.pathname==='/api/attempt'){
    await limit(request,db,'start',8);const body=await readBody(request,1024);
    const row=await db.prepare('SELECT body FROM challenges WHERE id=?').bind(String(body.challenge||'').slice(0,64)).first();if(!row)return json({error:'Unknown challenge'},404);
    const challenge=JSON.parse(row.body),id=crypto.randomUUID(),now=Date.now(),wallet=await walletSession(request,db);
    await db.prepare('INSERT INTO attempts(id,challenge_id,started_at,expires_at,wallet_address) VALUES (?,?,?,?,?)').bind(id,challenge.id,now,now+15*60000,wallet).run();return json({attempt:id,challenge});
  }
  if(request.method==='POST'&&url.pathname==='/api/replay'){
    await limit(request,db,'submit',10);const body=await readBody(request);
    if(!/^[a-zA-Z0-9 _.-]{1,20}$/.test(body.name||'')||typeof body.attempt!=='string'||body.attempt.length!==36)return json({error:'Use a name with 1–20 letters, numbers, spaces, dots or dashes'},400);
    const attempt=await db.prepare('SELECT * FROM attempts WHERE id=?').bind(body.attempt).first();if(!attempt)return json({error:'Unknown attempt'},404);
    if(attempt.wallet_address&&attempt.wallet_address!==await walletSession(request,db))return json({error:'Sign in with the wallet that started this run'},401);
    const hash=await digest(JSON.stringify({name:body.name,replay:body.replay}));
    if(attempt.submitted_at)return attempt.replay_hash===hash?json(JSON.parse(attempt.result)):json({error:'Attempt already submitted'},409);
    const now=Date.now();if(now>attempt.expires_at)return json({error:'Attempt expired'},410);
    const row=await db.prepare('SELECT body FROM challenges WHERE id=?').bind(attempt.challenge_id).first();
    const result=validateReplay(JSON.parse(row.body),body.replay);
    if(now-attempt.started_at+500<result.ticks/120*1000)return json({error:'Replay arrived before the run could finish'},400);
    const response={...result,verified:true,challenge:attempt.challenge_id,rules:RULES,wallet:attempt.wallet_address||null};
    // One conditional update wins a race. Insert reads its committed hash, so mismatched concurrent payloads cannot replace the winner.
    const results=await db.batch([
      db.prepare('UPDATE attempts SET submitted_at=?,replay_hash=?,result=? WHERE id=? AND submitted_at IS NULL').bind(now,hash,JSON.stringify(response),body.attempt),
      db.prepare('INSERT OR IGNORE INTO entries(attempt_id,challenge_id,rules,name,score,ticks,completed,replay,created_at,wallet_address) SELECT id,challenge_id,?,?,?,?,?,?,?,wallet_address FROM attempts WHERE id=? AND replay_hash=?').bind(RULES,body.name,result.score,result.ticks,Number(result.completed),JSON.stringify(body.replay),now,body.attempt,hash)
    ]);
    if(!results[0].meta.changes){const winner=await db.prepare('SELECT replay_hash,result FROM attempts WHERE id=?').bind(body.attempt).first();return winner.replay_hash===hash?json(JSON.parse(winner.result)):json({error:'Attempt already submitted'},409);}
    return json(response);
  }
  return json({error:'Not found'},404);
}
export default {
  async fetch(request,env){
    const origin=request.headers.get('Origin'),allowed=origin===new URL(request.url).origin||origin===SITE||/^http:\/\/(127\.0\.0\.1|localhost):8787$/.test(origin||'');
    let response;
    if(request.method==='OPTIONS')response=new Response(null,{status:204});
    else if(!new URL(request.url).pathname.startsWith('/api/'))return env.ASSETS?env.ASSETS.fetch(request):json({error:'Not found'},404);
    else if(request.method==='POST'&&origin&&!allowed)return json({error:'Origin not allowed'},403);
    else try{response=await api(request,env);}catch(e){console.error(JSON.stringify({event:'api_error',type:e.name}));response=json({error:e.status?e.message:e instanceof SyntaxError?'Invalid JSON':e.message?.startsWith('Invalid')||e.message?.startsWith('Replay')?e.message:'Service unavailable'},e.status||(e.message?.startsWith('Invalid')||e.message?.startsWith('Replay')?400:503));}
    const headers=new Headers(response.headers);if(allowed){headers.set('Access-Control-Allow-Origin',origin);headers.set('Vary','Origin');headers.set('Access-Control-Allow-Methods','GET, POST, OPTIONS');headers.set('Access-Control-Allow-Headers','Content-Type');headers.set('Access-Control-Allow-Credentials','true');}if(response.status===429)headers.set('Retry-After','60');return new Response(response.body,{status:response.status,headers});
  },
  async scheduled(event,env,ctx){ctx.waitUntil((async()=>{await refreshChallenge(env.DB);await env.DB.batch([env.DB.prepare('DELETE FROM rate_limits WHERE expires_at<?').bind(Date.now()),env.DB.prepare('DELETE FROM wallet_nonces WHERE expires_at<?').bind(Date.now()),env.DB.prepare('DELETE FROM wallet_sessions WHERE expires_at<?').bind(Date.now()),env.DB.prepare('DELETE FROM attempts WHERE submitted_at IS NULL AND expires_at<?').bind(Date.now()-86400000)]);})());}
};
