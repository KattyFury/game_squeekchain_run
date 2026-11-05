import {RULES,HZ,MAX_TICKS} from './simulation.mjs';
export async function digest(value){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(x=>x.toString(16).padStart(2,'0')).join('');}
export async function challengeFromRuns(body){
  if(body?.schemaVersion!=='measurement-runs.v1'||body.authority!=='pi-device-key'||body.certifiedCoreWork!==false||typeof body.installationId!=='string'||!Array.isArray(body.items))throw Error('Unsupported hardware history');
  const windows=[];let points=[],segments=[],continuity=null,last=null;
  const flush=()=>{if(points.length>1)windows.push({points,segments,continuity});points=[];segments=[];last=null;};
  for(const item of body.items){
    if(item.provenance!=='hardware'||item.measurementEligible!==true||!['staging','production'].includes(item.profile)||!Array.isArray(item.passages)){flush();continuity=null;continue;}
    if(item.continuityId!==continuity||item.discontinuity||last&&item.previousAt!==last){flush();continuity=item.continuityId;}
    for(const p of item.passages){const at=Date.parse(p.at);if(!Number.isFinite(at)||!/^\d+$/.test(p.offsetNs))throw Error('Invalid passage');
      if(points.length&&(at<=points.at(-1).ms||at-points.at(-1).ms>3000))flush();
      points.push({ms:at,at:p.at});if(!segments.includes(item.segmentId))segments.push(item.segmentId);last=p.at;
    }
  }flush();
  const window=windows.find(w=>w.points.at(-1).ms-w.points[0].ms>=30000);
  if(!window)throw Error('No continuous hardware window of at least 30 seconds');
  const origin=window.points[0].ms,span=Math.min(60000,window.points.at(-1).ms-origin),durationTicks=Math.min(MAX_TICKS,Math.floor(span*HZ/1000));
  const speeds=[];
  for(let i=1;i<window.points.length;i++){const tick=Math.floor((window.points[i-1].ms-origin)*HZ/1000);if(tick>=durationTicks)break;
    // One passage interval maps to 1.1 / intervalSeconds rad/s, clamped and smoothed by the game.
    const speed=Math.round(Math.max(.55,Math.min(1.4,1100/(window.points[i].ms-window.points[i-1].ms)))*1000000);
    if(speeds.at(-1)?.tick===tick)speeds.at(-1).speed=speed;else speeds.push({tick,speed});
  }
  const source={installationId:body.installationId,continuityId:window.continuity,segmentIds:window.segments,startAt:window.points[0].at,endAt:new Date(origin+span).toISOString(),authority:body.authority,certifiedCoreWork:false,profile:'hardware history'};
  const hash=await digest(JSON.stringify({rules:RULES,source,speeds,durationTicks}));
  return {id:hash,rules:RULES,kind:'recorded',seed:BigInt('0x'+hash.slice(0,12)).toString(),durationTicks,speeds,source};
}
