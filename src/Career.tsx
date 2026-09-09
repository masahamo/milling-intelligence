import {useState} from 'react';
import {
  Search,
  Filter,
  MapPin,
  Briefcase,
  ChevronDown,
  Check,
  RotateCcw,
  ExternalLink,
  Building2,
  HelpCircle,
} from 'lucide-react';
import HiringHistory from './HiringHistory';
import {careerCompanies, careerJobs} from './careerData';
import {
  CareerAssessmentBadge,
  CareerAssessmentCard,
  CareerAssessmentOverview,
  getCareerAssessment,
} from './CareerAssessments';
import type {CareerCompany, CareerJob} from './careerData';
import {appHref} from './navigation';
import './career.css';

const stateLabel: Record<string, string> = {
  body: '公式本文を確認',
  listing: '採用一覧のみ確認',
  indexed: '検索収録のみ・本文未確認',
  external: '外部求人本文を確認',
  closed: '募集終了',
};

const kindLabel: Record<string, string> = {
  job: '個別求人',
  program: '採用要項・プログラム',
  seasonal: '季節雇用',
};

const regionOrder = ['Japan', 'Europe', 'North America', 'Asia-Pacific', 'Other'];

const regionLabel: Record<string, string> = {
  Japan: '🇯🇵 日本',
  Europe: '🇪🇺 欧州',
  'North America': '🌎 北米',
  'Asia-Pacific': '🌏 アジア・豪州',
  Other: '🌐 その他',
};

function employerRegion(c: CareerCompany) {
  if (c.region.includes('Japan')) return 'Japan';
  if (c.region.includes('Europe')) return 'Europe';
  if (c.region.includes('U.S.') || c.region.includes('Canada')) return 'North America';
  if (c.region.includes('Australia')) return 'Asia-Pacific';
  return 'Other';
}

function employerCountry(c: CareerCompany) {
  const text = (c.region + ' ' + c.relation).toLowerCase();
  if (c.region.includes('Japan')) return '日本';
  if (text.includes('switzerland')) return 'スイス';
  if (text.includes('greece')) return 'ギリシャ';
  if (text.includes('italy')) return 'イタリア';
  if (text.includes('france')) return 'フランス';
  if (text.includes('germany')) return 'ドイツ';
  if (text.includes('united kingdom') || text.includes(' uk')) return 'イギリス';
  if (text.includes('türkiye') || text.includes('turkey')) return 'トルコ';
  if (c.region.includes('U.S.') && c.region.includes('Canada')) return '米・加';
  if (c.region.includes('U.S.')) return 'アメリカ';
  if (c.region.includes('Canada')) return 'カナダ';
  if (c.region.includes('Australia')) return '豪州';
  if (c.region.includes('Europe')) return '欧州各地';
  return 'グローバル';
}

const activeJob = (j: CareerJob) =>
  j.kind === 'job' && ['body', 'listing', 'external'].includes(j.state);

const explicitFullTime = (j: CareerJob) =>
  /full[- ]?time|正社員|100%/i.test([j.title, j.requirements, j.note].join(' '));

function jobMatches(j: CareerJob, jobType: string, evidence: string, showClosed: boolean) {
  const typeOk =
    jobType === 'all' ||
    (jobType === 'job' && j.kind === 'job') ||
    (jobType === 'fulltime' && explicitFullTime(j)) ||
    (jobType === 'program' && j.kind === 'program');
  return (
    (showClosed || j.state !== 'closed') &&
    typeOk &&
    (evidence === 'all' ||
      (evidence === 'housing' && j.support === 'housing') ||
      (evidence === 'restricted' && j.support === 'restricted') ||
      j.state === evidence)
  );
}

