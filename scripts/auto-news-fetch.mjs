import fs from "node:fs";
import path from "node:path";

// 毎朝の自動ニュース取得 & 91日周期 四半期IR巡回スクリプト
// Milling Specialist仕様：海外の製粉プラント設備投資、機械メーカー、小麦粉R&D動向を重点収集
console.log("Starting Daily Milling Intelligence auto-fetch (Specialist Edition) at", new Date().toISOString());

const root = process.cwd();
const weeklyFile = path.join(root, "src", "WeeklyNews.tsx");

if (!fs.existsSync(weeklyFile)) {
  console.error("WeeklyNews.tsx not found.");
  process.exit(1);
}

// ニュースフィード（海外設備投資 & 小麦粉開発を重点化）
const FEEDS = [
  // 1. 国内重要ニュース
  {
    name: "国内製粉・小麦・政策ニュース",
    url: "https://news.google.com/rss/search?q=%E8%A3%BD%E7%B2%89+%E5%B0%8F%E9%BA%A6&hl=ja&gl=JP&ceid=JP:ja",
    defaultPillar: "原料・品質",
  },
  {
    name: "国内製粉設備・工場新設・プラント",
    url: "https://news.google.com/rss/search?q=%E8%A3%BD%E7%B2%89%E5%B7%A5%E5%A0%B4+OR+%E8%A3%BD%E7%B2%89%E6%A9%9F%E6%A2%B0+OR+(%E5%B0%8F%E9%BA%A6+%E8%A3%BD%E7%B2%89+%E8%A8%AD%E5%82%99)&hl=ja&gl=JP&ceid=JP:ja",
    defaultPillar: "設備投資",
  },
  {
    name: "国内大手製粉・新商品・プレミックス",
    url: "https://news.google.com/rss/search?q=(%E6%97%A5%E6%B8%85%E8%A3%BD%E7%B2%89+OR+%E3%83%8B%E3%83%83%E3%83%97%E3%83%B3+OR+%E6%98%AD%E5%92%8C%E7%94%A3%E6%A5%AD)+AND+(%E5%B0%8F%E9%BA%A6%E7%B2%89+OR+%E3%83%97%E3%83%AC%E3%83%9F%E3%83%83%E3%82%AF%E3%82%B9+OR+%E6%96%B0%E5%95%86%E5%93%81)&hl=ja&gl=JP&ceid=JP:ja",
    defaultPillar: "二次加工・商品",
  },
  // 2. 海外製粉プラント・設備投資（重点）
  {
    name: "Global Milling Equipment & Machinery (Bühler, Ocrim, Omas, etc.)",
    url: "https://news.google.com/rss/search?q=(%22flour+mill%22+OR+%22flour+milling%22)+AND+(Buhler+OR+Ocrim+OR+Omas+OR+Alapala+OR+Satake+OR+%22roller+mill%22+OR+plansifter)&hl=en-US&gl=US&ceid=US:en",
    defaultPillar: "設備投資",
  },
  {
    name: "Global Flour Mill Plant Expansion & Investment",
    url: "https://news.google.com/rss/search?q=(%22flour+mill%22+OR+%22wheat+processing%22)+AND+(investment+OR+expansion+OR+commissioning+OR+%22new+plant%22+OR+CapEx)&hl=en-US&gl=US&ceid=US:en",
    defaultPillar: "設備投資",
  },
  // 3. 海外小麦粉R&D・機能性粉開発（重点）
  {
    name: "Global Flour R&D, Protein, Quality & Blending",
    url: "https://news.google.com/rss/search?q=(%22wheat+flour%22+OR+%22flour+quality%22)+AND+(protein+OR+gluten+OR+enzyme+OR+%22flour+blending%22+OR+fortification+OR+rheology+OR+premix)&hl=en-US&gl=US&ceid=US:en",
    defaultPillar: "二次加工・商品",
  },
  // 4. 世界の小麦需給・原料品質
  {
    name: "Global Wheat Production & Export Trends",
    url: "https://news.google.com/rss/search?q=(%22wheat+harvest%22+OR+%22wheat+export%22)+AND+(yield+OR+protein+OR+quality+OR+USDA)&hl=en-US&gl=US&ceid=US:en",
    defaultPillar: "原料・品質",
  }
];

// ノイズ除外キーワード
const EXCLUDE_WORDS = [
  "そば処", "手打ちそば", "十割そば", "蕎麦", "ラーメン屋オープン", "ベーカリー開店",
  "パン屋オープン", "スイーツフェス", "手作りクッキー", "家庭用", "クックパッド",
  "レシピ", "お菓子作り教室"
];

// 四半期IRローテーション対象（91日周期・13日おきに巡回）
const ROTATION_START = "2026-09-08";
const ROTATION_DAYS = 91;
const IR_WATCHERS = [
  { id: "nittofuji", rotationDay: 0, name: "日東富士製粉", url: "https://www.nittofuji.co.jp/ir/" },
  { id: "adm", rotationDay: 13, name: "ADM IR", url: "https://investors.adm.com/" },
  { id: "bunge", rotationDay: 26, name: "Bunge IR", url: "https://investors.bunge.com/" },
  { id: "loulis", rotationDay: 39, name: "Loulis Food IR", url: "https://www.loulis.com/en/investor-relations/" },
  { id: "gmsa", rotationDay: 52, name: "Groupe Minoteries", url: "https://gmsa-rg.ch/" },
  { id: "sarantopoulos", rotationDay: 65, name: "C. Sarantopoulos", url: "https://athens.euronext.com/" },
  { id: "torigoe", rotationDay: 78, name: "鳥越製粉 IR", url: "https://www.the-torigoe.co.jp/ir/" },
];

