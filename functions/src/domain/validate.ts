// 入力チェック。クライアントから来た値はすべてここを通す。

import { isDate, isMonth } from "./period";
import {
  COUNTRIES,
  DEAL_STATUSES,
  VALUE_FIELDS,
  type DealInput,
  type Masters,
  type Settings,
  type ValueField,
} from "./types";

export class ValidationError extends Error {}

function fail(msg: string): never {
  throw new ValidationError(msg);
}

export function amount(v: unknown, name = "金額"): number {
  // 空欄は 0 扱い。マイナス（返品・取消）は許可。
  if (v === null || v === undefined || v === "") return 0;
  const n = typeof v === "string" ? Number(v.replace(/,/g, "")) : v;
  if (typeof n !== "number" || !Number.isSafeInteger(n)) fail(`${name}は整数（円）で入力してください`);
  return n;
}

export function field(v: unknown): ValueField {
  if (!VALUE_FIELDS.includes(v as ValueField)) fail("値の種類が不正です");
  return v as ValueField;
}

export function month(v: unknown, months?: string[]): string {
  if (!isMonth(v)) fail("月の形式が不正です（YYYY-MM）");
  if (months && !months.includes(v)) fail("期間外の月です");
  return v;
}

function str(v: unknown, max = 200): string {
  if (v === null || v === undefined) return "";
  if (typeof v !== "string") fail("文字列で入力してください");
  const s = v.trim();
  if (s.length > max) fail(`${max}文字以内で入力してください`);
  return s;
}

function optDate(v: unknown, name: string): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (!isDate(v)) fail(`${name}の日付が不正です`);
  return v;
}

export function settings(v: unknown): Settings {
  const o = (v ?? {}) as Record<string, unknown>;
  const s: Settings = {
    startMonth: month(o.startMonth),
    endMonth: month(o.endMonth),
    currencyLabel: str(o.currencyLabel, 10) || "円",
  };
  if (s.startMonth > s.endMonth) fail("終了月は開始月以降にしてください");
  return s;
}

export function masters(v: unknown): Masters {
  const o = (v ?? {}) as Record<string, unknown>;
  const list = (x: unknown) => {
    if (!Array.isArray(x)) fail("候補の形式が不正です");
    return [...new Set(x.map((i) => str(i, 50)).filter(Boolean))];
  };
  return { characters: list(o.characters), contractTypes: list(o.contractTypes) };
}

export function deal(v: unknown): DealInput {
  const o = (v ?? {}) as Record<string, unknown>;
  if (!COUNTRIES.includes(o.country as never)) fail("国を選択してください");
  if (!DEAL_STATUSES.includes(o.status as never)) fail("ステータスを選択してください");
  let royaltyRate: number | null = null;
  if (o.royaltyRate !== null && o.royaltyRate !== undefined && o.royaltyRate !== "") {
    const n = Number(o.royaltyRate);
    if (!Number.isFinite(n) || n < 0 || n > 100) fail("ロイヤリティ率は0〜100の数値で入力してください");
    royaltyRate = Math.round(n * 100) / 100;
  }
  const amt = o.amount === null || o.amount === undefined || o.amount === "" ? null : amount(o.amount, "MG・契約金額");
  const d: DealInput = {
    country: o.country as DealInput["country"],
    character: str(o.character, 50),
    licensee: str(o.licensee),
    title: str(o.title),
    productCategory: str(o.productCategory),
    contractType: str(o.contractType, 50),
    status: o.status as DealInput["status"],
    startDate: optDate(o.startDate, "契約開始日"),
    endDate: optDate(o.endDate, "契約終了日"),
    royaltyRate,
    amount: amt,
    owner: str(o.owner, 50),
    note: str(o.note, 5000),
  };
  if (d.startDate && d.endDate && d.startDate > d.endDate) fail("契約終了日は契約開始日以降にしてください");
  return d;
}
