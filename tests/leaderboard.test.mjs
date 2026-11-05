import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
import {topPlayers,onchainLeaderboard,holderStatus} from '../onchain.mjs';import {database} from '../local-db.mjs';import {squeekCounts} from '../holders.mjs';
const run=(player,score,ticks,block)=>({player,score,ticks,block:BigInt(block),completed:true,tx:'0x'+String(block).padStart(64,'0')});
test('topPlayers keeps each wallet best run and orders by score, then ticks, then block',()=>{
  const rows=topPlayers([run('0xAaAa000000000000000000000000000000000001',100,7200,5),run('0xaaaa000000000000000000000000000000000001',300,7200,6),run('0xBBbb000000000000000000000000000000000002',300,7000,7),run('0xCCcc000000000000000000000000000000000003',300,7000,4),run('0xDDdd000000000000000000000000000000000004',50,100,1)]);
  assert.deepEqual(rows.map(r=>r.player.toLowerCase().slice(-1)),['3','2','1','4']);assert.equal(rows.length,4);assert.equal(rows[2].score,300);
});
test('topPlayers respects the limit',()=>{const rows=topPlayers(Array.from({length:30},(_,i)=>run('0x'+(i+1).toString(16).padStart(40,'0'),i,100,i)),20);assert.equal(rows.length,20);assert.equal(rows[0].score,29);});
test('squeekCounts ignores malformed addresses without touching the network',async()=>{assert.deepEqual(await squeekCounts({},['nope','0x123',null,undefined]),{});});
test('holder status is empty without a session and the onchain board is empty without a contract',async()=>{
  const db=database();for(const migration of ['0001_leaderboard.sql','0002_wallet.sql','0003_onchain.sql'])db.sqlite.exec(await fs.readFile(new URL('../migrations/'+migration,import.meta.url),'utf8'));
  const env={DB:db,SQUEEK_RUN_ATTESTATION_KEY:'0x'+'11'.repeat(32)};
  assert.deepEqual(await holderStatus(new Request('https://x.test/api/holder'),env),{wallet:null,squeeks:0,holder:false});
  assert.deepEqual(await onchainLeaderboard(env,'a'.repeat(64)),{contract:null,entries:[]});
  await assert.rejects(onchainLeaderboard(env,'not-a-challenge'),/Invalid challenge/);db.close();
});
