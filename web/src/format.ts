const nf = new Intl.NumberFormat("ja-JP");

/** 3桁区切り。0（または空）は「-」 */
export function yen(v: number | null | undefined): string {
  if (v === null || v === undefined || v === 0) return "-";
  return nf.format(v);
}

/** セル入力の文字列を整数に。カンマ・全角数字・「-」に対応。不正なら null */
export function parseAmount(input: unknown): number | null {
  if (typeof input === "number") return Number.isSafeInteger(input) ? input : null;
  if (input === null || input === undefined) return 0;
  const s = String(input)
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[，,\s円¥￥]/g, "")
    .replace(/[－−ー]/g, "-")
    .trim();
  if (s === "" || s === "-") return 0;
  if (!/^-?\d+$/.test(s)) return null;
  const n = Number(s);
  return Number.isSafeInteger(n) ? n : null;
}

/** 2026-11 → 2026年11月 */
export function monthLabel(m: string): string {
  const [y, mm] = m.split("-");
  return `${y}年${Number(mm)}月`;
}

/** 2026-11-02 → 11/2(月) */
export function dateLabel(d: string): string {
  const dt = new Date(`${d}T00:00:00Z`);
  const w = "日月火水木金土"[dt.getUTCDay()];
  return `${dt.getUTCFullYear()}/${dt.getUTCMonth() + 1}/${dt.getUTCDate()}(${w})`;
}

/** 今日を含む月。期間外なら期間の最初の月 */
export function defaultMonth(months: string[]): string {
  const now = new Date().toISOString().slice(0, 7);
  return months.includes(now) ? now : months[0];
}
