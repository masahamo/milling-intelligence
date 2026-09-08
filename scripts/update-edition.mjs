import fs from 'node:fs';
import path from 'node:path';

const now = new Date();
const jstDateStr = new Intl.DateTimeFormat('ja-JP', {
  timeZone: 'Asia/Tokyo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
}).format(now).replace(/\//g, '-');

const jstIsoStr = now.toISOString();
console.log('[Edition Update] Updating data edition to: ' + jstDateStr);

const filePath = path.resolve('public/data/milling-v02.json');
if (!fs.existsSync(filePath)) {
  console.error('milling-v02.json not found!');
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
data.edition = jstDateStr;
data.checkedAt = jstIsoStr;

const updateEntry = {
  date: jstDateStr,
  text: '定時自動巡回（朝6:00 JST）実施。最新ニュース・四半期IR・主要上場製粉企業の株価データを検証・更新。',
  type: '定期取得'
};

if (!data.updates.some(u => u.date === jstDateStr)) {
  data.updates.unshift(updateEntry);
}

fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
console.log('[Edition Update] Successfully updated milling-v02.json with edition ' + jstDateStr);
