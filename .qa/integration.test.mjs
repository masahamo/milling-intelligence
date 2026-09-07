// tests/hiring-integration.test.ts
import test from "node:test";
import assert from "node:assert/strict";

// .qa/sdk-mock.ts
var db = new Proxy({}, { get() {
  throw Error("Unexpected real SDK access in local test");
} });

// backend/hiringCore.ts
import { createHash } from "node:crypto";

// backend/hiringRules.ts
var classificationVersion = "2026-09-07.1";
var categories = ["Production / Operations", "Engineering", "Maintenance", "Project / CapEx", "Milling", "Quality", "R&D / Product Development", "Supply Chain / Logistics", "Procurement", "Sales", "Finance", "IT / Digital", "Management", "HR", "Other"];
var rules = [
  ["Project / CapEx", /\b(capex|project (engineer|manager)|commissioning|capital project)\b|設備投資|建設|プロジェクト/i],
  ["Maintenance", /\b(maintenance|mechanic|electrician|millwright|reliability|onderhoud|instandhaltung)\b|保全|保守/i],
  ["R&D / Product Development", /\b(r\s*&\s*d|research|scientist|product development|innovation)\b|研究|商品開発/i],
  ["Quality", /\b(quality|laboratory|lab technician|food safety|qualit[eyé]|hse|ehs)\b|品質|検査|安全衛生/i],
  ["Engineering", /\b(engineer\w*|automation|controls|technical services|technicien|ing[ée]nieur)\b|エンジニア|生産技術|自動化|設備/i],
  ["Milling", /\b(miller|milling|meunier|m[üu]ller)\b|製粉/i],
  ["Procurement", /\b(procurement|purchasing|buyer|inkoop)\b|購買|調達/i],
  ["Supply Chain / Logistics", /\b(supply chain|logistics|warehouse|driver|transport|shipping|grain handling)\b|物流|倉庫|出荷/i],
  ["IT / Digital", /\b(it|digital|software|data (engineer|scientist|analyst)|cyber|systems administrator)\b|情報システム/i],
  ["HR", /\b(hr|human resources|recruit\w*|talent)\b|人事|採用/i],
  ["Finance", /\b(financ\w*|account\w*|treasury|controller|payroll)\b|財務|経理/i],
  ["Sales", /\b(sales|marketing|commercial|business development)\b|営業/i],
  ["Production / Operations", /\b(production|operations?|manufactur\w*|operator|packaging|utility|process|harvest)\b|製造|生産|包装/i],
  ["Management", /\b(manager|director|head|president|chief|supervisor|lead)\b|管理職|経営/i]
];
var normalizeTitle = (value) => value.normalize("NFKC").toLowerCase().replace(/[–—]/g, "-").replace(/\s*\((?:m\/f\/\w|f\/m\/\w)\)\s*/g, " ").replace(/\s+/g, " ").trim();
var classify = (title) => rules.find(([, pattern]) => pattern.test(title))?.[0] || "Other";
function validDay(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
function jstDay(instant) {
  if (!Number.isFinite(Date.parse(instant))) throw Error("Invalid timestamp");
  return new Date(Date.parse(instant) + 9 * 36e5).toISOString().slice(0, 10);
}
function postingDate(value, observed) {
  if (typeof value !== "string") return null;
  if (validDay(value)) return value <= jstDay(observed) ? value : null;
  if (/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) && validDay(value.slice(0, 10)) && Number.isFinite(Date.parse(value)) && Date.parse(value) <= Date.parse(observed)) return new Date(value).toISOString();
  return null;
}
function countryRegion(country) {
  if (!country) return null;
  if (["Canada", "United States", "U.S.", "United States of America", "CA", "US"].includes(country)) return "North America";
  if (["Australia", "AU", "New Zealand", "NZ"].includes(country)) return "Oceania";
  if (["Japan", "JP", "China", "CN", "India", "IN"].includes(country)) return "Asia";
  if (["Austria", "Belgium", "France", "Germany", "Italy", "United Kingdom", "Netherlands", "Poland", "Czech Republic", "Switzerland", "T\xFCrkiye", "AT", "BE", "FR", "DE", "IT", "GB", "NL", "PL", "CZ", "CH", "TR"].includes(country)) return "Europe";
  return null;
}

