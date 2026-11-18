// API エントリポイント。1 つの callable 関数 `api` に action を渡して振り分ける。
// クライアントは Firestore に直接アクセスせず（firestore.rules で全拒否）、必ずここを通る。

import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { setGlobalOptions } from "firebase-functions/v2";
import { HttpsError, onCall, type CallableRequest } from "firebase-functions/v2/https";
import { buildOnline, buildSummary } from "./domain/aggregate";
import { entriesCsv, onlineCsv, summaryCsv } from "./domain/csv";
import { listMonths, listWeeks } from "./domain/period";
import { CHANNELS, LINES, type Channel, type Member } from "./domain/types";
import * as V from "./domain/validate";
import * as repo from "./repo";

initializeApp();
setGlobalOptions({ region: "asia-northeast1", maxInstances: 5 });

type Ctx = { uid: string; email?: string };
type Handler = (p: Record<string, unknown>, ctx: Ctx) => Promise<unknown>;

const summary = async () => buildSummary(await repo.loadRaw());
const online = async () => buildOnline(await repo.loadRaw());

function asArray(v: unknown): Record<string, unknown>[] {
  if (!Array.isArray(v) || v.length === 0 || v.length > 1000) throw new V.ValidationError("変更内容が不正です");
  return v as Record<string, unknown>[];
}

