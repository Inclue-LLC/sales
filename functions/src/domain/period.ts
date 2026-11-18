// 月・週の計算。タイムゾーンの影響を受けないよう、すべて UTC の日付として扱う。

import type { WeekInfo } from "./types";

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isMonth(s: unknown): s is string {
  return typeof s === "string" && MONTH_RE.test(s);
}

export function isDate(s: unknown): s is string {
  if (typeof s !== "string" || !DATE_RE.test(s)) return false;
  const d = parseDate(s);
  return formatDate(d) === s;
}

export function parseDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function monthOf(d: Date): string {
  return d.toISOString().slice(0, 7);
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86400000);
}

/** start〜end（両端含む）の YYYY-MM 一覧 */
export function listMonths(start: string, end: string): string[] {
  if (!isMonth(start) || !isMonth(end) || start > end) return [];
  const out: string[] = [];
  let [y, m] = start.split("-").map(Number);
  for (;;) {
    const s = `${y}-${String(m).padStart(2, "0")}`;
    out.push(s);
    if (s === end) break;
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
}

/** その月の最初の木曜日 */
function firstThursday(month: string): Date {
  const d = parseDate(`${month}-01`);
  const offset = (4 - d.getUTCDay() + 7) % 7; // 4 = Thursday
  return addDays(d, offset);
}

/** その月の最後の木曜日 */
function lastThursday(month: string): Date {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)); // 月末日
  const offset = (last.getUTCDay() - 4 + 7) % 7;
  return addDays(last, -offset);
}

/**
 * 期間内の週一覧（月曜始まり・日曜終わり）。
 * - 第1週: 木曜日が開始月に入る最初の週
 * - 最終週: 木曜日が終了月に入る最後の週
 * - 計上月: 木曜日が属する月（overrides で手動上書き。期間外の月への上書きは無視）
 */
export function listWeeks(
  startMonth: string,
  endMonth: string,
  overrides: Record<string, string | null> = {},
): WeekInfo[] {
  const months = listMonths(startMonth, endMonth);
  if (months.length === 0) return [];
  const monthSet = new Set(months);
  const out: WeekInfo[] = [];
  const lastThu = lastThursday(endMonth);
  let no = 1;
  for (let thu = firstThursday(startMonth); thu <= lastThu; thu = addDays(thu, 7)) {
    const weekStart = formatDate(addDays(thu, -3));
    const autoMonth = monthOf(thu);
    const ov = overrides[weekStart] ?? null;
    const validOverride = ov && monthSet.has(ov) ? ov : null;
    out.push({
      no: no++,
      weekStart,
      weekEnd: formatDate(addDays(thu, 3)),
      autoMonth,
      overrideMonth: validOverride,
      bookingMonth: validOverride ?? autoMonth,
    });
  }
  return out;
}
