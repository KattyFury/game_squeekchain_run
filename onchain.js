import {connectedWallet} from './wallet.js';
const $=id=>document.getElementById(id),EXPLORER='https://eth-sepolia.blockscout.com';
let config=null,eligible=null,busy=false,savedAttempt=null;
try{eligible=localStorage.getItem('squeek-checked-attempt');}catch{}
const show=message=>$('onchain-state').textContent=message;
async function api(path,body){const response=await fetch('/api/onchain/'+path,{method:body?'POST':'GET',credentials:'same-origin',headers:body?{'Content-Type':'application/json'}:{},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});const result=await response.json();if(!response.ok)throw Error(result.error||'Onchain service unavailable');return result;}
function render(){const active=!!config?.contract;$('deploy-scores').hidden=active||!config;$('deploy-scores').disabled=busy;$('save-onchain').disabled=busy||!active||!eligible||eligible===savedAttempt;$('score-contract').hidden=!active;if(active)$('score-contract').href=EXPLORER+'/address/'+config.contract;}
async function load(){try{config=await api('config');render();await loadProgress();show(config.contract?'Sepolia score contract ready. Submit a signed-in run, then save its checked result onchain.':'One-time setup: deploy the score contract on Sepolia using your wallet. Gas is paid in test ETH.');}catch(e){show(e.message);}}
export function setEligibleRun(attempt){eligible=attempt;try{localStorage.setItem('squeek-checked-attempt',attempt);}catch{}render();}
window.addEventListener('squeek:verified-run',event=>{setEligibleRun(event.detail);loadProgress();});
function transactionLink(hash){$('onchain-tx').href=EXPLORER+'/tx/'+hash;$('onchain-tx').hidden=false;}
async function receipt(provider,hash){for(let i=0;i<90;i++){const value=await provider.request({method:'eth_getTransactionReceipt',params:[hash]});if(value){if(value.status!=='0x1')throw Error('Transaction reverted. Check the explorer before trying again.');return value;}await new Promise(resolve=>setTimeout(resolve,2000));}throw Error('Transaction is still pending. Check the explorer; do not send a duplicate.');}
$('deploy-scores').addEventListener('click',async()=>{
  if(busy)return;busy=true;render();
  try{const {provider,address}=await connectedWallet();config=await api('config');if(config.contract){show('The score contract is already deployed.');render();return;}
    let hash;try{const pending=JSON.parse(localStorage.getItem('squeek-score-deployment')||'null');if(pending?.wallet===address)hash=pending.hash;}catch{}
    if(!hash){show('Review the one-time Sepolia contract deployment in your wallet. This uses test ETH for gas.');const tx={from:address,data:config.deploymentData,value:'0x0'};await provider.request({method:'eth_estimateGas',params:[tx]});hash=await provider.request({method:'eth_sendTransaction',params:[tx]});try{localStorage.setItem('squeek-score-deployment',JSON.stringify({wallet:address,hash}));}catch{}}
    transactionLink(hash);show('Deployment submitted. Waiting for a Sepolia receipt…');const result=await receipt(provider,hash);config=await api('activate',{address:result.contractAddress,transactionHash:hash});try{localStorage.removeItem('squeek-score-deployment');}catch{}show('Score contract is live on Sepolia. Save a checked result onchain.');
  }catch(e){show(e.code===4001?'Deployment cancelled in wallet. No new transaction was submitted.':e.message||'Deployment failed');}finally{busy=false;render();}
});
$('save-onchain').addEventListener('click',async()=>{
  if(busy||!eligible)return;const attempt=eligible;busy=true;render();
  try{const {provider,address}=await connectedWallet(),attestation=await api('attest',{attempt});if(attestation.message.player.toLowerCase()!==address.toLowerCase())throw Error('This result belongs to another wallet.');
    let pending;try{pending=JSON.parse(localStorage.getItem('squeek-score-save')||'null');}catch{}
    let hash=pending?.attempt===attempt&&pending?.wallet===address?pending.hash:null;
    if(!hash){await provider.request({method:'eth_call',params:[attestation.transaction,'latest']});show('Review Save onchain in your wallet. This uses Sepolia test ETH for gas.');hash=await provider.request({method:'eth_sendTransaction',params:[attestation.transaction]});try{localStorage.setItem('squeek-score-save',JSON.stringify({attempt,wallet:address,hash}));}catch{}}
    transactionLink(hash);show('Score transaction submitted. Waiting for confirmation…');await receipt(provider,hash);savedAttempt=attempt;await loadProgress();show('Result saved on Sepolia. Open the transaction to inspect the RunSaved event.');try{localStorage.removeItem('squeek-score-save');}catch{}
  }catch(e){show(e.code===4001?'Onchain save cancelled in wallet.':e.message||'Onchain save failed');}finally{busy=false;render();}
});
async function loadProgress(){if(!config?.contract)return;try{const progress=await api('progress');$('onchain-progress').textContent=progress.wallet?progress.savedRuns+' runs saved on Sepolia'+(progress.best?.ticks?' · onchain best '+progress.best.score+' for '+progress.best.challenge.slice(0,8):''):'Sign in to read your onchain progress.';if(progress.latestSaved)savedAttempt=progress.latestAttempt;render();}catch(e){$('onchain-progress').textContent='Could not read onchain progress: '+e.message;}}
load();
