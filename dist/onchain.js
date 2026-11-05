import {connectedWallet} from './wallet.js';
const $=id=>document.getElementById(id),EXPLORER='https://eth-sepolia.blockscout.com';
let config=null,eligible=null,busy=false,savedAttempt=null;
try{eligible=localStorage.getItem('squeek-checked-attempt');}catch{}
const show=message=>$('onchain-state').textContent=message;
const store=(key,value)=>{try{value===null?localStorage.removeItem(key):localStorage.setItem(key,JSON.stringify(value));}catch{}};
const load_=key=>{try{return JSON.parse(localStorage.getItem(key)||'null');}catch{return null;}};

// Custom errors of SqueekRunScores (4-byte selectors) → plain English.
const CONTRACT_ERRORS={'0x10dfc033':'Your wallet is not on Sepolia.','0xacec4753':'The score contract is misconfigured. Please report this.','0xcc3b34d5':'This result belongs to a different wallet account.','0x203d82d8':'The save window expired. Press Save onchain again for a fresh one.','0x7c599f80':'The server result was rejected by the contract.','0xbd3cb297':'This run is already saved onchain.','0x8baa579f':'The server signature was rejected. Press Save onchain again.'};
function explain(e){
  const text=String(e?.message||e||''),data=[e?.data,e?.data?.data,e?.error?.data,e?.cause?.data].find(x=>typeof x==='string'&&/^0x[0-9a-f]{8}/i.test(x));
  if(data&&CONTRACT_ERRORS[data.slice(0,10).toLowerCase()])return CONTRACT_ERRORS[data.slice(0,10).toLowerCase()];
  const known=Object.entries(CONTRACT_ERRORS).find(([selector])=>text.toLowerCase().includes(selector));if(known)return known[1];
  if(e?.code===4001||/user (rejected|denied)|rejected the request/i.test(text))return 'Cancelled in your wallet. Nothing was sent.';
  if(/insufficient funds|exceeds the balance|gas required exceeds allowance/i.test(text))return 'Not enough Sepolia test ETH to pay gas for this save. Get some from a Sepolia faucet and try again.';
  if(/nonce too low|replacement transaction|already known/i.test(text))return 'Your wallet has a pending or replaced transaction. Wait for it to finish, then try again.';
  if(/chain|network/i.test(text)&&/mismatch|wrong|switch/i.test(text))return 'Switch your wallet to Sepolia and try again.';
  if(/fetch|network error|timeout|timed out|failed to fetch/i.test(text))return 'Network problem while talking to the service. Try again in a moment.';
  const first=text.split('\n')[0].trim();return first.length>180?first.slice(0,177)+'…':first||'Onchain save failed.';
}
async function api(path,body){const response=await fetch('/api/onchain/'+path,{method:body?'POST':'GET',credentials:'same-origin',headers:body?{'Content-Type':'application/json'}:{},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});const result=await response.json();if(!response.ok)throw Error(result.error||'Onchain service unavailable');return result;}
function render(){const active=!!config?.contract;$('save-onchain').disabled=busy||!active||!eligible||eligible===savedAttempt;$('score-contract').hidden=!active;if(active)$('score-contract').href=EXPLORER+'/address/'+config.contract;if(config&&!active)$('save-onchain').title='Onchain saving is not open yet';else $('save-onchain').removeAttribute('title');}
async function load(){try{config=await api('config');render();await loadProgress();if(!config.contract)$('onchain-progress').textContent='Onchain saving is not open yet.';}catch(e){$('onchain-progress').textContent=e.message;}}
export function setEligibleRun(attempt){eligible=attempt;try{localStorage.setItem('squeek-checked-attempt',attempt);}catch{}render();}
window.addEventListener('squeek:verified-run',event=>{setEligibleRun(event.detail);loadProgress();});
function transactionLink(hash){$('onchain-tx').href=EXPLORER+'/tx/'+hash;$('onchain-tx').hidden=false;}
// Resolves to the receipt, or null if still pending. Throws on a reverted receipt.
async function checkReceipt(provider,hash){const value=await provider.request({method:'eth_getTransactionReceipt',params:[hash]});if(!value)return null;if(value.status!=='0x1')throw Object.assign(Error('Transaction reverted'),{reverted:true});return value;}
async function waitReceipt(provider,hash){for(let i=0;i<90;i++){const value=await checkReceipt(provider,hash);if(value)return value;await new Promise(resolve=>setTimeout(resolve,2000));}throw Error('Still pending. Open the transaction link to check it; do not send a duplicate.');}
$('save-onchain').addEventListener('click',async()=>{
  if(busy||!eligible||!config?.contract)return;const attempt=eligible;busy=true;render();$('onchain-tx').hidden=true;
  try{
    const {provider,address}=await connectedWallet();
    // A transaction we already sent for this run: reuse it unless it reverted.
    const pending=load_('squeek-score-save');let hash=pending?.attempt===attempt&&pending?.wallet===address?pending.hash:null;
    if(hash){transactionLink(hash);try{const done=await checkReceipt(provider,hash);if(done){savedAttempt=attempt;store('squeek-score-save',null);await loadProgress();show('Already saved on Sepolia. Open the transaction to inspect the RunSaved event.');return;}show('Waiting for your earlier save transaction…');}catch(e){if(!e.reverted)throw e;store('squeek-score-save',null);hash=null;show('The earlier save reverted. Preparing a fresh one…');}}
    if(!hash){
      show('Checking your result with the server…');const attestation=await api('attest',{attempt});
      if(attestation.message.player.toLowerCase()!==address.toLowerCase())throw Error('This result belongs to another wallet.');
      const tx=attestation.transaction;
      await provider.request({method:'eth_call',params:[tx,'latest']});                                   // reverts here with the contract error if it would fail
      const estimate=BigInt(await provider.request({method:'eth_estimateGas',params:[tx]}));           // wallet-reported gas for this exact call
      const withBuffer={...tx,gas:'0x'+(estimate*12n/10n).toString(16)};                                // +20% headroom
      show('Confirm the save in your wallet. It costs a little Sepolia test ETH for gas.');
      hash=await provider.request({method:'eth_sendTransaction',params:[withBuffer]});store('squeek-score-save',{attempt,wallet:address,hash});
    }
    transactionLink(hash);show('Submitted. Waiting for Sepolia to confirm…');
    try{await waitReceipt(provider,hash);}catch(e){if(e.reverted){store('squeek-score-save',null);throw Error('The transaction reverted onchain. Open it for details, then press Save onchain to try again.');}throw e;}
    savedAttempt=attempt;store('squeek-score-save',null);await loadProgress();show('Saved on Sepolia. Open the transaction to inspect the RunSaved event.');
  }catch(e){show(explain(e));}finally{busy=false;render();}
});
async function loadProgress(){if(!config?.contract)return;try{const progress=await api('progress');$('onchain-progress').textContent=progress.wallet?progress.savedRuns+' run'+(progress.savedRuns==='1'?'':'s')+' saved onchain'+(progress.best?.ticks?' · best '+progress.best.score+' on challenge '+progress.best.challenge.slice(0,8):''):'Sign in to read your onchain progress.';if(progress.latestSaved)savedAttempt=progress.latestAttempt;render();}catch(e){$('onchain-progress').textContent='Could not read onchain progress: '+e.message;}}
load();