function checkScheduledIR() {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const dayNumber = Math.floor(now.getTime() / 86400000);
  const startNumber = Math.floor(Date.parse(ROTATION_START + "T00:00:00Z") / 86400000);
  const elapsed = (dayNumber - startNumber) % ROTATION_DAYS;
  const currentSlot = elapsed >= 0 ? elapsed : elapsed + ROTATION_DAYS;

  const target = IR_WATCHERS.find(w => w.rotationDay === currentSlot);
  if (target) {
    console.log(`[IR Rotation] 本日（${todayStr}）の四半期IR巡回対象: ${target.name} (${target.url})`);
  } else {
    console.log(`[IR Rotation] 本日（${todayStr}）は定例IR巡回の待機日です（次回予定あり）。`);
  }
  return target;
}

function classifyPillar(title) {
  if (/設備|工場|新設|増設|増産|ライン|ロボット|省エネ|プラント|投資|機械|machine|mill|plant|expansion|capacity|elevator|silo|buhler|ocrim|omas|alapala|satake|plansifter|roll/i.test(title)) {
    return "設備投資";
  }
  if (/新商品|発売|リニューアル|ミックス|パン|うどん|麺|パスタ|商品|プレミックス|米粉|タンパク|食物繊維|開発|bakery|noodle|product|blend|protein|gluten|fiber|enzyme|fortif/i.test(title)) {
    return "二次加工・商品";
  }
  return "原料・品質";
}

function generateSpecialistInsight(pillar, title) {
  if (pillar === "設備投資") {
    return "設備技術者目線：日産能力（t/24h）や動力原単位（kWh/t）、自動化による省人化効果、既存建屋との適合性を注視。";
  }
  if (pillar === "二次加工・商品") {
    return "粉開発目線：灰分・タンパク質規格の設計、酵素・改良剤配合、製パン・製麺レオロジーへの影響を検証。";
  }
  return "原料調達目線：小麦クラス別のブレンド比率、調質水分・時間、歩留まり（Extraction rate）への影響を注視。";
}

function cleanTitle(raw) {
  return raw
    .replace(/<!\[CDATA\[(.*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();
}

async function fetchGoogleNews(feed) {
  try {
    const res = await fetch(feed.url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; MillingIntelligenceBot/1.0)" },
      signal: AbortSignal.timeout(10000)
    });
    if (!res.ok) return [];
    const xml = await res.text();

    const items = [];
    const itemMatches = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)];

    for (const m of itemMatches) {
      const block = m[1];
      const titleMatch = block.match(/<title>([\s\S]*?)<\/title>/i);
      const linkMatch = block.match(/<link>([\s\S]*?)<\/link>/i);
      const dateMatch = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/i);
      const sourceMatch = block.match(/<source[^>]*>([\s\S]*?)<\/source>/i);

      if (titleMatch && linkMatch) {
        const fullTitle = cleanTitle(titleMatch[1]);
        const link = linkMatch[1].trim();
        const pubDate = dateMatch ? new Date(dateMatch[1]) : new Date();
        const sourceName = sourceMatch ? cleanTitle(sourceMatch[1]) : "専門ニュース";

        // 直近5日以内を対象
        const now = new Date();
        const diffDays = (now.getTime() - pubDate.getTime()) / (1000 * 3600 * 24);
        if (diffDays > 5.0) continue;

        // ノイズ除外
        if (EXCLUDE_WORDS.some(w => fullTitle.includes(w))) continue;

        const title = fullTitle.replace(/\s*-\s*[^-]+$/, "").trim();
        const pillar = classifyPillar(title);

        items.push({
          title,
          link,
          pubDate,
          source: sourceName,
          pillar,
          why: generateSpecialistInsight(pillar, title)
        });
      }
    }
    return items;
  } catch (err) {
    console.warn(`Could not fetch ${feed.name}:`, err.message);
    return [];
  }
}

async function main() {
  // 1. IRローテーション診断
  checkScheduledIR();

  // 2. ニュース収集
  const allArticles = [];
  for (const f of FEEDS) {
    const items = await fetchGoogleNews(f);
    allArticles.push(...items);
  }

  console.log(`Fetched ${allArticles.length} candidate articles from ${FEEDS.length} specialist feeds.`);

  let weeklyContent = fs.readFileSync(weeklyFile, "utf8");
  let addedCount = 0;

  for (const item of allArticles) {
    const cleanCheck = item.title.slice(0, 15);
    if (weeklyContent.includes(cleanCheck) || weeklyContent.includes(item.link)) {
      continue;
    }

    const m = String(item.pubDate.getMonth() + 1).padStart(2, "0");
    const d = String(item.pubDate.getDate()).padStart(2, "0");
    const dateFormatted = `${m}/${d}`;

    const newObjStr = `{date:'${dateFormatted}',pillar:'${item.pillar}',tag:'専門速報',title:'${item.title.replace(/'/g, "\\x27")}',body:'${item.title.replace(/'/g, "\\x27")}。海外・国内の最新一次資料に基づき収録。',why:'${item.why.replace(/'/g, "\\x27")}',url:'${item.link}',source:'${item.source.replace(/'/g, "\\x27")}'},`;

    const marker = "export const weeklyItems:Item[]=[";
    if (weeklyContent.includes(marker)) {
      weeklyContent = weeklyContent.replace(marker, marker + newObjStr);
      addedCount++;
      console.log(`+ Added [Specialist]: [${item.title}]`);
    }

    if (addedCount >= 5) break;
  }

  if (addedCount > 0) {
    fs.writeFileSync(weeklyFile, weeklyContent);
    console.log(`Successfully updated WeeklyNews.tsx with ${addedCount} new specialist articles.`);
  } else {
    console.log("No new qualifying articles in the last 5 days. Retaining existing news catalog.");
  }
}

main().catch(console.error);
