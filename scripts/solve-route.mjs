import {createRun,stepRun} from '../simulation.mjs';
// Build/test tool, never a player score. Search complete trajectories with the shared physics.
export function solveRoute(challenge){
  const trace=createRun(challenge);trace.groups=[];const angles=[0];while(!trace.complete){stepRun(trace,challenge);angles.push(trace.angle);}
  let run=createRun(challenge),inputs=[];
  const atAngle=a=>{let lo=0,hi=angles.length-1;while(lo<hi){const mid=(lo+hi)>>1;if(angles[mid]<a)lo=mid+1;else hi=mid;}return lo;};
  for(let groupIndex=0;groupIndex<run.groups.length;groupIndex++){
    const center=-run.groups[groupIndex].offset;if(center>angles.at(-1)+1)break;
    const start=Math.max(run.tick,atAngle(center-1.2)),end=atAngle(center+1.15),cross=atAngle(center);
    while(run.tick<start&&!run.dead&&!run.complete)stepRun(run,challenge);
    if(run.dead)throw Error('Unexpected collision before search');
    const options=[[]];for(let a=Math.max(start,cross-120);a<Math.min(end,cross+30);a+=6){options.push([a]);for(let gap=12;gap<=72;gap+=6)options.push([a,a+gap]);}
    let found=null;
    for(const candidate of options){const attempt=structuredClone(run);let index=0;while(attempt.tick<end&&!attempt.dead&&!attempt.complete){const press=candidate[index]===attempt.tick;if(press)index++;stepRun(attempt,challenge,press);}if(!attempt.dead&&(attempt.complete||attempt.height===0)){found={run:attempt,inputs:candidate.filter(t=>t<attempt.tick)};break;}}
    if(!found)throw Error('No complete route at group '+groupIndex+' seed '+challenge.seed);run=found.run;inputs.push(...found.inputs);if(run.complete)break;
  }
  while(!run.complete&&!run.dead)stepRun(run,challenge);
  if(run.dead)throw Error('Route failed at the end');
  return {rules:challenge.rules,inputs,endTick:run.tick};
}
