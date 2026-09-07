import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';

const manifest:string[]=JSON.parse(fs.readFileSync(path.resolve('prerender-manifest.json'),'utf8'));
const input=Object.fromEntries(manifest.map(route=>[
    route==='/'?'home':route.slice(1).replaceAll('/','__'),
    path.resolve(route==='/'?'index.html':route.slice(1)+'.html'),
]));

export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@appdeploy/client': path.resolve('src/apiClient.ts'),
        },
    },
    base: './',
    build: {
        outDir: process.env.APPDEPLOY_VITE_OUT_DIR || 'dist',
        sourcemap: process.env.APPDEPLOY_VITE_SOURCEMAP === 'hidden' ? 'hidden' : false,
        rollupOptions: {
            input,
            maxParallelFileOps: 128,
        },
    },
});

