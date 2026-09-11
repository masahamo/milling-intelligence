import fs from "node:fs";
import path from "node:path";

// Milling Intelligence — Enhanced Daily News & Strategic CapEx Watch Script
console.log("Starting Daily Milling Intelligence auto-fetch (2-Layer Engine) at", new Date().toISOString());

const root = process.cwd();
const weeklyFile = path.join(root, "src", "WeeklyNews.tsx");
const capexDataFile = path.join(root, "src", "capexWatchData.ts");
const capexJsonFile = path.join(root, "public", "data", "capex-watch.json");
const crawlStatusFile = path.join(root, "public", "data", "crawl-status.json");
const configFile = path.join(root, "scripts", "news-config.json");

if (!fs.existsSync(configFile)) {
  console.error("news-config.json not found.");
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configFile, "utf8"));
const WATCHED_EQUIPMENT_COMPANIES = config.watchedEquipmentCompanies || [];
const WATCHED_MILLING_COMPANIES = config.watchedMillingCompanies || [];

// Layer A Feeds (Daily News: 5-day window)
const LAYER_A_FEEDS = [
  {
    name: "国内製粉・小麦・政策ニュース",
    url: "https://news.google.com/rss/search?q=%E8%A3%BD%E7%B2%89+%E5%B0%8F%E9%BA%A6&hl=ja&gl=JP&ceid=JP:ja",
    defaultPillar: "原料・品質"
  },
  {
    name: "国内製粉設備・工場新設・プラント",
    url: "https://news.google.com/rss/search?q=%E8%A3%BD%E7%B2%89%E5%B7%A5%E5%A0%B4+OR+%E8%A3%BD%E7%B2%89%E6%A9%9F%E6%A2%B0+OR+(%E5%B0%8F%E9%BA%A6+%E8%A3%BD%E7%B2%89+%E8%A8%AD%E5%82%99)&hl=ja&gl=JP&ceid=JP:ja",
    defaultPillar: "設備投資"
  },
  {
    name: "国内大手製粉・新商品・プレミックス",
    url: "https://news.google.com/rss/search?q=(%E6%97%A5%E6%B8%85%E8%A3%BD%E7%B2%89+OR+%E3%83%8B%E3%83%83%E3%83%97%E3%83%B3+OR+%E6%98%AD%E5%92%8C%E7%94%A3%E6%A5%AD)+AND+(%E5%B0%8F%E9%BA%A6%E7%B2%89+OR+%E3%83%97%E3%83%AC%E3%83%9F%E3%83%83%E3%82%AF%E3%82%B9+OR+%E6%96%B0%E5%95%86%E5%93%81)&hl=ja&gl=JP&ceid=JP:ja",
    defaultPillar: "二次加工・商品"
  },
  {
    name: "Global Flour R&D, Protein, Quality & Blending",
    url: "https://news.google.com/rss/search?q=(%22wheat+flour%22+OR+%22flour+quality%22)+AND+(protein+OR+gluten+OR+enzyme+OR+%22flour+blending%22+OR+fortification+OR+rheology+OR+premix)&hl=en-US&gl=US&ceid=US:en",
    defaultPillar: "二次加工・商品"
  },
  {
    name: "Global Wheat Production & Export Trends",
    url: "https://news.google.com/rss/search?q=(%22wheat+harvest%22+OR+%22wheat+export%22)+AND+(yield+OR+protein+OR+quality+OR+USDA)&hl=en-US&gl=US&ceid=US:en",
    defaultPillar: "原料・品質"
  }
];

// Layer B Feeds (Strategic CapEx Watch: 90-day window)
const LAYER_B_FEEDS = [
  {
    name: "Global Milling Equipment & Machinery (Bühler, Ocrim, Omas, Alapala, etc.)",
    url: "https://news.google.com/rss/search?q=(%22flour+mill%22+OR+%22flour+milling%22)+AND+(Buhler+OR+Ocrim+OR+Omas+OR+Alapala+OR+Satake+OR+%22roller+mill%22+OR+plansifter)&hl=en-US&gl=US&ceid=US:en",
    defaultPillar: "設備投資"
  },
  {
    name: "Global Flour Mill Plant Expansion & Investment",
    url: "https://news.google.com/rss/search?q=(%22flour+mill%22+OR+%22wheat+processing%22)+AND+(investment+OR+expansion+OR+commissioning+OR+%22new+plant%22+OR+CapEx+OR+%22commercial+operation%22)&hl=en-US&gl=US&ceid=US:en",
    defaultPillar: "設備投資"
  },
  ...(config.directSources || [])
];

const EXCLUDE_WORDS = [
  "そば処", "手打ちそば", "十割そば", "蕎麦", "ラーメン屋オープン", "ベーカリー開店",
  "パン屋オープン", "スイーツフェス", "手作りクッキー", "家庭用", "クックパッド",
  "レシピ", "お菓子作り教室", "Halwa", "halwa", "Dessert", "dessert", "How To Make", "how to make", "Gluten-Free"
];

