// API エントリポイント。
// コールドスタートとデプロイ単位を減らすため、1 つの callable 関数 `api` に action を渡して振り分ける。
// クライアントは Firestore に直接アクセスせず（firestore.rules で全拒否）、必ずここを通る。

import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { setGlobalOptions } from "firebase-functions/v2";
import { HttpsError, onCall, type CallableRequest } from "firebase-functions/v2/https";
import { buildMonthlyPl, buildWeekly } from "./domain/aggregate";
import { dealsCsv, monthlyPlCsv, weeklyCsv } from "./domain/csv";
import { listMonths, listWeeks } from "./domain/period";
import type { Member } from "./domain/types";
import * as V from "./domain/validate";
import * as repo from "./repo";

initializeApp();
setGlobalOptions({ region: "asia-northeast1", maxInstances: 5 });

type Ctx = { uid: string; email?: string };
type Handler = (payload: Record<string, unknown>, ctx: Ctx) => Promise<unknown>;

const monthlyPl = async () => buildMonthlyPl(await repo.loadRaw());
const weeklyView = async () => buildWeekly(await repo.loadRaw());

const handlers: Record<string, Handler> = {
  // ---- 月次PL ----
  getMonthlyPl: () => monthlyPl(),

  /** changes: [{categoryId, month, field, value}] → 再計算後の PL を返す */
  saveMonthlyCells: async (p, ctx) => {
    const settings = await repo.getSettings();
    const months = listMonths(settings.startMonth, settings.endMonth);
    const cats = await repo.getCategories();
    const changes = asArray(p.changes).map((c) => {
      const cat = cats.find((x) => x.id === c.categoryId);
      if (!cat) throw new V.ValidationError("カテゴリが不正です");
      if (cat.granularity !== "monthly") throw new V.ValidationError("この行は週次から自動集計されます");
      return { categoryId: cat.id, month: V.month(c.month, months), field: V.field(c.field), value: V.amount(c.value) };
    });
    await repo.saveMonthlyCells(changes, ctx.uid);
    await repo.audit(ctx.uid, ctx.email, "saveMonthlyCells", { changes });
    return monthlyPl();
  },

  // ---- 週次 ----
  getWeekly: () => weeklyView(),

  /** changes: [{weekStart, categoryId, field, value}] → 再計算後の週次ビューを返す */
  saveWeeklyCells: async (p, ctx) => {
    const settings = await repo.getSettings();
    const weekStarts = new Set(listWeeks(settings.startMonth, settings.endMonth).map((w) => w.weekStart));
    const cats = await repo.getCategories();
    const changes = asArray(p.changes).map((c) => {
      const cat = cats.find((x) => x.id === c.categoryId);
      if (!cat || cat.granularity !== "weekly") throw new V.ValidationError("カテゴリが不正です");
      if (!weekStarts.has(c.weekStart as string)) throw new V.ValidationError("期間外の週です");
      return {
        categoryId: cat.id,
        weekStart: c.weekStart as string,
        field: V.field(c.field),
        value: V.amount(c.value),
      };
    });
    await repo.saveWeeklyCells(changes, ctx.uid);
    await repo.audit(ctx.uid, ctx.email, "saveWeeklyCells", { changes });
    return weeklyView();
  },

  /** 計上月の上書き。month=null で自動判定に戻す */
  setWeekBookingMonth: async (p, ctx) => {
    const settings = await repo.getSettings();
    const months = listMonths(settings.startMonth, settings.endMonth);
    const weekStart = String(p.weekStart);
    const week = listWeeks(settings.startMonth, settings.endMonth).find((w) => w.weekStart === weekStart);
    if (!week) throw new V.ValidationError("期間外の週です");
    const m = p.month === null || p.month === "" ? null : V.month(p.month, months);
    await repo.setWeekOverride(weekStart, m === week.autoMonth ? null : m, ctx.uid);
    await repo.audit(ctx.uid, ctx.email, "setWeekBookingMonth", { weekStart, month: m });
    return weeklyView();
  },

  // ---- 案件 ----
  listDeals: () => repo.listDeals(),

  saveDeal: async (p, ctx) => {
    const input = V.deal(p.deal);
    if (p.id) {
      const before = await repo.getDeal(String(p.id));
      if (!before) throw new HttpsError("not-found", "案件が見つかりません");
      const after = await repo.updateDeal(before.id, input, ctx.uid);
      await repo.audit(ctx.uid, ctx.email, "updateDeal", { id: before.id, before, after: input });
      return after;
    }
    const created = await repo.createDeal(input, ctx.uid);
    await repo.audit(ctx.uid, ctx.email, "createDeal", { id: created.id, after: input });
    return created;
  },

  deleteDeal: async (p, ctx) => {
    const before = await repo.getDeal(String(p.id));
    if (!before) throw new HttpsError("not-found", "案件が見つかりません");
    await repo.deleteDeal(before.id);
    await repo.audit(ctx.uid, ctx.email, "deleteDeal", { id: before.id, before });
    return { ok: true };
  },

  // ---- 設定 ----
  getSettings: async () => ({ settings: await repo.getSettings(), masters: await repo.getMasters() }),

  saveSettings: async (p, ctx) => {
    const settings = V.settings(p.settings);
    const masters = V.masters(p.masters);
    await Promise.all([repo.saveSettings(settings), repo.saveMasters(masters)]);
    await repo.audit(ctx.uid, ctx.email, "saveSettings", { settings, masters });
    return { settings, masters };
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
      case "monthly":
        return { filename: `monthly_pl_${stamp}.csv`, content: monthlyPlCsv(await monthlyPl()) };
      case "weekly":
        return { filename: `weekly_online_${stamp}.csv`, content: weeklyCsv(await weeklyView()) };
      case "deals":
        return { filename: `license_deals_${stamp}.csv`, content: dealsCsv(await repo.listDeals()) };
      default:
        throw new V.ValidationError("出力の種類が不正です");
    }
  },
};

function asArray(v: unknown): Record<string, unknown>[] {
  if (!Array.isArray(v) || v.length === 0 || v.length > 1000) throw new V.ValidationError("変更内容が不正です");
  return v as Record<string, unknown>[];
}

export const api = onCall(async (req: CallableRequest<{ action?: string; payload?: Record<string, unknown> }>) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "ログインしてください");
  if (!(await repo.isMember(req.auth.uid))) {
    throw new HttpsError("permission-denied", "このアカウントには利用権限がありません");
  }
  const action = req.data?.action ?? "";
  const handler = handlers[action];
  if (!handler) throw new HttpsError("invalid-argument", `不明な操作です: ${action}`);
  try {
    return await handler(req.data.payload ?? {}, { uid: req.auth.uid, email: req.auth.token.email });
  } catch (e) {
    if (e instanceof V.ValidationError) throw new HttpsError("invalid-argument", e.message);
    if (e instanceof HttpsError) throw e;
    const code = (e as { code?: string }).code;
    if (code === "auth/email-already-exists") throw new HttpsError("already-exists", "このメールアドレスは登録済みです");
    console.error(e);
    throw new HttpsError("internal", "サーバーでエラーが発生しました");
  }
});
