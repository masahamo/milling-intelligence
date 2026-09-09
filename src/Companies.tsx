import {useState, useEffect} from 'react';
import {Search, Building2, MapPin} from 'lucide-react';
import CurrentPrice from './CurrentPrice';
import StockChart from './StockChart';
import Quarterly from './Quarterly';
import {listedScores, ScoreBadge, getListedScore, investmentIcon, investmentSignalClass} from './CompanyScores';
import {groups} from './Mills';
import {careerCompanies} from './careerData';
import {japanPrivateCompanyIds, japanPrivateInsights} from './JapanMillingExpansion';
import {japan2PrivateCompanyIds, japan2PrivateInsights} from './JapanMillingExpansion2';
import type {Article} from './model';
import type {Daily} from './Daily';
import {appHref} from './navigation';

type Tag = 'Industry Leader' | 'Career' | 'Capacity' | 'CapEx';
type Row = {id: string; name: string; region: string; listed: boolean; mill?: string; relation: string; tags: Tag[]};
type News = {key: string; date: string; title: string; fact: string; category: string; country: string; url: string; source: string; direct: boolean; internal?: boolean};

export const companyMillIds: Record<string, string> = {
  '2002': 'nisshin-jp',
  '2001': 'nippn',
  '2004': 'showa',
  '2003': 'nittofuji',
  '2009': 'torigoe',
};
const millIds = companyMillIds;
const privateIds = [
  'ardent', 'ph', 'miller', 'allied', 'graincraft', 'manildra', 'rogers',
  'goodmills', 'dossche', 'moulins-soufflet', 'whitworth',
  ...japanPrivateCompanyIds,
  ...japan2PrivateCompanyIds,
];
const privateInsights = {...japanPrivateInsights, ...japan2PrivateInsights};
const careerIds = new Set(careerCompanies.map(c => c.id));

const rows: Row[] = [
  ...Object.values(listedScores).map(s => ({
    id: s.ticker,
    name: s.name,
    region: s.region,
    listed: true,
    mill: millIds[s.ticker],
    relation: s.relation,
    tags: [
      ...(careerIds.has(s.ticker) ? ['Career' as Tag] : []),
      ...(['2002', 'ADM'].includes(s.ticker) ? ['Industry Leader' as Tag] : []),
      ...(millIds[s.ticker] ? ['Capacity' as Tag] : []),
      ...(['2002', '2001', '2004'].includes(s.ticker) ? ['CapEx' as Tag] : []),
    ],
  })),
  ...privateIds.map(id => {
    const g = groups.find(g => g.id === id)!;
    return {
      id,
      name: g.name,
      region: g.scope,
      listed: false,
      mill: id,
      relation: g.relation || '非上場製粉会社',
      tags: [
        'Career' as Tag,
        'Capacity' as Tag,
        ...(['ardent', 'goodmills'].includes(id) ? ['Industry Leader' as Tag] : []),
        ...(['ph', 'miller', 'rogers'].includes(id) ? ['CapEx' as Tag] : []),
      ],
    };
  }),
];

