// CSV（BOM 付き UTF-8・CRLF）。数値は区切りなしの整数。
import { CHANNELS, COUNTRY_LABELS, type Entry, type EntryKind, type OnlineView, type Summary } from "./types";

const BOM = "﻿";
const cell = (v: unknown) => {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const toCsv = (lines: unknown[][]) => BOM + lines.map((l) => l.map(cell).join(",")).join("\r\n") + "\r\n";

export function summaryCsv(s: Summary): string {
  const h1: unknown[] = ["区分"];
  const h2: unknown[] = [""];
  for (const m of s.months) h1.push(m, m), h2.push("目標", "売上");
  const lines: unknown[][] = [h1, h2];
  for (const r of s.rows) {
    const indent = r.kind === "line" ? "　" : r.kind === "channel" ? "　　" : "";
    const line: unknown[] = [indent + r.label];
    for (const m of s.months) {
      if (r.kind === "country") line.push("", "");
      else line.push(r.target ? r.target[m] : "", r.sales[m]);
    }
    lines.push(line);
  }
  return toCsv(lines);
}

export function onlineCsv(v: OnlineView): string {
  const lines: unknown[][] = [["週", "週開始日", "週終了日", "計上月", "手動", ...CHANNELS.map((c) => c.label), "合計"]];
  for (const g of v.groups) {
    for (const w of g.weeks) {
      lines.push([w.no, w.weekStart, w.weekEnd, w.bookingMonth, w.overrideMonth ? "○" : "", ...CHANNELS.map((c) => w.values[c.key]), w.total]);
    }
    lines.push(["", "", "", g.month, "小計", ...CHANNELS.map((c) => g.subtotal[c.key]), g.total]);
  }
  return toCsv(lines);
}

export function entriesCsv(kind: EntryKind, entries: Entry[]): string {
  const sorted = [...entries].sort((a, b) => a.month.localeCompare(b.month) || a.createdAt.localeCompare(b.createdAt));
  const c = (e: Entry) => COUNTRY_LABELS[e.country];
  if (kind === "license")
    return toCsv([["国", "キャラクター", "種別", "金額", "計上月"], ...sorted.map((e) => [c(e), e.character, e.type, e.amount, e.month])]);
  if (kind === "offline")
    return toCsv([
      ["国", "キャラクター", "種別", "お店・イベント名", "金額", "計上月"],
      ...sorted.map((e) => [c(e), e.character, e.type, e.venue, e.amount, e.month]),
    ]);
  return toCsv([["国", "案件内容", "金額", "計上月"], ...sorted.map((e) => [c(e), e.content, e.amount, e.month])]);
}
