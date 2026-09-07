import {useState, useMemo} from 'react';
import {Search, X, Newspaper, Calendar, ExternalLink} from 'lucide-react';
import type {Article} from './model';
import {appHref} from './navigation';

const COUNTRIES = ['すべて', 'Japan', 'U.S.', 'Europe', 'China', 'Australia', 'Canada', 'Global'];

const fmtDate = (s: string | null) => {
  if (!s) return '未確認';
  return s.length >= 10 ? s.slice(0, 10) : s;
};

export default function ArchiveNews({articles}: {articles: Article[]}) {
  const [q, setQ] = useState('');
  const [selectedCountry, setSelectedCountry] = useState('すべて');
  const [selectedCategory, setSelectedCategory] = useState('すべて');

  // カテゴリ一覧を抽出
  const categories = useMemo(() => {
    const set = new Set<string>();
    articles.forEach(a => {
      if (a.category) set.add(a.category);
    });
    return ['すべて', ...Array.from(set)];
  }, [articles]);

  // フィルタリング
  const filtered = useMemo(() => {
    return articles.filter(a => {
      const matchCountry = selectedCountry === 'すべて' || a.country === selectedCountry;
      const matchCategory = selectedCategory === 'すべて' || a.category === selectedCategory;
      const text = [a.title, a.fact, a.impact, a.importance, a.country, a.category].join(' ').toLowerCase();
      const matchQ = !q.trim() || text.includes(q.trim().toLowerCase());
      return matchCountry && matchCategory && matchQ;
    });
  }, [articles, q, selectedCountry, selectedCategory]);

  const resetFilters = () => {
    setQ('');
    setSelectedCountry('すべて');
    setSelectedCategory('すべて');
  };

  return (
    <section className="section archive-page">
      {/* ヒーローエリア */}
      <div className="career-hero">
        <div className="career-hero-badge">
          <Newspaper size={14} />
          <span>NEWS & ARTICLE ARCHIVE</span>
        </div>
        <h1>製粉業界ニュース・記事アーカイブ</h1>
        <p>
          設備投資・原料需給・商品開発・企業決算など、製粉業界の重要動向に関する一次資料の事実と分析記事をアーカイブしています。
        </p>
      </div>

      {/* 検索 & フィルターハブ（他タブと完全に統一されたモダンUI） */}
      <div className="career-filter-hub" style={{marginBottom: 16}}>
        <div className="career-search-bar">
          <Search size={18} className="search-icon" />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="記事タイトル・企業名・キーワードで検索（例: 増強 / 小麦 / 決算 / ニップン）"
          />
          {q && (
            <button
              type="button"
              className="search-clear-btn"
              onClick={() => setQ('')}
              aria-label="検索キーワードを消去"
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* カテゴリ選択ピル */}
        <div className="career-quick-filter-group" style={{marginTop: 10}}>
          <span className="filter-group-title">カテゴリー：</span>
          <div className="career-pills-scroll" role="group" aria-label="カテゴリー絞り込み">
            {categories.map(c => (
              <button
                key={c}
                type="button"
                className={'pill-chip ' + (selectedCategory === c ? 'active' : '')}
                onClick={() => setSelectedCategory(c)}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* 地域選択ピル */}
        <div className="career-quick-filter-group" style={{marginTop: 8}}>
          <span className="filter-group-title">地域：</span>
          <div className="career-pills-scroll" role="group" aria-label="地域絞り込み">
            {COUNTRIES.map(c => (
              <button
                key={c}
                type="button"
                className={'pill-chip ' + (selectedCountry === c ? 'active' : '')}
                onClick={() => setSelectedCountry(c)}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      </div>

      <p role="status" className="companies-count">
        {filtered.length}件の記事を掲載中 / 全 {articles.length}件
      </p>

      {/* 記事カード一覧 */}
      {filtered.length > 0 ? (
        <div className="story-grid" style={{marginTop: 14}}>
          {filtered.map(a => (
            <article className="story archive-story-card" key={a.id}>
              <div className="story-top" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10}}>
                <span className="tag tag-1" style={{fontWeight: 800}}>
                  {a.category} · {a.country}
                </span>
                <span className="meta" style={{display: 'flex', alignItems: 'center', gap: 4}}>
                  <Calendar size={12} />
                  {fmtDate(a.publishedAt || a.checkedAt)}
                </span>
              </div>

              <h3 style={{fontSize: 19, lineHeight: 1.4, margin: '8px 0 10px'}}>
                <a
                  className="title-link"
                  href={appHref('article/' + a.id)}
                  style={{color: '#173b2a', textDecoration: 'none', fontWeight: 800}}
                >
                  {a.title}
                </a>
              </h3>

              <p style={{fontSize: 14, color: '#55665d', lineHeight: 1.6, marginBottom: 12}}>
                {a.fact}
              </p>

              <div className="why" style={{marginTop: 'auto', background: '#f4f8f5', borderLeft: '3px solid #34a853', borderRadius: '4px 10px 10px 4px', padding: '10px 12px'}}>
                <b style={{color: '#153c2c', fontSize: 12, display: 'block', marginBottom: 3}}>
                  製粉業界への示唆・影響
                </b>
                <span style={{fontSize: 13, color: '#44554b', lineHeight: 1.5}}>
                  {a.impact}
                </span>
              </div>

              <div style={{marginTop: 14, display: 'flex', justifyContent: 'flex-end'}}>
                <a
                  href={appHref('article/' + a.id)}
                  className="pill"
                  style={{margin: 0, padding: '6px 12px', fontSize: 12, fontWeight: 800, color: '#153c2c', textDecoration: 'none', background: '#eaf1ec', borderRadius: 8}}
                >
                  詳細・実務への示唆を読む →
                </a>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="note-box" style={{marginTop: 16}}>
          <span>該当する記事は見つかりませんでした。</span>
          <button onClick={resetFilters} style={{marginLeft: 12}}>
            条件をリセット
          </button>
        </div>
      )}
    </section>
  );
}
