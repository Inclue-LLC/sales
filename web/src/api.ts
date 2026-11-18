import { httpsCallable, httpsCallableFromURL } from "firebase/functions";
import type {
  Deal,
  DealInput,
  Masters,
  Member,
  MonthlyPl,
  Settings,
  ValueField,
  WeeklyView,
} from "../../functions/src/domain/types";
import { functions, useEmulators } from "./firebase";

export type * from "../../functions/src/domain/types";
// 定数は functions と共有（types.ts は依存のない純粋なモジュール）
export { COUNTRY_LABELS, DEAL_STATUSES, DEFAULT_MASTERS } from "../../functions/src/domain/types";

type Req = { action: string; payload?: unknown };
const call = useEmulators
  ? httpsCallableFromURL<Req, unknown>(functions, `${window.location.origin}/__fn/demo-sales-pl/asia-northeast1/api`)
  : httpsCallable<Req, unknown>(functions, "api");

async function api<T>(action: string, payload?: unknown): Promise<T> {
  try {
    const res = await call({ action, payload });
    return res.data as T;
  } catch (e) {
    throw new Error(errorMessage(e));
  }
}

export function errorMessage(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) return String((e as Error).message);
  return String(e);
}

export const Api = {
  getMonthlyPl: () => api<MonthlyPl>("getMonthlyPl"),
  saveMonthlyCells: (changes: Array<{ categoryId: string; month: string; field: ValueField; value: number }>) =>
    api<MonthlyPl>("saveMonthlyCells", { changes }),

  getWeekly: () => api<WeeklyView>("getWeekly"),
  saveWeeklyCells: (changes: Array<{ weekStart: string; categoryId: string; field: ValueField; value: number }>) =>
    api<WeeklyView>("saveWeeklyCells", { changes }),
  setWeekBookingMonth: (weekStart: string, month: string | null) =>
    api<WeeklyView>("setWeekBookingMonth", { weekStart, month }),

  listDeals: () => api<Deal[]>("listDeals"),
  saveDeal: (deal: DealInput, id?: string) => api<Deal>("saveDeal", { deal, id }),
  deleteDeal: (id: string) => api<{ ok: true }>("deleteDeal", { id }),

  getSettings: () => api<{ settings: Settings; masters: Masters }>("getSettings"),
  saveSettings: (settings: Settings, masters: Masters) =>
    api<{ settings: Settings; masters: Masters }>("saveSettings", { settings, masters }),

  listMembers: () => api<Member[]>("listMembers"),
  createMember: (email: string, password: string, displayName: string) =>
    api<Member>("createMember", { email, password, displayName }),
  resetMemberPassword: (uid: string, password: string) => api<{ ok: true }>("resetMemberPassword", { uid, password }),
  deleteMember: (uid: string) => api<{ ok: true }>("deleteMember", { uid }),

  exportCsv: (kind: "monthly" | "weekly" | "deals") =>
    api<{ filename: string; content: string }>("exportCsv", { kind }),
};

/** CSV をダウンロードする（サーバーで BOM 付き UTF-8 を生成済み） */
export async function downloadCsv(kind: "monthly" | "weekly" | "deals") {
  const { filename, content } = await Api.exportCsv(kind);
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // すぐに revoke するとファイル名が失われるブラウザがあるので少し待つ
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
