import { ingest, type Job, type Result, type Store, type Summary } from './hiringCore';
import { collectSource } from './hiringFetch';
import { hiringSources } from './hiringSources';
import { categories, jstDay, validDay } from './hiringRules';

// Legacy AppDeploy SDK fallback for non-AppDeploy environments (Vercel)
let db: any = {
  async list() { return { items: [] }; },
  async add() { return []; },
  async update() { return []; },
};

try {
  const sdk = await import('@appdeploy/sdk');
  db = sdk.db;
} catch {
  // @appdeploy/sdk is legacy, default stub used
}

const prefix = 'mi-hiring-v1:';
const rowIds = new Map<string, string | null>();

// One logical row per deterministic partition, using the SDK's actual generated row ID.
// Only the platform cron writes. No public mutation route is exposed.
export const hiringStore: Store = {
  async read<T>(key: string) {
    const { items } = await db.list<T>(prefix + key, { limit: 2 });
    if (items.length > 1) throw Error('Duplicate storage partition; operator reconciliation required: ' + key);
    rowIds.set(key, items[0]?.id || null);
    return (items[0] as T) || null;
  },
  async write(key: string, record: Record<string, unknown>) {
    const clean = { ...record };
    delete clean.id;
    if (Buffer.byteLength(JSON.stringify(clean)) > 220000) throw Error('Hiring record exceeds safe byte limit: ' + key);
    if (!rowIds.has(key)) await hiringStore.read(key);
    const rowId = rowIds.get(key);
    if (rowId) {
      const [ok] = await db.update(prefix + key, [{ id: rowId, record: clean }]);
      if (!ok) throw Error('Hiring storage update failed: ' + key);
    } else {
      const [id] = await db.add(prefix + key, [clean]);
      if (!id) throw Error('Hiring storage insert failed: ' + key);
      rowIds.set(key, id);
    }
  },
};

export async function migrateHiring(store = hiringStore) {
  const version = await store.read<{ version: number }>('schema');
  if (version && version.version !== 1) throw Error('Unsupported hiring schema');
  if (!version)
    await store.write('schema', {
      version: 1,
      applied_at: new Date().toISOString(),
      timezone: 'Asia/Tokyo',
      timestamp_format: 'UTC ISO8601',
      migration: '001-additive-hiring-history',
    });
}

type Month = { days: Record<string, Record<string, Summary>> };

export async function runHiring(now: string, store = hiringStore, collector = collectSource) {
  await migrateHiring(store);
  const day = jstDay(now);
  const summaries: Summary[] = [];
  const failures: string[] = [];
  // Each source has durable acquisition, ingestion, commit and aggregate checkpoints.
  for (const source of hiringSources) {
    try {
      let summary = await store.read<Summary>('commit:' + source.id + ':' + day);
      if (!summary) {
        const acquisitionKey = 'acquisition:' + source.id + ':' + day;
        let saved = await store.read<{ result: Result; observed_at: string }>(acquisitionKey);
        if (!saved) {
          saved = { result: await collector(source), observed_at: new Date().toISOString() };
          if (jstDay(saved.observed_at) !== day) throw Error('Collection crossed JST day; next run will collect new day');
          await store.write(acquisitionKey, saved);
        }
        summary = await ingest(store, source, saved.result, saved.observed_at);
      }
      summaries.push(summary);
      const key = 'month:' + day.slice(0, 7) + ':' + (hiringSources.indexOf(source) % 4);
      const month = (await store.read<Month>(key)) || { days: {} };
      month.days[day] = { ...month.days[day], [source.id]: summary };
      await store.write(key, month);
      console.log(JSON.stringify({ event: 'hiring_source', source: source.id, day, status: summary.status, observed: summary.observed }));
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown storage failure';
      failures.push(source.id + ': ' + message);
      console.error(JSON.stringify({ event: 'hiring_failure', source: source.id, day, message }));
      // Quota exceptions must propagate rather than be hidden or retried.
      if (/429|AppDatabaseQuotaExceeded/.test(message)) throw e;
    }
  }
  await store.write('latest', { day, checked_at: new Date().toISOString(), summaries, failures });
  if (failures.length) throw Error('Hiring checkpoints retained: ' + failures.join('; '));
  return { statusCode: 200 };
}

