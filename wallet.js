const $=id=>document.getElementById(id),CHAIN='0xaa36a7';
const providers=new Map();let provider=null,address=null,chain=null,busy=false,sequence=0;
const short=a=>a.slice(0,6)+'…'+a.slice(-4);
function announce(info,p){if(!p?.request)return;const key=info.uuid||info.rdns||info.name;if(providers.has(key))return;providers.set(key,{info,provider:p});const option=document.createElement('option');option.value=key;option.textContent=info.name||'Browser wallet';$('wallet-provider').append(option);$('wallet-provider').hidden=providers.size<2;}
window.addEventListener('eip6963:announceProvider',event=>announce(event.detail.info,event.detail.provider));
window.dispatchEvent(new Event('eip6963:requestProvider'));
if(window.ethereum)for(const [i,p] of (window.ethereum.providers||[window.ethereum]).entries())announce({uuid:'injected-'+i,name:p.isMetaMask?'MetaMask':p.isRabby?'Rabby':'Browser wallet'},p);
function show(message){$('wallet-state').textContent=message;}
async function request(path,body){const r=await fetch('/api/wallet/'+path,{method:body===undefined?'GET':'POST',credentials:'same-origin',headers:body===undefined?{}:{'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(15000)});const j=await r.json();if(!r.ok)throw Error(j.error||'Wallet service unavailable');return j;}
export async function refreshProgress(){
  const version=sequence;try{const progress=await request('progress');if(version!==sequence)return;
    address=progress.address;$('wallet-disconnect').hidden=!address;$('wallet-connect').textContent=address?'Switch wallet':'Connect wallet';
    if(progress.latestAttempt)window.dispatchEvent(new CustomEvent('squeek:verified-run',{detail:progress.latestAttempt}));
    if(address){show(short(address)+' · Sepolia');$('wallet-progress').textContent=progress.entries.length?progress.entries.map(e=>e.runs+' checked run'+(e.runs===1?'':'s')+' · best '+e.best_score+' · challenge '+e.challenge_id.slice(0,8)).join(' / '):'Wallet verified. Play a shared challenge to save your first run.';}
    else{show('Not connected');$('wallet-progress').textContent='Practice stays local. Signed-in shared runs are saved to your wallet address.';}
  }catch(e){show(e.message);}
}
async function invalidate(){sequence++;address=null;chain=null;show('Wallet changed. Sign in again to save progress.');$('wallet-progress').textContent='Previous saved progress remains associated with its original wallet.';$('wallet-disconnect').hidden=true;try{await request('logout',{});}catch{}}
async function network(){let value=await provider.request({method:'eth_chainId'});if(value!==CHAIN){try{await provider.request({method:'wallet_switchEthereumChain',params:[{chainId:CHAIN}]});}catch(e){if(e.code!==4902)throw e;await provider.request({method:'wallet_addEthereumChain',params:[{chainId:CHAIN,chainName:'Sepolia',nativeCurrency:{name:'Sepolia Ether',symbol:'ETH',decimals:18},rpcUrls:['https://ethereum-sepolia-rpc.publicnode.com'],blockExplorerUrls:['https://eth-sepolia.blockscout.com']}]});await provider.request({method:'wallet_switchEthereumChain',params:[{chainId:CHAIN}]});}value=await provider.request({method:'eth_chainId'});}if(value!==CHAIN)throw Error('Switch your wallet to Sepolia to save progress.');chain=value;}
export async function ensureWalletNetwork(){if(!address)return;if(!provider)throw Error('Reconnect your wallet before starting a saved run.');await network();const accounts=await provider.request({method:'eth_accounts'});if(accounts[0]?.toLowerCase()!==address){await invalidate();throw Error('Wallet account changed. Sign in again.');}}
$('wallet-connect').addEventListener('click',async()=>{
  if(busy)return;if(!providers.size){show('Open this game in a browser with MetaMask, Rabby or another Ethereum wallet installed.');return;}busy=true;$('wallet-connect').disabled=true;
  try{provider?.removeListener?.('accountsChanged',invalidate);provider?.removeListener?.('chainChanged',invalidate);provider=providers.get($('wallet-provider').value)?.provider||providers.values().next().value.provider;const accounts=await provider.request({method:'eth_requestAccounts'});if(!accounts[0])throw Error('No wallet account selected');await network();
    const account=accounts[0],nonce=await request('nonce',{address:account});show('Review the sign-in message in your wallet. No gas or token approval.');
    const message='0x'+[...new TextEncoder().encode(nonce.message)].map(x=>x.toString(16).padStart(2,'0')).join('');const signature=await provider.request({method:'personal_sign',params:[message,account]});
    const current=await provider.request({method:'eth_accounts'});if(current[0]?.toLowerCase()!==account.toLowerCase()||await provider.request({method:'eth_chainId'})!==CHAIN)throw Error('Wallet changed during sign-in. Try again.');
    await request('verify',{nonce:nonce.nonce,signature});sequence++;await refreshProgress();provider.removeListener?.('accountsChanged',invalidate);provider.removeListener?.('chainChanged',invalidate);provider.on?.('accountsChanged',invalidate);provider.on?.('chainChanged',invalidate);
  }catch(e){show(e.code===4001?'Wallet request cancelled. Practice remains available.':e.message||'Wallet sign-in failed');}finally{busy=false;$('wallet-connect').disabled=false;}
});
$('wallet-disconnect').addEventListener('click',async()=>{try{await request('logout',{});sequence++;address=null;provider?.removeListener?.('accountsChanged',invalidate);provider?.removeListener?.('chainChanged',invalidate);await refreshProgress();}catch(e){show(e.message);}});
export async function loadChain(){try{const r=await fetch('/api/chain',{signal:AbortSignal.timeout(20000)});const body=await r.json();if(!r.ok||!body.verified)throw Error(body.error||'Sepolia verification unavailable');$('chain-state').textContent='Sepolia RPC verified · ETH block '+body.ethereumBlock+' · settled Squeek block '+body.squeekBlock;$('chain-explorer').href=body.explorer;$('chain-explorer').hidden=false;$('chain-detail').textContent='12-block confirmation policy · checked '+body.checkedAt+'. Hardware recording and settled contract state are separate sources.';}catch(e){$('chain-state').textContent='Sepolia RPC unavailable';$('chain-detail').textContent=e.message;}}
refreshProgress();loadChain();

export async function connectedWallet(){await ensureWalletNetwork();if(!address||!provider)throw Error('Connect and verify your wallet first.');return {provider,address};}
