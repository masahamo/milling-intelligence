import { useEffect, useMemo, useState } from 'react';
import { api } from '@appdeploy/client';
import { ExternalLink, TrendingUp } from 'lucide-react';
import { getListedScore } from './CompanyScores';
import { getMillsCompareCapacity, groups } from './Mills';
import { appHref } from './navigation';

type Fx = {
  usdJpy: number;
  audUsd: number;
  cadUsd: number;
  eurUsd: number;
  gbpUsd: number;
  chfUsd: number;
  asOf: string;
  partial?: boolean;
};

type Company = { id: string; name: string; region: string };

type Cap = {
  id: string;
  name: string;
  region: string;
  capacity: number;
  label: string;
  period: string;
  basis: string;
  source: string;
  sourceName: string;
  status?: 'Current' | 'Reference';
  partial?: boolean;
};

type Seg = { label: string; value: number; color: string };

type Currency = 'USD' | 'AUD' | 'CAD' | 'EUR' | 'GBP' | 'CHF' | 'JPY_OKU';

type Raw = {
  id: string;
  name: string;
  currency: Currency;
  value: number;
  period: string;
  segments: Seg[];
  source: string;
  sourceName: string;
  note?: string;
};

const allCompanies: Company[] = [
  { id: '2002', name: '日清製粉グループ', region: 'Japan + Overseas' },
  { id: '2001', name: 'ニップン', region: 'Japan' },
  { id: '2004', name: '昭和産業', region: 'Japan' },
  { id: '2003', name: '日東富士製粉', region: 'Japan' },
  { id: 'ADM', name: 'ADM', region: 'U.S. / Global' },
  { id: 'BG', name: 'Bunge', region: 'U.S. / Global' },
  { id: 'CAG', name: 'Conagra Brands', region: 'U.S.' },
  { id: 'GNC', name: 'GrainCorp', region: 'Australia' },
  { id: 'GIS', name: 'General Mills', region: 'U.S. / Global' },
  { id: 'MDLZ', name: 'Mondelēz', region: 'U.S. / Global' },
  { id: 'ardent', name: 'Ardent Mills', region: 'North America' },
  { id: 'ph', name: 'P&H Milling Group', region: 'Canada' },
  { id: 'miller', name: 'Miller Milling', region: 'U.S.' },
  { id: 'allied', name: 'Allied Pinnacle', region: 'Australia' },
  { id: 'graincraft', name: 'Grain Craft', region: 'U.S.' },
  { id: 'manildra', name: 'Manildra Group', region: 'Australia' },
  { id: 'rogers', name: 'Rogers Foods', region: 'Canada' },
  { id: 'goodmills', name: 'GoodMills Group', region: 'Europe' },
  { id: 'dossche', name: 'Dossche Mills', region: 'Europe' },
  { id: 'moulins-soufflet', name: 'Moulins Soufflet', region: 'Europe' },
  { id: 'whitworth', name: 'Whitworth Bros. Ltd.', region: 'Europe' },
  { id: 'KYLO', name: 'Loulis Food Ingredients', region: 'Europe · Greece' },
  { id: 'GMI', name: 'Groupe Minoteries SA', region: 'Europe · Switzerland' },
  { id: 'KYSA', name: 'C. Sarantopoulos Flour Mills', region: 'Europe · Greece' },
  { id: '2009', name: '鳥越製粉', region: 'Japan' },
  { id: 'nikkoku', name: '日穀製粉', region: 'Japan' },
  { id: 'asahi-jp', name: '旭製粉', region: 'Japan' },
  { id: 'chiba-flour', name: '千葉製粉', region: 'Japan' },
  { id: 'kinki', name: '近畿製粉', region: 'Japan' },
  { id: 'hoshino', name: '星野物産', region: 'Japan' },
  { id: 'yokoyama', name: '横山製粉', region: 'Japan' },
  { id: 'karakida', name: '柄木田製粉', region: 'Japan' },
  { id: 'marusho', name: '丸正製粉', region: 'Japan' },
  { id: 'okinawa', name: '沖縄製粉', region: 'Japan' },
  { id: 'kumamoto', name: '熊本製粉', region: 'Japan' },
  { id: 'riken', name: '理研農産化工', region: 'Japan' },
  { id: 'ebetsu', name: '江別製粉', region: 'Japan' },
  { id: 'kasahara', name: '笠原産業', region: 'Japan' },
  { id: 'maeda-foods', name: '前田食品', region: 'Japan' },
  { id: 'ogawa', name: '小川製粉', region: 'Japan' },
  { id: 'kanazawa', name: '金沢製粉', region: 'Japan' },
  { id: 'izawa', name: '井澤製粉', region: 'Japan' },
  { id: 'iisaka', name: '飯坂製粉', region: 'Japan' },
  { id: 'odazo', name: '小田象製粉', region: 'Japan' },
  { id: 'kintobi', name: '金トビ志賀', region: 'Japan' },
  { id: 'yoshihara', name: '吉原食糧', region: 'Japan' },
  { id: 'taiyo', name: '大陽製粉', region: 'Japan' }
];

const fallback: Fx = {
  usdJpy: 156.59,
  audUsd: 0.66,
  cadUsd: 0.72,
  eurUsd: 1.1614,
  gbpUsd: 1.3517,
  chfUsd: 1.2346,
  asOf: '2026-09-06T00:00:00Z',
  partial: true
};

