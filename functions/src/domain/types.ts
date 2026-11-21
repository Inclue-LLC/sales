// 画面・サーバー・CSV で共有する型と定数。
// web 側からも import する（依存のない純粋なモジュールにしておく）。

export type Country = "CN" | "JP";
export const COUNTRIES: Country[] = ["CN", "JP"];
export const COUNTRY_LABELS: Record<Country, string> = { CN: "中国", JP: "日本" };

export interface Settings {
  startMonth: string; // YYYY-MM
  endMonth: string; // YYYY-MM
  jpyPerCny: number; // 為替レート：1元 = ○円
  characters: string[]; // キャラクター候補
}

export const DEFAULT_SETTINGS: Settings = {
  startMonth: "2026-11",
  endMonth: "2027-12",
  jpyPerCny: 21,
  characters: ["スタジオハヌル", "Lovely MongMong", "ふにゅ"],
};

// ---------- 通貨 ----------
// 集計・表示は元（CNY）。日本の案件は円（JPY）で入力し、設定のレートで元に換算する。

export type Currency = "CNY" | "JPY";
export const CURRENCY_LABELS: Record<Currency, string> = { CNY: "元", JPY: "円" };
export const currencyOf = (c: Country): Currency => (c === "JP" ? "JPY" : "CNY");

/** 元に換算（1円未満…ではなく 1元未満は四捨五入） */
export function toCny(amount: number, currency: Currency, jpyPerCny: number): number {
  return currency === "JPY" ? Math.round(amount / jpyPerCny) : amount;
}

// ---------- 案件（ライセンス／オフライン／その他） ----------

export type EntryKind = "license" | "offline" | "other";

export const LICENSE_TYPES = ["MG", "ロイヤリティ"] as const;
export const OFFLINE_TYPES = ["POP UP", "委託販売"] as const;

export interface EntryInput {
  country: Country;
  month: string; // 計上月 YYYY-MM
  amount: number; // 入力した通貨での金額（中国=元、日本=円）・整数
  licensee?: string; // ライセンス: ライセンシー名（株式会社などは除いて保存）
  character?: string; // ライセンス・オフライン
  type?: string; // ライセンス: MG/ロイヤリティ、オフライン: POP UP/委託販売
  venue?: string; // オフライン: お店の名前 or イベント名
  company?: string; // その他: 会社名（株式会社などは除いて保存）
  content?: string; // その他: 案件内容
}

export interface Entry extends EntryInput {
  id: string;
  kind: EntryKind;
  /** 請求書ツールから反映されたもの（PL管理では編集できない） */
  source?: "invoice";
  invoiceId?: string;
  invoiceNumber?: string;
  clientName?: string;
  currency: Currency; // 入力した通貨（国で決まる）
  amountCny: number; // 元に換算した金額（一覧表示・集計用）
  createdAt: string;
  updatedAt: string;
}

// ---------- オンライン（週次） ----------

/** 国ごとのオンラインの内訳（中国は販売先、日本はキャラクター） */
export const ONLINE_CHANNELS = {
  CN: [
    { key: "xiaohongshu", label: "小红书" },
    { key: "taobao", label: "淘宝" },
  ],
  JP: [
    { key: "hanul", label: "スタジオハヌル" },
    { key: "mongmong", label: "Lovely MongMong" },
    { key: "funyu", label: "ふにゅ" },
  ],
} as const satisfies Record<Country, readonly { key: string; label: string }[]>;
export type Channel = (typeof ONLINE_CHANNELS)[Country][number]["key"];
export const isChannelOf = (country: Country, key: unknown): key is Channel =>
  ONLINE_CHANNELS[country].some((c) => c.key === key);

export interface Week {
  no: number;
  weekStart: string; // 月曜 YYYY-MM-DD
  weekEnd: string; // 日曜
  autoMonth: string; // 木曜日が属する月
  overrideMonth: string | null; // 手動で変えた計上月
  bookingMonth: string; // 実際の計上月
}

/** 金額は入力した通貨（中国=元、日本=円）。totalCny だけ元に換算した値 */
export interface OnlineWeek extends Week {
  values: Partial<Record<Channel, number>>;
  total: number;
  totalCny: number;
}

export interface OnlineMonth {
  month: string;
  weeks: OnlineWeek[];
  subtotal: Partial<Record<Channel, number>>;
  /** 内訳ごとの月合計（元に換算） */
  subtotalCny: Partial<Record<Channel, number>>;
  total: number;
  totalCny: number;
}

export interface OnlineView {
  country: Country;
  currency: Currency;
  settings: Settings;
  months: string[];
  groups: OnlineMonth[];
}

// ---------- 1ページ目（売上一覧） ----------

/**
 * 国ごとの毎月の目標（元）。画面からは編集できない固定値。
 * 変えるときはここを書き換えて公開し直す。
 */
export const COUNTRY_TARGETS: Record<Country, number> = { CN: 100_000, JP: 100_000 };

/** 売上一覧の区分（国 × 区分） */
export interface Line {
  id: string; // 例: CN_LICENSE
  country: Country;
  label: string;
  source: EntryKind | "online";
}

export const LINES: Line[] = [
  { id: "CN_LICENSE", country: "CN", label: "ライセンス", source: "license" },
  { id: "CN_ONLINE", country: "CN", label: "オンライン", source: "online" },
  { id: "CN_OFFLINE", country: "CN", label: "オフライン", source: "offline" },
  { id: "CN_OTHER", country: "CN", label: "その他", source: "other" },
  { id: "JP_LICENSE", country: "JP", label: "ライセンス", source: "license" },
  { id: "JP_ONLINE", country: "JP", label: "オンライン", source: "online" },
  { id: "JP_OFFLINE", country: "JP", label: "オフライン", source: "offline" },
  { id: "JP_OTHER", country: "JP", label: "その他", source: "other" },
];

/** country 行に国の合計を出す（国の「計」行は持たない） */
export type SummaryRowKind = "country" | "line" | "channel" | "grand";

export interface SummaryRow {
  key: string;
  label: string;
  kind: SummaryRowKind;
  /** 目標（国・合計の行だけ。区分・内訳の行は null） */
  target: Record<string, number> | null;
  sales: Record<string, number>;
}

export interface Summary {
  /** 請求書ツールを読み込めなかったときなどのお知らせ */
  notices: string[];
  settings: Settings;
  months: string[];
  rows: SummaryRow[];
}

/**
 * 共有ログイン用のアカウント。画面ではパスワードだけを入力し、内部ではこのメールアドレスでログインする。
 * 実在しない（メールが届かない）アドレスで構わない。サーバーはこのアカウント以外を受け付けない。
 */
export const SHARED_LOGIN_EMAIL = "login@sales.internal";

/** 請求書ツール（帳票発行ツール）の URL。請求書から反映した行のリンクに使う */
export const INVOICE_APP_URL = "https://inclue-invoice.web.app";
