# HANDOFF — 実装済み・本番未反映（AppDeploy上限）

## 最優先の停止理由 / 2026-09-07 JST
本番反映は未完了です。deploy_appは次の制限で拒否され、コード検証・ビルド・新snapshot作成には進んでいません。

> Lifetime deploy_app limit reached for the Free plan: 125/125 requests used. This limit does not reset. Do not call deploy_app again unless the account limit has actually increased.

上限が実際に増えたことを確認するまでdeploy_appを再実行しないでください。課金・プラン変更はユーザーの判断です。別アプリや別アカウントを作って制限を回避しないでください。
案内: https://appdeploy.ai/pricing

## 状態の区別
- 完了（ローカルのみ）：ニュース優先の画面順序、取得頻度metadata、91日持ち回り、予定対象外と失敗の区別、保存IR保持、AI差分ガード、テスト、ドキュメント。
- 未完了：変更の本番反映。新しいAppDeploy validation/build結果はありません。
- 未確認：変更後の本番Mobile/Desktopの視覚QA、/dailyの操作QA、新rotationの実cron実行。
- 既存本番：remote snapshot 1788737003698 のまま。拒否後にsrc_globで再確認済み。get_app_statusは旧版READY、frontend/backend/network errors配列は空。これは今回の変更のQA合格を意味しません。e2e_tests=null。
- cron：既存milling-daily-refreshはenabled、0 6 * * *、Asia/Tokyo、last_status=success、failure_count=0。ソースごとの成功を保証する値ではありません。
- 未解決の判断：有料プラン等で公開上限を増やすか。ユーザー判断が必要です。
- 引き継ぎ時のコード状態：小さな完成差分として保存済み。ビルド成功（SDK外部化のローカル検証）、lint成功。既存の全体型チェックと求人統合テストの失敗は下記に明記。

## 保存場所と具体的な再開手順
作業ディレクトリ:
 /Users/katayamamasami/Documents/Codex/2026-09-06/git-milling-intelligence-web-codex-git/work/news-first

これはAppDeployの69ファイルのsnapshotを読み出して変更したフォルダで、Gitリポジトリではありません。古いwork/seo-currentやwork/milling-intelligenceから続きを始めないでください。

1. このHANDOFFとwork/news-first/HANDOFF.mdを読む。
2. 公開上限が実際に増えたことを確認。増えていなければ公開の再試行は禁止。
3. get_deploy_instructions、該当SDK reference、get_app_status、src_globを実行。最新remoteが1788737003698でなければ必ず再読込して差分を合わせる。
4. backend/cadence.tsのrotationStartは2026-09-08。公開が遅れた場合は、既存日次履歴を遡及変更しないため、公開翌日のJST日付へ変更し、テスト内の固定JST例も合わせて再実行する。既存7つのrotationDayは変更しない。
5. 下記のローカルテスト・lint・ビルドを再実行。テスト用SDKは本番entrypointへ取り込まない。
6. work/news-first/DEPLOY_PATCH.jsonに拒否された差分を保存。これは再開用の下書きであり自動再試行用ではない。snapshotが同じ場合だけfromアンカーを検証して利用できる。日付やHANDOFFを変更した場合は該当差分を再生成する。ファイル全体を無差別に送信しない。
7. 実際の公開後は5秒以上間隔でREADY/failedまでpoll。エラー・QA snapshot・cron確認。新しいsnapshotを記録する。
8. Mobile 375x667とDesktop 1280x800でニュースがtask navigation直後、DailyHealthBarがOverview最下部にあることを確認。ニュース分類/要点の展開、詳細リンクから/daily、情報源詳細の状態/日時/予定日、戻る操作を確認する。
9. 新しい実cronの結果は実行後に確認する。今回の作業では本番AI取得を余分に実行していない。
10. 実際に確認した範囲で完了報告する。旧版READYやe2e nullを新実装の成功として扱わない。

---

# 2026-09-07 News-first Overview / IR rotation handoff

## Current task and scope
Source of truth: AppDeploy app milling-intelligence-n4b7pt, baseline remote snapshot 1788737003698. Work only on Overview ordering and daily-news / quarterly-IR collection. Do not resume older SEO work below without a new request.