function Ranking({ids}: {ids: string[]}) {
  const ranked = ids
    .map(id => getListedScore(id))
    .filter((s): s is NonNullable<ReturnType<typeof getListedScore>> => !!s)
    .sort((a, b) => b.sortScore - a.sortScore);
  const icon = investmentIcon;

  const [selectedTicker, setSelectedTicker] = useState<string>(() => (ranked[0] ? ranked[0].ticker : ''));
  const activeTicker = ranked.some(r => r.ticker === selectedTicker)
    ? selectedTicker
    : ranked[0]?.ticker || '';
  const activeCompany = ranked.find(r => r.ticker === activeTicker);

  return (
    <article className="story companies-ranking">
      <span className="section-kicker">LISTED INVESTMENT CLIMATE · RANKING</span>
      <h3>上場会社の投資環境・評価ランキング</h3>
      <p className="ranking-sub-lead">
        行をクリックすると、下の<strong>株価推移グラフ（PRICE HISTORY）</strong>が切り替わります。
      </p>
      {ranked.length ? (
        <>
          <div className="score-list">
            {ranked.map((s, idx) => {
              const isSelected = s.ticker === activeTicker;
              return (
                <div
                  className={`score-list-row ${isSelected ? 'selected' : ''}`}
                  key={s.ticker}
                  onClick={() => setSelectedTicker(s.ticker)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      setSelectedTicker(s.ticker);
                    }
                  }}
                  aria-pressed={isSelected}
                  aria-label={`${s.name}を選択して株価推移を表示`}
                >
                  <div className="score-list-left-col">
                    <span className="score-list-rank">#{idx + 1}</span>
                    <div className="score-list-name-col">
                      <div className="score-list-name-row">
                        <strong>{s.name}</strong>
                        <span className="score-list-ticker">({s.ticker})</span>
                        {isSelected && <span className="score-list-selected-tag">グラフ表示中</span>}
                      </div>
                      <small className="score-list-relation">{s.region} · {s.relation}</small>
                    </div>
                  </div>

                  <div className="score-list-right-col">
                    <div className="score-list-signal-cell">
                      <span className={'investment-signal-badge ' + investmentSignalClass(s.signal)}>
                        <strong>{s.signal}</strong>
                        <span className="signal-arrow-adjacent">{icon(s.signal)}</span>
                      </span>
                    </div>
                    <div className="score-list-price-cell">
                      <CurrentPrice ticker={s.ticker} />
                    </div>
                    <div className="score-list-meta-cell">
                      <small className="score-list-confidence">信頼度 {s.confidence}</small>
                      <a
                        href={appHref('company/' + s.ticker)}
                        className="score-list-detail-link"
                        onClick={e => e.stopPropagation()}
                      >
                        詳細 →
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {activeCompany && (
            <div className="ranking-chart-container">
              <StockChart ticker={activeCompany.ticker} name={activeCompany.name} />
            </div>
          )}
        </>
      ) : (
        <p className="meta">この検索条件では上場評価対象がありません。</p>
      )}
      <p className="meta">{ranked.length}社 · 追い風 / 横ばい / 逆風の3段階。株価・推移グラフはYahoo Finance連携および最新の市場開示情報に基づく。</p>
    </article>
  );
}

function regions(row: Row) {
  return row.region.split(' / ').map(x => x.trim());
}

function isRelevantForCompany(
  a: {companyIds?: string[]; country: string; title: string},
  row: Row,
  rs: string[]
): boolean {
  // 1. その会社自身に直接紐付くニュース（companyIdsに自社IDがある、またはタイトルに自社名が含まれる）
  const isDirect =
    (Array.isArray(a.companyIds) && a.companyIds.includes(row.id)) ||
    (!!row.name && a.title.includes(row.name));
  if (isDirect) {
    return true;
  }

  // 2. 自社ニュースではない場合：
  // 他社の会社IDが1つでも入っていれば「他社専用のニュース」なので絶対に除外
  const hasOtherCompanyId =
    Array.isArray(a.companyIds) &&
    a.companyIds.length > 0 &&
    !a.companyIds.includes(row.id);
  if (hasOtherCompanyId) {
    return false;
  }

  // 3. 国・地域が一致しているか確認
  if (!rs.includes(a.country)) {
    return false;
  }

  // 4. 国・地域が一致し、自社・他社IDが付いていない一般ニュース（原料・政策・需給・市場動向）
  // ただしタイトルに他の主要競合会社名が含まれている場合は他社ニュースと判定して除外
  const otherCompanyNames = [
    '日清製粉',
    'ニップン',
    '昭和産業',
    '日東富士製粉',
    '鳥越製粉',
    '千葉製粉',
    '奥本製粉',
    '熊本製粉',
    '前田産業',
    '笠原産業',
    '小山製粉',
    '柄木田製粉',
    'ADM',
    'Archer-Daniels-Midland',
    'Bunge',
    'Cargill',
    'Ardent Mills',
    'P&H',
    'Allied Pinnacle',
    'GoodMills',
  ].filter(name => !row.name.includes(name) && !name.includes(row.name));

  if (otherCompanyNames.some(name => a.title.includes(name))) {
    return false;
  }

  return true;
}

function relatedNews(row: Row, articles: Article[], daily: Daily | null) {
  const rs = regions(row);
  const staticNews: News[] = articles
    .filter(a => isRelevantForCompany(a, row, rs))
    .map(a => {
      const direct =
        (Array.isArray(a.companyIds) && a.companyIds.includes(row.id)) ||
        (!!row.name && a.title.includes(row.name));
      return {
        key: 'article-' + a.id,
        date: a.publishedAt || a.checkedAt,
        title: a.title,
        fact: a.fact,
        category: a.category,
        country: a.country,
        url: appHref('article/' + a.id),
        source: '編集記事・公開出典',
        direct,
        internal: true,
      };
    });
  const liveNews: News[] = (daily?.states || [])
    .flatMap(s => s.recent)
    .filter(a => isRelevantForCompany(a, row, rs))
    .map(a => {
      const direct =
        (Array.isArray(a.companyIds) && a.companyIds.includes(row.id)) ||
        (!!row.name && a.title.includes(row.name));
      return {
        key: 'daily-' + a.id,
        date: a.publishedAt || a.checkedAt,
        title: a.title,
        fact: a.fact,
        category: a.category,
        country: a.country,
        url: a.url,
        source: a.sourceName,
        direct,
      };
    });
  const seen = new Set<string>();
  return [...staticNews, ...liveNews]
    .sort((a, b) => Number(b.direct) - Number(a.direct) || b.date.localeCompare(a.date))
    .filter(n => {
      const k = n.title.trim().toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, 8);
}

const REGION_OPTIONS = [
  ['All', 'すべて'],
  ['Japan', '🇯🇵 日本'],
  ['U.S.', '🇺🇸 米国'],
  ['Europe', '🇪🇺 欧州'],
  ['Australia', '🇦🇺 豪州'],
  ['Canada', '🇨🇦 カナダ'],
  ['China', '🇨🇳 中国'],
];

export default function Companies({
  region,
  onRegionChange,
  articles,
  daily,
}: {
  region: string;
  onRegionChange: (value: string) => void;
  articles: Article[];
  daily: Daily | null;
}) {
  const [q, setQ] = useState('');
  const [tag, setTag] = useState('All');
  const [selectedId, setSelectedId] = useState('');
  const [mode, setMode] = useState<'search' | 'investment'>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      if (tab === 'investment' || tab === 'search') return tab;
      const saved = sessionStorage.getItem('mi_companies_mode');
      if (saved === 'investment' || saved === 'search') return saved;
    } catch {}
    return 'search';
  });
  const [status, setStatus] = useState(() => (mode === 'investment' ? 'Listed' : 'All'));

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      if (tab === 'investment' || tab === 'search') {
        setMode(tab);
        setStatus(tab === 'investment' ? 'Listed' : 'All');
      }
    } catch {}
  }, []);

  function handleModeChange(nextMode: 'search' | 'investment') {
    setMode(nextMode);
    try {
      sessionStorage.setItem('mi_companies_mode', nextMode);
    } catch {}
    if (nextMode === 'investment') {
      setStatus('Listed');
    } else {
      setStatus('All');
    }
    setSelectedId('');
  }

  const visible = rows.filter(
    r =>
      (status === 'All' || r.listed === (status === 'Listed')) &&
      (region === 'All' || r.region.includes(region)) &&
      (tag === 'All' || r.tags.includes(tag as Tag)) &&
      [r.name, r.id, r.relation].join(' ').toLowerCase().includes(q.trim().toLowerCase())
  );
  const selected = visible.find(r => r.id === selectedId);
  const news = selected ? relatedNews(selected, articles, daily) : [];
  const scoreIds = visible.filter(r => r.listed).map(r => r.id);

  function reset() {
    setQ('');
    if (mode === 'search') {
      setStatus('All');
    } else {
      setStatus('Listed');
    }
    onRegionChange('All');
    setTag('All');
    setSelectedId('');
  }

  function selectNews(id: string) {
    setSelectedId(id);
    requestAnimationFrame(() =>
      document.getElementById('company-news-feed')?.scrollIntoView({behavior: 'smooth', block: 'start'})
    );
  }

  return (
    <section className="section companies-page">
      {/* ヒーローセクション */}
      <div className="career-hero">
        <div className="career-hero-badge">
          <Building2 size={14} />
          <span>{region === 'Japan' ? 'JAPAN COMPANIES' : 'GLOBAL COMPANY DATABASE'}</span>
        </div>
        <h1>{region === 'Japan' ? '日本の製粉会社一覧' : '世界の製粉・穀物関連会社'}</h1>
        <p>
          {region === 'Japan'
            ? '国内の主要製粉会社を一覧で掲載。企業情報、製粉工場、製粉能力、採用情報を横断して確認できます。上場企業は公開資料に基づく投資環境情報もあわせて整理しています。'
            : '国内外の主要製粉・穀物関連企業を網羅。条件を変えると、企業一覧・上場企業の投資環境・関連ニュースが同時に絞り込めます。'}
        </p>
      </div>

      {/* フィルターハブ */}
      <div className="career-filter-hub">
        {/* モードスイッチ（企業検索 / 投資環境） */}
        <div className="modern-segment-control" role="group" aria-label="Companies表示切替">
          <button
            type="button"
            className={'segment-btn ' + (mode === 'search' ? 'active' : '')}
            onClick={() => handleModeChange('search')}
          >
            🏢 企業一覧・検索
          </button>
          <button
            type="button"
            className={'segment-btn ' + (mode === 'investment' ? 'active' : '')}
            onClick={() => handleModeChange('investment')}
          >
            📈 投資環境・評価
          </button>
        </div>

        {/* 1. 検索バー */}
        <div className="career-search-bar">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            value={q}
            onChange={e => {
              setQ(e.target.value);
              setSelectedId('');
            }}
            placeholder="企業名・グループ・キーワードで検索（例: 日清、ニップン、ADM）"
            aria-label="企業名で検索"
          />
          {q && (
            <button
              type="button"
              className="search-clear-btn"
              onClick={() => setQ('')}
              aria-label="入力をクリア"
            >
              ✕
            </button>
          )}
        </div>

        {/* 2. 地域ピルチップ（横スクロール対応） */}
        <div className="career-pills-scroll" role="tablist" aria-label="国・地域で絞り込み">
          {REGION_OPTIONS.map(([val, label]) => {
            const count = rows.filter(
              r => (mode === 'investment' ? r.listed : true) && (val === 'All' || r.region.includes(val))
            ).length;
            return (
              <button
                key={val}
                type="button"
                role="tab"
                aria-selected={region === val}
                className={'pill-chip ' + (region === val ? 'active' : '')}
                onClick={() => {
                  onRegionChange(val);
                  setSelectedId('');
                }}
              >
                {label} ({count})
              </button>
            );
          })}
        </div>

        {/* 3. クイックオプション（上場区分・タグ） */}
        {mode === 'search' && (
          <div className="career-quick-options">
            <div className="mini-select-field">
              <span>上場区分:</span>
              <select
                value={status}
                onChange={e => {
                  setStatus(e.target.value);
                  setSelectedId('');
                }}
                aria-label="上場区分で絞り込み"
              >
                <option value="All">すべて</option>
                <option value="Listed">上場企業</option>
                <option value="Private">非上場</option>
              </select>
            </div>

            <div className="mini-select-field">
              <span>特徴・タグ:</span>
              <select
                value={tag}
                onChange={e => {
                  setTag(e.target.value);
                  setSelectedId('');
                }}
                aria-label="タグで絞り込み"
              >
                <option value="All">すべて</option>
                <option value="Industry Leader">大手リーダー</option>
                <option value="Career">採用情報あり</option>
                <option value="Capacity">工場・能力情報あり</option>
                <option value="CapEx">設備投資・増設あり</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* 結果バー */}
      <div className="career-result-header">
        <p className="result-count">
          {mode === 'investment' ? (
            <>
              <b>{scoreIds.length}</b> 社の上場投資環境を表示中（評価対象 全 {rows.filter(r => r.listed).length} 社）
            </>
          ) : (
            <>
              <b>{visible.length}</b> 社を表示中（全 {rows.length} 社）
            </>
          )}
        </p>
        {(q || (mode === 'search' && status !== 'All') || region !== 'All' || tag !== 'All') && (
          <button type="button" className="clear-filter-btn" onClick={reset}>
            条件をクリア
          </button>
        )}
      </div>

      {mode === 'investment' && <Ranking ids={scoreIds} />}

      {/* 企業カードグリッド */}
      <div className={'company-grid' + (mode === 'investment' ? ' companies-grid-hidden' : '')}>
        {visible.map(r => {
          const g = groups.find(g => g.id === r.mill);
          return (
            <article
              className={'company-card' + (selected?.id === r.id ? ' selected-company' : '')}
              key={r.id}
            >
              <div className="career-card-top">
                <span className="career-location-chip">
                  <MapPin size={12} />
                  {r.region} · {r.id}
                </span>
                <span className={'tag ' + (r.listed ? 'tag-1' : 'tag-0')}>
                  {r.listed ? '上場' : '非上場'}
                </span>
              </div>

              <h3>
                <a className="company-title-link" href={appHref('company/' + r.id)}>
                  {r.name}
                </a>
              </h3>

              <p className="company-card-summary">{r.relation}</p>

              <div className="career-role-pills" style={{marginBottom: 10}}>
                {r.tags.map(t => (
                  <span key={t}>{t}</span>
                ))}
              </div>

              {r.listed && (
                <div className="company-investment-summary">
                  <ScoreBadge ticker={r.id} />
                  <CurrentPrice ticker={r.id} />
                </div>
              )}

              {g && <p className="company-card-capacity">{g.totalDaily}</p>}

              {!r.listed && privateInsights[r.id] && (
                <details className="company-card-more">
                  <summary>企業規模・公開情報</summary>
                  <div className="private-investment-context">
                    <b>株式投資対象外（非上場）</b>
                    <p>{privateInsights[r.id].summary}</p>
                    <div className="company-tags">
                      {privateInsights[r.id].metrics.map(x => (
                        <span className="pending" key={x}>{x}</span>
                      ))}
                    </div>
                    <a href={privateInsights[r.id].source} target="_blank" rel="noreferrer">
                      企業情報の公開ソース ↗
                    </a>
                  </div>
                </details>
              )}

              <div className="company-actions">
                <a className="company-action-primary" href={appHref('company/' + r.id)}>
                  企業情報 →
                </a>
                {g && <a href={appHref('mills/' + g.id)}>工場・能力 →</a>}
                {careerIds.has(r.id) && (
                  <a href={appHref('career/' + r.id)}>採用情報 →</a>
                )}
                <button onClick={() => selectNews(r.id)}>
                  {selected?.id === r.id ? 'ニュース表示中' : '関連ニュース'}
                </button>
              </div>

              {r.listed && (
                <details style={{marginTop: 10}}>
                  <summary>株価チャート・四半期業績</summary>
                  <StockChart ticker={r.id} name={r.name} />
                  <Quarterly ticker={r.id} />
                </details>
              )}

              {!g && (
                <details className="company-card-more">
                  <summary>公式情報源</summary>
                  <div className="sources">
                    {listedScores[r.id]?.sources.map(s => (
                      <a key={s.url} href={s.url} target="_blank" rel="noreferrer">
                        {s.name} ↗
                      </a>
                    ))}
                  </div>
                </details>
              )}
            </article>
          );
        })}
      </div>

      {!visible.length && (
        <div className="career-no-results">
          <Building2 size={32} />
          <p>条件に一致する製粉会社は見つかりませんでした。</p>
          <button type="button" onClick={reset}>
            条件をリセット
          </button>
        </div>
      )}

      {/* 関連ニュースセクション */}
      {selected && (
        <section className="companies-news" id="company-news-feed">
          <div className="section-title">
            <div>
              <span>COMPANY & REGION NEWS</span>
              <h2>{selected.name} の関連ニュース</h2>
              <p>
                {selected.name}のニュース（決算・開示・設備投資など）と、{regions(selected).join(' / ')}の国・市場動向（原料・政策・需給）のみを表示しています。※同じ国の他社ニュースは除外されます。
              </p>
            </div>
            <button onClick={() => setSelectedId('')}>閉じる</button>
          </div>
          {news.length ? (
            <div className="story-grid">
              {news.map(n => (
                <article className="story" key={n.key}>
                  <div className="story-top">
                    <span className="tag tag-1">
                      {n.direct ? '会社直接' : '国・市場'} · {n.category}
                    </span>
                    <span className="meta">{n.date.slice(0, 10)}</span>
                  </div>
                  <h3>
                    <a href={n.url} target={n.internal ? undefined : '_blank'} rel={n.internal ? undefined : 'noreferrer'}>
                      {n.title}
                      {n.internal ? '' : ' ↗'}
                    </a>
                  </h3>
                  <p>{n.fact}</p>
                  <p className="meta">{n.country} · {n.source}</p>
                </article>
              ))}
            </div>
          ) : (
            <div className="note-box">この会社・地域で表示できるニュースはまだありません。</div>
          )}
        </section>
      )}

      {/* 下部ガイド */}
      {region === 'Japan' && mode === 'search' && (
        <section className="story-grid" style={{marginTop: 32}} aria-label="日本の製粉会社を調べる">
          <article className="story">
            <h2>日本の製粉会社を製粉能力で比較</h2>
            <p>公開資料から確認できる日産能力を使った会社横断比較はCompareで確認できます。</p>
            <a href={appHref('compare')}>Compareで日本ランキングを見る →</a>
          </article>
          <article className="story">
            <h2>日本の製粉工場を探す</h2>
            <p>各社の製粉工場、所在地、日産能力、Google Mapsへの導線はMillsにまとめています。</p>
            <a href={appHref('mills')}>Millsで日本の製粉工場を探す →</a>
          </article>
          <article className="story">
            <h2>製粉会社の採用情報</h2>
            <p>登録されている日本の製粉会社について、正社員採用や公開求人の状況を調べられます。</p>
            <a href={appHref('career')}>採用情報を見る →</a>
          </article>
          <article className="story">
            <h2>日本の製粉業界について</h2>
            <p>
              全国規模の大手から地域密着企業まで多彩な会社があります。公開資料の単位や時点を残し、無理な推測をせず客観的に整理しています。
            </p>
          </article>
        </section>
      )}

      <div className="equipment-cta-banner" style={{margin: '28px 0'}}>
        <div>
          <h3>未掲載の製粉会社・工場情報の提供・更新リクエスト</h3>
          <p>「自社の工場やスペックを追加したい」「最新情報に更新してほしい」といった情報提供を受け付けています。</p>
        </div>
        <a className="equipment-cta-button" href={appHref('contact')}>
          掲載・更新リクエストはこちら →
        </a>
      </div>
    </section>
  );
}
