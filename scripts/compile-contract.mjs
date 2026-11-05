import fs from 'node:fs';import path from 'node:path';import solc from 'solc';
const file='contracts/SqueekRunScores.sol';
const input={language:'Solidity',sources:{[file]:{content:fs.readFileSync(file,'utf8')}},settings:{optimizer:{enabled:true,runs:200},evmVersion:'paris',outputSelection:{'*':{'*':['abi','evm.bytecode.object','evm.deployedBytecode.object']}}}};
const output=JSON.parse(solc.compile(JSON.stringify(input),{import:name=>{try{return {contents:fs.readFileSync(path.join('node_modules',name),'utf8')};}catch{return {error:'Import not found: '+name};}}}));
if(output.errors?.some(e=>e.severity==='error'))throw Error(output.errors.map(e=>e.formattedMessage).join('\n'));
const c=output.contracts[file].SqueekRunScores;
fs.mkdirSync('contracts/artifacts',{recursive:true});fs.writeFileSync('contracts/artifacts/SqueekRunScores.json',JSON.stringify({compiler:solc.version(),evmVersion:'paris',abi:c.abi,bytecode:'0x'+c.evm.bytecode.object,deployedBytecode:'0x'+c.evm.deployedBytecode.object},null,2));console.log('Compiled SqueekRunScores');
