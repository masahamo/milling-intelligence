import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {build}=createRequire(require.resolve('tsx'))('esbuild');
import {spawnSync} from 'node:child_process';
await build({entryPoints:['tests/hiring-integration.test.ts'],bundle:true,platform:'node',format:'esm',outfile:'.qa/integration.test.mjs',alias:{'@appdeploy/sdk':'./.qa/sdk-mock.ts'}});
const result=spawnSync(process.execPath,['--test','.qa/integration.test.mjs'],{stdio:'inherit'});process.exitCode=result.status||0;

