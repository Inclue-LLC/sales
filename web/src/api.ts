import { httpsCallable, httpsCallableFromURL } from "firebase/functions";
import type {
  Channel,
  Entry,
  EntryInput,
  EntryKind,
  Member,
  OnlineView,
  Settings,
  Summary,
} from "../../functions/src/domain/types";
import { functions, useEmulators } from "./firebase";

export type * from "../../functions/src/domain/types";
// 定数は functions と共有（types.ts は依存のない純粋なモジュール）
export { CHANNELS, COUNTRIES, COUNTRY_LABELS, LICENSE_TYPES, OFFLINE_TYPES } from "../../functions/src/domain/types";

type Req = { action: string; payload?: unknown };
const call = useEmulators
  ? httpsCallableFromURL<Req, unknown>(functions, `${window.location.origin}/__fn/demo-sales-pl/asia-northeast1/api`)
  : httpsCallable<Req, unknown>(functions, "api");

async function api<T>(action: string, payload?: unknown): Promise<T> {
  try {
    return (await call({ action, payload })).data as T;
  } catch (e) {
    throw new Error(e instanceof Error ? e.message : String(e));
  }
}

export type CsvKind = "summary" | "online" | EntryKind;

export const Api = {
  getSummary: () => api<Summary>("getSummary"),
  saveTargets: (changes: { lineId: string; month: string; value: number }[]) => api<Summary>("saveTargets", { changes }),

  listEntries: (kind: EntryKind) => api<Entry[]>("listEntries", { kind }),
  saveEntry: (kind: EntryKind, entry: EntryInput, id?: string) => api<Entry>("saveEntry", { kind, entry, id }),
  deleteEntry: (id: string) => api<{ ok: true }>("deleteEntry", { id }),

  getOnline: () => api<OnlineView>("getOnline"),
  saveOnline: (changes: { weekStart: string; channel: Channel; value: number }[]) => api<OnlineView>("saveOnline", { changes }),
  setWeekBookingMonth: (weekStart: string, month: string | null) => api<OnlineView>("setWeekBookingMonth", { weekStart, month }),

  getSettings: () => api<Settings>("getSettings"),
  saveSettings: (settings: Settings) => api<Settings>("saveSettings", { settings }),

  listMembers: () => api<Member[]>("listMembers"),
  createMember: (email: string, password: string, displayName: string) => api<Member>("createMember", { email, password, displayName }),
  resetMemberPassword: (uid: string, password: string) => api<{ ok: true }>("resetMemberPassword", { uid, password }),
  deleteMember: (uid: string) => api<{ ok: true }>("deleteMember", { uid }),

  exportCsv: (kind: CsvKind) => api<{ filename: string; content: string }>("exportCsv", { kind }),
};

/** CSV をダウンロードする（サーバーで BOM 付き UTF-8 を生成済み） */
export async function downloadCsv(kind: CsvKind) {
  const { filename, content } = await Api.exportCsv(kind);
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
