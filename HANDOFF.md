# Milling Intelligence Web — 運用保守ハンドオフドキュメント (Source of Truth)

> [!IMPORTANT]
> 本ドキュメントは、Milling Intelligence Web の最新の運用保守、自動更新、デプロイ、品質管理に関する**唯一の正解ドキュメント (Source of Truth)** です。
> 過去の AppDeploy プラットフォーム運用時の情報は [docs/archive/HANDOFF_APPDEPLOY_2026-09-07.md](docs/archive/HANDOFF_APPDEPLOY_2026-09-07.md) へ退避済みです。

---

## 1. 基本情報・環境

- **本番URL**: https://milling-intelligence.vercel.app
- **GitHub リポジトリ**: `masahamo/milling-intelligence`
- **本番ブランチ**: `main`
- **主要動作環境**: Node.js v20, pnpm v9, Vite v6, React 19, TypeScript 5

---

## 2. 秘密情報（セキュリティ）の管理原則

- デプロイトークン (`VERCEL_TOKEN`) などのシークレット情報は、**絶対にいかなるコード、ログ、ドキュメントにも直接記述しないでください**。
- Vercel デプロイ用トークンは **GitHub Secrets (`secrets.VERCEL_TOKEN`)** に登録されており、GitHub Actions ワークフローおよび `scripts/deploy-vercel.mjs` 内で `process.env.VERCEL_TOKEN` 経由で参照されます。

---

## 3. 本番自動更新パイプライン (GitHub Actions + Vercel)

本プロジェクトの毎朝の自動更新および本番デプロイは、**GitHub Actions ワークフローを唯一の正解経路**として運用します。

- **ワークフロー定義**: `.github/workflows/daily-refresh.yml`
- **実行スケジュール**: 毎日 06:00 JST (21:00 UTC) および `workflow_dispatch`（手動実行）
- **二重実行防止**: `concurrency` グループ (`milling-daily-production`) により同時実行を防止
- **順序立てられたパイプライン**:
  1. 情報源自動収集: `node scripts/auto-news-fetch.mjs`
  2. 市況データ取得: `node scripts/fetch-market-history.mjs`
  3. 日付・エディション更新: `node scripts/update-edition.mjs`
  4. SEOメタデータ・静的ページ生成: `node scripts/generate-seo.mjs`
  5. **品質ゲート (型チェック)**: `pnpm run typecheck`
  6. **品質ゲート (Lint検査)**: `pnpm run lint`
  7. **品質ゲート (単体・統合テスト)**: `pnpm run test`
  8. Vite ビルド: `CI=true pnpm run build` (`vite build`)
  9. SEOパス最終調整: `node scripts/finalize-seo.mjs`
  10. Git 自動コミット・プッシュ
  11. Vercel 本番デプロイ: `node scripts/deploy-vercel.mjs`

---

## 4. 緊急手動フォールバック手順

GitHub Actions が利用不能になった場合のみ、ローカルマシンから緊急手動更新を実行できます。

- **実行スクリプト**: `scripts/daily-cron-job.sh`
- **注意点**: 本スクリプトは**手動緊急用フォールバック専用**です。通常運用時は GitHub Actions に任せてください。
- **実行方法**:
  ```bash
  export VERCEL_TOKEN="<ユーザーが一時的に設定するトークン>"
  ./scripts/daily-cron-job.sh
  ```

---

## 5. 品質検証コマンド (Quality Gates)

新機能追加や修正を行った場合、以下の品質コマンドがすべて成功することを確認してください。

```bash
# 1. TypeScript 型チェック
pnpm run typecheck

# 2. ESLint コードスタイル検査
pnpm run lint

# 3. 単体・統合テスト実行
pnpm run test

# 4. Vite アプリケーションビルド
pnpm run build
```

---

## 6. SEO ルート数と動的確認

- カノニカルルート数や会社詳細ルート数などの動的数値は、HANDOFF ドキュメント内に固定値で手入力してはいけません。
- `node scripts/generate-seo.mjs` 実行時のビルドログ（`[SEO Generator] Successfully generated X canonical routes...`）で動的に算出・確認してください。

---

## 7. トラブルシューティング & データ保護

- **データ取得失敗時の動作**:
  の一部情報源で HTTP エラーや構造変更が発生した場合でも、以前の正常データを空配列や null で上書き破壊しない（フォールバック表示する）設計になっています。
- **/daily 画面での状態診断**:
  `/daily` ページにおいて各情報源の「取得成功」「取得失敗」「休止中」「未実行」「予定対象外」バッジおよび最終成功日時が確認できます。
