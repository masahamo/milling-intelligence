import fs from "node:fs";
import path from "node:path";

// 毎朝の自動ニュース取得 & 91日周期 四半期IR巡回スクリプト
// アンテナ拡張版：製粉・小麦・機械・大手各社の動向をより高精度かつ広範囲に収集
console.log("Starting Daily Milling Intelligence auto-fetch at", new Date().toISOString());

const root = process.cwd();
const weeklyFile = path.join(root, "src", "WeeklyNews.tsx");

if (!fs.existsSync(weeklyFile)) {
  console.error("WeeklyNews.tsx not found.");
  process.exit(1);
}

// ニュースフィード（アンテナを適切に拡張）
const FEEDS = [
  {
    name: "製粉・小麦ニュース（国内）",
    url: "https://news.google.com/rss/search?q=%E8%A3%BD%E7%B2%89+%E5%B0%8F%E9%BA%A6&hl=ja&gl=JP&ceid=JP:ja",
    defaultPillar: "原料・品質",
  },
  {
    name: "製粉設備・工場新設・プラント（国内）",
    url: "https://news.google.com/rss/search?q=%E8%A3%BD%E7%B2%89%E5%B7%A5%E5%A0%B4+OR+%E8%A3%BD%E7%B2%89%E6%A9%9F%E6%A2%B0+OR+(%E5%B0%8F%E9%BA%A6+%E8%A3%BD%E7%B2%89+%E8%A8%AD%E5%82%99)&hl=ja&gl=JP&ceid=JP:ja",
    defaultPillar: "設備投資",
  },
  {
    name: "輸入小麦・売渡価格・相場動向",
    url: "https://news.google.com/rss/search?q=%E8%BC%B8%E5%85%A5%E5%B0%8F%E9%BA%A6+OR+%E5%B0%8F%E9%BA%A6%E5%A3%B2%E6%B8%A1%E4%BE%A1%E6%A0%BC+OR+%E5%B0%8F%E9%BA%A6%E7%9B%B8%E5%A0%B4&hl=ja&gl=JP&ceid=JP:ja",
    defaultPillar: "原料・品質",
  },
  {
    name: "大手製粉会社・新商品・新技術",
    url: "https://news.google.com/rss/search?q=(%E6%97%A5%E6%B8%85%E8%A3%BD%E7%B2%89+OR+%E3%83%8B%E3%83%83%E3%83%97%E3%83%B3+OR+%E6%98%AD%E5%92%8C%E7%94%A3%E6%A5%AD+OR+%E6%97%A5%E6%9D%B1%E8%A3%BD%E7%B2%89)+AND+(%E5%B0%8F%E9%BA%A6%E7%B2%89+OR+%E3%83%97%E3%83%AC%E3%83%9F%E3%83%83%E3%82%AF%E3%82%B9+OR+%E8%A8%AD%E5%82%99+OR+%E6%96%B0%E5%95%86%E5%93%81)&hl=ja&gl=JP&ceid=JP:ja",
    defaultPillar: "二次加工・商品",
  },
  {
    name: "Global Flour Milling & Capacity",
    url: "https://news.google.com/rss/search?q=%22flour+milling%22+OR+%22flour+mill%22+OR+%22milling+capacity%22&hl=en-US&gl=US&ceid=US:en",
    defaultPillar: "設備投資",
  },
  {
    name: "Global Wheat & Flour Production",
    url: "https://news.google.com/rss/search?q=(%22wheat+flour%22+OR+%22flour+production%22)+AND+(mill+OR+milling+OR+export)&hl=en-US&gl=US&ceid=US:en",
    defaultPillar: "原料・品質",
  }
];

// ノイズ除外キーワード（個人のレシピ、飲食店オープン、そば等の無関係な情報を遮断）
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
  if (/設備|工場|新設|増設|増産|ライン|ロボット|省エネ|プラント|投資|機械|machine|mill|plant|expansion|capacity|elevator|silo/i.test(title)) {
    return "設備投資";
  }
  if (/新商品|発売|リニューアル|ミックス|パン|うどん|麺|パスタ|商品|プレミックス|米粉|bakery|noodle|product/i.test(title)) {
    return "二次加工・商品";
  }
  return "原料・品質";
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
        const sourceName = sourceMatch ? cleanTitle(sourceMatch[1]) : "ニュース報道";

        // 5日以内のニュースを対象（週末も確実にカバー）
        const now = new Date();
        const diffDays = (now.getTime() - pubDate.getTime()) / (1000 * 3600 * 24);
        if (diffDays > 5.0) continue;

        // ノイズワードを含むものはスキップ
        if (EXCLUDE_WORDS.some(w => fullTitle.includes(w))) continue;

        const title = fullTitle.replace(/\s*-\s*[^-]+$/, "").trim();

        items.push({
          title,
          link,
          pubDate,
          source: sourceName,
          pillar: classifyPillar(title)
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
  // 1. IRローテーションの診断
  checkScheduledIR();

  // 2. ニュース収集
  const allArticles = [];
  for (const f of FEEDS) {
    const items = await fetchGoogleNews(f);
    allArticles.push(...items);
  }

  console.log(`Fetched ${allArticles.length} recent candidate articles from ${FEEDS.length} expanded feeds.`);

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

    const newObjStr = `{date:'${dateFormatted}',pillar:'${item.pillar}',tag:'最新ニュース',title:'${item.title.replace(/'/g, "\\x27")}',body:'${item.title.replace(/'/g, "\\x27")}。最新の公開情報に基づき収録。',why:'製粉業界のサプライチェーン・設備投資・製品開発への影響を注視。',url:'${item.link}',source:'${item.source.replace(/'/g, "\\x27")}'},`;

    const marker = "export const weeklyItems:Item[]=[";
    if (weeklyContent.includes(marker)) {
      weeklyContent = weeklyContent.replace(marker, marker + newObjStr);
      addedCount++;
      console.log(`+ Added: [${item.title}]`);
    }

    // 1回の追加上限を少し緩和（最大5件まで）
    if (addedCount >= 5) break;
  }

  if (addedCount > 0) {
    fs.writeFileSync(weeklyFile, weeklyContent);
    console.log(`Successfully updated WeeklyNews.tsx with ${addedCount} new articles.`);
  } else {
    console.log("No new qualifying articles in the last 5 days. Retaining existing news catalog.");
  }
}

main().catch(console.error);
