import {createPublicClient,http,parseAbi} from 'viem';
import {sepolia} from 'viem/chains';
import manifest from './evidence/sepolia-deployment.json' with {type:'json'};
const abi=parseAbi(['function balanceOf(address) view returns (uint256)']);
const cache=new Map(),TTL=60000;
const client=env=>createPublicClient({chain:sepolia,transport:http(env.SEPOLIA_RPC_URL||'https://ethereum-sepolia-rpc.publicnode.com',{retryCount:0,timeout:12000}),batch:{multicall:{wait:5}}});
// How many Squeek NFTs each address holds (read-only). Unreadable addresses are simply omitted.
export async function squeekCounts(env,addresses){
  const out={},now=Date.now(),rpc=client(env);
  await Promise.all([...new Set(addresses.filter(a=>/^0x[0-9a-fA-F]{40}$/.test(a||'')).map(a=>a.toLowerCase()))].map(async address=>{
    const hit=cache.get(address);if(hit&&now-hit.at<TTL){out[address]=hit.count;return;}
    try{const count=Number(await rpc.readContract({address:manifest.contracts.SqueekNFT.address,abi,functionName:'balanceOf',args:[address]}));cache.set(address,{count,at:now});out[address]=count;}catch{}
  }));
  return out;
}
