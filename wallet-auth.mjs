import {isAddress,getAddress,verifyMessage} from 'viem';
import {createSiweMessage} from 'viem/siwe';
import {digest} from './challenge.mjs';
export const CHAIN_ID=11155111;
const hex=()=>[...crypto.getRandomValues(new Uint8Array(32))].map(x=>x.toString(16).padStart(2,'0')).join('');
const error=(message,status=401)=>Object.assign(Error(message),{status});
const cookie=(token,request,maxAge)=>`squeek_session=${token}; Path=/api; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${new URL(request.url).protocol==='https:'?'; Secure':''}`;
export async function walletSession(request,db){
  const token=request.headers.get('Cookie')?.match(/(?:^|;\s*)squeek_session=([a-f0-9]{64})(?:;|$)/)?.[1];if(!token)return null;
  const row=await db.prepare('SELECT address FROM wallet_sessions WHERE token_hash=? AND expires_at>?').bind(await digest(token),Date.now()).first();return row?.address||null;
}
export async function walletNonce(request,db,address){
  if(!isAddress(address))throw error('Invalid wallet address',400);
  const origin=new URL(request.url).origin;
  if(request.headers.get('Origin')&&request.headers.get('Origin')!==origin)throw error('Sign in on the Cloudflare game domain',403);
  const now=Date.now(),nonce=hex(),checkedAddress=getAddress(address),message=createSiweMessage({address:checkedAddress,chainId:CHAIN_ID,domain:new URL(origin).host,uri:origin,version:'1',nonce,issuedAt:new Date(now),expirationTime:new Date(now+300000),statement:'Sign in to Squeek Run to save replay-checked game progress to your wallet address. This is not a transaction and grants no token approvals.'});
  await db.prepare('INSERT INTO wallet_nonces(nonce,address,message,origin,expires_at) VALUES (?,?,?,?,?)').bind(nonce,checkedAddress.toLowerCase(),message,origin,now+300000).run();return {nonce,message,chainId:CHAIN_ID};
}
export async function walletVerify(request,db,body){
  if(typeof body.nonce!=='string'||!/^[a-f0-9]{64}$/.test(body.nonce)||typeof body.signature!=='string'||!/^0x[a-f0-9]{130}$/i.test(body.signature))throw error('Invalid sign-in payload',400);
  const row=await db.prepare('SELECT * FROM wallet_nonces WHERE nonce=?').bind(body.nonce).first();
  if(!row||row.used||row.expires_at<Date.now()||row.origin!==new URL(request.url).origin||request.headers.get('Origin')&&request.headers.get('Origin')!==row.origin)throw error('Sign-in request expired or already used');
  let valid=false;try{valid=await verifyMessage({address:row.address,message:row.message,signature:body.signature});}catch{}
  if(!valid)throw error('Signature does not match this wallet');
  const consumed=await db.prepare('UPDATE wallet_nonces SET used=1 WHERE nonce=? AND used=0 AND expires_at>?').bind(body.nonce,Date.now()).run();if(!consumed.meta.changes)throw error('Sign-in request already used');
  const token=hex(),old=request.headers.get('Cookie')?.match(/(?:^|;\s*)squeek_session=([a-f0-9]{64})(?:;|$)/)?.[1];
  if(old)await db.prepare('DELETE FROM wallet_sessions WHERE token_hash=?').bind(await digest(old)).run();
  await db.prepare('INSERT INTO wallet_sessions VALUES (?,?,?)').bind(await digest(token),row.address,Date.now()+86400000).run();return {address:row.address,cookie:cookie(token,request,86400)};
}
export async function walletLogout(request,db){const token=request.headers.get('Cookie')?.match(/(?:^|;\s*)squeek_session=([a-f0-9]{64})(?:;|$)/)?.[1];if(token)await db.prepare('DELETE FROM wallet_sessions WHERE token_hash=?').bind(await digest(token)).run();return cookie('',request,0);}