## Implemented locally (not deployed)
- DailyHealthBar is the last Overview element before the footer, after news and existing update disclosure. The /daily link and real failure states remain.
- Explicit watcher cadence: 20 daily sources; 7 quarterly sources with fixed offsets 0,13,26,39,52,65,78 in a 91-day cycle.
- Rotation starts 2026-09-08 JST, avoiding retroactive changes to the already completed 2026-09-07 daily run. Existing historical actual rows always override computed schedules.
- Quarterly IDs in offset order: nittofuji, adm, bunge, loulis-ir, gmsa-ir, sarantopoulos-ir, torigoe-ir. Mixed company/news home pages remain daily. URLs are not used as heuristics.
- Existing daily cron selects daily sources first, then that day's IR source; maximum one IR source per day. No new cron. cron.json is not submitted or changed, preserving the live schedule and unrelated hiring configuration.
- Off-day sources are not scraped and their mi-watch records are untouched. API derives skipped / 予定対象外, preserves recent articles and prior failure/success/attempt information. Historical absent rows before policy start remain pending.
- Staleness threshold: daily 30h, periodic 93 days, with failures/cooldowns still marked stale. A skipped source with a prior successful record is not labelled stale solely for skipping today.
- Existing fingerprint, evidence validation, deduplication and article data remain; AI runs only for changed content. Prompt now explicitly includes closures, capacity changes, new technology, energy efficiency and M&A in the same four categories.
- Cooldowns now have dated snapshots; a successful checkpoint can repair a missing daily snapshot without re-fetching. Storage errors remain failures and subsequent batches continue.

## Changed files
backend/index.ts; backend/watchers.ts; backend/cadence.ts (new); src/MillingIntelligence.tsx; src/Daily.tsx; src/OverviewNews.tsx; src/milling.css; tests/tests.txt; tests/news.test.tsx (new); .qa/news-sdk-mock.ts, .qa/news-client-mock.ts, .qa/run-news.mjs, .qa/build-news.mjs (new QA-only); HANDOFF.md.

## Verification before publication
- New deterministic SDK-mocked tests: 6/6 pass (182-day rotation, JST boundary/leap dates, daily priority, scheduled IR, skipped record preservation, repeated run, unchanged fingerprint/no new AI, source failure isolation, cooldown history, API, rendered diagnostic counts and Overview source order).
- Existing hiring unit tests: 11/11 pass.
- ESLint src (package lint equivalent): passes. No production runtime mocks used.
- Local production Vite build: passes, 186 routes generated; platform-injected @appdeploy/client externalized only for this local smoke build. Build warning: main bundle >500 kB.
- Full typecheck: NOT passing due to unchanged src/CompanyCompare.tsx(1,8640), TS2345 flatMap Current versus Reference status inference. No errors from changed files reported.
- Existing hiring integration test: NOT passing: tests/hiring-integration.test.ts hardcodes all.sources.length = 26; unchanged actual hiringSources now has 43. Assertion: 43 !== 26. Not modified because hiring is outside this task.
- Unrelated data, rankings, routing, metadata, SEO generation and cron source are preserved. Local build-generated index.html / seoCatalog.json restored from baseline, not submitted.
- Production READY/runtime/network/QA and visual checks must be read from the deployment result for this publication. E2E null is not an E2E pass.

