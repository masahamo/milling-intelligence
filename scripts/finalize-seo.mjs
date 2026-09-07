import fs from 'node:fs';
import path from 'node:path';

const out=path.resolve(process.env.APPDEPLOY_VITE_OUT_DIR||'dist');
function visit(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())visit(file);else if(entry.name.endsWith('.html')){const html=fs.readFileSync(file,'utf8').replace('<base href="./">','<base href="/">');fs.writeFileSync(file,html)}}}
visit(out);
console.log('Normalized prerendered HTML base URLs.');

