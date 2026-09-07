#!/bin/bash
export PATH="/Users/katayamamasami/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"
PROJECT_DIR="/Users/katayamamasami/Documents/Codex/2026-09-06/git-milling-intelligence-web-codex-git/work/news-first"
LOG_FILE="/tmp/milling_daily_cron.log"

echo "=== [$(date '+%Y-%m-%d %H:%M:%S')] Starting Milling Intelligence Daily Refresh ===" >> "$LOG_FILE"
cd "$PROJECT_DIR" || exit 1

# 1. ニュース取得
node scripts/auto-news-fetch.mjs >> "$LOG_FILE" 2>&1

# 2. SEO HTML 再生成
node scripts/generate-seo.mjs >> "$LOG_FILE" 2>&1

# 3. Vite ビルド
node node_modules/vite/bin/vite.js build >> "$LOG_FILE" 2>&1

# 4. SEO 最終パス正規化
node scripts/finalize-seo.mjs >> "$LOG_FILE" 2>&1

# 5. Vercel 本番デプロイ
mkdir -p .vercel/output/static && cp -r dist/* .vercel/output/static/
cat << 'CONFIG' > .vercel/output/config.json
{
  "version": 3,
  "routes": [
    { "handle": "filesystem" },
    { "src": "/(.*)", "dest": "/$1.html", "check": true },
    { "src": "/(.*)", "dest": "/index.html" }
  ]
}
CONFIG

/Users/katayamamasami/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback/pnpm dlx vercel deploy --prod --prebuilt --yes >> "$LOG_FILE" 2>&1

echo "=== [$(date '+%Y-%m-%d %H:%M:%S')] Finished Milling Intelligence Daily Refresh ===" >> "$LOG_FILE"