// backend/hiringCore.ts
var digest = (s) => createHash("sha256").update(s).digest("hex");
function canonical(raw, source, now) {
  if (!raw || typeof raw.title !== "string" || !raw.title.trim() || raw.title.length > 500) throw Error("Malformed job title");
  const url = new URL(raw.url);
  if (url.protocol !== "https:" || url.username || url.password) throw Error("Invalid public job URL");
  for (const v of [raw.identifier, raw.location, raw.country]) if (v !== void 0 && v !== null && (typeof v !== "string" || v.length > 500)) throw Error("Malformed job field");
  const title = raw.title.normalize("NFKC").replace(/\s+/g, " ").trim();
  const location = raw.location?.normalize("NFKC").replace(/\s+/g, " ").trim() || null;
  const id = raw.identifier?.trim() || null;
  if (!id && !location) throw Error("No stable identifier or location");
  const normalized = normalizeTitle(title);
  const key = digest(JSON.stringify([source.company_id, id ? "id" : "fallback", id || normalized, ...id ? [] : [normalizeTitle(location)]]));
  const metadata = { ...raw.metadata, published_raw: raw.published || null };
  if (Buffer.byteLength(JSON.stringify(metadata)) > 12e3) throw Error("Job metadata exceeds bound");
  return { job_key: key, company: source.company, company_id: source.company_id, mill_id: null, title, normalized_title: normalized, title_raw: raw.title, location, country: raw.country || null, region: countryRegion(raw.country || null), category: classify(title), classification_version: classificationVersion, source: source.id, source_url: url.href, job_identifier: id, posting_date: postingDate(raw.published, now), first_seen_at: now, last_seen_at: now, checked_at: now, status: "active", active: true, missing_days: [], inactive_at: null, raw_metadata: metadata, created_at: now, updated_at: now };
}
async function ingest(store, source, result, now) {
  const day = jstDay(now), commitKey = "commit:" + source.id + ":" + day;
  const committed = await store.read(commitKey);
  if (committed) return committed;
  const state = await store.read("state:" + source.id) || { active_keys: [] };
  if (state.last_day && state.last_day > day) throw Error("Out-of-order observation");
  if (result.jobs.length > 400) throw Error("Source exceeds bounded run size");
  const incoming = /* @__PURE__ */ new Map();
  for (const raw of result.jobs) {
    const job = canonical(raw, source, now);
    const prior = incoming.get(job.job_key);
    if (prior && JSON.stringify([prior.title, prior.location]) !== JSON.stringify([job.title, job.location])) throw Error("Conflicting duplicate identifier");
    incoming.set(job.job_key, job);
  }
  const active = new Set(state.active_keys);
  const stats = { company_id: source.company_id, company: source.company, source: source.id, date: day, checked_at: now, status: result.status, complete: result.complete, observed: result.status === "ok" || result.status === "partial" ? incoming.size : null, active: null, first_observed: 0, baseline: 0, new_after_baseline: 0, annual_unique_additions: 0, monthly_unique_additions: 0, categories: Object.fromEntries(categories.map((c) => [c, 0])), countries: {}, message: result.message };
  const observations = [];
  for (const next of incoming.values()) {
    const old = await store.read("job:" + next.job_key);
    if (old && Date.parse(old.last_seen_at) > Date.parse(now)) throw Error("Out-of-order job observation");
    const job = { ...next, first_seen_at: old?.first_seen_at || now, created_at: old?.created_at || now, posting_date: next.posting_date || old?.posting_date || null };
    const year = day.slice(0, 4), month = day.slice(0, 7);
    job.year_first_observation = { ...old?.year_first_observation, [year]: old?.year_first_observation?.[year] || day };
    job.month_first_observation = { ...old?.month_first_observation, [month]: old?.month_first_observation?.[month] || day };
    if (job.year_first_observation[year] === day) stats.annual_unique_additions++;
    if (job.month_first_observation[month] === day) stats.monthly_unique_additions++;
    if (jstDay(job.first_seen_at) === day) {
      stats.first_observed++;
      if (!state.last_success_at) stats.baseline++;
      else stats.new_after_baseline++;
    }
    await store.write("job:" + job.job_key, job);
    active.add(job.job_key);
    observations.push(job);
    stats.categories[job.category]++;
    const country = job.country || "Unknown";
    stats.countries[country] = (stats.countries[country] || 0) + 1;
  }
  if (result.complete && result.status === "ok") {
    for (const key of state.active_keys) {
      if (incoming.has(key)) continue;
      const job = await store.read("job:" + key);
      if (!job) throw Error("Missing active job checkpoint");
      const missing = [.../* @__PURE__ */ new Set([...job.missing_days, day])].sort().slice(-3);
      const inactive = missing.length >= 3 && Date.parse(day) - Date.parse(missing[0]) >= 2 * 864e5;
      await store.write("job:" + key, { ...job, missing_days: missing, checked_at: now, updated_at: now, active: !inactive, status: inactive ? "inactive" : "active", inactive_at: inactive ? now : null });
      if (inactive) active.delete(key);
    }
  }
  if (active.size > 1200) throw Error("Active index exceeds bound; investigate source");
  stats.active = state.last_success_at || stats.observed !== null ? active.size : null;
  for (let i = 0; i < observations.length; i += 25) await store.write("observations:" + source.id + ":" + day + ":" + i / 25, { schema_version: 1, jobs: observations.slice(i, i + 25) });
  const prepared = await store.read("prepared:" + source.id + ":" + day);
  const final = prepared || stats;
  await store.write("prepared:" + source.id + ":" + day, final);
  await store.write("state:" + source.id, { ...state, active_keys: [...active], last_day: day, last_success_at: stats.observed !== null ? now : state.last_success_at || null, status: result.status, message: result.message, checked_at: now, observation_count: stats.observed });
  await store.write(commitKey, final);
  return final;
}

