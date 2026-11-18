// Firestore の読み書き。コレクション構成はここに集約する。
//
// settings/app                     … 期間・通貨ラベル
// settings/masters                 … キャラクター・契約形態の候補
// categories/{categoryId}          … 入力カテゴリ
// monthlyEntries/{catId}_{YYYY-MM} … 月別入力（目標/予定/入金済み）
// weeklyEntries/{weekStart}_{catId}… 週別入力
// weeks/{weekStart}                … 計上月の手動上書き
// deals/{autoId}                   … ライセンス案件
// counters/deals                   … 案件 No の採番
// members/{uid}                    … 利用を許可したメンバー
// auditLogs/{autoId}               … 変更履歴

import { getFirestore, FieldValue, type Firestore } from "firebase-admin/firestore";
import { monthlyKey, weeklyKey, type RawData } from "./domain/aggregate";
import { defaultCategories } from "./domain/categories";
import {
  DEFAULT_MASTERS,
  DEFAULT_SETTINGS,
  type Category,
  type Deal,
  type DealInput,
  type Masters,
  type Settings,
  type Triple,
  type ValueField,
} from "./domain/types";

const db = (): Firestore => getFirestore();

const toTriple = (d: FirebaseFirestore.DocumentData): Triple => ({
  target: Number(d.target ?? 0),
  plan: Number(d.plan ?? 0),
  paid: Number(d.paid ?? 0),
});

export async function getSettings(): Promise<Settings> {
  const snap = await db().doc("settings/app").get();
  return { ...DEFAULT_SETTINGS, ...(snap.data() as Partial<Settings> | undefined) };
}

export async function saveSettings(s: Settings): Promise<void> {
  await db().doc("settings/app").set(s);
}

export async function getMasters(): Promise<Masters> {
  const snap = await db().doc("settings/masters").get();
  return { ...DEFAULT_MASTERS, ...(snap.data() as Partial<Masters> | undefined) };
}

export async function saveMasters(m: Masters): Promise<void> {
  await db().doc("settings/masters").set(m);
}

export async function getCategories(): Promise<Category[]> {
  const snap = await db().collection("categories").get();
  if (!snap.empty) return snap.docs.map((d) => ({ ...(d.data() as Category), id: d.id }));
  // 初回: 既定カテゴリを投入
  const cats = defaultCategories();
  const batch = db().batch();
  for (const c of cats) batch.set(db().doc(`categories/${c.id}`), c);
  await batch.commit();
  return cats;
}

export async function loadRaw(): Promise<RawData> {
  const [settings, categories, monthlySnap, weeklySnap, weeksSnap] = await Promise.all([
    getSettings(),
    getCategories(),
    db().collection("monthlyEntries").get(),
    db().collection("weeklyEntries").get(),
    db().collection("weeks").get(),
  ]);
  const monthly = new Map<string, Triple>();
  for (const d of monthlySnap.docs) {
    const x = d.data();
    monthly.set(monthlyKey(x.categoryId, x.month), toTriple(x));
  }
  const weekly = new Map<string, Triple>();
  for (const d of weeklySnap.docs) {
    const x = d.data();
    weekly.set(weeklyKey(x.weekStart, x.categoryId), toTriple(x));
  }
  const weekOverrides: Record<string, string | null> = {};
  for (const d of weeksSnap.docs) weekOverrides[d.id] = d.data().bookingMonthOverride ?? null;
  return { settings, categories, monthly, weekly, weekOverrides };
}

export interface CellChange {
  field: ValueField;
  value: number;
}

export async function saveMonthlyCells(
  changes: Array<CellChange & { categoryId: string; month: string }>,
  uid: string,
): Promise<void> {
  const batch = db().batch();
  for (const c of changes) {
    // フィールド単位で merge するので、別のセルを同時に編集しても上書きし合わない
    batch.set(
      db().doc(`monthlyEntries/${c.categoryId}_${c.month}`),
      {
        categoryId: c.categoryId,
        month: c.month,
        currency: "JPY",
        [c.field]: c.value,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: uid,
      },
      { merge: true },
    );
  }
  await batch.commit();
}

export async function saveWeeklyCells(
  changes: Array<CellChange & { categoryId: string; weekStart: string }>,
  uid: string,
): Promise<void> {
  const batch = db().batch();
  for (const c of changes) {
    batch.set(
      db().doc(`weeklyEntries/${c.weekStart}_${c.categoryId}`),
      {
        categoryId: c.categoryId,
        weekStart: c.weekStart,
        currency: "JPY",
        [c.field]: c.value,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: uid,
      },
      { merge: true },
    );
  }
  await batch.commit();
}

export async function setWeekOverride(weekStart: string, month: string | null, uid: string): Promise<void> {
  await db()
    .doc(`weeks/${weekStart}`)
    .set({ bookingMonthOverride: month, updatedAt: FieldValue.serverTimestamp(), updatedBy: uid });
}

// ---------- 案件 ----------

function toDeal(id: string, x: FirebaseFirestore.DocumentData): Deal {
  return {
    id,
    no: x.no,
    country: x.country,
    character: x.character ?? "",
    licensee: x.licensee ?? "",
    title: x.title ?? "",
    productCategory: x.productCategory ?? "",
    contractType: x.contractType ?? "",
    status: x.status,
    startDate: x.startDate ?? null,
    endDate: x.endDate ?? null,
    royaltyRate: x.royaltyRate ?? null,
    amount: x.amount ?? null,
    owner: x.owner ?? "",
    note: x.note ?? "",
    createdAt: x.createdAt?.toDate?.().toISOString() ?? "",
    updatedAt: x.updatedAt?.toDate?.().toISOString() ?? "",
  };
}

export async function listDeals(): Promise<Deal[]> {
  const snap = await db().collection("deals").orderBy("no").get();
  return snap.docs.map((d) => toDeal(d.id, d.data()));
}

export async function getDeal(id: string): Promise<Deal | null> {
  const snap = await db().doc(`deals/${id}`).get();
  return snap.exists ? toDeal(snap.id, snap.data()!) : null;
}

/** 新規作成。No は欠番を詰めずに単調増加で採番する。 */
export async function createDeal(input: DealInput, uid: string): Promise<Deal> {
  const ref = db().collection("deals").doc();
  await db().runTransaction(async (tx) => {
    const counterRef = db().doc("counters/deals");
    const counter = await tx.get(counterRef);
    const no = (counter.data()?.last ?? 0) + 1;
    tx.set(counterRef, { last: no });
    tx.set(ref, {
      ...input,
      no,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: uid,
    });
  });
  return (await getDeal(ref.id))!;
}

export async function updateDeal(id: string, input: DealInput, uid: string): Promise<Deal> {
  await db()
    .doc(`deals/${id}`)
    .update({ ...input, updatedAt: FieldValue.serverTimestamp(), updatedBy: uid });
  return (await getDeal(id))!;
}

export async function deleteDeal(id: string): Promise<void> {
  await db().doc(`deals/${id}`).delete();
}

// ---------- メンバー・履歴 ----------

export async function isMember(uid: string): Promise<boolean> {
  return (await db().doc(`members/${uid}`).get()).exists;
}

export async function audit(
  uid: string,
  email: string | undefined,
  action: string,
  detail: Record<string, unknown>,
): Promise<void> {
  await db()
    .collection("auditLogs")
    .add({ at: FieldValue.serverTimestamp(), uid, email: email ?? null, action, detail });
}
