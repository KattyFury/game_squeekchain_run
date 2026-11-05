import test from 'node:test';import assert from 'node:assert/strict';import {RULES,HZ,createRun,stepRun} from '../simulation.mjs';
const challenge={rules:RULES,kind:'recorded',seed:'1',durationTicks:7200,speeds:[{tick:0,speed:1000000}]};
// One block ahead of the hamster; the wheel turns at 1 rad/s so the block arrives after about 0.55 s.
function play(part,inputs,at=-.55,ticks=HZ*2){
  const run=createRun(challenge);run.groups=[{offset:at,parts:[{delta:0,lift:0,height:26,width:20,...part}],passed:false}];
  const top=(part.lift||0)+(part.height??26);let stoodOn=false,minVelocityOnTop=0,jumpsOnTop=null;
  for(let i=0;i<ticks&&!run.dead;i++){stepRun(run,challenge,inputs.includes(run.tick));if(Math.abs(run.height-top)<1e-9&&top>0){stoodOn=true;jumpsOnTop=run.jumps;}}
  return {run,stoodOn,jumpsOnTop};
}
const range=(a,b,step=1)=>Array.from({length:Math.floor((b-a)/step)+1},(_,i)=>a+i*step);

test('running into the side of a block ends the run',()=>{assert.equal(play({},[]).run.dead,true);});

test('a jump can land on top of a block and stand on it, and it is not fatal',()=>{
  const hits=range(0,40).map(s=>play({},[s])).filter(r=>r.stoodOn);
  assert(hits.length>0,'no jump timing lands on the block');
  for(const r of hits){assert.equal(r.run.dead,false);assert.equal(r.run.height,0,'must drop back to the floor once the block has passed');}
});

test('standing on a block refills both jumps',()=>{
  const hit=range(0,40).map(s=>play({},[s])).find(r=>r.stoodOn);assert(hit);assert.equal(hit.jumpsOnTop,0);
});

test('a jump timed too late clears the block only if it is above it; too early ends the run',()=>{
  const outcomes=new Set(range(0,120).map(s=>play({},[s]).run.dead?'dead':'alive'));assert(outcomes.has('dead')&&outcomes.has('alive'));
});

test('a tall tower cannot be cleared or stood on with one jump, but a double jump reaches its top',()=>{
  const tower={height:88,width:12};
  assert(range(0,120).every(s=>play(tower,[s]).run.dead),'a single jump must not beat an 88px tower');
  let reached=false;for(let a=0;a<60&&!reached;a++)for(let gap=6;gap<=70&&!reached;gap++){const r=play(tower,[a,a+gap]);if(r.stoodOn&&!r.run.dead)reached=true;}
  assert(reached,'no double-jump timing reaches the tower top');
});

test('bumping the head under a floating bar stops the jump but does not end the run',()=>{
  const bar={lift:70,height:18,width:60};let bumped=false;
  for(let s=0;s<90;s++){const run=createRun(challenge);run.groups=[{offset:-.30,parts:[{delta:0,...bar}],passed:false}];
    for(let i=0;i<HZ&&!run.dead;i++){stepRun(run,challenge,i===s);if(run.height>0&&Math.abs(run.height+26-70)<1e-9)bumped=true;}
    if(bumped){assert.equal(run.dead,false);break;}}
  assert(bumped,'no timing produced a head bump');
});

test('rules identifier changed with the physics and pacing',()=>{assert.equal(RULES,'wheel-4');});
test('groups are spaced 1.7-2.2 rad apart and cover the longest possible run',async()=>{
  const {FIRST_GROUP,GAP_MIN,GAP_MAX}=await import('../simulation.mjs');
  for(const seed of ['1','53','991']){const run=createRun({...challenge,seed});const offsets=run.groups.map(g=>-g.offset);
    assert.equal(offsets[0],FIRST_GROUP);for(let i=1;i<offsets.length;i++){const gap=offsets[i]-offsets[i-1];assert(gap>=GAP_MIN-1e-9&&gap<=GAP_MAX+1e-9,'gap '+gap);}
    assert(offsets.at(-1)>1.4*60+2,'groups must outlast a full 60 s run at top speed');}
});
