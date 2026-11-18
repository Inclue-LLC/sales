// 画面・サーバー・CSV で共有する型と定数。
// web 側からも import する（依存のない純粋なモジュールにしておく）。

export type Country = "CN" | "JP";
export const COUNTRIES: Country[] = ["CN", "JP"];
export const COUNTRY_LABELS: Record<Country, string> = { CN: "中国", JP: "日本" };

export interface Settings {
  startMonth: string; // YYYY-MM
  endMonth: string; // YYYY-MM
  currencyLabel: string;
  characters: string[]; // キャラクター候補
}

export const DEFAULT_SETTINGS: Settings = {
  startMonth: "2026-11",
  endMonth: "2027-12",
  currencyLabel: "円",
  characters: ["スタジオハヌル", "Lovely MongMong", "ふにゅ"],
};

// ---------- 案件（ライセンス／オフライン／その他） ----------

export type EntryKind = "license" | "offline" | "other";

export const LICENSE_TYPES = ["MG", "ロイヤリティ"] as const;
export const OFFLINE_TYPES = ["POP UP", "委託販売"] as const;

export interface EntryInput {
  country: Country;
  month: string; // 計上月 YYYY-MM
  amount: number; // 円・整数
  character?: string; // ライセンス・オフライン
  type?: string; // ライセンス: MG/ロイヤリティ、オフライン: POP UP/委託販売
  venue?: string; // オフライン: お店の名前 or イベント名
  content?: string; // その他: 案件内容
}

export interface Entry extends EntryInput {
  id: string;
  kind: EntryKind;
  createdAt: string;
  updatedAt: string;
}

// ---------- 中国オンライン（週次） ----------

export const CHANNELS = [
  { key: "xiaohongshu", label: "小红书" },
  { key: "taobao", label: "淘宝" },
] as const;
export type Channel = (typeof CHANNELS)[number]["key"];

export interface Week {
  no: number;
  weekStart: string; // 月曜 YYYY-MM-DD
  weekEnd: string; // 日曜
  autoMonth: string; // 木曜日が属する月
  overrideMonth: string | null; // 手動で変えた計上月
  bookingMonth: string; // 実際の計上月
}

export interface OnlineWeek extends Week {
  values: Record<Channel, number>;
  total: number;
}

export interface OnlineMonth {
  month: string;
  weeks: OnlineWeek[];
  subtotal: Record<Channel, number>;
  total: number;
}

export interface OnlineView {
  settings: Settings;
  months: string[];
  groups: OnlineMonth[];
}

// ---------- 1ページ目（売上一覧） ----------

/** 目標を入力する行（国 × 区分） */
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
  { id: "JP_OFFLINE", country: "JP", label: "オフライン", source: "offline" },
  { id: "JP_OTHER", country: "JP", label: "その他", source: "other" },
];

export type SummaryRowKind = "country" | "line" | "channel" | "total" | "grand";

export interface SummaryRow {
  key: string;
  label: string;
  kind: SummaryRowKind;
  /** 目標を入力できる行だけ入る */
  lineId?: string;
  /** 目標（内訳行=チャネルには目標がないので null） */
  target: Record<string, number> | null;
  sales: Record<string, number>;
}

export interface Summary {
  settings: Settings;
  months: string[];
  rows: SummaryRow[];
}

export interface Member {
  uid: string;
  email: string;
  displayName: string;
}
