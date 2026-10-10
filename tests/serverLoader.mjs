import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
const root=path.resolve(new URL('..',import.meta.url).pathname);
const output=fs.mkdtempSync(path.join(os.tmpdir(),'pet-loft-server-test-'));
fs.writeFileSync(path.join(output,'package.json'),'{"type":"module"}');
const walk=(dir)=>{for(const item of fs.readdirSync(path.join(root,dir),{withFileTypes:true})){const rel=path.join(dir,item.name);if(item.isDirectory())walk(rel);else if(item.name.endsWith('.ts')&&!item.name.endsWith('.d.ts')){
 const source=fs.readFileSync(path.join(root,rel),'utf8');let js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
 js=js.replace(/(from\s+['"]|import\s*\(\s*['"])(\.[^'"]+)(['"])/g,(_match,start,target,end)=>{const absolute=path.resolve(root,path.dirname(rel),target);const file=fs.existsSync(absolute+'.ts')?target+'.js':fs.existsSync(path.join(absolute,'index.ts'))?target+'/index.js':target;return start+file+end;});
 const dest=path.join(output,rel.replace(/\.ts$/,'.js'));fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,js);
}}};
for(const dir of ['server','src/lib','src/types','src/data'])walk(dir);
process.on('exit',()=>fs.rmSync(output,{recursive:true,force:true}));
export const loadServer=(file)=>import(pathToFileURL(path.join(output,file.replace(/\.ts$/,'.js'))).href);
