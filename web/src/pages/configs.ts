import { LICENSE_TYPES, OFFLINE_TYPES } from "../api";
import type { EntryPageConfig } from "./EntryPage";

export const licenseConfig: EntryPageConfig = {
  kind: "license",
  title: "ライセンス",
  description: "ライセンス案件の売上を入力します（中国は元、日本は円）。計上月ごとに売上一覧の「ライセンス」へ元で反映されます。",
  fields: [
    { key: "licensee", label: "ライセンシー", kind: "text", placeholder: "例：サンプル（株式会社などは省く）" },
    { key: "character", label: "キャラクター", kind: "character" },
    { key: "type", label: "種別", kind: "choice", options: LICENSE_TYPES },
  ],
};

export const offlineConfig: EntryPageConfig = {
  kind: "offline",
  title: "オフライン",
  description: "POP UP・委託販売の売上を入力します（中国は元、日本は円）。計上月ごとに売上一覧の「オフライン」へ元で反映されます。",
  fields: [
    { key: "character", label: "キャラクター", kind: "character" },
    { key: "type", label: "種別", kind: "choice", options: OFFLINE_TYPES },
    { key: "venue", label: "お店・イベント名", kind: "text", placeholder: "例：渋谷PARCO" },
  ],
};

export const otherConfig: EntryPageConfig = {
  kind: "other",
  title: "その他",
  description: "上記以外の売上を入力します（中国は元、日本は円）。計上月ごとに売上一覧の「その他」へ元で反映されます。",
  fields: [
    { key: "company", label: "会社名", kind: "text", placeholder: "例：サンプル（株式会社などは省く）" },
    { key: "content", label: "案件内容", kind: "text", placeholder: "例：イラスト制作費", wide: true },
  ],
};
