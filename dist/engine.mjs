export const TAU=Math.PI*2;
export function readMeasurement(body,now=Date.now()){
 if(body?.schemaVersion!==1)throw Error('Unsupported status schema');
 const m=body.measurement;if(!m)throw Error('No measurement available');
 const at=Date.parse(m.receivedAt),age=(now-at)/1000;
 if(!Number.isFinite(at)||!Number.isFinite(m.staleAfterSeconds)||m.staleAfterSeconds<=0||age< -30||age>m.staleAfterSeconds||m.freshness!=='online')throw Error('Stale or offline measurement');
 if(m.provenance!=='hardware')throw Error('Source '+m.provenance+' cannot be used for live mode');
 if(!['ACTIVE','IDLE'].includes(m.coreStatus))throw Error('Device is not ready');
 if(!Number.isInteger(m.rpmMilli)||m.rpmMilli<0||!Number.isInteger(m.speedMmPerSecond)||m.speedMmPerSecond<0||typeof m.counterEpoch!=='string'||!/^\d+$/.test(m.cumulativeWorkUnits))throw Error('Invalid measurement');
 if(body.oracle?.state!=='accepted')throw Error('Oracle has not accepted the measurement');
 return {rpm:m.rpmMilli/1000,speed:m.speedMmPerSecond,active:m.coreStatus==='ACTIVE'&&m.speedMmPerSecond>0,epoch:m.counterEpoch,work:BigInt(m.cumulativeWorkUnits),expiresAt:at+m.staleAfterSeconds*1000,block:body.builder?.status==='available'?body.builder.anchor?.blockHeight:null};
}
export function liveSpeed(m){return m.active?Math.max(.55,Math.min(1.4,m.speed/1000)):0}
export function randomSource(seed=1n){let n=Number(BigInt(seed)%2147483647n)||1;return ()=>{n=n*16807%2147483647;return n/2147483647}}
// Authored patterns: randomized as groups, never independent walls across all lanes.
export const PATTERNS=[
 [{delta:0,lift:0,height:26,width:20}],
 [{delta:0,lift:0,height:88,width:12,kind:'tower'}],
 [{delta:-.16,lift:0,height:22,width:16},{delta:.16,lift:0,height:26,width:16}],
 [{delta:0,lift:0,height:26,width:20},{delta:0,lift:128,height:18,width:30,kind:'air'}],
 [{delta:-.2,lift:70,height:18,width:26,kind:'air'},{delta:.2,lift:128,height:18,width:26,kind:'air'}],
 [{delta:.6,lift:70,height:18,width:22,kind:'air'},{delta:0,lift:0,height:24,width:18}],
];
export function varyObstacle(o,next){o.offset=o.base+(next()-.5)*.4;o.pattern=Math.floor(next()*PATTERNS.length);o.parts=PATTERNS[o.pattern].map(part=>({...part}));return o}
export function groupPolygons(o,angle,r,cx,cy){return o.parts.map(part=>({part,poly:obstaclePolygon(Math.PI/2+o.offset+angle+part.delta,r-part.lift,part.height,part.width,cx,cy)}))}
export function makeObstacles(seed=1n){const next=randomSource(seed);return Array.from({length:3},(_,i)=>varyObstacle({base:-1.4-i*TAU/3,passed:-1,hiddenTurn:null},next))}
export function obstaclePolygon(a,r,h,w,cx,cy){const d=w/(2*r);return [[r,a-d],[r,a+d],[r-h,a+d],[r-h,a-d]].map(([r,a])=>({x:cx+Math.cos(a)*r,y:cy+Math.sin(a)*r}))}
export function intersectsPolygonBox(poly,b){const points=[{x:b.x,y:b.y},{x:b.x+b.w,y:b.y},{x:b.x+b.w,y:b.y+b.h},{x:b.x,y:b.y+b.h}];for(const shape of [poly,points])for(let i=0;i<shape.length;i++){const a=shape[i],c=shape[(i+1)%shape.length],axis={x:-(c.y-a.y),y:c.x-a.x},dot=p=>p.x*axis.x+p.y*axis.y,p=poly.map(dot),q=points.map(dot);if(Math.max(...p)<Math.min(...q)||Math.max(...q)<Math.min(...p))return false}return true}