function cleanTitle(raw) {
  return raw
    .replace(/<!\[CDATA\[(.*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();
}

function calculateImportanceScore(item) {
  let score = 0;
  const text = (item.title + " " + (item.body || "")).toLowerCase();

  // +30: 新工場
  if (/new mill|new flour mill|greenfield|新工場|新設/.test(text)) {
    score += 30;
  }
  // +25: 能力増強
  if (/capacity expansion|capacity increase|expansion|new production line|plant expansion|能力増強|増設|増産|新ライン/.test(text)) {
    score += 25;
  }
  // +20: 設備メーカー名あり
  const hasSupplier = WATCHED_EQUIPMENT_COMPANIES.some(eq => text.includes(eq.toLowerCase()));
  if (hasSupplier) {
    score += 20;
  }
  // +20: 具体的な能力値あり (e.g. 600 t/day, 600 tpd)
  if (/\b\d+(?:,\d+)?\s*(?:t\/day|t\/24h|tpd|mt\/day|tonnes per day|tons per day|日産能力|\s*t\/日)\b/i.test(text)) {
    score += 20;
  }
  // +15: 具体的投資額あり
  if (/\b(?:SAR|\$|€|¥|£)\s*\d+|135m|123m|\d+\s*(?:m|million|億)\b/i.test(text)) {
    score += 15;
  }
  // +10: commercial operation / commissioning
  if (/commercial operation|commissioning|稼働開始|商業運転/.test(text)) {
    score += 10;
  }
  // +10: 大手製粉会社
  const hasMillingCompany = WATCHED_MILLING_COMPANIES.some(mc => text.includes(mc.toLowerCase()));
  if (hasMillingCompany) {
    score += 10;
  }

  return Math.min(100, score);
}

function extractCapExMetadata(title, body, url, pubDate) {
  const fullText = `${title} ${body || ""}`;

  // Company
  let company = null;
  for (const mc of WATCHED_MILLING_COMPANIES) {
    const re = new RegExp(`\\b${mc.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}\\b`, "i");
    if (re.test(fullText)) {
      company = mc;
      break;
    }
  }

  // Equipment Supplier
  let equipmentSupplier = null;
  for (const eq of WATCHED_EQUIPMENT_COMPANIES) {
    const re = new RegExp(`\\b${eq.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}\\b`, "i");
    if (re.test(fullText)) {
      equipmentSupplier = eq;
      break;
    }
  }

  // Capacity Added
  let capacityAdded = null;
  const capMatch = fullText.match(/\b(\d+(?:,\d+)?\s*(?:t\/day|t\/24h|tpd|mt\/day|tonnes per day|tons per day))\b/i);
  if (capMatch) {
    capacityAdded = capMatch[1];
  }

  // Total Capacity
  let totalCapacity = null;
  const totalCapMatch = fullText.match(/(?:total capacity|総能力|拠点総能力|全製粉能力)[^\d]*(\d+(?:,\d+)?\s*(?:t\/day|t\/24h|tpd|mt\/day))/i);
  if (totalCapMatch) {
    totalCapacity = totalCapMatch[1];
  }

  // Investment Amount & Currency
  let investmentAmount = null;
  let currency = null;
  const invMatch = fullText.match(/(SAR|\$|€|¥|£)\s*(\d+(?:\.\d+)?)\s*(million|billion|m|億)?/i);
  if (invMatch) {
    investmentAmount = parseFloat(invMatch[2]);
    const unit = invMatch[3] ? (invMatch[3].toLowerCase() === 'm' || invMatch[3].toLowerCase() === 'million' ? 'million' : invMatch[3]) : '';
    currency = `${invMatch[1]}${unit ? ' ' + unit : ''}`.trim();
  }

  // Mill Name & Location
  let millName = null;
  let location = null;
  const millNameMatch = fullText.match(/([A-Z][a-zA-z0-9\s]+(?:Branch|Mill|Plant|Factory)(?:\s+[A-Z0-9]+)?)/);
  if (millNameMatch) {
    millName = millNameMatch[1].trim();
  }

  // Country
  let country = "Global";
  if (/Saudi Arabia|Qassim|Riyadh/i.test(fullText)) country = "Saudi Arabia";
  else if (/Nigeria|Lagos/i.test(fullText)) country = "Nigeria";
  else if (/United States|U\.S\.|Pennsylvania/i.test(fullText)) country = "U.S.";
  else if (/Canada/i.test(fullText)) country = "Canada";
  else if (/Australia/i.test(fullText)) country = "Australia";
  else if (/Turkey/i.test(fullText)) country = "Turkey";
  else if (/Japan|日本/i.test(fullText)) country = "Japan";

  // Dates
  let commercialOperationDate = null;
  const dateMatch = fullText.match(/(20\d{2}[-/.]\d{2})/);
  if (dateMatch) {
    commercialOperationDate = dateMatch[1];
  }

  // Project Type
  let projectType = "Expansion";
  if (/new mill|new plant|greenfield|新工場|新設/i.test(fullText)) projectType = "Expansion / New Mill";
  else if (/modernization|upgrade|近代化|更新/i.test(fullText)) projectType = "Modernization";

  const tags = ["重要設備投資"];
  if (/new mill|新工場/i.test(fullText)) tags.push("新工場");
  if (/expansion|増設|増産/i.test(fullText)) tags.push("増設");
  if (equipmentSupplier) tags.push("設備メーカー案件");

  const importanceScore = calculateImportanceScore({ title, body });

  return {
    id: `capex-${Date.now()}-${Math.floor(Math.random()*1000)}`,
    title,
    company,
    millName,
    location,
    country,
    equipmentSupplier,
    capacityAdded,
    totalCapacity,
    investmentAmount,
    currency,
    projectType,
    commissioningDate: commercialOperationDate,
    commercialOperationDate,
    importanceScore,
    priority: importanceScore >= 70 ? "High Priority" : importanceScore >= 50 ? "Medium Priority" : "Standard",
    tags,
    source: "CapEx Watcher",
    sourceUrl: url,
    publishedAt: pubDate ? pubDate.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
    discoveredAt: new Date().toISOString(),
    body: body || title,
    why: `${equipmentSupplier ? equipmentSupplier + "製設備導入。" : ""} ${capacityAdded ? "追加能力: " + capacityAdded + "。" : ""} 設備増強・CapExベンチマーク。`
  };
}

async function fetchFeed(feed, maxAgeDays) {
  try {
    const res = await fetch(feed.url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; MillingIntelligenceBot/2.0)" },
      signal: AbortSignal.timeout(12000)
    });
    if (!res.ok) return { items: [], success: false };
    const xml = await res.text();

    const items = [];
    const itemMatches = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)];

    for (const m of itemMatches) {
      const block = m[1];
      const titleMatch = block.match(/<title>([\s\S]*?)<\/title>/i);
      const linkMatch = block.match(/<link>([\s\S]*?)<\/link>/i);
      const dateMatch = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/i);
      const sourceMatch = block.match(/<source[^>]*>([\s\S]*?)<\/source>/i);
      const descMatch = block.match(/<description>([\s\S]*?)<\/description>/i);

      if (titleMatch && linkMatch) {
        const fullTitle = cleanTitle(titleMatch[1]);
        const link = linkMatch[1].trim();
        const pubDate = dateMatch ? new Date(dateMatch[1]) : new Date();
        const sourceName = sourceMatch ? cleanTitle(sourceMatch[1]) : feed.name;
        const description = descMatch ? cleanTitle(descMatch[1]) : "";

        const now = new Date();
        const diffDays = (now.getTime() - pubDate.getTime()) / (1000 * 3600 * 24);
        if (diffDays > maxAgeDays) continue;

        if (EXCLUDE_WORDS.some(w => fullTitle.includes(w))) continue;

        const title = fullTitle.replace(/\s*-\s*[^-]+$/, "").trim();

        items.push({
          title,
          link,
          pubDate,
          source: sourceName,
          body: description
        });
      }
    }
    return { items, success: true };
  } catch (err) {
    console.warn(`[Crawl Warning] Could not fetch ${feed.name}:`, err.message);
    return { items: [], success: false };
  }
}

