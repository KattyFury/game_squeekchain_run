import {challengeFromRuns} from './challenge.mjs';
// Newest eligible hardware window as a challenge, or null when the wheel has no continuous 30s+ window yet.
// Shared by the Worker (to rebuild the challenge itself) and the host scripts (to solve it).
export async function latestHardwareChallenge({fetcher=fetch,pages=5,pause=550}={}){
  let cursor=null,header,challenge=null;const seen=new Set(),items=[];
  for(let page=0;page<pages&&!challenge;page++){
    const url=new URL('https://api.squeekchain.com/v1/measurement/runs');url.searchParams.set('limit','100');if(cursor)url.searchParams.set('cursor',cursor);
    const response=await fetcher(url,{signal:AbortSignal.timeout(8000)});if(!response.ok)throw Error('Hardware history HTTP '+response.status);
    const body=await response.json();if(body.schemaVersion!=='measurement-runs.v1')throw Error('Unsupported hardware history');
    if(header&&body.installationId!==header.installationId)throw Error('Installation changed while paging');header=body;items.push(...body.items);
    try{challenge=await challengeFromRuns({...body,items});}catch(e){if(e.message!=='No continuous hardware window of at least 30 seconds')throw e;}
    cursor=body.nextCursor;if(!cursor||seen.has(cursor)||!body.items.length)break;seen.add(cursor);
    if(!challenge)await new Promise(resolve=>setTimeout(resolve,pause));
  }
  return challenge;
}