export async function hiringHistory(query: Record<string, string>, store = hiringStore) {
  const today = jstDay(new Date().toISOString());
  const day = query.date || today;
  const year = query.year || day.slice(0, 4);
  if (!validDay(day) || day > today || !/^\d{4}$/.test(year) || Number(year) < 2026 || Number(year) > Number(today.slice(0, 4)))
    throw Error('Invalid date/year');
  if (query.company && !hiringSources.some((s) => s.company_id === query.company)) throw Error('Unknown company');
  const monthKeys = Array.from({ length: 12 }, (_, i) => year + '-' + String(i + 1).padStart(2, '0')).filter((m) => m <= today.slice(0, 7));
  const months: Month[] = [];
  for (const month of monthKeys) {
    for (let shard = 0; shard < 4; shard++) months.push((await store.read<Month>('month:' + month + ':' + shard)) || { days: {} });
  }
  const joined: Month = { days: {} };
  for (const month of months) for (const [date, sources] of Object.entries(month.days)) joined.days[date] = { ...joined.days[date], ...sources };
  const all = Object.entries(joined.days)
    .map(([date, sources]) => ({ date, sources: Object.values(sources).filter((s) => !query.company || s.company_id === query.company) }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const trend = all.map((d) => {
    const known = d.sources.filter((s) => s.observed !== null);
    return {
      date: d.date,
      observed: known.length ? known.reduce((n, s) => n + s.observed!, 0) : null,
      confirmed_sources: known.length,
      complete_sources: known.filter((s) => s.complete).length,
      first_observed: known.reduce((n, s) => n + s.first_observed, 0),
      categories: Object.fromEntries(categories.map((c) => [c, known.length ? known.reduce((n, s) => n + (s.categories[c] || 0), 0) : null])),
    };
  });
  const latest = await store.read<{ day: string; summaries: Summary[]; failures: string[] }>('latest');
  const selected = (query.date ? all.find((d) => d.date === day)?.sources : latest?.summaries?.filter((s) => !query.company || s.company_id === query.company)) || [];
  const sources = hiringSources
    .filter((s) => !query.company || s.company_id === query.company)
    .map((s) => {
      const summary = selected.find((x) => x.source === s.id);
      return { id: s.id, company_id: s.company_id, company: s.company, url: s.url, summary: summary || null, stale: !summary || Date.now() - Date.parse(summary.checked_at) > 30 * 3600000 };
    });
  const actualDay = query.date ? day : latest?.day || day;
  let jobs: Job[] = [];
  let nextPage: number | null = null;
  const page = Number(query.page || 0);
  if (!Number.isInteger(page) || page < 0 || page > 15) throw Error('Invalid page');
  if (query.company) {
    const src = hiringSources.find((s) => s.company_id === query.company)!;
    const commit = await store.read<Summary>('commit:' + src.id + ':' + actualDay);
    if (commit) {
      jobs = (await store.read<{ jobs: Job[] }>('observations:' + src.id + ':' + actualDay + ':' + page))?.jobs || [];
      if ((page + 1) * 25 < (commit.observed || 0)) nextPage = page + 1;
    }
  }
  const annual = all.reduce((n, d) => n + d.sources.reduce((v, s) => v + s.first_observed, 0), 0);
  const monthly = all.filter((d) => d.date.startsWith(day.slice(0, 7))).reduce((n, d) => n + d.sources.reduce((v, s) => v + s.first_observed, 0), 0);
  const annualUnique = all.reduce((n, d) => n + d.sources.reduce((v, s) => v + (s.annual_unique_additions || 0), 0), 0);
  let currentJob: Job | null = null;
  if (query.job) {
    if (!/^[a-f0-9]{64}$/.test(query.job)) throw Error('Invalid job');
    currentJob = await store.read<Job>('job:' + query.job);
    if (currentJob && query.company && currentJob.company_id !== query.company) throw Error('Invalid job company');
  }
  return {
    schema_version: 1,
    timezone: 'Asia/Tokyo',
    schedule: '毎朝6:15 JST',
    observed_day: actualDay,
    year,
    sources,
    jobs,
    current_job: currentJob,
    next_page: nextPage,
    trend,
    annual_unique_observed: annualUnique,
    annual_first_observed: annual,
    monthly_first_observed: monthly,
    failures: latest?.failures || [],
    definitions: {
      observed: '公式一覧で観測できた固有求人件数。募集人数ではありません。',
      annual: '当年に初めて観測した固有求人。掲載年とは異なり、初回収録を含みます。',
      missing: '未確認や取得失敗は0件に含めません。',
      inactive: '完全な一覧で別々の3日間・48時間以上不在を確認。掲載終了の推定であり採用成立の証明ではありません。',
    },
  };
}
