// 入力チェック。クライアントから来た値はすべてここを通す。
import { isMonth } from "./period";
import { COUNTRIES, LICENSE_TYPES, OFFLINE_TYPES, type EntryInput, type EntryKind, type Settings } from "./types";

export class ValidationError extends Error {}
const fail = (msg: string): never => {
  throw new ValidationError(msg);
};

export function amount(v: unknown, name = "金額"): number {
  if (v === null || v === undefined || v === "") return 0;
  const n = typeof v === "string" ? Number(v.replace(/,/g, "")) : v;
  if (typeof n !== "number" || !Number.isSafeInteger(n)) fail(`${name}は整数（円）で入力してください`);
  return n as number;
}

export function month(v: unknown, months?: string[]): string {
  if (!isMonth(v)) fail("計上月を選択してください");
  if (months && !months.includes(v as string)) fail("期間外の月です");
  return v as string;
}

function str(v: unknown, name: string, max = 100, required = false): string {
  const s = typeof v === "string" ? v.trim() : "";
  if (v !== undefined && v !== null && typeof v !== "string") fail(`${name}が不正です`);
  if (required && !s) fail(`${name}を入力してください`);
  if (s.length > max) fail(`${name}は${max}文字以内で入力してください`);
  return s;
}

function oneOf(v: unknown, options: readonly string[], name: string): string {
  if (!options.includes(v as string)) fail(`${name}を選択してください`);
  return v as string;
}

export function entry(kind: EntryKind, v: unknown): EntryInput {
  const o = (v ?? {}) as Record<string, unknown>;
  const base: EntryInput = {
    country: oneOf(o.country, COUNTRIES, "国") as EntryInput["country"],
    month: month(o.month),
    amount: amount(o.amount),
  };
  if (kind === "license")
    return { ...base, character: str(o.character, "キャラクター", 50, true), type: oneOf(o.type, LICENSE_TYPES, "種別") };
  if (kind === "offline")
    return {
      ...base,
      character: str(o.character, "キャラクター", 50, true),
      type: oneOf(o.type, OFFLINE_TYPES, "種別"),
      venue: str(o.venue, "お店・イベント名", 100, true),
    };
  return { ...base, content: str(o.content, "案件内容", 200, true) };
}

export function kind(v: unknown): EntryKind {
  if (v !== "license" && v !== "offline" && v !== "other") fail("種類が不正です");
  return v as EntryKind;
}

export function settings(v: unknown): Settings {
  const o = (v ?? {}) as Record<string, unknown>;
  if (!Array.isArray(o.characters)) fail("キャラクター候補が不正です");
  const s: Settings = {
    startMonth: month(o.startMonth),
    endMonth: month(o.endMonth),
    currencyLabel: str(o.currencyLabel, "通貨ラベル", 10) || "円",
    characters: [...new Set((o.characters as unknown[]).map((c) => str(c, "キャラクター", 50)).filter(Boolean))],
  };
  if (s.startMonth > s.endMonth) fail("終了月は開始月以降にしてください");
  return s;
}
