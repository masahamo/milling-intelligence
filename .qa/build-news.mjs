import {build} from 'vite';
import {execFileSync} from 'node:child_process';
execFileSync(process.execPath,['scripts/generate-seo.mjs'],{stdio:'inherit'});
// Only the platform-injected browser SDK is external in this local smoke build.
await build({configFile:'vite.config.ts',build:{rollupOptions:{external:['@appdeploy/client']}}});
execFileSync(process.execPath,['scripts/finalize-seo.mjs'],{stdio:'inherit'});
