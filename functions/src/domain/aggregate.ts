// 集計（唯一の計算箇所）。1ページ目・週次・CSV はすべてここの結果を使う。
import { listMonths, listWeeks } from "./period";
import {
  CHANNELS,
  COUNTRIES,
  COUNTRY_TARGETS,
  COUNTRY_LABELS,
  LINES,
  type Channel,
  type Entry,
  type OnlineMonth,
  type OnlineView,
  type Settings,
  type Summary,
  type SummaryRow,
  toCny,
} from "./types";

export interface RawData {
  settings: Settings;
  entries: Entry[];
  /** weekStart → チャネル別金額 */
  online: Map<string, Partial<Record<Channel, number>>>;
  /** weekStart → 手動の計上月 */
  weekOverrides: Record<string, string | null>;
}

const emptyMonths = (months: string[]) => Object.fromEntries(months.map((m) => [m, 0])) as Record<string, number>;

function sum(rows: Record<string, number>[], months: string[]): Record<string, number> {
  const out = emptyMonths(months);
  for (const r of rows) for (const m of months) out[m] += r[m] ?? 0;
  return out;
}

export function buildOnline(raw: RawData): OnlineView {
  const { settings } = raw;
  const months = listMonths(settings.startMonth, settings.endMonth);
  const zero = () => Object.fromEntries(CHANNELS.map((c) => [c.key, 0])) as Record<Channel, number>;
  const groups = new Map<string, OnlineMonth>(months.map((m) => [m, { month: m, weeks: [], subtotal: zero(), total: 0 }]));
  for (const w of listWeeks(settings.startMonth, settings.endMonth, raw.weekOverrides)) {
    const src = raw.online.get(w.weekStart) ?? {};
    const values = zero();
    for (const c of CHANNELS) values[c.key] = src[c.key] ?? 0;
    const total = CHANNELS.reduce((a, c) => a + values[c.key], 0);
    const g = groups.get(w.bookingMonth);
    if (!g) continue;
    g.weeks.push({ ...w, values, total });
    for (const c of CHANNELS) g.subtotal[c.key] += values[c.key];
    g.total += total;
  }
  return { settings, months, groups: [...groups.values()] };
}

export function buildSummary(raw: RawData): Summary {
  const { settings } = raw;
  const months = listMonths(settings.startMonth, settings.endMonth);
  const online = buildOnline(raw);

  // 案件の売上を 区分×国×月 で合計（元に換算）
  const entrySales = new Map<string, number>();
  for (const e of raw.entries) {
    const k = `${e.kind}|${e.country}|${e.month}`;
    entrySales.set(k, (entrySales.get(k) ?? 0) + toCny(e.amount, e.currency, settings.jpyPerCny));
  }

  const rows: SummaryRow[] = [];
  const countryTotals: SummaryRow[] = [];
  for (const country of COUNTRIES) {
    const lines = LINES.filter((l) => l.country === country);
    if (lines.length === 0) continue;
    // 国の行に合計を出す（下の行がそろってから値を入れる）
    const countryRow: SummaryRow = { key: country, label: COUNTRY_LABELS[country], kind: "country", target: null, sales: {} };
    rows.push(countryRow);
    const lineRows: SummaryRow[] = [];
    for (const l of lines) {
      const sales = emptyMonths(months);
      if (l.source === "online") {
        for (const g of online.groups) sales[g.month] = g.total;
      } else {
        for (const m of months) sales[m] = entrySales.get(`${l.source}|${country}|${m}`) ?? 0;
      }
      const row: SummaryRow = { key: l.id, label: l.label, kind: "line", target: null, sales };
      rows.push(row);
      lineRows.push(row);
      if (l.source === "online") {
        for (const c of CHANNELS) {
          const cs = emptyMonths(months);
          for (const g of online.groups) cs[g.month] = g.subtotal[c.key];
          rows.push({ key: `${l.id}_${c.key}`, label: c.label, kind: "channel", target: null, sales: cs });
        }
      }
    }
    countryRow.target = Object.fromEntries(months.map((m) => [m, COUNTRY_TARGETS[country]]));
    countryRow.sales = sum(lineRows.map((r) => r.sales), months);
    countryTotals.push(countryRow);
  }
  rows.push({
    key: "GRAND_TOTAL",
    label: "合計",
    kind: "grand",
    target: sum(countryTotals.map((r) => r.target!), months),
    sales: sum(countryTotals.map((r) => r.sales), months),
  });
  return { settings, months, rows };
}