const handlers: Record<string, Handler> = {
  // ---- 1ページ目 ----
  getSummary: () => summary(),

  /** changes: [{lineId, month, value}] → 再計算後の一覧を返す */
  saveTargets: async (p, ctx) => {
    const s = await repo.getSettings();
    const months = listMonths(s.startMonth, s.endMonth);
    const changes = asArray(p.changes).map((c) => {
      if (!LINES.some((l) => l.id === c.lineId)) throw new V.ValidationError("区分が不正です");
      return { lineId: c.lineId as string, month: V.month(c.month, months), value: V.amount(c.value, "目標") };
    });
    await repo.saveTargets(changes, ctx.uid);
    await repo.audit(ctx.uid, ctx.email, "saveTargets", { changes });
    return summary();
  },

  // ---- ライセンス／オフライン／その他 ----
  listEntries: async (p) => {
    const list = await repo.listEntries(V.kind(p.kind));
    return list.sort((a, b) => b.month.localeCompare(a.month) || b.createdAt.localeCompare(a.createdAt));
  },

  saveEntry: async (p, ctx) => {
    const kind = V.kind(p.kind);
    const input = V.entry(kind, p.entry);
    if (p.id) {
      const before = await repo.getEntry(String(p.id));
      if (!before || before.kind !== kind) throw new HttpsError("not-found", "データが見つかりません");
      const after = await repo.updateEntry(before.id, input, ctx.uid);
      await repo.audit(ctx.uid, ctx.email, "updateEntry", { id: before.id, before, after: input });
      return after;
    }
    const created = await repo.createEntry(kind, input, ctx.uid);
    await repo.audit(ctx.uid, ctx.email, "createEntry", { id: created.id, kind, after: input });
    return created;
  },

  deleteEntry: async (p, ctx) => {
    const before = await repo.getEntry(String(p.id));
    if (!before) throw new HttpsError("not-found", "データが見つかりません");
    await repo.deleteEntry(before.id);
    await repo.audit(ctx.uid, ctx.email, "deleteEntry", { id: before.id, before });
    return { ok: true };
  },

  // ---- 中国オンライン（週次） ----
  getOnline: () => online(),

  /** changes: [{weekStart, channel, value}] */
  saveOnline: async (p, ctx) => {
    const s = await repo.getSettings();
    const weeks = new Set(listWeeks(s.startMonth, s.endMonth).map((w) => w.weekStart));
    const changes = asArray(p.changes).map((c) => {
      if (!weeks.has(c.weekStart as string)) throw new V.ValidationError("期間外の週です");
      if (!CHANNELS.some((ch) => ch.key === c.channel)) throw new V.ValidationError("販売先が不正です");
      return { weekStart: c.weekStart as string, channel: c.channel as Channel, value: V.amount(c.value) };
    });
    await repo.saveOnline(changes, ctx.uid);
    await repo.audit(ctx.uid, ctx.email, "saveOnline", { changes });
    return online();
  },

  /** 計上月の変更。month=null で自動に戻す */
  setWeekBookingMonth: async (p, ctx) => {
    const s = await repo.getSettings();
    const months = listMonths(s.startMonth, s.endMonth);
    const week = listWeeks(s.startMonth, s.endMonth).find((w) => w.weekStart === p.weekStart);
    if (!week) throw new V.ValidationError("期間外の週です");
    const m = p.month ? V.month(p.month, months) : null;
    await repo.setWeekOverride(week.weekStart, m === week.autoMonth ? null : m, ctx.uid);
    await repo.audit(ctx.uid, ctx.email, "setWeekBookingMonth", { weekStart: week.weekStart, month: m });
    return online();
  },

  // ---- 設定 ----
  getSettings: () => repo.getSettings(),

  saveSettings: async (p, ctx) => {
    const s = V.settings(p.settings);
    await repo.saveSettings(s);
    await repo.audit(ctx.uid, ctx.email, "saveSettings", { settings: s });
    return s;
  },

  // ---- メンバー ----
  listMembers: async () => {
    const snap = await getFirestore().collection("members").get();
    return snap.docs
      .map((d) => ({ uid: d.id, email: d.data().email, displayName: d.data().displayName ?? "" }) as Member)
      .sort((a, b) => a.email.localeCompare(b.email));
  },

  createMember: async (p, ctx) => {
    const email = String(p.email ?? "").trim();
    const password = String(p.password ?? "");
    const displayName = String(p.displayName ?? "").trim();
    if (!/^[^@\s]+@[^@\s]+$/.test(email)) throw new V.ValidationError("メールアドレスが不正です");
    if (password.length < 8) throw new V.ValidationError("パスワードは8文字以上にしてください");
    const user = await getAuth().createUser({ email, password, displayName: displayName || undefined });
    await getFirestore().doc(`members/${user.uid}`).set({ email, displayName });
    await repo.audit(ctx.uid, ctx.email, "createMember", { uid: user.uid, email });
    return { uid: user.uid, email, displayName } satisfies Member;
  },

  resetMemberPassword: async (p, ctx) => {
    const password = String(p.password ?? "");
    if (password.length < 8) throw new V.ValidationError("パスワードは8文字以上にしてください");
    await getAuth().updateUser(String(p.uid), { password });
    await repo.audit(ctx.uid, ctx.email, "resetMemberPassword", { uid: p.uid });
    return { ok: true };
  },

  deleteMember: async (p, ctx) => {
    const uid = String(p.uid);
    if (uid === ctx.uid) throw new V.ValidationError("自分自身は削除できません");
    await getFirestore().doc(`members/${uid}`).delete();
    await getAuth()
      .deleteUser(uid)
      .catch(() => undefined);
    await repo.audit(ctx.uid, ctx.email, "deleteMember", { uid });
    return { ok: true };
  },

  // ---- CSV ----
  exportCsv: async (p) => {
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    switch (p.kind) {
      case "summary":
        return { filename: `sales_summary_${stamp}.csv`, content: summaryCsv(await summary()) };
      case "online":
        return { filename: `cn_online_weekly_${stamp}.csv`, content: onlineCsv(await online()) };
      case "license":
      case "offline":
      case "other":
        return { filename: `${p.kind}_${stamp}.csv`, content: entriesCsv(p.kind, await repo.listEntries(p.kind)) };
      default:
        throw new V.ValidationError("出力の種類が不正です");
    }
  },
};

export const api = onCall(async (req: CallableRequest<{ action?: string; payload?: Record<string, unknown> }>) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "ログインしてください");
  if (!(await repo.isMember(req.auth.uid))) throw new HttpsError("permission-denied", "このアカウントには利用権限がありません");
  const handler = handlers[req.data?.action ?? ""];
  if (!handler) throw new HttpsError("invalid-argument", `不明な操作です: ${req.data?.action}`);
  try {
    return await handler(req.data.payload ?? {}, { uid: req.auth.uid, email: req.auth.token.email });
  } catch (e) {
    if (e instanceof V.ValidationError) throw new HttpsError("invalid-argument", e.message);
    if (e instanceof HttpsError) throw e;
    if ((e as { code?: string }).code === "auth/email-already-exists")
      throw new HttpsError("already-exists", "このメールアドレスは登録済みです");
    console.error(e);
    throw new HttpsError("internal", "サーバーでエラーが発生しました");
  }
});
