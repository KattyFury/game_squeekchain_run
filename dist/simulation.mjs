import {TAU,PATTERNS,randomSource,groupPolygons,intersectsPolygonBox} from './engine.mjs';

export const RULES='wheel-2';
export const HZ=120, MAX_TICKS=7200, MAX_INPUTS=600;
export function createRun(challenge){
  if(challenge.rules!==RULES)throw Error('Unsupported rules');
  const random=randomSource(BigInt(challenge.seed));
  // Every group starts beyond the hidden half. A full flight/recovery gap separates groups.
  const groups=Array.from({length:34},(_,i)=>({offset:-(2.8+i*3.4),parts:PATTERNS[Math.floor(random()*PATTERNS.length)].map(p=>({...p})),passed:false}));
  return {tick:0,height:0,velocity:0,jumps:0,angle:0,speed:0,score:0,passed:0,dead:false,complete:false,groups};
}
export function targetSpeed(challenge,tick){
  if(challenge.kind==='practice')return Math.min(1.4,.8+tick/HZ*.003);
  const samples=challenge.speeds;let lo=0,hi=samples.length-1;
  while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(samples[mid].tick<=tick)lo=mid;else hi=mid-1;}
  return samples[lo].speed/1000000;
}
export function stepRun(run,challenge,press=false){
  if(run.dead||run.complete)return run;
  if(press&&run.jumps<2){run.velocity=455;run.jumps++;}
  const target=targetSpeed(challenge,run.tick);
  if(run.tick===0)run.speed=target;
  run.speed+=(target-run.speed)*2/HZ;
  run.angle+=run.speed/HZ;run.velocity-=1280/HZ;run.height+=run.velocity/HZ;
  if(run.height<=0){run.height=0;run.velocity=0;run.jumps=0;}
  const box={x:461,y:310-run.height-29,w:34,h:26};
  for(const group of run.groups){
    const relative=group.offset+run.angle;
    if(relative>1.4||relative< -1.4)continue;
    if(groupPolygons(group,run.angle,228,480,82).some(({poly})=>intersectsPolygonBox(poly,box)))run.dead=true;
    if(relative>.7&&!group.passed){group.passed=true;run.passed++;}
  }
  run.tick++;
  run.score=Math.floor(run.angle*100)+run.passed*25;
  if(run.tick>=challenge.durationTicks)run.complete=true;
  return run;
}
export function validateReplay(challenge,replay){
  if(!replay||replay.rules!==RULES||!Number.isInteger(replay.endTick)||replay.endTick<1||replay.endTick>challenge.durationTicks||!Array.isArray(replay.inputs)||replay.inputs.length>MAX_INPUTS)throw Error('Invalid replay');
  let previous=-1;for(const t of replay.inputs){if(!Number.isInteger(t)||t<=previous||t<0||t>=replay.endTick||t-previous<6&&previous>=0)throw Error('Invalid input ticks');previous=t;}
  const run=createRun(challenge);let index=0;
  while(run.tick<replay.endTick&&!run.dead&&!run.complete){const press=replay.inputs[index]===run.tick;if(press)index++;stepRun(run,challenge,press);}
  if(run.tick!==replay.endTick||(!run.dead&&!run.complete))throw Error('Replay must finish at collision or challenge end');
  return {score:run.score,ticks:run.tick,completed:run.complete&&!run.dead};
}
