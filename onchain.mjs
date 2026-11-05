import {createPublicClient,http,keccak256,toHex,encodeFunctionData} from 'viem';
import {sepolia} from 'viem/chains';import {privateKeyToAccount} from 'viem/accounts';
import artifact from './contracts/artifacts/SqueekRunScores.json' with {type:'json'};
import {walletSession} from './wallet-auth.mjs';import {squeekCounts} from './holders.mjs';import deployed from './evidence/score-contract-deployment.json' with {type:'json'};import {validateReplay,RULES} from './simulation.mjs';
export const resultTypes={RunResult:[{name:'player',type:'address'},{name:'challengeId',type:'bytes32'},{name:'rulesHash',type:'bytes32'},{name:'replayHash',type:'bytes32'},{name:'runId',type:'bytes32'},{name:'score',type:'uint32'},{name:'ticks',type:'uint32'},{name:'completed',type:'bool'},{name:'deadline',type:'uint64'}]};
const fail=(message,status=400)=>Object.assign(Error(message),{status});
const client=env=>createPublicClient({chain:sepolia,transport:http(env.SEPOLIA_RPC_URL||'https://ethereum-sepolia-rpc.publicnode.com',{retryCount:0,timeout:12000})});
const signer=env=>{if(!env.SQUEEK_RUN_ATTESTATION_KEY)throw fail('Onchain attestor is not configured',503);return privateKeyToAccount(env.SQUEEK_RUN_ATTESTATION_KEY);};
export async function onchainConfig(env){const account=signer(env),row=await env.DB.prepare('SELECT * FROM onchain_config WHERE chain_id=11155111').first();return {chainId:11155111,attestor:account.address,contract:row?.contract_address||null,deploymentTx:row?.deployment_tx||null,abi:artifact.abi,runtimeHash:keccak256(artifact.deployedBytecode)};}
export async function attestRun(request,env,body){
  const wallet=await walletSession(request,env.DB);if(!wallet)throw fail('Sign in with the wallet that played this run',401);
  if(typeof body.attempt!=='string'||body.attempt.length!==36)throw fail('Invalid attempt');
  const row=await env.DB.prepare('SELECT * FROM entries WHERE attempt_id=?').bind(body.attempt).first();if(!row||row.wallet_address!==wallet)throw fail('No verified result for this wallet',403);
  const challenge=await env.DB.prepare('SELECT body FROM challenges WHERE id=?').bind(row.challenge_id).first();if(!challenge||row.rules!==RULES)throw fail('Unsupported challenge rules');
  const result=validateReplay(JSON.parse(challenge.body),JSON.parse(row.replay));if(result.score!==row.score||result.ticks!==row.ticks||Number(result.completed)!==row.completed)throw fail('Stored replay failed verification');
  const config=await onchainConfig(env);if(!config.contract)throw fail('Onchain saving is not open yet',409);
  const message={player:wallet,challengeId:'0x'+row.challenge_id,rulesHash:keccak256(toHex(row.rules)),replayHash:keccak256(toHex(row.replay)),runId:keccak256(toHex(row.attempt_id)),score:row.score,ticks:row.ticks,completed:!!row.completed,deadline:BigInt(Math.floor(Date.now()/1000)+3600)};
  const domain={name:'SqueekRunScores',version:'1',chainId:11155111,verifyingContract:config.contract};
  const signature=await signer(env).signTypedData({domain,types:resultTypes,primaryType:'RunResult',message});
  return {contract:config.contract,chainId:11155111,message:{...message,deadline:message.deadline.toString()},signature,transaction:{from:wallet,to:config.contract,data:encodeFunctionData({abi:artifact.abi,functionName:'saveRun',args:[message,signature]}),value:'0x0'}};
}

export async function onchainProgress(request,env){
  const wallet=await walletSession(request,env.DB),config=await onchainConfig(env);if(!wallet||!config.contract)return {wallet,contract:config.contract,savedRuns:'0',best:null};
  const row=await env.DB.prepare('SELECT challenge_id,attempt_id FROM entries WHERE wallet_address=? ORDER BY created_at DESC LIMIT 1').bind(wallet).first();
  const rpc=client(env);if(await rpc.getChainId()!==11155111)throw fail('Wrong progress network',503);
  const [saved,best,used]=await Promise.all([rpc.readContract({address:config.contract,abi:artifact.abi,functionName:'savedRuns',args:[wallet]}),row?rpc.readContract({address:config.contract,abi:artifact.abi,functionName:'bestScores',args:[wallet,'0x'+row.challenge_id,keccak256(toHex(RULES))]}):null,row?rpc.readContract({address:config.contract,abi:artifact.abi,functionName:'usedRunIds',args:[keccak256(toHex(row.attempt_id))]}):false]);
  return {wallet,contract:config.contract,savedRuns:saved.toString(),best:best?{challenge:row.challenge_id,score:best[0],ticks:best[1],completed:best[2]}:null,latestAttempt:row?.attempt_id||null,latestSaved:used};
}

// Best saved run per wallet for one challenge, highest score first (ties: fewer ticks, then earlier block).
export function topPlayers(runs,limit=20){
  const best=new Map();
  for(const run of runs){const key=run.player.toLowerCase(),current=best.get(key);
    if(!current||run.score>current.score||run.score===current.score&&(run.ticks<current.ticks||run.ticks===current.ticks&&run.block<current.block))best.set(key,run);}
  return [...best.values()].sort((a,b)=>b.score-a.score||a.ticks-b.ticks||(a.block<b.block?-1:1)).slice(0,limit);
}
export async function onchainLeaderboard(env,challengeId){
  if(!/^[a-f0-9]{64}$/.test(challengeId||''))throw fail('Invalid challenge');
  const config=await onchainConfig(env);if(!config.contract)return {contract:null,entries:[]};
  const event=artifact.abi.find(x=>x.type==='event'&&x.name==='RunSaved'),rulesHash=keccak256(toHex(RULES));
  const fromBlock=deployed.contract?.toLowerCase()===config.contract.toLowerCase()?BigInt(deployed.block):0n;
  const logs=await client(env).getLogs({address:config.contract,event,args:{challengeId:'0x'+challengeId},fromBlock,toBlock:'latest'});
  const top=topPlayers(logs.filter(l=>l.args.rulesHash===rulesHash).map(l=>({player:l.args.player,score:l.args.score,ticks:l.args.ticks,completed:l.args.completed,tx:l.transactionHash,block:l.blockNumber})));
  const counts=await squeekCounts(env,top.map(r=>r.player)).catch(()=>({}));
  return {contract:config.contract,entries:top.map(r=>({wallet:r.player.toLowerCase(),score:r.score,ticks:r.ticks,completed:r.completed,tx:r.tx,squeeks:counts[r.player.toLowerCase()]??null}))};
}
export async function holderStatus(request,env){
  const wallet=await walletSession(request,env.DB);if(!wallet)return {wallet:null,squeeks:0,holder:false};
  const counts=await squeekCounts(env,[wallet]),squeeks=counts[wallet]??0;return {wallet,squeeks,holder:squeeks>0};
}
