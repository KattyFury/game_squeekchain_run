import http from 'node:http';import fs from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {database} from './local-db.mjs';import worker from './worker.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));await fs.mkdir(path.join(root,'.data'),{recursive:true});const DB=database(path.join(root,'.data','local.sqlite'));
DB.sqlite.exec(await fs.readFile(path.join(root,'migrations','0001_leaderboard.sql'),'utf8'));
const challenge=JSON.parse(await fs.readFile(path.join(root,'evidence','challenge.json'),'utf8'));await DB.prepare('INSERT OR IGNORE INTO challenges VALUES (?,?,?)').bind(challenge.id,JSON.stringify(challenge),Date.now()).run();
const assets=new Set(['index.html','style.css','design-tokens.css','game.js','engine.mjs','simulation.mjs']);
http.createServer(async(req,res)=>{try{
  const url=new URL(req.url,'http://127.0.0.1:8787');
  if(url.pathname.startsWith('/api/')){const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>16384){res.writeHead(413).end('Payload too large');return;}chunks.push(chunk);}const request=new Request(url,{method:req.method,headers:req.headers,...(size?{body:Buffer.concat(chunks)}:{})});const response=await worker.fetch(request,{DB});res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return;}
  const name=url.pathname==='/'?'index.html':url.pathname.slice(1);if(!assets.has(name)){res.writeHead(404).end('Not found');return;}const data=await fs.readFile(path.join(root,name));res.setHeader('Content-Type',name.endsWith('.css')?'text/css':/\.(js|mjs)$/.test(name)?'text/javascript':'text/html');res.end(data);
}catch(e){console.error(e.message);res.writeHead(500).end('Server error');}}).listen(8787,'127.0.0.1',()=>console.log('Squeek Run: http://127.0.0.1:8787'));
