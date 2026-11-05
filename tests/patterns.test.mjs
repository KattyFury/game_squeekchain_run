import test from 'node:test';import assert from 'node:assert/strict';import {PATTERNS} from '../engine.mjs';import {RULES,HZ,createRun,stepRun} from '../simulation.mjs';
// Every authored pattern must be passable with Space alone at every supported speed, using the shared rules.
function survives(parts,speed,inputs){
  const challenge={rules:RULES,kind:'recorded',seed:'1',durationTicks:7200,speeds:[{tick:0,speed:Math.round(speed*1e6)}]};
  const run=createRun(challenge);run.groups=[{offset:-1.4,parts:parts.map(p=>({...p})),passed:false}];
  const end=Math.ceil((1.4+1.6)/speed*HZ);let index=0;
  while(run.tick<end&&!run.dead){const press=inputs[index]===run.tick;if(press)index++;stepRun(run,challenge,press);}
  return !run.dead&&run.passed===1;
}
function solve(parts,speed){
  const center=Math.round(1.4/speed*HZ);
  if(survives(parts,speed,[]))return [];
  for(let a=Math.max(0,center-130);a<center+12;a+=3){if(survives(parts,speed,[a]))return [a];for(let gap=12;gap<=78;gap+=4)if(survives(parts,speed,[a,a+gap]))return [a,a+gap];}
  return null;
}
for(let i=0;i<PATTERNS.length;i++)test('pattern '+i+' has a Space-only route at all supported speeds',()=>{for(const speed of [.55,.8,1.1,1.4])assert.notEqual(solve(PATTERNS[i],speed),null,'no path at speed '+speed)});