const caps: Cap[] = [
  {
    id: 'ardent',
    name: 'Ardent Mills',
    region: 'North America',
    capacity: 21242,
    label: '21,242 t/day',
    period: '2026',
    basis: '2026年年鑑。北米30 wheat + 1 durum + 1 rye mills。',
    source: 'https://www.world-grain.com/articles/22973-country-focus-united-states',
    sourceName: 'World Grain / 2026 Annual'
  },
  {
    id: '2002',
    name: '日清製粉グループ',
    region: 'Japan + Overseas',
    capacity: 20571,
    label: '約20,571 t/day',
    period: '参考値',
    basis: '海外12,000t/dayが国内の約1.4倍という公式開示から算出した既存Compare参考値。工場DBでは推定値として扱わない。',
    source: 'https://www.nisshin.com/business/seifun.html',
    sourceName: '日清製粉グループ公式'
  },
  {
    id: 'ADM',
    name: 'ADM Milling',
    region: 'U.S. confirmed capacity',
    capacity: 11272,
    label: '約11,272 t/day',
    period: '2026',
    basis: '2026年年鑑248,500 cwts/dayをメートルトンへ単位換算。米国17 flour millsの確認値で、世界総能力ではない。',
    source: 'https://www.world-grain.com/articles/22293-nebraska-flour-mill-to-be-closed-by-adm-milling',
    sourceName: 'World Grain / 2026 Annual'
  },
  {
    id: 'goodmills',
    name: 'GoodMills Group',
    region: 'Europe',
    capacity: 8000,
    label: '約8,000 t/day',
    period: '2025/26 reference',
    basis: '24 millsで毎日約8,000tのgrainを処理する公開事例。公式は年間2.8百万t処理も公表。',
    source: 'https://www.linkedin.com/posts/laura-sanchezgarcia_transparency-from-field-to-bread-activity-7338838223210618880-dSCA',
    sourceName: 'Siemens Industry / GoodMills case'
  },
  {
    id: 'graincraft',
    name: 'Grain Craft',
    region: 'U.S.',
    capacity: 6713,
    label: '約6,713 t/day',
    period: '2026',
    basis: '2026年年鑑148,000 cwts/dayをメートルトンへ単位換算。13 flour mills。',
    source: 'https://www.world-grain.com/articles/22122-fire-quickly-extinguished-at-grain-craft-plant',
    sourceName: 'World Grain / 2026 Annual'
  },
  {
    id: 'miller',
    name: 'Miller Milling',
    region: 'U.S. · Nisshin Group',
    capacity: 6090,
    label: '6,090 t/day',
    period: '2025',
    basis: '日清製粉グループ公式。5工場、Saginaw増設完了後の原料小麦ベース。',
    source: 'https://www.nisshin.com/release/details/20250415100531.html',
    sourceName: '日清製粉グループ公式'
  },
  {
    id: 'dossche',
    name: 'Dossche Mills',
    region: 'Europe',
    capacity: 5500,
    label: '約5,500 t/day',
    period: '2023 reference',
    basis: 'Dossche Group公式系資料の5,500 tons of wheat flour/day。2024年Mühle Rüningen取得前の公表値のため、現行総能力はこれ以上の可能性あり。',
    source: 'https://www.mexmafood.eu/files/415/13-mexma-p20230169-folder%2Bmet%2Bcompleet%2Baanbod%2Ben.pdf',
    sourceName: 'Dossche Group / Mexma brochure'
  },
  {
    id: '2001',
    name: 'ニップン',
    region: 'Japan',
    capacity: 5500,
    label: '5,500 t/day',
    period: '2021 reference',
    basis: '7 mills合計のingredient basis日産能力として公開された業界インタビュー値。知多新工場稼働後の現行総量は再確認中。',
    source: 'https://millermagazine.com/en/blog/japanese-nippn-rebrands-to-become-diversified-all-around-food-company-3863',
    sourceName: 'Miller Magazine / NIPPN interview'
  },
  {
    id: 'allied',
    name: 'Allied Pinnacle',
    region: 'Australia',
    capacity: 3500,
    label: '3,500 t/day',
    period: '2019 reference',
    basis: '日清製粉グループ公表のwheat basis production capacity。現行値の再確認を継続。',
    source: 'https://www.nisshin.com/uploads/p191031_e.pdf',
    sourceName: '日清製粉グループ公式'
  },
  {
    id: 'ph',
    name: 'P&H Milling Group',
    region: 'Canada',
    capacity: 2803,
    label: '約2,803 t/day',
    period: '2024 reference',
    basis: '2024 Grain & Milling Annualの61,800 cwts/dayをメートルトンへ単位換算。Red Deer計画は現行値へ加算しない。',
    source: 'https://www.world-grain.com/articles/20433-p-and-h-milling-to-build-flour-mill-in-alberta',
    sourceName: 'World Grain / 2024 Annual'
  },
  {
    id: '2003',
    name: '日東富士製粉',
    region: 'Japan',
    capacity: 1770,
    label: '1,770 t/day',
    period: '2016 reference',
    basis: '東京・静岡・名古屋3工場の旧公表合計。現在は埼玉工場を含む4工場のため現行総量ではない。',
    source: 'https://www.world-grain.com/articles/10253-focus-on-japan',
    sourceName: 'World Grain / Focus on Japan 2016'
  },
  {
    id: 'KYLO',
    name: 'Loulis Food Ingredients',
    region: 'Europe · Greece',
    capacity: 1530,
    label: '1,530 t/day',
    period: 'current official plant pages',
    basis: 'Sourpi 1,100 + Keratsini 300 + General Toshevo 130 t/24h。3工場の公式現行値を同一単位で合算。',
    source: 'https://www.loulis.com/en/company/egkatastaseis/',
    sourceName: 'Loulis Food Ingredients公式'
  },
  {
    id: 'rogers',
    name: 'Rogers Foods',
    region: 'Canada',
    capacity: 770,
    label: '770 t/day',
    period: '2017 reference',
    basis: 'Chilliwack 550 + Armstrong 220 t/dayの原料小麦ベース。公表年が古いため現行値は継続確認。',
    source: 'https://www.nisshin.com/uploads/150828e.pdf',
    sourceName: '日清製粉グループ公式'
  },
  {
    id: '2009',
    name: '鳥越製粉',
    region: 'Japan',
    capacity: 653,
    label: '653 t/day',
    period: 'current official',
    basis: '福岡345 + 広島202 + 静岡106 t/day。プレミックス月産・ライ麦製粉は除外。',
    source: 'https://www.the-torigoe.co.jp/company/office/',
    sourceName: '鳥越製粉公式'
  },
  {
    id: 'karakida',
    name: '柄木田製粉',
    region: 'Japan',
    capacity: 349,
    label: '349.0 t/day',
    period: 'current official',
    basis: '本社197.7 + 大阪151.3 t/day。製麺能力は除外。',
    source: 'https://karakida.co.jp/company/office/',
    sourceName: '柄木田製粉公式'
  },
  {
    id: 'marusho',
    name: '丸正製粉',
    region: 'Japan',
    capacity: 222,
    label: '222.0 t/day',
    period: 'current official',
    basis: '本社工場の製粉日産能力。',
    source: 'https://marushof.co.jp/company/',
    sourceName: '丸正製粉公式'
  },
  {
    id: 'kinki',
    name: '近畿製粉',
    region: 'Japan',
    capacity: 200.6,
    label: '200.6 t/day',
    period: 'current official',
    basis: '泉佐野工場の製粉日産設備能力。',
    source: 'https://kinkiseifun.jp/about/',
    sourceName: '近畿製粉公式'
  },
  {
    id: 'ebetsu',
    name: '江別製粉',
    region: 'Japan',
    capacity: 210,
    label: '210 t/day',
    period: 'current official',
    basis: '会社公式の小麦製粉能力。工場別ライン内訳は未確認。',
    source: 'https://haruyutaka.com/company',
    sourceName: '江別製粉公式'
  },
  {
    id: 'ogawa',
    name: '小川製粉',
    region: 'Japan',
    capacity: 103,
    label: '103 t/day',
    period: 'current official',
    basis: '会社公式の日産設備能力。澱粉等の別設備は除外。',
    source: 'https://www.ogawa-seifun.jp/about/',
    sourceName: '小川製粉公式'
  }
];

