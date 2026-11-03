import test from 'node:test';import assert from 'node:assert/strict';import {PATTERNS,groupPolygons,intersectsPolygonBox} from '../engine.mjs';
function solve(parts,speed){const dt=1/120,center=1.4/speed,frames=[];for(let t=0;t<center+1.5;t+=dt)frames.push(groupPolygons({offset:-1.4,parts},speed*t,228,480,82).map(x=>x.poly));
 function safe(jumps){let h=0,v=0,used=0,index=0;for(let i=0;i<frames.length;i++){const time=i*dt;if(index<jumps.length&&time>=jumps[index]){if(used>=2)return false;v=455;used++;index++}v-=1280*dt;h+=v*dt;if(h<=0){h=0;v=0;used=0}const box={x:461,y:310-h-29,w:34,h:26};if(frames[i].some(p=>intersectsPolygonBox(p,box)))return false}return true}
 if(safe([]))return [];
 for(let a=Math.max(0,center-1.1);a<center+.1;a+=.05){if(safe([a]))return [a];for(let gap=.1;gap<=.65;gap+=.05)if(safe([a,a+gap]))return [a,a+gap]}
 return null;
}
for(let i=0;i<PATTERNS.length;i++)test('pattern '+i+' has a Space-only route at all supported speeds',()=>{for(const speed of [.55,.8,1.1,1.4])assert.notEqual(solve(PATTERNS[i],speed),null,'no path at speed '+speed)});
