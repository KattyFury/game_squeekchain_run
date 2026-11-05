import fs from 'node:fs/promises';
const files=['index.html','style.css','design-tokens.css','game.js','engine.mjs','simulation.mjs'];
await fs.mkdir('dist',{recursive:true});for(const file of files)await fs.copyFile(file,'dist/'+file);
console.log('Built static game: '+files.length+' assets');