## How to resume / remaining verification
1. Call AppDeploy get_deploy_instructions before edits; call get_app_status and src_glob to retrieve the actual latest snapshot, not this baseline.
2. Read backend/cadence.ts, backend/watchers.ts, backend/index.ts, src/Daily.tsx and tests/news.test.tsx first.
3. Local folder work/news-first has the source. Node in this environment is /Users/katayamamasami/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node. node_modules links to ../seo-current/node_modules (local only).
4. Run node .qa/run-news.mjs; node --import tsx --test tests/hiring.test.ts; node node_modules/eslint/bin/eslint.js src --ext .ts,.tsx; node node_modules/typescript/bin/tsc -p .qa/tsconfig.json --noEmit.
5. Local build command: node .qa/build-news.mjs. This regenerates SEO artifacts; do not accidentally deploy unrelated generated source differences.
6. After deploy poll every >=5 seconds until READY/failed; inspect frontend/backend/network errors, QA snapshot and cron. Check mobile Overview order, news filters/details, lower health link and /daily expanded diagnostics; desktop overflow/order.
7. First real rotated production cron is 2026-09-08 06:00 JST; cannot claim a completed rotated cron before that. No extra AI/source run was triggered just for QA. Source failures are not magically fixed by changing cadence.
8. Fixed slots intentionally do not shift if the watcher list changes. New quarterly sources require a deliberate unused offset and tests. Off-day diagnostics are derived (no per-source skip writes); only actual attempts are persisted. No automatic retry outside the next scheduled day for failed IR.

## Never break
Companies facts, Mills capacity conversion/Partial, Compare rankings, revenue FX, Career semantics, investment climate, native stock currencies, SEO metadata/canonical/sitemap/robots, normal routes/back-forward/direct access, Maps queries, GA4/GSC, Technology units/equipment/maker data. Public sources only; no invented facts, new source research or private materials.

---

# Previous handoff (historical; not the current task)
# Milling Intelligence Handoff

## 1. 今回の目的

既存データだけを会社IDで結合し、`/company/{id}` を上場・非上場共通テンプレートへ統一する。会社別 title / description / canonical / H1、Mills・Career・Compare・Companiesへの存在確認済みリンク、会社概要・製粉事業・工場能力・採用・企業情報・ニュース・公式情報源を表示する。前段のSEO基盤（URL・metadata・sitemap・prerender共通化）も壊さない。

## 2. 完了した作業

- 完了：`CompanyDetail.tsx` を新設し、`public/data/milling-v02.json`、Mills、Career、CompanyScores、Companiesの既存ID対応表を実行時に結合。
- 完了：H1を `{会社名}｜製粉事業・工場・製粉能力・採用情報` に統一。
- 完了：データがある場合だけMills、Career、上場会社KPI、ニュース、公式情報源を表示。
- 完了：非上場会社カードから会社詳細への導線を追加。
- 完了：SEO生成時に既存ソースからIDと会社名を抽出し、会社名の別SEO配列を作らず59社のmetadataを生成。
- 完了：代表 `/company/2001`、`/company/2002`、`/company/nikkoku` はReact表示後、H1 1つ、Mills、Career、内部リンク、会社別metadata、直接アクセスを確認。
- 完了：AppDeploy本番反映。deployment READY、frontend/backend/network errors 0、cron failure 0。
- 完了：sitemapは186 URL、うち会社詳細59 URL、重複0。

## 3. 変更したファイル

- `src/CompanyDetail.tsx`（新規）
- `src/MillingIntelligence.tsx`
- `src/Companies.tsx`
- `scripts/generate-seo.mjs`
- `src/seoCatalog.json`（build生成物）
- `prerender-manifest.json`（build生成物）
- `tests/tests.txt`
- 前段SEO基盤：`src/routeRegistry.json`、`src/navigation.ts`、`src/navigationCatalog.json`、`src/seoMetadata.ts`、`src/main.tsx`、`vite.config.ts`、`scripts/finalize-seo.mjs`、`package.json`、`eslint.config.mjs`、`backend/index.ts`

## 4. 未完了の作業

- 未完了：AppDeploy本番の拡張子なしURLで、会社別HTMLがpage source時点に返ること。
- 現状、`/company/2001.html` 用の会社別HTMLはbuild生成されるが、canonicalの `/company/2001` をHTTP取得するとAppDeployのSPAフォールバックがトップページ`index.html`を返す。
- React実行後は正しい会社ページ・metadataになる。直接アクセスも正常。
- この制約のため「会社別prerender完了」とは記載しないこと。

## 5. 現在の実装状態

- 本番URL：`https://milling-intelligence-n4b7pt.v2.appdeploy.ai/`
- 本番：READY。
- React表示後：3代表会社すべて会社別title/canonical/H1/Mills/Careerリンク正常。
- 生HTML：3代表会社ともトップページtitle/canonical/H1が返るため要修正。
- 生成カタログ：186 canonical routes、会社59社。

