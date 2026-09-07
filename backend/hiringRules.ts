export const classificationVersion = '2026-09-07.1';
export const categories = ['Production / Operations','Engineering','Maintenance','Project / CapEx','Milling','Quality','R&D / Product Development','Supply Chain / Logistics','Procurement','Sales','Finance','IT / Digital','Management','HR','Other'] as const;
export type Category = typeof categories[number];
// Ordered, editable title rules. Domain roles take precedence over generic leadership.
export const rules: [Category, RegExp][] = [
  ['Project / CapEx', /\b(capex|project (engineer|manager)|commissioning|capital project)\b|設備投資|建設|プロジェクト/i],
  ['Maintenance', /\b(maintenance|mechanic|electrician|millwright|reliability|onderhoud|instandhaltung)\b|保全|保守/i],
  ['R&D / Product Development', /\b(r\s*&\s*d|research|scientist|product development|innovation)\b|研究|商品開発/i],
  ['Quality', /\b(quality|laboratory|lab technician|food safety|qualit[eyé]|hse|ehs)\b|品質|検査|安全衛生/i],
  ['Engineering', /\b(engineer\w*|automation|controls|technical services|technicien|ing[ée]nieur)\b|エンジニア|生産技術|自動化|設備/i],
  ['Milling', /\b(miller|milling|meunier|m[üu]ller)\b|製粉/i],
  ['Procurement', /\b(procurement|purchasing|buyer|inkoop)\b|購買|調達/i],
  ['Supply Chain / Logistics', /\b(supply chain|logistics|warehouse|driver|transport|shipping|grain handling)\b|物流|倉庫|出荷/i],
  ['IT / Digital', /\b(it|digital|software|data (engineer|scientist|analyst)|cyber|systems administrator)\b|情報システム/i],
  ['HR', /\b(hr|human resources|recruit\w*|talent)\b|人事|採用/i],
  ['Finance', /\b(financ\w*|account\w*|treasury|controller|payroll)\b|財務|経理/i],
  ['Sales', /\b(sales|marketing|commercial|business development)\b|営業/i],
  ['Production / Operations', /\b(production|operations?|manufactur\w*|operator|packaging|utility|process|harvest)\b|製造|生産|包装/i],
  ['Management', /\b(manager|director|head|president|chief|supervisor|lead)\b|管理職|経営/i],
];
export const normalizeTitle = (value: string) => value.normalize('NFKC').toLowerCase().replace(/[–—]/g,'-').replace(/\s*\((?:m\/f\/\w|f\/m\/\w)\)\s*/g,' ').replace(/\s+/g,' ').trim();
export const classify = (title: string): Category => rules.find(([,pattern]) => pattern.test(title))?.[0] || 'Other';
export function validDay(value: unknown): boolean {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
}
export function jstDay(instant: string): string {
  if (!Number.isFinite(Date.parse(instant))) throw Error('Invalid timestamp');
  return new Date(Date.parse(instant)+9*3600000).toISOString().slice(0,10);
}
export function postingDate(value: unknown, observed: string): string | null {
  if (typeof value !== 'string') return null;
  if (validDay(value)) return value <= jstDay(observed) ? value : null;
  // Require an explicit offset: never interpret a source's local clock in server timezone.
  if (/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) && validDay(value.slice(0,10)) && Number.isFinite(Date.parse(value)) && Date.parse(value)<=Date.parse(observed)) return new Date(value).toISOString();
  return null;
}
export function countryRegion(country: string | null): string | null {
  if (!country) return null;
  if (['Canada','United States','U.S.','United States of America','CA','US'].includes(country)) return 'North America';
  if (['Australia','AU','New Zealand','NZ'].includes(country)) return 'Oceania';
  if (['Japan','JP','China','CN','India','IN'].includes(country)) return 'Asia';
  if (['Austria','Belgium','France','Germany','Italy','United Kingdom','Netherlands','Poland','Czech Republic','Switzerland','Türkiye','AT','BE','FR','DE','IT','GB','NL','PL','CZ','CH','TR'].includes(country)) return 'Europe';
  return null;
}