const millIdMap: Record<string, string> = {
  '2002': 'nisshin-jp',
  '2001': 'nippn',
  '2004': 'showa',
  '2003': 'nittofuji',
  '2009': 'torigoe'
};

const fallbackCaps = new Map(caps.map((c) => [c.id, c]));

const capacityRows: Cap[] = allCompanies.flatMap((c) => {
  const m = getMillsCompareCapacity(millIdMap[c.id] || c.id);
  if (m) {
    return [
      {
        id: c.id,
        name: m.name,
        region: m.region,
        capacity: m.capacity,
        label: m.capacity.toLocaleString('ja-JP', { maximumFractionDigits: 1 }) + ' t/day',
        period: m.conversionNote || 'Mills current',
        basis: m.basis + (m.partial ? ' · ' + m.coverage : ''),
        source: m.source,
        sourceName: m.sourceName,
        status: 'Current' as const,
        partial: m.partial
      }
    ];
  }
  const f = fallbackCaps.get(c.id);
  return f ? [{ ...f, status: 'Reference' as const }] : [];
});

const millsPreferredCount = capacityRows.filter((r) => r.status === 'Current').length;
const fallbackCapacityCount = capacityRows.filter((r) => r.status === 'Reference').length;

type CapacityRegion = 'Global' | 'Japan' | 'North America' | 'Europe';

const capacityRegions: CapacityRegion[] = ['Global', 'Japan', 'North America', 'Europe'];

const REGION_LABELS: Record<CapacityRegion, string> = {
  Global: '🌐 世界全体',
  Japan: '🇯🇵 日本',
  'North America': '🇺🇸 北米',
  Europe: '🇪🇺 欧州'
};

function capacityRegionOf(region: string): CapacityRegion | 'Other' {
  if (region.includes('Japan')) return 'Japan';
  if (/North America|U\.S\.|Canada|Puerto Rico/.test(region)) return 'North America';
  if (region.includes('Europe')) return 'Europe';
  return 'Other';
}

const capacityHeadings: Record<CapacityRegion, string> = {
  Global: '世界の製粉会社・小麦粉メーカーランキング',
  Japan: '日本の製粉会社・小麦粉メーカーランキング',
  'North America': '北米の製粉会社・小麦粉メーカーランキング',
  Europe: 'ヨーロッパの製粉会社・小麦粉メーカーランキング'
};

