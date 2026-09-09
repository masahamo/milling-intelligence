# HANDOFF — 過去のAppDeploy運用アーカイブ (2026-09-07)

> [!NOTE]
> 本ファイルは、過去の AppDeploy プラットフォーム運用時の制約および経緯を記録したアーカイブドキュメントです。現在の Milling Intelligence の本番運用（https://milling-intelligence.vercel.app）およびデプロイ手順は、プロジェクト直下の [HANDOFF.md](../../HANDOFF.md) を参照してください。

---

## 過去の最優先停止理由 / 2026-09-07 JST
本番反映は未完了です。deploy_appは次の制限で拒否され、コード検証・ビルド・新snapshot作成には進んでいません。

> Lifetime deploy_app limit reached for the Free plan: 125/125 requests used. This limit does not reset. Do not call deploy_app again unless the account limit has actually increased.

案内: https://appdeploy.ai/pricing

## 過去の状態の区別
- 完了（ローカルのみ）：ニュース優先の画面順序、取得頻度metadata、91日持ち回り、予定対象外と失敗の区別、保存IR保持、AI差分ガード、テスト、ドキュメント。
- 未完了：変更の本番反映。新しいAppDeploy validation/build結果はありません。
- 未確認：変更後の本番Mobile/Desktopの視覚QA、/dailyの操作QA、新rotationの実cron実行。
- 既存本番：remote snapshot 1788737003698 のまま。拒否後にsrc_globで再確認済み。get_app_statusは旧版READY、frontend/backend/network errors配列は空。
- cron：既存milling-daily-refreshはenabled、0 6 * * *、Asia/Tokyo、last_status=success、failure_count=0。

---

## 2026-09-07 News-first Overview / IR rotation handoff

### Current task and scope (Historical)
Source of truth: AppDeploy app milling-intelligence-n4b7pt, baseline remote snapshot 1788737003698. Work only on Overview ordering and daily-news / quarterly-IR collection.

### Changed files (Historical)
backend/index.ts; backend/watchers.ts; backend/cadence.ts; src/MillingIntelligence.tsx; src/Daily.tsx; src/OverviewNews.tsx; src/milling.css; tests/tests.txt; tests/news.test.tsx.
