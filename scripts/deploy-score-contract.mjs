// Host-only: deploys the single canonical SqueekRunScores contract on Sepolia and registers it in D1.
// Players never deploy. Usage:
//   $env:DEPLOYER_PRIVATE_KEY='0x…'; node scripts/deploy-score-contract.mjs <keys.env>
// The deployer key pays gas only (Sepolia test ETH) and holds no special rights in the contract.
import fs from 'node:fs';import {spawnSync} from 'node:child_process';
import {createPublicClient,createWalletClient,http,keccak256,formatEther} from 'viem';
import {sepolia} from 'viem/chains';import {privateKeyToAccount} from 'viem/accounts';
import artifact from '../contracts/artifacts/SqueekRunScores.json' with {type:'json'};

const [keyFile]=process.argv.slice(2);if(!keyFile)throw Error('Usage: node scripts/deploy-score-contract.mjs <keys.env>  (with DEPLOYER_PRIVATE_KEY in the environment)');
const keys={};for(const line of fs.readFileSync(keyFile,'utf8').split(/\r?\n/)){const m=line.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*)$/);if(m)keys[m[1]]=m[2].trim().replace(/^['"]|['"]$/g,'');}
const deployerKey=process.env.DEPLOYER_PRIVATE_KEY||keys.SQUEEK_RUN_DEPLOYER_KEY;
if(!/^0x[0-9a-fA-F]{64}$/.test(deployerKey||''))throw Error('Set DEPLOYER_PRIVATE_KEY (or SQUEEK_RUN_DEPLOYER_KEY in the keys file)');
if(!/^0x[0-9a-fA-F]{64}$/.test(keys.SQUEEK_RUN_ATTESTATION_KEY||''))throw Error('SQUEEK_RUN_ATTESTATION_KEY missing in keys file');

const RPC=process.env.SEPOLIA_RPC_URL||'https://ethereum-sepolia-rpc.publicnode.com';
const deployer=privateKeyToAccount(deployerKey),attestor=privateKeyToAccount(keys.SQUEEK_RUN_ATTESTATION_KEY);
const rpc=createPublicClient({chain:sepolia,transport:http(RPC)}),wallet=createWalletClient({account:deployer,chain:sepolia,transport:http(RPC)});
if(await rpc.getChainId()!==11155111)throw Error('RPC is not Sepolia');

const args=[attestor.address];
const balance=await rpc.getBalance({address:deployer.address});
console.log('deployer',deployer.address,'balance',formatEther(balance),'ETH');
console.log('attestor',attestor.address);
if(balance===0n)throw Error('Deployer has no Sepolia ETH. Fund '+deployer.address+' first.');

const hash=await wallet.deployContract({abi:artifact.abi,bytecode:artifact.bytecode,args});
console.log('deploy tx',hash);
const receipt=await rpc.waitForTransactionReceipt({hash,timeout:180000});
if(receipt.status!=='success'||!receipt.contractAddress)throw Error('Deployment reverted: '+hash);
const address=receipt.contractAddress;

const [code,onchainAttestor]=await Promise.all([rpc.getCode({address}),rpc.readContract({address,abi:artifact.abi,functionName:'attestor'})]);
if(!code||keccak256(code)!==keccak256(artifact.deployedBytecode))throw Error('Deployed runtime code does not match the compiled artifact');
if(onchainAttestor.toLowerCase()!==attestor.address.toLowerCase())throw Error('Contract attestor mismatch');
console.log('contract',address,'verified code + attestor');

fs.mkdirSync('work',{recursive:true});
const sql=`INSERT OR REPLACE INTO onchain_config VALUES (11155111,'${address.toLowerCase()}','${hash}',${Date.now()});\n`;
fs.writeFileSync('work/register-contract.sql',sql);
const result=spawnSync(process.execPath,['scripts/cloudflare.mjs',keyFile,'d1','execute','squeek-run-leaderboard','--remote','--file','work/register-contract.sql'],{stdio:'inherit'});
if(result.status)throw Error('Contract deployed but registering it in D1 failed. Re-run the registration with the SQL in work/register-contract.sql');
fs.writeFileSync('evidence/score-contract-deployment.json',JSON.stringify({chainId:11155111,contract:address,deploymentTx:hash,block:receipt.blockNumber.toString(),attestor:attestor.address,runtimeHash:keccak256(artifact.deployedBytecode),deployedAt:new Date().toISOString()},null,2)+'\n');
console.log('Registered. Explorer: https://eth-sepolia.blockscout.com/address/'+address);
