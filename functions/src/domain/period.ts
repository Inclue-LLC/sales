// 月・週の計算。タイムゾーンの影響を受けないよう、すべて UTC の日付として扱う。
import type { Week } from "./types";

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function isMonth(s: unknown): s is string {
  return typeof s === "string" && MONTH_RE.test(s);
}

function parseDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
const fmt = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);

/** start〜end（両端含む）の YYYY-MM 一覧 */
export function listMonths(start: string, end: string): string[] {
  if (!isMonth(start) || !isMonth(end) || start > end) return [];
  const out: string[] = [];
  let [y, m] = start.split("-").map(Number);
  for (;;) {
    const s = `${y}-${String(m).padStart(2, "0")}`;
    out.push(s);
    if (s === end) return out;
    if (++m > 12) {
      m = 1;
      y++;
    }
  }
}

/**
 * 期間内の週（月曜始まり・日曜終わり）。
 * 計上月は「木曜日が属する月」。第1週は木曜日が開始月に入る最初の週、最終週は木曜日が終了月に入る最後の週。
 * overrides で計上月を手動変更できる（期間外の月は無視）。
 */
export function listWeeks(startMonth: string, endMonth: string, overrides: Record<string, string | null> = {}): Week[] {
  const months = listMonths(startMonth, endMonth);
  if (months.length === 0) return [];
  const monthSet = new Set(months);
  const first = parseDate(`${startMonth}-01`);
  let thu = addDays(first, (4 - first.getUTCDay() + 7) % 7);
  const [ey, em] = endMonth.split("-").map(Number);
  const lastDay = new Date(Date.UTC(ey, em, 0));
  const lastThu = addDays(lastDay, -((lastDay.getUTCDay() - 4 + 7) % 7));
  const out: Week[] = [];
  for (let no = 1; thu <= lastThu; no++, thu = addDays(thu, 7)) {
    const weekStart = fmt(addDays(thu, -3));
    const autoMonth = fmt(thu).slice(0, 7);
    const ov = overrides[weekStart];
    const overrideMonth = ov && monthSet.has(ov) && ov !== autoMonth ? ov : null;
    out.push({
      no,
      weekStart,
      weekEnd: fmt(addDays(thu, 3)),
      autoMonth,
      overrideMonth,
      bookingMonth: overrideMonth ?? autoMonth,
    });
  }
  return out;
}
