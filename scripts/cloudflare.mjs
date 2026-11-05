import fs from 'node:fs';import {spawnSync} from 'node:child_process';
const [keyFile,...args]=process.argv.slice(2);if(!keyFile||!args.length)throw Error('Usage: node scripts/cloudflare.mjs <keys.env> <wrangler arguments>');
const keys={};for(const line of fs.readFileSync(keyFile,'utf8').split(/\r?\n/)){const m=line.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*)$/);if(m)keys[m[1]]=m[2].trim().replace(/^['"]|['"]$/g,'');}
const env={...process.env,CLOUDFLARE_API_TOKEN:keys.CF_API_TOKEN||keys.CLOUDFLARE_API_TOKEN,CLOUDFLARE_ACCOUNT_ID:keys.CF_ACCOUNT_ID||keys.CLOUDFLARE_ACCOUNT_ID,WRANGLER_SEND_METRICS:'false',WRANGLER_LOG_PATH:process.cwd()+'/work/wrangler.log',npm_config_cache:process.cwd()+'/work/npm-cache'};
if(args.some(a=>!/^[a-zA-Z0-9_./:= -]+$/.test(a)))throw Error('Unsupported command argument');
const result=spawnSync('npx.cmd',['--yes','wrangler@4.157.0',...args],{env,stdio:'inherit',shell:true});process.exitCode=result.status||0;
