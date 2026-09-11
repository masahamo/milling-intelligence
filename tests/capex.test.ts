import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Load config and data for testing
const root = process.cwd();
const config = JSON.parse(fs.readFileSync(path.join(root, 'scripts', 'news-config.json'), 'utf8'));
const WATCHED_EQUIPMENT_COMPANIES = config.watchedEquipmentCompanies || [];
const WATCHED_MILLING_COMPANIES = config.watchedMillingCompanies || [];

function calculateImportanceScore(item) {
  let score = 0;
  const text = (item.title + " " + (item.body || "")).toLowerCase();

  if (/new mill|new flour mill|greenfield|新工場|新設/.test(text)) score += 30;
  if (/capacity expansion|capacity increase|expansion|new production line|plant expansion|能力増強|増設|増産|新ライン/.test(text)) score += 25;
  if (WATCHED_EQUIPMENT_COMPANIES.some(eq => text.includes(eq.toLowerCase()))) score += 20;
  if (/\b\d+(?:,\d+)?\s*(?:t\/day|t\/24h|tpd|mt\/day|tonnes per day|tons per day|日産能力|\s*t\/日)\b/i.test(text)) score += 20;
  if (/\b(?:SAR|\$|€|¥|£)\s*\d+|135m|123m|\d+\s*(?:m|million|億)\b/i.test(text)) score += 15;
  if (/commercial operation|commissioning|稼働開始|商業運転/.test(text)) score += 10;
  if (WATCHED_MILLING_COMPANIES.some(mc => text.includes(mc.toLowerCase()))) score += 10;

  return Math.min(100, score);
}

function extractCapExMetadata(title, body, url, pubDate) {
  const fullText = `${title} ${body || ""}`;

  let company = null;
  for (const mc of WATCHED_MILLING_COMPANIES) {
    const re = new RegExp(`\\b${mc.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}\\b`, "i");
    if (re.test(fullText)) {
      company = mc;
      break;
    }
  }

  let equipmentSupplier = null;
  for (const eq of WATCHED_EQUIPMENT_COMPANIES) {
    const re = new RegExp(`\\b${eq.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}\\b`, "i");
    if (re.test(fullText)) {
      equipmentSupplier = eq;
      break;
    }
  }

  let capacityAdded = null;
  const capMatch = fullText.match(/\b(\d+(?:,\d+)?\s*(?:t\/day|t\/24h|tpd|mt\/day|tonnes per day|tons per day))\b/i);
  if (capMatch) {
    capacityAdded = capMatch[1];
  }

  let totalCapacity = null;
  const totalCapMatch = fullText.match(/(?:total capacity|総能力|拠点総能力|全製粉能力)[^\d]*(\d+(?:,\d+)?\s*(?:t\/day|t\/24h|tpd|mt\/day))/i);
  if (totalCapMatch) {
    totalCapacity = totalCapMatch[1];
  }

  let investmentAmount = null;
  let currency = null;
  const invMatch = fullText.match(/(SAR|\$|€|¥|£)\s*(\d+(?:\.\d+)?)\s*(million|billion|m|億)?/i);
  if (invMatch) {
    investmentAmount = parseFloat(invMatch[2]);
    const unit = invMatch[3] ? (invMatch[3].toLowerCase() === 'm' || invMatch[3].toLowerCase() === 'million' ? 'million' : invMatch[3]) : '';
    currency = `${invMatch[1]}${unit ? ' ' + unit : ''}`.trim();
  }

  let millName = null;
  const millNameMatch = fullText.match(/([A-Z][a-zA-Z0-9\s]+(?:Branch|Mill|Plant|Factory)(?:\s+[A-Z0-9]+)?)/);
  if (millNameMatch) {
    millName = millNameMatch[1].trim();
  }

  let commercialOperationDate = null;
  const dateMatch = fullText.match(/(20\d{2}[-/.]\d{2})/);
  if (dateMatch) {
    commercialOperationDate = dateMatch[1];
  }

  return {
    company,
    millName,
    equipmentSupplier,
    capacityAdded,
    totalCapacity,
    investmentAmount,
    currency,
    commercialOperationDate,
    importanceScore: calculateImportanceScore({ title, body })
  };
}

test('First Mills Qassim Branch Mill C test case extraction', () => {
  const testTitle = "First Mills Announces Commercial Operation of Qassim Branch Mill C Expansion Project";
  const testBody = "First Mills has announced the commercial operation of Qassim Branch Mill C with Bühler roller mill equipment, adding 600 t/day capacity for a total capacity of 1,500 t/day. Investment amount is SAR 123 million. Commercial operation started 2026-08.";

  const result = extractCapExMetadata(testTitle, testBody, "https://example.com/firstmills", new Date());

  assert.equal(result.company, "First Mills");
  assert.equal(result.equipmentSupplier, "Bühler");
  assert.equal(result.capacityAdded, "600 t/day");
  assert.equal(result.totalCapacity, "1,500 t/day");
  assert.equal(result.investmentAmount, 123);
  assert.equal(result.currency, "SAR million");
  assert.equal(result.commercialOperationDate, "2026-08");
  assert.ok(result.importanceScore >= 70, `Score ${result.importanceScore} should be >= 70 for High Priority`);
});

test('Unmatched fields remain null', () => {
  const testTitle = "Local Bakery Opens New Store";
  const testBody = "A small bakery opened today.";

  const result = extractCapExMetadata(testTitle, testBody, "https://example.com/bakery", new Date());

  assert.equal(result.company, null);
  assert.equal(result.equipmentSupplier, null);
  assert.equal(result.capacityAdded, null);
  assert.equal(result.investmentAmount, null);
});
