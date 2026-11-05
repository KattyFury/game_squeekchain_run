import {PATTERNS,randomSource} from './engine.mjs';

export const RULES='wheel-4';
export const HZ=120, MAX_TICKS=7200, MAX_INPUTS=600;
// Solid obstacles live in wheel space: angle around the rim x height above the rim.
// The hamster stands at angle 0 (6 o'clock); its feet are at run.height, its body is BODY_H tall.
// Pacing: groups sit 1.7-2.2 rad apart (about 1.5-2.5 s at typical wheel speeds). 64 groups cover the longest run (1.4 rad/s x 60 s).
export const FIRST_GROUP=2.8, GAP_MIN=1.7, GAP_MAX=2.2, GROUPS=64;
const RADIUS=228, HAMSTER_HALF=17/RADIUS, BODY_H=26, STEP=6, EPS=1e-6;
function solidsAtHamster(run){
  const solids=[];
  for(const group of run.groups){
    const relative=group.offset+run.angle;if(relative>1.4||relative< -1.4)continue;
    for(const part of group.parts){
      const at=relative+part.delta,half=part.width/(2*(RADIUS-part.lift));
      if(at-half<HAMSTER_HALF&&at+half>-HAMSTER_HALF)solids.push({bottom:part.lift,top:part.lift+part.height});
    }
  }
  return solids;
}
export function createRun(challenge){
  if(challenge.rules!==RULES)throw Error('Unsupported rules');
  const random=randomSource(BigInt(challenge.seed));
  // Every group starts beyond the hidden half. Gaps are 1.7-2.2 rad: busy, and still finishable at every supported speed.
  let at=FIRST_GROUP;
  const groups=Array.from({length:GROUPS},()=>{const group={offset:-at,parts:PATTERNS[Math.floor(random()*PATTERNS.length)].map(p=>({...p})),passed:false};at+=GAP_MIN+random()*(GAP_MAX-GAP_MIN);return group;});
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
  const previous=run.height;
  run.angle+=run.speed/HZ;run.velocity-=1280/HZ;run.height+=run.velocity/HZ;
  const solids=solidsAtHamster(run);
  // Land on top: falling onto (or within a small step of) the top face of a block stands on it.
  let support=0;
  if(run.velocity<=0)for(const b of solids)if(previous>=b.top-STEP&&run.height<=b.top+EPS&&b.top>support)support=b.top;
  if(support>0){run.height=support;run.velocity=0;run.jumps=0;}
  else if(run.height<=0){run.height=0;run.velocity=0;run.jumps=0;}
  // Anything still overlapping: bump the head under a floating bar, otherwise the block's side ends the run.
  for(const b of solids){
    if(run.height<b.top-EPS&&run.height+BODY_H>b.bottom+EPS){
      if(run.velocity>0&&previous+BODY_H<=b.bottom+EPS){run.height=b.bottom-BODY_H;run.velocity=0;}
      else run.dead=true;
    }
  }
  for(const group of run.groups)if(group.offset+run.angle>.7&&!group.passed){group.passed=true;run.passed++;}
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
