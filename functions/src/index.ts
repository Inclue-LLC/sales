// API エントリポイント。1 つの callable 関数 `api` に action を渡して振り分ける。
// クライアントは Firestore に直接アクセスせず（firestore.rules で全拒否）、必ずここを通る。

import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { setGlobalOptions } from "firebase-functions/v2";
import { HttpsError, onCall, type CallableRequest } from "firebase-functions/v2/https";
import { buildOnline, buildSummary } from "./domain/aggregate";
import { listWeeks } from "./domain/period";
import { CHANNELS, SHARED_LOGIN_EMAIL, toCny, type Channel, type Entry } from "./domain/types";
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


  // ---- ライセンス／オフライン／その他 ----
  listEntries: async (p) => {
    const [list, s] = await Promise.all([repo.listEntries(V.kind(p.kind)), repo.getSettings()]);
    return list
      .map((e): Entry => ({ ...e, amountCny: toCny(e.amount, e.currency, s.jpyPerCny) }))
      .sort((a, b) => b.month.localeCompare(a.month) || b.createdAt.localeCompare(a.createdAt));
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

  // ---- 設定 ----
  getSettings: () => repo.getSettings(),

  saveSettings: async (p, ctx) => {
    const s = V.settings(p.settings);
    await repo.saveSettings(s);
    await repo.audit(ctx.uid, ctx.email, "saveSettings", { settings: s });
    return s;
  },

  // ---- 共有パスワード ----
  changePassword: async (p, ctx) => {
    const password = String(p.password ?? "");
    if (password.length < 8) throw new V.ValidationError("パスワードは8文字以上にしてください");
    await getAuth().updateUser(ctx.uid, { password });
    await repo.audit(ctx.uid, ctx.email, "changePassword", {});
    return { ok: true };
  },
};

export const api = onCall(async (req: CallableRequest<{ action?: string; payload?: Record<string, unknown> }>) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "ログインしてください");
  const action = req.data?.action ?? "";
  try {
    // 共有アカウント以外は受け付けない（Firebase Auth で勝手に作られたアカウントを弾く）
    if (req.auth.token.email !== SHARED_LOGIN_EMAIL) throw new HttpsError("permission-denied", "このアカウントには利用権限がありません");
    const handler = handlers[action];
    if (!handler) throw new HttpsError("invalid-argument", `不明な操作です: ${action}`);
    return await handler(req.data.payload ?? {}, { uid: req.auth.uid, email: req.auth.token.email });
  } catch (e) {
    if (e instanceof V.ValidationError) throw new HttpsError("invalid-argument", e.message);
    if (e instanceof HttpsError) throw e;
    // 権限不足（データベースを作っていない・サービスアカウントにロールが無い など）はログで分かるようにする
    console.error(`api action=${action} failed`, e);
    const grpc = (e as { code?: number }).code;
    if (grpc === 7)
      throw new HttpsError("internal", "サーバーにデータベースへのアクセス権がありません（サービスアカウントのロールを確認してください）");
    if (grpc === 5) throw new HttpsError("internal", "データベースが見つかりません（Firestore を作成したか確認してください）");
    throw new HttpsError("internal", "サーバーでエラーが発生しました");
  }
});
