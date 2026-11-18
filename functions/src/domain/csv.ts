// CSV 生成。Excel で文字化けしないよう BOM 付き UTF-8。数値は区切りなしの整数で出す。

import {
  COUNTRY_LABELS,
  VALUE_FIELDS,
  VALUE_FIELD_LABELS,
  type Deal,
  type MonthlyPl,
  type WeeklyView,
} from "./types";

const BOM = "﻿";

function cell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(lines: unknown[][]): string {
  return BOM + lines.map((l) => l.map(cell).join(",")).join("\r\n") + "\r\n";
}

const indent = (level: number) => "　".repeat(level);

export function monthlyPlCsv(pl: MonthlyPl): string {
  const head1: unknown[] = ["区分"];
  const head2: unknown[] = [""];
  for (const m of pl.months) {
    for (const f of VALUE_FIELDS) {
      head1.push(m);
      head2.push(VALUE_FIELD_LABELS[f]);
    }
  }
  const lines: unknown[][] = [head1, head2];
  for (const r of pl.rows) {
    const line: unknown[] = [indent(r.level) + r.label];
    for (const m of pl.months) {
      for (const f of VALUE_FIELDS) line.push(r.kind === "header" ? "" : (r.values[m]?.[f] ?? 0));
    }
    lines.push(line);
  }
  return toCsv(lines);
}

export function weeklyCsv(view: WeeklyView): string {
  const head1: unknown[] = ["週番号", "週開始日", "週終了日", "計上月", "計上月上書き"];
  const head2: unknown[] = ["", "", "", "", ""];
  for (const c of view.categories) {
    for (const f of VALUE_FIELDS) {
      head1.push(COUNTRY_LABELS[c.country]);
      head2.push(VALUE_FIELD_LABELS[f]);
    }
  }
  for (const f of VALUE_FIELDS) {
    head1.push("合計");
    head2.push(VALUE_FIELD_LABELS[f]);
  }
  const lines: unknown[][] = [head1, head2];
  for (const g of view.groups) {
    for (const w of g.weeks) {
      const line: unknown[] = [w.no, w.weekStart, w.weekEnd, w.bookingMonth, w.overrideMonth ? "○" : ""];
      for (const c of view.categories) for (const f of VALUE_FIELDS) line.push(w.values[c.id][f]);
      for (const f of VALUE_FIELDS) line.push(w.total[f]);
      lines.push(line);
    }
    const sub: unknown[] = ["", "", "", g.month, "小計"];
    for (const c of view.categories) for (const f of VALUE_FIELDS) sub.push(g.subtotal.values[c.id][f]);
    for (const f of VALUE_FIELDS) sub.push(g.subtotal.total[f]);
    lines.push(sub);
  }
  return toCsv(lines);
}

export function dealsCsv(deals: Deal[]): string {
  const lines: unknown[][] = [
    [
      "No",
      "国",
      "キャラクター",
      "ライセンシー",
      "案件名・内容",
      "商品カテゴリ",
      "契約形態",
      "ステータス",
      "契約開始日",
      "契約終了日",
      "ロイヤリティ率(%)",
      "MG・契約金額",
      "担当",
      "備考",
    ],
  ];
  for (const d of [...deals].sort((a, b) => a.no - b.no)) {
    lines.push([
      d.no,
      COUNTRY_LABELS[d.country],
      d.character,
      d.licensee,
      d.title,
      d.productCategory,
      d.contractType,
      d.status,
      d.startDate,
      d.endDate,
      d.royaltyRate,
      d.amount,
      d.owner,
      d.note,
    ]);
  }
  return toCsv(lines);
}
