import {useState, useMemo} from 'react';
import {Search, X, Cpu, Gauge, Zap} from 'lucide-react';
import type {Equipment} from './model';
import {appHref} from './navigation';

const MAKERS = ['すべて', 'Bühler', 'Omas', 'Ocrim', 'Satake', 'Alapala'];

export default function Tech({equipment}: {equipment: Equipment[]}) {
  const [q, setQ] = useState('');
  const [selectedMaker, setSelectedMaker] = useState('すべて');
  const [selectedProcess, setSelectedProcess] = useState('すべて');

  // ユニークな工程リストを抽出
  const processes = useMemo(() => {
    const set = new Set<string>();
    equipment.forEach(e => {
      if (e.process) set.add(e.process);
    });
    return ['すべて', ...Array.from(set)];
  }, [equipment]);

  // フィルタリング処理
  const filtered = useMemo(() => {
    return equipment.filter(e => {
      const matchMaker = selectedMaker === 'すべて' || e.manufacturer.toLowerCase() === selectedMaker.toLowerCase();
      const matchProcess = selectedProcess === 'すべて' || e.process === selectedProcess;
      const text = [e.equipment, e.manufacturer, e.model || '', e.process, e.function, e.notes].join(' ').toLowerCase();
      const matchQ = !q.trim() || text.includes(q.trim().toLowerCase());
      return matchMaker && matchProcess && matchQ;
    });
  }, [equipment, q, selectedMaker, selectedProcess]);

  const resetFilters = () => {
    setQ('');
    setSelectedMaker('すべて');
    setSelectedProcess('すべて');
  };

  return (
    <section className="section companies-page tech-page">
      {/* ヒーローエリア */}
      <div className="career-hero">
        <div className="career-hero-badge">
          <Cpu size={14} />
          <span>MILLING TECHNOLOGY · DATABASE</span>
        </div>
        <h1>製粉技術・製粉設備データベース</h1>
        <p>
          小麦の製粉工程（精選・調質・粉砕・篩分け・搬送）で使われる主要製粉機械のスペック、処理能力、省エネ性能を比較・検索できます。
        </p>
      </div>

      {/* 検索 & フィルターハブ（他タブと完全に統一されたモダンUI） */}
      <div className="career-filter-hub" style={{marginBottom: 16}}>
        <div className="career-search-bar">
          <Search size={18} className="search-icon" />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="設備名・型番・工程・機能で検索（例: MTCG / ロール機 / 精選 / 省エネ）"
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

        {/* メーカー選択ピル */}
        <div className="career-quick-filter-group" style={{marginTop: 10}}>
          <span className="filter-group-title">メーカー：</span>
          <div className="career-pills-scroll" role="group" aria-label="メーカー絞り込み">
            {MAKERS.map(m => (
              <button
                key={m}
                type="button"
                className={'pill-chip ' + (selectedMaker === m ? 'active' : '')}
                onClick={() => setSelectedMaker(m)}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* 工程選択ピル */}
        <div className="career-quick-filter-group" style={{marginTop: 8}}>
          <span className="filter-group-title">工程：</span>
          <div className="career-pills-scroll" role="group" aria-label="工程絞り込み">
            {processes.map(p => (
              <button
                key={p}
                type="button"
                className={'pill-chip ' + (selectedProcess === p ? 'active' : '')}
                onClick={() => setSelectedProcess(p)}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      <p role="status" className="companies-count">
        {filtered.length}件の設備を掲載中 / 全 {equipment.length}件
      </p>

      {/* 設備カードグリッド（他タブと統一した清潔感のある白背景モダンカード） */}
      {filtered.length > 0 ? (
        <div className="company-grid" style={{marginTop: 14}}>
          {filtered.map(e => {
            const hasCapacity = e.capacityMax !== null;
            const capacityStr = hasCapacity
              ? `${e.capacityMin !== null && e.capacityMin !== e.capacityMax ? e.capacityMin + '〜' : ''}${e.capacityMax} ${e.capacityUnit}`
              : '仕様書・資料確認中';

            return (
              <article className="company-card tech-item-card" key={e.id}>
                <div className="tech-item-header">
                  <span className="ticker">{e.manufacturer} · {e.process}</span>
                  {e.status === 'verified' && (
                    <span className="tech-verified-badge">公式資料確認済</span>
                  )}
                </div>

                <h3 style={{margin: '8px 0 6px', fontSize: 20}}>
                  <a className="company-title-link" href={appHref('equipment/' + e.id)}>
                    {e.equipment} {e.model}
                  </a>
                </h3>

                <p className="company-card-summary" style={{fontSize: 14, color: '#55665d', marginBottom: 14}}>
                  {e.function || e.notes || '一次情報に基づく設備仕様を整理しています。'}
                </p>

                {/* スペックハイライト */}
                <div className="tech-spec-grid">
                  <div className="tech-spec-box">
                    <div className="tech-spec-label">
                      <Gauge size={13} /> 処理能力
                    </div>
                    <div className="tech-spec-value">{capacityStr}</div>
                  </div>

                  <div className="tech-spec-box">
                    <div className="tech-spec-label">
                      <Zap size={13} /> 省エネ・電力
                    </div>
                    <div className="tech-spec-value">
                      {e.energySaving !== null
                        ? `最大${e.energySaving}%削減`
                        : e.kwhPerT !== null
                        ? `${e.kwhPerT} kWh/t`
                        : '未確認'}
                    </div>
                  </div>
                </div>

                {/* アクションボタン */}
                <div className="company-actions" style={{marginTop: 'auto', paddingTop: 14}}>
                  <a className="company-action-primary" href={appHref('equipment/' + e.id)}>
                    仕様と出典を見る →
                  </a>
                  <a href={appHref('machines/' + e.manufacturer.toLowerCase())}>
                    {e.manufacturer}詳細 →
                  </a>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="note-box" style={{marginTop: 16}}>
          <span>条件に一致する製粉設備は見つかりませんでした。</span>
          <button onClick={resetFilters} style={{marginLeft: 12}}>
            条件をリセット
          </button>
        </div>
      )}

      {/* 製粉工程ガイド・比較のポイント（整理された解説セクション） */}
      <section className="section" style={{marginTop: 36}}>
        <div className="section-title">
          <div>
            <span className="section-kicker">KNOWLEDGE</span>
            <h2>製粉設備の比較と工程の基礎知識</h2>
          </div>
        </div>

        <div className="story-grid">
          <article className="story">
            <h3>小麦の製粉工程の流れ</h3>
            <p>
              小麦の製粉は、原料受入後に夾雑物を取り除く「精選」、適切な水分に整える「調質」、ロール機等で皮と胚乳を分ける「粉砕」、粒度ごとに篩い分ける「篩分け」、工程間をつなぐ「搬送」を経て、用途ごとの小麦粉として製品化されます。
            </p>
          </article>
          <article className="story">
            <h3>設備能力を比較する際の注意点</h3>
            <p>
              公称能力（t/h）は、対象とする小麦の品種、硬さ、水分値、目標歩留まりによって実際の処理量が変動します。数値の多寡だけでなく、省エネ性能、自動化のしやすさ、清掃・保全の容易さを合わせて比較することが重要です。
            </p>
          </article>
        </div>
      </section>

      {/* 関連リンク */}
      <section className="section" style={{marginTop: 12}}>
        <div className="section-title">
          <div>
            <span className="section-kicker">RELATED</span>
            <h2>関連データベース</h2>
          </div>
        </div>
        <div className="company-actions">
          <a href={appHref('machines')}>製粉機械メーカー一覧 →</a>
          <a href={appHref('mills')}>製粉工場一覧 →</a>
          <a href={appHref('compare')}>製粉能力ランキング →</a>
          <a href={appHref('companies')}>企業を探す →</a>
        </div>
      </section>

      {/* お問合せバナー（一番下に控えめに配置） */}
      <div className="equipment-cta-banner" style={{marginTop: 36, marginBottom: 20}}>
        <div>
          <h3>製粉設備・技術情報の掲載リクエスト</h3>
          <p>データベースに掲載したい最新の製粉設備・機械の仕様情報や、掲載内容の更新リクエストを受け付けています。</p>
        </div>
        <a className="equipment-cta-button" href={appHref('contact')}>
          情報提供・掲載リクエスト窓口へ →
        </a>
      </div>
    </section>
  );
}
