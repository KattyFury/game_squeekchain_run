import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
import {api,publishChallenge} from '../worker.mjs';import {database} from '../local-db.mjs';import {challengeFromRuns} from '../challenge.mjs';import {RULES,createRun,stepRun} from '../simulation.mjs';
const captured=JSON.parse(await fs.readFile(new URL('../evidence/runs-hardware.json',import.meta.url),'utf8'));
const witness=JSON.parse(await fs.readFile(new URL('../evidence/route-witness.json',import.meta.url),'utf8'));
const challenge=await challengeFromRuns(captured);
const fresh=async()=>{const db=database();db.sqlite.exec(await fs.readFile(new URL('../migrations/0001_leaderboard.sql',import.meta.url),'utf8'));return db;};
const count=db=>db.sqlite.prepare('SELECT COUNT(*) n FROM challenges').get().n;
const groundReplay=()=>{const run=createRun(challenge);while(!run.dead&&!run.complete)stepRun(run,challenge);return {rules:RULES,inputs:[],endTick:run.tick};};

test('a finishable challenge is published once and ignored when repeated',async()=>{
  const db=await fresh();const first=await publishChallenge(db,witness,challenge);assert.equal(first.published,true);assert.equal(first.id,challenge.id);assert.equal(count(db),1);
  assert.equal((await publishChallenge(db,witness,challenge)).published,false);assert.equal(count(db),1);db.close();
});
test('an unfinishable witness or a missing window publishes nothing',async()=>{
  const db=await fresh();
  await assert.rejects(publishChallenge(db,groundReplay(),challenge),e=>e.status===422);
  await assert.rejects(publishChallenge(db,{rules:'wheel-2',inputs:[],endTick:10},challenge),e=>e.status===422);
  await assert.rejects(publishChallenge(db,witness,null),e=>e.status===409);assert.equal(count(db),0);db.close();
});
test('the admin endpoint needs the configured token and rebuilds the challenge itself',async()=>{
  const db=await fresh(),real=globalThis.fetch;
  const post=(token,body=JSON.stringify({witness}))=>api(new Request('https://example.com/api/admin/publish',{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body}),{DB:db,PUBLISH_TOKEN:'correct-token'});
  try{
    assert.equal((await api(new Request('https://example.com/api/admin/publish',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}),{DB:db})).status,503);
    assert.equal((await post(null)).status,401);assert.equal((await post('wrong')).status,401);assert.equal(count(db),0);
    globalThis.fetch=async()=>({ok:true,status:200,json:async()=>structuredClone(captured)});
    const ok=await post('correct-token');assert.equal(ok.status,200);const result=await ok.json();assert.equal(result.published,true);assert.equal(result.id,challenge.id);assert.equal(count(db),1);
    assert.equal((await (await post('correct-token')).json()).published,false);
    // a witness that does not finish this challenge is refused even with the right token
    await assert.rejects(post('correct-token',JSON.stringify({witness:groundReplay()})),e=>e.status===422);assert.equal(count(db),1);
  }finally{globalThis.fetch=real;db.close();}
});
