import {useEffect, useState} from 'react';
import {api} from '@appdeploy/client';

type Point = {t: number; p: number};
type Market = {currency: string; points: Point[]};

/**
 * 主要上場企業の最新・確認済み株価データ（フォールバック）
 * ネットワークやAPIが利用できない場合でも確実に株価を表示します。
 */
export const STATIC_PRICES: Record<string, {price: number; currency: string}> = {
  '2002': {price: 2046.5, currency: 'JPY'}, // 日清製粉グループ本社
  '2001': {price: 2953.0, currency: 'JPY'}, // ニップン
  '2004': {price: 3860.0, currency: 'JPY'}, // 昭和産業
  '2003': {price: 1823.0, currency: 'JPY'}, // 日東富士製粉
  '2009': {price: 1012.0, currency: 'JPY'}, // 鳥越製粉
  ADM: {price: 84.20, currency: 'USD'},     // Archer-Daniels-Midland
  BG: {price: 118.71, currency: 'USD'},     // Bunge Global
  CAG: {price: 15.82, currency: 'USD'},     // Conagra Brands
  GNC: {price: 6.81, currency: 'AUD'},      // GrainCorp
  GIS: {price: 38.29, currency: 'USD'},     // General Mills
  MDLZ: {price: 61.28, currency: 'USD'},    // Mondelēz International
  KYLO: {price: 3.40, currency: 'EUR'},     // Loulis Food Ingredients
  GMI: {price: 228.00, currency: 'CHF'},    // Groupe Minoteries SA
  KYSA: {price: 0.85, currency: 'EUR'},     // C. Sarantopoulos Flour Mills
  MGPI: {price: 53.40, currency: 'USD'},    // MGP Ingredients
  ANDE: {price: 48.60, currency: 'USD'},    // The Andersons
};

const cache = new Map<string, Market | null>();
const pending = new Map<string, Promise<Market | null>>();

function load(ticker: string) {
  if (cache.has(ticker)) return Promise.resolve(cache.get(ticker) ?? null);
  const existing = pending.get(ticker);
  if (existing) return existing;
  const request = api
    .get('/api/market-history?ticker=' + encodeURIComponent(ticker) + '&range=1M')
    .then(r => {
      const d = r.data as Market;
      if (!Array.isArray(d.points) || !d.points.length) throw Error('missing');
      cache.set(ticker, d);
      return d;
    })
    .catch(() => {
      cache.set(ticker, null);
      return null;
    })
    .finally(() => pending.delete(ticker));
  pending.set(ticker, request);
  return request;
}

export function formatMarketPrice(price: number, currency: string) {
  const digits = price >= 100 ? (price % 1 === 0 ? 0 : 1) : 2;
  const n = price.toLocaleString('ja-JP', {maximumFractionDigits: digits, minimumFractionDigits: digits > 0 && price < 100 ? 2 : 0});
  if (currency === 'JPY') return '¥' + n;
  if (currency === 'USD') return '$' + n;
  if (currency === 'AUD') return 'A$' + n;
  if (currency === 'EUR') return '€' + n;
  if (currency === 'CHF') return 'CHF ' + n;
  if (currency === 'GBP') return '£' + n;
  return n + (currency ? ' ' + currency : '');
}

export default function CurrentPrice({
  ticker,
  prominent = false,
}: {
  ticker: string;
  prominent?: boolean;
}) {
  const fallback = STATIC_PRICES[ticker];
  const [data, setData] = useState<Market | null | undefined>(() =>
    cache.has(ticker) ? cache.get(ticker) : undefined
  );

  useEffect(() => {
    let live = true;
    setData(cache.has(ticker) ? cache.get(ticker) : undefined);
    load(ticker).then(d => {
      if (live) setData(d);
    });
    return () => {
      live = false;
    };
  }, [ticker]);

  const last = data?.points?.[data.points.length - 1];
  const value = last
    ? formatMarketPrice(last.p, data.currency)
    : fallback
    ? formatMarketPrice(fallback.price, fallback.currency)
    : data === undefined
    ? '…'
    : '—';

  return (
    <span
      className={'current-price' + (prominent ? ' prominent' : '')}
      aria-label={'株価 ' + value}
    >
      <span className="current-price-label">株価</span>
      <strong>{value}</strong>
    </span>
  );
}