function JobCard({job}: {job: CareerJob}) {
  const stale =
    Date.now() - new Date(job.checked + 'T00:00:00Z').getTime() > 30 * 86400000;
  const company = careerCompanies.find(c => c.id === job.company);
  const companyName = company?.name || job.company;

  return (
    <article className="career-job-item">
      <div className="career-job-header">
        <div className="career-tags">
          <span
            className={
              'career-status ' +
              (job.state === 'body'
                ? 'confirmed'
                : job.state === 'closed'
                ? 'closed'
                : 'pending')
            }
          >
            {stateLabel[job.state]}
          </span>
          <span className="career-job-kind">{kindLabel[job.kind]}</span>
          {stale && (
            <span className="career-status pending">30日超・再確認推奨</span>
          )}
        </div>
      </div>
      <h4>{job.title}</h4>
      <p className="job-location">
        <MapPin size={13} />
        {job.location || '勤務地：未確認'}
      </p>
      <div className="career-job-company-lead">
        <a
          href={appHref('company/' + job.company)}
          className="job-company-link"
          title={`${companyName} の会社概要・工場データを見る`}
        >
          <Building2 size={13} />
          <span>{companyName} の会社説明・事業概要を見る →</span>
        </a>
      </div>
      <p className="meta">
        掲載日 {job.published || '未確認'} / 確認 {job.checked}
      </p>
      <dl className="career-fields">
        {[
          ['給与', job.salary || '未確認・推定しない'],
          ['経験・職務', job.requirements],
          ['海外応募・就労資格', job.eligibility],
          ['ビザ支援', job.visa],
          ['転居費用', job.relocation],
          ['住居', job.housing],
        ].map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      {job.note && <p className="career-note-text">{job.note}</p>}
      <div className="career-job-links">
        <a
          href={appHref('company/' + job.company)}
          className="job-detail-company-link"
          title={`${companyName} の会社概要・工場データを見る`}
        >
          <Building2 size={12} />
          <span>会社概要・工場</span>
        </a>
        <a href={job.url} target="_blank" rel="noreferrer">
          {job.state === 'closed' ? '募集終了の公式表示' : '求人・募集要項の出典'} ↗
        </a>
        {job.sourceUrl && (
          <a href={job.sourceUrl} target="_blank" rel="noreferrer">
            確認した採用一覧 ↗
          </a>
        )}
      </div>
    </article>
  );
}

function EmployerCard({
  company,
  detail = false,
  jobType = 'all',
  evidence = 'all',
  showClosed = false,
}: {
  company: CareerCompany;
  detail?: boolean;
  jobType?: string;
  evidence?: string;
  showClosed?: boolean;
}) {
  const all = careerJobs.filter(j => j.company === company.id);
  const jobs = detail
    ? all.filter(j => showClosed || j.state !== 'closed')
    : all.filter(j => jobMatches(j, jobType, evidence, showClosed));
  const active = all.filter(activeJob);

  return (
    <article className="career-card">
      <div className="career-card-top">
        <span className="career-location-chip">
          <MapPin size={12} />
          {employerCountry(company)}
        </span>
        <div className="career-card-badges">
          <CareerAssessmentBadge id={company.id} />
          <span
            className={
              'career-open-badge ' + (active.length ? 'is-open' : 'is-unknown')
            }
          >
            {active.length ? `${active.length}件の求人確認` : '求人未確認'}
          </span>
        </div>
      </div>

      <h3 className="career-company-name">
        <a href={appHref('career/' + company.id)}>{company.name}</a>
      </h3>

      <p className="career-relation">{company.relation}</p>
      {company.note && <p className="career-note-text">{company.note}</p>}

      <div className="career-roles-wrap">
        <div className="career-role-pills">
          {company.roles.map(role => (
            <span key={role}>{role}</span>
          ))}
        </div>
      </div>

      <div className="career-card-actions">
        <a
          href={company.url}
          target="_blank"
          rel="noreferrer"
          className="btn-career-primary"
        >
          {company.level === 'external' ? '求人情報を見る' : '公式採用サイト'}
          <ExternalLink size={13} />
        </a>
        <a
          href={appHref('company/' + company.id)}
          className="btn-career-secondary"
          title={`${company.name} の会社説明・事業概要・工場データを見る`}
        >
          <Building2 size={13} />
          <span>会社説明・事業詳細 →</span>
        </a>
        {!detail && (
          <a
            href={appHref('career/' + company.id)}
            className="btn-career-ghost"
          >
            採用詳細
          </a>
        )}
        {company.mill && (
          <a
            href={appHref('mills/' + company.mill)}
            className="btn-career-ghost"
          >
            工場スペック
          </a>
        )}
      </div>

      {jobs.length > 0 ? (
        <details open={detail} className="career-jobs-accordion">
          <summary>
            <span>{jobs.length}件の代表求人・要項を見る</span>
            <ChevronDown size={14} className="accordion-chevron" />
          </summary>
          <div className="career-jobs-list">
            {jobs.map(j => (
              <JobCard job={j} key={j.id} />
            ))}
          </div>
        </details>
      ) : (
        <div className="career-jobs-empty">
          <small>個別求人の確定情報は未収録（公式採用ページをご確認ください）</small>
        </div>
      )}
    </article>
  );
}

function CareerMethod() {
  return (
    <details className="career-method-panel">
      <summary>
        <HelpCircle size={15} />
        <span>掲載データの確認状態と採用条件の読み方</span>
      </summary>
      <div className="method-content">
        <p>
          本文確認は掲載内容を確認したことを示し、空席の継続を保証するものではありません。採用プログラムは個別の募集中求人と区別して扱っています。
        </p>
        <p>
          海外応募、就労資格、ビザ支援、転居費用、住居提供などの条件は公式記載をそのまま抽出しています。「記載なし」は「支援なし」を直ちに意味するものではありません。
        </p>
        <p>
          主なキャリア領域は探索用のタグであり、常にその職種の募集があることを保証するものではありません。最新の募集状況は各社の公式採用ページにて直接ご確認ください。
        </p>
      </div>
    </details>
  );
}

export default function Career({selectedId}: {selectedId?: string}) {
  const [q, setQ] = useState('');
  const [region, setRegion] = useState('all');
  const [country, setCountry] = useState('all');
  const [evidence, setEvidence] = useState('all');
  const [showClosed, setShowClosed] = useState(false);
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [jobType, setJobType] = useState('all');
  const [attractiveness, setAttractiveness] = useState('all');

  const selected = careerCompanies.find(c => c.id === selectedId);
  const historySupported = selected?.level !== 'external';
  const countries = [...new Set(careerCompanies.map(employerCountry))].sort(
    (a, b) => (a === '日本' ? -1 : b === '日本' ? 1 : a.localeCompare(b))
  );

  function reset() {
    setQ('');
    setRegion('all');
    setCountry('all');
    setEvidence('all');
    setShowClosed(false);
    setOnlyOpen(false);
    setJobType('all');
    setAttractiveness('all');
  }

  const isFiltered =
    q ||
    region !== 'all' ||
    country !== 'all' ||
    evidence !== 'all' ||
    showClosed ||
    onlyOpen ||
    jobType !== 'all' ||
    attractiveness !== 'all';

  const rows = (selected ? [selected] : selectedId ? [] : careerCompanies).filter(
    c => {
      const jobs = careerJobs.filter(j => j.company === c.id);
      const assessment = getCareerAssessment(c.id);
      const text = [
        c.name,
        c.relation,
        c.note,
        ...c.roles,
        ...jobs.map(j => j.title + ' ' + (j.location || '')),
      ]
        .join(' ')
        .toLowerCase();
      return (
        (region === 'all' || employerRegion(c) === region) &&
        (country === 'all' || employerCountry(c) === country) &&
        (attractiveness === 'all' || assessment?.overall === attractiveness) &&
        (!onlyOpen || jobs.some(activeJob)) &&
        text.includes(q.trim().toLowerCase()) &&
        (evidence === 'all' ||
          jobs.some(j => jobMatches(j, jobType, evidence, showClosed))) &&
        (jobType === 'all' ||
          jobs.some(j => jobMatches(j, jobType, evidence, showClosed)))
      );
    }
  );

  const grouped = regionOrder
    .map(name => ({
      name,
      companies: rows.filter(c => employerRegion(c) === name),
    }))
    .filter(g => g.companies.length);

  return (
    <section className="section career-page">
      {/* ヒーローセクション：重複見出しを1つに統合 */}
      <div className="career-hero">
        <div className="career-hero-badge">
          <Briefcase size={14} />
          <span>CAREER INTELLIGENCE</span>
        </div>
        {selected ? (
          <h1>{selected.name} の採用・求人情報</h1>
        ) : (
          <h1>製粉会社・小麦粉メーカーの採用情報</h1>
        )}
        <p>
          {selected
            ? `${selected.name}の採用入口や求人状況、関連工場、採用魅力度評価をまとめています。`
            : '国内外の主要製粉会社について、公式採用ページや職種、求人の有無を一覧で検索・比較できます。'}
        </p>
      </div>

      {selected ? (
        <>
          <div className="career-metrics-row">
            <div className="metric-item">
              <b>{careerCompanies.length}</b>
              <span>調査対象企業</span>
            </div>
            <div className="metric-item">
              <b>{careerJobs.filter(j => j.state === 'body').length}</b>
              <span>本文確認求人</span>
            </div>
            <div className="metric-item">
              <b>
                {careerJobs.filter(
                  j => j.state === 'listing' || j.state === 'indexed'
                ).length}
              </b>
              <span>採用一覧確認</span>
            </div>
            <div className="metric-item">
              <b>{careerJobs.filter(j => j.state === 'closed').length}</b>
              <span>募集終了確認</span>
            </div>
          </div>

          <nav className="breadcrumb" aria-label="パンくずリスト" style={{marginTop: 18}}>
            <a href={appHref('career')}>← 採用情報一覧に戻る</a>
            <span>›</span>
            <a href={appHref('companies')}>企業一覧</a>
            <span>›</span>
            <a href={appHref('company/' + selected.id)}>{selected.name} の会社説明</a>
          </nav>

          <div className="career-company-bridge-banner">
            <div className="bridge-text-wrap">
              <span className="bridge-kicker">COMPANY & PLANT PROFILE</span>
              <h3>{selected.name} の会社説明・事業・工場データ</h3>
              <p>
                この企業の事業内容、製粉工場スペック（日産能力・拠点数）、業界ランキング、最新ニュース・適時開示を会社説明ページで詳しく確認できます。
              </p>
            </div>
            <div className="bridge-btn-group">
              <a
                href={appHref('company/' + selected.id)}
                className="btn-career-primary"
                title={`${selected.name} の会社説明・事業詳細を見る`}
              >
                <Building2 size={14} />
                <span>会社説明・事業詳細を見る →</span>
              </a>
              {selected.mill && (
                <a
                  href={appHref('mills/' + selected.mill)}
                  className="btn-career-secondary"
                  title={`${selected.name} の製粉工場スペックを見る`}
                >
                  <span>🏭 製粉工場スペックを見る →</span>
                </a>
              )}
            </div>
          </div>

          <EmployerCard company={selected} detail showClosed={showClosed} />
          <CareerAssessmentCard id={selected.id} name={selected.name} />

          {historySupported ? (
            <HiringHistory companyId={selected.id} />
          ) : (
            <div className="note-box">
              公式の求人一覧をまだ特定できていないため、この会社の自動求人履歴は未開始です。
            </div>
          )}

          <CareerMethod />
        </>
      ) : (
        <>
          {/* 検索・フィルターエリア */}
          <div className="career-filter-hub">
            {/* 1. 検索バー */}
            <div className="career-search-bar">
              <Search size={18} className="search-icon" />
              <input
                type="text"
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder="会社名、職種、キーワードで検索（例: 日清、生産技術、営業）"
                aria-label="会社名やキーワードで検索"
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

            {/* 2. 地域ピルチップ（横スクロール対応・ワンタップ切り替え） */}
            <div className="career-pills-scroll" role="tablist" aria-label="地域で絞り込み">
              <button
                type="button"
                role="tab"
                aria-selected={region === 'all'}
                className={'pill-chip ' + (region === 'all' ? 'active' : '')}
                onClick={() => setRegion('all')}
              >
                すべて ({careerCompanies.length})
              </button>
              {regionOrder.map(r => {
                const count = careerCompanies.filter(c => employerRegion(c) === r).length;
                return (
                  <button
                    key={r}
                    type="button"
                    role="tab"
                    aria-selected={region === r}
                    className={'pill-chip ' + (region === r ? 'active' : '')}
                    onClick={() => setRegion(r)}
                  >
                    {regionLabel[r]} ({count})
                  </button>
                );
              })}
            </div>

            {/* 3. クイック絞り込みバー */}
            <div className="career-quick-options">
              {/* 求人ありトグルチップ */}
              <button
                type="button"
                className={'option-toggle-btn ' + (onlyOpen ? 'active' : '')}
                onClick={() => setOnlyOpen(!onlyOpen)}
              >
                <Check size={14} className={onlyOpen ? 'icon-show' : 'icon-hidden'} />
                <span>現在求人ありのみ</span>
              </button>

              {/* 採用魅力度 */}
              <div className="mini-select-field">
                <span>魅力度:</span>
                <select
                  value={attractiveness}
                  onChange={e => setAttractiveness(e.target.value)}
                  aria-label="採用魅力度で絞り込み"
                >
                  <option value="all">すべて</option>
                  <option value="attractive">🟢 魅力的</option>
                  <option value="conditional">🟡 条件次第</option>
                  <option value="review">🔴 要検討</option>
                </select>
              </div>

              {/* 求人タイプ */}
              <div className="mini-select-field">
                <span>求人種別:</span>
                <select
                  value={jobType}
                  onChange={e => setJobType(e.target.value)}
                  aria-label="求人種別で絞り込み"
                >
                  <option value="all">すべて</option>
                  <option value="job">一般求人</option>
                  <option value="fulltime">正社員・フルタイム</option>
                  <option value="program">新卒・プログラム</option>
                </select>
              </div>

              {/* 国 */}
              <div className="mini-select-field">
                <span>国:</span>
                <select
                  value={country}
                  onChange={e => setCountry(e.target.value)}
                  aria-label="国で絞り込み"
                >
                  <option value="all">すべての国</option>
                  {countries.map(x => (
                    <option key={x} value={x}>
                      {x}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 4. 詳細条件アコーディオン（縦書き崩れ完全防止） */}
            <details className="career-advanced-details">
              <summary>
                <Filter size={14} />
                <span>詳細条件（採用根拠・募集終了履歴）</span>
                <ChevronDown size={14} className="summary-chevron" />
              </summary>
              <div className="advanced-options-grid">
                <div className="advanced-field">
                  <label htmlFor="evidence-select">採用根拠の確認レベル</label>
                  <select
                    id="evidence-select"
                    value={evidence}
                    onChange={e => setEvidence(e.target.value)}
                  >
                    <option value="all">すべての採用入口</option>
                    <option value="body">本文確認した求人・要項あり</option>
                    <option value="housing">住居提供の明記あり（対象限定）</option>
                    <option value="restricted">応募・就労資格の条件明記あり</option>
                    <option value="indexed">検索収録のみの候補あり</option>
                  </select>
                </div>
                <div className="advanced-checkbox-wrap">
                  <label className="career-custom-checkbox">
                    <input
                      type="checkbox"
                      checked={showClosed}
                      onChange={e => setShowClosed(e.target.checked)}
                    />
                    <span className="checkbox-text">募集終了の履歴も表示する</span>
                  </label>
                </div>
              </div>
            </details>
          </div>

          {/* 結果バー（件数 ＆ リセット） */}
          <div className="career-result-header">
            <p className="result-count">
              <b>{rows.length}</b> 社を表示中
            </p>
            {isFiltered && (
              <button type="button" className="clear-filter-btn" onClick={reset}>
                <RotateCcw size={13} />
                <span>条件をクリア</span>
              </button>
            )}
          </div>

          {/* 該当なし表示 */}
          {!rows.length && (
            <div className="career-no-results">
              <Building2 size={32} />
              <p>条件に一致する製粉会社は見つかりませんでした。</p>
              <button type="button" onClick={reset}>
                検索条件をリセットする
              </button>
            </div>
          )}

          {/* 地域別企業カードグリッド */}
          {grouped.map(group => (
            <section className="career-group-section" key={group.name}>
              <div className="career-group-header">
                <h3>{regionLabel[group.name]}</h3>
                <span className="group-count">{group.companies.length}社</span>
              </div>
              <div className="career-card-grid">
                {group.companies.map(c => (
                  <EmployerCard
                    key={c.id}
                    company={c}
                    jobType={jobType}
                    evidence={evidence}
                    showClosed={showClosed}
                  />
                ))}
              </div>
            </section>
          ))}

          {/* ガイドと補足情報 */}
          <section className="career-bottom-guides">
            <div className="section-title">
              <div>
                <span>CAREER GUIDES</span>
                <h2>会社選びの参考情報</h2>
                <p>採用魅力度評価の軸や求人履歴の記録方法について確認できます。</p>
              </div>
            </div>
            <CareerAssessmentOverview companies={careerCompanies} />
            <HiringHistory />
            <CareerMethod />
          </section>

          <section className="career-faq-section" aria-label="製粉業界の採用・キャリアガイド">
            <div className="story-grid">
              <article className="story">
                <h2>製粉会社ではどんな仕事がある？</h2>
                <p>
                  製造・製粉オペレーター、生産技術、プラント設備保全、品質管理・検査、研究開発（商品開発・小麦粉二次加工適性評価）、国内・海外営業など多岐にわたります。
                </p>
              </article>
              <article className="story">
                <h2>製粉業界の採用・就職・キャリア視点</h2>
                <p>
                  工場勤務や転勤の有無、主力製品（業務用小麦粉・プレミックス・パスタ等）、設備の自動化水準、各社の海外展開状況などを確認することが重要です。
                </p>
              </article>
            </div>
            <div className="company-actions" style={{marginTop: 24}}>
              <a href={appHref('companies/japan')}>日本の製粉会社一覧 →</a>
              <a href={appHref('compare')}>製粉会社ランキング →</a>
              <a href={appHref('mills')}>製粉工場一覧 →</a>
            </div>
          </section>
        </>
      )}

      <div className="equipment-cta-banner" style={{margin: '28px 0 16px'}}>
        <div>
          <h3>採用情報・求人掲載の更新リクエスト・お問い合わせ</h3>
          <p>製粉各社の最新の採用情報や募集要項の掲載・修正リクエストを受け付けています。</p>
        </div>
        <a className="equipment-cta-button" href={appHref('contact')}>
          採用情報リクエスト・お問い合わせ窓口へ →
        </a>
      </div>

      <p className="career-disclaimer">
        ※本サイトの情報は公開データに基づくキュレーションです。最新の求人募集状況は必ず各社の公式ページでご確認ください。
      </p>
    </section>
  );
}
