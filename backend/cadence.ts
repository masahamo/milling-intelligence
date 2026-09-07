// Fixed source slots: adding/reordering watchers never shifts existing schedules.
// Start on the next JST day after rollout; pre-rollout history remains daily.
export const rotationStart = '2026-09-08';
export const rotationDays = 91;
type Source = { cadence: string; rotationDay?: number };
const dayNumber = (day: string) => Math.floor(Date.parse(day + 'T00:00:00Z') / 86400000);
export function isScheduled(source: Source, day: string) {
  if (source.cadence === 'daily' || day < rotationStart) return true;
  return (dayNumber(day) - dayNumber(rotationStart)) % rotationDays === source.rotationDay;
}
export function nextScheduledDay(source: Source, day: string) {
  if (source.cadence === 'daily' || day < rotationStart) return day;
  const elapsed = dayNumber(day) - dayNumber(rotationStart);
  const wait = ((source.rotationDay || 0) - elapsed % rotationDays + rotationDays) % rotationDays;
  return new Date((dayNumber(day) + wait) * 86400000).toISOString().slice(0, 10);
}
type Saved = {day?:string;status?:string;message?:string;successAt?:string};
export function sourceDiagnostics(source: Source, day: string, row: Saved | null, asOf: number) {
  // An actual attempt always wins, including old daily rows on new off-days.
  const scheduled = isScheduled(source, day);
  const status = row?.day === day ? row.status || 'pending' : scheduled ? 'pending' : 'skipped';
  const message = status === 'skipped' ? '本日は取得予定対象外。保存済み情報を保持。' : row?.day === day ? row.message || '実行記録あり' : 'この日の実行記録はまだありません。';
  const maxAge = source.cadence === 'quarterly' && day >= rotationStart ? (rotationDays + 2) * 86400000 : 30 * 3600000;
  const stale = !row?.successAt || !Number.isFinite(Date.parse(row.successAt)) || asOf - Date.parse(row.successAt) > maxAge || row?.status === 'failed' || row?.status === 'cooldown';
  return {cadence:source.cadence,scheduled,status,message,day,nextScheduledDay:nextScheduledDay(source,day),lastStatus:row?.status||null,lastMessage:row?.message||null,stale};
}
