// 集計（唯一の計算箇所）。1ページ目・週次・CSV はすべてここの結果を使う。
import { listMonths, listWeeks } from "./period";
import {
  COUNTRIES,
  ONLINE_CHANNELS,
  COUNTRY_TARGETS,
  COUNTRY_LABELS,
  LINES,
  type Channel,
  type Country,
  type Entry,
  type OnlineMonth,
  type OnlineView,
  type Settings,
  type Summary,
  type SummaryRow,
  currencyOf,
  toCny,
} from "./types";

export interface RawData {
  settings: Settings;
  entries: Entry[];
  /** 国 → weekStart → 内訳別金額（中国=元、日本=円） */
  online: Record<Country, Map<string, Partial<Record<Channel, number>>>>;
  /** weekStart → 手動の計上月 */
  weekOverrides: Record<string, string | null>;
  /** 画面に出すお知らせ（請求書ツールを読み込めなかった など） */
  notices?: string[];
}

const emptyMonths = (months: string[]) => Object.fromEntries(months.map((m) => [m, 0])) as Record<string, number>;

function sum(rows: Record<string, number>[], months: string[]): Record<string, number> {
  const out = emptyMonths(months);
  for (const r of rows) for (const m of months) out[m] += r[m] ?? 0;
  return out;
}

export function buildOnline(raw: RawData, country: Country): OnlineView {
  const { settings } = raw;
  const currency = currencyOf(country);
  const channels = ONLINE_CHANNELS[country];
  const cny = (v: number) => toCny(v, currency, settings.jpyPerCny);
  const months = listMonths(settings.startMonth, settings.endMonth);
  const zero = () => Object.fromEntries(channels.map((c) => [c.key, 0])) as Record<Channel, number>;
  const groups = new Map<string, OnlineMonth>(
    months.map((m) => [m, { month: m, weeks: [], subtotal: zero(), subtotalCny: zero(), total: 0, totalCny: 0 }]),
  );
  for (const w of listWeeks(settings.startMonth, settings.endMonth, raw.weekOverrides)) {
    const src = raw.online[country].get(w.weekStart) ?? {};
    const values = zero();
    for (const c of channels) values[c.key] = src[c.key] ?? 0;
    const total = channels.reduce((a, c) => a + values[c.key], 0);
    const g = groups.get(w.bookingMonth);
    if (!g) continue;
    g.weeks.push({ ...w, values, total, totalCny: cny(total) });
    for (const c of channels) g.subtotal[c.key]! += values[c.key];
    g.total += total;
  }
  // 元への換算は月の内訳ごとに行い、月合計はその和にする（売上一覧の内訳と合計を一致させる）
  for (const g of groups.values()) {
    for (const c of channels) g.subtotalCny[c.key] = cny(g.subtotal[c.key] ?? 0);
    g.totalCny = channels.reduce((a, c) => a + (g.subtotalCny[c.key] ?? 0), 0);
  }
  return { country, currency, settings, months, groups: [...groups.values()] };
}

export function buildSummary(raw: RawData): Summary {
  const { settings } = raw;
  const months = listMonths(settings.startMonth, settings.endMonth);
  const online = Object.fromEntries(COUNTRIES.map((c) => [c, buildOnline(raw, c)])) as Record<Country, OnlineView>;

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
        for (const g of online[country].groups) sales[g.month] = g.totalCny;
      } else {
        for (const m of months) sales[m] = entrySales.get(`${l.source}|${country}|${m}`) ?? 0;
      }
      const row: SummaryRow = { key: l.id, label: l.label, kind: "line", target: null, sales };
      rows.push(row);
      lineRows.push(row);
      if (l.source === "online") {
        for (const c of ONLINE_CHANNELS[country]) {
          const cs = emptyMonths(months);
          for (const g of online[country].groups) cs[g.month] = g.subtotalCny[c.key] ?? 0;
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
  return { notices: raw.notices ?? [], settings, months, rows };
}