## 6. 次に触るべきファイル・箇所

1. `scripts/generate-seo.mjs` のHTML出力方式。
2. `vite.config.ts` のmulti-page input。
3. AppDeployのextensionless URL rewrite/clean URL対応。公式に可能な設定を確認する。
4. 必要なら `backend/index.ts` で非API HTML routeを返せるか、AppDeploy SDKの正式仕様を確認してから小さく検証する。推測でルートを追加しない。
5. `tests/tests.txt` Test 4。

## 7. 次のCodexがそのまま実行できる具体的な手順

1. 作業ディレクトリを `work/seo-current` にする。
2. AppDeploy app id `milling-intelligence-n4b7pt` の最新source snapshotを再取得し、ローカルとの差分を確認する。本番snapshotを正とする。
3. AppDeploy公式仕様またはdeploy instructionsで、Viteの拡張子なしURLを個別HTMLへrewriteする正式手段を確認する。
4. まず `/company/2001` だけで小さく検証し、`curl -fsSL URL/company/2001` のtitle/H1/canonicalが会社別になることを確認する。
5. 成功した正式手段を186 canonical routesへ適用する。
6. `/company/2001`、`/company/2002`、`/company/nikkoku` を生HTMLとブラウザの両方で確認する。
7. Companies検索、Career検索、Compare、Mills、Maps、Machines、Technology、戻る/進む、直接URLを回帰確認する。
8. AppDeployへ更新し、READYまで5秒間隔でpoll。frontend/backend/network errorを確認する。

## 8. build / lint / testの実行結果

- build：AppDeploy本番build成功、deployment READY。
- lint：`eslint src backend --ext .ts,.tsx` 成功。
- typecheck：全体では既存の`@appdeploy/client`ローカル型欠如と既存`CompanyCompare.tsx`型エラーが残る。今回変更した `CompanyDetail.tsx` / `Companies.tsx` / `MillingIntelligence.tsx` の新規型エラーは0。
- browser QA：代表3社でReact後H1、metadata、Mills、Career、内部リンク確認。console error 0。
- prerender QA：失敗（下記エラー参照）。

## 9. 発生中のエラー

重要な再現結果：

```
company/2001 source_title=製粉業界の企業・工場・設備・求人データ | Milling Intelligence
company/2002 source_title=製粉業界の企業・工場・設備・求人データ | Milling Intelligence
company/nikkoku source_title=製粉業界の企業・工場・設備・求人データ | Milling Intelligence
sitemap 186 company 59 unique 186
```

期待値は各社固有title。原因はAppDeployが `/company/2001` に `company/2001.html` ではなくルート`index.html`を返すため。

## 10. 絶対に壊してはいけない既存仕様

- Companies検索・地域/上場区分/投資環境。
- Career検索・求人履歴。
- Compare地域ランキングと既存値。
- Mills検索・ranking・Google Maps・能力basis。
- Machines、Technology、Overview、Archive。
- History APIの戻る/進むと直接URLアクセス。
- 新規企業・工場・求人・能力データを創作しない。
- 旧SEO slugをsitemapへ戻さない。

## 11. 今回判断した設計方針

- UIデータはSEO専用配列へコピーせず、既存exportとJSONを会社IDで結合する。
- 上場/非上場は同じ`CompanyDetail`を使い、上場固有widgetのみ条件表示。
- Mills/Career/Compareリンクは対応データがある場合だけ生成。
- metadataとsitemapは`seoCatalog.json`を共通利用し、カタログ自体はbuild時に既存データから生成。
- 不明値は推定せず、非表示または未確認。

## 12. 未解決の判断事項

- 要確認：AppDeploy Vite hostingでextensionless URLを個別HTMLへ正式rewriteできるか。
- 要確認：正式rewrite不可の場合、限定的SSR/別hosting/URL末尾スラッシュのどれを採用するか。URL変更やNext.js全面移行は元要件で禁止されているため、勝手に決めない。