const raws: Raw[] = [
  {
    id: 'ADM',
    name: 'ADM',
    currency: 'USD',
    value: 80.269,
    period: 'FY2025',
    segments: [
      { label: 'Ag Services & Oilseeds', value: 61.571, color: '#1f6a48' },
      { label: 'Carbohydrate Solutions', value: 10.737, color: '#d8892b' },
      { label: 'Nutrition', value: 7.512, color: '#4f7da5' },
      { label: 'Other', value: 0.449, color: '#8a918d' }
    ],
    source: 'https://www.sec.gov/Archives/edgar/data/7084/000000708426000011/adm-20251231.htm',
    sourceName: 'ADM 2025 10-K'
  },
  {
    id: 'BG',
    name: 'Bunge',
    currency: 'USD',
    value: 70.329,
    period: 'FY2025',
    segments: [
      { label: 'Soybean Processing & Refining', value: 36.313, color: '#1f6a48' },
      { label: 'Softseed', value: 11.252, color: '#c6a34a' },
      { label: 'Other Oilseeds', value: 4.633, color: '#8d68a6' },
      { label: 'Grain Merchandising & Milling', value: 18.128, color: '#4f7da5' },
      { label: 'Other', value: 0.003, color: '#8a918d' }
    ],
    source: 'https://www.sec.gov/Archives/edgar/data/1996862/000162828026009842/bg-20251231.htm',
    sourceName: 'Bunge 2025 10-K'
  },
  {
    id: 'MDLZ',
    name: 'Mondelēz',
    currency: 'USD',
    value: 38.537,
    period: 'FY2025',
    segments: [{ label: '連結売上高', value: 38.537, color: '#4f7da5' }],
    source: 'https://ir.mondelezinternational.com/',
    sourceName: 'Mondelēz IR',
    note: '本版では地域別売上を未分解。'
  },
  {
    id: 'GIS',
    name: 'General Mills',
    currency: 'USD',
    value: 18.4246,
    period: 'FY2026',
    segments: [
      { label: 'North America Retail', value: 10.5718, color: '#1f6a48' },
      { label: 'International', value: 3.0438, color: '#4f7da5' },
      { label: 'Pet', value: 2.6133, color: '#8d68a6' },
      { label: 'Foodservice', value: 2.1695, color: '#d8892b' },
      { label: 'Other', value: 0.0262, color: '#8a918d' }
    ],
    source: 'https://investors.generalmills.com/press-releases/press-release-details/2026/General-Mills-Reports-Fiscal-2026-Fourth-quarter-Adjusted-Results-in-Line-with-Company-Expectations/default.aspx',
    sourceName: 'General Mills FY2026'
  },
  {
    id: 'CAG',
    name: 'Conagra Brands',
    currency: 'USD',
    value: 11.2816,
    period: 'FY2026',
    segments: [
      { label: 'Grocery & Snacks', value: 4.6101, color: '#1f6a48' },
      { label: 'Refrigerated & Frozen', value: 4.6418, color: '#4f7da5' },
      { label: 'International', value: 0.9139, color: '#d8892b' },
      { label: 'Foodservice', value: 1.1158, color: '#8a918d' }
    ],
    source: 'https://www.conagrabrands.com/news-room/news-conagra-brands-reports-fourth-quarter-and-full-year-results-prn-122958',
    sourceName: 'Conagra FY2026'
  },
  {
    id: 'GNC',
    name: 'GrainCorp',
    currency: 'AUD',
    value: 7.306,
    period: 'FY2025',
    segments: [{ label: '連結売上高', value: 7.306, color: '#1f6a48' }],
    source: 'https://www.graincorp.com.au/wp-content/uploads/2025/11/GrainCorp-Annual-Report-2025.pdf',
    sourceName: 'GrainCorp FY2025'
  },
  {
    id: '2002',
    name: '日清製粉グループ',
    currency: 'JPY_OKU',
    value: 8650.04,
    period: 'FY2026',
    segments: [
      { label: '製粉', value: 4285.33, color: '#1f6a48' },
      { label: '加工食品', value: 2166.2, color: '#d8892b' },
      { label: '中食・惣菜', value: 1645.52, color: '#4f7da5' },
      { label: 'その他', value: 552.98, color: '#8a918d' }
    ],
    source: 'https://www2.jpx.co.jp/disc/20020/140120260513530641.pdf',
    sourceName: '日清 FY2026'
  },
  {
    id: '2001',
    name: 'ニップン',
    currency: 'JPY_OKU',
    value: 4184.24,
    period: 'FY2026',
    segments: [
      { label: '製粉', value: 1200, color: '#1f6a48' },
      { label: '食品', value: 2436.94, color: '#d8892b' },
      { label: 'その他', value: 547.3, color: '#8a918d' }
    ],
    source: 'https://www.nippn.co.jp/ir/announcement/tanshin/pdf/2025_4Q.pdf',
    sourceName: 'ニップン FY2026'
  },
  {
    id: '2004',
    name: '昭和産業',
    currency: 'JPY_OKU',
    value: 3354.13,
    period: 'FY2026',
    segments: [
      { label: '製粉', value: 1036, color: '#1f6a48' },
      { label: '製油', value: 947, color: '#c6a34a' },
      { label: '糖質', value: 655, color: '#8d68a6' },
      { label: 'その他食品', value: 79, color: '#d8892b' },
      { label: '飼料', value: 587, color: '#6f7f74' },
      { label: 'その他', value: 50.13, color: '#8a918d' }
    ],
    source: 'https://www.showa-sangyo.co.jp/corporate/brand/performance/',
    sourceName: '昭和産業 FY2026'
  },
  {
    id: '2003',
    name: '日東富士製粉',
    currency: 'JPY_OKU',
    value: 727.77,
    period: 'FY2026',
    segments: [
      { label: '製粉・食品', value: 604.92, color: '#1f6a48' },
      { label: '外食', value: 122.19, color: '#d8892b' },
      { label: 'その他', value: 0.66, color: '#8a918d' }
    ],
    source: 'https://www.nittofuji.co.jp/ir/library/accounts/',
    sourceName: '日東富士 FY2026'
  },
  {
    id: 'goodmills',
    name: 'GoodMills Group',
    currency: 'EUR',
    value: 1.15,
    period: 'Current key facts',
    segments: [{ label: 'Turnover', value: 1.15, color: '#1f6a48' }],
    source: 'https://www.goodmills.com/company/',
    sourceName: 'GoodMills Group official',
    note: '公式Company key factsのturnover。対象年度の明記はページ上で確認できないためCurrent key factsとして表示。'
  },
  {
    id: 'dossche',
    name: 'Dossche Mills',
    currency: 'EUR',
    value: 0.8,
    period: '2024 combined reference',
    segments: [{ label: 'Turnover', value: 0.8, color: '#1f6a48' }],
    source: 'https://www.dosschemills.com/en/news/belgian-family-owned-company-dossche-mills-acquires-german-muehle-rueningen',
    sourceName: 'Dossche Mills official',
    note: 'Mühle Rüningen取得発表時のcombined milling group概算turnover。監査済みFY値とは区別。'
  },
  {
    id: 'moulins-soufflet',
    name: 'Moulins Soufflet',
    currency: 'EUR',
    value: 0.387121,
    period: 'FY2025',
    segments: [{ label: 'Revenue', value: 0.387121, color: '#1f6a48' }],
    source: 'https://www.pappers.fr/entreprise/moulins-soufflet-543780449',
    sourceName: 'French public filing aggregation',
    note: '2025年6月期の公開法人単体売上。InVivo連結売上ではない。'
  },
  {
    id: 'whitworth',
    name: 'Whitworth Bros. Ltd.',
    currency: 'GBP',
    value: 0.591289,
    period: 'FY2025',
    segments: [{ label: 'Turnover', value: 0.591289, color: '#1f6a48' }],
    source: 'https://www.192.com/atoz/financial/business/04999927/',
    sourceName: 'Companies House summary',
    note: 'Whitworths Holdings Limitedの2025年3月期turnover。製粉単体売上とは区別。'
  },
  {
    id: 'KYLO',
    name: 'Loulis Food Ingredients',
    currency: 'EUR',
    value: 0.199670718,
    period: 'FY2025',
    segments: [{ label: 'Revenue', value: 0.199670718, color: '#1f6a48' }],
    source: 'https://www.loulis.com/ependytes/oikonomika-stoicheia/',
    sourceName: 'Loulis Food Ingredients IR',
    note: 'FY2025連結売上。'
  },
  {
    id: 'GMI',
    name: 'Groupe Minoteries SA',
    currency: 'CHF',
    value: 0.1519,
    period: 'FY2025',
    segments: [{ label: 'Net revenue', value: 0.1519, color: '#1f6a48' }],
    source: 'https://gmsa-rg.ch/',
    sourceName: 'GMSA 2025 Annual Report',
    note: '2025年連結純売上CHF151.9m。'
  },
  {
    id: 'KYSA',
    name: 'C. Sarantopoulos Flour Mills',
    currency: 'EUR',
    value: 0.01676966,
    period: 'FY2025',
    segments: [{ label: 'Revenue', value: 0.01676966, color: '#1f6a48' }],
    source: 'https://athens.euronext.com/en/node/966027',
    sourceName: 'Euronext Athens FY2025',
    note: 'FY2025連結売上。'
  },
  {
    id: '2009',
    name: '鳥越製粉',
    currency: 'JPY_OKU',
    value: 262.50493,
    period: 'FY2025',
    segments: [{ label: '連結売上高', value: 262.50493, color: '#1f6a48' }],
    source: 'https://www.the-torigoe.co.jp/ir/',
    sourceName: '鳥越製粉 IR'
  },
  {
    id: 'chiba-flour',
    name: '千葉製粉',
    currency: 'JPY_OKU',
    value: 223.27,
    period: 'FY2025',
    segments: [{ label: '会社売上', value: 223.27, color: '#1f6a48' }],
    source: 'https://www.chiba-seifun.co.jp/company/',
    sourceName: '千葉製粉公式'
  },
  {
    id: 'riken',
    name: '理研農産化工',
    currency: 'JPY_OKU',
    value: 313,
    period: 'FY2024/3',
    segments: [{ label: '連結売上高', value: 313, color: '#1f6a48' }],
    source: 'https://www.riken-nosan.com/gaiyo/kigyo.html',
    sourceName: '理研農産化工公式'
  },
  {
    id: 'hoshino',
    name: '星野物産',
    currency: 'JPY_OKU',
    value: 52,
    period: '2024 reference',
    segments: [{ label: '売上高', value: 52, color: '#1f6a48' }],
    source: 'https://www.hoshinet.co.jp/company/',
    sourceName: '公開会社情報',
    note: '公表時点が他社FYと異なるためreference表示。'
  },
  {
    id: 'ebetsu',
    name: '江別製粉',
    currency: 'JPY_OKU',
    value: 42.8,
    period: 'FY2024',
    segments: [{ label: '売上高', value: 42.8, color: '#1f6a48' }],
    source: 'https://haruyutaka.com/company',
    sourceName: '江別製粉公式'
  }
];

