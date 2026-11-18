// 集計ロジック（唯一の計算箇所）。
// 月次PL・週次・CSV はすべてここの結果を使うので、画面ごとに数字が食い違わない。

import { sortCategories } from "./categories";
import { listMonths, listWeeks } from "./period";
import {
  COUNTRIES,
  COUNTRY_LABELS,
  type Category,
  type MonthlyPl,
  type PlRow,
  type Settings,
  type Triple,
  type WeeklyMonthGroup,
  type WeeklyRow,
  type WeeklyView,
} from "./types";

export const zero = (): Triple => ({ target: 0, plan: 0, paid: 0 });

export function add(a: Triple, b: Triple): Triple {
  return { target: a.target + b.target, plan: a.plan + b.plan, paid: a.paid + b.paid };
}

/** 生データ（Firestore から読んだもの） */
export interface RawData {
  settings: Settings;
  categories: Category[];
  /** key: `${categoryId}|${month}` */
  monthly: Map<string, Triple>;
  /** key: `${weekStart}|${categoryId}` */
  weekly: Map<string, Triple>;
  /** weekStart → 上書き計上月 */
  weekOverrides: Record<string, string | null>;
}

export const monthlyKey = (categoryId: string, month: string) => `${categoryId}|${month}`;
export const weeklyKey = (weekStart: string, categoryId: string) => `${weekStart}|${categoryId}`;

function sumRows(rows: PlRow[], months: string[]): Record<string, Triple> {
  const out: Record<string, Triple> = {};
  for (const m of months) {
    out[m] = rows.reduce((acc, r) => add(acc, r.values[m] ?? zero()), zero());
  }
  return out;
}

/** 週次ビュー：週ごとの値と、計上月ごとの小計 */
export function buildWeekly(raw: RawData): WeeklyView {
  const { settings } = raw;
  const months = listMonths(settings.startMonth, settings.endMonth);
  const categories = sortCategories(raw.categories.filter((c) => c.granularity === "weekly"));
  const weeks = listWeeks(settings.startMonth, settings.endMonth, raw.weekOverrides);

  const groups = new Map<string, WeeklyMonthGroup>();
  for (const m of months) {
    const values: Record<string, Triple> = {};
    for (const c of categories) values[c.id] = zero();
    groups.set(m, { month: m, weeks: [], subtotal: { values, total: zero() } });
  }

  for (const w of weeks) {
    const values: Record<string, Triple> = {};
    let total = zero();
    for (const c of categories) {
      const v = raw.weekly.get(weeklyKey(w.weekStart, c.id)) ?? zero();
      values[c.id] = v;
      total = add(total, v);
    }
    const row: WeeklyRow = { ...w, values, total };
    const g = groups.get(w.bookingMonth);
    if (!g) continue; // listWeeks が期間内の月しか返さないので通常起きない
    g.weeks.push(row);
    for (const c of categories) g.subtotal.values[c.id] = add(g.subtotal.values[c.id], values[c.id]);
    g.subtotal.total = add(g.subtotal.total, total);
  }

  return { settings, months, categories, groups: [...groups.values()] };
}

/** 月次PL */
export function buildMonthlyPl(raw: RawData): MonthlyPl {
  const { settings } = raw;
  const months = listMonths(settings.startMonth, settings.endMonth);
  const cats = sortCategories(raw.categories);

  // 週次カテゴリの月別集計（計上月ベース）
  const weekly = buildWeekly(raw);
  const weeklyByCatMonth = new Map<string, Triple>();
  for (const g of weekly.groups) {
    for (const c of weekly.categories) {
      weeklyByCatMonth.set(monthlyKey(c.id, g.month), g.subtotal.values[c.id]);
    }
  }

  const categoryValues = (c: Category): Record<string, Triple> => {
    const values: Record<string, Triple> = {};
    for (const m of months) {
      const src = c.granularity === "weekly" ? weeklyByCatMonth : raw.monthly;
      values[m] = { ...(src.get(monthlyKey(c.id, m)) ?? zero()) };
    }
    return values;
  };

  const rows: PlRow[] = [];
  const countryTotals: PlRow[] = [];

  for (const country of COUNTRIES) {
    const cc = cats.filter((c) => c.country === country);
    if (cc.length === 0) continue;
    rows.push({ key: `${country}`, label: COUNTRY_LABELS[country], level: 0, kind: "header", values: {} });

    const groupTotals: PlRow[] = [];
    const groupKeys = [...new Set(cc.map((c) => c.groupKey))];
    for (const gk of groupKeys) {
      const gc = cc.filter((c) => c.groupKey === gk);
      const isSingle = gc.length === 1 && gc[0].subKey === null;
      if (isSingle) {
        const c = gc[0];
        const row: PlRow = {
          key: c.id,
          label: c.groupLabel,
          level: 1,
          kind: c.granularity === "weekly" ? "auto" : "input",
          categoryId: c.id,
          values: categoryValues(c),
        };
        rows.push(row);
        groupTotals.push(row);
        continue;
      }
      const subRows: PlRow[] = gc.map((c) => ({
        key: c.id,
        label: `${c.groupLabel} ${c.subLabel ?? ""}`.trim(),
        level: 2,
        kind: c.granularity === "weekly" ? "auto" : "input",
        categoryId: c.id,
        values: categoryValues(c),
      }));
      rows.push(...subRows);
      const sub: PlRow = {
        key: `${country}_${gk}_TOTAL`,
        label: `${gc[0].groupLabel} 計`,
        level: 1,
        kind: "auto",
        emphasis: "subtotal",
        values: sumRows(subRows, months),
      };
      rows.push(sub);
      groupTotals.push(sub);
    }

    const total: PlRow = {
      key: `${country}_TOTAL`,
      label: `${COUNTRY_LABELS[country]} 計`,
      level: 0,
      kind: "auto",
      emphasis: "total",
      values: sumRows(groupTotals, months),
    };
    rows.push(total);
    countryTotals.push(total);
  }

  rows.push({
    key: "GRAND_TOTAL",
    label: "合計",
    level: 0,
    kind: "auto",
    emphasis: "grand",
    values: sumRows(countryTotals, months),
  });

  return { settings, months, rows };
}
