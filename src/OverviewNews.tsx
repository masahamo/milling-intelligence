import { useState, useMemo, useEffect } from 'react';
import { Search, X, ExternalLink, Newspaper, Sparkles, Activity, AlertTriangle, CheckCircle2, Factory } from 'lucide-react';
import { weeklyItems, weeklyCompanyItems } from './WeeklyNews';
import type { Article, CrawlStatus } from './model';
import type { Daily } from './Daily';
import { initialCrawlStatus } from './capexWatchData';
import './overview.css';
import { appHref } from './navigation';

/**
 * ニュースアイテムの型定義
 */
type News = {
  key: string;
  date: string | null;
  category: string;
  region: string;
  title: string;
  body: string;
  why?: string;
  url: string;
  source: string;
  internal?: boolean;
  ai?: boolean;
  stale?: boolean;
};

/**
 * 表示カテゴリー一覧
 */
const categories = ['すべて', '設備投資', '商品', '原料・品質', '企業・決算'] as const;

/**
 * 国・地域一覧
 */
const regions = [
  { id: 'すべて', label: 'すべて', icon: '🌐' },
  { id: '日本', label: '日本', icon: '🇯🇵' },
  { id: '北米', label: '北米', icon: '🇺🇸' },
  { id: '欧州', label: '欧州', icon: '🇪🇺' },
  { id: '豪州', label: '豪州', icon: '🇦🇺' },
  { id: '中国', label: '中国', icon: '🇨🇳' },
  { id: 'グローバル', label: '国際', icon: '🌍' },
] as const;

/**
 * 国・地域のアイコン取得
 */
function getRegionIcon(region: string): string {
  switch (region) {
    case '日本':
      return '🇯🇵';
    case '北米':
      return '🇺🇸';
    case '欧州':
      return '🇪🇺';
    case '豪州':
      return '🇦🇺';
    case '中国':
      return '🇨🇳';
    default:
      return '🌍';
  }
}

/**
 * カテゴリー名の正規化（表記ゆれの統一）
 */
function normalizeCategory(cat: string): string {
  if (cat === '二次加工・商品' || cat === '商品' || cat === '商品開発') return '商品';
  if (cat === '設備投資') return '設備投資';
  if (cat === '原料・品質') return '原料・品質';
  if (
    [
      '企業・決算',
      '企業・業績',
      '企業業績',
      '企業業績・IR',
      'Company / IR',
      'Company/IR',
      '企業・IR',
      '決算・IR',
    ].includes(cat)
  ) {
    return '企業・決算';
  }
  return cat;
}

/**
 * カテゴリー別バッジクラスの取得（色分け用）
 */
function getCategoryClass(cat: string): string {
  switch (cat) {
    case '設備投資':
      return 'capex';
    case '商品':
      return 'product';
    case '原料・品質':
      return 'grain';
    case '企業・決算':
      return 'corporate';
    default:
      return 'other';
  }
}

/**
 * カテゴリー別アイコンの取得
 */
const categoryIcons: Record<string, string> = {
  '設備投資': '🏭',
  '商品': '🍞',
  '原料・品質': '🌾',
  '企業・決算': '📊',
};

/**
 * 週次ニュースの国・地域推測
 */
function inferWeeklyRegion(tag: string, title: string): string {
  if (tag.includes('カナダ') || tag.includes('米国') || tag === '物流設備' || tag.includes('Omas')) {
    return '北米';
  }
  if (tag.includes('豪州')) return '豪州';
  if (tag.includes('中国')) return '中国';
  if (tag.includes('家庭用') || title.includes('昭和産業')) return '日本';
  if (tag.includes('黒海') || tag.includes('省エネ')) return '欧州';
  return 'グローバル';
}

/**
 * データベースの国名を標準地域名へ変換
 */
function mapCountryToRegion(country: string | null | undefined): string {
  if (!country) return 'グローバル';
  if (country === 'Japan' || country.includes('日本')) return '日本';
  if (country === 'U.S.' || country === 'US' || country === 'Canada' || country.includes('北米')) {
    return '北米';
  }
  if (country === 'Europe' || country.includes('欧州')) return '欧州';
  if (country === 'Australia' || country.includes('豪州')) return '豪州';
  if (country === 'China' || country.includes('中国')) return '中国';
  return 'グローバル';
}

