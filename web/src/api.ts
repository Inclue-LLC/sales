import { httpsCallable, httpsCallableFromURL } from "firebase/functions";
import type {
  Channel,
  Entry,
  EntryInput,
  EntryKind,
  OnlineView,
  Settings,
  Summary,
} from "../../functions/src/domain/types";
import { functions, useEmulators } from "./firebase";

export type * from "../../functions/src/domain/types";
// 定数は functions と共有（types.ts は依存のない純粋なモジュール）
export {
  CHANNELS,
  COUNTRIES,
  COUNTRY_LABELS,
  COUNTRY_TARGETS,
  CURRENCY_LABELS,
  LICENSE_TYPES,
  OFFLINE_TYPES,
  SHARED_LOGIN_EMAIL,
  currencyOf,
} from "../../functions/src/domain/types";

type Req = { action: string; payload?: unknown };
const call = useEmulators
  ? httpsCallableFromURL<Req, unknown>(functions, `${window.location.origin}/__fn/demo-sales-pl/asia-northeast1/api`)
  : httpsCallable<Req, unknown>(functions, "api");

/** Firebase のエラーを分かる言葉に（サーバーからの日本語メッセージはそのまま） */
function friendly(e: unknown): string {
  const code = (e as { code?: string })?.code ?? "";
  const msg = e instanceof Error ? e.message : String(e);
  if (code === "functions/internal" && /^internal$/i.test(msg))
    return "サーバーに接続できません。しばらくしてから再読み込みしてください（続く場合は管理者に連絡してください）";
  if (code === "functions/unavailable" || code === "functions/deadline-exceeded")
    return "サーバーが混み合っているか、通信が切れました。もう一度お試しください";
  if (code === "functions/unauthenticated") return "ログインし直してください";
  return msg;
}

async function api<T>(action: string, payload?: unknown): Promise<T> {
  try {
    return (await call({ action, payload })).data as T;
  } catch (e) {
    throw new Error(friendly(e));
  }
}

export const Api = {
  getSummary: () => api<Summary>("getSummary"),

  listEntries: (kind: EntryKind) => api<Entry[]>("listEntries", { kind }),
  saveEntry: (kind: EntryKind, entry: EntryInput, id?: string) => api<Entry>("saveEntry", { kind, entry, id }),
  deleteEntry: (id: string) => api<{ ok: true }>("deleteEntry", { id }),

  getOnline: () => api<OnlineView>("getOnline"),
  saveOnline: (changes: { weekStart: string; channel: Channel; value: number }[]) => api<OnlineView>("saveOnline", { changes }),

  getSettings: () => api<Settings>("getSettings"),
  saveSettings: (settings: Settings) => api<Settings>("saveSettings", { settings }),

  changePassword: (password: string) => api<{ ok: true }>("changePassword", { password }),
};
