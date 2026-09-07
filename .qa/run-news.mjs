import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
const require=createRequire(import.meta.url);
const {build}=createRequire(require.resolve('tsx'))('esbuild');
await build({entryPoints:['tests/news.test.tsx'],bundle:true,platform:'node',format:'esm',outfile:'.qa/news.test.mjs',packages:'external',alias:{'@appdeploy/sdk':'./.qa/news-sdk-mock.ts','@appdeploy/client':'./.qa/news-client-mock.ts'}});
const result=spawnSync(process.execPath,['--test','.qa/news.test.mjs'],{stdio:'inherit'});
process.exitCode=result.status||0;
