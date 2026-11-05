import {createPublicClient,http,parseAbi,keccak256,getAddress} from 'viem';
import {sepolia} from 'viem/chains';
import manifest from './evidence/sepolia-deployment.json' with {type:'json'};
import coreAbi from './evidence/core-abi.json' with {type:'json'};
import miningAbi from './evidence/mining-abi.json' with {type:'json'};
const identity=parseAbi(['function implementationCodeAddress() view returns (address)','function implementationCodeVersion() view returns (uint64)','function implementationStorageLayoutDigest() view returns (bytes32)','function owner() view returns (address)','function mining() view returns (address)']);
const IMPLEMENTATION='0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc',ADMIN='0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103';
const same=(a,b)=>String(a).toLowerCase()===String(b).toLowerCase();
export async function readSepoliaSnapshot(rpc='https://ethereum-sepolia-rpc.publicnode.com'){
  const client=createPublicClient({chain:sepolia,transport:http(rpc,{timeout:12000,retryCount:0}),batch:{multicall:{wait:10}}});
  if(await client.getChainId()!==manifest.chainId)throw Error('Sepolia RPC chain mismatch');
  const head=await client.getBlockNumber(),blockNumber=head-12n,block=await client.getBlock({blockNumber});
  const read=(address,abi,functionName,args)=>client.readContract({address,abi,functionName,args,blockNumber});
  await Promise.all(['SqueekCore','SqueekMining'].map(async name=>{
    const expected=manifest.contracts[name],address=expected.address;
    const [implWord,adminWord]=await Promise.all([client.getStorageAt({address,slot:IMPLEMENTATION,blockNumber}),client.getStorageAt({address,slot:ADMIN,blockNumber})]);
    const impl=getAddress('0x'+implWord.slice(-40)),admin=getAddress('0x'+adminWord.slice(-40));
    if(!same(impl,expected.implementation)||!same(admin,expected.proxyAdmin))throw Error(name+' proxy identity mismatch');
    const [code,reported,version,layout,owner]=await Promise.all([client.getCode({address:impl,blockNumber}),read(address,identity,'implementationCodeAddress'),read(address,identity,'implementationCodeVersion'),read(address,identity,'implementationStorageLayoutDigest'),read(admin,identity,'owner')]);
    if(!code||!same(keccak256(code),expected.implementationRuntimeHash)||!same(reported,impl)||version!==BigInt(expected.implementationVersion)||!same(layout,expected.storageLayoutDigest)||!same(owner,manifest.operational.governanceTimelock.address))throw Error(name+' implementation verification failed');
  }));
  const core=manifest.contracts.SqueekCore.address,mining=manifest.contracts.SqueekMining.address;
  const link=parseAbi(['function core() view returns (address)','function mining() view returns (address)','function token() view returns (address)']);
  const staking=manifest.contracts.SqueekStaking.address;
  const [miningCore,tokenMining,stakingCore,stakingMining,stakingToken,config,state]=await Promise.all([read(mining,miningAbi,'core'),read(manifest.contracts.SqueekToken.address,identity,'mining'),read(staking,link,'core'),read(staking,link,'mining'),read(staking,link,'token'),read(core,coreAbi,'configuration'),read(core,coreAbi,'state')]);
  if(!same(miningCore,core)||!same(tokenMining,mining)||!same(stakingCore,core)||!same(stakingMining,mining)||!same(stakingToken,manifest.contracts.SqueekToken.address))throw Error('Squeekchain graph mismatch');
  const expectedCore=manifest.coreConfiguration||{...manifest.launchConfiguration.core,roundDuration:manifest.launchConfiguration.core.roundDurationSeconds};
  for(const [key,value] of Object.entries(expectedCore)){if(!(key in config))continue;if(typeof config[key]==='bigint'?config[key]!==BigInt(value):typeof config[key]==='string'?!same(config[key],value):config[key]!==value)throw Error('Core configuration mismatch: '+key);}
  if(state.blockHeight!==state.cumulativeBlockUnits/config.blockUnitsPerBlock||state.blockProgress!==state.cumulativeBlockUnits%config.blockUnitsPerBlock)throw Error('Core state inconsistent');
  const frontier=await read(core,coreAbi,'roundPage',[state.settledThroughRound,state.settledThroughRound,0n]);
  if(frontier.certifiedThroughRound!==state.settledThroughRound||frontier.end.cumulativeBlockUnits!==state.cumulativeBlockUnits||frontier.end.workPerThousandBlocks!==state.workPerThousandBlocks)throw Error('Certified frontier mismatch');
  if((await client.getBlock({blockNumber})).hash!==block.hash)throw Error('Sepolia reorganized during read');
  return {verified:true,chainId:manifest.chainId,release:manifest.release,core,ethereumBlock:blockNumber.toString(),ethereumBlockHash:block.hash,blockTimestamp:Number(block.timestamp),confirmations:12,settledThroughRound:state.settledThroughRound.toString(),squeekBlock:state.blockHeight.toString(),cumulativeWork:state.cumulativeWork.toString(),paused:state.paused,checkedAt:new Date().toISOString(),explorer:manifest.explorer+'/address/'+core};
}
