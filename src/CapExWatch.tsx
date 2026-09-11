import { useState } from 'react';
import { initialCapExItems } from './capexWatchData';
import { ExternalLink, Factory, Cpu, DollarSign, Calendar, Globe, AlertCircle } from 'lucide-react';
import { appHref } from './navigation';

export default function CapExWatch() {
  const [priorityFilter, setPriorityFilter] = useState<string>('すべて');
  const [countryFilter, setCountryFilter] = useState<string>('すべて');

  const items = initialCapExItems.sort((a, b) => {
    if (b.importanceScore !== a.importanceScore) {
      return b.importanceScore - a.importanceScore;
    }
    return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
  });

  const filtered = items.filter((item) => {
    if (priorityFilter !== 'すべて' && item.priority !== priorityFilter) return false;
    if (countryFilter !== 'すべて' && item.country !== countryFilter) return false;
    return true;
  });

  const countries = ['すべて', ...new Set(items.map((i) => i.country).filter((c): c is string => Boolean(c)))];

  return (
    <section className="section capex-watch-page">
      <div className="page-heading">
        <div>
          <span>STRATEGIC CAPEX WATCH</span>
          <h1>Global Milling CapEx Watch</h1>
          <p>
            製粉工場の新設、増設、能力増強、大型設備投資、主要設備メーカー（Bühler、Ocrim、Omas、Alapala、Satake等）案件のグローバル監視データベースです。
          </p>
        </div>
      </div>

      <div className="filters" style={{ marginBottom: 20 }}>
        <label>
          優先度:
          <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
            <option value="すべて">すべて (All Priorities)</option>
            <option value="High Priority">High Priority (70点以上)</option>
            <option value="Medium Priority">Medium Priority (50-69点)</option>
          </select>
        </label>
        <label>
          国・地域:
          <select value={countryFilter} onChange={(e) => setCountryFilter(e.target.value)}>
            {countries.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="story-grid">
        {filtered.map((item) => (
          <article className="story capex-card" key={item.id} style={{ borderLeft: item.priority === 'High Priority' ? '4px solid #dc2626' : '4px solid #2563eb' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                <span className={`tag ${item.priority === 'High Priority' ? 'tag-1' : 'tag-2'}`}>
                  {item.priority} ({item.importanceScore}点)
                </span>
                {item.tags.map((t) => (
                  <span key={t} className="tag tag-2">
                    {t}
                  </span>
                ))}
              </div>
              <small className="meta" style={{ fontSize: '0.8rem', color: '#64748b' }}>
                公表日: {item.publishedAt} · 初回発見: {item.discoveredAt ? item.discoveredAt.slice(0, 10) : '未記録'}
              </small>
            </div>

            <h3 style={{ marginTop: 4, marginBottom: 8 }}>{item.title}</h3>
            <p style={{ fontSize: '0.95rem', color: '#334155', lineHeight: 1.6 }}>{item.body}</p>

            <div className="spec-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, margin: '12px 0', background: '#f8fafc', padding: 12, borderRadius: 6 }}>
              <div>
                <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Factory size={13} /> 企業・工場名
                </span>
                <strong style={{ fontSize: '0.9rem' }}>
                  {item.company || '未確認'} {item.millName ? ` / ${item.millName}` : ''}
                </strong>
              </div>
              <div>
                <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Globe size={13} /> 所在地・国
                </span>
                <strong style={{ fontSize: '0.9rem' }}>
                  {item.country || 'Global'} {item.location ? `(${item.location})` : ''}
                </strong>
              </div>
              <div>
                <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Cpu size={13} /> 設備メーカー
                </span>
                <strong style={{ fontSize: '0.9rem', color: item.equipmentSupplier ? '#0369a1' : '#475569' }}>
                  {item.equipmentSupplier || '未確認'}
                </strong>
              </div>
              <div>
                <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Factory size={13} /> 追加能力 / 総能力
                </span>
                <strong style={{ fontSize: '0.9rem', color: '#15803d' }}>
                  {item.capacityAdded || '未確認'} {item.totalCapacity ? ` (総能力 ${item.totalCapacity})` : ''}
                </strong>
              </div>
              <div>
                <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <DollarSign size={13} /> 投資額
                </span>
                <strong style={{ fontSize: '0.9rem' }}>
                  {item.investmentAmount !== null ? `${item.currency || ''} ${item.investmentAmount}` : '未確認'}
                </strong>
              </div>
              <div>
                <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Calendar size={13} /> 稼働開始時期
                </span>
                <strong style={{ fontSize: '0.9rem' }}>{item.commercialOperationDate || item.commissioningDate || '未確認'}</strong>
              </div>
            </div>

            <div className="why" style={{ marginTop: 8 }}>
              <b>分析インサイト（製粉業界への示唆）</b>
              <p style={{ margin: 0 }}>{item.why}</p>
            </div>

            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="pill" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                {item.source} 出典一次情報 → <ExternalLink size={13} />
              </a>
              {item.company && (
                <a href={appHref('companies')} className="meta" style={{ fontSize: '0.85rem' }}>
                  関連企業データをみる →
                </a>
              )}
            </div>
          </article>
        ))}
      </div>

      {!filtered.length && (
        <div className="note-box">
          <AlertCircle size={16} /> 該当する条件の重要設備投資案件が見つかりませんでした。
        </div>
      )}
    </section>
  );
}