const conv = (v: number, c: Currency, f: Fx) =>
  c === 'USD'
    ? v
    : c === 'AUD'
      ? v * f.audUsd
      : c === 'CAD'
        ? v * f.cadUsd
        : c === 'EUR'
          ? v * f.eurUsd
          : c === 'GBP'
            ? v * f.gbpUsd
            : c === 'CHF'
              ? v * f.chfUsd
              : v / (f.usdJpy * 10);

function Unranked({ rows, label }: { rows: Company[]; label: string }) {
  return (
    <div>
      {rows.map((c) => (
        <div key={c.id} className="compare-rank-row compare-unranked-row">
          <b className="compare-rank-num">—</b>
          <div className="compare-rank-info">
            <strong>{c.name}</strong>
            <small style={{ display: 'block' }}>{c.region}</small>
          </div>
          <span className="meta compare-rank-val compare-unranked-label">{label}</span>
        </div>
      ))}
    </div>
  );
}

export default function CompanyCompare() {
  const [fx, setFx] = useState<Fx>(fallback);
  const [live, setLive] = useState(false);
  const [capExpanded, setCapExpanded] = useState(false);
  const [capRegion, setCapRegion] = useState<CapacityRegion>('Global');
  const [revExpanded, setRevExpanded] = useState(false);
  const [revRegion, setRevRegion] = useState<CapacityRegion>('Global');

  useEffect(() => {
    api
      .get('/api/fx')
      .then((r) => {
        const d = r.data as Fx;
        if (
          d.usdJpy > 0 &&
          d.audUsd > 0 &&
          d.cadUsd > 0 &&
          d.eurUsd > 0 &&
          d.gbpUsd > 0 &&
          d.chfUsd > 0
        ) {
          setFx(d);
          setLive(!d.partial);
        }
      })
      .catch(() => setLive(false));
  }, []);

  const capRanked = useMemo(
    () =>
      capacityRows
        .filter(
          (r) => capRegion === 'Global' || capacityRegionOf(r.region) === capRegion
        )
        .sort((a, b) => b.capacity - a.capacity),
    [capRegion]
  );

  const revenue = useMemo(
    () =>
      raws
        .filter((r) => {
          const company = allCompanies.find((c) => c.id === r.id);
          return (
            revRegion === 'Global' ||
            (!!company && capacityRegionOf(company.region) === revRegion)
          );
        })
        .map((r) => ({
          id: r.id,
          name: r.name,
          period: r.period,
          usd: conv(r.value, r.currency, fx),
          segments: r.segments.map((s) => ({
            ...s,
            usd: conv(s.value, r.currency, fx)
          })),
          source: r.source,
          sourceName: r.sourceName,
          note: r.note
        }))
        .sort((a, b) => b.usd - a.usd),
    [fx, revRegion]
  );

  const capIds = new Set(capRanked.map((r) => r.id));
  const revIds = new Set(revenue.map((r) => r.id));

  const capUnranked = allCompanies.filter(
    (c) =>
      (capRegion === 'Global' || capacityRegionOf(c.region) === capRegion) &&
      !capIds.has(c.id)
  );

  const revUnranked = allCompanies.filter(
    (c) =>
      (revRegion === 'Global' || capacityRegionOf(c.region) === revRegion) &&
      !revIds.has(c.id)
  );

  const shownCaps = capExpanded ? capRanked : capRanked.slice(0, 10);
  const shownRevenue = revExpanded ? revenue : revenue.slice(0, 10);

  const maxCap = Math.max(1, ...capRanked.map((r) => r.capacity));
  const selectedMillsPreferredCount = capRanked.filter((r) => r.status === 'Current').length;
  const selectedFallbackCapacityCount = capRanked.filter(
    (r) => r.status === 'Reference'
  ).length;

  const maxRev = Math.max(1, ...revenue.map((r) => r.usd));
  const fxTime = new Date(fx.asOf).toLocaleString('ja-JP', {
    timeZone: 'Asia/Tokyo'
  });

  return (
    <section className="section">
      <div className="career-hero">
        <div className="career-hero-badge">
          <TrendingUp size={14} />
          <span>GLOBAL MILLING BENCHMARKS</span>
        </div>
        <h1>製粉会社・小麦粉メーカーランキング</h1>
        <p>主要メーカーの製粉能力（t/day）と売上規模の比較です。</p>
      </div>

      <div style={{ display: 'grid', gap: 18 }}>
        <article className="story">
          <div
            style={{
              display: 'flex',
              justify: 'space-between',
              alignItems: 'baseline',
              flexWrap: 'wrap',
              gap: 10,
              marginBottom: 12
            }}
          >
            <h2 style={{ margin: 0, maxWidth: '100%', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
              {capacityHeadings[capRegion]}
            </h2>
            <span className="meta">単位：t/day（日産能力）</span>
          </div>

          <div
            className="career-pills-scroll"
            role="group"
            aria-label="製粉能力ランキング地域"
            style={{ marginBottom: 18 }}
          >
            {capacityRegions.map((r) => (
              <button
                key={r}
                type="button"
                className={'pill-chip ' + (capRegion === r ? 'active' : '')}
                onClick={() => {
                  setCapRegion(r);
                  setCapExpanded(false);
                }}
              >
                {REGION_LABELS[r]}
              </button>
            ))}
          </div>

          {shownCaps.map((r, i) => {
            const millId = millIdMap[r.id] || r.id;
            const hasCompany = !!getListedScore(r.id);
            const hasMill = groups.some((g) => g.id === millId);
            return (
              <div key={r.id} className="compare-rank-card">
                <div className="compare-rank-row">
                  <b className="compare-rank-num">#{i + 1}</b>
                  <div className="compare-rank-info">
                    <strong>
                      {hasCompany ? (
                        <a href={appHref('company/' + r.id)}>{r.name}</a>
                      ) : (
                        r.name
                      )}
                    </strong>
                    <small style={{ display: 'block' }}>
                      {r.region} · {r.status || 'Reference'}
                      {r.partial ? ' · Partial' : ''} · {r.period}
                    </small>
                    {hasMill && (
                      <a href={appHref('mills/' + millId)} className="meta">
                        工場・製粉能力を見る →
                      </a>
                    )}
                  </div>
                  <b className="compare-rank-val">{r.label}</b>
                </div>
                <div className="compare-bar-track">
                  <div
                    className="compare-bar-fill"
                    style={{ width: (r.capacity / maxCap) * 100 + '%' }}
                  />
                </div>
                <p className="meta">{r.basis}</p>
                <a href={r.source} target="_blank" rel="noreferrer">
                  {r.sourceName} <ExternalLink size={14} />
                </a>
              </div>
            );
          })}

          {capExpanded && (
            <>
              <h4>順位未算出</h4>
              <p className="meta">
                会社はランキング母集団に含めていますが、比較可能なグループ総日産能力を公開資料で確認できていません。
              </p>
              <Unranked rows={capUnranked} label="比較可能な能力未確認" />
            </>
          )}

          {(capRanked.length > 10 || capUnranked.length > 0) && (
            <button className="pill" onClick={() => setCapExpanded((v) => !v)}>
              {capExpanded
                ? '上位10社だけ表示'
                : '11位以下・未確認も見る（' +
                  (Math.max(0, capRanked.length - 10) + capUnranked.length) +
                  '社）'}
            </button>
          )}

          <details className="mills-method-note" style={{ marginTop: 16 }}>
            <summary>製粉能力（t/day）の集計・換算基準について</summary>
            <p>
              日産のmilling / grinding capacityとして比較可能な公表値を順位化しています。原料小麦処理量、小麦粉生産量、設備能力など公表basisが異なる場合があるため、厳密な同一規格の順位ではなく、製粉会社・小麦粉メーカーの規模感を比較する参考値です。月産で公表された明確な製粉能力は25稼働日/月として日産換算する場合があります。
            </p>
            <p>
              会社全体の工場数に対して、能力を確認できている工場だけを合計している場合は「Partial」と明記しています。
            </p>
            <p className="meta">
              表示地域 {capRegion} · 順位付き {capRanked.length}社。Mills優先{' '}
              {selectedMillsPreferredCount}社 / Compare fallback{' '}
              {selectedFallbackCapacityCount}社。Global全体はMills優先{' '}
              {millsPreferredCount}社 / fallback {fallbackCapacityCount}社。
            </p>
          </details>
        </article>

        <article className="story">
          <div
            style={{
              display: 'flex',
              justify: 'space-between',
              alignItems: 'baseline',
              flexWrap: 'wrap',
              gap: 10,
              marginBottom: 12
            }}
          >
            <h2 style={{ margin: 0, maxWidth: '100%', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
              製粉会社・関連企業の売上高ランキング
            </h2>
            <span className="meta">単位：米ドル（USD換算）</span>
          </div>

          <div
            className="career-pills-scroll"
            role="group"
            aria-label="公開売上高ランキング地域"
            style={{ marginBottom: 18 }}
          >
            {capacityRegions.map((r) => (
              <button
                key={r}
                type="button"
                className={'pill-chip ' + (revRegion === r ? 'active' : '')}
                onClick={() => {
                  setRevRegion(r);
                  setRevExpanded(false);
                }}
              >
                {REGION_LABELS[r]}
              </button>
            ))}
          </div>

          {shownRevenue.map((r, i) => (
            <div key={r.id} className="compare-rank-card">
              <div className="compare-rank-row">
                <b className="compare-rank-num">#{i + 1}</b>
                <div className="compare-rank-info">
                  <strong>{r.name}</strong>
                  <small style={{ display: 'block' }}>{r.period}</small>
                </div>
                <b className="compare-rank-val">${r.usd.toFixed(r.usd < 1 ? 2 : 1)}B</b>
              </div>
              <div className="compare-bar-track compare-revenue-bar-track">
                <div
                  className="compare-revenue-bar-fill"
                  style={{ width: (r.usd / maxRev) * 100 + '%' }}
                >
                  {r.segments.map((s) => (
                    <div
                      key={s.label}
                      title={s.label + ' $' + s.usd.toFixed(2) + 'B'}
                      style={{
                        height: '100%',
                        width: (s.usd / r.usd) * 100 + '%',
                        background: s.color,
                        minWidth: s.usd / r.usd > 0.01 ? 2 : 1
                      }}
                    />
                  ))}
                </div>
              </div>
              <div className="compare-segment-tags">
                {r.segments
                  .filter((s) => s.usd / r.usd > 0.01)
                  .map((s) => (
                    <span key={s.label} className="compare-segment-tag">
                      {s.label} ${s.usd.toFixed(2)}B
                    </span>
                  ))}
              </div>
              {r.note && <p className="meta">{r.note}</p>}
              <a href={r.source} target="_blank" rel="noreferrer">
                {r.sourceName} <ExternalLink size={14} />
              </a>
            </div>
          ))}

          {revExpanded && (
            <>
              <h4>順位未算出</h4>
              <p className="meta">
                会社はランキング母集団に含めていますが、比較可能な公開売上高を確認できていません。
              </p>
              <Unranked rows={revUnranked} label="公開売上高未確認" />
            </>
          )}

          {(revenue.length > 10 || revUnranked.length > 0) && (
            <button className="pill" onClick={() => setRevExpanded((v) => !v)}>
              {revExpanded
                ? '上位10社だけ表示'
                : '11位以下・未確認も見る（' +
                  (Math.max(0, revenue.length - 10) + revUnranked.length) +
                  '社）'}
            </button>
          )}

          <p className="meta">
            表示地域 {revRegion} · 順位付き {revenue.length}
            社。各社の公開売上高を共通為替レートでUSD換算して比較しています。
          </p>
        </article>

        <div className="note-box">
          <div>
            <b>為替レート換算基準（FX REFERENCE） · {live ? 'LIVE' : 'FALLBACK'}</b>
            <p>
              1 USD = ¥{fx.usdJpy.toFixed(2)} / 1 AUD = ${fx.audUsd.toFixed(4)} / 1
              CAD = ${fx.cadUsd.toFixed(4)} / 1 EUR = ${fx.eurUsd.toFixed(4)} / 1 GBP
              = ${fx.gbpUsd.toFixed(4)} / 1 CHF = ${fx.chfUsd.toFixed(4)} · {fxTime}{' '}
              JST
            </p>
            <p className="meta">
              各国の現地通貨による売上高を、上記レートを用いて米ドル（USD）へ統一換算して比較しています。
            </p>
          </div>
        </div>

        <section className="story">
          <h2>製粉会社ランキングについてよくある質問</h2>
          <details>
            <summary>
              <b>日本で大きな製粉会社は？</b>
            </summary>
            <p>
              公開されている製粉能力や企業規模から比較できます。ただし会社ごとに能力のbasisや公表時点、確認できている工場数が異なるため、地域別ランキングの数値とPartial表示、出典を合わせて確認してください。
            </p>
          </details>
          <details>
            <summary>
              <b>製粉能力ランキングは何を基準にしていますか？</b>
            </summary>
            <p>
              公開資料で確認できる日産製粉能力t/dayを基本に使用し、明確な月産製粉能力は25稼働日/月として日産換算する場合があります。公表basisが異なるため参考比較として掲載しています。
            </p>
          </details>
          <details>
            <summary>
              <b>売上高と製粉能力では順位が違うのですか？</b>
            </summary>
            <p>
              異なります。食品・製油・飼料など製粉以外の事業を持つ企業もあるため、企業全体の売上高と製粉設備の規模は別の指標として比較しています。
            </p>
          </details>
          <details>
            <summary>
              <b>製粉会社と小麦粉メーカーは同じですか？</b>
            </summary>
            <p>
              小麦を製粉して小麦粉を製造する企業は、一般に製粉会社・製粉メーカー・小麦粉メーカーなどと呼ばれます。本ランキングでは、小麦粉製造・製粉事業を持つ企業を主な比較対象としています。
            </p>
          </details>
        </section>

        <section className="story">
          <h2>製粉会社・工場をさらに調べる</h2>
          <p>
            ランキングだけでなく、企業一覧、製粉工場、採用情報の公開情報も既存データから確認できます。
          </p>
          <a className="pill" href={appHref('companies/japan')}>
            日本の製粉会社一覧 →
          </a>
          <a className="pill" href={appHref('mills')}>
            製粉工場を探す →
          </a>
          <a className="pill" href={appHref('career')}>
            採用情報 →
          </a>
        </section>

        <div className="equipment-cta-banner" style={{ margin: '28px 0 16px' }}>
          <div>
            <h3>掲載データに関するご意見・情報提供・お問い合わせ</h3>
            <p>
              製粉能力や売上高の最新公表データ、追加掲載のリクエストなどを受け付けています。
            </p>
          </div>
          <a className="equipment-cta-button" href={appHref('contact')}>
            情報提供・お問い合わせ窓口へ →
          </a>
        </div>
      </div>
    </section>
  );
}
