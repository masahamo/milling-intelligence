import { useState, useMemo } from 'react';
import { Search, X, ExternalLink, Newspaper, Sparkles } from 'lucide-react';
import { weeklyItems, weeklyCompanyItems } from './WeeklyNews';
import type { Article } from './model';
import type { Daily } from './Daily';
import './overview.css';
import { appHref } from './navigation';

/**
 * ニュースアイテムの型定義
 */
type News = {
  key: string;
  date: string | null;
  category: string;
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
 * ユーザー指定の「設備投資」「商品」を直感的に選択可能
 */
const categories = ['すべて', '設備投資', '商品', '原料・品質', '企業・決算'] as const;

/**
 * カテゴリー名の正規化（過去データや表記ゆれを統一）
 */
function normalizeCategory(cat: string): string {
  if (cat === '二次加工・商品' || cat === '商品' || cat === '商品開発') return '商品';
  if (cat === '設備投資') return '設備投資';
  if (cat === '原料・品質') return '原料・品質';
  if (['企業・決算', '企業・業績', '企業業績', '企業業績・IR', 'Company / IR', 'Company/IR', '企業・IR', '決算・IR'].includes(cat)) {
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

export default function OverviewNews({
  articles,
  daily,
}: {
  articles: Article[];
  daily: Daily | null;
}) {
  const [selected, setSelected] = useState<string>('すべて');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [limit, setLimit] = useState<number>(6);

  // 全ニュースの集約・正規化・重複排除
  const allNews = useMemo(() => {
    const raw: News[] = [
      ...weeklyItems.map((i) => ({
        key: i.url,
        date: '2026-' + i.date.replace('/', '-'),
        category: normalizeCategory(i.pillar),
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
        title: i.title,
        body: i.body,
        url: i.url,
        source: i.source,
      })),
      ...articles.map((a) => ({
        key: a.id,
        date: a.publishedAt,
        category: normalizeCategory(a.category),
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

  // 検索・カテゴリー絞り込み
  const filteredNews = useMemo(() => {
    return allNews.filter((n) => {
      const matchesCategory = selected === 'すべて' || n.category === selected;
      if (!matchesCategory) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const targets = [n.title, n.body, n.why || '', n.source, n.category].join(' ').toLowerCase();
      return q.split(/\s+/).every((word) => targets.includes(word));
    });
  }, [allNews, selected, searchQuery]);

  return (
    <section className="overview-content" aria-label="製粉業界ニュース">
      {/* ニュース見出し ＆ アーカイブリンク */}
      <div className="news-section-header">
        <div className="news-section-header-top">
          <div>
            <span className="news-kicker">CURATED INDUSTRY NEWS</span>
            <h2>製粉業界ニュース</h2>
          </div>
          <a className="news-archive-link" href={appHref('archive')}>
            <Newspaper size={14} /> 記事アーカイブ →
          </a>
        </div>
        <p className="news-section-desc">
          設備投資・商品開発・原料動向・企業業績を独自キュレーション。一次情報の事実と実務への示唆を整理しています。
        </p>
      </div>

      {/* 検索バー ＆ カテゴリーピルチップ */}
      <div className="news-filter-hub">
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

        {/* カテゴリーピルチップ（横スクロール） */}
        <div className="news-pills-scroll" role="group" aria-label="ニュースカテゴリー切り替え">
          {categories.map((c) => {
            const isSelected = selected === c;
            const count = categoryCounts[c] || 0;
            return (
              <button
                key={c}
                type="button"
                className="news-pill-chip"
                aria-pressed={isSelected}
                onClick={() => {
                  setSelected(c);
                  setLimit(6);
                }}
              >
                <span>{categoryIcons[c] || ''} {c}</span>
                <span className="news-pill-count">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 検索・絞り込み件数表示 */}
      <div className="news-status-bar" role="status">
        <span>
          <b>{selected}</b>
          {searchQuery && <span> · 「{searchQuery}」の検索結果</span>}
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
                <span className={`news-category-badge ${getCategoryClass(n.category)}`}>
                  {categoryIcons[n.category] || '📄'} {n.category}
                </span>
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
                  {!n.internal && <ExternalLink size={14} style={{ display: 'inline', marginLeft: 4, verticalAlign: '-1px' }} />}
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
              setSelected('すべて');
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