export default function OverviewNews({
  articles,
  daily,
}: {
  articles: Article[];
  daily: Daily | null;
}) {
  const [selectedCategory, setSelectedCategory] = useState<string>('すべて');
  const [selectedRegion, setSelectedRegion] = useState<string>('すべて');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [limit, setLimit] = useState<number>(6);
  const [crawlStatus, setCrawlStatus] = useState<CrawlStatus>(initialCrawlStatus);

  useEffect(() => {
    fetch('/data/crawl-status.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) setCrawlStatus(d);
      })
      .catch(() => {});
  }, []);

  // 全ニュースの集約・正規化・重複排除
  const allNews = useMemo(() => {
    const raw: News[] = [
      ...weeklyItems.map((i) => ({
        key: i.url,
        date: '2026-' + i.date.replace('/', '-'),
        category: normalizeCategory(i.pillar),
        region: inferWeeklyRegion(i.tag, i.title),
        title: i.title,
        body: i.body,
        why: i.why,
        url: i.url,
        source: i.source,
      })),
      ...weeklyCompanyItems.map((i) => ({
        key: i.url,
        date: '2026-' + i.date.replace('/', '-'),
        category: '企業・決算',
        region: 'グローバル',
        title: i.title,
        body: i.body,
        url: i.url,
        source: i.source,
      })),
      ...articles.map((a) => ({
        key: a.id,
        date: a.publishedAt,
        category: normalizeCategory(a.category),
        region: mapCountryToRegion(a.country),
        title: a.title,
        body: a.fact,
        why: a.impact,
        url: appHref('article/' + a.id),
        source: '編集記事・公開出典',
        internal: true,
      })),
      ...(daily?.states || []).flatMap((s) =>
        s.recent
          .filter((a) => /^https:\/\//.test(a.url))
          .map((a) => ({
            key: 'daily-' + a.id,
            date: a.publishedAt,
            category: normalizeCategory(a.category),
            region: mapCountryToRegion(a.country || s.country),
            title: a.title,
            body: a.fact,
            why: a.importance,
            url: a.url,
            source: a.sourceName,
            ai: true,
            stale: s.stale || (s.status !== 'ok' && s.status !== 'skipped'),
          }))
      ),
    ];

    const urls = new Set<string>();
    const titles = new Set<string>();

    return raw
      .filter((n) => {
        const u = n.url.replace(/\/$/, '');
        const t = n.title.trim();
        if (urls.has(u) || titles.has(t)) return false;
        urls.add(u);
        titles.add(t);
        return true;
      })
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [articles, daily]);

  // 国・地域ごとの記事件数集計
  const regionCounts = useMemo(() => {
    const counts: Record<string, number> = { すべて: allNews.length };
    regions.forEach((r) => {
      if (r.id !== 'すべて') {
        counts[r.id] = allNews.filter((n) => n.region === r.id).length;
      }
    });
    return counts;
  }, [allNews]);

  // カテゴリーごとの記事件数集計
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { すべて: allNews.length };
    categories.forEach((cat) => {
      if (cat !== 'すべて') {
        counts[cat] = allNews.filter((n) => n.category === cat).length;
      }
    });
    return counts;
  }, [allNews]);

  // 検索・国地域・カテゴリー絞り込み
  const filteredNews = useMemo(() => {
    return allNews.filter((n) => {
      const matchesCategory = selectedCategory === 'すべて' || n.category === selectedCategory;
      if (!matchesCategory) return false;

      const matchesRegion = selectedRegion === 'すべて' || n.region === selectedRegion;
      if (!matchesRegion) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const targets = [n.title, n.body, n.why || '', n.source, n.category, n.region].join(' ').toLowerCase();
      return q.split(/\s+/).every((word) => targets.includes(word));
    });
  }, [allNews, selectedCategory, selectedRegion, searchQuery]);

  return (
    <section className="overview-content" aria-label="製粉業界ニュース">
      {/* 巡回ステータス・モニター & 2層ニュース収集構造 */}
      <div
        className="crawl-status-monitor"
        style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '14px 18px',
          marginBottom: '20px',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '10px',
            marginBottom: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={16} color="#0284c7" />
            <strong style={{ fontSize: '0.95rem', color: '#0f172a' }}>
              ニュース収集巡回ステータス（毎朝06:00 JST自動実行）
            </strong>
          </div>
          <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
            最終巡回: <strong>{crawlStatus.lastCrawlAt || '未確認'}</strong>
          </div>
        </div>

        {/* 24時間経過警告バッジまたは正常件数 */}
        {crawlStatus.warning ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#991b1b',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '0.85rem',
              marginBottom: '10px',
            }}
          >
            <AlertTriangle size={15} />
            <span>⚠️ 巡回遅延注意 (24時間以上更新なし) — 最新データの取得状況をご確認ください</span>
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              color: '#166534',
              fontSize: '0.85rem',
              marginBottom: '8px',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <CheckCircle2 size={15} color="#22c55e" />
              本日速報ニュース: <strong>{crawlStatus.todayNewDailyCount}件</strong>
            </span>
            <span>·</span>
            <span>
              重要設備投資 (CapEx Watch): <strong>{crawlStatus.todayNewCapexCount}件</strong>
            </span>
          </div>
        )}

        {/* 0件時の正常完了メッセージ */}
        {crawlStatus.todayNewDailyCount === 0 && (
          <p
            style={{
              margin: '4px 0 10px',
              fontSize: '0.85rem',
              color: '#475569',
              background: '#f1f5f9',
              padding: '6px 10px',
              borderRadius: '4px',
            }}
          >
            ℹ️ 本日公開の新着ニュースはありません。ニュース巡回は正常に完了しています。
          </p>
        )}

        {/* 2層構造（Layer A & Layer B CapEx Watch）案内 */}
        <div
          style={{
            display: 'flex',
            gap: '12px',
            flexWrap: 'wrap',
            borderTop: '1px solid #e2e8f0',
            paddingTop: '10px',
            marginTop: '6px',
          }}
        >
          <div
            style={{
              flex: 1,
              minWidth: '240px',
              background: '#ffffff',
              padding: '10px 14px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
            }}
          >
            <div style={{ fontWeight: 'bold', fontSize: '0.85rem', color: '#1e293b' }}>
              【Layer A】速報ニュース
            </div>
            <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>
              対象期間：直近5日以内 · 毎朝の主要速報・市場動向
            </div>
          </div>
          <div
            style={{
              flex: 1,
              minWidth: '240px',
              background: '#eff6ff',
              padding: '10px 14px',
              borderRadius: '6px',
              border: '1px solid #bfdbfe',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <div
                style={{
                  fontWeight: 'bold',
                  fontSize: '0.85rem',
                  color: '#1e40af',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Factory size={14} /> 【Layer B】重要設備投資 CapEx Watch
              </div>
              <div style={{ fontSize: '0.8rem', color: '#3b82f6', marginTop: '2px' }}>
                対象期間：過去90日間 · 新工場・増設・大手メーカー案件
              </div>
            </div>
            <a
              href={appHref('capex-watch')}
              className="pill"
              style={{ fontSize: '0.8rem', whiteSpace: 'nowrap', textDecoration: 'none' }}
            >
              CapEx Watch を開く →
            </a>
          </div>
        </div>
      </div>

      {/* 検索バー ＆ 国・地域・カテゴリーピルチップ */}
      <div className="news-filter-hub">
        <div className="news-hub-header">
          <div className="news-hub-title">
            <Newspaper size={15} />
            <span>リアルタイム業界ニュース</span>
          </div>
          <a className="news-archive-link" href={appHref('archive')}>
            過去ログ・記事一覧 →
          </a>
        </div>

        {/* キーワード検索入力 */}
        <div className="news-search-bar">
          <Search size={18} className="search-icon" aria-hidden="true" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setLimit(6);
            }}
            placeholder="企業名・設備名・キーワードで検索（例：ニップン、増設、ホットケーキ、Bühler）"
            aria-label="ニュースをキーワードで検索"
          />
          {searchQuery && (
            <button
              className="news-clear-btn"
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="検索キーワードをクリア"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* 国・地域 選択ピルチップ */}
        <div className="news-filter-row">
          <span className="news-filter-label">国・地域:</span>
          <div className="news-pills-scroll" role="group" aria-label="国・地域切り替え">
            {regions.map((r) => {
              const isSelected = selectedRegion === r.id;
              const count = regionCounts[r.id] || 0;
              return (
                <button
                  key={r.id}
                  type="button"
                  className="news-pill-chip"
                  aria-pressed={isSelected}
                  onClick={() => {
                    setSelectedRegion(r.id);
                    setLimit(6);
                  }}
                >
                  <span>
                    {r.icon} {r.label}
                  </span>
                  <span className="news-pill-count">{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* カテゴリー 選択ピルチップ */}
        <div className="news-filter-row">
          <span className="news-filter-label">カテゴリー:</span>
          <div className="news-pills-scroll" role="group" aria-label="ニュースカテゴリー切り替え">
            {categories.map((c) => {
              const isSelected = selectedCategory === c;
              const count = categoryCounts[c] || 0;
              return (
                <button
                  key={c}
                  type="button"
                  className="news-pill-chip"
                  aria-pressed={isSelected}
                  onClick={() => {
                    setSelectedCategory(c);
                    setLimit(6);
                  }}
                >
                  <span>
                    {categoryIcons[c] || ''} {c}
                  </span>
                  <span className="news-pill-count">{count}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 検索・絞り込み件数表示 */}
      <div className="news-status-bar" role="status">
        <span>
          <b>{selectedRegion === 'すべて' ? '全地域' : selectedRegion}</b>
          <span> · </span>
          <b>{selectedCategory === 'すべて' ? '全カテゴリー' : selectedCategory}</b>
          {searchQuery && <span> · 「{searchQuery}」</span>}
          <span> ： {filteredNews.length}件</span>
        </span>
        <span>公表日順</span>
      </div>

      {/* ニュースカード一覧 */}
      {filteredNews.length > 0 ? (
        <div className="news-cards-grid">
          {filteredNews.slice(0, limit).map((n) => (
            <article className="news-card" key={n.key}>
              <div className="news-card-header">
                <div className="news-badge-group">
                  <span className="news-region-badge">
                    {getRegionIcon(n.region)} {n.region}
                  </span>
                  <span className={`news-category-badge ${getCategoryClass(n.category)}`}>
                    {categoryIcons[n.category] || '📄'} {n.category}
                  </span>
                </div>
                <div className="news-card-meta">
                  <time dateTime={n.date || undefined}>
                    {n.date ? n.date.slice(0, 10).replace(/-/g, '/') : '公表日未確認'}
                  </time>
                  {n.ai && (
                    <span className="news-card-ai-badge">
                      AI要約{n.stale ? '・更新待ち' : ''}
                    </span>
                  )}
                </div>
              </div>

              <h3 className="news-card-title">
                <a
                  href={n.url}
                  target={n.internal ? undefined : '_blank'}
                  rel={n.internal ? undefined : 'noreferrer'}
                >
                  {n.title}
                  {!n.internal && (
                    <ExternalLink
                      size={14}
                      style={{ display: 'inline', marginLeft: 4, verticalAlign: '-1px' }}
                    />
                  )}
                </a>
              </h3>

              <p className="news-card-body">{n.body}</p>

              {/* 製粉業界への示唆（キュレーションの核心価値） */}
              {n.why && (
                <div className="news-why-callout">
                  <div className="news-why-header">
                    <Sparkles size={13} />
                    <span>製粉業界への示唆・実務ポイント</span>
                  </div>
                  <p className="news-why-text">{n.why}</p>
                </div>
              )}

              <div className="news-card-footer">
                <a
                  className="news-card-source"
                  href={n.url}
                  target={n.internal ? undefined : '_blank'}
                  rel={n.internal ? undefined : 'noreferrer'}
                >
                  {n.source} {n.internal ? '→' : '↗'}
                </a>
              </div>
            </article>
          ))}
        </div>
      ) : (
        /* 検索結果が0件の場合 */
        <div className="news-empty-state">
          <p>該当する記事が見つかりませんでした。</p>
          <button
            type="button"
            className="news-empty-reset-btn"
            onClick={() => {
              setSelectedCategory('すべて');
              setSelectedRegion('すべて');
              setSearchQuery('');
              setLimit(6);
            }}
          >
            条件をリセットして全件表示
          </button>
        </div>
      )}

      {/* さらに読み込むボタン */}
      {filteredNews.length > limit && (
        <button
          type="button"
          className="news-load-more"
          onClick={() => setLimit((prev) => prev + 6)}
        >
          さらに表示する（残り {filteredNews.length - limit} 件）
        </button>
      )}
    </section>
  );
}
