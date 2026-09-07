import fs from "node:fs";
import path from "node:path";

const marketSymbols = {
  "2002": { symbol: "2002.T", exchange: "東京証券取引所 プライム" },
  "2001": { symbol: "2001.T", exchange: "東京証券取引所 プライム" },
  "2004": { symbol: "2004.T", exchange: "東京証券取引所 プライム" },
  "2003": { symbol: "2003.T", exchange: "東京証券取引所 スタンダード" },
  "2009": { symbol: "2009.T", exchange: "東京証券取引所 スタンダード" },
  "ADM": { symbol: "ADM", exchange: "NYSE" },
  "BG": { symbol: "BG", exchange: "NYSE" },
  "CAG": { symbol: "CAG", exchange: "NYSE" },
  "GNC": { symbol: "GNC.AX", exchange: "ASX" },
  "GIS": { symbol: "GIS", exchange: "NYSE" },
  "MDLZ": { symbol: "MDLZ", exchange: "NASDAQ" },
  "KYLO": { symbol: "KYLO.AT", exchange: "Athens Stock Exchange" },
  "GMI": { symbol: "GMI.SW", exchange: "SIX Swiss Exchange" },
  "KYSA": { symbol: "KYSA.AT", exchange: "Athens Stock Exchange" },
};

const marketRanges = {
  "1M": { query: "range=1mo&interval=1d", interval: "1d" },
  "3M": { query: "range=3mo&interval=1d", interval: "1d" },
  "12M": { query: "range=1y&interval=1d", interval: "1d" },
  "60M": { query: "range=5y&interval=1wk", interval: "1wk" },
};

const outDir = path.resolve("public/data/market");
fs.mkdirSync(outDir, { recursive: true });

async function fetchOne(ticker, config, range, rangeCfg) {
  const { symbol, exchange } = config;
  const url = "https://query2.finance.yahoo.com/v8/finance/chart/" + encodeURIComponent(symbol) + "?" + rangeCfg.query + "&includeAdjustedClose=true";
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko)",
    },
  });

  if (!res.ok) {
    throw new Error("HTTP " + res.status);
  }

  const raw = await res.json();
  const result = raw?.chart?.result?.[0];
  if (!result?.timestamp?.length) {
    throw new Error("No timestamp data");
  }

  const prices = result.indicators?.adjclose?.[0]?.adjclose || result.indicators?.quote?.[0]?.close || [];
  const points = result.timestamp
    .map((t, i) => ({ t, p: prices[i] }))
    .filter(x => typeof x.p === "number" && Number.isFinite(x.p));

  if (points.length < 2) {
    throw new Error("Sparse points");
  }

  const currency = result.meta?.currency || (symbol.endsWith(".T") ? "JPY" : "USD");
  const sourceUrl = symbol.endsWith(".T")
    ? "https://finance.yahoo.co.jp/quote/" + symbol + "/chart"
    : "https://finance.yahoo.com/quote/" + symbol + "/history";

  return {
    ticker,
    symbol,
    currency,
    exchange: result.meta?.exchangeName || exchange,
    range,
    interval: rangeCfg.interval,
    points,
    source: "Yahoo Finance",
    sourceUrl,
    fetchedAt: new Date().toISOString(),
  };
}

async function run() {
  console.log("Fetching Yahoo Finance market history for all 14 tickers...");
  let successCount = 0;
  let failCount = 0;

  for (const [ticker, config] of Object.entries(marketSymbols)) {
    for (const [range, rangeCfg] of Object.entries(marketRanges)) {
      const file = path.join(outDir, ticker + "_" + range + ".json");
      try {
        const data = await fetchOne(ticker, config, range, rangeCfg);
        fs.writeFileSync(file, JSON.stringify(data));
        successCount++;
      } catch (err) {
        console.warn("[WARN] Failed to fetch " + ticker + " " + range + ": " + err.message);
        failCount++;
      }
    }
  }

  console.log("Finished market history fetch: " + successCount + " succeeded, " + failCount + " failed.");
}

run();