// backend/hiringFetch.ts
var obj = (v) => v && typeof v === "object" && !Array.isArray(v) ? v : {};
var str = (v) => typeof v === "string" ? v : "";
var text = (s) => s.replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/&nbsp;|&#160;/g, " ").replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();
async function getPublic(url, init = {}) {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(18e3), headers: { "User-Agent": "MillingIntelligence/1.0 (public job history)", ...init.headers } });
  if (!response.ok) throw Error("Source HTTP " + response.status);
  if (Number(response.headers.get("content-length")) > 2e6) throw Error("Source too large");
  const reader = response.body?.getReader();
  if (!reader) throw Error("Source body missing");
  let size = 0;
  const decoder = new TextDecoder();
  let body = "";
  for (; ; ) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 2e6) {
      await reader.cancel();
      throw Error("Source too large");
    }
    body += decoder.decode(value, { stream: true });
  }
  body += decoder.decode();
  if (!body.trim()) throw Error("Empty source response");
  return body;
}
function parseEasyApply(html, source) {
  if (!html.includes("Current Job Openings") || !html.includes("Rogers Foods")) throw Error("Unrecognized company listing");
  const jobs = [];
  for (const match of html.matchAll(/<h5\b[^>]*>([\s\S]*?)<\/h5>([\s\S]*?)(?=<h5\b|<div id="pagination")/g)) {
    const a = match[1].match(/<a\b[^>]*href="(https:\/\/easyapply\.co\/job\/[^"?#]+)"[^>]*>([\s\S]*?)<\/a>/);
    const location = match[2].match(/fa-map-marker[^>]*><\/i>([\s\S]*?)<\/span>/);
    if (!a || !location) throw Error("Malformed listing entry");
    jobs.push({ title: text(a[2]), url: a[1], identifier: new URL(a[1]).pathname, location: text(location[1]), country: source.country || null, metadata: { adapter: "easyapply", evidence: "official ATS listing" } });
  }
  const nextDisabled = /<li class="page-item disabled">\s*<a[^>]*aria-label="Next"/.test(html);
  if (!jobs.length) return { jobs: [], complete: false, status: "unverified", message: "\u6C42\u4EBA\u4E00\u89A7\u306E\u4EF6\u6570\u3092\u78BA\u5B9A\u3067\u304D\u307E\u305B\u3093\u30020\u4EF6\u3068\u306F\u6271\u3044\u307E\u305B\u3093\u3002" };
  return { jobs, complete: nextDisabled, status: nextDisabled ? "ok" : "partial", message: nextDisabled ? "\u516C\u5F0FATS\u4E00\u89A7\u3092\u5168\u30DA\u30FC\u30B8\u78BA\u8A8D" : "\u8FFD\u52A0\u30DA\u30FC\u30B8\u304C\u3042\u308B\u305F\u3081\u90E8\u5206\u89B3\u6E2C\u3002\u7D42\u4E86\u5224\u5B9A\u3092\u505C\u6B62\u3002" };
}
function parseJsonLd(html, source) {
  const jobs = [];
  const walk = (value, depth = 0) => {
    if (depth > 12) return;
    if (Array.isArray(value)) {
      value.forEach((v) => walk(v, depth + 1));
      return;
    }
    const row = obj(value);
    if (row["@type"] === "JobPosting" || Array.isArray(row["@type"]) && row["@type"].includes("JobPosting")) {
      const locs = Array.isArray(row.jobLocation) ? row.jobLocation : [row.jobLocation];
      const address = obj(obj(locs[0]).address);
      const identifier = obj(row.identifier);
      const country = str(address.addressCountry) || str(obj(address.addressCountry).name) || null;
      const raw = { title: str(row.title), identifier: str(identifier.value) || str(row.identifier) || null, url: str(row.url) || source.url, location: [address.addressLocality, address.addressRegion].filter((v) => typeof v === "string").join(", ") || null, country, published: str(row.datePosted) || null, metadata: { adapter: "jsonld", datePosted: row.datePosted || null, employmentType: row.employmentType || null, locationCount: locs.length } };
      jobs.push(raw);
      return;
    }
    Object.values(row).forEach((v) => {
      if (v && typeof v === "object") walk(v, depth + 1);
    });
  };
  for (const m of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      walk(JSON.parse(m[1]));
    } catch {
      throw Error("Malformed structured job data");
    }
  }
  return { jobs, complete: false, status: jobs.length ? "partial" : "unverified", message: jobs.length ? "\u516C\u958B\u69CB\u9020\u5316\u6C42\u4EBA\u3092\u90E8\u5206\u89B3\u6E2C\u3002\u5168\u4EF6\u6570\u30FB\u7D42\u4E86\u306F\u672A\u5224\u5B9A\u3002" : "\u63A1\u7528\u5165\u53E3\u3092\u78BA\u8A8D\u3002\u4E00\u89A7\u3092\u53D6\u5F97\u3067\u304D\u305A\u3001\u6C42\u4EBA\u6570\u306F\u672A\u78BA\u8A8D\u3002" };
}
async function collectWorkday(source, request = getPublic) {
  const base = new URL(source.url).origin + "/wday/cxs/" + source.tenant + "/" + source.site;
  let total = null;
  const postings = [];
  for (let offset = 0; offset < 400; offset += 20) {
    const page = obj(JSON.parse(await request(base + "/jobs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ appliedFacets: {}, limit: 20, offset, searchText: "" }) })));
    if (!Number.isInteger(page.total) || Number(page.total) < 0 || !Array.isArray(page.jobPostings)) throw Error("Malformed Workday response");
    if (total !== null && page.total !== 0 && total !== page.total) throw Error("Listing changed during pagination");
    if (total === null) total = Number(page.total);
    if (total > 400) throw Error("Workday count exceeds run bound");
    postings.push(...page.jobPostings.map(obj));
    if (postings.length >= total) break;
    if (!page.jobPostings.length) throw Error("Incomplete Workday pagination");
  }
  if (total === null || postings.length !== total) throw Error("Workday count mismatch");
  if (total > 20) {
    const check = obj(JSON.parse(await request(base + "/jobs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ appliedFacets: {}, limit: 20, offset: 0, searchText: "" }) })));
    if (check.total !== total || JSON.stringify(check.jobPostings) !== JSON.stringify(postings.slice(0, 20))) throw Error("Listing changed during pagination");
  }
  const ids = /* @__PURE__ */ new Set();
  const jobs = [];
  for (const p of postings) {
    const id = Array.isArray(p.bulletFields) ? str(p.bulletFields[0]) : "";
    const path = str(p.externalPath);
    if (!id || !path.startsWith("/job/") || ids.has(id)) throw Error("Invalid or duplicate Workday identifier");
    ids.add(id);
    let detail = {};
    try {
      detail = obj(obj(JSON.parse(await request(base + path))).jobPostingInfo);
    } catch {
    }
    const location = str(detail.location) || str(p.locationsText) || null;
    const country = str(obj(detail.country).descriptor) || str(detail.country) || null;
    jobs.push({ title: str(p.title), identifier: id, location, country, url: new URL(source.url).origin + "/" + source.site + path, published: str(detail.startDate) || null, metadata: { adapter: "workday", postedOn: p.postedOn || null, startDate: detail.startDate || null, locationsText: p.locationsText || null, additionalLocations: detail.additionalLocations || null, detail_confirmed: !!detail.title } });
  }
  return { jobs, complete: true, status: "ok", message: "\u516C\u5F0FWorkday\u4E00\u89A7\u306E\u5168" + total + "\u4EF6\u3092\u78BA\u8A8D" };
}
async function collectSource(source) {
  try {
    if (source.adapter === "workday") return await collectWorkday(source);
    const html = await getPublic(source.url);
    return source.adapter === "easyapply" ? parseEasyApply(html, source) : parseJsonLd(html, source);
  } catch (e) {
    return { jobs: [], complete: false, status: "unavailable", message: (e instanceof Error ? e.message : "Source unavailable").slice(0, 180) };
  }
}

// backend/hiringSources.ts
var hiringSources = [{ "id": "2002", "company_id": "2002", "company": "\u65E5\u6E05\u88FD\u7C89\u30B0\u30EB\u30FC\u30D7\u672C\u793E", "url": "https://www.nisshin-recruit.com/", "adapter": "jsonld" }, { "id": "2001", "company_id": "2001", "company": "\u30CB\u30C3\u30D7\u30F3", "url": "https://www.nippn.co.jp/recruit/career/", "adapter": "jsonld" }, { "id": "2004", "company_id": "2004", "company": "\u662D\u548C\u7523\u696D", "url": "https://www.showa-sangyo.co.jp/saiyo/", "adapter": "jsonld" }, { "id": "2003", "company_id": "2003", "company": "\u65E5\u6771\u5BCC\u58EB\u88FD\u7C89", "url": "https://www.nittofuji.co.jp/re/technical.html", "adapter": "jsonld" }, { "id": "ADM", "company_id": "ADM", "company": "ADM", "url": "https://www.adm.com/en-us/culture-and-careers/join-team-adm/", "adapter": "jsonld" }, { "id": "BG", "company_id": "BG", "company": "Bunge", "url": "https://www.bunge.com/find-jobs", "adapter": "jsonld" }, { "id": "CAG", "company_id": "CAG", "company": "Conagra Brands", "url": "https://careers.conagrabrands.com/", "adapter": "jsonld" }, { "id": "GNC", "company_id": "GNC", "company": "GrainCorp", "url": "https://jobs.graincorp.com.au/", "adapter": "jsonld" }, { "id": "GIS", "company_id": "GIS", "company": "General Mills", "url": "https://www.careers.generalmills.com/", "adapter": "jsonld" }, { "id": "MDLZ", "company_id": "MDLZ", "company": "Mondel\u0113z International", "url": "https://www.mondelezinternational.com/careers/jobs/", "adapter": "jsonld" }, { "id": "ardent", "company_id": "ardent", "company": "Ardent Mills", "url": "https://ardentmills.wd5.myworkdayjobs.com/Ardent_Mills_LLC", "adapter": "workday", "tenant": "ardentmills", "site": "Ardent_Mills_LLC" }, { "id": "ph", "company_id": "ph", "company": "P&H Milling Group", "url": "https://parrishandheimbecker.com/company/careers/current-opportunities/", "adapter": "jsonld" }, { "id": "miller", "company_id": "miller", "company": "Miller Milling", "url": "https://millermilling.com/careers/", "adapter": "jsonld" }, { "id": "allied", "company_id": "allied", "company": "Allied Pinnacle", "url": "https://alliedpinnacle.com/people-careers/work-with-us/", "adapter": "jsonld" }, { "id": "graincraft", "company_id": "graincraft", "company": "Grain Craft", "url": "https://www.graincraft.com/careers/", "adapter": "jsonld" }, { "id": "manildra", "company_id": "manildra", "company": "Manildra Group", "url": "https://www.manildra.com.au/careers/", "adapter": "jsonld" }, { "id": "rogers", "company_id": "rogers", "company": "Rogers Foods", "url": "https://rogersfoodsltd.easyapply.co/", "adapter": "easyapply", "country": "Canada" }, { "id": "goodmills", "company_id": "goodmills", "company": "GoodMills Group", "url": "https://www.goodmills.com/people/", "adapter": "jsonld" }, { "id": "dossche", "company_id": "dossche", "company": "Dossche Mills", "url": "https://www.dosschemills.com/en/jobs", "adapter": "jsonld" }, { "id": "moulins-soufflet", "company_id": "moulins-soufflet", "company": "Moulins Soufflet", "url": "https://invivo-recrute.talent-soft.com/Pages/Offre/ListeOffre.aspx?LCID=2057&changefacet=1&facet_Entity=691&mode=list", "adapter": "jsonld" }, { "id": "whitworth", "company_id": "whitworth", "company": "Whitworth Bros. Ltd.", "url": "https://whitworthbros.ltd.uk/join-us/current-vacancies/", "adapter": "jsonld" }, { "id": "KYLO", "company_id": "KYLO", "company": "Loulis Food Ingredients", "url": "https://www.loulis.com/en/careers/job-openings/", "adapter": "jsonld" }, { "id": "GMI", "company_id": "GMI", "company": "Groupe Minoteries SA", "url": "https://www.gmsa.ch/de/karriere/", "adapter": "jsonld" }];
hiringSources.push({ "id": "iisaka", "company_id": "iisaka", "company": "\u98EF\u5742\u88FD\u7C89", "url": "https://www.iisaka.co.jp/saiyou.html", "adapter": "jsonld" }, { "id": "odazo", "company_id": "odazo", "company": "\u5C0F\u7530\u8C61\u88FD\u7C89", "url": "https://odazo-saiyou.com/saiyou/", "adapter": "jsonld" }, { "id": "kintobi", "company_id": "kintobi", "company": "\u91D1\u30C8\u30D3\u5FD7\u8CC0", "url": "https://kintobi.com/recruit", "adapter": "jsonld" });
hiringSources.push({ "id": "nikkoku", "company_id": "nikkoku", "company": "\u65E5\u7A40\u88FD\u7C89", "url": "https://www.nikkoku.co.jp/recruit/entry/", "adapter": "jsonld" }, { "id": "asahi-jp", "company_id": "asahi-jp", "company": "\u65ED\u88FD\u7C89", "url": "https://recruit.konaya.biz/guideline", "adapter": "jsonld" }, { "id": "chiba-flour", "company_id": "chiba-flour", "company": "\u5343\u8449\u88FD\u7C89", "url": "https://www.chiba-seifun.co.jp/recruit/", "adapter": "jsonld" }, { "id": "2009", "company_id": "2009", "company": "\u9CE5\u8D8A\u88FD\u7C89", "url": "https://www.the-torigoe.co.jp/recruit/", "adapter": "jsonld" }, { "id": "kinki", "company_id": "kinki", "company": "\u8FD1\u757F\u88FD\u7C89", "url": "https://kinkiseifun.jp/recruit/", "adapter": "jsonld" }, { "id": "hoshino", "company_id": "hoshino", "company": "\u661F\u91CE\u7269\u7523", "url": "https://www.hoshinet.co.jp/recruit/", "adapter": "jsonld" }, { "id": "yokoyama", "company_id": "yokoyama", "company": "\u6A2A\u5C71\u88FD\u7C89", "url": "https://y-fm.jp/company/", "adapter": "jsonld" }, { "id": "karakida", "company_id": "karakida", "company": "\u67C4\u6728\u7530\u88FD\u7C89", "url": "https://karakida.co.jp/company/recruit/", "adapter": "jsonld" }, { "id": "marusho", "company_id": "marusho", "company": "\u4E38\u6B63\u88FD\u7C89", "url": "https://marushof.co.jp/recruitment/", "adapter": "jsonld" }, { "id": "okinawa", "company_id": "okinawa", "company": "\u6C96\u7E04\u88FD\u7C89", "url": "https://recruit.jobcan.jp/okifun/", "adapter": "jsonld" }, { "id": "kumamoto", "company_id": "kumamoto", "company": "\u718A\u672C\u88FD\u7C89", "url": "https://www.bears-k.co.jp/recruit/", "adapter": "jsonld" }, { "id": "riken", "company_id": "riken", "company": "\u7406\u7814\u8FB2\u7523\u5316\u5DE5", "url": "https://www.riken-nosan.com/saiyo/", "adapter": "jsonld" });
hiringSources.push({ "id": "buhler", "company_id": "buhler", "company": "B\xFChler", "url": "https://jobs.buhlergroup.com/", "adapter": "jsonld" }, { "id": "omas", "company_id": "omas", "company": "Omas", "url": "https://omasindustries.com/en/working-in-omas/", "adapter": "jsonld" }, { "id": "ocrim", "company_id": "ocrim", "company": "Ocrim", "url": "https://www.ocrim.com/en/work-with-us/", "adapter": "jsonld" }, { "id": "satake", "company_id": "satake", "company": "Satake", "url": "https://www.satake-japan.co.jp/recruit/", "adapter": "jsonld" }, { "id": "alapala", "company_id": "alapala", "company": "Alapala", "url": "https://alapala.com/en/job-opportunities-at-alapala/", "adapter": "jsonld" });

// backend/hiring.ts
var prefix = "mi-hiring-v1:";
var rowIds = /* @__PURE__ */ new Map();
var hiringStore = {
  async read(key) {
    const { items } = await db.list(prefix + key, { limit: 2 });
    if (items.length > 1) throw Error("Duplicate storage partition; operator reconciliation required: " + key);
    rowIds.set(key, items[0]?.id || null);
    return items[0] || null;
  },
  async write(key, record) {
    const clean = { ...record };
    delete clean.id;
    if (Buffer.byteLength(JSON.stringify(clean)) > 22e4) throw Error("Hiring record exceeds safe byte limit: " + key);
    if (!rowIds.has(key)) await hiringStore.read(key);
    const rowId = rowIds.get(key);
    if (rowId) {
      const [ok] = await db.update(prefix + key, [{ id: rowId, record: clean }]);
      if (!ok) throw Error("Hiring storage update failed: " + key);
    } else {
      const [id] = await db.add(prefix + key, [clean]);
      if (!id) throw Error("Hiring storage insert failed: " + key);
      rowIds.set(key, id);
    }
  }
};
async function migrateHiring(store = hiringStore) {
  const version = await store.read("schema");
  if (version && version.version !== 1) throw Error("Unsupported hiring schema");
  if (!version) await store.write("schema", { version: 1, applied_at: (/* @__PURE__ */ new Date()).toISOString(), timezone: "Asia/Tokyo", timestamp_format: "UTC ISO8601", migration: "001-additive-hiring-history" });
}
async function runHiring(now, store = hiringStore, collector = collectSource) {
  await migrateHiring(store);
  const day = jstDay(now);
  const summaries = [];
  const failures = [];
  for (const source of hiringSources) {
    try {
      let summary = await store.read("commit:" + source.id + ":" + day);
      if (!summary) {
        const acquisitionKey = "acquisition:" + source.id + ":" + day;
        let saved = await store.read(acquisitionKey);
        if (!saved) {
          saved = { result: await collector(source), observed_at: (/* @__PURE__ */ new Date()).toISOString() };
          if (jstDay(saved.observed_at) !== day) throw Error("Collection crossed JST day; next run will collect new day");
          await store.write(acquisitionKey, saved);
        }
        summary = await ingest(store, source, saved.result, saved.observed_at);
      }
      summaries.push(summary);
      const key = "month:" + day.slice(0, 7) + ":" + hiringSources.indexOf(source) % 4;
      const month = await store.read(key) || { days: {} };
      month.days[day] = { ...month.days[day], [source.id]: summary };
      await store.write(key, month);
      console.log(JSON.stringify({ event: "hiring_source", source: source.id, day, status: summary.status, observed: summary.observed }));
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown storage failure";
      failures.push(source.id + ": " + message);
      console.error(JSON.stringify({ event: "hiring_failure", source: source.id, day, message }));
      if (/429|AppDatabaseQuotaExceeded/.test(message)) throw e;
    }
  }
  await store.write("latest", { day, checked_at: (/* @__PURE__ */ new Date()).toISOString(), summaries, failures });
  if (failures.length) throw Error("Hiring checkpoints retained: " + failures.join("; "));
  return { statusCode: 200 };
}
async function hiringHistory(query, store = hiringStore) {
  const today = jstDay((/* @__PURE__ */ new Date()).toISOString());
  const day = query.date || today;
  const year = query.year || day.slice(0, 4);
  if (!validDay(day) || day > today || !/^\d{4}$/.test(year) || Number(year) < 2026 || Number(year) > Number(today.slice(0, 4))) throw Error("Invalid date/year");
  if (query.company && !hiringSources.some((s) => s.company_id === query.company)) throw Error("Unknown company");
  const monthKeys = Array.from({ length: 12 }, (_, i) => year + "-" + String(i + 1).padStart(2, "0")).filter((m) => m <= today.slice(0, 7));
  const months = [];
  for (const month of monthKeys) {
    for (let shard = 0; shard < 4; shard++) months.push(await store.read("month:" + month + ":" + shard) || { days: {} });
  }
  const joined = { days: {} };
  for (const month of months) for (const [date, sources2] of Object.entries(month.days)) joined.days[date] = { ...joined.days[date], ...sources2 };
  const all = Object.entries(joined.days).map(([date, sources2]) => ({ date, sources: Object.values(sources2).filter((s) => !query.company || s.company_id === query.company) })).sort((a, b) => a.date.localeCompare(b.date));
  const trend = all.map((d) => {
    const known = d.sources.filter((s) => s.observed !== null);
    return { date: d.date, observed: known.length ? known.reduce((n, s) => n + s.observed, 0) : null, confirmed_sources: known.length, complete_sources: known.filter((s) => s.complete).length, first_observed: known.reduce((n, s) => n + s.first_observed, 0), categories: Object.fromEntries(categories.map((c) => [c, known.length ? known.reduce((n, s) => n + (s.categories[c] || 0), 0) : null])) };
  });
  const latest = await store.read("latest");
  const selected = (query.date ? all.find((d) => d.date === day)?.sources : latest?.summaries?.filter((s) => !query.company || s.company_id === query.company)) || [];
  const sources = hiringSources.filter((s) => !query.company || s.company_id === query.company).map((s) => {
    const summary = selected.find((x) => x.source === s.id);
    return { id: s.id, company_id: s.company_id, company: s.company, url: s.url, summary: summary || null, stale: !summary || Date.now() - Date.parse(summary.checked_at) > 30 * 36e5 };
  });
  const actualDay = query.date ? day : latest?.day || day;
  let jobs = [];
  let nextPage = null;
  const page = Number(query.page || 0);
  if (!Number.isInteger(page) || page < 0 || page > 15) throw Error("Invalid page");
  if (query.company) {
    const src = hiringSources.find((s) => s.company_id === query.company);
    const commit = await store.read("commit:" + src.id + ":" + actualDay);
    if (commit) {
      jobs = (await store.read("observations:" + src.id + ":" + actualDay + ":" + page))?.jobs || [];
      if ((page + 1) * 25 < (commit.observed || 0)) nextPage = page + 1;
    }
  }
  const annual = all.reduce((n, d) => n + d.sources.reduce((v, s) => v + s.first_observed, 0), 0);
  const monthly = all.filter((d) => d.date.startsWith(day.slice(0, 7))).reduce((n, d) => n + d.sources.reduce((v, s) => v + s.first_observed, 0), 0);
  const annualUnique = all.reduce((n, d) => n + d.sources.reduce((v, s) => v + (s.annual_unique_additions || 0), 0), 0);
  let currentJob = null;
  if (query.job) {
    if (!/^[a-f0-9]{64}$/.test(query.job)) throw Error("Invalid job");
    currentJob = await store.read("job:" + query.job);
    if (currentJob && query.company && currentJob.company_id !== query.company) throw Error("Invalid job company");
  }
  return { schema_version: 1, timezone: "Asia/Tokyo", schedule: "\u6BCE\u671D6:15 JST", observed_day: actualDay, year, sources, jobs, current_job: currentJob, next_page: nextPage, trend, annual_unique_observed: annualUnique, annual_first_observed: annual, monthly_first_observed: monthly, failures: latest?.failures || [], definitions: { observed: "\u516C\u5F0F\u4E00\u89A7\u3067\u89B3\u6E2C\u3067\u304D\u305F\u56FA\u6709\u6C42\u4EBA\u4EF6\u6570\u3002\u52DF\u96C6\u4EBA\u6570\u3067\u306F\u3042\u308A\u307E\u305B\u3093\u3002", annual: "\u5F53\u5E74\u306B\u521D\u3081\u3066\u89B3\u6E2C\u3057\u305F\u56FA\u6709\u6C42\u4EBA\u3002\u63B2\u8F09\u5E74\u3068\u306F\u7570\u306A\u308A\u3001\u521D\u56DE\u53CE\u9332\u3092\u542B\u307F\u307E\u3059\u3002", missing: "\u672A\u78BA\u8A8D\u3084\u53D6\u5F97\u5931\u6557\u306F0\u4EF6\u306B\u542B\u3081\u307E\u305B\u3093\u3002", inactive: "\u5B8C\u5168\u306A\u4E00\u89A7\u3067\u5225\u3005\u306E3\u65E5\u9593\u30FB48\u6642\u9593\u4EE5\u4E0A\u4E0D\u5728\u3092\u78BA\u8A8D\u3002\u63B2\u8F09\u7D42\u4E86\u306E\u63A8\u5B9A\u3067\u3042\u308A\u63A1\u7528\u6210\u7ACB\u306E\u8A3C\u660E\u3067\u306F\u3042\u308A\u307E\u305B\u3093\u3002" } };
}

// tests/hiring-integration.test.ts
var Memory = class {
  rows = /* @__PURE__ */ new Map();
  async read(key) {
    return structuredClone(this.rows.get(key) || null);
  }
  async write(key, value) {
    this.rows.set(key, structuredClone(value));
  }
};
test("additive migration is idempotent; daily source failures stay isolated; aggregate and history API persist", async () => {
  const store = new Memory();
  store.rows.set("unrelated", { keep: true });
  await migrateHiring(store);
  const migration = await store.read("schema");
  await migrateHiring(store);
  assert.deepEqual(await store.read("schema"), migration);
  assert.deepEqual(await store.read("unrelated"), { keep: true });
  const now = (/* @__PURE__ */ new Date()).toISOString();
  let calls = 0;
  await runHiring(now, store, async (source) => {
    calls++;
    return source.id === "rogers" ? { jobs: [{ identifier: "fixture-1", title: "Maintenance Technician", location: "Armstrong", country: "Canada", url: "https://example.com/job/1" }], complete: true, status: "ok", message: "Fixture" } : { jobs: [], complete: false, status: "unavailable", message: "Simulated source outage" };
  });
  const firstCalls = calls;
  await runHiring(now, store, async () => {
    throw Error("Must use checkpoint");
  });
  assert.equal(calls, firstCalls);
  const all = await hiringHistory({}, store);
  assert.equal(all.trend[0].observed, 1);
  assert.equal(all.trend[0].confirmed_sources, 1);
  assert.equal(all.sources.length, 26);
  const company = await hiringHistory({ company: "rogers", date: jstDay(now) }, store);
  assert.equal(company.jobs.length, 1);
  assert.equal(company.annual_first_observed, 1);
  assert.equal(company.monthly_first_observed, 1);
  assert.equal(company.trend[0].categories.Maintenance, 1);
  assert.equal(company.jobs[0].country, "Canada");
  assert.equal(company.next_page, null);
  await assert.rejects(hiringHistory({ date: "2026-02-30" }, store));
  await assert.rejects(hiringHistory({ company: "unknown" }, store));
  await assert.rejects(hiringHistory({ page: "-1" }, store));
});
