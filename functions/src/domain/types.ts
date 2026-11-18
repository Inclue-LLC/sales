// 画面・サーバー・CSV で共有するドメイン型。
// web 側からも type-only import で参照する（実行時コードは持ち込まない）。

export type Country = "JP" | "CN";
export const COUNTRIES: Country[] = ["JP", "CN"];
export const COUNTRY_LABELS: Record<Country, string> = { JP: "日本", CN: "中国" };

/** 値の種類：目標／予定／入金済み */
export type ValueField = "target" | "plan" | "paid";
export const VALUE_FIELDS: ValueField[] = ["target", "plan", "paid"];
export const VALUE_FIELD_LABELS: Record<ValueField, string> = {
  target: "目標",
  plan: "予定",
  paid: "入金済み",
};

export interface Triple {
  target: number;
  plan: number;
  paid: number;
}

/** 通貨コード。今回は JPY のみ。将来 CNY 入力→円換算を追加できるよう保存時に持たせる。 */
export type CurrencyCode = "JPY" | "CNY";

export type Granularity = "monthly" | "weekly";

/**
 * 入力カテゴリ（PL の入力行 1 行に相当）。
 * Firestore の categories コレクションに保存し、将来は画面から追加・変更できる。
 */
export interface Category {
  id: string; // 例: JP_LICENSE
  country: Country;
  groupKey: string; // 中カテゴリ: license / goods / other
  groupLabel: string;
  groupOrder: number;
  subKey: string | null; // 小カテゴリ: online / offline / null
  subLabel: string | null;
  subOrder: number;
  granularity: Granularity;
}

export interface Settings {
  startMonth: string; // YYYY-MM
  endMonth: string; // YYYY-MM
  currencyLabel: string; // 表示ラベル（例: 円）
}

export const DEFAULT_SETTINGS: Settings = {
  startMonth: "2026-11",
  endMonth: "2027-12",
  currencyLabel: "円",
};

export interface Masters {
  characters: string[];
  contractTypes: string[];
}

export const DEFAULT_MASTERS: Masters = {
  characters: ["スタジオハヌル", "Lovely MongMong", "ふにゅ"],
  contractTypes: ["ロイヤリティ", "MG+ロイヤリティ", "一括", "コラボ", "POP UP"],
};

// ---------- 月次PL ----------

export type PlRowKind = "header" | "input" | "auto";

export interface PlRow {
  key: string;
  label: string;
  /** インデント階層（0: 国/合計, 1: 中カテゴリ, 2: 小カテゴリ） */
  level: number;
  kind: PlRowKind;
  /** 入力行のときだけ入る */
  categoryId?: string;
  /** 月 → 3値。header 行では空 */
  values: Record<string, Triple>;
  /** 小計・合計などの強調表示 */
  emphasis?: "subtotal" | "total" | "grand";
}

export interface MonthlyPl {
  settings: Settings;
  months: string[];
  rows: PlRow[];
}

// ---------- 週次 ----------

export interface WeekInfo {
  no: number;
  weekStart: string; // YYYY-MM-DD（月曜）
  weekEnd: string; // YYYY-MM-DD（日曜）
  autoMonth: string; // 木曜日が属する月
  overrideMonth: string | null; // 手動で上書きした計上月
  bookingMonth: string; // 実際の計上月
}

export interface WeeklyRow extends WeekInfo {
  /** categoryId → 3値 */
  values: Record<string, Triple>;
  total: Triple;
}

export interface WeeklyMonthGroup {
  month: string;
  weeks: WeeklyRow[];
  subtotal: { values: Record<string, Triple>; total: Triple };
}

export interface WeeklyView {
  settings: Settings;
  months: string[];
  /** 週次入力のカテゴリ（国ごとのオンライン） */
  categories: Category[];
  groups: WeeklyMonthGroup[];
}

// ---------- ライセンス案件 ----------

export const DEAL_STATUSES = ["提案中", "交渉中", "契約済", "進行中", "終了", "失注"] as const;
export type DealStatus = (typeof DEAL_STATUSES)[number];

export interface DealInput {
  country: Country;
  character: string;
  licensee: string;
  title: string;
  productCategory: string;
  contractType: string;
  status: DealStatus;
  startDate: string | null; // YYYY-MM-DD
  endDate: string | null;
  royaltyRate: number | null; // %（例: 5.5）
  amount: number | null; // 円・整数
  owner: string;
  note: string;
}

export interface Deal extends DealInput {
  id: string;
  no: number;
  createdAt: string;
  updatedAt: string;
}

export interface Member {
  uid: string;
  email: string;
  displayName: string;
}
