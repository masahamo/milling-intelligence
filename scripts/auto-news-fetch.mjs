import fs from 'node:fs';
import path from 'node:path';

// 毎朝の自動ニュース取得スクリプト
// Google News RSS 等から日本の最新製粉・小麦ニュース、および海外の業界動向を取得して WeeklyNews.tsx を自動更新します

console.log('Starting Daily Milling Intelligence auto-fetch at', new Date().toISOString());

const root = process.cwd();
const weeklyFile = path.join(root, 'src', 'WeeklyNews.tsx');

if (!fs.existsSync(weeklyFile)) {
  console.error('WeeklyNews.tsx not found.');
  process.exit(1);
}

const FEEDS = [
  {
    name: '製粉・小麦ニュース（国内）',
    url: 'https://news.google.com/rss/search?q=%E8%A3%BD%E7%B2%89+%E5%B0%8F%E9%BA%A6&hl=ja&gl=JP&ceid=JP:ja',
    defaultPillar: '原料・品質',
    lang: 'ja'
  },
  {
    name: '製粉設備・工場新設（国内）',
    url: 'https://news.google.com/rss/search?q=%E8%A3%BD%E7%B2%89%E5%B7%A5%E5%A0%B4+%E5%B0%8F%E9%BA%A6+%E8%A8%AD%E5%82%99&hl=ja&gl=JP&ceid=JP:ja',
    defaultPillar: '設備投資',
    lang: 'ja'
  },
  {
    name: 'Global Flour Milling News',
    url: 'https://news.google.com/rss/search?q=%22flour+milling%22+OR+%22flour+mill%22&hl=en-US&gl=US&ceid=US:en',
    defaultPillar: '設備投資',
    lang: 'en'
  }
];

function classifyPillar(title) {
  if (/設備|工場|新設|増設|増産|ライン|ロボット|省エネ|プラント|投資|machine|mill|plant|expansion|capacity/i.test(title)) {
    return '設備投資';
  }
  if (/新商品|発売|リニューアル|ミックス|パン|うどん|麺|パスタ|商品|プレミックス|bakery|noodle/i.test(title)) {
    return '二次加工・商品';
  }
  return '原料・品質';
}

function cleanTitle(raw) {
  return raw
    .replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .trim();
}

async function fetchGoogleNews(feed) {
  try {
    const res = await fetch(feed.url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MillingIntelligenceBot/1.0)' },
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
        const sourceName = sourceMatch ? cleanTitle(sourceMatch[1]) : 'ニュース報道';

        // 過去3日以内の新しいニュースのみを厳選
        const now = new Date();
        const diffDays = (now.getTime() - pubDate.getTime()) / (1000 * 3600 * 24);
        if (diffDays > 3.5) continue;

        // タイトル末尾のメディア名を除去
        const title = fullTitle.replace(/\s*-\s*[^-]+$/, '').trim();

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
  const allArticles = [];
  for (const f of FEEDS) {
    const items = await fetchGoogleNews(f);
    allArticles.push(...items);
  }

  console.log(`Fetched ${allArticles.length} recent articles.`);

  let weeklyContent = fs.readFileSync(weeklyFile, 'utf8');
  let addedCount = 0;

  for (const item of allArticles) {
    // タイトルの主要部分で重複判定
    const cleanCheck = item.title.slice(0, 15);
    if (weeklyContent.includes(cleanCheck) || weeklyContent.includes(item.link)) {
      continue;
    }

    const m = String(item.pubDate.getMonth() + 1).padStart(2, '0');
    const d = String(item.pubDate.getDate()).padStart(2, '0');
    const dateFormatted = `${m}/${d}`;

    const newObjStr = `{date:'${dateFormatted}',pillar:'${item.pillar}',tag:'最新ニュース',title:'${item.title.replace(/'/g, "\\'")}',body:'${item.title.replace(/'/g, "\\'")}。最新の公開情報に基づき収録。',why:'製粉業界のサプライチェーン・設備投資・製品開発への影響を注視。',url:'${item.link}',source:'${item.source.replace(/'/g, "\\'")}'},`;

    const marker = 'export const weeklyItems:Item=[';
    if (weeklyContent.includes(marker)) {
      weeklyContent = weeklyContent.replace(marker, marker + newObjStr);
      addedCount++;
      console.log(`+ Added: [${item.title}]`);
    }

    if (addedCount >= 3) break; // 1日あたりの追加は厳選して最大3件
  }

  if (addedCount > 0) {
    fs.writeFileSync(weeklyFile, weeklyContent);
    console.log(`Successfully updated WeeklyNews.tsx with ${addedCount} new articles.`);
  } else {
    console.log('No new qualifying articles in the last 72h. Retaining existing news catalog.');
  }
}

main().catch(console.error);