async function main() {
  const isBackfill = process.argv.includes("--backfill");
  console.log(`Executing crawl mode: ${isBackfill ? "Backfill (90-day CapEx Scan)" : "Standard 2-Layer Daily Crawl"}`);

  let sourcesSucceeded = 0;
  let sourcesFailed = 0;

  // 1. Layer A (Daily News - 5 days)
  let dailyCandidates = 0;
  let dailyAdded = 0;

  const layerAArticles = [];
  for (const f of LAYER_A_FEEDS) {
    const res = await fetchFeed(f, 5.0);
    if (res.success) sourcesSucceeded++; else sourcesFailed++;
    dailyCandidates += res.items.length;
    layerAArticles.push(...res.items);
  }

  // Update WeeklyNews.tsx if new daily items found
  let weeklyContent = fs.readFileSync(weeklyFile, "utf8");
  for (const item of layerAArticles) {
    const cleanCheck = item.title.slice(0, 15);
    if (weeklyContent.includes(cleanCheck) || weeklyContent.includes(item.link)) continue;

    const m = String(item.pubDate.getMonth() + 1).padStart(2, "0");
    const d = String(item.pubDate.getDate()).padStart(2, "0");
    const dateFormatted = `${m}/${d}`;

    const newObjStr = `{date:'${dateFormatted}',pillar:'原料・品質',tag:'速報',title:'${item.title.replace(/'/g, "\\x27")}',body:'${item.title.replace(/'/g, "\\x27")}。速報収集。',why:'速報ニュースとして巡回収集。',url:'${item.link}',source:'${item.source.replace(/'/g, "\\x27")}'},`;

    const marker = "export const weeklyItems:Item[]=[";
    if (weeklyContent.includes(marker)) {
      weeklyContent = weeklyContent.replace(marker, marker + newObjStr);
      dailyAdded++;
    }
    if (dailyAdded >= 5) break;
  }

  if (dailyAdded > 0) {
    fs.writeFileSync(weeklyFile, weeklyContent);
  }

  // 2. Layer B (Strategic CapEx Watch - 90 days)
  let capexCandidates = 0;
  let capexAdded = 0;

  const layerBArticles = [];
  for (const f of LAYER_B_FEEDS) {
    const res = await fetchFeed(f, 90.0);
    if (res.success) sourcesSucceeded++; else sourcesFailed++;
    capexCandidates += res.items.length;
    layerBArticles.push(...res.items);
  }

  // Read existing CapEx items
  let capexItems = [];
  if (fs.existsSync(capexJsonFile)) {
    try {
      capexItems = JSON.parse(fs.readFileSync(capexJsonFile, "utf8"));
    } catch {
      capexItems = [];
    }
  }

  for (const item of layerBArticles) {
    const score = calculateImportanceScore(item);
    if (score < 50) continue; // High/Medium priority threshold

    const exists = capexItems.some(c => c.sourceUrl === item.link || (c.company && c.capacityAdded && item.title.includes(c.company)));
    if (exists) continue;

    const capexRecord = extractCapExMetadata(item.title, item.body, item.link, item.pubDate);
    capexItems.unshift(capexRecord);
    capexAdded++;
    console.log(`+ Added [CapEx Watch]: [${capexRecord.title}] (Score: ${capexRecord.importanceScore})`);
  }

  if (capexAdded > 0) {
    fs.writeFileSync(capexJsonFile, JSON.stringify(capexItems, null, 2) + "\n");

    // Update capexWatchData.ts
    const capexTsContent = `import type { CapExItem, CrawlStatus } from './model';\n\nexport const initialCrawlStatus: CrawlStatus = ${JSON.stringify({
      lastCrawlAt: new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }) + " JST",
      lastCrawlSuccess: sourcesSucceeded > 0,
      todayNewDailyCount: dailyAdded,
      todayNewCapexCount: capexAdded,
      dailyCandidatesCount: dailyCandidates,
      dailyAddedCount: dailyAdded,
      capexCandidatesCount: capexCandidates,
      capexAddedCount: capexAdded,
      sourcesSucceededCount: sourcesSucceeded,
      sourcesFailedCount: sourcesFailed,
      warning: false,
      warningMessage: null
    }, null, 2)};\n\nexport const initialCapExItems: CapExItem[] = ${JSON.stringify(capexItems, null, 2)};\n`;

    fs.writeFileSync(capexDataFile, capexTsContent);
  }

  // Save Crawl Status
  const statusObj = {
    lastCrawlAt: new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }) + " JST",
    lastCrawlSuccess: sourcesSucceeded > 0,
    todayNewDailyCount: dailyAdded,
    todayNewCapexCount: capexAdded,
    dailyCandidatesCount: dailyCandidates,
    dailyAddedCount: dailyAdded,
    capexCandidatesCount: capexCandidates,
    capexAddedCount: capexAdded,
    sourcesSucceededCount: sourcesSucceeded,
    sourcesFailedCount: sourcesFailed,
    warning: sourcesSucceeded === 0,
    warningMessage: sourcesSucceeded === 0 ? "すべてのニュース収集ソースが一時的に応答していません。" : null
  };
  fs.writeFileSync(crawlStatusFile, JSON.stringify(statusObj, null, 2) + "\n");

  // Output explicit required logs
  console.log("\n[Daily News]");
  console.log(`${dailyCandidates} candidates / ${dailyAdded} added`);

  console.log("\n[CapEx Watch]");
  console.log(`${capexCandidates} candidates / ${capexAdded} added`);

  console.log("\n[Sources]");
  console.log(`${sourcesSucceeded} succeeded / ${sourcesFailed} failed`);

  console.log(`\nLast successful crawl: ${statusObj.lastCrawlAt}`);

  if (sourcesSucceeded === 0) {
    console.error("All crawl sources failed! Failing workflow run.");
    process.exit(1);
  }
}

main().catch(err => {
  console.error("Fatal crawl error:", err);
  process.exit(1);
});
